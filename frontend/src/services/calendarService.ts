import type { 
  CalendarEvent, 
  CalendarPreferences,
  CalendarEventsResponse,
  MeetingRequestsResponse,
  CalendarStatsResponse,
  CalendarPreferencesResponse
} from '../types/calendar';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class CalendarService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Get calendar events for a date range
   */
  async getCalendarEvents(
    startTime?: string, 
    endTime?: string, 
    maxResults: number = 50
  ): Promise<CalendarEventsResponse> {
    const params = new URLSearchParams();
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);
    if (maxResults) params.append('maxResults', maxResults.toString());

    const response = await fetch(`${API_BASE_URL}/calendar/events?${params}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get upcoming calendar events (next 7 days)
   */
  async getUpcomingEvents(): Promise<CalendarEventsResponse> {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return this.getCalendarEvents(
      now.toISOString(),
      nextWeek.toISOString(),
      20
    );
  }

  /**
   * Get today's calendar events
   */
  async getTodaysEvents(): Promise<CalendarEventsResponse> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.getCalendarEvents(
      now.toISOString(),
      endOfDay.toISOString(),
      50
    );
  }

  /**
   * Get all meeting requests
   */
  async getMeetingRequests(): Promise<MeetingRequestsResponse> {
    const response = await fetch(`${API_BASE_URL}/meetings/requests`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch meeting requests: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get pending meeting requests
   */
  async getPendingMeetingRequests(): Promise<MeetingRequestsResponse> {
    const response = await fetch(`${API_BASE_URL}/meetings/requests?status=pending`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pending meeting requests: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update meeting request status
   */
  async updateMeetingRequestStatus(
    requestId: number, 
    status: 'pending' | 'scheduled' | 'declined' | 'cancelled'
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/meetings/requests/${requestId}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update meeting request: ${response.statusText}`);
    }
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(): Promise<CalendarStatsResponse> {
    const response = await fetch(`${API_BASE_URL}/calendar/stats`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get calendar preferences
   */
  async getCalendarPreferences(): Promise<CalendarPreferencesResponse> {
    const response = await fetch(`${API_BASE_URL}/calendar/preferences`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar preferences: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update calendar preferences
   */
  async updateCalendarPreferences(preferences: Partial<CalendarPreferences>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/calendar/preferences`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      throw new Error(`Failed to update calendar preferences: ${response.statusText}`);
    }
  }

  /**
   * Check calendar availability for a time slot
   */
  async checkAvailability(startTime: string, endTime: string): Promise<{ isAvailable: boolean; conflictingEvents?: CalendarEvent[] }> {
    const response = await fetch(`${API_BASE_URL}/calendar/check-availability`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ startTime, endTime }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check availability: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Suggest meeting times
   */
  async suggestMeetingTimes(
    duration: number,
    preferredDates?: string[],
    attendees?: string[]
  ): Promise<{ suggestions: Array<{ start: string; end: string; confidence: number }> }> {
    const response = await fetch(`${API_BASE_URL}/calendar/suggest-times`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ duration, preferredDates, attendees }),
    });

    if (!response.ok) {
      throw new Error(`Failed to suggest meeting times: ${response.statusText}`);
    }

    return response.json();
  }
}

export const calendarService = new CalendarService();
