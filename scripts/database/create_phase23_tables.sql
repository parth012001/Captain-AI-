-- Simplified Phase 2.3 tables creation

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

-- Insert default templates
INSERT INTO response_templates (template_name, template_type, relationship_context, urgency_context, template_content) VALUES 
('Professional Acknowledgment', 'acknowledgment', 'peer', 'medium', 'Thanks for reaching out. I''ll review this and get back to you by [timeframe].'),
('Boss Update Request', 'update_response', 'boss', 'high', 'Thanks for the update request. I''ll have the information ready by [deadline]. Let me know if you need anything sooner.'),
('Client Response', 'client_response', 'client', 'medium', 'Thank you for your inquiry. I''d be happy to help with [specific request]. I''ll get back to you with detailed information within [timeframe].'),
('Meeting Confirmation', 'meeting_response', 'peer', 'medium', 'Thanks for the meeting invitation. I''m available at the suggested time and will add it to my calendar.'),
('Vendor Follow-up', 'vendor_response', 'vendor', 'low', 'Thanks for following up. I''ll review the proposal and get back to you with feedback by [date].');