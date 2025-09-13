import { emailAPI } from './api';
import type { EmailsResponse } from '../types/email';

export class EmailService {
  /**
   * Get recent emails from the backend
   */
  async getEmails(): Promise<EmailsResponse> {
    try {
      return await emailAPI.getRecentEmails();
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      throw error;
    }
  }

  /**
   * Get latest email (most recent)
   */
  async getLatestEmail(): Promise<EmailsResponse> {
    try {
      const response = await emailAPI.getRecentEmails();
      // Return only the first email
      return {
        ...response,
        emails: response.emails.slice(0, 1)
      };
    } catch (error) {
      console.error('Failed to fetch latest email:', error);
      throw error;
    }
  }

  /**
   * Trigger email fetch from Gmail
   */
  async fetchFromGmail(): Promise<any> {
    try {
      return await emailAPI.fetchEmails();
    } catch (error) {
      console.error('Failed to fetch emails from Gmail:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();