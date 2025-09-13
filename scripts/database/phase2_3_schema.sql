-- Phase 2.3: Smart Response Generation Schema Extensions

-- Store generated responses for tracking and improvement
CREATE TABLE IF NOT EXISTS generated_responses (
    id SERIAL PRIMARY KEY,
    response_id VARCHAR(100) UNIQUE NOT NULL,
    email_id INTEGER, -- References original email if replying
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    tone VARCHAR(50) DEFAULT 'professional',
    urgency_level VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    context_used TEXT[], -- Array of context types used
    confidence INTEGER DEFAULT 50, -- 0-100 confidence score
    relationship_type VARCHAR(50), -- boss, peer, client, vendor, stranger
    user_edited BOOLEAN DEFAULT FALSE, -- Did user edit before sending?
    edit_percentage INTEGER, -- Percentage of response that was edited
    was_sent BOOLEAN DEFAULT FALSE, -- Was this response actually sent?
    user_rating INTEGER, -- 1-5 user satisfaction rating
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    edited_at TIMESTAMP,
    rated_at TIMESTAMP
);

-- Store response templates and patterns for learning
CREATE TABLE IF NOT EXISTS response_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50), -- greeting, closing, request_response, meeting_scheduling
    relationship_context VARCHAR(50), -- boss, peer, client, vendor
    urgency_context VARCHAR(20), -- high, medium, low
    template_content TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_rate INTEGER DEFAULT 50, -- Based on user edits
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store user customization preferences for responses
CREATE TABLE IF NOT EXISTS response_preferences (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) DEFAULT 'default_user', -- For future multi-user support
    preference_type VARCHAR(50) NOT NULL, -- signature, greeting_style, closing_style, formality_level
    preference_value TEXT NOT NULL,
    context_filters JSONB, -- When this preference applies (e.g., specific relationships)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Store response generation statistics for monitoring
CREATE TABLE IF NOT EXISTS response_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE DEFAULT CURRENT_DATE,
    total_generated INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_edited INTEGER DEFAULT 0,
    avg_confidence INTEGER DEFAULT 0,
    avg_edit_percentage INTEGER DEFAULT 0,
    context_usage_breakdown TEXT, -- JSON object with context type counts
    relationship_breakdown TEXT, -- JSON object with relationship type counts
    urgency_breakdown TEXT, -- JSON object with urgency level counts
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generated_responses_recipient ON generated_responses(recipient_email);
CREATE INDEX IF NOT EXISTS idx_generated_responses_generated_at ON generated_responses(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_responses_confidence ON generated_responses(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_generated_responses_urgency ON generated_responses(urgency_level);
CREATE INDEX IF NOT EXISTS idx_generated_responses_relationship ON generated_responses(relationship_type);
CREATE INDEX IF NOT EXISTS idx_response_templates_type ON response_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_response_templates_relationship ON response_templates(relationship_context);
CREATE INDEX IF NOT EXISTS idx_response_preferences_type ON response_preferences(preference_type);
CREATE INDEX IF NOT EXISTS idx_response_stats_date ON response_stats(stat_date DESC);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_response_templates_updated_at BEFORE UPDATE ON response_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_response_preferences_updated_at BEFORE UPDATE ON response_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default response templates
INSERT INTO response_templates (template_name, template_type, relationship_context, urgency_context, template_content) VALUES 
('Professional Acknowledgment', 'acknowledgment', 'peer', 'medium', 'Thanks for reaching out. I''ll review this and get back to you by [timeframe].'),
('Boss Update Request', 'update_response', 'boss', 'high', 'Thanks for the update request. I''ll have the information ready by [deadline]. Let me know if you need anything sooner.'),
('Client Response', 'client_response', 'client', 'medium', 'Thank you for your inquiry. I''d be happy to help with [specific request]. I''ll get back to you with detailed information within [timeframe].'),
('Meeting Confirmation', 'meeting_response', 'peer', 'medium', 'Thanks for the meeting invitation. I''m available at the suggested time and will add it to my calendar.'),
('Vendor Follow-up', 'vendor_response', 'vendor', 'low', 'Thanks for following up. I''ll review the proposal and get back to you with feedback by [date].')
;

-- Insert default user preferences
INSERT INTO response_preferences (preference_type, preference_value, context_filters) VALUES 
('default_signature', 'Best regards,\nParth', '{}'),
('greeting_style', 'professional_warm', '{"relationship_type": ["peer", "client"]}'),
('formality_level', 'semi_formal', '{"relationship_type": ["peer"]}'),
('urgency_acknowledgment', 'true', '{"urgency_level": ["high"]}')
;