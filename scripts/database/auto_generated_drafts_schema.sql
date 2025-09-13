-- Auto Generated Drafts Table Schema for Phase 1
-- This table stores drafts automatically generated from webhook notifications

CREATE TABLE IF NOT EXISTS auto_generated_drafts (
    id SERIAL PRIMARY KEY,
    draft_id VARCHAR(50) UNIQUE NOT NULL,
    original_email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    tone VARCHAR(20),
    urgency_level VARCHAR(10),
    context_used JSONB,
    relationship_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    sent_at TIMESTAMP,
    user_edited BOOLEAN DEFAULT FALSE,
    edit_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON auto_generated_drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_created ON auto_generated_drafts(created_at);
CREATE INDEX IF NOT EXISTS idx_drafts_original_email ON auto_generated_drafts(original_email_id);