/**
 * Email Management Routes
 * Handles email fetching, categorization, tone analysis, and promotional emails
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate);

// GET /emails/fetch - Fetch emails from Gmail
router.get('/fetch', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const emailModel = serviceContainer.get('emailModel');
    const gmailService = serviceContainer.get('gmailService');
    const intelligentEmailRouter = serviceContainer.get('intelligentEmailRouter');

    console.log(`📧 Manual email fetch initiated by user: ${userId.substring(0, 8)}...`);

    // Initialize Gmail service for this user
    await gmailService.initializeForUser(userId);

    // Fetch emails from Gmail
    const emails = await gmailService.getRecentEmails(20);
    console.log(`📬 Retrieved ${emails.length} emails from Gmail for user ${userId.substring(0, 8)}...`);

    let savedCount = 0;
    const meetingProcessingResults: any[] = [];

    // Process each email
    for (const email of emails) {
      try {
        const parsedEmail = gmailService.parseEmail(email);

        // Check if email already exists for this user
        const exists = await emailModel.emailExists(parsedEmail.id, userId);
        let emailDbId: number | undefined;

        if (!exists) {
          const savedEmail = await emailModel.saveEmail(parsedEmail, userId);
          emailDbId = savedEmail;
          savedCount++;

          // 🚀 PHASE 3: Process new emails through intelligent router
          if (emailDbId) {
            try {
              console.log(`🧠 [MANUAL FETCH] Routing email ${parsedEmail.id} through intelligent router...`);
              const routingResult = await intelligentEmailRouter.routeEmail(
                parsedEmail,
                userId,
                emailDbId
              );

              // Convert routing result to meeting pipeline format for backward compatibility
              if (routingResult.meetingResult) {
                meetingProcessingResults.push(routingResult.meetingResult);
              } else {
                // Create a compatible result for non-meeting emails
                meetingProcessingResults.push({
                  emailId: parsedEmail.id,
                  userId,
                  isMeetingRequest: false,
                  confidence: routingResult.routingDecision.confidence,
                  processingTime: routingResult.totalProcessingTime,
                  status: routingResult.status === 'success' ? 'processed' : 'error',
                  reason: `Intelligent router: ${routingResult.routingDecision.reasoning}`
                });
              }

              console.log(`✅ [MANUAL FETCH] Email routed to ${routingResult.routingDecision.route.toUpperCase()} pipeline`);

            } catch (routingError) {
              console.error(`❌ [INTELLIGENT ROUTER] Error processing email ${parsedEmail.id}:`, routingError);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
      }
    }

    console.log(`✅ Saved ${savedCount} new emails to database for user ${userId.substring(0, 8)}...`);

    // Log meeting detection results
    const meetingsDetected = meetingProcessingResults.filter(r => r.isMeetingRequest).length;
    if (meetingProcessingResults.length > 0) {
      console.log(`🔍 [MEETING PIPELINE] Processed ${meetingProcessingResults.length} emails, found ${meetingsDetected} meeting requests`);
    }

    const stats = await emailModel.getEmailStats(userId);

    res.json({
      message: 'Emails fetched successfully',
      retrieved: emails.length,
      saved: savedCount,
      meetingDetection: {
        processed: meetingProcessingResults.length,
        meetingsFound: meetingsDetected,
        successRate: meetingProcessingResults.length > 0
          ? Math.round((meetingsDetected / meetingProcessingResults.length) * 100)
          : 0
      },
      stats,
      userId: userId.substring(0, 8) + '...'
    });
  } catch (error) {
    console.error('❌ Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// GET /emails - List recent emails
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const emailModel = serviceContainer.get('emailModel');
    const emails = await emailModel.getRecentEmails(20, userId);
    const stats = await emailModel.getEmailStats(userId);

    res.json({
      emails: emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from_email,
        date: email.received_at,
        isRead: email.is_read,
        preview: email.body?.substring(0, 150) + '...',
      })),
      stats
    });
  } catch (error) {
    console.error('❌ Error retrieving emails:', error);
    res.status(500).json({ error: 'Failed to retrieve emails' });
  }
});

// GET /promotional-emails - List promotional emails
router.get('/promotional', async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const userId = getUserId(req);
    const promotionalEmailModel = serviceContainer.get('promotionalEmailModel');

    console.log(`📧 Fetching promotional emails for user: ${userId.substring(0, 8)}... (limit: ${limit})`);

    const promotionalEmails = await promotionalEmailModel.getPromotionalEmailsForUser(limit, userId);
    const stats = await promotionalEmailModel.getPromotionalEmailStatsForUser(userId);

    console.log(`✅ Retrieved ${promotionalEmails.length} promotional emails`);

    res.json({
      message: 'Promotional emails retrieved successfully',
      promotionalEmails: promotionalEmails.map(email => ({
        id: email.id,
        originalEmailId: email.original_email_id,
        subject: email.subject,
        from: email.from_email,
        category: email.category,
        confidence: email.confidence_score,
        isRead: email.is_read,
        createdAt: email.created_at,
        preview: email.preview
      })),
      stats,
      total: promotionalEmails.length,
      userId: userId.substring(0, 8) + '...'
    });
  } catch (error) {
    console.error('❌ Error fetching promotional emails:', error);
    res.status(500).json({ error: 'Failed to fetch promotional emails' });
  }
});

// POST /promotional-emails/:id/mark-read - Mark promotional email as read
router.post('/promotional/:id/mark-read', async (req: AuthenticatedRequest, res) => {
  try {
    const promotionalEmailId = parseInt(req.params.id);
    const userId = getUserId(req);
    const promotionalEmailModel = serviceContainer.get('promotionalEmailModel');

    console.log(`📧 Marking promotional email ${promotionalEmailId} as read for user: ${userId.substring(0, 8)}...`);

    const updated = await promotionalEmailModel.markAsReadForUser(promotionalEmailId, userId);

    if (updated) {
      console.log(`✅ Promotional email ${promotionalEmailId} marked as read`);
      res.json({
        message: 'Promotional email marked as read',
        id: promotionalEmailId
      });
    } else {
      res.status(404).json({ error: 'Promotional email not found or access denied' });
    }
  } catch (error) {
    console.error('❌ Error marking promotional email as read:', error);
    res.status(500).json({ error: 'Failed to mark promotional email as read' });
  }
});

// DELETE /promotional-emails/:id - Delete promotional email
router.delete('/promotional/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const promotionalEmailId = parseInt(req.params.id);
    const userId = getUserId(req);
    const promotionalEmailModel = serviceContainer.get('promotionalEmailModel');

    console.log(`🗑️ Deleting promotional email ${promotionalEmailId} for user: ${userId.substring(0, 8)}...`);

    const deleted = await promotionalEmailModel.deletePromotionalEmailForUser(promotionalEmailId, userId);

    if (deleted) {
      console.log(`✅ Promotional email ${promotionalEmailId} deleted successfully`);
      res.json({
        message: 'Promotional email deleted successfully',
        id: promotionalEmailId
      });
    } else {
      res.status(404).json({ error: 'Promotional email not found or access denied' });
    }
  } catch (error) {
    console.error('❌ Error deleting promotional email:', error);
    res.status(500).json({ error: 'Failed to delete promotional email' });
  }
});

// GET /promotional-emails/stats - Get promotional email statistics
router.get('/promotional/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const promotionalEmailModel = serviceContainer.get('promotionalEmailModel');

    console.log(`📊 Fetching promotional email statistics for user: ${userId.substring(0, 8)}...`);

    const stats = await promotionalEmailModel.getPromotionalEmailStatsForUser(userId);

    res.json({
      message: 'Promotional email statistics retrieved successfully',
      stats,
      userId: userId.substring(0, 8) + '...'
    });
  } catch (error) {
    console.error('❌ Error retrieving promotional email stats:', error);
    res.status(500).json({ error: 'Failed to retrieve promotional email statistics' });
  }
});

export default router;