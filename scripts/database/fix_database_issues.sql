-- Fix database issues for webhook processing

-- Add missing updated_at column to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Clean up stale users with corrupted tokens
UPDATE user_gmail_tokens SET webhook_active = false 
WHERE user_id IN (
  '964270136b66f2bb6d62aed2ae144c2f', 
  'c4598eb971248b845da597f8b467a06e', 
  '2795b385178d5ca346fd7608fefcc024'
);

-- Verify only the current user is active
SELECT user_id, gmail_address, webhook_active FROM user_gmail_tokens WHERE webhook_active = true;