import { CalendarService } from './calendar';
import { GmailService } from './gmail';
import { SmartAvailabilityService } from './smartAvailability';
import { pool } from '../database/connection';

export interface MeetingConfirmation {
  id: string;
  draftId: string;
  meetingRequestId: number;
  userId: string;
  selectedTimeSlot?: {
    start: string;
    end: string;
    duration: number;
  };
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
  confirmedAt?: Date;
}

export interface CalendarEventCreation {
  summary: string;
  description: string;
  start: string;
  end: string;
  attendees: string[];
  location?: string;
}

export class MeetingConfirmationService {
  private calendarService: CalendarService;
  private gmailService: GmailService;
  private smartAvailabilityService: SmartAvailabilityService;

  constructor() {
    this.calendarService = new CalendarService();
    this.gmailService = new GmailService();
    this.smartAvailabilityService = new SmartAvailabilityService(this.calendarService);
  }

  /**
   * Create a meeting confirmation record when a draft is sent
   */
  async createMeetingConfirmation(
    draftId: string,
    meetingRequestId: number,
    userId: string,
    selectedTimeSlot?: {
      start: string;
      end: string;
      duration: number;
    }
  ): Promise<MeetingConfirmation> {
    try {
      const confirmationId = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const query = `
        INSERT INTO meeting_confirmations (
          id, draft_id, meeting_request_id, user_id, 
          selected_time_slot, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const result = await pool.query(query, [
        confirmationId,
        draftId,
        meetingRequestId,
        userId,
        selectedTimeSlot ? JSON.stringify(selectedTimeSlot) : null,
        'pending'
      ]);

      console.log(`📅 Created meeting confirmation: ${confirmationId}`);
      
      return {
        id: confirmationId,
        draftId,
        meetingRequestId,
        userId,
        selectedTimeSlot,
        status: 'pending',
        createdAt: new Date()
      };

    } catch (error) {
      console.error('❌ Error creating meeting confirmation:', error);
      throw error;
    }
  }

  /**
   * Confirm a meeting and create calendar event
   */
  async confirmMeeting(
    confirmationId: string,
    userId: string,
    selectedTimeSlot?: {
      start: string;
      end: string;
      duration: number;
    }
  ): Promise<{ success: boolean; calendarEventId?: string; error?: string }> {
    try {
      console.log(`📅 Confirming meeting: ${confirmationId}`);

      // Get confirmation details
      const confirmation = await this.getMeetingConfirmation(confirmationId, userId);
      if (!confirmation) {
        return { success: false, error: 'Meeting confirmation not found' };
      }

      if (confirmation.status !== 'pending') {
        return { success: false, error: 'Meeting already processed' };
      }

      // Get meeting request details
      const meetingRequest = await this.getMeetingRequest(confirmation.meetingRequestId);
      if (!meetingRequest) {
        return { success: false, error: 'Meeting request not found' };
      }

      // Initialize services for user
      await this.initializeServicesForUser(userId);

      // Use provided time slot or the one from confirmation
      const timeSlot = selectedTimeSlot || confirmation.selectedTimeSlot;
      if (!timeSlot) {
        return { success: false, error: 'No time slot selected' };
      }

      // Check availability one more time
      const availability = await this.calendarService.checkAvailability(
        timeSlot.start,
        timeSlot.end
      );

      if (!availability.isAvailable) {
        return { 
          success: false, 
          error: 'Time slot is no longer available. Please select a different time.' 
        };
      }

      // Create calendar event
      const calendarEvent = {
        summary: meetingRequest.subject || 'Meeting',
        description: `Meeting requested by ${meetingRequest.senderEmail}${meetingRequest.specialRequirements ? '\n\nSpecial Requirements: ' + meetingRequest.specialRequirements : ''}`,
        start: {
          dateTime: timeSlot.start,
          timeZone: 'America/Los_Angeles' // PST timezone
        },
        end: {
          dateTime: timeSlot.end,
          timeZone: 'America/Los_Angeles' // PST timezone
        },
        attendees: [
          meetingRequest.senderEmail,
          ...(meetingRequest.attendees || [])
        ].filter((email, index, arr) => arr.indexOf(email) === index), // Remove duplicates
        location: meetingRequest.locationPreference
      };

      const createdEvent = await this.calendarService.createCalendarEvent(calendarEvent);
      
      // Update confirmation status
      await this.updateConfirmationStatus(confirmationId, 'confirmed', createdEvent.id);
      
      // Update meeting request status
      await this.updateMeetingRequestStatus(confirmation.meetingRequestId, 'scheduled');

      console.log(`✅ Meeting confirmed and calendar event created: ${createdEvent.id}`);

      return { 
        success: true, 
        calendarEventId: createdEvent.id 
      };

    } catch (error) {
      console.error('❌ Error confirming meeting:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Cancel a meeting confirmation
   */
  async cancelMeetingConfirmation(
    confirmationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const confirmation = await this.getMeetingConfirmation(confirmationId, userId);
      if (!confirmation) {
        return { success: false, error: 'Meeting confirmation not found' };
      }

      await this.updateConfirmationStatus(confirmationId, 'cancelled');
      
      console.log(`❌ Meeting confirmation cancelled: ${confirmationId}`);
      
      return { success: true };

    } catch (error) {
      console.error('❌ Error cancelling meeting confirmation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Get meeting confirmation details
   */
  async getMeetingConfirmation(
    confirmationId: string,
    userId: string
  ): Promise<MeetingConfirmation | null> {
    try {
      const query = `
        SELECT * FROM meeting_confirmations 
        WHERE id = $1 AND user_id = $2
      `;

      const result = await pool.query(query, [confirmationId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        draftId: row.draft_id,
        meetingRequestId: row.meeting_request_id,
        userId: row.user_id,
        selectedTimeSlot: row.selected_time_slot ? JSON.parse(row.selected_time_slot) : undefined,
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at
      };

    } catch (error) {
      console.error('❌ Error getting meeting confirmation:', error);
      return null;
    }
  }

  /**
   * Get pending meeting confirmations for a user
   */
  async getPendingConfirmations(userId: string): Promise<MeetingConfirmation[]> {
    try {
      const query = `
        SELECT mc.*, mr.subject, mr.sender_email, mr.preferred_dates
        FROM meeting_confirmations mc
        JOIN meeting_requests mr ON mc.meeting_request_id = mr.id
        WHERE mc.user_id = $1 AND mc.status = 'pending'
        ORDER BY mc.created_at DESC
      `;

      const result = await pool.query(query, [userId]);
      
      return result.rows.map(row => ({
        id: row.id,
        draftId: row.draft_id,
        meetingRequestId: row.meeting_request_id,
        userId: row.user_id,
        selectedTimeSlot: row.selected_time_slot ? JSON.parse(row.selected_time_slot) : undefined,
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at
      }));

    } catch (error) {
      console.error('❌ Error getting pending confirmations:', error);
      return [];
    }
  }

  /**
   * Get alternative time suggestions for a meeting
   */
  async getAlternativeTimeSuggestions(
    meetingRequestId: number,
    userId: string,
    duration: number = 60
  ): Promise<Array<{ start: string; end: string; formatted: string; confidence: number; reason: string }>> {
    try {
      const meetingRequest = await this.getMeetingRequest(meetingRequestId);
      if (!meetingRequest) {
        return [];
      }

      await this.initializeServicesForUser(userId);

      const suggestions = await this.smartAvailabilityService.generateTimeSlotSuggestions(
        {
          duration: duration,
          preferredDate: meetingRequest.preferredDates?.[0],
          maxSuggestions: 5,
          excludeWeekends: true
        },
        userId
      );

      return suggestions.map(slot => ({
        start: slot.start,
        end: slot.end,
        formatted: this.smartAvailabilityService.formatTimeSlot(slot),
        confidence: slot.confidence,
        reason: slot.reason
      }));

    } catch (error) {
      console.error('❌ Error getting alternative time suggestions:', error);
      return [];
    }
  }

  /**
   * Initialize services for user
   */
  private async initializeServicesForUser(userId: string): Promise<void> {
    try {
      await this.gmailService.initializeForUser(userId);
      
      const credentials = await this.gmailService.tokenStorageService.getDecryptedCredentials(userId);
      if (credentials) {
        await this.calendarService.setStoredTokens(credentials.accessToken, credentials.refreshToken);
      }
    } catch (error) {
      console.error('❌ Error initializing services for user:', error);
      throw error;
    }
  }

  /**
   * Get meeting request details
   */
  private async getMeetingRequest(meetingRequestId: number): Promise<any> {
    try {
      const query = `
        SELECT * FROM meeting_requests WHERE id = $1
      `;

      const result = await pool.query(query, [meetingRequestId]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('❌ Error getting meeting request:', error);
      return null;
    }
  }

  /**
   * Update confirmation status
   */
  private async updateConfirmationStatus(
    confirmationId: string,
    status: 'pending' | 'confirmed' | 'cancelled',
    calendarEventId?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE meeting_confirmations 
        SET status = $1, confirmed_at = $2, calendar_event_id = $3
        WHERE id = $4
      `;

      await pool.query(query, [
        status,
        status === 'confirmed' ? new Date() : null,
        calendarEventId || null,
        confirmationId
      ]);

    } catch (error) {
      console.error('❌ Error updating confirmation status:', error);
      throw error;
    }
  }

  /**
   * Update meeting request status
   */
  private async updateMeetingRequestStatus(
    meetingRequestId: number,
    status: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE meeting_requests 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `;

      await pool.query(query, [status, meetingRequestId]);

    } catch (error) {
      console.error('❌ Error updating meeting request status:', error);
      throw error;
    }
  }
}
