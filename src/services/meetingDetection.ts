import { AIService } from './ai';
import { ParsedEmail } from '../types';

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
        emailId: parseInt(email.id),
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
  private extractPreferredDates(text: string): string[] {
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

    // Convert relative dates to actual dates
    const convertedDates = dates.map(date => this.convertRelativeDate(date)).filter((date): date is string => date !== null);
    
    return [...new Set(convertedDates)]; // Remove duplicates
  }

  // Convert relative dates to actual ISO date strings
  private convertRelativeDate(dateStr: string): string | null {
    try {
      const now = new Date();
      const lowerDateStr = dateStr.toLowerCase();

      if (lowerDateStr.includes('today')) {
        return now.toISOString();
      }
      
      if (lowerDateStr.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString();
      }
      
      if (lowerDateStr.includes('this week')) {
        // Find next business day this week
        const nextBusinessDay = this.getNextBusinessDay(now);
        return nextBusinessDay.toISOString();
      }
      
      if (lowerDateStr.includes('next week')) {
        // Find first business day of next week
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const firstBusinessDay = this.getNextBusinessDay(nextWeek);
        return firstBusinessDay.toISOString();
      }

      // Handle specific days of the week
      const dayMap: { [key: string]: number } = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 
        'friday': 5, 'saturday': 6, 'sunday': 0
      };

      for (const [dayName, dayNum] of Object.entries(dayMap)) {
        if (lowerDateStr.includes(dayName)) {
          const targetDate = this.getNextDayOfWeek(now, dayNum);
          return targetDate.toISOString();
        }
      }

      // Try to parse as regular date
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Failed to convert date: ${dateStr}`, error);
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