-- Promotional Emails Table
-- Stores newsletters, marketing campaigns, and other promotional content
-- that users want to see but don't need AI responses for

CREATE TABLE IF NOT EXISTS promotional_emails (
  id SERIAL PRIMARY KEY,
  gmail_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  thread_id VARCHAR(255),
  subject TEXT,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255),
  body TEXT,
  received_at TIMESTAMP DEFAULT NOW(),
  classification_reason VARCHAR(100) NOT NULL, -- 'newsletter', 'marketing', 'promotional'
  is_read BOOLEAN DEFAULT FALSE,
  webhook_processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(gmail_id, user_id)
  
  -- Note: No foreign key constraint since users table doesn't exist
  -- User validation is handled at the application level
);

-- Create indexes for performance (separate statements)
CREATE INDEX IF NOT EXISTS idx_promotional_emails_user_id ON promotional_emails (user_id);
CREATE INDEX IF NOT EXISTS idx_promotional_emails_received_at ON promotional_emails (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotional_emails_is_read ON promotional_emails (is_read);
CREATE INDEX IF NOT EXISTS idx_promotional_emails_classification ON promotional_emails (classification_reason);

-- Add comments for documentation
COMMENT ON TABLE promotional_emails IS 'Stores promotional emails (newsletters, marketing) that users want to see but don''t need AI responses for';
COMMENT ON COLUMN promotional_emails.classification_reason IS 'Reason why email was classified as promotional: newsletter, marketing, promotional, etc.';
COMMENT ON COLUMN promotional_emails.webhook_processed IS 'Whether this email was processed via webhook to prevent duplicates';
