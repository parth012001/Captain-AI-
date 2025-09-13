-- Fix email constraints for multi-user support
-- Remove old single-column unique constraint and add multi-user constraint

-- First, check if the old constraint exists and drop it
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'emails_gmail_id_key'
    ) THEN
        ALTER TABLE emails DROP CONSTRAINT emails_gmail_id_key;
        RAISE NOTICE 'Dropped old emails_gmail_id_key constraint';
    END IF;
END $$;

-- Add new composite unique constraint for multi-user support
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'emails_gmail_id_user_id_key'
    ) THEN
        ALTER TABLE emails ADD CONSTRAINT emails_gmail_id_user_id_key UNIQUE (gmail_id, user_id);
        RAISE NOTICE 'Added new emails_gmail_id_user_id_key constraint';
    END IF;
END $$;

-- Update any existing emails with NULL user_id to use a default value
UPDATE emails 
SET user_id = 'default_user' 
WHERE user_id IS NULL;