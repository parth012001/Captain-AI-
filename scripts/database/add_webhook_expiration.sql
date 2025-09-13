-- Add webhook expiration tracking for automatic renewal
ALTER TABLE user_gmail_tokens 
ADD COLUMN IF NOT EXISTS webhook_expires_at TIMESTAMP;

-- Set default expiration for existing webhooks (7 days from now)
UPDATE user_gmail_tokens 
SET webhook_expires_at = NOW() + INTERVAL '7 days'
WHERE webhook_active = true AND webhook_expires_at IS NULL;

-- Verify the changes
SELECT user_id, gmail_address, webhook_active, webhook_expires_at 
FROM user_gmail_tokens 
WHERE webhook_active = true;