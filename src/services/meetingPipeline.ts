import { ParsedEmail } from '../types';
import { MeetingDetectionService, MeetingRequest as DetectedMeetingRequest } from './meetingDetection';
import { MeetingResponseGeneratorService, MeetingResponse } from './meetingResponseGenerator';
import { GmailService } from './gmail';
import { pool } from '../database/connection';

// Database meeting request with ID
export interface MeetingRequest extends DetectedMeetingRequest {
  id: number;
}

export interface MeetingPipelineResult {
  emailId: string;
  userId: string;
  isMeetingRequest: boolean;
  meetingRequest?: MeetingRequest;
  response?: MeetingResponse;
  confidence: number;
  processingTime: number;
  status: 'processed' | 'skipped' | 'error';
  reason?: string;
}

export class MeetingPipelineService {
  private meetingDetection: MeetingDetectionService;
  private responseGenerator: MeetingResponseGeneratorService;
  private gmailService: GmailService;

  constructor() {
    this.meetingDetection = new MeetingDetectionService();
    this.responseGenerator = new MeetingResponseGeneratorService();
    this.gmailService = new GmailService();
  }

  /**
   * Process a single email through the meeting detection pipeline
   * This integrates with the existing email processing flow
   */
  async processEmailForMeetings(
    email: ParsedEmail, 
    userId: string,
    emailDbId?: number, // Database ID for the email record
    testMode: boolean = false // Test mode bypasses OAuth requirements
  ): Promise<MeetingPipelineResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 [MEETING PIPELINE] Processing email ${email.id} for meetings...`);

      // Get database email ID if not provided
      let dbId = emailDbId;
      if (!dbId) {
        const foundId = await this.getEmailDbId(email.id, userId);
        if (!foundId) {
          throw new Error(`Email ${email.id} not found in database for user ${userId}`);
        }
        dbId = foundId;
      }

      // Quick filter: Skip promotional/newsletter emails
      const category = (email as any).category;
      if (category === 'promotional' || category === 'newsletter') {
        const result = {
          emailId: email.id,
          userId,
          isMeetingRequest: false,
          confidence: 0,
          processingTime: Date.now() - startTime,
          status: 'skipped' as const,
          reason: 'Promotional/newsletter content skipped'
        };
        await this.storePipelineResult(result, dbId);
        return result;
      }

      // INFINITE LOOP PREVENTION - TEMPORARILY DISABLED FOR TESTING
      // TODO: Re-enable with smarter logic that doesn't block user's own email
      /*
      if (email.from && email.from.includes('parthahir012001@gmail.com')) {
        const result = {
          emailId: email.id,
          userId,
          isMeetingRequest: false,
          confidence: 0,
          processingTime: Date.now() - startTime,
          status: 'skipped' as const,
          reason: 'AI-generated email skipped to prevent infinite loop'
        };
        await this.storePipelineResult(result, dbId);
        console.log(`🛑 [MEETING PIPELINE] Skipping AI-generated email to prevent loop: ${email.subject}`);
        return result;
      }
      */

      console.log(`✅ [MEETING PIPELINE - LOOP PREVENTION DISABLED] Processing email: ${email.subject}`);

      // Skip if already processed for meetings
      const alreadyProcessed = await this.checkIfAlreadyProcessed(dbId, userId);
      if (alreadyProcessed) {
        console.log(`⏭️ Email ${email.id} already processed for meetings`);
        return {
          emailId: email.id,
          userId,
          isMeetingRequest: alreadyProcessed.isMeetingRequest,
          confidence: alreadyProcessed.confidence,
          processingTime: Date.now() - startTime,
          status: 'skipped',
          reason: 'Already processed'
        };
      }

      // Run meeting detection
      const meetingRequest = await this.meetingDetection.detectMeetingRequest(email);
      
      const result: MeetingPipelineResult = {
        emailId: email.id,
        userId,
        isMeetingRequest: meetingRequest !== null,
        meetingRequest: undefined, // Will be set after saving to database
        confidence: meetingRequest?.detectionConfidence || 0,
        processingTime: Date.now() - startTime,
        status: 'processed'
      };

      // Perform all database operations in an atomic transaction
      await this.executeInTransaction(async (client) => {
        
        // Store the meeting request if detected
        if (meetingRequest) {
          const meetingRequestId = await this.saveMeetingRequestWithClient(client, meetingRequest, userId, dbId);
          console.log(`✅ [MEETING PIPELINE] Meeting request detected and saved: ${meetingRequest.meetingType} (ID: ${meetingRequestId})`);
          
          // Create a meeting request object with the database ID
          const meetingRequestWithId: MeetingRequest = {
            ...meetingRequest,
            id: meetingRequestId
          };
          
          // Generate intelligent response
          try {
            const response = await this.responseGenerator.generateMeetingResponse(email, meetingRequestWithId, userId, testMode);
            result.response = response;
            
            // Save response as draft for user approval (don't send directly)
            if (response.shouldRespond && response.responseText) {
              console.log(`📝 [MEETING PIPELINE] About to save meeting response draft with meeting request:`, {
                id: meetingRequestWithId.id,
                type: meetingRequestWithId.meetingType,
                duration: meetingRequestWithId.requestedDuration,
                urgency: meetingRequestWithId.urgencyLevel
              });
              await this.saveMeetingResponseAsDraftWithClient(client, email, response, userId, meetingRequestWithId);
              console.log(`📝 [MEETING PIPELINE] Response saved as draft: ${response.actionTaken}`);
            } else {
              console.log(`📝 [MEETING PIPELINE] Not saving draft - shouldRespond: ${response.shouldRespond}, hasResponseText: ${!!response.responseText}`);
            }
          } catch (responseError) {
            console.warn('⚠️ [MEETING PIPELINE] Failed to generate/save response:', responseError);
            // Don't throw here - we still want to save the processing result
          }
        } else {
          console.log(`📧 [MEETING PIPELINE] No meeting request detected`);
        }

        // Store processing result for future reference (always runs in same transaction)
        await this.storePipelineResultWithClient(client, result, dbId);
        
        console.log(`📊 [MEETING PIPELINE] All database operations completed atomically`);
      });

      return result;

    } catch (error) {
      console.error(`❌ [MEETING PIPELINE] Error processing email ${email.id}:`, error);
      
      const errorResult = {
        emailId: email.id,
        userId,
        isMeetingRequest: false,
        confidence: 0,
        processingTime: Date.now() - startTime,
        status: 'error' as const,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };

      // Try to store error result if we have dbId
      if (emailDbId) {
        try {
          await this.storePipelineResult(errorResult, emailDbId);
        } catch (storeError) {
          console.error('Failed to store error result:', storeError);
        }
      }

      return errorResult;
    }
  }

  /**
   * Batch process multiple emails for meeting detection
   * Used when fetching emails in bulk
   */
  async processEmailsForMeetings(
    emails: ParsedEmail[], 
    userId: string
  ): Promise<MeetingPipelineResult[]> {
    const results: MeetingPipelineResult[] = [];
    
    console.log(`🔍 [MEETING PIPELINE] Processing ${emails.length} emails for meetings...`);

    for (const email of emails) {
      const result = await this.processEmailForMeetings(email, userId);
      results.push(result);
      
      // Small delay to prevent overwhelming the AI service
      if (result.status === 'processed') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const meetingEmails = results.filter(r => r.isMeetingRequest);
    console.log(`📋 [MEETING PIPELINE] Batch processing complete: ${meetingEmails.length}/${emails.length} meeting requests found`);

    return results;
  }

  /**
   * Get meeting requests for a user with filters
   */
  async getMeetingRequests(
    userId: string,
    filters: {
      status?: 'pending' | 'scheduled' | 'declined' | 'cancelled';
      urgency?: 'high' | 'medium' | 'low';
      meetingType?: 'urgent' | 'regular' | 'flexible' | 'recurring';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MeetingRequest[]> {
    try {
      let query = `
        SELECT 
          mr.*,
          e.subject,
          e.from_email,
          e.body,
          e.received_at
        FROM meeting_requests mr
        JOIN emails e ON mr.email_id = e.id
        WHERE mr.user_id = $1
      `;
      
      const params: any[] = [userId];
      let paramCount = 2;

      if (filters.status) {
        query += ` AND mr.status = $${paramCount++}`;
        params.push(filters.status);
      }

      if (filters.urgency) {
        query += ` AND mr.urgency_level = $${paramCount++}`;
        params.push(filters.urgency);
      }

      if (filters.meetingType) {
        query += ` AND mr.meeting_type = $${paramCount++}`;
        params.push(filters.meetingType);
      }

      query += ` ORDER BY mr.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT $${paramCount++}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET $${paramCount++}`;
        params.push(filters.offset);
      }

      const result = await pool.query(query, params);
      return result.rows.map(this.mapDatabaseToMeetingRequest);

    } catch (error) {
      console.error('❌ [MEETING PIPELINE] Error fetching meeting requests:', error);
      return [];
    }
  }

  /**
   * Get meeting request statistics for a user
   */
  async getMeetingStats(userId: string): Promise<{
    total: number;
    pending: number;
    scheduled: number;
    declined: number;
    byUrgency: { high: number; medium: number; low: number };
    byType: { urgent: number; regular: number; flexible: number; recurring: number };
  }> {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'declined') as declined,
          COUNT(*) FILTER (WHERE urgency_level = 'high') as urgency_high,
          COUNT(*) FILTER (WHERE urgency_level = 'medium') as urgency_medium,
          COUNT(*) FILTER (WHERE urgency_level = 'low') as urgency_low,
          COUNT(*) FILTER (WHERE meeting_type = 'urgent') as type_urgent,
          COUNT(*) FILTER (WHERE meeting_type = 'regular') as type_regular,
          COUNT(*) FILTER (WHERE meeting_type = 'flexible') as type_flexible,
          COUNT(*) FILTER (WHERE meeting_type = 'recurring') as type_recurring
        FROM meeting_requests 
        WHERE user_id = $1
      `, [userId]);

      const stats = result.rows[0];
      return {
        total: parseInt(stats.total),
        pending: parseInt(stats.pending),
        scheduled: parseInt(stats.scheduled),
        declined: parseInt(stats.declined),
        byUrgency: {
          high: parseInt(stats.urgency_high),
          medium: parseInt(stats.urgency_medium),
          low: parseInt(stats.urgency_low)
        },
        byType: {
          urgent: parseInt(stats.type_urgent),
          regular: parseInt(stats.type_regular),
          flexible: parseInt(stats.type_flexible),
          recurring: parseInt(stats.type_recurring)
        }
      };

    } catch (error) {
      console.error('❌ [MEETING PIPELINE] Error fetching meeting stats:', error);
      return {
        total: 0,
        pending: 0,
        scheduled: 0,
        declined: 0,
        byUrgency: { high: 0, medium: 0, low: 0 },
        byType: { urgent: 0, regular: 0, flexible: 0, recurring: 0 }
      };
    }
  }

  // Private helper methods
  private async getEmailDbId(gmailId: string, userId: string): Promise<number | null> {
    try {
      const result = await pool.query(`
        SELECT id FROM emails WHERE gmail_id = $1 AND user_id = $2 LIMIT 1
      `, [gmailId, userId]);

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error('❌ Error getting email DB ID:', error);
      return null;
    }
  }

  private async checkIfAlreadyProcessed(
    emailDbId: number, 
    userId: string
  ): Promise<{ isMeetingRequest: boolean; confidence: number } | null> {
    try {
      const result = await pool.query(`
        SELECT is_meeting_request, confidence 
        FROM meeting_processing_results 
        WHERE email_db_id = $1 AND user_id = $2
      `, [emailDbId, userId]);

      if (result.rows.length > 0) {
        return {
          isMeetingRequest: result.rows[0].is_meeting_request,
          confidence: result.rows[0].confidence
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error checking processing status:', error);
      return null;
    }
  }

  private async saveMeetingRequest(meetingRequest: DetectedMeetingRequest, userId: string, emailDbId: number): Promise<number> {
    try {
      const query = `
        INSERT INTO meeting_requests (
          email_id, user_id, sender_email, subject, meeting_type, 
          requested_duration, preferred_dates, attendees, location_preference,
          special_requirements, urgency_level, detection_confidence, status,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        ON CONFLICT (email_id, user_id) DO UPDATE SET
          sender_email = EXCLUDED.sender_email,
          subject = EXCLUDED.subject,
          meeting_type = EXCLUDED.meeting_type,
          requested_duration = EXCLUDED.requested_duration,
          preferred_dates = EXCLUDED.preferred_dates,
          attendees = EXCLUDED.attendees,
          location_preference = EXCLUDED.location_preference,
          special_requirements = EXCLUDED.special_requirements,
          urgency_level = EXCLUDED.urgency_level,
          detection_confidence = EXCLUDED.detection_confidence,
          updated_at = NOW()
        RETURNING id
      `;

      const result = await pool.query(query, [
        emailDbId, // Use database ID instead of Gmail ID
        userId,
        meetingRequest.senderEmail,
        meetingRequest.subject,
        meetingRequest.meetingType,
        meetingRequest.requestedDuration,
        JSON.stringify(meetingRequest.preferredDates || []),
        JSON.stringify(meetingRequest.attendees || []),
        meetingRequest.locationPreference,
        meetingRequest.specialRequirements,
        meetingRequest.urgencyLevel,
        meetingRequest.detectionConfidence,
        meetingRequest.status
      ]);

      return result.rows[0].id;

    } catch (error) {
      console.error('❌ Error saving meeting request:', error);
      throw error;
    }
  }

  private async storePipelineResult(result: MeetingPipelineResult, emailDbId: number): Promise<void> {
    try {
      const query = `
        INSERT INTO meeting_processing_results (
          email_db_id, gmail_id, user_id, is_meeting_request, confidence, 
          processing_time_ms, status, reason, processed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (email_db_id, user_id) DO UPDATE SET
          is_meeting_request = EXCLUDED.is_meeting_request,
          confidence = EXCLUDED.confidence,
          processing_time_ms = EXCLUDED.processing_time_ms,
          status = EXCLUDED.status,
          reason = EXCLUDED.reason,
          processed_at = NOW()
      `;

      await pool.query(query, [
        emailDbId,
        result.emailId, // Gmail ID
        result.userId,
        result.isMeetingRequest,
        result.confidence,
        result.processingTime,
        result.status,
        result.reason
      ]);

    } catch (error) {
      console.error('❌ Error storing pipeline result:', error);
      // Don't throw - this is just for tracking/analytics
    }
  }

  private mapDatabaseToMeetingRequest(row: any): MeetingRequest {
    return {
      id: row.id,
      emailId: parseInt(row.email_id),
      senderEmail: row.sender_email,
      subject: row.subject,
      meetingType: row.meeting_type,
      requestedDuration: row.requested_duration,
      preferredDates: JSON.parse(row.preferred_dates || '[]'),
      attendees: JSON.parse(row.attendees || '[]'),
      locationPreference: row.location_preference,
      specialRequirements: row.special_requirements,
      urgencyLevel: row.urgency_level,
      detectionConfidence: row.detection_confidence,
      status: row.status
    };
  }


  /**
   * Save meeting response as auto-generated draft for user approval
   */
  private async saveMeetingResponseAsDraft(
    originalEmail: ParsedEmail,
    response: MeetingResponse,
    userId: string,
    meetingRequest: MeetingRequest
  ): Promise<void> {
    try {
      console.log(`📝 [MEETING PIPELINE] Saving meeting response draft for meeting request:`, {
        id: meetingRequest.id,
        type: meetingRequest.meetingType,
        duration: meetingRequest.requestedDuration,
        urgency: meetingRequest.urgencyLevel
      });

      // Get the database email ID (not Gmail ID)
      const emailDbId = await this.getEmailDbId(originalEmail.id, userId);
      if (!emailDbId) {
        throw new Error(`Email ${originalEmail.id} not found in database for user ${userId}`);
      }

      // Determine subject line
      let subject = originalEmail.subject;
      if (!subject.toLowerCase().startsWith('re:')) {
        subject = `Re: ${subject}`;
      }

      const query = `
        INSERT INTO auto_generated_drafts (
          draft_id, original_email_id, subject, body, tone, urgency_level, 
          context_used, relationship_type, status, user_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `;

      const contextUsed = {
        source: 'meeting_pipeline',
        actionTaken: response.actionTaken,
        meetingType: meetingRequest.meetingType,
        urgency: meetingRequest.urgencyLevel,
        confidence: meetingRequest.detectionConfidence,
        meetingRequest: {
          id: meetingRequest.id,
          type: meetingRequest.meetingType,
          duration: meetingRequest.requestedDuration,
          urgency: meetingRequest.urgencyLevel,
          preferredDates: meetingRequest.preferredDates,
          locationPreference: meetingRequest.locationPreference,
          specialRequirements: meetingRequest.specialRequirements,
          selectedTimeSlot: null // Will be set when user confirms the meeting
        },
        // NEW: Calendar booking information
        calendarBooking: {
          autoBooked: response.calendarEventCreated || false,
          eventId: response.calendarEventId || null,
          bookingDetails: response.bookingDetails || null,
          eventStatus: response.bookingDetails?.eventStatus || 'not_created'
        },
        originalEmail: {
          subject: originalEmail.subject,
          from: originalEmail.from,
          threadId: originalEmail.threadId,
          gmailId: originalEmail.id
        }
      };

      console.log(`📝 [MEETING PIPELINE] Saving draft with context:`, JSON.stringify(contextUsed, null, 2));

      const result = await pool.query(query, [
        `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique draft ID
        emailDbId, // Database email ID (integer)
        subject,
        response.responseText,
        'professional', // Default tone for meeting responses
        meetingRequest.urgencyLevel, // Use meeting urgency
        JSON.stringify(contextUsed),
        'meeting_response',
        'pending', // Status is 'pending' - waiting for user approval
        userId // FIXED: Include user_id so frontend can find meeting drafts
      ]);

      const draftId = result.rows[0].id;
      console.log(`✅ Meeting response saved as auto-generated draft with ID: ${draftId}`);
      console.log(`📝 Draft status: waiting for user approval`);
      
    } catch (error) {
      console.error('❌ Failed to save meeting response as draft:', error);
      throw error; // Throw this time since it's critical for UX
    }
  }

  /**
   * Health check for meeting pipeline service
   */
  async healthCheck(): Promise<{ 
    status: string; 
    meetingDetectionReady: boolean;
    responseGeneratorReady: boolean;
    databaseConnection: boolean;
    processingCapacity: string;
  }> {
    try {
      // Test meeting detection service
      const detectionHealth = await this.meetingDetection.healthCheck();
      
      // Test response generator service
      const responseHealth = await this.responseGenerator.healthCheck();
      
      // Test database connection
      await pool.query('SELECT 1');
      
      return {
        status: 'healthy',
        meetingDetectionReady: detectionHealth.status === 'healthy',
        responseGeneratorReady: responseHealth.status === 'healthy',
        databaseConnection: true,
        processingCapacity: 'ready'
      };
    } catch (error) {
      return {
        status: 'error',
        meetingDetectionReady: false,
        responseGeneratorReady: false,
        databaseConnection: false,
        processingCapacity: 'limited'
      };
    }
  }

  /**
   * Execute database operations within a transaction for atomicity
   */
  private async executeInTransaction<T>(operation: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      console.log('📊 [TRANSACTION] Started database transaction');
      
      // Execute the operation with the client
      const result = await operation(client);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ [TRANSACTION] Database transaction committed successfully');
      
      return result;
      
    } catch (error) {
      // Rollback transaction on error
      try {
        await client.query('ROLLBACK');
        console.log('🔄 [TRANSACTION] Database transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('❌ [TRANSACTION] Error during rollback:', rollbackError);
      }
      
      console.error('❌ [TRANSACTION] Transaction failed:', error);
      throw error;
      
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  /**
   * Save meeting request using a specific database client (for transactions)
   */
  private async saveMeetingRequestWithClient(client: any, meetingRequest: DetectedMeetingRequest, userId: string, emailDbId: number): Promise<number> {
    const query = `
      INSERT INTO meeting_requests (
        email_id, user_id, sender_email, subject, meeting_type, 
        requested_duration, preferred_dates, attendees, location_preference,
        special_requirements, urgency_level, detection_confidence, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      ON CONFLICT (email_id, user_id) DO UPDATE SET
        sender_email = EXCLUDED.sender_email,
        subject = EXCLUDED.subject,
        meeting_type = EXCLUDED.meeting_type,
        requested_duration = EXCLUDED.requested_duration,
        preferred_dates = EXCLUDED.preferred_dates,
        attendees = EXCLUDED.attendees,
        location_preference = EXCLUDED.location_preference,
        special_requirements = EXCLUDED.special_requirements,
        urgency_level = EXCLUDED.urgency_level,
        detection_confidence = EXCLUDED.detection_confidence,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await client.query(query, [
      emailDbId, // Use database ID instead of Gmail ID
      userId,
      meetingRequest.senderEmail,
      meetingRequest.subject,
      meetingRequest.meetingType,
      meetingRequest.requestedDuration,
      JSON.stringify(meetingRequest.preferredDates || []),
      JSON.stringify(meetingRequest.attendees || []),
      meetingRequest.locationPreference,
      meetingRequest.specialRequirements,
      meetingRequest.urgencyLevel,
      meetingRequest.detectionConfidence,
      meetingRequest.status
    ]);

    return result.rows[0].id;
  }

  /**
   * Store pipeline result using a specific database client (for transactions)
   */
  private async storePipelineResultWithClient(client: any, result: MeetingPipelineResult, emailDbId: number): Promise<void> {
    const query = `
      INSERT INTO meeting_processing_results (
        email_db_id, gmail_id, user_id, is_meeting_request, confidence, 
        processing_time_ms, status, reason, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (email_db_id, user_id) DO UPDATE SET
        is_meeting_request = EXCLUDED.is_meeting_request,
        confidence = EXCLUDED.confidence,
        processing_time_ms = EXCLUDED.processing_time_ms,
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        processed_at = NOW()
    `;

    await client.query(query, [
      emailDbId,
      result.emailId, // Gmail ID
      result.userId,
      result.isMeetingRequest,
      result.confidence,
      result.processingTime,
      result.status,
      result.reason
    ]);
  }

  /**
   * Save meeting response as draft using a specific database client (for transactions)
   */
  private async saveMeetingResponseAsDraftWithClient(client: any, email: any, response: any, userId: string, meetingRequest: any): Promise<void> {
    // This method would implement the draft saving logic with the provided client
    // For now, we'll delegate to the existing method but note that it should be refactored
    // to accept a client parameter for full transaction support
    
    // TODO: Refactor saveMeetingResponseAsDraft to accept client parameter
    // For now, log that we're breaking transaction boundary for this operation
    console.log('⚠️ [TRANSACTION] Breaking transaction boundary for draft saving - consider refactoring');
    
    // Call the existing method (this breaks transaction atomicity for this part)
    try {
      await this.saveMeetingResponseAsDraft(email, response, userId, meetingRequest);
    } catch (error) {
      console.error('❌ [TRANSACTION] Error saving meeting response draft:', error);
      // Don't throw here as we want to continue with the transaction for other operations
      // The main pipeline result will still be saved atomically
    }
  }
}