/**
 * Webhook Routes
 * Handles Gmail webhooks, webhook management, testing, and renewal
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Webhook heartbeat tracking
const webhookHeartbeat = {
  lastReceived: new Date(),
  totalReceived: 0,
  status: 'waiting'
};

// GET /webhook-status - Check webhook status
router.get('/status', async (req, res) => {
  try {
    console.log('📊 Checking webhook status...');

    const tokenStorageService = serviceContainer.get('tokenStorageService');
    const gmailService = serviceContainer.get('gmailService');

    // Get all active webhook users
    const activeUsers = await tokenStorageService.getActiveWebhookUsers();
    const userStatuses = [];

    for (const user of activeUsers) {
      try {
        // Initialize Gmail service for this user to check status
        await gmailService.initializeForUser(user.userId);
        const webhookStatus = await gmailService.getWebhookStatus();

        userStatuses.push({
          userId: user.userId.substring(0, 8) + '...',
          email: user.gmailAddress,
          webhookActive: user.webhookEnabled,
          webhookExpires: user.webhookExpiresAt,
          lastRenewal: user.webhookLastRenewed,
          status: 'active'
        });
      } catch (error) {
        userStatuses.push({
          userId: user.userId.substring(0, 8) + '...',
          email: user.gmailAddress,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: 'Webhook status retrieved',
      heartbeat: {
        lastReceived: webhookHeartbeat.lastReceived,
        totalReceived: webhookHeartbeat.totalReceived,
        status: webhookHeartbeat.status,
        minutesSinceLastWebhook: Math.floor((Date.now() - webhookHeartbeat.lastReceived.getTime()) / (1000 * 60))
      },
      activeUsers: activeUsers.length,
      userStatuses,
      systemStatus: activeUsers.length > 0 ? 'operational' : 'no-active-users'
    });
  } catch (error) {
    console.error('❌ Error checking webhook status:', error);
    res.status(500).json({ error: 'Failed to check webhook status' });
  }
});

// POST /renewal/manual - Manually trigger webhook renewal
router.post('/renewal/manual', async (req, res) => {
  try {
    const webhookRenewalService = serviceContainer.get('webhookRenewalService');
    await webhookRenewalService.manualRenewalCheck();
    res.json({ message: 'Manual webhook renewal check completed' });
  } catch (error) {
    console.error('❌ Error in manual webhook renewal:', error);
    res.status(500).json({ error: 'Failed to perform manual webhook renewal' });
  }
});

// POST /test/suite - Run comprehensive webhook test suite
router.post('/test/suite', async (req, res) => {
  try {
    console.log('🧪 Running comprehensive webhook testing suite...');
    const startTime = Date.now();

    const webhookTestingSuite = serviceContainer.get('webhookTestingSuite');
    const testResults = await webhookTestingSuite.runAllTests();
    const duration = Date.now() - startTime;

    const passed = testResults.filter((r: any) => r.status === 'PASS').length;
    const failed = testResults.filter((r: any) => r.status === 'FAIL').length;
    const successRate = ((passed / (passed + failed)) * 100).toFixed(1);

    console.log(`🎉 Webhook test suite completed: ${passed}/${passed + failed} tests passed (${successRate}% success rate)`);

    res.json({
      message: 'Webhook testing suite completed',
      duration: `${duration}ms`,
      results: {
        total: testResults.length,
        passed,
        failed,
        successRate: parseFloat(successRate)
      },
      tests: testResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error running webhook test suite:', error);
    res.status(500).json({ error: 'Failed to run webhook testing suite' });
  }
});

// GET /test/health - Test webhook system health
router.get('/test/health', async (req, res) => {
  try {
    console.log('🏥 Running webhook system health check...');

    const pool = serviceContainer.get('pool');
    const tokenStorageService = serviceContainer.get('tokenStorageService');

    // Check database connectivity
    const dbCheck = await pool.query('SELECT COUNT(*) as count FROM user_gmail_tokens WHERE webhook_enabled = true');
    const activeWebhooks = parseInt(dbCheck.rows[0].count);

    // Check recent webhook activity
    const recentActivity = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM emails
      WHERE webhook_processed = true AND received_at > NOW() - INTERVAL '1 hour'
    `);
    const recentProcessed = parseInt(recentActivity.rows[0].recent_count);

    // Check for webhook expiration issues
    const expirationCheck = await pool.query(`
      SELECT COUNT(*) as expiring_soon
      FROM user_gmail_tokens
      WHERE webhook_enabled = true AND webhook_expires_at < NOW() + INTERVAL '1 day'
    `);
    const expiringSoon = parseInt(expirationCheck.rows[0].expiring_soon);

    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      activeWebhooks,
      recentActivity: recentProcessed,
      expiringSoon,
      heartbeat: {
        lastReceived: webhookHeartbeat.lastReceived,
        totalReceived: webhookHeartbeat.totalReceived,
        minutesSinceLastWebhook: Math.floor((Date.now() - webhookHeartbeat.lastReceived.getTime()) / (1000 * 60))
      },
      timestamp: new Date().toISOString(),
      warnings: [] as string[]
    };

    // Add warnings
    if (activeWebhooks === 0) {
      healthStatus.warnings.push('No active webhooks configured');
    }
    if (expiringSoon > 0) {
      healthStatus.warnings.push(`${expiringSoon} webhook(s) expiring within 24 hours`);
    }
    if (recentProcessed === 0 && activeWebhooks > 0) {
      healthStatus.warnings.push('No recent webhook activity despite active subscriptions');
    }

    // Determine overall health
    if (healthStatus.warnings.length > 0) {
      healthStatus.status = 'warning';
    }

    console.log(`✅ Webhook health check completed: ${activeWebhooks} active, ${recentProcessed} recent, ${healthStatus.warnings.length} warnings`);

    res.json({
      message: 'Webhook system health check completed',
      health: healthStatus
    });

  } catch (error) {
    console.error('❌ Webhook health check failed:', error);
    res.status(500).json({
      message: 'Webhook health check failed',
      health: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// POST /gmail - The main Gmail webhook endpoint (no auth required - this is called by Google)
router.post('/gmail', async (req, res) => {
  try {
    // Update heartbeat tracking
    webhookHeartbeat.lastReceived = new Date();
    webhookHeartbeat.totalReceived++;

    console.log('📧 Received Gmail webhook notification');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Acknowledge receipt immediately (Google requires < 10 second response)
    res.status(200).send('OK');

    // Decode the Pub/Sub message
    let notification: any = {};
    if (req.body.message && req.body.message.data) {
      try {
        const decodedData = Buffer.from(req.body.message.data, 'base64').toString();
        notification = JSON.parse(decodedData);
        console.log('📩 Decoded notification:', JSON.stringify(notification, null, 2));
      } catch (decodeError) {
        console.error('❌ Error decoding webhook data:', decodeError);
        // Continue processing - we'll handle this in the processor
      }
    }

    // Process the notification asynchronously (don't block the webhook response)
    setImmediate(async () => {
      try {
        console.log('🔄 Processing Gmail notification asynchronously...');

        // Get the webhook processor from service container
        const webhookProcessor = serviceContainer.get('webhookProcessor');
        await webhookProcessor.processGmailNotificationMultiUser(notification);

        console.log('✅ Webhook notification processing completed');
      } catch (processingError) {
        console.error('❌ Error in async webhook processing:', processingError);
      }
    });

  } catch (error) {
    console.error('❌ Error handling Gmail webhook:', error);
    // Still send OK to Google to prevent retries
    res.status(200).send('OK');
  }
});

// POST /test - Manual webhook testing endpoint (no auth for testing)
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Manual webhook test triggered...');

    // Simulate a Gmail webhook notification (general notification, not specific email)
    const testNotification = {
      historyId: Date.now().toString(),
      messageId: null // This will trigger the "check recent emails" flow
    };

    // Process the simulated notification for all users
    const webhookProcessor = serviceContainer.get('webhookProcessor');
    await webhookProcessor.processGmailNotificationMultiUser(testNotification);

    console.log('🎉 Manual webhook test completed successfully');

    res.json({
      message: 'Manual webhook test completed successfully',
      testNotification,
      timestamp: new Date().toISOString(),
      note: 'Check logs for detailed processing results'
    });

  } catch (error) {
    console.error('❌ Error in manual webhook test:', error);
    res.status(500).json({ error: 'Manual webhook test failed' });
  }
});

// POST /gmail/setup-webhook-all-users - Setup webhooks for all users (no auth for admin)
router.post('/gmail/setup-webhook-all-users', async (req, res) => {
  try {
    console.log('📡 Setting up Gmail webhooks for ALL active users...');

    const gmailService = serviceContainer.get('gmailService');
    const tokenStorageService = serviceContainer.get('tokenStorageService');

    if (!gmailService) {
      return res.status(500).json({ error: 'Gmail service not initialized' });
    }

    // Get all active webhook users
    const activeUsers = await tokenStorageService.getActiveWebhookUsers();
    console.log(`👥 Found ${activeUsers.length} active users for webhook setup`);

    if (activeUsers.length === 0) {
      return res.json({
        message: 'No active users found for webhook setup',
        setupCount: 0
      });
    }

    const results = [];
    let successCount = 0;

    for (const userTokens of activeUsers) {
      try {
        console.log(`📡 Setting up webhook for user: ${userTokens.gmailAddress}`);

        // Initialize Gmail service for this user
        await gmailService.initializeForUser(userTokens.userId);

        // Set up webhook for this user
        const watchResponse = await gmailService.setupWebhook();

        results.push({
          user: userTokens.gmailAddress,
          success: true,
          historyId: watchResponse.historyId,
          expiration: watchResponse.expiration
        });

        successCount++;
        console.log(`✅ Webhook setup successful for ${userTokens.gmailAddress}`);

      } catch (error) {
        console.error(`❌ Failed to setup webhook for ${userTokens.gmailAddress}:`, error);
        results.push({
          user: userTokens.gmailAddress,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`🎉 Webhook setup completed: ${successCount}/${activeUsers.length} successful`);

    res.json({
      message: 'Webhook setup process completed',
      totalUsers: activeUsers.length,
      successCount,
      failureCount: activeUsers.length - successCount,
      successRate: Math.round((successCount / activeUsers.length) * 100),
      results
    });

  } catch (error) {
    console.error('❌ Error setting up webhooks for all users:', error);
    res.status(500).json({ error: 'Failed to setup webhooks for all users' });
  }
});

// POST /gmail/setup-webhook - Setup webhook for current user
router.post('/gmail/setup-webhook', async (req, res) => {
  try {
    console.log('📡 Setting up Gmail webhook for current session...');

    const gmailService = serviceContainer.get('gmailService');
    const watchResponse = await gmailService.setupWebhook();

    console.log('✅ Gmail webhook setup successful');
    console.log('📊 Watch Response:', JSON.stringify(watchResponse, null, 2));

    res.json({
      message: 'Gmail webhook setup successful',
      historyId: watchResponse.historyId,
      expiration: watchResponse.expiration,
      expirationDate: new Date(parseInt(watchResponse.expiration)).toISOString()
    });

  } catch (error) {
    console.error('❌ Error setting up Gmail webhook:', error);
    res.status(500).json({ error: 'Failed to setup Gmail webhook' });
  }
});

// GET /gmail/webhook-status - Get Gmail webhook status
router.get('/gmail/webhook-status', async (req, res) => {
  try {
    console.log('🔍 Checking Gmail webhook status...');

    const gmailService = serviceContainer.get('gmailService');
    const status = await gmailService.getWebhookStatus();

    console.log('📊 Webhook Status:', JSON.stringify(status, null, 2));

    res.json({
      message: 'Gmail webhook status retrieved',
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error checking Gmail webhook status:', error);
    res.status(500).json({ error: 'Failed to check Gmail webhook status' });
  }
});

// POST /gmail/stop-webhook - Stop Gmail webhook
router.post('/gmail/stop-webhook', async (req, res) => {
  try {
    console.log('🛑 Stopping Gmail webhook...');

    const gmailService = serviceContainer.get('gmailService');
    await gmailService.stopWebhook();

    console.log('✅ Gmail webhook stopped successfully');

    res.json({
      message: 'Gmail webhook stopped successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error stopping Gmail webhook:', error);
    res.status(500).json({ error: 'Failed to stop Gmail webhook' });
  }
});

export default router;