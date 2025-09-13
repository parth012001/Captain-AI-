export interface EmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      data?: string;
    };
    parts?: Array<{
      mimeType: string;
      body: {
        data?: string;
      };
    }>;
  };
  internalDate: string;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: string;
  isRead: boolean;
}

export interface DatabaseEmail {
  id: number;
  gmail_id: string;
  thread_id: string;
  subject: string;
  from_email: string;
  to_email: string;
  body: string;
  received_at: Date;
  is_read: boolean;
  created_at: Date;
  category?: string;
  has_draft?: boolean;
  webhook_processed?: boolean;
}

export interface CalendarEvent {
  id?: string;
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
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  location?: string;
  status?: string;
  created?: string;
  updated?: string;
}

export interface TimeSlotSuggestion {
  start: string;
  end: string;
  confidence: number;
  reason: string;
}