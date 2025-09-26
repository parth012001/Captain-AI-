import { ParsedEmail } from '../types';
import { MeetingRequest } from './meetingDetection';
import { CalendarService, AvailabilityCheck } from './calendar';
import { GmailService } from './gmail';
import { SmartAvailabilityService } from './smartAvailability';
import { pool } from '../database/connection';
import { safeParseDate, safeParseDateWithValidation } from '../utils/dateParser';

export interface MeetingTimeSlot {
  start: string;
  end: string;
  formatted: string;
  confidence: number;
}

export interface MeetingResponseContext {
  senderRelationship: 'stranger' | 'new_contact' | 'known_contact';
  isAvailable: boolean;
  suggestedTimes?: MeetingTimeSlot[];
  userTone: 'professional' | 'casual' | 'friendly';
  meetingType: string;
  urgencyLevel: string;
}

export interface MeetingResponse {
  shouldRespond: boolean;
  responseText: string;
  actionTaken: 'accepted' | 'declined' | 'suggested_alternatives' | 'requested_more_info';
  calendarEventCreated?: boolean;
  calendarEventId?: string | null;
  confidenceScore: number;
  bookingDetails?: {
    autoBooked: boolean;
    eventId: string | null;
    eventStatus: 'tentative' | 'confirmed' | 'not_created';
    timeSlot: string;
    duration: number;
    attendeeEmail: string;
  };
}

export class MeetingResponseGeneratorService {
  private calendarService: CalendarService;
  private gmailService: GmailService;
  private smartAvailabilityService: SmartAvailabilityService;

  constructor() {
    this.calendarService = new CalendarService();
    this.gmailService = new GmailService();
    this.smartAvailabilityService = new SmartAvailabilityService(this.calendarService);
  }

  /**
   * Generate an intelligent response to a meeting request
   */
  async generateMeetingResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    userId: string,
    testMode: boolean = false
  ): Promise<MeetingResponse> {
    try {
      console.log(`🤖 [RESPONSE GENERATOR] Generating response for meeting: ${meetingRequest.subject}`);

      if (testMode) {
        // Simulate response generation in test mode without requiring OAuth
        return this.generateMockResponse(email, meetingRequest, userId);
      }

      // Initialize services for the user
      await this.initializeServicesForUser(userId);

      // Build response context
      const context = await this.buildResponseContext(email, meetingRequest, userId);
      console.log(`📊 Response context: ${context.senderRelationship} relationship, ${context.isAvailable ? 'available' : 'conflicts found'}`);

      // Generate appropriate response
      const response = await this.generateResponse(email, meetingRequest, context, userId);
      
      console.log(`✅ [RESPONSE GENERATOR] Response generated: ${response.actionTaken} (confidence: ${response.confidenceScore}%)`);
      return response;

    } catch (error) {
      console.error('❌ [RESPONSE GENERATOR] Error generating response:', error);
      return {
        shouldRespond: false,
        responseText: '',
        actionTaken: 'requested_more_info',
        confidenceScore: 0
      };
    }
  }

  /**
   * Generate mock response for testing without OAuth tokens
   */
  private async generateMockResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    userId: string
  ): Promise<MeetingResponse> {
    console.log(`🎭 [TEST MODE] Generating mock response for: ${meetingRequest.subject}`);
    
    // Simulate different response types based on meeting content
    const emailBody = email.body.toLowerCase();
    const hasSpecificTime = /\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/.test(emailBody);
    const isUrgent = meetingRequest.urgencyLevel === 'high' || emailBody.includes('urgent');
    const isFlexible = emailBody.includes('flexible') || emailBody.includes('when are you free');
    
    let actionTaken: 'accepted' | 'declined' | 'suggested_alternatives' | 'requested_more_info';
    let responseText: string;
    let confidenceScore: number;
    let shouldRespond = true;

    if (hasSpecificTime && !isUrgent) {
      // Accept meetings with specific times (simulate availability)
      actionTaken = 'accepted';
      confidenceScore = 90;
      responseText = `Hello,

That sounds great! I'm available at the time you suggested and look forward to our meeting.

Please let me know if you need me to send a calendar invite or if there are any location details to discuss.

Looking forward to speaking with you!`;
      
    } else if (hasSpecificTime && isUrgent) {
      // Suggest alternatives for urgent meetings with conflicts
      actionTaken = 'suggested_alternatives';
      confidenceScore = 85;
      responseText = `Hello,

Unfortunately, I have a conflict at the time you suggested. However, I'd be happy to meet at one of these alternative times:

1. Tomorrow at 10:00 AM EST
2. Tomorrow at 3:00 PM EST  
3. Friday at 2:00 PM EST

Please let me know which option works best for you.

Looking forward to speaking with you!`;
      
    } else if (isFlexible) {
      // Request more info for flexible meetings
      actionTaken = 'requested_more_info';
      confidenceScore = 80;
      responseText = `Hello,

I'd be happy to meet with you to discuss potential collaboration opportunities.

Could you please provide a few preferred time options? I'm generally available during business hours and can accommodate meetings of 45 minutes.

Looking forward to speaking with you!`;
      
    } else {
      // Default response for unclear meetings
      actionTaken = 'requested_more_info';
      confidenceScore = 75;
      responseText = `Hello,

I'd be happy to meet with you to discuss our meeting.

Could you please provide a few preferred time options? I'm generally available during business hours and can accommodate meetings of ${meetingRequest.requestedDuration || 60} minutes.

Looking forward to speaking with you!`;
    }

    const response: MeetingResponse = {
      shouldRespond,
      responseText,
      actionTaken,
      calendarEventCreated: actionTaken === 'accepted',
      confidenceScore
    };

    console.log(`🎭 [TEST MODE] Mock response: ${actionTaken} (confidence: ${confidenceScore}%)`);
    return response;
  }

  /**
   * Build comprehensive context for response generation
   */
  private async buildResponseContext(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    userId: string
  ): Promise<MeetingResponseContext> {
    try {
      // Get sender relationship context
      const senderHistory = await this.gmailService.getSenderRelationshipHistory(meetingRequest.senderEmail);
      
      // Get user communication tone from database
      const userTone = await this.getUserCommunicationTone(userId);
      
      // Check calendar availability and generate smart suggestions
      let isAvailable = true;
      let suggestedTimes: MeetingTimeSlot[] = [];
      
      const duration = meetingRequest.requestedDuration || 60;
      const preferredDate = meetingRequest.preferredDates?.[0];
      
      // Always generate smart time slot suggestions for 9-5 PST business days
      try {
        const smartSuggestions = await this.smartAvailabilityService.generateTimeSlotSuggestions(
          {
            duration: duration,
            preferredDate: preferredDate,
            maxSuggestions: 3,
            excludeWeekends: true
          },
          userId
        );
        
        // Convert smart suggestions to our format
        suggestedTimes = smartSuggestions.map(slot => ({
          start: slot.start,
          end: slot.end,
          formatted: this.smartAvailabilityService.formatTimeSlot(slot),
          confidence: slot.confidence,
          reason: slot.reason
        }));
        
        // Check if the preferred time is available (with robust date parsing)
        if (preferredDate) {
          const dateParseResult = safeParseDateWithValidation(preferredDate);
          if (dateParseResult.isValid && dateParseResult.date) {
            console.log(`📅 Parsed preferred date: ${preferredDate} → ${dateParseResult.date.toISOString()} (confidence: ${dateParseResult.confidence}%)`);
            const endTime = new Date(dateParseResult.date.getTime() + (duration * 60 * 1000));
            const availability = await this.calendarService.checkAvailability(
              dateParseResult.date.toISOString(),
              endTime.toISOString()
            );
            isAvailable = availability.isAvailable;
          } else {
            console.warn(`⚠️ [DATE PARSING] Could not parse preferred date: "${preferredDate}" - ${dateParseResult.errorMessage}`);
            isAvailable = false; // Treat unparseable dates as unavailable
          }
        }
        
        console.log(`📅 Generated ${suggestedTimes.length} smart time slot suggestions`);
        
      } catch (error) {
        console.error('❌ Error generating smart availability suggestions:', error);
        // Fallback to basic availability check (with robust date parsing)
        if (preferredDate) {
          const dateParseResult = safeParseDateWithValidation(preferredDate);
          if (dateParseResult.isValid && dateParseResult.date) {
            console.log(`📅 [FALLBACK] Parsed preferred date: ${preferredDate} → ${dateParseResult.date.toISOString()}`);
            const endTime = new Date(dateParseResult.date.getTime() + (duration * 60 * 1000));
            const availability = await this.calendarService.checkAvailability(
              dateParseResult.date.toISOString(),
              endTime.toISOString()
            );
            isAvailable = availability.isAvailable;
          } else {
            console.warn(`⚠️ [FALLBACK DATE PARSING] Could not parse preferred date: "${preferredDate}" - ${dateParseResult.errorMessage}`);
            isAvailable = false; // Treat unparseable dates as unavailable
          }
        }
      }

      return {
        senderRelationship: senderHistory.classification,
        isAvailable,
        suggestedTimes,
        userTone,
        meetingType: meetingRequest.meetingType,
        urgencyLevel: meetingRequest.urgencyLevel
      };

    } catch (error) {
      console.error('❌ Error building response context:', error);
      // Return default context on error
      return {
        senderRelationship: 'new_contact',
        isAvailable: false,
        userTone: 'professional',
        meetingType: meetingRequest.meetingType,
        urgencyLevel: meetingRequest.urgencyLevel
      };
    }
  }

  /**
   * Generate appropriate response based on context
   */
  private async generateResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext,
    userId: string
  ): Promise<MeetingResponse> {
    try {
      if (context.isAvailable && meetingRequest.preferredDates && meetingRequest.preferredDates.length > 0) {
        // Accept the meeting
        return await this.generateAcceptanceResponse(email, meetingRequest, context, userId);
      } else if (context.suggestedTimes && context.suggestedTimes.length > 0) {
        // Suggest alternative times
        return await this.generateAlternativeTimesResponse(email, meetingRequest, context);
      } else {
        // Request more information
        return await this.generateMoreInfoResponse(email, meetingRequest, context);
      }
    } catch (error) {
      console.error('❌ Error generating response:', error);
      return {
        shouldRespond: false,
        responseText: '',
        actionTaken: 'requested_more_info',
        confidenceScore: 0
      };
    }
  }

  /**
   * Generate acceptance response and create calendar event
   */
  private async generateAcceptanceResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext,
    userId: string
  ): Promise<MeetingResponse> {
    try {
      const requestedTime = meetingRequest.preferredDates![0];
      const duration = meetingRequest.requestedDuration || 60;
      
      // Robust date parsing for meeting acceptance
      const dateParseResult = safeParseDateWithValidation(requestedTime);
      if (!dateParseResult.isValid || !dateParseResult.date) {
        throw new Error(`Cannot accept meeting - invalid date: "${requestedTime}" - ${dateParseResult.errorMessage}`);
      }
      
      const requestedDate = dateParseResult.date;
      const endTime = new Date(requestedDate.getTime() + (duration * 60 * 1000));

      // Format time for response
      const timeFormatted = this.formatDateTime(requestedDate);
      
      // Generate personalized response text
      const responseText = this.generateAcceptanceText(meetingRequest, context, timeFormatted);

      // NEW: AUTO-BOOK CALENDAR EVENT (but don't send email yet - user approval required)
      let calendarEventId: string | null = null;
      let calendarEventCreated = false;
      
      try {
        console.log(`📅 [AUTO-BOOKING] Creating calendar event for available time slot...`);
        
        const calendarEvent = await this.calendarService.createCalendarEvent({
          summary: `Meeting with ${meetingRequest.senderEmail.split('@')[0]}`,
          description: `Meeting requested via email: "${email.subject}"\n\nFrom: ${email.from}\nRequested: ${timeFormatted}\nDuration: ${duration} minutes`,
          start: {
            dateTime: requestedDate.toISOString(),
            timeZone: 'America/Los_Angeles' // You can make this configurable
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: 'America/Los_Angeles'
          },
          attendees: [
            {
              email: meetingRequest.senderEmail,
              responseStatus: 'needsAction'
            }
          ],
          // Set event as tentative until user sends confirmation email
          status: 'tentative'
        });
        
        calendarEventId = calendarEvent.id || null;
        calendarEventCreated = true;
        
        console.log(`✅ [AUTO-BOOKING] Calendar event created successfully: ${calendarEventId}`);
        console.log(`📋 [AUTO-BOOKING] Event details: ${timeFormatted} with ${meetingRequest.senderEmail}`);
        console.log(`⏳ [AUTO-BOOKING] Event status: TENTATIVE (will be confirmed when user sends email)`);
        
      } catch (calendarError) {
        console.error(`❌ [AUTO-BOOKING] Failed to create calendar event:`, calendarError);
        
        // Don't fail the whole response if calendar booking fails
        // User can still approve the draft and we'll handle booking later
        console.log(`⚠️ [AUTO-BOOKING] Continuing with draft creation despite calendar error`);
      }

      return {
        shouldRespond: true,
        responseText,
        actionTaken: 'accepted',
        calendarEventCreated,
        calendarEventId,
        confidenceScore: 95,
        // NEW: Include booking status information for frontend
        bookingDetails: {
          autoBooked: calendarEventCreated,
          eventId: calendarEventId,
          eventStatus: calendarEventCreated ? 'tentative' : 'not_created',
          timeSlot: timeFormatted,
          duration: duration,
          attendeeEmail: meetingRequest.senderEmail
        }
      };

    } catch (error) {
      console.error('❌ Error generating acceptance response:', error);
      throw error;
    }
  }

  /**
   * Generate alternative times response
   */
  private async generateAlternativeTimesResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext
  ): Promise<MeetingResponse> {
    const responseText = this.generateAlternativeTimesText(meetingRequest, context);

    return {
      shouldRespond: true,
      responseText,
      actionTaken: 'suggested_alternatives',
      calendarEventCreated: false,
      confidenceScore: 85
    };
  }

  /**
   * Generate more info request response
   */
  private async generateMoreInfoResponse(
    email: ParsedEmail,
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext
  ): Promise<MeetingResponse> {
    const responseText = this.generateMoreInfoText(meetingRequest, context);

    return {
      shouldRespond: true,
      responseText,
      actionTaken: 'requested_more_info',
      calendarEventCreated: false,
      confidenceScore: 75
    };
  }

  /**
   * Generate alternative time slots
   */
  private async generateAlternativeTimes(
    originalTime: string,
    duration: number
  ): Promise<MeetingTimeSlot[]> {
    try {
      // Robust date parsing for alternative time generation
      const dateParseResult = safeParseDateWithValidation(originalTime);
      if (!dateParseResult.isValid || !dateParseResult.date) {
        console.warn(`⚠️ Cannot generate alternatives for invalid date: "${originalTime}" - ${dateParseResult.errorMessage}`);
        return []; // Return empty array if date is invalid
      }
      
      const originalDate = dateParseResult.date;
      const dateStr = originalDate.toISOString().split('T')[0];
      
      // Get suggestions for the same day first
      const suggestions = await this.calendarService.suggestTimeSlots(duration, dateStr);
      
      return suggestions.slice(0, 3).map(suggestion => ({
        start: suggestion.start,
        end: suggestion.end,
        formatted: this.formatDateTime(safeParseDate(suggestion.start) || new Date()),
        confidence: suggestion.confidence
      }));

    } catch (error) {
      console.error('❌ Error generating alternative times:', error);
      return [];
    }
  }

  /**
   * Generate acceptance response text based on context
   */
  private generateAcceptanceText(
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext,
    timeFormatted: string
  ): string {
    const greeting = this.getGreeting(context.senderRelationship, context.userTone);
    const confirmation = this.getConfirmation(context.userTone, timeFormatted);
    const closing = this.getClosing(context.userTone);

    // Include smart time suggestions even for acceptance
    let timeSuggestions = '';
    if (context.suggestedTimes && context.suggestedTimes.length > 0) {
      timeSuggestions = `

I also have these additional time slots available if you prefer:
${context.suggestedTimes.map((time, index) => `${index + 1}. ${time.formatted}`).join('\n')}`;
    }

    return `${greeting}

${confirmation}${timeSuggestions}

${meetingRequest.locationPreference ? `I'll meet you at ${meetingRequest.locationPreference}.` : 'Please let me know if you need me to send a calendar invite or if there are any location details to discuss.'}

${closing}`;
  }

  /**
   * Generate alternative times response text
   */
  private generateAlternativeTimesText(
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext
  ): string {
    const greeting = this.getGreeting(context.senderRelationship, context.userTone);
    const alternatives = context.suggestedTimes!
      .map((time, index) => `${index + 1}. ${time.formatted}`)
      .join('\n');
    const closing = this.getClosing(context.userTone);

    return `${greeting}

Unfortunately, I have a conflict at the time you suggested. However, I'd be happy to meet at one of these alternative times during my business hours (9 AM - 5 PM PST, Monday-Friday):

${alternatives}

Please let me know which option works best for you, and I'll send over a calendar invite.

${closing}`;
  }

  /**
   * Generate more info request text
   */
  private generateMoreInfoText(
    meetingRequest: MeetingRequest,
    context: MeetingResponseContext
  ): string {
    const greeting = this.getGreeting(context.senderRelationship, context.userTone);
    const closing = this.getClosing(context.userTone);

    return `${greeting}

I'd be happy to meet with you to discuss ${(meetingRequest.subject || 'our meeting').toLowerCase().replace(/^(re:|fwd:|meeting request:?)/i, '').trim()}.

Could you please provide a few preferred time options? I'm generally available during business hours and can accommodate meetings of ${meetingRequest.requestedDuration || 60} minutes.

${closing}`;
  }

  /**
   * Get appropriate greeting based on relationship and tone
   */
  private getGreeting(relationship: string, tone: string): string {
    if (tone === 'casual') {
      return relationship === 'known_contact' ? 'Hi!' : 'Hello!';
    } else if (tone === 'friendly') {
      return relationship === 'known_contact' ? 'Hi there!' : 'Hello!';
    } else {
      return 'Hello,';
    }
  }

  /**
   * Get confirmation text based on tone
   */
  private getConfirmation(tone: string, timeFormatted: string): string {
    if (tone === 'casual') {
      return `Perfect! I'm available at ${timeFormatted} and would love to meet.`;
    } else if (tone === 'friendly') {
      return `That sounds great! I'm available at ${timeFormatted} and look forward to our meeting.`;
    } else {
      return `Thank you for reaching out. I confirm my availability for ${timeFormatted}.`;
    }
  }

  /**
   * Get appropriate closing based on tone
   */
  private getClosing(tone: string): string {
    if (tone === 'casual') {
      return 'Looking forward to it!';
    } else if (tone === 'friendly') {
      return 'Looking forward to speaking with you!';
    } else {
      return 'Best regards';
    }
  }

  /**
   * Format datetime for human-readable display
   */
  private formatDateTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Get user communication tone from database or infer from past emails
   */
  private async getUserCommunicationTone(userId: string): Promise<'professional' | 'casual' | 'friendly'> {
    try {
      // Check if we have tone analysis results from learning insights for this specific user
      const result = await pool.query(`
        SELECT pattern_value, recommendation 
        FROM learning_insights 
        WHERE pattern_type = 'tone' 
        AND user_id = $1
        AND confidence > 60
        ORDER BY success_rate DESC, created_at DESC 
        LIMIT 1
      `, [userId]);

      if (result.rows.length > 0) {
        const toneData = result.rows[0];
        const patternValue = toneData.pattern_value?.toLowerCase() || '';
        const recommendation = toneData.recommendation?.toLowerCase() || '';
        
        // Parse tone analysis and return dominant tone
        if (patternValue.includes('casual') || recommendation.includes('casual')) return 'casual';
        if (patternValue.includes('friendly') || recommendation.includes('friendly')) return 'friendly';
        if (patternValue.includes('professional') || recommendation.includes('professional')) return 'professional';
      }

      // Default to professional if no analysis available for this user
      return 'professional';
    } catch (error) {
      console.error('❌ Error getting user tone:', error);
      return 'professional';
    }
  }

  /**
   * Initialize Gmail and Calendar services for user
   */
  private async initializeServicesForUser(userId: string): Promise<void> {
    try {
      // Initialize Gmail service first
      await this.gmailService.initializeForUser(userId);
      
      // Get user credentials for calendar service with proper validation
      const credentials = await this.gmailService.tokenStorageService.getDecryptedCredentials(userId);
      
      if (!credentials) {
        throw new Error(`No OAuth credentials found for user ${userId}. User needs to authenticate first.`);
      }
      
      if (!credentials.accessToken) {
        throw new Error(`No access token found for user ${userId}. User needs to re-authenticate.`);
      }
      
      // Check if tokens appear to be expired (basic validation)
      if (credentials.accessToken && this.isTokenLikelyExpired(credentials)) {
        console.log(`⚠️ OAuth tokens may be expired for user ${userId}, attempting refresh...`);
        
        try {
          // Attempt to refresh tokens using the calendar service
          await this.calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);
          
          // Test the connection to verify tokens work
          await this.testCalendarConnection();
          
        } catch (refreshError) {
          throw new Error(`OAuth tokens expired and refresh failed for user ${userId}. User needs to re-authenticate. Error: ${refreshError instanceof Error ? refreshError.message : 'Unknown refresh error'}`);
        }
      } else {
        // Tokens appear valid, set them up
        await this.calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);
        
        // Test the connection to make sure everything works
        try {
          await this.testCalendarConnection();
        } catch (connectionError) {
          throw new Error(`OAuth tokens invalid for user ${userId}. Calendar connection failed. User needs to re-authenticate. Error: ${connectionError instanceof Error ? connectionError.message : 'Connection test failed'}`);
        }
      }
      
      console.log(`✅ OAuth services initialized successfully for user ${userId}`);
      
    } catch (error) {
      console.error(`❌ Error initializing OAuth services for user ${userId}:`, error);
      
      // Provide helpful error messages for different OAuth failure scenarios
      if (error instanceof Error) {
        if (error.message.includes('No OAuth credentials')) {
          console.error('💡 Solution: User needs to go through OAuth flow first');
        } else if (error.message.includes('expired') || error.message.includes('invalid')) {
          console.error('💡 Solution: User needs to re-authenticate (tokens expired/invalid)');
        } else if (error.message.includes('refresh failed')) {
          console.error('💡 Solution: User needs to complete OAuth flow again');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Basic check to see if tokens might be expired based on timestamp
   */
  private isTokenLikelyExpired(credentials: any): boolean {
    try {
      // If we have an expiry date, check it
      if (credentials.expiry_date) {
        const now = Date.now();
        const expiry = typeof credentials.expiry_date === 'number' 
          ? credentials.expiry_date 
          : parseInt(credentials.expiry_date);
        
        // Consider tokens expired if they expire within the next 5 minutes
        return (expiry - now) < (5 * 60 * 1000);
      }
      
      // If no expiry info, assume tokens might need refresh if they're old
      // This is a heuristic - not perfect but better than no check
      return false;
    } catch {
      // If we can't determine expiry, assume they might be expired
      return true;
    }
  }
  
  /**
   * Test calendar connection to validate OAuth tokens
   */
  private async testCalendarConnection(): Promise<void> {
    try {
      // Simple test: try to check calendar health (minimal API call)
      await this.calendarService.checkCalendarHealth();
    } catch (error) {
      throw new Error(`Calendar connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Health check for response generator service
   */
  async healthCheck(): Promise<{
    status: string;
    calendarReady: boolean;
    gmailReady: boolean;
    responseCapacity: string;
  }> {
    try {
      // Test calendar service
      const calendarHealth = await this.calendarService.checkCalendarHealth();
      
      // Test database connection
      await pool.query('SELECT 1');
      
      return {
        status: 'healthy',
        calendarReady: calendarHealth.status === 'healthy',
        gmailReady: true, // Gmail is initialized per-user
        responseCapacity: 'ready'
      };
    } catch (error) {
      return {
        status: 'error',
        calendarReady: false,
        gmailReady: false,
        responseCapacity: 'limited'
      };
    }
  }
}