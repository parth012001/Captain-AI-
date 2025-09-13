-- Phase 2.2: Deep Context Intelligence Schema Extensions

-- Store email thread context and conversation history
CREATE TABLE IF NOT EXISTS email_threads (
    id SERIAL PRIMARY KEY,
    thread_id TEXT UNIQUE NOT NULL, -- Gmail thread ID
    subject_line TEXT,
    participants TEXT[], -- Array of email addresses in thread
    participant_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    first_message_date TIMESTAMP,
    last_message_date TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    context_summary TEXT, -- AI-generated thread summary
    key_decisions TEXT[], -- Important decisions made in thread
    commitments TEXT[], -- Commitments and action items
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store sender intelligence and relationship data
CREATE TABLE IF NOT EXISTS sender_profiles (
    id SERIAL PRIMARY KEY,
    email_address TEXT UNIQUE NOT NULL,
    display_name TEXT,
    company TEXT,
    job_title TEXT,
    relationship_type VARCHAR(50), -- boss, peer, client, vendor, stranger, friend
    relationship_strength VARCHAR(20), -- strong, medium, weak
    communication_frequency VARCHAR(20), -- daily, weekly, monthly, rare
    formality_preference VARCHAR(20), -- formal, semi-formal, casual
    response_time_expectation INTEGER, -- hours
    signature_pattern TEXT,
    timezone VARCHAR(50),
    email_count INTEGER DEFAULT 0,
    last_interaction TIMESTAMP,
    first_interaction TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store extracted entities from emails (companies, projects, people, dates)
CREATE TABLE IF NOT EXISTS extracted_entities (
    id SERIAL PRIMARY KEY,
    email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
    thread_id TEXT REFERENCES email_threads(thread_id),
    entity_type VARCHAR(50) NOT NULL, -- company, person, project, date, amount, location
    entity_value TEXT NOT NULL,
    entity_context TEXT, -- Surrounding text for context
    confidence_score INTEGER DEFAULT 70,
    extraction_method VARCHAR(50) DEFAULT 'ai', -- ai, regex, manual
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store contextual memory and semantic search data
CREATE TABLE IF NOT EXISTS context_memories (
    id SERIAL PRIMARY KEY,
    memory_type VARCHAR(50) NOT NULL, -- conversation, decision, commitment, fact
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    context_tags TEXT[], -- Array of relevant tags/keywords
    related_emails INTEGER[], -- Array of email IDs
    related_threads TEXT[], -- Array of thread IDs
    related_entities INTEGER[], -- Array of entity IDs
    importance_score INTEGER DEFAULT 50, -- 1-100 importance rating
    last_referenced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reference_count INTEGER DEFAULT 0,
    -- embedding VECTOR(1536), -- For semantic search (OpenAI embeddings) - Disabled for now
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store conversation patterns and communication insights
CREATE TABLE IF NOT EXISTS communication_patterns (
    id SERIAL PRIMARY KEY,
    sender_email TEXT REFERENCES sender_profiles(email_address),
    pattern_type VARCHAR(50), -- greeting, closing, request, agreement, disagreement
    pattern_text TEXT,
    usage_frequency INTEGER DEFAULT 1,
    context_type VARCHAR(50), -- meeting_request, follow_up, introduction, etc.
    effectiveness_score INTEGER DEFAULT 50, -- How well it worked
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add context fields to existing emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS thread_context_id INTEGER REFERENCES email_threads(id);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sender_profile_id INTEGER REFERENCES sender_profiles(id);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS context_analyzed BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS conversation_position INTEGER DEFAULT 1; -- Position in thread
ALTER TABLE emails ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'medium'; -- high, medium, low
ALTER TABLE emails ADD COLUMN IF NOT EXISTS requires_response BOOLEAN DEFAULT TRUE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20); -- positive, neutral, negative
ALTER TABLE emails ADD COLUMN IF NOT EXISTS key_topics TEXT[]; -- Main topics discussed

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON email_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_date DESC);
CREATE INDEX IF NOT EXISTS idx_sender_profiles_email ON sender_profiles(email_address);
CREATE INDEX IF NOT EXISTS idx_sender_profiles_relationship ON sender_profiles(relationship_type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_email_id ON extracted_entities(email_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_context_memories_type ON context_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_context_memories_importance ON context_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_context_memories_tags ON context_memories USING GIN(context_tags);
CREATE INDEX IF NOT EXISTS idx_communication_patterns_sender ON communication_patterns(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_thread_context ON emails(thread_context_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender_profile ON emails(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_emails_urgency ON emails(urgency_level);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sender_profiles_updated_at BEFORE UPDATE ON sender_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_memories_updated_at BEFORE UPDATE ON context_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();