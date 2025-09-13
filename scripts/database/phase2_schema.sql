-- Phase 2: AI Draft Generation Schema Extensions

-- Store user's tone profile
CREATE TABLE IF NOT EXISTS tone_profiles (
    id SERIAL PRIMARY KEY,
    profile_text TEXT NOT NULL,
    confidence_score INTEGER DEFAULT 0,
    email_samples_analyzed INTEGER DEFAULT 0,
    insights TEXT,
    is_real_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store generated drafts
CREATE TABLE IF NOT EXISTS drafts (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    confidence_score INTEGER DEFAULT 70,
    quality_score INTEGER DEFAULT 70,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, sent, declined
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    sent_at TIMESTAMP
);

-- Add category to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS has_draft BOOLEAN DEFAULT FALSE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drafts_email_id ON drafts(email_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);

-- Store sent emails for tone analysis
CREATE TABLE IF NOT EXISTS sent_emails (
    id SERIAL PRIMARY KEY,
    gmail_id VARCHAR(255) UNIQUE NOT NULL,
    subject TEXT,
    body TEXT,
    to_email VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP NOT NULL,
    analyzed_for_tone BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_gmail_id ON sent_emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_analyzed ON sent_emails(analyzed_for_tone);