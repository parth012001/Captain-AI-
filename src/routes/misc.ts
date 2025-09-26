/**
 * Miscellaneous Routes
 * Contains health checks, testing endpoints, and other utility routes
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// GET /health/email-parsing - Email parsing health check
router.get('/health/email-parsing', async (req, res) => {
  try {
    console.log('🏥 Running email parsing health check...');

    const pool = serviceContainer.get('pool');
    const emailModel = serviceContainer.get('emailModel');

    // Check recent email parsing activity
    const recentEmails = await pool.query(`
      SELECT COUNT(*) as count,
             AVG(CASE WHEN body IS NOT NULL AND body != '' THEN 1 ELSE 0 END) as parse_success_rate
      FROM emails
      WHERE received_at > NOW() - INTERVAL '24 hours'
    `);

    const parseStats = recentEmails.rows[0];

    // Check for parsing errors
    const errorCheck = await pool.query(`
      SELECT COUNT(*) as error_count
      FROM emails
      WHERE (body IS NULL OR body = '' OR subject IS NULL)
        AND received_at > NOW() - INTERVAL '24 hours'
    `);

    const errorCount = parseInt(errorCheck.rows[0].error_count);
    const totalEmails = parseInt(parseStats.count);
    const successRate = totalEmails > 0 ? (parseStats.parse_success_rate * 100).toFixed(1) : '100';

    const healthStatus = {
      status: errorCount === 0 && totalEmails > 0 ? 'healthy' : 'warning',
      emailsProcessed24h: totalEmails,
      parseSuccessRate: `${successRate}%`,
      parseErrors24h: errorCount,
      timestamp: new Date().toISOString()
    };

    res.json({
      message: 'Email parsing health check completed',
      health: healthStatus
    });

  } catch (error) {
    console.error('❌ Email parsing health check failed:', error);
    res.status(500).json({
      message: 'Email parsing health check failed',
      health: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// GET /health/intelligent-router - Intelligent router health check
router.get('/health/intelligent-router', async (_req, res) => {
  try {
    console.log('🧠 Checking intelligent router health...');

    const pool = serviceContainer.get('pool');

    // Check recent routing decisions
    const routingStats = await pool.query(`
      SELECT
        COUNT(*) as total_decisions,
        COUNT(CASE WHEN routing_decision IS NOT NULL THEN 1 END) as successful_decisions,
        AVG(CASE WHEN routing_confidence IS NOT NULL THEN routing_confidence ELSE 0 END) as avg_confidence
      FROM emails
      WHERE received_at > NOW() - INTERVAL '24 hours'
        AND routing_decision IS NOT NULL
    `);

    const stats = routingStats.rows[0];
    const totalDecisions = parseInt(stats.total_decisions) || 0;
    const successfulDecisions = parseInt(stats.successful_decisions) || 0;
    const avgConfidence = parseFloat(stats.avg_confidence) || 0;

    const successRate = totalDecisions > 0 ? ((successfulDecisions / totalDecisions) * 100).toFixed(1) : '0';

    const health = {
      status: totalDecisions > 0 && successfulDecisions > 0 ? 'healthy' : 'warning',
      decisions24h: totalDecisions,
      successRate: `${successRate}%`,
      averageConfidence: avgConfidence.toFixed(1),
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Intelligent router health: ${totalDecisions} decisions, ${successRate}% success rate`);

    res.json({
      message: 'Intelligent router health check completed',
      health
    });

  } catch (error) {
    console.error('❌ Intelligent router health check failed:', error);
    res.status(500).json({
      message: 'Intelligent router health check failed',
      health: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// POST /test-smart-filtering - Test smart email filtering
router.post('/test-smart-filtering', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🧪 Testing smart email filtering...');

    const pool = serviceContainer.get('pool');
    const intelligentRouter = serviceContainer.get('intelligentRouter');

    // Get recent unprocessed emails for testing
    const testEmails = await pool.query(`
      SELECT * FROM emails
      WHERE routing_decision IS NULL
      ORDER BY received_at DESC
      LIMIT 5
    `);

    console.log(`📧 Testing with ${testEmails.rows.length} emails`);

    const testResults = [];

    for (const email of testEmails.rows) {
      try {
        const parsedEmail = {
          id: email.gmail_id,
          subject: email.subject,
          from: email.from_email,
          body: email.body,
          threadId: email.thread_id
        };

        const routingResult = await intelligentRouter.routeEmail(parsedEmail);

        testResults.push({
          emailId: email.id,
          subject: email.subject.substring(0, 50) + '...',
          from: email.from_email,
          decision: routingResult.decision,
          confidence: routingResult.confidence,
          reasoning: routingResult.reasoning
        });

      } catch (error) {
        testResults.push({
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: 'Smart filtering test completed',
      testResults,
      summary: {
        totalTested: testEmails.rows.length,
        successfulTests: testResults.filter(r => !r.error).length
      }
    });

  } catch (error) {
    console.error('❌ Error testing smart filtering:', error);
    res.status(500).json({ error: 'Smart filtering test failed' });
  }
});

// POST /test-create-draft - Test draft creation
router.post('/test-create-draft', async (_req, res) => {
  try {
    console.log('📝 Testing draft creation...');

    const responseService = serviceContainer.get('responseService');

    // Create a test response request
    const testRequest = {
      emailId: null,
      recipientEmail: 'test@example.com',
      originalSubject: 'Test Meeting Request',
      originalBody: 'Hi there, would you be available for a quick call this week to discuss our project?',
      responseType: 'reply' as const,
      customInstructions: 'Keep it professional but friendly',
      userId: 'test-user-id'
    };

    console.log('🤖 Generating test response...');
    const smartResponse = await responseService.generateSmartResponse(testRequest);

    res.json({
      message: 'Draft creation test completed successfully',
      testRequest: {
        subject: testRequest.originalSubject,
        recipient: testRequest.recipientEmail
      },
      generatedResponse: {
        subject: smartResponse.subject,
        body: smartResponse.body.substring(0, 200) + '...',
        confidence: smartResponse.confidence,
        relationshipContext: smartResponse.relationshipContext
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error testing draft creation:', error);
    res.status(500).json({
      error: 'Draft creation test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;