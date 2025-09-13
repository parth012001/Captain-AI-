/**
 * Email data model from the backend
 */
export interface Email {
  id: number;
  subject: string;
  from: string;
  date: string; // ISO timestamp
  preview: string;
  isRead: boolean;
  gmailId?: string;
}

/**
 * API response for emails endpoint
 */
export interface EmailsResponse {
  emails: Email[];
  stats: {
    total: number;
    unread: number;
  };
}

/**
 * Individual email response
 */
export interface EmailResponse {
  email: Email;
  fullContent?: string;
}