/**
 * Calendar and Meeting types for the frontend
 */

/**
 * Calendar event from Google Calendar
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

/**
 * Meeting request detected from emails
 */
export interface MeetingRequest {
  id: number;
  email_id: number;
  sender_email: string;
  subject?: string;
  meeting_type: 'urgent' | 'regular' | 'flexible' | 'recurring';
  requested_duration?: number;
  preferred_dates?: string[];
  attendees?: string[];
  location_preference?: string;
  special_requirements?: string;
  urgency_level: 'high' | 'medium' | 'low';
  detection_confidence: number;
  status: 'pending' | 'scheduled' | 'declined' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * Time slot suggestion for meetings
 */
export interface TimeSlotSuggestion {
  start: Date;
  end: Date;
  confidence: number;
  reason?: string;
}

/**
 * Calendar preferences
 */
export interface CalendarPreferences {
  no_early_meetings: {
    before_time: string;
    enabled: boolean;
  };
  friday_protection: {
    max_meetings: number;
    enabled: boolean;
  };
  focus_blocks: {
    duration_hours: number;
    daily_minimum: number;
    enabled: boolean;
  };
  meeting_buffer: {
    minutes: number;
    enabled: boolean;
  };
  working_hours: {
    start: string;
    end: string;
    timezone: string;
  };
}

/**
 * Calendar statistics
 */
export interface CalendarStats {
  total_events: number;
  upcoming_meetings: number;
  pending_requests: number;
  this_week_meetings: number;
  today_meetings: number;
}

/**
 * API response types
 */
export interface CalendarEventsResponse {
  events: CalendarEvent[];
  total: number;
  nextPageToken?: string;
}

export interface MeetingRequestsResponse {
  requests: MeetingRequest[];
  total: number;
}

export interface CalendarStatsResponse {
  stats: CalendarStats;
}

export interface CalendarPreferencesResponse {
  preferences: CalendarPreferences;
}
