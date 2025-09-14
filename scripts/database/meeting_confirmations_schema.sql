-- Meeting Confirmations Schema
-- Purpose: Track meeting confirmations after draft responses are sent
-- Created: 2025-09-14

-- Meeting Confirmations Table
CREATE TABLE IF NOT EXISTS meeting_confirmations (
    id VARCHAR(255) PRIMARY KEY,
    draft_id VARCHAR(255) NOT NULL,
    meeting_request_id INTEGER NOT NULL REFERENCES meeting_requests(id),
    user_id VARCHAR(255) NOT NULL,
    selected_time_slot JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    calendar_event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_confirmations_user_id ON meeting_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_confirmations_status ON meeting_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_meeting_confirmations_meeting_request_id ON meeting_confirmations(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_meeting_confirmations_draft_id ON meeting_confirmations(draft_id);

-- Composite index for user-specific pending confirmations
CREATE INDEX IF NOT EXISTS idx_meeting_confirmations_user_status ON meeting_confirmations(user_id, status);

-- Add comments for documentation
COMMENT ON TABLE meeting_confirmations IS 'Tracks meeting confirmations after draft responses are sent';
COMMENT ON COLUMN meeting_confirmations.id IS 'Unique confirmation ID';
COMMENT ON COLUMN meeting_confirmations.draft_id IS 'Reference to the auto-generated draft';
COMMENT ON COLUMN meeting_confirmations.meeting_request_id IS 'Reference to the original meeting request';
COMMENT ON COLUMN meeting_confirmations.user_id IS 'User who sent the draft response';
COMMENT ON COLUMN meeting_confirmations.selected_time_slot IS 'JSON object with start, end, and duration';
COMMENT ON COLUMN meeting_confirmations.status IS 'Confirmation status: pending, confirmed, or cancelled';
COMMENT ON COLUMN meeting_confirmations.calendar_event_id IS 'Google Calendar event ID after confirmation';

-- Create a view for pending confirmations with meeting details
CREATE OR REPLACE VIEW pending_meeting_confirmations AS
SELECT 
    mc.id,
    mc.draft_id,
    mc.meeting_request_id,
    mc.user_id,
    mc.selected_time_slot,
    mc.status,
    mc.created_at,
    mr.subject,
    mr.sender_email,
    mr.preferred_dates,
    mr.requested_duration,
    mr.location_preference,
    mr.special_requirements
FROM meeting_confirmations mc
JOIN meeting_requests mr ON mc.meeting_request_id = mr.id
WHERE mc.status = 'pending'
ORDER BY mc.created_at DESC;

COMMENT ON VIEW pending_meeting_confirmations IS 'View of pending meeting confirmations with meeting request details';

-- Create a function to get user's pending confirmations
CREATE OR REPLACE FUNCTION get_user_pending_confirmations(user_id_param VARCHAR(255))
RETURNS TABLE(
    id VARCHAR(255),
    draft_id VARCHAR(255),
    meeting_request_id INTEGER,
    subject TEXT,
    sender_email VARCHAR(255),
    selected_time_slot JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.id,
        mc.draft_id,
        mc.meeting_request_id,
        mr.subject,
        mr.sender_email,
        mc.selected_time_slot,
        mc.created_at
    FROM meeting_confirmations mc
    JOIN meeting_requests mr ON mc.meeting_request_id = mr.id
    WHERE mc.user_id = user_id_param 
    AND mc.status = 'pending'
    ORDER BY mc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_pending_confirmations IS 'Get all pending meeting confirmations for a specific user';

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_confirmations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meeting_confirmations_updated_at
    BEFORE UPDATE ON meeting_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION update_meeting_confirmations_updated_at();

-- Grant appropriate permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE ON meeting_confirmations TO app_user;
-- GRANT SELECT ON pending_meeting_confirmations TO app_user;
-- GRANT EXECUTE ON FUNCTION get_user_pending_confirmations TO app_user;

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Meeting confirmations schema created successfully';
    RAISE NOTICE 'Table: meeting_confirmations';
    RAISE NOTICE 'View: pending_meeting_confirmations';
    RAISE NOTICE 'Function: get_user_pending_confirmations';
    RAISE NOTICE 'Trigger: trigger_update_meeting_confirmations_updated_at';
END $$;
