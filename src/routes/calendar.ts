/**
 * Calendar Integration Routes
 * Handles calendar operations, availability checking, event creation, and preferences
 */
import { Router } from 'express';
import { AuthenticatedRequest, successResponse, errorResponse } from '../types/routes';
import { authMiddleware, getUserId } from '../middleware/auth';
import { serviceContainer } from '../core/serviceContainer';

const router = Router();

// POST /calendar/set-tokens - Set calendar tokens (no auth required for setup)
router.post('/set-tokens', async (req: AuthenticatedRequest, res) => {
  try {
    const { accessToken, refreshToken, expiryDate } = req.body;

    if (!accessToken || !refreshToken) {
      return res.status(400).json({ error: 'accessToken and refreshToken are required' });
    }

    const calendarService = serviceContainer.get('calendarService');
    console.log('📅 Setting up calendar tokens...');

    await calendarService.setStoredTokens(accessToken, refreshToken, expiryDate);

    res.json({
      message: 'Calendar tokens configured successfully',
      hasTokens: true
    });
  } catch (error) {
    console.error('❌ Error setting calendar tokens:', error);
    res.status(500).json({ error: 'Failed to set calendar tokens' });
  }
});

// Apply authentication to all other routes
router.use(authMiddleware.authenticate);

// GET /calendar/events - Get calendar events
router.get('/events', async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate, maxResults = 50 } = req.query;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (ISO format)' });
    }

    console.log(`📅 Fetching calendar events for user ${userId}: ${startDate} to ${endDate}`);

    const tokenStorageService = serviceContainer.get('tokenStorageService');
    const calendarService = serviceContainer.get('calendarService');

    // Get user credentials
    const credentials = await tokenStorageService.getDecryptedCredentials(userId);
    if (!credentials) {
      return res.status(401).json({ error: 'Calendar access not authorized' });
    }

    await calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);

    const events = await calendarService.getCalendarEvents(
      startDate as string,
      endDate as string,
      parseInt(maxResults as string)
    );

    res.json({
      message: `Retrieved ${events.length} calendar events`,
      events: events,
      dateRange: {
        start: startDate,
        end: endDate
      },
      user: userId
    });

  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /calendar/check-availability - Check calendar availability
router.post('/check-availability', async (req: AuthenticatedRequest, res) => {
  try {
    const { start, end } = req.body;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end datetime are required (ISO format)' });
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    console.log(`🎯 Checking availability for user ${userId}: ${start} to ${end}`);

    const tokenStorageService = serviceContainer.get('tokenStorageService');
    const calendarService = serviceContainer.get('calendarService');

    // Initialize calendar service with user tokens
    const credentials = await tokenStorageService.getDecryptedCredentials(userId);
    if (!credentials) {
      return res.status(401).json({ error: 'Calendar access not authorized' });
    }

    await calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);

    const availability = await calendarService.checkAvailability(start, end);

    res.json({
      message: `Availability check: ${availability.isAvailable ? 'Available' : 'Conflicts found'}`,
      availability: availability,
      user: userId
    });

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// POST /calendar/suggest-times - Suggest available time slots
router.post('/suggest-times', async (req: AuthenticatedRequest, res) => {
  try {
    const { duration, date, workingHours, maxSuggestions } = req.body;

    if (!duration || !date) {
      return res.status(400).json({ error: 'duration (minutes) and date (YYYY-MM-DD) are required' });
    }

    console.log(`🎯 Suggesting time slots: ${duration} minutes on ${date}`);

    const calendarService = serviceContainer.get('calendarService');

    const suggestions = await calendarService.suggestTimeSlots(
      duration,
      date,
      workingHours || { start: '09:00', end: '17:00' },
      maxSuggestions || 3
    );

    res.json({
      message: `Generated ${suggestions.length} time slot suggestions`,
      suggestions: suggestions,
      requestedDuration: duration,
      requestedDate: date
    });

  } catch (error) {
    console.error('❌ Error suggesting time slots:', error);
    res.status(500).json({ error: 'Failed to suggest time slots' });
  }
});

// POST /calendar/create-event - Create calendar event
router.post('/create-event', async (req: AuthenticatedRequest, res) => {
  try {
    const { summary, description, start, end, attendees, location } = req.body;

    if (!summary || !start || !end) {
      return res.status(400).json({ error: 'summary, start, and end are required' });
    }

    const event = {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: attendees?.map((email: string) => ({ email })),
      location
    };

    console.log(`📅 Creating calendar event: ${summary}`);

    const calendarService = serviceContainer.get('calendarService');
    const calendarModel = serviceContainer.get('calendarModel');

    const createdEvent = await calendarService.createCalendarEvent(event);

    // Save to database
    await calendarModel.saveCalendarEvent(createdEvent);

    res.json({
      message: 'Calendar event created successfully',
      event: createdEvent
    });

  } catch (error) {
    console.error('❌ Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// GET /calendar/preferences - Get calendar preferences
router.get('/preferences', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('⚙️ Fetching calendar preferences...');

    const calendarModel = serviceContainer.get('calendarModel');
    const preferences = await calendarModel.getUserPreferences();

    res.json({
      message: `Retrieved ${preferences.length} calendar preferences`,
      preferences: preferences
    });

  } catch (error) {
    console.error('❌ Error fetching calendar preferences:', error);
    res.status(500).json({ error: 'Failed to fetch calendar preferences' });
  }
});

// POST /calendar/preferences - Update calendar preference
router.post('/preferences', async (req: AuthenticatedRequest, res) => {
  try {
    const { preferenceType, preferenceValue } = req.body;

    if (!preferenceType || !preferenceValue) {
      return res.status(400).json({ error: 'preferenceType and preferenceValue are required' });
    }

    console.log(`⚙️ Updating calendar preference: ${preferenceType}`);

    const calendarModel = serviceContainer.get('calendarModel');
    await calendarModel.updateUserPreference(preferenceType, preferenceValue);

    res.json({
      message: `Updated calendar preference: ${preferenceType}`,
      preferenceType: preferenceType,
      preferenceValue: preferenceValue
    });

  } catch (error) {
    console.error('❌ Error updating calendar preference:', error);
    res.status(500).json({ error: 'Failed to update calendar preference' });
  }
});

// GET /calendar/stats - Get calendar analytics
router.get('/stats', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📊 Fetching calendar statistics...');

    const calendarModel = serviceContainer.get('calendarModel');
    const stats = await calendarModel.getCalendarStats();

    res.json({
      message: 'Calendar statistics retrieved',
      stats: stats
    });

  } catch (error) {
    console.error('❌ Error fetching calendar stats:', error);
    res.status(500).json({ error: 'Failed to fetch calendar stats' });
  }
});

// GET /calendar/health - Calendar health check
router.get('/health', async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🏥 Running calendar health check...');

    const calendarService = serviceContainer.get('calendarService');
    const calendarModel = serviceContainer.get('calendarModel');

    const [serviceHealth, modelHealth] = await Promise.all([
      calendarService.checkCalendarHealth(),
      calendarModel.calendarHealthCheck()
    ]);

    res.json({
      message: 'Calendar health check completed',
      service: serviceHealth,
      database: modelHealth
    });

  } catch (error) {
    console.error('❌ Calendar health check failed:', error);
    res.status(500).json({ error: 'Calendar health check failed' });
  }
});

export default router;