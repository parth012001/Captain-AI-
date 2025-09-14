import { promotionalEmailAPI } from './api';
import type { 
  PromotionalEmailsResponse, 
  PromotionalEmailStatsResponse, 
  PromotionalEmailActionResponse,
  PromotionalEmailFilters 
} from '../types/promotionalEmail';

export class PromotionalEmailService {
  /**
   * Get promotional emails with optional filters
   */
  async getPromotionalEmails(filters?: PromotionalEmailFilters): Promise<PromotionalEmailsResponse> {
    try {
      return await promotionalEmailAPI.getPromotionalEmails(filters);
    } catch (error) {
      console.error('Failed to fetch promotional emails:', error);
      throw error;
    }
  }

  /**
   * Get promotional email statistics
   */
  async getPromotionalEmailStats(): Promise<PromotionalEmailStatsResponse> {
    try {
      return await promotionalEmailAPI.getPromotionalEmailStats();
    } catch (error) {
      console.error('Failed to fetch promotional email stats:', error);
      throw error;
    }
  }

  /**
   * Mark a promotional email as read
   */
  async markAsRead(emailId: number): Promise<PromotionalEmailActionResponse> {
    try {
      return await promotionalEmailAPI.markAsRead(emailId);
    } catch (error) {
      console.error('Failed to mark promotional email as read:', error);
      throw error;
    }
  }

  /**
   * Delete a promotional email
   */
  async deletePromotionalEmail(emailId: number): Promise<PromotionalEmailActionResponse> {
    try {
      return await promotionalEmailAPI.deletePromotionalEmail(emailId);
    } catch (error) {
      console.error('Failed to delete promotional email:', error);
      throw error;
    }
  }
}

export const promotionalEmailService = new PromotionalEmailService();
