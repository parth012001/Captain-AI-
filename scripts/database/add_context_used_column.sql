-- Add missing context_used column to generated_responses table
ALTER TABLE generated_responses ADD COLUMN IF NOT EXISTS context_used TEXT DEFAULT '[]';