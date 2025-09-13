-- User Profile Schema Extension
-- Safe addition to existing user_gmail_tokens table for name collection

-- Add profile columns to existing user_gmail_tokens table
ALTER TABLE user_gmail_tokens 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS full_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Create index for onboarding status queries
CREATE INDEX IF NOT EXISTS idx_user_gmail_tokens_onboarding_completed 
ON user_gmail_tokens(onboarding_completed);

-- Add comments for documentation
COMMENT ON COLUMN user_gmail_tokens.first_name IS 'User first name collected during onboarding';
COMMENT ON COLUMN user_gmail_tokens.last_name IS 'User last name collected during onboarding';
COMMENT ON COLUMN user_gmail_tokens.full_name IS 'Computed full name (first_name + last_name)';
COMMENT ON COLUMN user_gmail_tokens.onboarding_completed IS 'Whether user has completed the onboarding flow';
