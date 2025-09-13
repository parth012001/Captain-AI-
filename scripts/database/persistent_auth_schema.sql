-- Persistent Authentication Schema for 24/7 Gmail Webhook Processing
-- This enables the system to process emails even when users are logged out

-- Table to store encrypted Gmail OAuth tokens for each user
CREATE TABLE IF NOT EXISTS user_gmail_tokens (
  user_id VARCHAR(255) PRIMARY KEY,
  gmail_address VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  access_token_encrypted TEXT,
  access_token_expires_at TIMESTAMP,
  webhook_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add user association to existing emails table
ALTER TABLE emails 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Add user association to existing auto_generated_drafts table  
ALTER TABLE auto_generated_drafts 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_gmail_tokens_gmail_address 
ON user_gmail_tokens(gmail_address);

CREATE INDEX IF NOT EXISTS idx_user_gmail_tokens_webhook_active 
ON user_gmail_tokens(webhook_active);

CREATE INDEX IF NOT EXISTS idx_emails_user_id 
ON emails(user_id);

CREATE INDEX IF NOT EXISTS idx_auto_generated_drafts_user_id 
ON auto_generated_drafts(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_gmail_tokens_updated_at 
    BEFORE UPDATE ON user_gmail_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- View to get active webhook users (for webhook processing)
CREATE OR REPLACE VIEW active_webhook_users AS
SELECT 
  user_id,
  gmail_address,
  refresh_token_encrypted,
  access_token_encrypted,
  access_token_expires_at,
  created_at,
  updated_at
FROM user_gmail_tokens
WHERE webhook_active = true
  AND refresh_token_encrypted IS NOT NULL;

COMMENT ON TABLE user_gmail_tokens IS 'Stores encrypted Gmail OAuth tokens for persistent authentication';
COMMENT ON COLUMN user_gmail_tokens.user_id IS 'Unique identifier for user, derived from Gmail address';
COMMENT ON COLUMN user_gmail_tokens.gmail_address IS 'Users Gmail address for identification';
COMMENT ON COLUMN user_gmail_tokens.refresh_token_encrypted IS 'Encrypted OAuth refresh token for token renewal';
COMMENT ON COLUMN user_gmail_tokens.access_token_encrypted IS 'Encrypted OAuth access token (short-lived)';
COMMENT ON COLUMN user_gmail_tokens.webhook_active IS 'Whether webhook processing is enabled for this user';