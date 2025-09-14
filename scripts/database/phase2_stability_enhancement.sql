-- Phase 2: Pattern Stability Analysis Enhancement
-- PURPOSE: Add stability scoring to detect pattern drift and inconsistencies
-- APPROACH: Add variance-based stability tracking to prevent outdated pattern application

-- Add stability tracking columns to learning_insights table
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS stability_score DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS pattern_variance DECIMAL(5,3) DEFAULT 0.0;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS weekly_success_rates DECIMAL(5,2)[] DEFAULT '{}';
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS stability_validated BOOLEAN DEFAULT FALSE;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS pattern_drift_detected BOOLEAN DEFAULT FALSE;

-- Add stability tracking to edit_analyses for time-windowed analysis
ALTER TABLE edit_analyses ADD COLUMN IF NOT EXISTS time_window VARCHAR(20) DEFAULT 'week-0';
ALTER TABLE edit_analyses ADD COLUMN IF NOT EXISTS stability_factor DECIMAL(3,2) DEFAULT 1.0;

-- Create indexes for efficient stability queries
CREATE INDEX IF NOT EXISTS idx_learning_insights_stability ON learning_insights(stability_score DESC, stability_validated);
CREATE INDEX IF NOT EXISTS idx_learning_insights_drift ON learning_insights(pattern_drift_detected, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_edit_analyses_time_window ON edit_analyses(edit_type, time_window, created_at DESC);

-- Function to calculate pattern stability over time windows
CREATE OR REPLACE FUNCTION calculate_pattern_stability(
    pattern_type_param TEXT,
    pattern_value_param TEXT,
    user_id_param TEXT DEFAULT NULL
)
RETURNS TABLE(
    stability_score DECIMAL(3,2),
    pattern_variance DECIMAL(5,3),
    weekly_rates DECIMAL(5,2)[],
    is_stable BOOLEAN,
    drift_detected BOOLEAN
) AS $$
DECLARE
    weekly_data RECORD;
    success_rates DECIMAL(5,2)[];
    rate_count INTEGER;
    mean_rate DECIMAL(5,2);
    variance_calc DECIMAL(5,3);
    stability_calc DECIMAL(3,2);
    drift_detected_calc BOOLEAN DEFAULT FALSE;
    recent_trend DECIMAL(3,2);
    historical_trend DECIMAL(3,2);
BEGIN
    -- Get weekly success rates for the pattern
    FOR weekly_data IN
        SELECT 
            DATE_TRUNC('week', ea.created_at) as week_start,
            AVG(ea.success_score) as week_avg_success
        FROM edit_analyses ea
        WHERE ea.edit_type = pattern_value_param
            AND ea.created_at >= CURRENT_DATE - INTERVAL '8 weeks'
            AND (user_id_param IS NULL OR ea.user_id = user_id_param)
        GROUP BY DATE_TRUNC('week', ea.created_at)
        HAVING COUNT(*) >= 2
        ORDER BY week_start
    LOOP
        success_rates := success_rates || weekly_data.week_avg_success;
    END LOOP;

    rate_count := array_length(success_rates, 1);
    
    -- Need at least 3 weeks of data for stability analysis
    IF rate_count < 3 THEN
        RETURN QUERY SELECT 0.5::DECIMAL(3,2), 0.0::DECIMAL(5,3), success_rates, FALSE, FALSE;
        RETURN;
    END IF;

    -- Calculate mean success rate
    SELECT AVG(rate) INTO mean_rate FROM unnest(success_rates) as rate;
    
    -- Calculate variance
    SELECT AVG(POWER(rate - mean_rate, 2)) INTO variance_calc FROM unnest(success_rates) as rate;
    
    -- Calculate stability score (coefficient of variation approach)
    IF mean_rate > 0 THEN
        stability_calc := GREATEST(0, LEAST(1, 1 - (SQRT(variance_calc) / mean_rate)));
    ELSE
        stability_calc := 0;
    END IF;

    -- Detect pattern drift (recent performance significantly different from historical)
    IF rate_count >= 4 THEN
        -- Compare recent 2 weeks vs historical average
        SELECT AVG(rate) INTO recent_trend 
        FROM unnest(success_rates[rate_count-1:rate_count]) as rate;
        
        SELECT AVG(rate) INTO historical_trend 
        FROM unnest(success_rates[1:rate_count-2]) as rate;
        
        -- Drift detected if recent performance differs by >20 points
        drift_detected_calc := ABS(recent_trend - historical_trend) > 20;
    END IF;

    RETURN QUERY SELECT 
        stability_calc, 
        variance_calc, 
        success_rates,
        (stability_calc >= 0.7)::BOOLEAN,
        drift_detected_calc;
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger function for automatic stability validation
CREATE OR REPLACE FUNCTION update_learning_insights_with_stability()
RETURNS TRIGGER AS $$
DECLARE
    existing_insight RECORD;
    stability_data RECORD;
    time_span_days INTEGER;
    meets_threshold BOOLEAN DEFAULT FALSE;
    meets_stability BOOLEAN DEFAULT FALSE;
BEGIN
    -- Get existing insight if it exists
    SELECT * INTO existing_insight
    FROM learning_insights 
    WHERE pattern_type = 'edit_type' AND pattern_value = NEW.edit_type;
    
    -- Update the basic learning insight first (from Phase 1)
    INSERT INTO learning_insights (
        pattern_type, pattern_value, frequency, success_rate, recommendation, confidence,
        sample_size, time_span_days, first_occurrence, threshold_met
    )
    VALUES (
        'edit_type', NEW.edit_type, 1, NEW.success_score, 
        CASE 
            WHEN NEW.success_score >= 75 THEN 'Current approach working well'
            WHEN NEW.success_score >= 50 THEN 'Minor adjustments needed'
            ELSE 'Significant improvements required'
        END, 
        50, 1, 1, CURRENT_TIMESTAMP, FALSE
    )
    ON CONFLICT (pattern_type, pattern_value) 
    DO UPDATE SET 
        frequency = GREATEST(learning_insights.frequency + 1, 1),
        success_rate = CASE 
            WHEN learning_insights.frequency > 0 THEN 
                (learning_insights.success_rate * learning_insights.frequency + NEW.success_score) / (learning_insights.frequency + 1)
            ELSE NEW.success_score
        END,
        confidence = LEAST(90, learning_insights.confidence + 2),
        sample_size = learning_insights.frequency + 1,
        time_span_days = GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - learning_insights.first_occurrence))),
        threshold_met = (
            (learning_insights.frequency + 1) >= 5 AND 
            LEAST(90, learning_insights.confidence + 2) >= 65 AND
            GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - learning_insights.first_occurrence))) >= 3
        ),
        last_updated = CURRENT_TIMESTAMP;

    -- Now calculate stability if we have enough data
    SELECT * INTO stability_data 
    FROM calculate_pattern_stability('edit_type', NEW.edit_type, NEW.user_id);

    -- Update stability information
    UPDATE learning_insights 
    SET 
        stability_score = stability_data.stability_score,
        pattern_variance = stability_data.pattern_variance,
        weekly_success_rates = stability_data.weekly_rates,
        stability_validated = stability_data.is_stable,
        pattern_drift_detected = stability_data.drift_detected
    WHERE pattern_type = 'edit_type' AND pattern_value = NEW.edit_type;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the existing trigger with the enhanced version
DROP TRIGGER IF EXISTS update_insights_on_edit_analysis_with_thresholds ON edit_analyses;
DROP TRIGGER IF EXISTS update_insights_with_stability_analysis ON edit_analyses;
CREATE TRIGGER update_insights_with_stability_analysis
    AFTER INSERT ON edit_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_insights_with_stability();

-- Enhanced validated learning insights view with stability
CREATE OR REPLACE VIEW validated_learning_insights_with_stability AS
SELECT 
    id,
    pattern_type,
    pattern_value,
    frequency,
    success_rate,
    recommendation,
    confidence,
    sample_size,
    time_span_days,
    threshold_met,
    stability_score,
    pattern_variance,
    stability_validated,
    pattern_drift_detected,
    CASE 
        WHEN threshold_met AND stability_validated AND NOT pattern_drift_detected THEN 'FULLY_VALIDATED'
        WHEN threshold_met AND NOT stability_validated THEN 'THRESHOLD_MET_BUT_UNSTABLE'
        WHEN threshold_met AND pattern_drift_detected THEN 'PATTERN_DRIFT_DETECTED'
        WHEN stability_validated AND NOT threshold_met THEN 'STABLE_BUT_INSUFFICIENT_DATA'
        WHEN sample_size >= 5 AND confidence < 65 THEN 'INSUFFICIENT_CONFIDENCE'
        WHEN sample_size >= 5 AND time_span_days < 3 THEN 'INSUFFICIENT_TIME_SPAN'
        WHEN sample_size < 5 THEN 'INSUFFICIENT_SAMPLES'
        ELSE 'PENDING_VALIDATION'
    END as validation_status,
    created_at,
    last_updated
FROM learning_insights
ORDER BY 
    (threshold_met AND stability_validated AND NOT pattern_drift_detected) DESC,
    stability_score DESC, 
    confidence DESC, 
    sample_size DESC;

-- Function to cleanup patterns with detected drift
CREATE OR REPLACE FUNCTION handle_pattern_drift()
RETURNS void AS $$
DECLARE
    drifted_pattern RECORD;
BEGIN
    -- Log patterns with detected drift
    FOR drifted_pattern IN 
        SELECT pattern_type, pattern_value, stability_score, pattern_variance
        FROM learning_insights 
        WHERE pattern_drift_detected = TRUE
    LOOP
        RAISE NOTICE 'Pattern drift detected: % = % (stability: %, variance: %)',
            drifted_pattern.pattern_type, 
            drifted_pattern.pattern_value,
            drifted_pattern.stability_score,
            drifted_pattern.pattern_variance;
    END LOOP;

    -- Mark drifted patterns as not meeting thresholds temporarily
    UPDATE learning_insights 
    SET threshold_met = FALSE,
        last_updated = CURRENT_TIMESTAMP
    WHERE pattern_drift_detected = TRUE;
    
    RAISE NOTICE 'Pattern drift handling completed';
END;
$$ LANGUAGE plpgsql;

-- Create a function to demonstrate stability calculation
CREATE OR REPLACE FUNCTION demo_stability_calculation()
RETURNS void AS $$
BEGIN
    RAISE NOTICE '=== PHASE 2 STABILITY DEMONSTRATION ===';
    RAISE NOTICE 'Stable pattern: [85, 88, 82, 87] → High stability score';
    RAISE NOTICE 'Unstable pattern: [85, 45, 80, 30] → Low stability score';
    RAISE NOTICE 'Drifting pattern: [85, 70, 55, 40] → Drift detection';
    RAISE NOTICE '=== Stability analysis will prevent unreliable pattern application ===';
END;
$$ LANGUAGE plpgsql;

-- Run the demonstration
SELECT demo_stability_calculation();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '=== Phase 2 Stability Enhancement Schema Applied Successfully ===';
    RAISE NOTICE 'Added columns: stability_score, pattern_variance, stability_validated, pattern_drift_detected';
    RAISE NOTICE 'Enhanced trigger: update_insights_with_stability_analysis';
    RAISE NOTICE 'Created view: validated_learning_insights_with_stability';
    RAISE NOTICE 'Added function: calculate_pattern_stability, handle_pattern_drift';
    RAISE NOTICE 'Phase 2: Pattern Stability Analysis is now operational!';
END $$;