/**
 * Meeting Management Routes
 * Handles complete meeting pipeline: detection, requests, confirmations, scheduling
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Apply authentication middleware to most routes
router.use(authMiddleware.authenticate);

// GET /meetings - List meeting requests
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const { status, urgency, meetingType, limit = 20, offset = 0 } = req.query;
    const statusFilter = status as "pending" | "scheduled" | "declined" | "cancelled" | undefined;
    const urgencyFilter = urgency as "high" | "medium" | "low" | undefined;
    const meetingTypeFilter = meetingType as "urgent" | "regular" | "flexible" | "recurring" | undefined;
    const limitNum = parseInt(typeof limit === "string" ? limit : "20");
    const offsetNum = parseInt(typeof offset === "string" ? offset : "0");

    console.log(`📋 Fetching meeting requests for user: ${userId.substring(0, 8)}...`);

    const meetingPipelineService = serviceContainer.get('meetingPipelineService');
    const meetings = await meetingPipelineService.getMeetingRequests(userId, {
      status: statusFilter,
      urgency: urgencyFilter,
      meetingType: meetingTypeFilter,
      limit: limitNum,
      offset: offsetNum
    });

    const stats = await meetingPipelineService.getMeetingStats(userId);

    console.log(`✅ Retrieved ${meetings.length} meeting requests`);

    res.json({
      message: 'Meeting requests fetched successfully',
      meetings,
      stats,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: stats.total
      }
    });
  } catch (error) {
    console.error('❌ Error fetching meeting requests:', error);
    res.status(500).json({ error: 'Failed to fetch meeting requests' });
  }
});

// GET /meetings/stats - Get meeting statistics
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const meetingPipelineService = serviceContainer.get('meetingPipelineService');
    const stats = await meetingPipelineService.getMeetingStats(userId);

    res.json({
      message: 'Meeting statistics fetched successfully',
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching meeting stats:', error);
    res.status(500).json({ error: 'Failed to fetch meeting statistics' });
  }
});

// GET /meetings/pipeline/health - Meeting pipeline health check
router.get('/pipeline/health', async (req: AuthenticatedRequest, res) => {
  try {
    const meetingPipelineService = serviceContainer.get('meetingPipelineService');
    const health = await meetingPipelineService.healthCheck();

    res.json({
      message: 'Meeting pipeline health check',
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error checking meeting pipeline health:', error);
    res.status(500).json({ error: 'Meeting pipeline health check failed' });
  }
});

// POST /meetings/:id/status - Update meeting status
router.post('/:id/status', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const meetingId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['pending', 'scheduled', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, scheduled, declined, or cancelled' });
    }

    console.log(`📝 Updating meeting ${meetingId} status to: ${status}`);

    const pool = serviceContainer.get('pool');
    // Update meeting status in database
    const result = await pool.query(
      'UPDATE meeting_requests SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [status, meetingId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting request not found' });
    }

    const updatedMeeting = result.rows[0];
    console.log(`✅ Meeting ${meetingId} status updated to: ${status}`);

    res.json({
      message: `Meeting status updated to ${status}`,
      meeting: {
        id: updatedMeeting.id,
        status: updatedMeeting.status,
        updatedAt: updatedMeeting.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Error updating meeting status:', error);
    res.status(500).json({ error: 'Failed to update meeting status' });
  }
});

// POST /meetings/detect - Analyze specific email for meeting request (no auth required for internal use)
router.post('/detect', async (req: AuthenticatedRequest, res) => {
  try {
    const { emailId } = req.body;
    if (!emailId) {
      return res.status(400).json({ error: 'emailId is required' });
    }

    console.log(`🔍 Detecting meeting request in email ${emailId}...`);

    const pool = serviceContainer.get('pool');
    const meetingDetectionService = serviceContainer.get('meetingDetectionService');

    // Get email from database
    const emailQuery = 'SELECT * FROM emails WHERE id = $1';
    const emailResult = await pool.query(emailQuery, [emailId]);

    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = emailResult.rows[0];
    const parsedEmail = {
      id: email.gmail_id,
      subject: email.subject,
      from: email.from_email,
      body: email.body,
      threadId: email.thread_id
    };

    // Detect meeting request
    const meetingRequest = await meetingDetectionService.detectMeetingRequest(parsedEmail);

    if (meetingRequest) {
      console.log(`✅ Meeting request detected with confidence: ${meetingRequest.detectionConfidence}%`);

      res.json({
        message: 'Meeting request detected',
        isMeetingRequest: true,
        meetingRequest: {
          type: meetingRequest.meetingType,
          urgency: meetingRequest.urgencyLevel,
          confidence: meetingRequest.detectionConfidence,
          duration: meetingRequest.requestedDuration,
          attendees: meetingRequest.attendees,
          location: meetingRequest.locationPreference
        },
        email: {
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          id: emailId
        }
      });
    } else {
      console.log(`❌ No meeting request detected in email ${emailId}`);
      res.json({
        message: 'No meeting request detected',
        isMeetingRequest: false,
        email: {
          subject: parsedEmail.subject,
          from: parsedEmail.from,
          id: emailId
        }
      });
    }

  } catch (error) {
    console.error('❌ Error detecting meeting request:', error);
    res.status(500).json({ error: 'Failed to detect meeting request' });
  }
});

// POST /meetings/scan-emails - Scan recent emails for meeting requests
router.post('/scan-emails', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 10, forceRescan = false } = req.body;
    console.log(`🔍 Scanning recent ${limit} emails for meeting requests...`);

    const pool = serviceContainer.get('pool');
    const meetingDetectionService = serviceContainer.get('meetingDetectionService');

    // Get recent emails that haven't been scanned or need rescanning
    const emailQuery = `
      SELECT * FROM emails
      WHERE (meeting_scanned = false OR $2 = true)
      ORDER BY received_at DESC
      LIMIT $1
    `;
    const emails = await pool.query(emailQuery, [limit, forceRescan]);

    console.log(`📧 Found ${emails.rows.length} emails to scan`);

    let detectionsFound = 0;
    const results = [];

    for (const email of emails.rows) {
      try {
        const parsedEmail = {
          id: email.gmail_id,
          subject: email.subject,
          from: email.from_email,
          body: email.body,
          threadId: email.thread_id
        };

        const meetingRequest = await meetingDetectionService.detectMeetingRequest(parsedEmail);

        if (meetingRequest) {
          detectionsFound++;
          results.push({
            emailId: email.id,
            subject: email.subject,
            from: email.from_email,
            meetingType: meetingRequest.meetingType,
            confidence: meetingRequest.detectionConfidence,
            urgency: meetingRequest.urgencyLevel
          });
        }

        // Mark email as scanned
        await pool.query(
          'UPDATE emails SET meeting_scanned = true WHERE id = $1',
          [email.id]
        );

      } catch (scanError) {
        console.error(`Error scanning email ${email.id}:`, scanError);
        results.push({
          emailId: email.id,
          subject: email.subject,
          error: 'Scan failed'
        });
      }
    }

    console.log(`✅ Meeting scan complete. Found ${detectionsFound} meeting requests out of ${emails.rows.length} emails`);

    res.json({
      message: 'Email scanning completed',
      emailsScanned: emails.rows.length,
      meetingRequestsFound: detectionsFound,
      successRate: emails.rows.length > 0 ? Math.round((detectionsFound / emails.rows.length) * 100) : 0,
      results: results
    });

  } catch (error) {
    console.error('❌ Error scanning emails for meetings:', error);
    res.status(500).json({ error: 'Failed to scan emails for meeting requests' });
  }
});

// GET /meetings/requests - Get meeting requests (no auth for internal use)
router.get('/requests', async (req: AuthenticatedRequest, res) => {
  try {
    const { status, limit = 20, offset = 0, urgency, meetingType } = req.query;

    console.log(`📋 Fetching meeting requests with filters...`);

    let query = `
      SELECT mr.*, e.subject, e.from_email, e.received_at
      FROM meeting_requests mr
      LEFT JOIN emails e ON mr.email_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND mr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (urgency) {
      query += ` AND mr.urgency_level = $${paramCount}`;
      params.push(urgency);
      paramCount++;
    }

    if (meetingType) {
      query += ` AND mr.meeting_type = $${paramCount}`;
      params.push(meetingType);
      paramCount++;
    }

    query += ` ORDER BY mr.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const pool = serviceContainer.get('pool');
    const result = await pool.query(query, params);

    console.log(`✅ Retrieved ${result.rows.length} meeting requests`);

    const meetings = result.rows.map((row: any) => ({
      id: row.id,
      emailId: row.email_id,
      senderEmail: row.sender_email,
      subject: row.subject,
      meetingType: row.meeting_type,
      urgencyLevel: row.urgency_level,
      requestedDuration: row.requested_duration,
      preferredDates: row.preferred_dates,
      attendees: row.attendees,
      location: row.location_preference,
      specialRequirements: row.special_requirements,
      status: row.status,
      confidence: row.detection_confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      message: 'Meeting requests retrieved successfully',
      meetings,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: meetings.length
      },
      filters: {
        status,
        urgency,
        meetingType
      }
    });

  } catch (error) {
    console.error('❌ Error fetching meeting requests:', error);
    res.status(500).json({ error: 'Failed to fetch meeting requests' });
  }
});

// GET /meetings/health - Meeting system health check (no auth required)
router.get('/health', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🏥 Running meeting system health check...');

    const pool = serviceContainer.get('pool');

    // Check database connectivity
    const dbCheck = await pool.query('SELECT COUNT(*) as count FROM meeting_requests LIMIT 1');
    const totalMeetings = parseInt(dbCheck.rows[0].count);

    // Check recent activity
    const recentCheck = await pool.query(`
      SELECT COUNT(*) as recent_count
      FROM meeting_requests
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const recentMeetings = parseInt(recentCheck.rows[0].recent_count);

    // Check status distribution
    const statusCheck = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM meeting_requests
      GROUP BY status
    `);

    const statusDistribution: any = {};
    statusCheck.rows.forEach((row: any) => {
      statusDistribution[row.status] = parseInt(row.count);
    });

    const healthStatus = {
      status: 'healthy',
      database: 'connected',
      totalMeetings,
      recentActivity: recentMeetings,
      statusDistribution,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    console.log(`✅ Meeting system health check completed: ${totalMeetings} total meetings, ${recentMeetings} recent`);

    res.json({
      message: 'Meeting system health check completed',
      health: healthStatus
    });

  } catch (error) {
    console.error('❌ Meeting health check failed:', error);
    res.status(500).json({
      message: 'Meeting health check failed',
      health: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// PATCH /meetings/requests/:id - Update meeting request status
router.patch('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const pool = serviceContainer.get('pool');
    const result = await pool.query(
      'UPDATE meeting_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting request not found' });
    }

    res.json({
      message: 'Meeting request status updated',
      meetingRequest: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error updating meeting request:', error);
    res.status(500).json({ error: 'Failed to update meeting request' });
  }
});

// === MEETING CONFIRMATION ROUTES ===

// GET /meetings/confirmations - Get meeting confirmations
router.get('/confirmations', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📋 Fetching meeting confirmations...');

    const pool = serviceContainer.get('pool');
    const result = await pool.query(`
      SELECT * FROM meeting_confirmations
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      message: 'Meeting confirmations retrieved',
      confirmations: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching meeting confirmations:', error);
    res.status(500).json({ error: 'Failed to fetch meeting confirmations' });
  }
});

// POST /meetings/confirmations/:id/confirm - Confirm a meeting
router.post('/confirmations/:id/confirm', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`✅ Confirming meeting ${id}...`);

    const meetingConfirmationService = serviceContainer.get('meetingConfirmationService');
    const result = await meetingConfirmationService.confirmMeeting(parseInt(id));

    res.json({
      message: 'Meeting confirmed successfully',
      confirmation: result
    });

  } catch (error) {
    console.error('❌ Error confirming meeting:', error);
    res.status(500).json({ error: 'Failed to confirm meeting' });
  }
});

// POST /meetings/confirmations/:id/cancel - Cancel a meeting
router.post('/confirmations/:id/cancel', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`❌ Canceling meeting ${id}...`);

    const meetingConfirmationService = serviceContainer.get('meetingConfirmationService');
    const result = await meetingConfirmationService.cancelMeeting(parseInt(id), reason);

    res.json({
      message: 'Meeting canceled successfully',
      cancellation: result
    });

  } catch (error) {
    console.error('❌ Error canceling meeting:', error);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

// GET /meetings/confirmations/:id/suggestions - Get time suggestions for meeting
router.get('/confirmations/:id/suggestions', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`💡 Getting time suggestions for meeting ${id}...`);

    const autoSchedulingService = serviceContainer.get('autoSchedulingService');
    const suggestions = await autoSchedulingService.suggestAlternativeTimes(parseInt(id));

    res.json({
      message: 'Time suggestions generated',
      suggestions
    });

  } catch (error) {
    console.error('❌ Error getting time suggestions:', error);
    res.status(500).json({ error: 'Failed to get time suggestions' });
  }
});

// === AUTO-SCHEDULING ROUTES ===

// POST /auto-scheduling/process-meeting - Process meeting request for auto-scheduling
router.post('/auto-scheduling/process-meeting', async (req, res) => {
  try {
    const { meetingRequestId } = req.body;
    console.log(`⚙️ Auto-processing meeting request ${meetingRequestId}...`);

    const autoSchedulingService = serviceContainer.get('autoSchedulingService');
    const result = await autoSchedulingService.processMeetingRequest(meetingRequestId);

    res.json({
      message: 'Meeting request processed for auto-scheduling',
      result
    });

  } catch (error) {
    console.error('❌ Error processing meeting for auto-scheduling:', error);
    res.status(500).json({ error: 'Failed to process meeting for auto-scheduling' });
  }
});

// POST /auto-scheduling/suggest-times - Suggest available times
router.post('/auto-scheduling/suggest-times', async (req, res) => {
  try {
    const { participants, duration, preferences } = req.body;
    console.log(`🕐 Suggesting times for ${participants.length} participants...`);

    const autoSchedulingService = serviceContainer.get('autoSchedulingService');
    const suggestions = await autoSchedulingService.suggestOptimalTimes(participants, duration, preferences);

    res.json({
      message: 'Time suggestions generated',
      suggestions
    });

  } catch (error) {
    console.error('❌ Error suggesting times:', error);
    res.status(500).json({ error: 'Failed to suggest times' });
  }
});

// POST /auto-scheduling/create-hold - Create calendar hold for suggested time
router.post('/auto-scheduling/create-hold', async (req, res) => {
  try {
    const { meetingId, suggestedTime } = req.body;
    console.log(`🔒 Creating calendar hold for meeting ${meetingId}...`);

    const autoSchedulingService = serviceContainer.get('autoSchedulingService');
    const hold = await autoSchedulingService.createCalendarHold(meetingId, suggestedTime);

    res.json({
      message: 'Calendar hold created',
      hold
    });

  } catch (error) {
    console.error('❌ Error creating calendar hold:', error);
    res.status(500).json({ error: 'Failed to create calendar hold' });
  }
});

// POST /auto-scheduling/confirm - Confirm auto-scheduled meeting
router.post('/auto-scheduling/confirm', async (req, res) => {
  try {
    const { holdId, finalTime } = req.body;
    console.log(`✅ Confirming auto-scheduled meeting ${holdId}...`);

    const autoSchedulingService = serviceContainer.get('autoSchedulingService');
    const confirmation = await autoSchedulingService.confirmScheduledMeeting(holdId, finalTime);

    res.json({
      message: 'Auto-scheduled meeting confirmed',
      confirmation
    });

  } catch (error) {
    console.error('❌ Error confirming auto-scheduled meeting:', error);
    res.status(500).json({ error: 'Failed to confirm auto-scheduled meeting' });
  }
});

// GET /auto-scheduling/workflows - Get active scheduling workflows
router.get('/auto-scheduling/workflows', async (req, res) => {
  try {
    console.log('📊 Fetching active scheduling workflows...');

    const pool = serviceContainer.get('pool');
    const result = await pool.query(`
      SELECT
        mr.id,
        mr.subject,
        mr.requester_email,
        mr.status,
        mr.created_at,
        COUNT(sh.id) as holds_count
      FROM meeting_requests mr
      LEFT JOIN scheduling_holds sh ON mr.id = sh.meeting_request_id
      WHERE mr.status IN ('pending', 'in_progress')
      GROUP BY mr.id, mr.subject, mr.requester_email, mr.status, mr.created_at
      ORDER BY mr.created_at DESC
      LIMIT 50
    `);

    res.json({
      message: 'Active scheduling workflows retrieved',
      workflows: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching scheduling workflows:', error);
    res.status(500).json({ error: 'Failed to fetch scheduling workflows' });
  }
});

// GET /auto-scheduling/holds - Get calendar holds
router.get('/auto-scheduling/holds', async (req, res) => {
  try {
    console.log('📋 Fetching calendar holds...');

    const pool = serviceContainer.get('pool');
    const result = await pool.query(`
      SELECT * FROM scheduling_holds
      WHERE status = 'active' AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      message: 'Calendar holds retrieved',
      holds: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching calendar holds:', error);
    res.status(500).json({ error: 'Failed to fetch calendar holds' });
  }
});

// POST /auto-scheduling/cleanup-holds - Clean up expired holds
router.post('/auto-scheduling/cleanup-holds', async (req, res) => {
  try {
    console.log('🧹 Cleaning up expired calendar holds...');

    const pool = serviceContainer.get('pool');
    const result = await pool.query(`
      UPDATE scheduling_holds
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'active' AND expires_at <= NOW()
      RETURNING id
    `);

    res.json({
      message: 'Expired holds cleaned up',
      cleanedCount: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error cleaning up holds:', error);
    res.status(500).json({ error: 'Failed to cleanup holds' });
  }
});

// GET /auto-scheduling/health - Auto-scheduling system health
router.get('/auto-scheduling/health', async (req, res) => {
  try {
    console.log('🏥 Checking auto-scheduling system health...');

    const pool = serviceContainer.get('pool');

    // Check active workflows
    const workflowsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM meeting_requests
      WHERE status IN ('pending', 'in_progress')
    `);
    const activeWorkflows = parseInt(workflowsCheck.rows[0].count);

    // Check active holds
    const holdsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM scheduling_holds
      WHERE status = 'active' AND expires_at > NOW()
    `);
    const activeHolds = parseInt(holdsCheck.rows[0].count);

    const health = {
      status: 'healthy',
      activeWorkflows,
      activeHolds,
      timestamp: new Date().toISOString()
    };

    res.json({
      message: 'Auto-scheduling system health check completed',
      health
    });

  } catch (error) {
    console.error('❌ Auto-scheduling health check failed:', error);
    res.status(500).json({
      message: 'Auto-scheduling health check failed',
      health: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;