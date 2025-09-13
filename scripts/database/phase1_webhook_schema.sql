-- Phase 1: Webhook to Draft Generation Schema
-- Auto Generated Drafts Table for Real-time Email Processing

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_drafts_status ON auto_generated_drafts(status);
CREATE INDEX IF NOT EXISTS idx_auto_drafts_created ON auto_generated_drafts(created_at);
CREATE INDEX IF NOT EXISTS idx_auto_drafts_original_email ON auto_generated_drafts(original_email_id);