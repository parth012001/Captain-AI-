import { pool } from '../database/connection';
import { CalendarEvent, TimeSlotSuggestion } from '../types';
import { AvailabilityCheck } from '../services/calendar';

export interface CalendarPreference {
  id?: number;
  userId: string;
  preferenceType: string;
  preferenceValue: any;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MeetingRequest {
  id?: number;
  emailId?: number;
  senderEmail: string;
  subject?: string;
  meetingType: 'urgent' | 'regular' | 'flexible' | 'recurring';
  requestedDuration?: number;
  preferredDates?: string[];
  attendees?: string[];
  locationPreference?: string;
  specialRequirements?: string;
  urgencyLevel: 'high' | 'medium' | 'low';
  detectionConfidence: number;
  status: 'pending' | 'scheduled' | 'declined' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MeetingResponse {
  id?: number;
  meetingRequestId: number;
  responseType: 'acceptance' | 'alternative_times' | 'decline' | 'reschedule';
  suggestedTimes?: TimeSlotSuggestion[];
  responseBody: string;
  calendarEventId?: number;
  confidence: number;
  contextUsed: string[];
  generatedAt?: Date;
}

export class CalendarModel {
  
  // Calendar Events Management
  async saveCalendarEvent(event: CalendarEvent): Promise<number> {
    try {
      const query = `
        INSERT INTO calendar_events (
          google_event_id, calendar_id, summary, description, 
          start_datetime, end_datetime, timezone, location, 
          status, attendees, last_synced
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (google_event_id) 
        DO UPDATE SET
          summary = EXCLUDED.summary,
          description = EXCLUDED.description,
          start_datetime = EXCLUDED.start_datetime,
          end_datetime = EXCLUDED.end_datetime,
          timezone = EXCLUDED.timezone,
          location = EXCLUDED.location,
          status = EXCLUDED.status,
          attendees = EXCLUDED.attendees,
          updated_at = CURRENT_TIMESTAMP,
          last_synced = EXCLUDED.last_synced
        RETURNING id
      `;

      const result = await pool.query(query, [
        event.id || `temp_${Date.now()}`,
        'primary',
        event.summary,
        event.description || null,
        new Date(event.start.dateTime),
        new Date(event.end.dateTime),
        event.start.timeZone || null,
        event.location || null,
        event.status || 'confirmed',
        JSON.stringify(event.attendees || []),
        new Date()
      ]);

      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving calendar event:', error);
      throw error;
    }
  }

  // Save multiple calendar events (bulk sync)
  async saveCalendarEvents(events: CalendarEvent[]): Promise<{ saved: number, updated: number }> {
    try {
      let saved = 0;
      let updated = 0;

      for (const event of events) {
        const eventId = await this.saveCalendarEvent(event);
        if (eventId) {
          // Check if it was an insert or update by checking if event existed
          const existsQuery = 'SELECT id FROM calendar_events WHERE google_event_id = $1';
          const exists = await pool.query(existsQuery, [event.id]);
          
          if (exists.rows.length > 0) {
            updated++;
          } else {
            saved++;
          }
        }
      }

      console.log(`📅 Calendar sync: ${saved} new events, ${updated} updated events`);
      return { saved, updated };
    } catch (error) {
      console.error('❌ Error in bulk calendar event save:', error);
      throw error;
    }
  }

  // Get calendar events for date range
  async getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const query = `
        SELECT 
          google_event_id as id,
          summary,
          description,
          start_datetime,
          end_datetime,
          timezone,
          location,
          status,
          attendees,
          created_at,
          updated_at
        FROM calendar_events 
        WHERE start_datetime >= $1 AND end_datetime <= $2
        ORDER BY start_datetime ASC
      `;

      const result = await pool.query(query, [startDate, endDate]);
      
      return result.rows.map(row => ({
        id: row.id,
        summary: row.summary,
        description: row.description,
        start: {
          dateTime: row.start_datetime.toISOString(),
          timeZone: row.timezone
        },
        end: {
          dateTime: row.end_datetime.toISOString(),
          timeZone: row.timezone
        },
        location: row.location,
        status: row.status,
        attendees: row.attendees,
        created: row.created_at,
        updated: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error fetching calendar events:', error);
      throw error;
    }
  }

  // User Preferences Management
  async getUserPreferences(): Promise<CalendarPreference[]> {
    try {
      const query = `
        SELECT 
          id, user_id, preference_type, preference_value, 
          is_active, created_at, updated_at
        FROM calendar_preferences 
        WHERE is_active = true
        ORDER BY preference_type
      `;

      const result = await pool.query(query);
      
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        preferenceType: row.preference_type,
        preferenceValue: row.preference_value,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error fetching calendar preferences:', error);
      throw error;
    }
  }

  // Update user preference
  async updateUserPreference(preferenceType: string, preferenceValue: any): Promise<void> {
    try {
      const query = `
        UPDATE calendar_preferences 
        SET 
          preference_value = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE preference_type = $2 AND user_id = 'default_user'
      `;

      await pool.query(query, [JSON.stringify(preferenceValue), preferenceType]);
      console.log(`✅ Updated calendar preference: ${preferenceType}`);
    } catch (error) {
      console.error('❌ Error updating calendar preference:', error);
      throw error;
    }
  }

  // Meeting Requests Management
  async saveMeetingRequest(request: MeetingRequest): Promise<number> {
    try {
      const query = `
        INSERT INTO meeting_requests (
          email_id, sender_email, subject, meeting_type, requested_duration,
          preferred_dates, attendees, location_preference, special_requirements,
          urgency_level, detection_confidence, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;

      const result = await pool.query(query, [
        request.emailId || null,
        request.senderEmail,
        request.subject || null,
        request.meetingType,
        request.requestedDuration || null,
        JSON.stringify(request.preferredDates || []),
        JSON.stringify(request.attendees || []),
        request.locationPreference || null,
        request.specialRequirements || null,
        request.urgencyLevel,
        request.detectionConfidence,
        request.status
      ]);

      console.log(`✅ Saved meeting request: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving meeting request:', error);
      throw error;
    }
  }

  // Save meeting response
  async saveMeetingResponse(response: MeetingResponse): Promise<number> {
    try {
      const query = `
        INSERT INTO meeting_responses (
          meeting_request_id, response_type, suggested_times, response_body,
          calendar_event_id, confidence, context_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const result = await pool.query(query, [
        response.meetingRequestId,
        response.responseType,
        JSON.stringify(response.suggestedTimes || []),
        response.responseBody,
        response.calendarEventId || null,
        response.confidence,
        JSON.stringify(response.contextUsed)
      ]);

      console.log(`✅ Saved meeting response: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving meeting response:', error);
      throw error;
    }
  }

  // Availability Cache Management
  async getCachedAvailability(date: Date): Promise<any | null> {
    try {
      const query = `
        SELECT availability_data, last_updated, expires_at
        FROM availability_cache 
        WHERE date_key = $1 AND calendar_id = 'primary'
        AND expires_at > CURRENT_TIMESTAMP
      `;

      const result = await pool.query(query, [date]);
      
      if (result.rows.length > 0) {
        console.log(`📅 Using cached availability for ${date.toDateString()}`);
        return result.rows[0].availability_data;
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching cached availability:', error);
      return null;
    }
  }

  async setCachedAvailability(date: Date, availabilityData: any, expiryHours: number = 2): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const query = `
        INSERT INTO availability_cache (date_key, calendar_id, availability_data, expires_at)
        VALUES ($1, 'primary', $2, $3)
        ON CONFLICT (date_key, calendar_id)
        DO UPDATE SET
          availability_data = EXCLUDED.availability_data,
          last_updated = CURRENT_TIMESTAMP,
          expires_at = EXCLUDED.expires_at
      `;

      await pool.query(query, [date, JSON.stringify(availabilityData), expiresAt]);
      console.log(`📅 Cached availability for ${date.toDateString()}`);
    } catch (error) {
      console.error('❌ Error caching availability:', error);
    }
  }

  // Calendar Analytics
  async getCalendarStats(): Promise<any> {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE start_datetime >= CURRENT_DATE) as upcoming_events,
          COUNT(*) FILTER (WHERE start_datetime >= CURRENT_DATE AND start_datetime < CURRENT_DATE + INTERVAL '7 days') as this_week_events,
          COUNT(DISTINCT DATE(start_datetime)) as active_days,
          AVG(EXTRACT(EPOCH FROM (end_datetime - start_datetime))/60) as avg_duration_minutes
        FROM calendar_events
        WHERE start_datetime >= CURRENT_DATE - INTERVAL '30 days'
      `;

      const preferencesQuery = `
        SELECT preference_type, preference_value, is_active
        FROM calendar_preferences
        WHERE user_id = 'default_user'
      `;

      const meetingRequestsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_meetings,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_meetings,
          AVG(detection_confidence) as avg_detection_confidence
        FROM meeting_requests
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `;

      const [statsResult, prefsResult, requestsResult] = await Promise.all([
        pool.query(statsQuery),
        pool.query(preferencesQuery),
        pool.query(meetingRequestsQuery)
      ]);

      return {
        calendar: statsResult.rows[0],
        preferences: prefsResult.rows,
        meetingRequests: requestsResult.rows[0],
        healthStatus: 'operational',
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Error fetching calendar stats:', error);
      throw error;
    }
  }

  // Calendar Health Check
  async calendarHealthCheck(): Promise<{ status: string, issues: string[], metrics: any }> {
    try {
      const issues: string[] = [];
      let status = 'healthy';

      // Check for recent sync
      const lastSyncQuery = `
        SELECT MAX(last_synced) as last_sync
        FROM calendar_events
        WHERE last_synced >= CURRENT_DATE - INTERVAL '1 day'
      `;
      const syncResult = await pool.query(lastSyncQuery);
      
      if (!syncResult.rows[0].last_sync) {
        issues.push('No recent calendar sync detected');
        status = 'warning';
      }

      // Check cache performance
      const cacheQuery = `
        SELECT COUNT(*) as cached_days
        FROM availability_cache
        WHERE expires_at > CURRENT_TIMESTAMP
      `;
      const cacheResult = await pool.query(cacheQuery);

      // Get metrics
      const metrics = await this.getCalendarStats();

      return {
        status,
        issues,
        metrics: {
          ...metrics,
          cachedDays: cacheResult.rows[0].cached_days
        }
      };
    } catch (error) {
      console.error('❌ Calendar health check failed:', error);
      return {
        status: 'error',
        issues: ['Health check failed'],
        metrics: {}
      };
    }
  }
}