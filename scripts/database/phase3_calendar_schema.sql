-- Phase 3: Calendar Intelligence Database Schema
-- Created: August 31, 2025
-- Purpose: Support Google Calendar integration and smart scheduling

-- Calendar Events Storage
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    google_event_id VARCHAR(255) UNIQUE NOT NULL,
    calendar_id VARCHAR(255) DEFAULT 'primary',
    summary TEXT NOT NULL,
    description TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    timezone VARCHAR(100),
    location TEXT,
    status VARCHAR(50) DEFAULT 'confirmed',
    attendees JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Calendar Preferences
CREATE TABLE IF NOT EXISTS calendar_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) DEFAULT 'default_user',
    preference_type VARCHAR(100) NOT NULL, -- 'no_early_meetings', 'friday_protection', 'focus_blocks', 'meeting_buffer'
    preference_value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Scheduling Patterns (Learning System)
CREATE TABLE IF NOT EXISTS scheduling_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL, -- 'optimal_time', 'meeting_duration', 'attendee_preference', 'conflict_resolution'
    pattern_data JSONB NOT NULL,
    frequency INTEGER DEFAULT 1,
    success_rate DECIMAL(5,2) DEFAULT 0.0,
    confidence DECIMAL(5,2) DEFAULT 0.0,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Requests from Emails (AI Detection)
CREATE TABLE IF NOT EXISTS meeting_requests (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES emails(id),
    sender_email VARCHAR(255) NOT NULL,
    subject TEXT,
    meeting_type VARCHAR(100), -- 'urgent', 'regular', 'flexible', 'recurring'
    requested_duration INTEGER, -- minutes
    preferred_dates JSONB, -- array of suggested dates
    attendees JSONB DEFAULT '[]',
    location_preference TEXT,
    special_requirements TEXT,
    urgency_level VARCHAR(20) DEFAULT 'medium',
    detection_confidence DECIMAL(5,2) DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'scheduled', 'declined', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generated Meeting Responses
CREATE TABLE IF NOT EXISTS meeting_responses (
    id SERIAL PRIMARY KEY,
    meeting_request_id INTEGER REFERENCES meeting_requests(id),
    response_type VARCHAR(50) NOT NULL, -- 'acceptance', 'alternative_times', 'decline', 'reschedule'
    suggested_times JSONB, -- array of suggested time slots
    response_body TEXT NOT NULL,
    calendar_event_id INTEGER REFERENCES calendar_events(id),
    confidence DECIMAL(5,2) DEFAULT 0.0,
    context_used JSONB DEFAULT '[]',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Availability Cache (Just-in-Time Performance Optimization)
CREATE TABLE IF NOT EXISTS availability_cache (
    id SERIAL PRIMARY KEY,
    date_key DATE NOT NULL,
    calendar_id VARCHAR(255) DEFAULT 'primary',
    availability_data JSONB NOT NULL, -- cached availability for the day
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(date_key, calendar_id)
);

-- Calendar Feedback (Learning System)
CREATE TABLE IF NOT EXISTS calendar_feedback (
    id SERIAL PRIMARY KEY,
    meeting_response_id INTEGER REFERENCES meeting_responses(id),
    feedback_type VARCHAR(100) NOT NULL, -- 'time_changed', 'meeting_cancelled', 'attendee_modified', 'location_changed'
    original_data JSONB NOT NULL,
    modified_data JSONB NOT NULL,
    edit_percentage DECIMAL(5,2) DEFAULT 0.0,
    user_satisfaction INTEGER CHECK (user_satisfaction BETWEEN 1 AND 5),
    learning_insight TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_datetime ON calendar_events(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_email ON meeting_requests(email_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_sender ON meeting_requests(sender_email);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_availability_cache_date ON availability_cache(date_key, calendar_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_patterns_type ON scheduling_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_calendar_feedback_type ON calendar_feedback(feedback_type);

-- Insert Default Calendar Preferences
INSERT INTO calendar_preferences (preference_type, preference_value, is_active) VALUES
('no_early_meetings', '{"before_time": "10:00", "enabled": true}', true),
('friday_protection', '{"max_meetings": 2, "enabled": true}', true),
('focus_blocks', '{"duration_hours": 2, "daily_minimum": 1, "enabled": true}', true),
('meeting_buffer', '{"minutes": 15, "enabled": true}', true),
('working_hours', '{"start": "09:00", "end": "17:00", "timezone": "America/New_York"}', true)
ON CONFLICT DO NOTHING;

-- Functions for Calendar Intelligence

-- Update availability cache when calendar events change
CREATE OR REPLACE FUNCTION update_availability_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate cache for the affected date
    DELETE FROM availability_cache 
    WHERE date_key = DATE(COALESCE(NEW.start_datetime, OLD.start_datetime));
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain availability cache
DROP TRIGGER IF EXISTS trigger_update_availability_cache ON calendar_events;
CREATE TRIGGER trigger_update_availability_cache
    AFTER INSERT OR UPDATE OR DELETE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_availability_cache();

-- Function to update scheduling patterns (learning system)
CREATE OR REPLACE FUNCTION update_scheduling_patterns()
RETURNS TRIGGER AS $$
DECLARE
    pattern_exists BOOLEAN;
    pattern_key TEXT;
BEGIN
    -- Extract pattern key from feedback data
    pattern_key := NEW.feedback_type || '_' || COALESCE((NEW.modified_data->>'meeting_type'), 'general');
    
    -- Check if pattern exists
    SELECT EXISTS(SELECT 1 FROM scheduling_patterns WHERE pattern_type = pattern_key) INTO pattern_exists;
    
    IF pattern_exists THEN
        -- Update existing pattern
        UPDATE scheduling_patterns 
        SET 
            frequency = frequency + 1,
            success_rate = CASE 
                WHEN NEW.user_satisfaction >= 4 THEN GREATEST(success_rate + 5.0, 100.0)
                WHEN NEW.user_satisfaction <= 2 THEN GREATEST(success_rate - 10.0, 0.0)
                ELSE success_rate
            END,
            confidence = LEAST(confidence + 2.0, 100.0),
            last_used = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE pattern_type = pattern_key;
    ELSE
        -- Create new pattern
        INSERT INTO scheduling_patterns (pattern_type, pattern_data, frequency, success_rate, confidence)
        VALUES (
            pattern_key,
            jsonb_build_object(
                'feedback_type', NEW.feedback_type,
                'common_changes', NEW.modified_data,
                'avg_satisfaction', NEW.user_satisfaction
            ),
            1,
            CASE WHEN NEW.user_satisfaction >= 4 THEN 75.0 ELSE 25.0 END,
            30.0
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic pattern learning
DROP TRIGGER IF EXISTS trigger_update_scheduling_patterns ON calendar_feedback;
CREATE TRIGGER trigger_update_scheduling_patterns
    AFTER INSERT ON calendar_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduling_patterns();

-- Views for Calendar Intelligence

-- Available time slots view
CREATE OR REPLACE VIEW available_time_slots AS
SELECT 
    date_trunc('day', generate_series(
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        '1 day'
    )) as date,
    CASE 
        WHEN COUNT(ce.id) = 0 THEN 'fully_available'
        WHEN COUNT(ce.id) < 3 THEN 'partially_available'
        ELSE 'busy'
    END as availability_status,
    COUNT(ce.id) as meeting_count,
    ARRAY_AGG(
        CASE WHEN ce.id IS NOT NULL 
        THEN jsonb_build_object(
            'start', ce.start_datetime,
            'end', ce.end_datetime,
            'summary', ce.summary
        ) END
    ) FILTER (WHERE ce.id IS NOT NULL) as existing_meetings
FROM generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    '1 day'
) dates(date)
LEFT JOIN calendar_events ce ON DATE(ce.start_datetime) = dates.date
GROUP BY dates.date
ORDER BY dates.date;

-- Meeting patterns analysis view
CREATE OR REPLACE VIEW meeting_patterns_analysis AS
SELECT 
    pattern_type,
    frequency,
    success_rate,
    confidence,
    pattern_data,
    CASE 
        WHEN success_rate >= 80 AND confidence >= 70 THEN 'highly_recommended'
        WHEN success_rate >= 60 AND confidence >= 50 THEN 'recommended'
        WHEN success_rate >= 40 THEN 'conditional'
        ELSE 'avoid'
    END as recommendation_level,
    last_used,
    created_at
FROM scheduling_patterns
WHERE frequency >= 2
ORDER BY success_rate DESC, confidence DESC, frequency DESC;