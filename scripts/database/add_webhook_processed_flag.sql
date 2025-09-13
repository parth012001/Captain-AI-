-- Add webhook_processed flag to emails table
-- This prevents race condition between manual fetches and webhook processing

ALTER TABLE emails ADD COLUMN IF NOT EXISTS webhook_processed BOOLEAN DEFAULT FALSE;

-- Add index for performance on webhook processing queries
CREATE INDEX IF NOT EXISTS idx_emails_webhook_processed ON emails(webhook_processed);

-- Update existing emails to have webhook_processed = false (they weren't processed by webhook)
UPDATE emails SET webhook_processed = FALSE WHERE webhook_processed IS NULL;