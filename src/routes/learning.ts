/**
 * Learning System Routes
 * Handles AI learning, feedback analysis, and performance metrics
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware.authenticate);

// POST /learning/analyze-edit - Analyze user edits for learning
router.post('/analyze-edit', async (req: AuthenticatedRequest, res) => {
  try {
    const { responseId, originalText, editedText } = req.body;

    if (!responseId || !originalText || !editedText) {
      return res.status(400).json({
        error: 'Missing required fields: responseId, originalText, editedText'
      });
    }

    console.log(`🔍 Analyzing edit for response ${responseId}...`);

    const learningService = serviceContainer.get('learningService');
    const analysis = await learningService.analyzeEdit(responseId, originalText, editedText, req.userId);

    res.json({
      message: 'Edit analysis completed',
      analysis
    });

  } catch (error) {
    console.error('❌ Error analyzing edit:', error);
    res.status(500).json({ error: 'Failed to analyze edit' });
  }
});

// GET /learning/success-metrics - Get learning success metrics
router.get('/success-metrics', async (req: AuthenticatedRequest, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNumber = parseInt(days as string);

    console.log(`📊 Calculating success metrics for ${daysNumber} days...`);

    const learningService = serviceContainer.get('learningService');
    const metrics = await learningService.calculateSuccessMetrics(daysNumber, true, req.userId);

    res.json({
      message: 'Success metrics calculated',
      period: `${daysNumber} days`,
      metrics
    });

  } catch (error) {
    console.error('❌ Error calculating success metrics:', error);
    res.status(500).json({ error: 'Failed to calculate success metrics' });
  }
});

// GET /learning/insights - Get learning insights
router.get('/insights', async (req: AuthenticatedRequest, res) => {
  try {
    const { days = 30 } = req.query;
    const daysNumber = parseInt(days as string);

    console.log(`🧠 Generating learning insights for ${daysNumber} days...`);

    const learningService = serviceContainer.get('learningService');
    const insights = await learningService.generateLearningInsights(daysNumber, req.userId);

    res.json({
      message: 'Learning insights generated',
      period: `${daysNumber} days`,
      insights,
      count: insights.length
    });

  } catch (error) {
    console.error('❌ Error generating learning insights:', error);
    res.status(500).json({ error: 'Failed to generate learning insights' });
  }
});

// GET /learning/performance-trend - Get performance trend analysis
router.get('/performance-trend', async (req: AuthenticatedRequest, res) => {
  try {
    const { days = 30, granularity = 'daily' } = req.query;
    const daysNumber = parseInt(days as string);

    console.log(`📈 Analyzing performance trends for ${daysNumber} days (${granularity})...`);

    const learningService = serviceContainer.get('learningService');
    const trendData = await learningService.getPerformanceTrend(
      daysNumber,
      granularity as 'daily' | 'weekly' | 'monthly',
      req.userId
    );

    res.json({
      message: 'Performance trend analysis completed',
      period: `${daysNumber} days`,
      granularity,
      trends: trendData,
      dataPoints: trendData.length
    });

  } catch (error) {
    console.error('❌ Error analyzing performance trends:', error);
    res.status(500).json({ error: 'Failed to analyze performance trends' });
  }
});

// POST /learning/weekly-analysis - Generate weekly learning analysis
router.post('/weekly-analysis', async (req: AuthenticatedRequest, res) => {
  try {
    const { weekOffset = 0, includeComparisons = true } = req.body;

    console.log(`📅 Generating weekly analysis (week offset: ${weekOffset})...`);

    const learningService = serviceContainer.get('learningService');

    // Calculate date range for the requested week
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - (weekOffset * 7));
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    console.log(`📊 Analyzing week: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Generate comprehensive weekly analysis
    const [
      weeklyMetrics,
      learningInsights,
      performanceTrend
    ] = await Promise.all([
      learningService.calculateSuccessMetrics(7, true, req.userId),
      learningService.generateLearningInsights(7, req.userId),
      learningService.getPerformanceTrend(7, 'daily', req.userId)
    ]);

    let comparison = null;
    if (includeComparisons && weekOffset === 0) {
      // Compare with previous week for current week analysis
      try {
        const previousWeekMetrics = await learningService.calculateSuccessMetrics(7, true, req.userId);
        comparison = {
          previousWeek: previousWeekMetrics,
          improvements: [] as string[],
          regressions: [] as string[]
        };

        // Simple comparison logic
        if (weeklyMetrics.overallScore > previousWeekMetrics.overallScore) {
          comparison.improvements.push('Overall performance improved');
        } else if (weeklyMetrics.overallScore < previousWeekMetrics.overallScore) {
          comparison.regressions.push('Overall performance declined');
        }
      } catch (compError) {
        console.warn('Could not generate week-over-week comparison:', compError);
      }
    }

    res.json({
      message: 'Weekly analysis completed',
      period: {
        weekOffset,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      metrics: weeklyMetrics,
      insights: learningInsights,
      trends: performanceTrend,
      comparison,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generating weekly analysis:', error);
    res.status(500).json({ error: 'Failed to generate weekly analysis' });
  }
});

export default router;