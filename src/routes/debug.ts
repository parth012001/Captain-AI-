/**
 * Debug Routes
 * Handles debugging, testing, and development utilities
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// GET /debug/email/:emailId - Manual email inspection tool
router.get('/email/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;

    console.log(`🔍 Debugging email: ${emailId}`);

    const gmailService = serviceContainer.get('gmailService');

    // Get raw email data by re-fetching (since gmail is private)
    const sentEmails = await gmailService.getSentEmails(1);
    const foundEmail = sentEmails.find(e => e.id === emailId);

    if (!foundEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const parsed = gmailService.parseEmail(foundEmail);

    res.json({
      message: 'Email debugging completed',
      emailId,
      rawStructure: {
        hasDirectBody: !!foundEmail.payload.body?.data,
        partsCount: foundEmail.payload.parts?.length || 0,
        mimeTypes: foundEmail.payload.parts?.map((p: any) => p.mimeType) || [],
      },
      parsedResult: {
        bodyLength: parsed.body.length,
        subject: parsed.subject,
        from: parsed.from,
        bodyPreview: parsed.body.substring(0, 200) + (parsed.body.length > 200 ? '...' : '')
      },
      failedAttempts: (global as any).failedEmails?.find((f: any) => f.id === emailId)?.attempts || []
    });
  } catch (error) {
    console.error('❌ Email debug error:', error);
    res.status(500).json({ error: 'Failed to debug email' });
  }
});

// POST /debug/init-phase33-schema - Initialize Phase 3.3 schema manually
router.post('/init-phase33-schema', async (req, res) => {
  try {
    console.log('🔧 Manually initializing Phase 3.3 schema...');

    const pool = serviceContainer.get('pool');

    // Create calendar_holds table first (without foreign key constraint)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_holds (
          id SERIAL PRIMARY KEY,
          meeting_request_id INTEGER,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          holder_email VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'expired', 'cancelled')),
          expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          notes TEXT
      );
    `);

    // Create scheduling_responses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduling_responses (
          id SERIAL PRIMARY KEY,
          meeting_request_id INTEGER,
          recipient_email VARCHAR(255) NOT NULL,
          response_type VARCHAR(50) NOT NULL CHECK (response_type IN ('accept_time', 'reject_time', 'suggest_alternative', 'decline_meeting')),
          suggested_time_start TIMESTAMP WITH TIME ZONE,
          suggested_time_end TIMESTAMP WITH TIME ZONE,
          response_confidence DECIMAL(3,2) DEFAULT 0.8,
          ai_analysis JSONB,
          email_content TEXT,
          processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create scheduling_workflows table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduling_workflows (
          id SERIAL PRIMARY KEY,
          meeting_request_id INTEGER,
          workflow_type VARCHAR(50) NOT NULL CHECK (workflow_type IN ('direct_schedule', 'negotiate_time', 'multi_recipient', 'recurring_setup')),
          current_step VARCHAR(100) NOT NULL,
          total_steps INTEGER DEFAULT 1,
          step_number INTEGER DEFAULT 1,
          status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
          context JSONB,
          next_action_time TIMESTAMP WITH TIME ZONE,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create auto_scheduling_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auto_scheduling_preferences (
          id SERIAL PRIMARY KEY,
          user_email VARCHAR(255) NOT NULL,
          preference_type VARCHAR(100) NOT NULL,
          preference_value JSONB NOT NULL,
          priority INTEGER DEFAULT 5,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_email, preference_type)
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_calendar_holds_meeting_request ON calendar_holds(meeting_request_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_holds_status_expiry ON calendar_holds(status, expiry_time);
      CREATE INDEX IF NOT EXISTS idx_calendar_holds_time_range ON calendar_holds(start_time, end_time);

      CREATE INDEX IF NOT EXISTS idx_scheduling_responses_meeting_request ON scheduling_responses(meeting_request_id);
      CREATE INDEX IF NOT EXISTS idx_scheduling_responses_recipient ON scheduling_responses(recipient_email);
      CREATE INDEX IF NOT EXISTS idx_scheduling_responses_type ON scheduling_responses(response_type);

      CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_meeting_request ON scheduling_workflows(meeting_request_id);
      CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_status ON scheduling_workflows(status);
      CREATE INDEX IF NOT EXISTS idx_scheduling_workflows_next_action ON scheduling_workflows(next_action_time) WHERE next_action_time IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_auto_scheduling_preferences_user ON auto_scheduling_preferences(user_email);
      CREATE INDEX IF NOT EXISTS idx_auto_scheduling_preferences_type ON auto_scheduling_preferences(preference_type);
    `);

    // Insert default preferences
    await pool.query(`
      INSERT INTO auto_scheduling_preferences (user_email, preference_type, preference_value, priority) VALUES
      ('default', 'working_hours', '{"start": "09:00", "end": "17:00", "timezone": "America/New_York", "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]}', 9),
      ('default', 'buffer_time', '{"before_meeting": 15, "after_meeting": 15, "unit": "minutes"}', 8),
      ('default', 'auto_confirm_threshold', '{"confidence_score": 0.85, "known_contacts_only": false}', 7),
      ('default', 'hold_duration', '{"duration_minutes": 1440, "max_concurrent_holds": 5}', 6),
      ('default', 'meeting_lengths', '{"default": 60, "quick_chat": 15, "brief": 30, "standard": 60, "detailed": 90, "unit": "minutes"}', 5)
      ON CONFLICT (user_email, preference_type) DO NOTHING;
    `);

    console.log('✅ Phase 3.3 schema initialized successfully');
    res.json({
      message: 'Phase 3.3 schema initialized successfully',
      tables: [
        'calendar_holds',
        'scheduling_responses',
        'scheduling_workflows',
        'auto_scheduling_preferences'
      ],
      indexes: [
        'Calendar holds indexes',
        'Scheduling responses indexes',
        'Workflow indexes',
        'Preferences indexes'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error initializing Phase 3.3 schema:', error);
    res.status(500).json({
      error: 'Failed to initialize Phase 3.3 schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /debug/draft-database/:id - Database verification endpoint for testing draft management
router.get('/draft-database/:id', async (req, res) => {
  try {
    const draftId = parseInt(req.params.id);
    console.log(`🔍 Database check for draft ID: ${draftId}`);

    const pool = serviceContainer.get('pool');

    // Query the database directly to see raw data
    const query = 'SELECT * FROM auto_generated_drafts WHERE id = $1';
    const result = await pool.query(query, [draftId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found in database' });
    }

    const draftData = result.rows[0];
    console.log('📊 Raw database data:', draftData);

    res.json({
      message: 'Database verification completed',
      draftId,
      rawDatabaseData: draftData,
      formattedData: {
        id: draftData.id,
        draftId: draftData.draft_id,
        originalEmailId: draftData.original_email_id,
        userId: draftData.user_id ? draftData.user_id.substring(0, 8) + '...' : 'N/A',
        subject: draftData.subject,
        bodyPreview: draftData.body ? draftData.body.substring(0, 100) + '...' : 'No body',
        status: draftData.status,
        createdAt: draftData.created_at,
        updatedAt: draftData.updated_at
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in database verification:', error);
    res.status(500).json({ error: 'Database verification failed' });
  }
});

// POST /debug/test-intelligent-router - Intelligent Router Test Endpoint (requires auth)
router.post('/test-intelligent-router', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const { testEmails } = req.body;

    console.log(`🧪 [ROUTER TEST] Testing intelligent router with ${testEmails?.length || 'default'} emails...`);

    const intelligentRouter = serviceContainer.get('intelligentRouter');

    // Default test emails if none provided
    const defaultTestEmails = [
      {
        id: 'test-meeting-1',
        from: 'colleague@work.com',
        to: 'user@company.com',
        subject: 'Coffee tomorrow?',
        body: 'Hey! Are you free for coffee tomorrow at 2 PM? Would love to catch up on the project.',
        date: new Date().toISOString(),
        threadId: 'test-thread-1',
        labels: []
      },
      {
        id: 'test-newsletter-1',
        from: 'newsletter@techcompany.com',
        to: 'user@company.com',
        subject: '[Weekly Newsletter] Top 10 Tech Trends',
        body: 'Check out this week\'s top technology trends and insights from industry leaders...',
        date: new Date().toISOString(),
        threadId: 'test-thread-2',
        labels: []
      },
      {
        id: 'test-urgent-1',
        from: 'boss@company.com',
        to: 'user@company.com',
        subject: 'URGENT: Client presentation needs review',
        body: 'Hi, I need you to review the client presentation ASAP. The meeting is in 2 hours. Please prioritize.',
        date: new Date().toISOString(),
        threadId: 'test-thread-3',
        labels: []
      }
    ];

    const emailsToTest = testEmails || defaultTestEmails;
    const routingResults = [];

    console.log(`📧 Processing ${emailsToTest.length} test emails...`);

    for (const email of emailsToTest) {
      try {
        console.log(`🔍 Processing: "${email.subject}" from ${email.from}`);

        // Route the email through the intelligent router
        const routingDecision = await intelligentRouter.routeEmail(email, userId);

        routingResults.push({
          email: {
            id: email.id,
            subject: email.subject,
            from: email.from,
            threadId: email.threadId
          },
          routing: routingDecision,
          processingTime: new Date().toISOString()
        });

        console.log(`✅ Routed "${email.subject}" to ${routingDecision.pipeline} (confidence: ${routingDecision.confidence})`);

      } catch (routingError) {
        console.error(`❌ Failed to route email ${email.id}:`, routingError);
        routingResults.push({
          email: {
            id: email.id,
            subject: email.subject,
            from: email.from
          },
          error: routingError instanceof Error ? routingError.message : 'Unknown routing error',
          processingTime: new Date().toISOString()
        });
      }
    }

    // Calculate routing statistics
    const successfulRouting = routingResults.filter(r => !r.error);
    const routingStats = {
      total: routingResults.length,
      successful: successfulRouting.length,
      failed: routingResults.length - successfulRouting.length,
      successRate: Math.round((successfulRouting.length / routingResults.length) * 100),
      pipelineDistribution: {} as { [key: string]: number }
    };

    // Count pipeline distribution
    successfulRouting.forEach(result => {
      const pipeline = (result as any).routing?.pipeline || 'unknown';
      routingStats.pipelineDistribution[pipeline] = (routingStats.pipelineDistribution[pipeline] || 0) + 1;
    });

    console.log(`🎉 [ROUTER TEST] Completed: ${routingStats.successful}/${routingStats.total} successful routings (${routingStats.successRate}%)`);

    res.json({
      message: 'Intelligent router testing completed',
      testSettings: {
        userId: userId.substring(0, 8) + '...',
        emailCount: emailsToTest.length,
        testType: testEmails ? 'custom' : 'default'
      },
      results: routingResults,
      statistics: routingStats,
      recommendations: [
        routingStats.successRate < 80 ? 'Consider improving routing accuracy' : 'Routing performance is good',
        routingStats.failed > 0 ? 'Check failed routings for pattern issues' : 'All emails routed successfully',
        'Monitor routing decisions in production for optimization'
      ].filter(r => r),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ROUTER TEST] Error testing intelligent router:', error);
    res.status(500).json({ error: 'Failed to test intelligent router' });
  }
});

export default router;