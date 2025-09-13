-- Fix Phase 2.2 Schema Issues
-- This script drops and recreates the context intelligence tables with proper field sizes

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS communication_patterns CASCADE;
DROP TABLE IF EXISTS extracted_entities CASCADE;
DROP TABLE IF EXISTS context_memories CASCADE;
DROP TABLE IF EXISTS sender_profiles CASCADE;
DROP TABLE IF EXISTS email_threads CASCADE;

-- Remove added columns from emails table
ALTER TABLE emails DROP COLUMN IF EXISTS thread_context_id CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS sender_profile_id CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS context_analyzed CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS conversation_position CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS urgency_level CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS requires_response CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS sentiment CASCADE;
ALTER TABLE emails DROP COLUMN IF EXISTS key_topics CASCADE;

-- Drop functions and triggers
DROP TRIGGER IF EXISTS update_email_threads_updated_at ON email_threads;
DROP TRIGGER IF EXISTS update_sender_profiles_updated_at ON sender_profiles;
DROP TRIGGER IF EXISTS update_context_memories_updated_at ON context_memories;
DROP FUNCTION IF EXISTS update_updated_at_column();

COMMIT;