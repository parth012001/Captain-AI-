/**
 * Draft Management Routes
 * Handles draft generation, auto-drafts, tone analysis, and AI draft operations
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Apply authentication middleware to all routes (except legacy ones)
const authenticateRoutes = ['/tone-analysis', '/generate', '/auto-drafts', '/auto-drafts/*'];

// POST /ai/analyze-tone-real - Analyze tone from real sent emails
router.post('/tone-analysis/real', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const gmailService = serviceContainer.get('gmailService');
    const aiService = serviceContainer.get('aiService');
    const draftModel = serviceContainer.get('draftModel');

    console.log(`🧠 Analyzing tone from real sent emails for user: ${userId.substring(0, 8)}...`);

    // Initialize Gmail service for this user
    await gmailService.initializeForUser(userId);

    // Fetch real sent emails from Gmail with user context validation
    const sentEmails = await gmailService.getSentEmailsForUser(userId, 50);
    console.log(`📤 Retrieved ${sentEmails.length} sent emails from Gmail`);

    // Filter emails for tone analysis
    const filteredEmails = gmailService.filterSentEmailsForToneAnalysis(sentEmails);

    if (filteredEmails.length === 0) {
      return res.status(400).json({
        error: 'No suitable emails found for tone analysis',
        suggestion: 'Try sending more emails or check if your sent folder has content'
      });
    }

    // Convert to format expected by AI service
    const emailsForAnalysis = filteredEmails.map(email => {
      const parsed = gmailService.parseEmail(email);
      return {
        subject: parsed.subject,
        body: parsed.body
      };
    });

    // Perform real tone analysis
    const toneAnalysis = await aiService.analyzeToneFromRealEmails(emailsForAnalysis);

    // Save to database with real data flag
    const savedProfileId = await draftModel.saveToneProfile({
      profile_text: toneAnalysis.profile,
      confidence_score: toneAnalysis.confidence,
      email_samples_analyzed: emailsForAnalysis.length,
      insights: toneAnalysis.insights,
      is_real_data: true
    });

    res.json({
      message: 'Real tone analysis completed successfully',
      profileId: savedProfileId,
      samplesAnalyzed: emailsForAnalysis.length,
      totalSentEmails: sentEmails.length,
      filteredEmails: filteredEmails.length,
      confidence: toneAnalysis.confidence,
      toneProfilePreview: toneAnalysis.profile.substring(0, 300) + '...',
      insights: toneAnalysis.insights.substring(0, 200) + '...'
    });
  } catch (error) {
    console.error('❌ Error analyzing real tone:', error);
    res.status(500).json({ error: 'Failed to analyze tone from real emails' });
  }
});

// POST /ai/analyze-tone - Fallback tone analysis with mock data
router.post('/tone-analysis/mock', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const aiService = serviceContainer.get('aiService');
    const draftModel = serviceContainer.get('draftModel');

    console.log(`🧠 Analyzing tone from mock emails (fallback) for user: ${userId.substring(0, 8)}...`);

    const mockSentEmails = [
      { subject: 'Re: Meeting tomorrow', body: 'Hi John, That works perfectly for me. I\'ll see you at 3pm in the conference room. Thanks!' },
      { subject: 'Thank you', body: 'Hi Sarah, Thank you so much for your help with the project. I really appreciate your time and expertise.' },
      { subject: 'Quick question', body: 'Hey team, Just wanted to check if we\'re still on track for the deadline. Let me know if you need any help!' }
    ];

    const toneProfile = await aiService.analyzeToneFromEmails(mockSentEmails);

    const savedProfileId = await draftModel.saveToneProfile({
      profile_text: toneProfile,
      confidence_score: 70, // Lower confidence for mock data
      email_samples_analyzed: mockSentEmails.length,
      insights: 'Based on mock email samples - use real analysis for better results',
      is_real_data: false
    });

    res.json({
      message: 'Tone analysis completed (using mock data)',
      profileId: savedProfileId,
      samplesAnalyzed: mockSentEmails.length,
      confidence: 70,
      toneProfile: toneProfile.substring(0, 200) + '...',
      warning: 'This used mock data. Use /tone-analysis/real for authentic results'
    });
  } catch (error) {
    console.error('❌ Error analyzing tone:', error);
    res.status(500).json({ error: 'Failed to analyze tone' });
  }
});

// GET /tone-profiles - Get tone profile history
router.get('/tone-profiles', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const draftModel = serviceContainer.get('draftModel');
    const profiles = await draftModel.getToneProfileHistory(5);

    res.json({
      profiles: profiles.map(profile => ({
        id: profile.id,
        isRealData: profile.is_real_data,
        confidence: profile.confidence_score,
        emailSamples: profile.email_samples_analyzed,
        createdAt: profile.created_at,
        profilePreview: profile.profile_text.substring(0, 200) + '...',
        insightsPreview: profile.insights?.substring(0, 100) + '...' || 'No insights available'
      })),
      total: profiles.length,
      latestReal: profiles.find(p => p.is_real_data) || null
    });
  } catch (error) {
    console.error('❌ Error fetching tone profiles:', error);
    res.status(500).json({ error: 'Failed to fetch tone profiles' });
  }
});

// GET /tone-profiles/:id - Get specific tone profile
router.get('/tone-profiles/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const draftModel = serviceContainer.get('draftModel');
    const profiles = await draftModel.getToneProfileHistory(20);
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Tone profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('❌ Error fetching tone profile:', error);
    res.status(500).json({ error: 'Failed to fetch tone profile' });
  }
});

// POST /ai/refresh-tone - Refresh tone analysis
router.post('/tone-analysis/refresh', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { forceRefresh } = req.body;
    const userId = getUserId(req);
    const draftModel = serviceContainer.get('draftModel');

    // Check if we have a recent real tone profile (within last 7 days)
    const existingProfile = await draftModel.getLatestRealToneProfile();

    if (existingProfile && !forceRefresh) {
      const daysSinceLastAnalysis = Math.floor((Date.now() - new Date(existingProfile.created_at).getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastAnalysis < 7) {
        return res.json({
          message: 'Recent tone profile found',
          skipReason: `Profile created ${daysSinceLastAnalysis} days ago`,
          existingProfile: {
            id: existingProfile.id,
            confidence: existingProfile.confidence_score,
            samplesAnalyzed: existingProfile.email_samples_analyzed,
            createdAt: existingProfile.created_at
          },
          suggestion: 'Use forceRefresh: true to generate new profile'
        });
      }
    }

    // Redirect to real tone analysis
    return res.redirect(307, '/drafts/tone-analysis/real');
  } catch (error) {
    console.error('❌ Error refreshing tone:', error);
    res.status(500).json({ error: 'Failed to refresh tone analysis' });
  }
});

// POST /ai/categorize-emails - Categorize emails with AI
router.post('/categorize', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = getUserId(req);
    const emailModel = serviceContainer.get('emailModel');
    const aiService = serviceContainer.get('aiService');

    console.log(`🤖 Email categorization initiated by user: ${userId.substring(0, 8)}...`);

    // Get recent uncategorized emails
    const emails = await emailModel.getRecentEmails(10, userId);
    const uncategorizedEmails = emails.filter(email => !email.category);

    if (uncategorizedEmails.length === 0) {
      return res.json({
        message: 'No uncategorized emails found',
        categorized: 0
      });
    }

    console.log(`📧 Found ${uncategorizedEmails.length} uncategorized emails to process`);

    let categorizedCount = 0;
    const results = [];

    for (const email of uncategorizedEmails) {
      try {
        const category = await aiService.categorizeEmail(
          email.subject || '',
          email.body || '',
          email.from_email
        );

        // Update email category in database
        await emailModel.updateEmailCategory(email.id, category);

        results.push({
          emailId: email.id,
          subject: email.subject,
          category: category
        });

        categorizedCount++;
      } catch (error) {
        console.error(`Error categorizing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          subject: email.subject,
          error: 'Failed to categorize'
        });
      }
    }

    res.json({
      message: 'Email categorization completed',
      categorized: categorizedCount,
      total: uncategorizedEmails.length,
      results
    });
  } catch (error) {
    console.error('❌ Error categorizing emails:', error);
    res.status(500).json({ error: 'Failed to categorize emails' });
  }
});

// POST /ai/generate-drafts - Generate AI drafts
router.post('/generate', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const emailModel = serviceContainer.get('emailModel');
    const aiService = serviceContainer.get('aiService');
    const draftModel = serviceContainer.get('draftModel');

    // Get recent unread emails without drafts
    const emails = await emailModel.getRecentEmails(5);
    const unprocessedEmails = emails.filter(email => !email.has_draft && !email.is_read);

    if (unprocessedEmails.length === 0) {
      return res.json({
        message: 'No unprocessed emails found',
        generated: 0
      });
    }

    // Get the latest tone profile
    const toneProfile = await draftModel.getLatestToneProfile();
    if (!toneProfile) {
      return res.status(400).json({
        error: 'No tone profile found. Please run tone analysis first.'
      });
    }

    let generatedCount = 0;
    const drafts = [];

    for (const email of unprocessedEmails.slice(0, 3)) { // Limit to 3 for testing
      try {
        // Categorize email if not already categorized
        const category = email.category || await aiService.categorizeEmail(
          email.subject || '',
          email.body || '',
          email.from_email
        );

        // Generate draft
        const draft = await aiService.generateDraft(
          {
            subject: email.subject || '',
            body: email.body || '',
            from: email.from_email
          },
          category,
          toneProfile.profile_text
        );

        // Score the draft
        const qualityScore = await aiService.scoreDraft(
          draft.body,
          email.body || '',
          category
        );

        // Save draft to database
        const draftId = await draftModel.saveDraft({
          email_id: email.id,
          subject: draft.subject,
          body: draft.body,
          category,
          confidence_score: draft.confidence,
          quality_score: qualityScore
        });

        drafts.push({
          id: draftId,
          emailSubject: email.subject,
          category,
          confidence: draft.confidence,
          qualityScore
        });

        generatedCount++;
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
      }
    }

    res.json({
      message: 'Draft generation completed',
      generated: generatedCount,
      drafts
    });
  } catch (error) {
    console.error('❌ Error generating drafts:', error);
    res.status(500).json({ error: 'Failed to generate drafts' });
  }
});

// GET /drafts - Get pending drafts (legacy endpoint)
router.get('/legacy', async (req: AuthenticatedRequest, res) => {
  try {
    const draftModel = serviceContainer.get('draftModel');
    const drafts = await draftModel.getPendingDrafts(20);

    res.json({
      drafts: drafts.map(draft => ({
        id: draft.id,
        originalSubject: draft.original_subject,
        draftSubject: draft.subject,
        from: draft.from_email,
        category: draft.category,
        confidence: draft.confidence_score,
        qualityScore: draft.quality_score,
        status: draft.status,
        createdAt: draft.created_at,
        preview: draft.body.substring(0, 150) + '...'
      })),
      total: drafts.length
    });
  } catch (error) {
    console.error('❌ Error fetching drafts:', error);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// GET /drafts/:id - Get specific draft (legacy endpoint)
router.get('/legacy/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const draftId = parseInt(req.params.id);
    const pool = serviceContainer.get('pool');

    // Get draft by ID directly from database
    const query = 'SELECT * FROM drafts WHERE id = $1';
    const result = await pool.query(query, [draftId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching draft:', error);
    res.status(500).json({ error: 'Failed to fetch draft' });
  }
});

export default router;