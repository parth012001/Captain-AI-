import { AIService } from './ai';
import { ParsedEmail } from '../types';
import { safeParseDate } from '../utils/dateParser';

export interface MeetingRequest {
  emailId?: number;
  senderEmail: string;
  subject?: string;
  meetingType: 'urgent' | 'regular' | 'flexible' | 'recurring';
  requestedDuration?: number; // minutes
  preferredDates?: string[];
  attendees?: string[];
  locationPreference?: string;
  specialRequirements?: string;
  urgencyLevel: 'high' | 'medium' | 'low';
  detectionConfidence: number;
  status: 'pending' | 'scheduled' | 'declined' | 'cancelled';
}
// Meeting intent
interface MeetingIntent {
  isMeetingRequest: boolean;
  confidence: number;
  reasons: string[];
  extractedDetails: {
    duration?: string;
    timeFrame?: string;
    purpose?: string;
    attendees?: string[];
    location?: string;
  };
}

export class MeetingDetectionService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  // Main detection method - analyzes if email contains a meeting request
  async detectMeetingRequest(email: ParsedEmail): Promise<MeetingRequest | null> {
    try {
      console.log(`🔍 Analyzing email for meeting request: "${email.subject}"`);
      
      // Quick keyword filtering to avoid unnecessary AI calls
      if (!this.hasSchedulingKeywords(email.body)) {
        console.log('❌ No scheduling keywords found');
        return null;
      }

      // AI-powered meeting intent analysis
      const intent = await this.analyzeMeetingIntent(email.body);
      
      if (!intent.isMeetingRequest || intent.confidence < 0.6) {
        console.log(`❌ Not a meeting request (confidence: ${intent.confidence})`);
        return null;
      }

      console.log(`✅ Meeting request detected (confidence: ${intent.confidence})`);
      
      // Extract detailed meeting information
      const meetingDetails = await this.extractMeetingDetails(email.body, intent);
      
      const meetingRequest: MeetingRequest = {
        // emailId removed - Gmail IDs are strings, not integers
        // This field is optional and will be set by the pipeline if needed
        senderEmail: email.from,
        subject: email.subject,
        meetingType: this.determineMeetingType(intent),
        requestedDuration: meetingDetails.duration,
        preferredDates: meetingDetails.preferredDates,
        attendees: meetingDetails.attendees,
        locationPreference: meetingDetails.location,
        specialRequirements: meetingDetails.specialRequirements,
        urgencyLevel: this.determineUrgencyLevel(email.body, email.subject || ''),
        detectionConfidence: Math.round(intent.confidence * 100),
        status: 'pending'
      };

      console.log(`📋 Meeting request details extracted:`, {
        type: meetingRequest.meetingType,
        duration: meetingRequest.requestedDuration,
        urgency: meetingRequest.urgencyLevel,
        confidence: meetingRequest.detectionConfidence
      });

      return meetingRequest;

    } catch (error) {
      console.error('❌ Error detecting meeting request:', error);
      return null;
    }
  }

  // Quick keyword filtering to avoid expensive AI calls
  private hasSchedulingKeywords(body: string): boolean {
    const schedulingKeywords = [
      // Meeting words
      'meeting', 'meet', 'call', 'chat', 'discussion', 'sync', 'catch up',
      'conference', 'zoom', 'teams', 'hangout', 'video call', 'phone call',
      
      // Time-related
      'schedule', 'available', 'availability', 'calendar', 'time', 'when',
      'tomorrow', 'next week', 'this week', 'monday', 'tuesday', 'wednesday',
      'thursday', 'friday', 'weekend', 'morning', 'afternoon', 'evening',
      
      // Questions/requests
      'would you be', 'are you free', 'can we', 'let\'s', 'shall we',
      'could you', 'would like to', 'want to meet', 'free to chat',
      
      // Calendar-specific
      'book', 'slot', 'appointment', 'invite', 'reschedule', 'calendly'
    ];

    const bodyLower = body.toLowerCase();
    return schedulingKeywords.some(keyword => bodyLower.includes(keyword));
  }

  // AI-powered analysis to determine if email is actually a meeting request
  private async analyzeMeetingIntent(emailBody: string): Promise<MeetingIntent> {
    const prompt = `
Analyze this email to determine if it's a meeting request. Look for:
- Explicit requests to schedule/meet/call
- Questions about availability 
- Suggestions for meeting times
- Meeting purpose or agenda mentions

Be careful to distinguish:
- MEETING REQUESTS (asking to schedule) vs MEETING CONFIRMATIONS (already scheduled)
- MEETING REQUESTS vs MEETING CANCELLATIONS/RESCHEDULES
- GENUINE REQUESTS vs AUTOMATED NOTIFICATIONS

Email content:
"""
${emailBody.substring(0, 1500)}
"""

Respond with JSON:
{
  "isMeetingRequest": boolean,
  "confidence": number (0.0-1.0),
  "reasons": ["reason1", "reason2"],
  "extractedDetails": {
    "duration": "extracted duration if mentioned",
    "timeFrame": "extracted time preferences",
    "purpose": "meeting purpose/agenda",
    "attendees": ["any mentioned attendees"],
    "location": "location preference if mentioned"
  }
}`;

    try {
      const response = await this.aiService.generateCompletion([{
        role: 'user',
        content: prompt
      }], {
        temperature: 0.1,
        maxTokens: 400
      });

      // Clean up markdown formatting if present
      const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      const analysis = JSON.parse(cleanResponse);
      return {
        isMeetingRequest: analysis.isMeetingRequest || false,
        confidence: analysis.confidence || 0,
        reasons: analysis.reasons || [],
        extractedDetails: analysis.extractedDetails || {}
      };

    } catch (error) {
      console.error('❌ Error analyzing meeting intent:', error);
      return {
        isMeetingRequest: false,
        confidence: 0,
        reasons: ['AI analysis failed'],
        extractedDetails: {}
      };
    }
  }

  // Extract structured meeting details from email body
  private async extractMeetingDetails(emailBody: string, intent: MeetingIntent): Promise<{
    duration?: number;
    preferredDates?: string[];
    attendees?: string[];
    location?: string;
    specialRequirements?: string;
  }> {
    try {
      // Parse duration from AI extraction or email body
      const duration = await this.parseDuration(
        intent.extractedDetails.duration || emailBody
      );

      // Extract dates/times mentioned
      const preferredDates = this.extractPreferredDates(
        intent.extractedDetails.timeFrame || emailBody
      );

      // Get attendees from intent or parse email
      const attendees = intent.extractedDetails.attendees || 
        this.extractAttendees(emailBody);

      // Location preference
      const location = intent.extractedDetails.location || 
        this.extractLocationPreference(emailBody);

      // Special requirements or notes
      const specialRequirements = this.extractSpecialRequirements(emailBody);

      return {
        duration,
        preferredDates,
        attendees,
        location,
        specialRequirements
      };

    } catch (error) {
      console.error('❌ Error extracting meeting details:', error);
      return {};
    }
  }

  // Parse meeting duration from text
  private async parseDuration(text: string): Promise<number | undefined> {
    const durationPatterns = [
      { pattern: /(\d+)\s*hour?s?/i, multiplier: 60 },
      { pattern: /(\d+)\s*min(?:ute)?s?/i, multiplier: 1 },
      { pattern: /(\d+)\s*hr?s?/i, multiplier: 60 },
      { pattern: /half\s*hour/i, value: 30 },
      { pattern: /quick\s*chat/i, value: 15 },
      { pattern: /brief\s*meeting/i, value: 30 },
      { pattern: /catch\s*up/i, value: 30 },
    ];

    for (const { pattern, multiplier, value } of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return value || (parseInt(match[1]) * (multiplier || 1));
      }
    }

    // Default meeting duration if not specified
    return 60;
  }

  // Extract preferred dates/times from email and convert to actual dates
  // ENHANCED: Now handles specific time ranges like "Monday 2-3 PM"
  private extractPreferredDates(text: string): string[] {
    console.log(`🕐 [TIME PARSING] Analyzing text for dates and times: "${text.substring(0, 100)}..."`);
    
    // Stage 1: Extract basic dates (keep your existing working system)
    const basicDates = this.extractBasicDatePatterns(text);
    console.log(`📅 [DATE EXTRACTION] Found basic dates:`, basicDates);
    
    // Stage 2: NEW - Enhance each date with specific time information if available
    const datesWithTimes = basicDates.map(date => {
      const timeInfo = this.extractTimeForDate(text, date);
      if (timeInfo) {
        console.log(`🕐 [TIME ENHANCEMENT] Enhanced "${date}" with time info: "${timeInfo}"`);
        return `${date} ${timeInfo}`;
      }
      return date;
    });
    
    // Stage 3: Also look for standalone time expressions that imply "today"
    const standaloneTimeExpressions = this.extractStandaloneTimeExpressions(text);
    if (standaloneTimeExpressions.length > 0) {
      console.log(`🕐 [STANDALONE TIME] Found standalone times:`, standaloneTimeExpressions);
      datesWithTimes.push(...standaloneTimeExpressions);
    }

    // Convert all enhanced dates to actual dates (your existing system)
    const convertedDates = datesWithTimes.map(date => this.convertRelativeDate(date)).filter((date): date is string => date !== null);
    
    console.log(`✅ [TIME PARSING] Final extracted dates:`, convertedDates);
    return [...new Set(convertedDates)]; // Remove duplicates
  }

  /**
   * Extract basic date patterns (your existing working logic, preserved)
   */
  private extractBasicDatePatterns(text: string): string[] {
    const datePatterns = [
      /next\s+week/i,
      /this\s+week/i,
      /tomorrow/i,
      /today/i,
      /monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi,
      /\d{1,2}\/\d{1,2}\/?\d{0,4}/g,
      /\d{1,2}-\d{1,2}-?\d{0,4}/g,
    ];

    const dates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches.map(match => match.toLowerCase()));
      }
    }

    return dates;
  }

  /**
   * Extract specific time information for a given date from context
   * NEW: Handles "Monday 2-3 PM", "at 2 PM", "from 10-11 AM" etc.
   */
  private extractTimeForDate(text: string, dateStr: string): string | null {
    const lowerText = text.toLowerCase();
    const lowerDate = dateStr.toLowerCase();
    
    // Find the position of the date in the text
    const dateIndex = lowerText.indexOf(lowerDate);
    if (dateIndex === -1) return null;
    
    // Look for time patterns around the date (before and after)
    const contextWindow = 50; // characters to search around the date
    const startPos = Math.max(0, dateIndex - contextWindow);
    const endPos = Math.min(lowerText.length, dateIndex + lowerDate.length + contextWindow);
    const contextText = lowerText.slice(startPos, endPos);
    
    // Time patterns to match
    const timePatterns = [
      // "from 2 to 3 PM", "from 10am to 11am"
      {
        pattern: /from\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        handler: (match: RegExpMatchArray) => {
          const startHour = parseInt(match[1]);
          const startMin = match[2] || '00';
          const startPeriod = match[3] || match[6] || 'am';
          const endHour = parseInt(match[4]);
          const endMin = match[5] || '00';
          const endPeriod = match[6] || startPeriod;
          
          return `${startHour}:${startMin}${startPeriod}-${endHour}:${endMin}${endPeriod}`;
        }
      },
      
      // "2-3 PM", "10-11 AM"  
      {
        pattern: /(\d{1,2})-(\d{1,2})\s*(am|pm)/i,
        handler: (match: RegExpMatchArray) => {
          const startHour = match[1];
          const endHour = match[2];
          const period = match[3];
          return `${startHour}:00${period}-${endHour}:00${period}`;
        }
      },
      
      // "at 2 PM", "at 10:30 AM"
      {
        pattern: /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        handler: (match: RegExpMatchArray) => {
          const hour = match[1];
          const minute = match[2] || '00';
          const period = match[3];
          
          // Default to 1-hour meeting
          const startTime = `${hour}:${minute}${period}`;
          const endHour = (parseInt(hour) + 1).toString();
          const endTime = `${endHour}:${minute}${period}`;
          
          return `${startTime}-${endTime}`;
        }
      },
      
      // "2 PM", "10:30 AM" (standalone)
      {
        pattern: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i,
        handler: (match: RegExpMatchArray) => {
          const hour = match[1];
          const minute = match[2] || '00';
          const period = match[3];
          
          // Default to 1-hour meeting
          const startTime = `${hour}:${minute}${period}`;
          const endHour = (parseInt(hour) + 1).toString();
          const endTime = `${endHour}:${minute}${period}`;
          
          return `${startTime}-${endTime}`;
        }
      }
    ];
    
    // Try each pattern
    for (const { pattern, handler } of timePatterns) {
      const match = contextText.match(pattern);
      if (match) {
        try {
          const timeResult = handler(match);
          console.log(`🕐 [TIME MATCH] Pattern "${pattern}" matched "${match[0]}" → "${timeResult}"`);
          return timeResult;
        } catch (error) {
          console.warn(`⚠️ [TIME PARSE] Error processing time pattern:`, error);
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract standalone time expressions that imply "today"
   * NEW: Handles "Can we meet at 2 PM?" (no date specified)
   */
  private extractStandaloneTimeExpressions(text: string): string[] {
    const lowerText = text.toLowerCase();
    const standaloneExpressions: string[] = [];
    
    // Look for time expressions that aren't near any date words
    const dateWords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 
                      'tomorrow', 'today', 'next week', 'this week'];
    
    const timePattern = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;
    let match;
    
    while ((match = timePattern.exec(lowerText)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      
      // Check if this time is near any date word (within 20 characters)
      const nearDate = dateWords.some(dateWord => {
        const dateIndex = lowerText.indexOf(dateWord);
        return dateIndex !== -1 && Math.abs(dateIndex - matchStart) < 20;
      });
      
      if (!nearDate) {
        // Standalone time - assume "today"
        const hour = match[1];
        const minute = match[2] || '00';
        const period = match[3];
        
        // Default to 1-hour meeting
        const startTime = `${hour}:${minute}${period}`;
        const endHour = (parseInt(hour) + 1).toString();
        const endTime = `${endHour}:${minute}${period}`;
        
        standaloneExpressions.push(`today ${startTime}-${endTime}`);
      }
    }
    
    return standaloneExpressions;
  }

  // Convert relative dates to actual ISO date strings
  // ENHANCED: Now handles time-enhanced date strings like "monday 2:00pm-3:00pm"
  private convertRelativeDate(dateStr: string): string | null {
    try {
      const now = new Date();
      const lowerDateStr = dateStr.toLowerCase();

      console.log(`🕐 [DATE CONVERT] Converting: "${dateStr}"`);

      // NEW: Extract time information if present
      const { dateOnly, timeRange } = this.separateDateAndTime(dateStr);
      console.log(`🕐 [DATE CONVERT] Separated - Date: "${dateOnly}", Time: "${timeRange}"`);

      // Get base date using your existing logic
      let baseDate: Date | null = null;

      if (lowerDateStr.includes('today')) {
        baseDate = new Date(now);
      }
      else if (lowerDateStr.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        baseDate = tomorrow;
      }
      else if (lowerDateStr.includes('this week')) {
        // Find next business day this week
        baseDate = this.getNextBusinessDay(now);
      }
      else if (lowerDateStr.includes('next week')) {
        // Find first business day of next week
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        baseDate = this.getNextBusinessDay(nextWeek);
      }

      else {
        // Handle specific days of the week
        const dayMap: { [key: string]: number } = {
          'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 
          'friday': 5, 'saturday': 6, 'sunday': 0
        };

        for (const [dayName, dayNum] of Object.entries(dayMap)) {
          if (lowerDateStr.includes(dayName)) {
            baseDate = this.getNextDayOfWeek(now, dayNum);
            break;
          }
        }

        // Try to parse as regular date using safe parser
        if (!baseDate) {
          const parsed = safeParseDate(dateOnly);
          if (parsed) {
            baseDate = parsed;
          }
        }
      }

      // If we couldn't determine a base date, return null
      if (!baseDate) {
        console.warn(`⚠️ [DATE CONVERT] Could not determine base date for: "${dateStr}"`);
        return null;
      }

      // NEW: Apply specific time if provided
      if (timeRange) {
        const dateWithTime = this.applyTimeToDate(baseDate, timeRange);
        if (dateWithTime) {
          console.log(`✅ [DATE CONVERT] Final result: "${dateWithTime.toISOString()}"`);
          return dateWithTime.toISOString();
        }
      }

      // Return base date if no specific time
      console.log(`✅ [DATE CONVERT] Base date result: "${baseDate.toISOString()}"`);
      return baseDate.toISOString();

    } catch (error) {
      console.warn(`⚠️ Failed to convert date: ${dateStr}`, error);
      return null;
    }
  }

  /**
   * Separate date and time components from enhanced date string
   * NEW: Handles "monday 2:00pm-3:00pm" → { dateOnly: "monday", timeRange: "2:00pm-3:00pm" }
   */
  private separateDateAndTime(dateStr: string): { dateOnly: string; timeRange: string | null } {
    const lowerDateStr = dateStr.toLowerCase();
    
    // Look for time pattern in the string
    const timePattern = /(\d{1,2}:\d{2}(am|pm)-\d{1,2}:\d{2}(am|pm))/i;
    const timeMatch = lowerDateStr.match(timePattern);
    
    if (timeMatch) {
      const timeRange = timeMatch[1];
      const dateOnly = lowerDateStr.replace(timeRange, '').trim();
      return { dateOnly, timeRange };
    }
    
    return { dateOnly: dateStr, timeRange: null };
  }

  /**
   * Apply specific time range to a base date
   * NEW: Converts "2:00pm-3:00pm" to actual start time on the given date
   */
  private applyTimeToDate(baseDate: Date, timeRange: string): Date | null {
    try {
      // Parse time range like "2:00pm-3:00pm"
      const timeRangePattern = /(\d{1,2}):(\d{2})(am|pm)-(\d{1,2}):(\d{2})(am|pm)/i;
      const match = timeRange.match(timeRangePattern);
      
      if (!match) {
        console.warn(`⚠️ [TIME APPLY] Could not parse time range: "${timeRange}"`);
        return null;
      }

      let startHour = parseInt(match[1]);
      const startMinute = parseInt(match[2]);
      const startPeriod = match[3].toLowerCase();

      // Convert to 24-hour format
      if (startPeriod === 'pm' && startHour !== 12) {
        startHour += 12;
      } else if (startPeriod === 'am' && startHour === 12) {
        startHour = 0;
      }

      // Create new date with specific time
      const dateWithTime = new Date(baseDate);
      dateWithTime.setHours(startHour, startMinute, 0, 0);

      console.log(`🕐 [TIME APPLY] Applied time "${timeRange}" to date: ${dateWithTime.toISOString()}`);
      return dateWithTime;

    } catch (error) {
      console.warn(`⚠️ [TIME APPLY] Error applying time: ${error}`);
      return null;
    }
  }

  // Get next business day (Monday-Friday)
  private getNextBusinessDay(startDate: Date): Date {
    const date = new Date(startDate);
    while (date.getDay() === 0 || date.getDay() === 6) { // Skip weekends
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  // Get next occurrence of a specific day of the week
  private getNextDayOfWeek(startDate: Date, targetDay: number): Date {
    const date = new Date(startDate);
    const currentDay = date.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    date.setDate(date.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return date;
  }

  // Extract attendees mentioned in email
  private extractAttendees(text: string): string[] {
    const attendeePatterns = [
      /with\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
      /include\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/gi,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
    ];

    const attendees: string[] = [];
    for (const pattern of attendeePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        attendees.push(...matches);
      }
    }

    return [...new Set(attendees)];
  }

  // Extract location preference
  private extractLocationPreference(text: string): string | undefined {
    const locationPatterns = [
      /zoom/i,
      /teams/i,
      /google\s*meet/i,
      /video\s*call/i,
      /phone\s*call/i,
      /in\s*person/i,
      /office/i,
      /remote/i,
      /virtual/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }

    return undefined;
  }

  // Extract any special requirements or notes
  private extractSpecialRequirements(text: string): string | undefined {
    const requirementPatterns = [
      /agenda:?\s*([^\n\r.]{10,100})/i,
      /discuss:?\s*([^\n\r.]{10,100})/i,
      /about:?\s*([^\n\r.]{10,100})/i,
      /regarding:?\s*([^\n\r.]{10,100})/i,
    ];

    for (const pattern of requirementPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  // Determine meeting type based on content
  private determineMeetingType(intent: MeetingIntent): 'urgent' | 'regular' | 'flexible' | 'recurring' {
    const content = (intent.extractedDetails.purpose || '').toLowerCase();
    
    if (content.includes('urgent') || content.includes('asap')) {
      return 'urgent';
    }
    
    if (content.includes('weekly') || content.includes('recurring') || 
        content.includes('regular')) {
      return 'recurring';
    }
    
    if (content.includes('flexible') || content.includes('whenever')) {
      return 'flexible';
    }
    
    return 'regular';
  }

  // Determine urgency level from email content
  private determineUrgencyLevel(body: string, subject: string): 'high' | 'medium' | 'low' {
    const content = `${subject} ${body}`.toLowerCase();
    
    const highUrgencyKeywords = [
      'urgent', 'asap', 'emergency', 'critical', 'immediately', 
      'today', 'deadline', 'time sensitive'
    ];
    
    const lowUrgencyKeywords = [
      'whenever', 'no rush', 'flexible', 'eventually', 'when you can',
      'no hurry', 'at your convenience'
    ];
    
    if (highUrgencyKeywords.some(keyword => content.includes(keyword))) {
      return 'high';
    }
    
    if (lowUrgencyKeywords.some(keyword => content.includes(keyword))) {
      return 'low';
    }
    
    return 'medium';
  }

  // Health check for meeting detection service
  async healthCheck(): Promise<{ status: string; processingCapacity: string }> {
    try {
      // Test AI service connectivity
      await this.aiService.generateCompletion([{
        role: 'user',
        content: 'Test'
      }], { maxTokens: 5 });
      
      return {
        status: 'healthy',
        processingCapacity: 'ready'
      };
    } catch (error) {
      return {
        status: 'error',
        processingCapacity: 'limited'
      };
    }
  }
}