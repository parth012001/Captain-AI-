-- Meeting Pipeline Database Schema
-- Purpose: Support meeting detection pipeline integration
-- Created: 2024-09-14

-- Meeting Processing Results (track all emails processed for meetings)
CREATE TABLE IF NOT EXISTS meeting_processing_results (
    id SERIAL PRIMARY KEY,
    email_id VARCHAR(100) NOT NULL, -- References emails(id) as string
    user_id VARCHAR(100) NOT NULL,
    is_meeting_request BOOLEAN NOT NULL,
    confidence INTEGER DEFAULT 0, -- 0-100
    processing_time_ms INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'processed', -- 'processed', 'skipped', 'error'
    reason TEXT, -- Why skipped or error details
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't process the same email twice for the same user
    UNIQUE(email_id, user_id)
);

-- Add missing columns to existing meeting_requests table (if they don't exist)
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='meeting_requests' AND column_name='user_id') THEN
        ALTER TABLE meeting_requests ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT 'default_user';
    END IF;

    -- Update the email_id to allow string references (Gmail IDs are strings)
    -- Only if the column exists as INTEGER type
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='meeting_requests' AND column_name='email_id' AND data_type='integer') THEN
        ALTER TABLE meeting_requests ALTER COLUMN email_id TYPE VARCHAR(100);
    END IF;

    -- Add unique constraint on email_id and user_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name='meeting_requests' AND constraint_name='meeting_requests_email_user_unique') THEN
        ALTER TABLE meeting_requests ADD CONSTRAINT meeting_requests_email_user_unique UNIQUE(email_id, user_id);
    END IF;
END $$;

-- Indexes for meeting processing results
CREATE INDEX IF NOT EXISTS idx_meeting_processing_email ON meeting_processing_results(email_id);
CREATE INDEX IF NOT EXISTS idx_meeting_processing_user ON meeting_processing_results(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_processing_status ON meeting_processing_results(is_meeting_request, status);
CREATE INDEX IF NOT EXISTS idx_meeting_processing_time ON meeting_processing_results(processed_at DESC);

-- Index for meeting_requests with user_id
CREATE INDEX IF NOT EXISTS idx_meeting_requests_user ON meeting_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_user_status ON meeting_requests(user_id, status);

-- Function to get meeting pipeline statistics
CREATE OR REPLACE FUNCTION get_meeting_pipeline_stats(user_id_param VARCHAR(100))
RETURNS TABLE(
    total_processed INTEGER,
    meeting_requests_found INTEGER,
    success_rate DECIMAL(5,2),
    avg_processing_time DECIMAL(8,2),
    last_processed TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_processed,
        COUNT(*) FILTER (WHERE is_meeting_request = true)::INTEGER as meeting_requests_found,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE is_meeting_request = true)::DECIMAL / COUNT(*)) * 100, 2)
            ELSE 0::DECIMAL(5,2)
        END as success_rate,
        COALESCE(AVG(processing_time_ms), 0)::DECIMAL(8,2) as avg_processing_time,
        MAX(processed_at) as last_processed
    FROM meeting_processing_results 
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old meeting processing results (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_meeting_results()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM meeting_processing_results 
    WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count > 0 THEN
        RAISE NOTICE 'Cleaned up % old meeting processing results', deleted_count;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for meeting pipeline analytics
CREATE OR REPLACE VIEW meeting_pipeline_analytics AS
SELECT 
    mpr.user_id,
    DATE(mpr.processed_at) as processing_date,
    COUNT(*) as emails_processed,
    COUNT(*) FILTER (WHERE mpr.is_meeting_request = true) as meetings_detected,
    ROUND(
        CASE WHEN COUNT(*) > 0 
        THEN (COUNT(*) FILTER (WHERE mpr.is_meeting_request = true)::DECIMAL / COUNT(*)) * 100 
        ELSE 0 END, 
        2
    ) as detection_rate,
    AVG(mpr.processing_time_ms) as avg_processing_time,
    COUNT(*) FILTER (WHERE mpr.status = 'error') as error_count,
    COUNT(*) FILTER (WHERE mpr.status = 'skipped') as skipped_count
FROM meeting_processing_results mpr
WHERE mpr.processed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY mpr.user_id, DATE(mpr.processed_at)
ORDER BY processing_date DESC, mpr.user_id;

-- Comments for documentation
COMMENT ON TABLE meeting_processing_results IS 'Tracks all emails processed through the meeting detection pipeline';
COMMENT ON COLUMN meeting_processing_results.confidence IS 'Meeting detection confidence score (0-100)';
COMMENT ON COLUMN meeting_processing_results.processing_time_ms IS 'Time taken to process this email in milliseconds';
COMMENT ON COLUMN meeting_processing_results.status IS 'Processing status: processed, skipped, or error';
COMMENT ON FUNCTION get_meeting_pipeline_stats IS 'Returns meeting pipeline statistics for a specific user';
COMMENT ON VIEW meeting_pipeline_analytics IS 'Daily analytics view for meeting detection pipeline performance';