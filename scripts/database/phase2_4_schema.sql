-- Phase 2.4: Learning & Feedback System Schema

-- Store detailed edit analysis for learning
CREATE TABLE IF NOT EXISTS edit_analyses (
    id SERIAL PRIMARY KEY,
    response_id VARCHAR(100) NOT NULL, -- References generated_responses.response_id
    original_text TEXT NOT NULL,
    edited_text TEXT NOT NULL,
    edit_type VARCHAR(20) NOT NULL, -- tone, content, length, structure, mixed
    edit_percentage INTEGER DEFAULT 0, -- 0-100 percentage of text changed
    edit_description TEXT, -- AI-generated description of changes
    success_score INTEGER DEFAULT 50, -- 0-100 based on edit amount (0=failed, 100=perfect)
    learning_insight TEXT, -- Key insight for future improvement
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store learning patterns and insights
CREATE TABLE IF NOT EXISTS learning_insights (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(50) NOT NULL, -- edit_type, sender_relationship, urgency_level
    pattern_value VARCHAR(100) NOT NULL, -- specific value (e.g., 'tone', 'boss', 'high')
    frequency INTEGER DEFAULT 1, -- How often this pattern occurs
    success_rate DECIMAL(5,2) DEFAULT 50.0, -- Average success rate for this pattern
    recommendation TEXT NOT NULL, -- What to do about this pattern
    confidence INTEGER DEFAULT 50, -- 0-100 confidence in recommendation
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track tone profile adjustments over time
CREATE TABLE IF NOT EXISTS tone_profile_adjustments (
    id SERIAL PRIMARY KEY,
    base_profile_id INTEGER, -- Original tone profile
    adjustment_reason TEXT NOT NULL, -- Why the adjustment was made
    adjustments_applied TEXT NOT NULL, -- JSON of specific changes
    performance_before DECIMAL(5,2), -- Success rate before adjustment
    performance_after DECIMAL(5,2), -- Success rate after adjustment (filled later)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store weekly performance metrics for trending
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    total_responses INTEGER DEFAULT 0,
    no_edit_responses INTEGER DEFAULT 0,
    minor_edit_responses INTEGER DEFAULT 0,
    major_rewrite_responses INTEGER DEFAULT 0,
    deleted_responses INTEGER DEFAULT 0,
    overall_success_rate DECIMAL(5,2) DEFAULT 50.0,
    avg_confidence DECIMAL(5,2) DEFAULT 50.0,
    avg_user_rating DECIMAL(3,2), -- 1.0-5.0 rating
    improvement_trend VARCHAR(20) DEFAULT 'stable', -- improving, stable, declining
    key_insights TEXT[], -- Array of key insights for the week
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store user feedback patterns for learning
CREATE TABLE IF NOT EXISTS feedback_patterns (
    id SERIAL PRIMARY KEY,
    feedback_type VARCHAR(50) NOT NULL, -- rating, edit, deletion, usage
    context_factors TEXT, -- JSON of context factors (sender_type, urgency, etc.)
    user_action VARCHAR(50) NOT NULL, -- what the user did
    satisfaction_score INTEGER, -- derived satisfaction (0-100)
    learning_weight DECIMAL(3,2) DEFAULT 1.0, -- How much to weight this feedback
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edit_analyses_response_id ON edit_analyses(response_id);
CREATE INDEX IF NOT EXISTS idx_edit_analyses_edit_type ON edit_analyses(edit_type);
CREATE INDEX IF NOT EXISTS idx_edit_analyses_success_score ON edit_analyses(success_score DESC);
CREATE INDEX IF NOT EXISTS idx_edit_analyses_created_at ON edit_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insights_pattern ON learning_insights(pattern_type, pattern_value);
CREATE INDEX IF NOT EXISTS idx_learning_insights_success_rate ON learning_insights(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_learning_insights_updated ON learning_insights(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_tone_adjustments_active ON tone_profile_adjustments(is_active);
CREATE INDEX IF NOT EXISTS idx_tone_adjustments_created ON tone_profile_adjustments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_week ON performance_metrics(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_success_rate ON performance_metrics(overall_success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_patterns_type ON feedback_patterns(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_patterns_created ON feedback_patterns(created_at DESC);

-- Functions for automatic metrics calculation
CREATE OR REPLACE FUNCTION update_learning_insights()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert learning insight for this edit type
    INSERT INTO learning_insights (pattern_type, pattern_value, frequency, success_rate, recommendation, confidence)
    VALUES ('edit_type', NEW.edit_type, 1, NEW.success_score, 
            CASE 
                WHEN NEW.success_score >= 75 THEN 'Current approach working well'
                WHEN NEW.success_score >= 50 THEN 'Minor adjustments needed'
                ELSE 'Significant improvements required'
            END, 
            50)
    ON CONFLICT (pattern_type, pattern_value) 
    DO UPDATE SET 
        frequency = GREATEST(learning_insights.frequency + 1, 1),
        success_rate = CASE 
            WHEN learning_insights.frequency > 0 THEN 
                (learning_insights.success_rate * learning_insights.frequency + NEW.success_score) / (learning_insights.frequency + 1)
            ELSE NEW.success_score
        END,
        confidence = LEAST(90, learning_insights.confidence + 2),
        last_updated = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update learning insights when edits are analyzed
CREATE TRIGGER update_insights_on_edit_analysis
    AFTER INSERT ON edit_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_learning_insights();

-- Function to calculate weekly performance metrics
CREATE OR REPLACE FUNCTION calculate_weekly_metrics()
RETURNS void AS $$
DECLARE
    week_date DATE;
    metrics_record RECORD;
BEGIN
    -- Get the start of the current week (Monday)
    week_date := DATE_TRUNC('week', CURRENT_DATE)::DATE;
    
    -- Calculate metrics for the current week
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE edit_percentage = 0 OR edit_percentage IS NULL) as no_edits,
        COUNT(*) FILTER (WHERE edit_percentage > 0 AND edit_percentage <= 20) as minor_edits,
        COUNT(*) FILTER (WHERE edit_percentage > 20 AND edit_percentage <= 70) as major_rewrites,
        COUNT(*) FILTER (WHERE edit_percentage > 70 OR was_sent = false) as deletions,
        AVG(CASE 
            WHEN edit_percentage = 0 OR edit_percentage IS NULL THEN 100
            WHEN edit_percentage <= 20 THEN 75 
            WHEN edit_percentage <= 70 THEN 25
            ELSE 0
        END) as success_rate,
        AVG(confidence) as avg_conf,
        AVG(user_rating) as avg_rating
    INTO metrics_record
    FROM generated_responses 
    WHERE DATE_TRUNC('week', generated_at)::DATE = week_date;
    
    -- Insert or update weekly metrics
    INSERT INTO performance_metrics (
        week_start, total_responses, no_edit_responses, minor_edit_responses,
        major_rewrite_responses, deleted_responses, overall_success_rate,
        avg_confidence, avg_user_rating, improvement_trend
    ) VALUES (
        week_date, 
        COALESCE(metrics_record.total, 0),
        COALESCE(metrics_record.no_edits, 0),
        COALESCE(metrics_record.minor_edits, 0),
        COALESCE(metrics_record.major_rewrites, 0),
        COALESCE(metrics_record.deletions, 0),
        COALESCE(metrics_record.success_rate, 50.0),
        COALESCE(metrics_record.avg_conf, 50.0),
        COALESCE(metrics_record.avg_rating, 3.0),
        'stable'
    ) ON CONFLICT (week_start) DO UPDATE SET
        total_responses = EXCLUDED.total_responses,
        no_edit_responses = EXCLUDED.no_edit_responses,
        minor_edit_responses = EXCLUDED.minor_edit_responses,
        major_rewrite_responses = EXCLUDED.major_rewrite_responses,
        deleted_responses = EXCLUDED.deleted_responses,
        overall_success_rate = EXCLUDED.overall_success_rate,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_user_rating = EXCLUDED.avg_user_rating;
END;
$$ LANGUAGE plpgsql;

-- Create unique constraints to prevent duplicates (only if they don't exist)
DO $$ 
BEGIN
    -- Add unique constraint for learning_insights if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_pattern_insight') THEN
        ALTER TABLE learning_insights ADD CONSTRAINT unique_pattern_insight UNIQUE (pattern_type, pattern_value);
    END IF;
    
    -- Add unique constraint for performance_metrics if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_week_metrics') THEN
        ALTER TABLE performance_metrics ADD CONSTRAINT unique_week_metrics UNIQUE (week_start);
    END IF;
END $$;