-- Phase 1: Learning Threshold Enhancement Schema
-- PURPOSE: Add statistical rigor to learning system without breaking existing functionality
-- APPROACH: Add new columns with sensible defaults to maintain backward compatibility

-- Add threshold tracking columns to existing learning_insights table
-- Using ALTER TABLE ADD COLUMN with defaults ensures no disruption
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS time_span_days INTEGER DEFAULT 0;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS first_occurrence TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS last_applied TIMESTAMP;
ALTER TABLE learning_insights ADD COLUMN IF NOT EXISTS threshold_met BOOLEAN DEFAULT FALSE;

-- Add threshold tracking to edit_analyses for better insights
ALTER TABLE edit_analyses ADD COLUMN IF NOT EXISTS context_factors JSONB DEFAULT '{}';
ALTER TABLE edit_analyses ADD COLUMN IF NOT EXISTS validation_score DECIMAL(3,2) DEFAULT 1.0;

-- Create index for efficient threshold queries
CREATE INDEX IF NOT EXISTS idx_learning_insights_threshold_met ON learning_insights(threshold_met, sample_size DESC);
CREATE INDEX IF NOT EXISTS idx_learning_insights_time_span ON learning_insights(time_span_days DESC);
CREATE INDEX IF NOT EXISTS idx_edit_analyses_validation ON edit_analyses(validation_score DESC, created_at DESC);

-- Function to calculate time span for existing insights (backward compatibility)
CREATE OR REPLACE FUNCTION calculate_insight_time_spans()
RETURNS void AS $$
DECLARE
    insight_record RECORD;
    calculated_time_span INTEGER;
    sample_count INTEGER;
BEGIN
    -- Update existing learning_insights with calculated time spans
    FOR insight_record IN 
        SELECT id, pattern_type, pattern_value, created_at, last_updated 
        FROM learning_insights 
        WHERE learning_insights.time_span_days = 0 OR learning_insights.sample_size = 0
    LOOP
        -- Calculate time span between first and last occurrence
        calculated_time_span := GREATEST(1, EXTRACT(DAY FROM (insight_record.last_updated - insight_record.created_at)));
        
        -- Count related edit analyses for sample size
        SELECT COUNT(*) INTO sample_count
        FROM edit_analyses 
        WHERE edit_type = insight_record.pattern_value
        AND created_at >= insight_record.created_at - INTERVAL '1 day'
        AND created_at <= insight_record.last_updated + INTERVAL '1 day';
        
        -- Update the insight record
        UPDATE learning_insights 
        SET 
            time_span_days = calculated_time_span,
            sample_size = GREATEST(sample_count, frequency),
            first_occurrence = insight_record.created_at,
            threshold_met = (sample_count >= 5 AND confidence >= 65 AND calculated_time_span >= 3)
        WHERE id = insight_record.id;
        
        -- Log progress
        RAISE NOTICE 'Updated insight % (type: %, value: %) - Sample size: %, Time span: % days', 
            insight_record.id, insight_record.pattern_type, insight_record.pattern_value, sample_count, calculated_time_span;
    END LOOP;
    
    RAISE NOTICE 'Time span calculation completed for existing insights';
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger function for automatic threshold validation
CREATE OR REPLACE FUNCTION update_learning_insights_with_thresholds()
RETURNS TRIGGER AS $$
DECLARE
    existing_insight RECORD;
    time_span_days INTEGER;
    meets_threshold BOOLEAN DEFAULT FALSE;
BEGIN
    -- Get existing insight if it exists
    SELECT * INTO existing_insight
    FROM learning_insights 
    WHERE pattern_type = 'edit_type' AND pattern_value = NEW.edit_type;
    
    -- Calculate if thresholds are met
    IF existing_insight.id IS NOT NULL THEN
        time_span_days := GREATEST(1, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - existing_insight.first_occurrence)));
        meets_threshold := (existing_insight.frequency >= 5 AND existing_insight.confidence >= 65 AND time_span_days >= 3);
    END IF;
    
    -- Update or insert learning insight with threshold validation
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the existing trigger with the enhanced version
DROP TRIGGER IF EXISTS update_insights_on_edit_analysis ON edit_analyses;
CREATE TRIGGER update_insights_on_edit_analysis_with_thresholds
    AFTER INSERT ON edit_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_insights_with_thresholds();

-- Run the backward compatibility function to update existing data
SELECT calculate_insight_time_spans();

-- Create a view for easily querying validated insights
CREATE OR REPLACE VIEW validated_learning_insights AS
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
    CASE 
        WHEN threshold_met THEN 'VALIDATED'
        WHEN sample_size >= 5 AND confidence < 65 THEN 'INSUFFICIENT_CONFIDENCE'
        WHEN sample_size >= 5 AND time_span_days < 3 THEN 'INSUFFICIENT_TIME_SPAN'
        WHEN sample_size < 5 THEN 'INSUFFICIENT_SAMPLES'
        ELSE 'PENDING_VALIDATION'
    END as validation_status,
    created_at,
    last_updated
FROM learning_insights
ORDER BY threshold_met DESC, confidence DESC, sample_size DESC;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '=== Phase 1 Threshold Enhancement Schema Applied Successfully ===';
    RAISE NOTICE 'Added columns: sample_size, time_span_days, first_occurrence, last_applied, threshold_met';
    RAISE NOTICE 'Enhanced trigger: update_insights_on_edit_analysis_with_thresholds';
    RAISE NOTICE 'Created view: validated_learning_insights';
    RAISE NOTICE 'Backward compatibility: Existing insights updated with calculated thresholds';
END $$;