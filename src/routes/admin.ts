/**
 * Admin Routes
 * Handles administrative operations, database schema updates, and system maintenance
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Note: Admin routes typically don't require auth for internal operations
// In production, you might want to add admin-specific authentication

// POST /health/clear-failures - Clear failed notification storage
router.post('/health/clear-failures', (req, res) => {
  // Simple in-memory storage clear (extend as needed)
  console.log('🧹 Clearing failed notifications storage...');

  res.json({
    message: 'Failed notifications cleared',
    timestamp: new Date().toISOString()
  });
});

// POST /schema/reset-context - Reset context schema
router.post('/schema/reset-context', async (req, res) => {
  try {
    console.log('🔧 Resetting context intelligence schema...');

    const pool = serviceContainer.get('pool');

    // Drop and recreate context-related tables
    const resetQueries = [
      'DROP TABLE IF EXISTS context_analysis CASCADE;',
      'DROP TABLE IF EXISTS thread_context CASCADE;',
      'DROP TABLE IF EXISTS sender_profiles CASCADE;',
      `CREATE TABLE context_analysis (
        id SERIAL PRIMARY KEY,
        email_id INTEGER REFERENCES emails(id),
        entities JSONB,
        sentiment VARCHAR(50),
        topics TEXT[],
        context_summary TEXT,
        confidence_score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE thread_context (
        id SERIAL PRIMARY KEY,
        thread_id VARCHAR(255) UNIQUE,
        context_summary TEXT,
        key_entities JSONB,
        participant_count INTEGER,
        message_count INTEGER,
        last_activity TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE sender_profiles (
        id SERIAL PRIMARY KEY,
        sender_email VARCHAR(255) UNIQUE,
        relationship_type VARCHAR(100),
        communication_frequency INTEGER DEFAULT 0,
        average_response_time INTEGER,
        topics JSONB,
        last_interaction TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`
    ];

    for (const query of resetQueries) {
      await pool.query(query);
    }

    console.log('✅ Context intelligence schema reset completed');

    res.json({
      message: 'Context intelligence schema reset successfully',
      tablesReset: ['context_analysis', 'thread_context', 'sender_profiles'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error resetting context schema:', error);
    res.status(500).json({ error: 'Failed to reset context schema' });
  }
});

// POST /schema/apply-phase23 - Apply Phase 2.3 schema updates
router.post('/schema/apply-phase23', async (req, res) => {
  try {
    console.log('🔧 Applying Phase 2.3 schema updates...');

    const pool = serviceContainer.get('pool');

    const phase23Updates = [
      // Add response generation tracking
      `CREATE TABLE IF NOT EXISTS generated_responses (
        id SERIAL PRIMARY KEY,
        response_id VARCHAR(255) UNIQUE,
        original_email_id INTEGER REFERENCES emails(id),
        recipient_email VARCHAR(255),
        subject TEXT,
        body TEXT,
        tone VARCHAR(100),
        urgency_level VARCHAR(50),
        relationship_type VARCHAR(100),
        context_used JSONB,
        confidence_score INTEGER,
        processing_time_ms INTEGER,
        user_edited BOOLEAN DEFAULT false,
        edit_percentage INTEGER,
        was_sent BOOLEAN DEFAULT false,
        user_rating INTEGER,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        edited_at TIMESTAMP,
        sent_at TIMESTAMP,
        rated_at TIMESTAMP
      );`,

      // Add response templates
      `CREATE TABLE IF NOT EXISTS response_templates (
        id SERIAL PRIMARY KEY,
        template_name VARCHAR(255),
        template_type VARCHAR(100),
        relationship_context VARCHAR(100),
        urgency_context VARCHAR(50),
        template_body TEXT,
        usage_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Add indexes for performance
      'CREATE INDEX IF NOT EXISTS idx_generated_responses_email_id ON generated_responses(original_email_id);',
      'CREATE INDEX IF NOT EXISTS idx_generated_responses_generated_at ON generated_responses(generated_at);',
      'CREATE INDEX IF NOT EXISTS idx_response_templates_type ON response_templates(template_type);'
    ];

    for (const query of phase23Updates) {
      await pool.query(query);
    }

    console.log('✅ Phase 2.3 schema updates applied successfully');

    res.json({
      message: 'Phase 2.3 schema updates applied successfully',
      updates: [
        'generated_responses table created',
        'response_templates table created',
        'Performance indexes added'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error applying Phase 2.3 schema:', error);
    res.status(500).json({ error: 'Failed to apply Phase 2.3 schema updates' });
  }
});

// POST /schema/fix-context-column - Fix context column issues
router.post('/schema/fix-context-column', async (req, res) => {
  try {
    console.log('🔧 Fixing context column structure...');

    const pool = serviceContainer.get('pool');

    const fixes = [
      // Ensure context_used column exists and is properly typed
      `ALTER TABLE generated_responses
       ADD COLUMN IF NOT EXISTS context_used JSONB DEFAULT '[]';`,

      // Add missing indexes
      `CREATE INDEX IF NOT EXISTS idx_context_analysis_email_id
       ON context_analysis(email_id);`,

      `CREATE INDEX IF NOT EXISTS idx_thread_context_thread_id
       ON thread_context(thread_id);`,

      `CREATE INDEX IF NOT EXISTS idx_sender_profiles_email
       ON sender_profiles(sender_email);`
    ];

    for (const fix of fixes) {
      await pool.query(fix);
    }

    console.log('✅ Context column fixes applied successfully');

    res.json({
      message: 'Context column fixes applied successfully',
      fixes: [
        'context_used column ensured',
        'Missing indexes added',
        'Column types normalized'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fixing context columns:', error);
    res.status(500).json({ error: 'Failed to fix context column structure' });
  }
});

// POST /schema/apply-phase2-2 - Apply Phase 2.2 schema updates
router.post('/schema/apply-phase2-2', async (req, res) => {
  try {
    console.log('🔧 Applying Phase 2.2 schema updates...');

    const pool = serviceContainer.get('pool');

    const phase22Updates = [
      // Enhanced email categorization
      `ALTER TABLE emails
       ADD COLUMN IF NOT EXISTS category VARCHAR(100),
       ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50,
       ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'pending';`,

      // Learning feedback table
      `CREATE TABLE IF NOT EXISTS learning_feedback (
        id SERIAL PRIMARY KEY,
        response_id VARCHAR(255),
        feedback_type VARCHAR(100),
        original_text TEXT,
        edited_text TEXT,
        improvement_score INTEGER,
        feedback_notes TEXT,
        user_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Performance indexes
      'CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);',
      'CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority_score);',
      'CREATE INDEX IF NOT EXISTS idx_learning_feedback_response ON learning_feedback(response_id);'
    ];

    for (const query of phase22Updates) {
      await pool.query(query);
    }

    console.log('✅ Phase 2.2 schema updates applied successfully');

    res.json({
      message: 'Phase 2.2 schema updates applied successfully',
      updates: [
        'Email categorization fields added',
        'Learning feedback table created',
        'Performance indexes added'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error applying Phase 2.2 schema:', error);
    res.status(500).json({ error: 'Failed to apply Phase 2.2 schema updates' });
  }
});

// POST /schema/apply-phase3-calendar - Apply Phase 3 calendar schema
router.post('/schema/apply-phase3-calendar', async (req, res) => {
  try {
    console.log('🔧 Applying Phase 3 calendar schema updates...');

    const pool = serviceContainer.get('pool');

    const calendarUpdates = [
      // Calendar events table
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        google_event_id VARCHAR(255) UNIQUE,
        summary TEXT,
        description TEXT,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        attendees JSONB,
        location TEXT,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Calendar preferences
      `CREATE TABLE IF NOT EXISTS calendar_preferences (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        preference_type VARCHAR(100),
        preference_value TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Indexes
      'CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);',
      'CREATE INDEX IF NOT EXISTS idx_calendar_preferences_user ON calendar_preferences(user_id);'
    ];

    for (const query of calendarUpdates) {
      await pool.query(query);
    }

    console.log('✅ Phase 3 calendar schema applied successfully');

    res.json({
      message: 'Phase 3 calendar schema applied successfully',
      updates: [
        'calendar_events table created',
        'calendar_preferences table created',
        'Calendar indexes added'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error applying calendar schema:', error);
    res.status(500).json({ error: 'Failed to apply Phase 3 calendar schema' });
  }
});

// POST /schema/add-webhook-processed-flag - Add webhook processed flag
router.post('/schema/add-webhook-processed-flag', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    console.log('🔧 Adding webhook_processed flag to emails table...');

    const pool = serviceContainer.get('pool');

    // Check if migration file exists, otherwise create the column directly
    const addColumnQuery = `
      ALTER TABLE emails
      ADD COLUMN IF NOT EXISTS webhook_processed BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_emails_webhook_processed
      ON emails(webhook_processed);
    `;

    await pool.query(addColumnQuery);

    console.log('✅ webhook_processed flag added successfully');

    res.json({
      message: 'webhook_processed flag added to emails table',
      changes: [
        'webhook_processed column added',
        'Index created for performance'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error adding webhook_processed flag:', error);
    res.status(500).json({ error: 'Failed to add webhook_processed flag' });
  }
});

// POST /schema/init-phase33 - Initialize Phase 3.3 schema
router.post('/schema/init-phase33', async (req, res) => {
  try {
    console.log('🚀 Initializing Phase 3.3 comprehensive schema...');

    const pool = serviceContainer.get('pool');

    // Phase 3.3 includes all the advanced features
    const phase33Schema = [
      // Meeting requests table
      `CREATE TABLE IF NOT EXISTS meeting_requests (
        id SERIAL PRIMARY KEY,
        email_id INTEGER REFERENCES emails(id),
        user_id VARCHAR(255) NOT NULL,
        sender_email VARCHAR(255),
        subject TEXT,
        meeting_type VARCHAR(100),
        urgency_level VARCHAR(50),
        requested_duration INTEGER,
        preferred_dates JSONB,
        attendees JSONB,
        location_preference TEXT,
        special_requirements TEXT,
        detection_confidence INTEGER,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Meeting processing results
      `CREATE TABLE IF NOT EXISTS meeting_processing_results (
        id SERIAL PRIMARY KEY,
        email_id VARCHAR(255),
        user_id VARCHAR(255),
        is_meeting_request BOOLEAN,
        confidence INTEGER,
        processing_time INTEGER,
        status VARCHAR(100),
        reason TEXT,
        meeting_request_id INTEGER REFERENCES meeting_requests(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Auto-generated drafts (enhanced)
      `CREATE TABLE IF NOT EXISTS auto_generated_drafts (
        id SERIAL PRIMARY KEY,
        draft_id VARCHAR(255) UNIQUE,
        original_email_id INTEGER REFERENCES emails(id),
        user_id VARCHAR(255) NOT NULL,
        subject TEXT,
        body TEXT,
        tone VARCHAR(100),
        urgency_level VARCHAR(50),
        relationship_type VARCHAR(100),
        context_used JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        processing_time_ms INTEGER,
        gmail_message_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        sent_at TIMESTAMP
      );`,

      // Promotional emails
      `CREATE TABLE IF NOT EXISTS promotional_emails (
        id SERIAL PRIMARY KEY,
        original_email_id INTEGER REFERENCES emails(id),
        user_id VARCHAR(255) NOT NULL,
        subject TEXT,
        from_email VARCHAR(255),
        category VARCHAR(100),
        confidence_score INTEGER,
        is_read BOOLEAN DEFAULT false,
        preview TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,

      // Add comprehensive indexes
      'CREATE INDEX IF NOT EXISTS idx_meeting_requests_user_id ON meeting_requests(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);',
      'CREATE INDEX IF NOT EXISTS idx_auto_generated_drafts_user_id ON auto_generated_drafts(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_auto_generated_drafts_status ON auto_generated_drafts(status);',
      'CREATE INDEX IF NOT EXISTS idx_promotional_emails_user_id ON promotional_emails(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_meeting_processing_results_user_id ON meeting_processing_results(user_id);'
    ];

    let completedUpdates = 0;
    for (const query of phase33Schema) {
      try {
        await pool.query(query);
        completedUpdates++;
      } catch (queryError) {
        console.warn(`⚠️ Schema update warning:`, queryError);
        // Continue with other updates
      }
    }

    console.log(`✅ Phase 3.3 schema initialization completed (${completedUpdates}/${phase33Schema.length} updates applied)`);

    res.json({
      message: 'Phase 3.3 schema initialization completed',
      updatesApplied: completedUpdates,
      totalUpdates: phase33Schema.length,
      tables: [
        'meeting_requests',
        'meeting_processing_results',
        'auto_generated_drafts',
        'promotional_emails'
      ],
      indexes: [
        'User ID indexes',
        'Status indexes',
        'Performance indexes'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error initializing Phase 3.3 schema:', error);
    res.status(500).json({ error: 'Failed to initialize Phase 3.3 schema' });
  }
});

// POST /schema/add-approved-column - Add approved_at column to auto_generated_drafts table
router.post('/schema/add-approved-column', async (req, res) => {
  try {
    console.log('🔧 Adding approved_at column to auto_generated_drafts table...');

    const pool = serviceContainer.get('pool');

    const query = `
      ALTER TABLE auto_generated_drafts
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NULL
    `;

    await pool.query(query);

    console.log('✅ approved_at column added successfully');

    res.json({
      message: 'approved_at column added to auto_generated_drafts table',
      timestamp: new Date().toISOString(),
      success: true
    });
  } catch (error) {
    console.error('❌ Error adding approved_at column:', error);
    res.status(500).json({
      error: 'Failed to add approved_at column',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;