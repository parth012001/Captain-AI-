import { pool } from '../database/connection';
import { CalendarService } from './calendar';
import { CalendarModel } from '../models/Calendar';
import { AIService } from './ai';
import { MeetingDetectionService, MeetingRequest } from './meetingDetection';
import { safeParseDate } from '../utils/dateParser';
import { CalendarEvent, TimeSlotSuggestion } from '../types';

export interface CalendarHold {
  id?: number;
  meetingRequestId: number;
  startTime: Date;
  endTime: Date;
  holderEmail: string;
  status: 'active' | 'confirmed' | 'expired' | 'cancelled';
  expiryTime: Date;
  notes?: string;
}

export interface SchedulingResponse {
  id?: number;
  meetingRequestId: number;
  recipientEmail: string;
  responseType: 'accept_time' | 'reject_time' | 'suggest_alternative' | 'decline_meeting';
  suggestedTimeStart?: Date;
  suggestedTimeEnd?: Date;
  responseConfidence: number;
  aiAnalysis?: any;
  emailContent: string;
}

export interface SchedulingWorkflow {
  id?: number;
  meetingRequestId: number;
  workflowType: 'direct_schedule' | 'negotiate_time' | 'multi_recipient' | 'recurring_setup';
  currentStep: string;
  totalSteps: number;
  stepNumber: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  context?: any;
  nextActionTime?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface AutoSchedulingPreference {
  id?: number;
  userEmail: string;
  preferenceType: string;
  preferenceValue: any;
  priority: number;
  isActive: boolean;
}

export class AutoSchedulingService {
  private calendarService: CalendarService;
  private calendarModel: CalendarModel;
  private aiService: AIService;

  constructor() {
    this.calendarService = new CalendarService();
    this.calendarModel = new CalendarModel();
    this.aiService = new AIService();
  }

  // Main entry point for auto-scheduling from meeting detection
  async processDetectedMeeting(meetingRequest: MeetingRequest): Promise<SchedulingWorkflow | null> {
    try {
      console.log(`🤖 Starting auto-scheduling for meeting request #${meetingRequest.emailId}`);

      // Create initial workflow
      const workflow = await this.createSchedulingWorkflow(meetingRequest);
      
      if (!workflow.id) {
        throw new Error('Failed to create scheduling workflow');
      }

      // Determine workflow type and execute
      switch (workflow.workflowType) {
        case 'direct_schedule':
          await this.executeDirectScheduleWorkflow(workflow, meetingRequest);
          break;
        case 'negotiate_time':
          await this.executeNegotiationWorkflow(workflow, meetingRequest);
          break;
        case 'multi_recipient':
          await this.executeMultiRecipientWorkflow(workflow, meetingRequest);
          break;
        default:
          console.log(`⚠️ Unknown workflow type: ${workflow.workflowType}`);
      }

      return workflow;

    } catch (error) {
      console.error('❌ Error in auto-scheduling:', error);
      return null;
    }
  }

  // Create calendar holds to prevent double-booking
  async createCalendarHold(
    meetingRequestId: number,
    startTime: Date,
    endTime: Date,
    holderEmail: string,
    durationMinutes = 1440,
    notes?: string
  ): Promise<CalendarHold | null> {
    try {
      // Check for conflicts
      const hasConflict = await this.checkSchedulingConflict(startTime, endTime);
      if (hasConflict) {
        console.log('⚠️ Scheduling conflict detected, cannot create hold');
        return null;
      }

      const expiryTime = new Date(Date.now() + durationMinutes * 60000);

      const query = `
        INSERT INTO calendar_holds (
          meeting_request_id, start_time, end_time, holder_email, 
          expiry_time, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING *
      `;

      const result = await pool.query(query, [
        meetingRequestId, startTime, endTime, holderEmail, expiryTime, notes
      ]);

      const hold: CalendarHold = {
        id: result.rows[0].id,
        meetingRequestId,
        startTime,
        endTime,
        holderEmail,
        status: 'active',
        expiryTime,
        notes
      };

      console.log(`🔒 Calendar hold created: ${startTime.toISOString()} - ${endTime.toISOString()}`);
      return hold;

    } catch (error) {
      console.error('❌ Error creating calendar hold:', error);
      return null;
    }
  }

  // Generate smart time suggestions based on availability and preferences
  async generateTimeSlotSuggestions(
    meetingRequest: MeetingRequest,
    recipientEmail?: string
  ): Promise<TimeSlotSuggestion[]> {
    try {
      console.log(`🎯 Generating time slot suggestions for ${meetingRequest.meetingType} meeting`);

      // Get user preferences
      const preferences = await this.getUserPreferences(recipientEmail || meetingRequest.senderEmail);
      const workingHours = preferences.find(p => p.preferenceType === 'working_hours')?.preferenceValue || 
        { start: '09:00', end: '17:00', days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] };

      // Determine suggested duration
      const duration = meetingRequest.requestedDuration || 60;

      // Get preferred dates from meeting request
      const preferredDates = meetingRequest.preferredDates || [];
      
      // If no preferred dates, suggest next 7 business days
      const suggestedDates = preferredDates.length > 0 
        ? preferredDates 
        : this.getNextBusinessDays(7);

      const timeSlots: TimeSlotSuggestion[] = [];

      for (const dateStr of suggestedDates) {
        const date = this.parsePreferredDate(dateStr);
        if (!date) continue;

        // Check availability for this date
        const daySlots = await this.calendarService.suggestTimeSlots(duration, date.toISOString());
        timeSlots.push(...daySlots);

        // Limit to top 5 suggestions
        if (timeSlots.length >= 5) break;
      }

      // Sort by confidence score and urgency
      const sortedSlots = timeSlots
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 3);

      console.log(`📅 Generated ${sortedSlots.length} time slot suggestions`);
      return sortedSlots;

    } catch (error) {
      console.error('❌ Error generating time slot suggestions:', error);
      return [];
    }
  }

  // Confirm and create actual calendar event
  async confirmScheduling(
    meetingRequestId: number, 
    selectedTimeSlot: TimeSlotSuggestion,
    additionalAttendees?: string[]
  ): Promise<CalendarEvent | null> {
    try {
      // Get meeting request details
      const meetingRequest = await this.getMeetingRequestById(meetingRequestId);
      if (!meetingRequest) {
        throw new Error('Meeting request not found');
      }

      // Create calendar event
      const calendarEvent: CalendarEvent = {
        summary: meetingRequest.subject || 'Meeting',
        description: `Meeting requested by ${meetingRequest.senderEmail}${meetingRequest.specialRequirements ? '\n\nSpecial Requirements: ' + meetingRequest.specialRequirements : ''}`,
        start: {
          dateTime: selectedTimeSlot.start,
        },
        end: {
          dateTime: selectedTimeSlot.end,
        },
        attendees: [
          meetingRequest.senderEmail,
          ...(meetingRequest.attendees || []),
          ...(additionalAttendees || [])
        ].filter((email, index, arr) => arr.indexOf(email) === index).map(email => ({ email })), // Remove duplicates and format properly
        location: meetingRequest.locationPreference
      };

      // Create the actual calendar event
      const createdEvent = await this.calendarService.createCalendarEvent(calendarEvent);

      // Update meeting request status
      await pool.query(
        'UPDATE meeting_requests SET status = $1 WHERE id = $2',
        ['scheduled', meetingRequestId]
      );

      // Update any active holds to confirmed
      await pool.query(`
        UPDATE calendar_holds 
        SET status = 'confirmed' 
        WHERE meeting_request_id = $1 AND status = 'active'
      `, [meetingRequestId]);

      // Mark workflow as completed
      await pool.query(`
        UPDATE scheduling_workflows 
        SET status = 'completed', current_step = 'event_created', updated_at = NOW()
        WHERE meeting_request_id = $1
      `, [meetingRequestId]);

      console.log(`✅ Meeting scheduled successfully: ${createdEvent.id}`);
      return createdEvent;

    } catch (error) {
      console.error('❌ Error confirming scheduling:', error);
      return null;
    }
  }

  // Execute direct scheduling workflow (high confidence, simple scheduling)
  private async executeDirectScheduleWorkflow(
    workflow: SchedulingWorkflow,
    meetingRequest: MeetingRequest
  ): Promise<void> {
    try {
      // Step 1: Generate time suggestions
      await this.updateWorkflowStep(workflow.id!, 'generating_suggestions', 1);
      const suggestions = await this.generateTimeSlotSuggestions(meetingRequest);
      
      if (suggestions.length === 0) {
        await this.failWorkflow(workflow.id!, 'No available time slots found');
        return;
      }

      // Step 2: Create calendar holds for top suggestions
      await this.updateWorkflowStep(workflow.id!, 'creating_holds', 2);
      const holds = [];
      for (const suggestion of suggestions.slice(0, 2)) {
        const hold = await this.createCalendarHold(
          meetingRequest.emailId!,
          new Date(suggestion.start),
          new Date(suggestion.end),
          meetingRequest.senderEmail,
          1440, // 24 hour hold
          `Auto-generated hold for ${meetingRequest.meetingType} meeting`
        );
        if (hold) holds.push(hold);
      }

      // Step 3: For high confidence requests, auto-confirm the best slot
      const autoConfirmThreshold = await this.getAutoConfirmThreshold(meetingRequest.senderEmail);
      if (meetingRequest.detectionConfidence >= (autoConfirmThreshold * 100) && 
          suggestions[0].confidence && suggestions[0].confidence >= 0.9) {
        
        await this.updateWorkflowStep(workflow.id!, 'auto_confirming', 3);
        await this.confirmScheduling(meetingRequest.emailId!, suggestions[0]);
      } else {
        // Step 3: Send suggested times for confirmation
        await this.updateWorkflowStep(workflow.id!, 'awaiting_confirmation', 3);
        // In a real implementation, this would send an email with suggested times
        console.log(`📧 Would send confirmation email with ${suggestions.length} time suggestions`);
      }

    } catch (error) {
      console.error('❌ Error in direct schedule workflow:', error);
      await this.failWorkflow(workflow.id!, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Execute negotiation workflow (lower confidence, requires back-and-forth)
  private async executeNegotiationWorkflow(
    workflow: SchedulingWorkflow,
    meetingRequest: MeetingRequest
  ): Promise<void> {
    try {
      // Step 1: Generate multiple time options
      await this.updateWorkflowStep(workflow.id!, 'generating_options', 1);
      const suggestions = await this.generateTimeSlotSuggestions(meetingRequest);
      
      // Step 2: Create holds for all suggestions
      await this.updateWorkflowStep(workflow.id!, 'creating_multiple_holds', 2);
      
      // Step 3: Send options for selection
      await this.updateWorkflowStep(workflow.id!, 'awaiting_selection', 3);
      console.log(`📧 Would send negotiation email with ${suggestions.length} time options`);

    } catch (error) {
      console.error('❌ Error in negotiation workflow:', error);
      await this.failWorkflow(workflow.id!, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Execute multi-recipient workflow (complex coordination)
  private async executeMultiRecipientWorkflow(
    workflow: SchedulingWorkflow,
    meetingRequest: MeetingRequest
  ): Promise<void> {
    try {
      // Step 1: Find common availability
      await this.updateWorkflowStep(workflow.id!, 'finding_common_availability', 1);
      
      // Step 2: Create coordinated holds
      await this.updateWorkflowStep(workflow.id!, 'coordinating_holds', 2);
      
      // Step 3: Send group coordination
      await this.updateWorkflowStep(workflow.id!, 'coordinating_group', 3);
      console.log(`📧 Would coordinate multi-recipient scheduling for ${meetingRequest.attendees?.length || 0} attendees`);

    } catch (error) {
      console.error('❌ Error in multi-recipient workflow:', error);
      await this.failWorkflow(workflow.id!, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Create scheduling workflow record
  private async createSchedulingWorkflow(meetingRequest: MeetingRequest): Promise<SchedulingWorkflow> {
    const workflowType = this.determineWorkflowType(meetingRequest);
    
    const query = `
      INSERT INTO scheduling_workflows (
        meeting_request_id, workflow_type, current_step, 
        total_steps, step_number, status, context
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING *
    `;

    const totalSteps = workflowType === 'multi_recipient' ? 5 : 3;
    const context = {
      urgencyLevel: meetingRequest.urgencyLevel,
      meetingType: meetingRequest.meetingType,
      attendeeCount: meetingRequest.attendees?.length || 1
    };

    const result = await pool.query(query, [
      meetingRequest.emailId,
      workflowType,
      'initializing',
      totalSteps,
      1,
      context
    ]);

    return {
      id: result.rows[0].id,
      meetingRequestId: meetingRequest.emailId!,
      workflowType,
      currentStep: 'initializing',
      totalSteps,
      stepNumber: 1,
      status: 'active',
      context,
      retryCount: 0,
      maxRetries: 3
    };
  }

  // Helper methods
  private determineWorkflowType(meetingRequest: MeetingRequest): SchedulingWorkflow['workflowType'] {
    if (meetingRequest.attendees && meetingRequest.attendees.length > 2) {
      return 'multi_recipient';
    }
    
    if (meetingRequest.urgencyLevel === 'high' && meetingRequest.detectionConfidence >= 85) {
      return 'direct_schedule';
    }
    
    return 'negotiate_time';
  }

  private async updateWorkflowStep(workflowId: number, step: string, stepNumber: number): Promise<void> {
    await pool.query(`
      UPDATE scheduling_workflows 
      SET current_step = $1, step_number = $2, updated_at = NOW()
      WHERE id = $3
    `, [step, stepNumber, workflowId]);
    
    console.log(`📋 Workflow ${workflowId}: Step ${stepNumber} - ${step}`);
  }

  private async failWorkflow(workflowId: number, reason: string): Promise<void> {
    await pool.query(`
      UPDATE scheduling_workflows 
      SET status = 'failed', current_step = $1, updated_at = NOW()
      WHERE id = $2
    `, [`failed: ${reason}`, workflowId]);
    
    console.log(`❌ Workflow ${workflowId} failed: ${reason}`);
  }

  private async checkSchedulingConflict(startTime: Date, endTime: Date): Promise<boolean> {
    const result = await pool.query(`
      SELECT check_scheduling_conflict($1, $2) as has_conflict
    `, [startTime, endTime]);
    
    return result.rows[0]?.has_conflict || false;
  }

  private async getUserPreferences(userEmail: string): Promise<AutoSchedulingPreference[]> {
    const result = await pool.query(`
      SELECT * FROM auto_scheduling_preferences 
      WHERE (user_email = $1 OR user_email = 'default') AND is_active = true
      ORDER BY user_email DESC, priority DESC
    `, [userEmail]);
    
    return result.rows;
  }

  private async getAutoConfirmThreshold(userEmail: string): Promise<number> {
    const prefs = await this.getUserPreferences(userEmail);
    const threshold = prefs.find(p => p.preferenceType === 'auto_confirm_threshold');
    return threshold?.preferenceValue?.confidence_score || 0.85;
  }

  private async getMeetingRequestById(id: number): Promise<MeetingRequest | null> {
    const result = await pool.query('SELECT * FROM meeting_requests WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  private getNextBusinessDays(count: number): string[] {
    const days = [];
    const today = new Date();
    let current = new Date(today);
    current.setDate(current.getDate() + 1); // Start from tomorrow

    while (days.length < count) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
        days.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private parsePreferredDate(dateStr: string): Date | null {
    try {
      // Handle various date formats
      if (dateStr.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      
      if (dateStr.includes('next week')) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;
      }

      // Try to parse as regular date using safe parser
      const parsed = safeParseDate(dateStr);
      return parsed;
    } catch {
      return null;
    }
  }

  // Cleanup expired holds
  async cleanupExpiredHolds(): Promise<number> {
    const result = await pool.query('SELECT cleanup_expired_holds() as cleaned_count');
    const cleanedCount = result.rows[0]?.cleaned_count || 0;
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired calendar holds`);
    }
    
    return cleanedCount;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; activeWorkflows: number; activeHolds: number }> {
    try {
      const workflowResult = await pool.query(`
        SELECT COUNT(*) as count FROM scheduling_workflows WHERE status = 'active'
      `);
      
      const holdsResult = await pool.query(`
        SELECT COUNT(*) as count FROM calendar_holds WHERE status = 'active'
      `);

      return {
        status: 'healthy',
        activeWorkflows: parseInt(workflowResult.rows[0]?.count || '0'),
        activeHolds: parseInt(holdsResult.rows[0]?.count || '0')
      };
    } catch (error) {
      return {
        status: 'error',
        activeWorkflows: 0,
        activeHolds: 0
      };
    }
  }
}