-- Phase 3.3: Auto-Scheduling System Database Schema
-- Creates tables for automated meeting scheduling and calendar holds

-- Calendar holds to prevent double-booking during scheduling negotiations
CREATE TABLE IF NOT EXISTS calendar_holds (
    id SERIAL PRIMARY KEY,
    meeting_request_id INTEGER REFERENCES meeting_requests(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    holder_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'expired', 'cancelled')),
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Scheduling responses from recipients for automated workflows
CREATE TABLE IF NOT EXISTS scheduling_responses (
    id SERIAL PRIMARY KEY,
    meeting_request_id INTEGER REFERENCES meeting_requests(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    response_type VARCHAR(50) NOT NULL CHECK (response_type IN ('accept_time', 'reject_time', 'suggest_alternative', 'decline_meeting')),
    suggested_time_start TIMESTAMP WITH TIME ZONE,
    suggested_time_end TIMESTAMP WITH TIME ZONE,
    response_confidence DECIMAL(3,2) DEFAULT 0.8,
    ai_analysis JSONB,
    email_content TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow tracking for multi-step scheduling processes
CREATE TABLE IF NOT EXISTS scheduling_workflows (
    id SERIAL PRIMARY KEY,
    meeting_request_id INTEGER REFERENCES meeting_requests(id) ON DELETE CASCADE,
    workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN ('direct_schedule', 'negotiate_time', 'multi_recipient', 'recurring_setup')),
    current_step VARCHAR(100) NOT NULL,
    total_steps INTEGER DEFAULT 1,
    step_number INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
    context JSONB,
    next_action_time TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-scheduling preferences and rules
CREATE TABLE IF NOT EXISTS auto_scheduling_preferences (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    preference_type VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    priority INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_email, preference_type)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_calendar_holds_meeting_request ON calendar_holds(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_calendar_holds_status_expiry ON calendar_holds(status, expiry_time);
CREATE INDEX IF NOT EXISTS idx_calendar_holds_time_range ON calendar_holds(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_scheduling_responses_meeting_request ON scheduling_responses(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_responses_recipient ON scheduling_responses(recipient_email);
CREATE INDEX IF NOT EXISTS idx_scheduling_responses_type ON scheduling_responses(response_type);

CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_meeting_request ON scheduling_workflows(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_status ON scheduling_workflows(status);
CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_next_action ON scheduling_workflows(next_action_time) WHERE next_action_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auto_scheduling_preferences_user ON auto_scheduling_preferences(user_email);
CREATE INDEX IF NOT EXISTS idx_auto_scheduling_preferences_type ON auto_scheduling_preferences(preference_type);

-- Trigger to update workflow updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduling_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_scheduling_workflows_updated_at ON scheduling_workflows;
CREATE TRIGGER trigger_scheduling_workflows_updated_at
    BEFORE UPDATE ON scheduling_workflows
    FOR EACH ROW EXECUTE FUNCTION update_scheduling_workflows_updated_at();

-- Sample auto-scheduling preferences (default values)
INSERT INTO auto_scheduling_preferences (user_email, preference_type, preference_value, priority) VALUES
('default', 'working_hours', '{"start": "09:00", "end": "17:00", "timezone": "America/New_York", "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]}', 9),
('default', 'buffer_time', '{"before_meeting": 15, "after_meeting": 15, "unit": "minutes"}', 8),
('default', 'auto_confirm_threshold', '{"confidence_score": 0.85, "known_contacts_only": false}', 7),
('default', 'hold_duration', '{"duration_minutes": 1440, "max_concurrent_holds": 5}', 6),
('default', 'meeting_lengths', '{"default": 60, "quick_chat": 15, "brief": 30, "standard": 60, "detailed": 90, "unit": "minutes"}', 5)
ON CONFLICT (user_email, preference_type) DO NOTHING;

-- Function to clean up expired holds
CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE calendar_holds 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expiry_time < NOW();
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION check_scheduling_conflict(
    p_start_time TIMESTAMP WITH TIME ZONE,
    p_end_time TIMESTAMP WITH TIME ZONE,
    p_exclude_hold_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM calendar_holds
    WHERE status IN ('active', 'confirmed')
    AND (p_exclude_hold_id IS NULL OR id != p_exclude_hold_id)
    AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
    );
    
    RETURN conflict_count > 0;
END;
$$ LANGUAGE plpgsql;