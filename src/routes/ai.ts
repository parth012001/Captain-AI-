/**
 * AI & Context Intelligence Routes
 * Handles AI operations, context analysis, and smart response generation
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate);

// POST /context/analyze-emails - Analyze emails for context intelligence
router.post('/context/analyze-emails', async (req: AuthenticatedRequest, res) => {
  try {
    const { emailIds, analysisType = 'comprehensive' } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      return res.status(400).json({ error: 'emailIds array is required' });
    }

    console.log(`🧠 Starting context analysis for ${emailIds.length} emails...`);

    const contextService = serviceContainer.get('contextService');
    const emailModel = serviceContainer.get('emailModel');

    const analysisResults = [];
    let processedCount = 0;

    for (const emailId of emailIds) {
      try {
        console.log(`🔍 Analyzing email ${emailId}...`);

        // Get email from database
        const emails = await emailModel.getRecentEmails(1000); // Get enough to find by ID
        const email = emails.find(e => e.id === emailId);

        if (!email) {
          console.log(`⚠️ Email ${emailId} not found`);
          analysisResults.push({
            emailId,
            error: 'Email not found',
            status: 'failed'
          });
          continue;
        }

        // Build context analysis request
        const contextRequest = {
          email: {
            subject: email.subject,
            body: email.body || '',
            from: email.from_email,
            threadId: email.thread_id
          },
          analysisType
        };

        // Perform context analysis
        const analysis = await contextService.analyzeEmailContext(contextRequest);

        analysisResults.push({
          emailId,
          status: 'success',
          analysis: {
            entities: analysis.entities || [],
            sentiment: analysis.sentiment || 'neutral',
            topics: analysis.topics || [],
            urgency: analysis.urgency || 'medium',
            contextSummary: analysis.summary || 'No summary available'
          }
        });

        processedCount++;
        console.log(`✅ Completed analysis for email ${emailId}`);

      } catch (emailError) {
        console.error(`❌ Error analyzing email ${emailId}:`, emailError);
        analysisResults.push({
          emailId,
          error: emailError instanceof Error ? emailError.message : 'Analysis failed',
          status: 'failed'
        });
      }
    }

    const successRate = emailIds.length > 0 ? Math.round((processedCount / emailIds.length) * 100) : 0;

    console.log(`🎉 Context analysis completed: ${processedCount}/${emailIds.length} emails processed (${successRate}% success rate)`);

    res.json({
      message: 'Context analysis completed',
      processed: processedCount,
      total: emailIds.length,
      successRate,
      analysisType,
      results: analysisResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in context analysis:', error);
    res.status(500).json({ error: 'Failed to analyze email context' });
  }
});

// GET /context/stats - Get context intelligence statistics
router.get('/context/stats', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 Fetching context intelligence statistics...');

    const contextModel = serviceContainer.get('contextModel');
    const stats = await contextModel.getContextStats();

    res.json({
      message: 'Context intelligence statistics',
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching context stats:', error);
    res.status(500).json({ error: 'Failed to fetch context statistics' });
  }
});

// GET /context/threads - Get thread context analysis
router.get('/context/threads', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 10, withSummary = true } = req.query;

    console.log(`🧵 Fetching thread context analysis (limit: ${limit})...`);

    const contextModel = serviceContainer.get('contextModel');
    const threads = await contextModel.getThreadAnalysis(parseInt(limit as string), withSummary === 'true');

    res.json({
      message: 'Thread context analysis retrieved',
      threads,
      count: threads.length
    });
  } catch (error) {
    console.error('❌ Error fetching thread context:', error);
    res.status(500).json({ error: 'Failed to fetch thread context' });
  }
});

// GET /context/senders - Get sender relationship analysis
router.get('/context/senders', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20, minInteractions = 2 } = req.query;

    console.log(`👥 Fetching sender relationship analysis...`);

    const contextModel = serviceContainer.get('contextModel');
    const senders = await contextModel.getSenderAnalysis(
      parseInt(limit as string),
      parseInt(minInteractions as string)
    );

    res.json({
      message: 'Sender relationship analysis retrieved',
      senders,
      count: senders.length,
      filters: {
        limit: parseInt(limit as string),
        minInteractions: parseInt(minInteractions as string)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching sender analysis:', error);
    res.status(500).json({ error: 'Failed to fetch sender analysis' });
  }
});

// GET /context/entities - Get entity extraction insights
router.get('/context/entities', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🏷️ Fetching entity extraction insights...');

    const contextModel = serviceContainer.get('contextModel');
    const entities = await contextModel.getEntityInsights();

    res.json({
      message: 'Entity extraction insights',
      entities
    });
  } catch (error) {
    console.error('❌ Error getting entity insights:', error);
    res.status(500).json({ error: 'Failed to get entity insights' });
  }
});

// GET /context/thread/:threadId - Get full thread context
router.get('/context/thread/:threadId', async (req: AuthenticatedRequest, res) => {
  try {
    const { threadId } = req.params;
    console.log(`🧵 Fetching full context for thread: ${threadId}`);

    const contextModel = serviceContainer.get('contextModel');
    const threadContext = await contextModel.getThreadFullContext(threadId);

    if (!threadContext) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({
      message: 'Full thread context',
      threadId,
      context: threadContext
    });
  } catch (error) {
    console.error('❌ Error getting thread context:', error);
    res.status(500).json({ error: 'Failed to get thread context' });
  }
});

// GET /context/health - Context intelligence health check
router.get('/context/health', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🏥 Running context intelligence health check...');

    const contextModel = serviceContainer.get('contextModel');
    const health = await contextModel.contextHealthCheck();

    res.json({
      message: 'Context intelligence health check',
      health
    });
  } catch (error) {
    console.error('❌ Error checking context health:', error);
    res.status(500).json({ error: 'Failed to check context health' });
  }
});

// POST /response/generate-smart - Generate smart response
router.post('/response/generate-smart', async (req: AuthenticatedRequest, res) => {
  try {
    const { emailId, recipientEmail, originalSubject, originalBody, customInstructions } = req.body;
    const userId = getUserId(req);

    if (!recipientEmail || !originalSubject || !originalBody) {
      return res.status(400).json({
        error: 'Missing required fields: recipientEmail, originalSubject, originalBody'
      });
    }

    console.log(`🤖 Generating smart response for ${recipientEmail}...`);

    const responseService = serviceContainer.get('responseService');
    const responseRequest = {
      emailId: emailId || null,
      recipientEmail,
      originalSubject,
      originalBody,
      responseType: 'reply' as const,
      customInstructions,
      userId: userId
    };

    const smartResponse = await responseService.generateSmartResponse(responseRequest);

    res.json({
      message: 'Smart response generated successfully',
      response: smartResponse
    });

  } catch (error) {
    console.error('❌ Error generating smart response:', error);
    res.status(500).json({ error: 'Failed to generate smart response' });
  }
});

// GET /response/templates - Get response templates
router.get('/response/templates', async (req: AuthenticatedRequest, res) => {
  try {
    const { relationshipType, urgencyLevel, templateType } = req.query;

    let query = 'SELECT * FROM response_templates WHERE is_active = true';
    const params: any[] = [];
    let paramCount = 1;

    if (relationshipType) {
      query += ` AND relationship_context = $${paramCount}`;
      params.push(relationshipType);
      paramCount++;
    }

    if (urgencyLevel) {
      query += ` AND urgency_context = $${paramCount}`;
      params.push(urgencyLevel);
      paramCount++;
    }

    if (templateType) {
      query += ` AND template_type = $${paramCount}`;
      params.push(templateType);
      paramCount++;
    }

    query += ' ORDER BY usage_count DESC, created_at DESC';

    const pool = serviceContainer.get('pool');
    const result = await pool.query(query, params);

    res.json({
      message: 'Response templates retrieved',
      templates: result.rows,
      count: result.rows.length,
      filters: {
        relationshipType,
        urgencyLevel,
        templateType
      }
    });

  } catch (error) {
    console.error('❌ Error fetching response templates:', error);
    res.status(500).json({ error: 'Failed to fetch response templates' });
  }
});

// GET /response/stats - Get response generation statistics
router.get('/response/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNumber = parseInt(days as string);

    console.log(`📊 Fetching response generation statistics for ${daysNumber} days...`);

    const pool = serviceContainer.get('pool');
    const statsQuery = `
      SELECT
        COUNT(*) as total_responses,
        AVG(confidence_score) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time,
        COUNT(CASE WHEN user_edited = true THEN 1 END) as edited_responses,
        COUNT(CASE WHEN was_sent = true THEN 1 END) as sent_responses
      FROM generated_responses
      WHERE generated_at > NOW() - INTERVAL '${daysNumber} days'
    `;

    const recentStatsQuery = `
      SELECT
        relationship_type,
        urgency_level,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM generated_responses
      WHERE generated_at > NOW() - INTERVAL '${daysNumber} days'
      GROUP BY relationship_type, urgency_level
      ORDER BY count DESC
    `;

    const [stats, recentStats] = await Promise.all([
      pool.query(statsQuery),
      pool.query(recentStatsQuery)
    ]);

    res.json({
      message: 'Response generation statistics',
      stats: stats.rows[0],
      recentBreakdown: recentStats.rows
    });

  } catch (error) {
    console.error('❌ Error fetching response stats:', error);
    res.status(500).json({ error: 'Failed to fetch response stats' });
  }
});

// POST /response/feedback - Record response feedback
router.post('/response/feedback', async (req: AuthenticatedRequest, res) => {
  try {
    const { responseId, wasEdited, editPercentage, wasSent, userRating } = req.body;

    if (!responseId) {
      return res.status(400).json({ error: 'Missing required field: responseId' });
    }

    const pool = serviceContainer.get('pool');
    const updateQuery = `
      UPDATE generated_responses
      SET
        user_edited = COALESCE($2, user_edited),
        edit_percentage = COALESCE($3, edit_percentage),
        was_sent = COALESCE($4, was_sent),
        user_rating = COALESCE($5, user_rating),
        edited_at = CASE WHEN $2 = true THEN CURRENT_TIMESTAMP ELSE edited_at END,
        sent_at = CASE WHEN $4 = true THEN CURRENT_TIMESTAMP ELSE sent_at END,
        rated_at = CASE WHEN $5 IS NOT NULL THEN CURRENT_TIMESTAMP ELSE rated_at END
      WHERE response_id = $1
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      responseId,
      wasEdited,
      editPercentage,
      wasSent,
      userRating
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Response not found' });
    }

    res.json({
      message: 'Feedback recorded successfully',
      response: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

// GET /response/recent - Get recent responses
router.get('/response/recent', async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20 } = req.query;

    const pool = serviceContainer.get('pool');
    const query = `
      SELECT * FROM generated_responses
      ORDER BY generated_at DESC
      LIMIT $1;
    `;

    const result = await pool.query(query, [limit]);

    res.json({
      message: 'Recent responses retrieved',
      responses: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching recent responses:', error);
    res.status(500).json({ error: 'Failed to fetch recent responses' });
  }
});

// === CONTEXT INTELLIGENCE ROUTES ===

// POST /context/analyze-emails - Analyze emails for context intelligence
router.post('/context/analyze-emails', async (req, res) => {
  try {
    console.log('🧠 Starting deep context analysis on emails...');

    const contextModel = serviceContainer.get('contextModel');
    const contextService = serviceContainer.get('contextService');

    // Get emails that need context analysis
    const emailsToAnalyze = await contextModel.getEmailsNeedingContextAnalysis(10);
    console.log(`📧 Found ${emailsToAnalyze.length} emails needing context analysis`);

    let processedCount = 0;
    const results = [];

    for (const email of emailsToAnalyze) {
      try {
        // Convert database email to ParsedEmail format
        const parsedEmail = {
          id: email.id.toString(),
          threadId: email.thread_id,
          subject: email.subject,
          from: email.from_email,
          to: email.to_email || '',
          date: new Date(email.received_at),
          body: email.body,
          isRead: email.is_read
        };

        // Analyze sender intelligence
        const senderProfile = await contextService.analyzeSender(parsedEmail);

        // Group emails by thread for context analysis (MUST be done BEFORE extracting entities)
        const threadEmails = emailsToAnalyze.filter(e => e.thread_id === email.thread_id);
        const parsedThreadEmails = threadEmails.map(e => ({
          id: e.id.toString(),
          threadId: e.thread_id,
          subject: e.subject,
          from: e.from_email,
          to: e.to_email || '',
          date: new Date(e.received_at),
          body: e.body,
          isRead: e.is_read
        }));

        const threadContext = await contextService.analyzeThreadContext(parsedThreadEmails);

        // Extract entities (AFTER thread context is created to satisfy foreign key)
        const entities = await contextService.extractEntities(parsedEmail);

        // Mark as analyzed
        await contextModel.markEmailContextAnalyzed(email.id);

        processedCount++;
        results.push({
          emailId: email.id,
          senderProfile: senderProfile.display_name || senderProfile.email_address,
          entitiesFound: entities.length,
          threadContext: threadContext ? threadContext.context_summary : null
        });

      } catch (error) {
        console.error(`❌ Error processing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      message: `Context analysis completed`,
      emailsProcessed: processedCount,
      totalEmails: emailsToAnalyze.length,
      results
    });

  } catch (error) {
    console.error('❌ Error in context analysis:', error);
    res.status(500).json({ error: 'Context analysis failed' });
  }
});

// GET /context/stats - Get context intelligence statistics
router.get('/context/stats', async (req, res) => {
  try {
    const contextModel = serviceContainer.get('contextModel');
    const stats = await contextModel.getContextStats();
    res.json({
      message: 'Context intelligence statistics',
      stats
    });
  } catch (error) {
    console.error('❌ Error getting context stats:', error);
    res.status(500).json({ error: 'Failed to get context stats' });
  }
});

// GET /context/threads - Get email thread analytics
router.get('/context/threads', async (req, res) => {
  try {
    const contextModel = serviceContainer.get('contextModel');
    const threads = await contextModel.getThreadAnalytics();
    res.json({
      message: 'Email thread analytics',
      threads
    });
  } catch (error) {
    console.error('❌ Error getting thread analytics:', error);
    res.status(500).json({ error: 'Failed to get thread analytics' });
  }
});

// GET /context/senders - Get sender relationship insights
router.get('/context/senders', async (req, res) => {
  try {
    const contextModel = serviceContainer.get('contextModel');
    const senders = await contextModel.getSenderInsights();
    res.json({
      message: 'Sender relationship insights',
      senders
    });
  } catch (error) {
    console.error('❌ Error getting sender insights:', error);
    res.status(500).json({ error: 'Failed to get sender insights' });
  }
});

// GET /context/entities - Get entity extraction insights
router.get('/context/entities', async (req, res) => {
  try {
    const contextModel = serviceContainer.get('contextModel');
    const entities = await contextModel.getEntityInsights();
    res.json({
      message: 'Entity extraction insights',
      entities
    });
  } catch (error) {
    console.error('❌ Error getting entity insights:', error);
    res.status(500).json({ error: 'Failed to get entity insights' });
  }
});

// GET /context/thread/:threadId - Get full thread context
router.get('/context/thread/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const contextModel = serviceContainer.get('contextModel');
    const threadContext = await contextModel.getThreadFullContext(threadId);

    if (!threadContext) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({
      message: 'Full thread context',
      threadId,
      context: threadContext
    });
  } catch (error) {
    console.error('❌ Error getting thread context:', error);
    res.status(500).json({ error: 'Failed to get thread context' });
  }
});

// GET /context/health - Context intelligence health check
router.get('/context/health', async (req, res) => {
  try {
    const contextModel = serviceContainer.get('contextModel');
    const health = await contextModel.contextHealthCheck();
    res.json({
      message: 'Context intelligence health check',
      health
    });
  } catch (error) {
    console.error('❌ Error checking context health:', error);
    res.status(500).json({ error: 'Failed to check context health' });
  }
});

// POST /ai/generate-drafts-with-context - Generate drafts with enhanced context
router.post('/ai/generate-drafts-with-context', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const { emailIds, customInstructions, priority = 'medium' } = req.body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return res.status(400).json({ error: 'emailIds array is required' });
    }

    console.log(`🎯 Generating context-enhanced drafts for ${emailIds.length} emails...`);

    const pool = serviceContainer.get('pool');
    const responseService = serviceContainer.get('responseService');
    const contextService = serviceContainer.get('contextService');

    const results = [];

    for (const emailId of emailIds) {
      try {
        // Get email details
        const emailQuery = await pool.query(
          'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
          [emailId, userId]
        );

        if (emailQuery.rows.length === 0) {
          results.push({
            emailId,
            error: 'Email not found or access denied'
          });
          continue;
        }

        const email = emailQuery.rows[0];

        // Build enhanced context
        const parsedEmail = {
          id: email.gmail_id,
          threadId: email.thread_id,
          subject: email.subject,
          from: email.from_email,
          to: email.to_email || '',
          date: new Date(email.received_at),
          body: email.body,
          isRead: email.is_read
        };

        // Get sender context and thread context
        const [senderProfile, entities] = await Promise.all([
          contextService.analyzeSender(parsedEmail).catch(() => null),
          contextService.extractEntities(parsedEmail).catch(() => [])
        ]);

        // Generate response with enhanced context
        const responseRequest = {
          emailId: email.id,
          recipientEmail: email.from_email,
          originalSubject: email.subject,
          originalBody: email.body,
          responseType: 'reply' as const,
          customInstructions,
          userId,
          // Enhanced context
          senderContext: senderProfile ? {
            relationshipType: senderProfile.relationship_type,
            interactionHistory: senderProfile.interaction_count,
            lastInteraction: senderProfile.last_interaction
          } : undefined,
          extractedEntities: entities.map((e: any) => ({
            type: e.entity_type,
            value: e.entity_value,
            confidence: e.confidence
          }))
        };

        const smartResponse = await responseService.generateSmartResponse(responseRequest);

        results.push({
          emailId,
          subject: email.subject,
          from: email.from_email,
          generatedDraft: {
            subject: smartResponse.subject,
            body: smartResponse.body,
            confidence: smartResponse.confidence,
            relationshipContext: smartResponse.relationshipContext
          },
          contextEnhancements: {
            senderRelationship: senderProfile?.relationship_type || 'unknown',
            entitiesFound: entities.length,
            interactionHistory: senderProfile?.interaction_count || 0
          }
        });

        console.log(`✅ Generated context-enhanced draft for email ${emailId}`);

      } catch (error) {
        console.error(`❌ Error generating draft for email ${emailId}:`, error);
        results.push({
          emailId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => !r.error).length;

    res.json({
      message: `Context-enhanced draft generation completed`,
      results,
      summary: {
        totalRequested: emailIds.length,
        successful: successCount,
        failed: emailIds.length - successCount,
        successRate: ((successCount / emailIds.length) * 100).toFixed(1) + '%'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in context-enhanced draft generation:', error);
    res.status(500).json({ error: 'Context-enhanced draft generation failed' });
  }
});

export default router;