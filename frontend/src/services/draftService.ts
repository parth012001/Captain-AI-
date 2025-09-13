import { draftAPI } from './api';
import type { 
  DraftsResponse, 
  DraftResponse, 
  DraftUpdateRequest, 
  DraftActionResponse 
} from '../types/draft';

export class DraftService {
  /**
   * Get all auto-generated drafts
   */
  async getDrafts(): Promise<DraftsResponse> {
    try {
      return await draftAPI.getAutoDrafts();
    } catch (error) {
      console.error('Failed to fetch drafts:', error);
      throw error;
    }
  }

  /**
   * Get latest draft (most recent)
   */
  async getLatestDraft(): Promise<DraftsResponse> {
    try {
      const response = await draftAPI.getAutoDrafts();
      // Return only the first draft
      return {
        ...response,
        drafts: response.drafts.slice(0, 1),
        total: response.drafts.length > 0 ? 1 : 0
      };
    } catch (error) {
      console.error('Failed to fetch latest draft:', error);
      throw error;
    }
  }

  /**
   * Get specific draft by ID
   */
  async getDraftById(id: number): Promise<DraftResponse> {
    try {
      return await draftAPI.getDraftById(id);
    } catch (error) {
      console.error(`Failed to fetch draft ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update draft content
   */
  async updateDraft(id: number, data: DraftUpdateRequest): Promise<DraftActionResponse> {
    try {
      return await draftAPI.editDraft(id, data.subject, data.body);
    } catch (error) {
      console.error(`Failed to update draft ${id}:`, error);
      throw error;
    }
  }

  /**
   * Approve draft without changes
   */
  async approveDraft(id: number): Promise<DraftActionResponse> {
    try {
      return await draftAPI.approveDraft(id);
    } catch (error) {
      console.error(`Failed to approve draft ${id}:`, error);
      throw error;
    }
  }

  /**
   * Send draft as email
   */
  async sendDraft(id: number): Promise<DraftActionResponse> {
    try {
      return await draftAPI.sendDraft(id);
    } catch (error) {
      console.error(`Failed to send draft ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete draft
   */
  async deleteDraft(id: number): Promise<DraftActionResponse> {
    try {
      return await draftAPI.deleteDraft(id);
    } catch (error) {
      console.error(`Failed to delete draft ${id}:`, error);
      throw error;
    }
  }

  /**
   * Approve and send draft in one action
   */
  async approveAndSend(id: number): Promise<DraftActionResponse> {
    try {
      // First approve
      await this.approveDraft(id);
      // Then send
      return await this.sendDraft(id);
    } catch (error) {
      console.error(`Failed to approve and send draft ${id}:`, error);
      throw error;
    }
  }
}

export const draftService = new DraftService();