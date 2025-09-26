import { pool } from '../database/connection';

export interface PromotionalEmail {
  id: number;
  gmail_id: string;
  user_id: string;
  thread_id?: string;
  subject?: string;
  from_email: string;
  to_email?: string;
  body?: string;
  received_at: Date;
  classification_reason: string;
  is_read: boolean;
  webhook_processed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePromotionalEmailData {
  gmail_id: string;
  user_id: string;
  thread_id?: string;
  subject?: string;
  from_email: string;
  to_email?: string;
  body?: string;
  classification_reason: string;
  received_at?: Date;
}

export interface PromotionalEmailFilters {
  is_read?: boolean;
  classification_reason?: string;
  from_email?: string;
  limit?: number;
  offset?: number;
}

export class PromotionalEmailModel {
  /**
   * Save a promotional email for a specific user
   * This is called when AI classifies an email as promotional
   */
  async savePromotionalEmail(data: CreatePromotionalEmailData): Promise<number> {
    try {
      const query = `
        INSERT INTO promotional_emails (
          gmail_id, user_id, thread_id, subject, from_email, 
          to_email, body, classification_reason, received_at, webhook_processed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        ON CONFLICT (gmail_id, user_id) DO UPDATE SET
          thread_id = EXCLUDED.thread_id,
          subject = EXCLUDED.subject,
          from_email = EXCLUDED.from_email,
          to_email = EXCLUDED.to_email,
          body = EXCLUDED.body,
          classification_reason = EXCLUDED.classification_reason,
          received_at = EXCLUDED.received_at,
          webhook_processed = EXCLUDED.webhook_processed,
          updated_at = NOW()
        RETURNING id
      `;
      
      const values = [
        data.gmail_id,
        data.user_id,
        data.thread_id || null,
        data.subject || null,
        data.from_email,
        data.to_email || null,
        data.body || null,
        data.classification_reason,
        data.received_at || new Date()
      ];
      
      const result = await pool.query(query, values);
      console.log(`✅ Promotional email saved/updated for user ${data.user_id} with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving promotional email:', error);
      throw error;
    }
  }

  /**
   * Get promotional emails for a specific user with optional filters
   */
  async getPromotionalEmailsForUser(
    userId: string, 
    filters: PromotionalEmailFilters = {}
  ): Promise<PromotionalEmail[]> {
    try {
      let query = `
        SELECT * FROM promotional_emails 
        WHERE user_id = $1
      `;
      const values: any[] = [userId];
      let paramCount = 1;

      // Apply filters
      if (filters.is_read !== undefined) {
        paramCount++;
        query += ` AND is_read = $${paramCount}`;
        values.push(filters.is_read);
      }

      if (filters.classification_reason) {
        paramCount++;
        query += ` AND classification_reason = $${paramCount}`;
        values.push(filters.classification_reason);
      }

      if (filters.from_email) {
        paramCount++;
        query += ` AND from_email ILIKE $${paramCount}`;
        values.push(`%${filters.from_email}%`);
      }

      // Order by received_at DESC (newest first)
      query += ` ORDER BY received_at DESC`;

      // Apply pagination
      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
      }

      if (filters.offset) {
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        values.push(filters.offset);
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching promotional emails:', error);
      throw error;
    }
  }

  /**
   * Mark a promotional email as read
   */
  async markAsRead(emailId: number, userId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE promotional_emails 
        SET is_read = true, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;
      
      const result = await pool.query(query, [emailId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Error marking promotional email as read:', error);
      throw error;
    }
  }

  /**
   * Delete a promotional email
   */
  async deletePromotionalEmail(emailId: number, userId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM promotional_emails 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;
      
      const result = await pool.query(query, [emailId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Error deleting promotional email:', error);
      throw error;
    }
  }

  /**
   * Get promotional email statistics for a user
   */
  async getPromotionalEmailStats(userId: string): Promise<{
    total: number;
    unread: number;
    by_classification: { [key: string]: number };
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_read = false THEN 1 END) as unread,
          classification_reason,
          COUNT(*) as count
        FROM promotional_emails 
        WHERE user_id = $1
        GROUP BY classification_reason
      `;
      
      const result = await pool.query(query, [userId]);
      
      const stats = {
        total: 0,
        unread: 0,
        by_classification: {} as { [key: string]: number }
      };

      result.rows.forEach(row => {
        stats.total += parseInt(row.count);
        if (row.is_read === false) {
          stats.unread += parseInt(row.count);
        }
        stats.by_classification[row.classification_reason] = parseInt(row.count);
      });

      return stats;
    } catch (error) {
      console.error('❌ Error fetching promotional email stats:', error);
      throw error;
    }
  }

  /**
   * Check if a promotional email already exists for a user
   */
  async promotionalEmailExists(gmailId: string, userId: string): Promise<boolean> {
    try {
      const query = `
        SELECT id FROM promotional_emails 
        WHERE gmail_id = $1 AND user_id = $2
        LIMIT 1
      `;
      
      const result = await pool.query(query, [gmailId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Error checking promotional email existence:', error);
      throw error;
    }
  }
}
