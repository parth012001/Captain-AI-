import { pool } from '../database/connection';
import { ParsedEmail, DatabaseEmail } from '../types';

export class EmailModel {
  async saveEmail(email: ParsedEmail, userId?: string): Promise<number> {
    try {
      const query = `
        INSERT INTO emails (gmail_id, thread_id, subject, from_email, to_email, body, received_at, is_read, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (gmail_id, user_id) DO UPDATE SET
          subject = EXCLUDED.subject,
          body = EXCLUDED.body,
          is_read = EXCLUDED.is_read
        RETURNING id;
      `;
      
      const values = [
        email.id,
        email.threadId,
        email.subject,
        email.from,
        email.to,
        email.body,
        email.date,
        email.isRead,
        userId || 'default_user'
      ];

      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving email:', error);
      throw error;
    }
  }

  async getRecentEmails(limit: number = 20, userId?: string): Promise<DatabaseEmail[]> {
    try {
      const query = `
        SELECT * FROM emails 
        WHERE user_id = $2
        ORDER BY received_at DESC 
        LIMIT $1;
      `;
      
      const result = await pool.query(query, [limit, userId || 'default_user']);
      return result.rows;
    } catch (error) {
      console.error('Error fetching emails from database:', error);
      throw error;
    }
  }

  async emailExists(gmailId: string, userId?: string): Promise<boolean> {
    try {
      const query = 'SELECT id FROM emails WHERE gmail_id = $1 AND user_id = $2';
      const result = await pool.query(query, [gmailId, userId || 'default_user']);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking email existence:', error);
      throw error;
    }
  }

  async getEmailByGmailId(gmailId: string, userId?: string): Promise<DatabaseEmail | null> {
    try {
      const query = 'SELECT * FROM emails WHERE gmail_id = $1 AND user_id = $2';
      const result = await pool.query(query, [gmailId, userId || 'default_user']);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching email by Gmail ID:', error);
      throw error;
    }
  }

  async getEmailStats(userId?: string): Promise<{ total: number; unread: number }> {
    try {
      const totalQuery = 'SELECT COUNT(*) as count FROM emails WHERE user_id = $1';
      const unreadQuery = 'SELECT COUNT(*) as count FROM emails WHERE is_read = FALSE AND user_id = $1';
      const userParam = userId || 'default_user';
      
      const [totalResult, unreadResult] = await Promise.all([
        pool.query(totalQuery, [userParam]),
        pool.query(unreadQuery, [userParam]),
      ]);

      return {
        total: parseInt(totalResult.rows[0].count),
        unread: parseInt(unreadResult.rows[0].count),
      };
    } catch (error) {
      console.error('Error getting email stats:', error);
      throw error;
    }
  }

  async updateEmail(id: number, updates: { category?: string; has_draft?: boolean; webhook_processed?: boolean }): Promise<void> {
    try {
      const setClauses = [];
      const values = [];
      let paramCount = 1;

      if (updates.category !== undefined) {
        setClauses.push(`category = $${paramCount++}`);
        values.push(updates.category);
      }

      if (updates.has_draft !== undefined) {
        setClauses.push(`has_draft = $${paramCount++}`);
        values.push(updates.has_draft);
      }

      if (updates.webhook_processed !== undefined) {
        setClauses.push(`webhook_processed = $${paramCount++}`);
        values.push(updates.webhook_processed);
      }

      if (setClauses.length === 0) return;

      const query = `
        UPDATE emails 
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
      `;
      
      values.push(id);
      await pool.query(query, values);
    } catch (error) {
      console.error('Error updating email:', error);
      throw error;
    }
  }

  /**
   * Update webhook_processed flag for an email
   */
  async updateWebhookProcessed(id: number, processed: boolean): Promise<void> {
    try {
      const query = 'UPDATE emails SET webhook_processed = $1 WHERE id = $2';
      await pool.query(query, [processed, id]);
    } catch (error) {
      console.error('Error updating webhook_processed flag:', error);
      throw error;
    }
  }

  /**
   * Atomically check and mark email as webhook processed
   * Returns true if email was successfully marked as processed (not already processed)
   * Returns false if email was already processed by webhook
   * This prevents race conditions in concurrent webhook processing
   */
  async markAsWebhookProcessedAtomically(gmailId: string): Promise<{ success: boolean; emailId: number | null }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, check if email exists and get its ID
      const emailQuery = 'SELECT id, webhook_processed FROM emails WHERE gmail_id = $1 FOR UPDATE';
      const emailResult = await client.query(emailQuery, [gmailId]);
      
      if (emailResult.rows.length === 0) {
        // Email doesn't exist yet - we'll need to save it first
        await client.query('ROLLBACK');
        return { success: false, emailId: null };
      }
      
      const email = emailResult.rows[0];
      
      // Check if already processed
      if (email.webhook_processed) {
        await client.query('ROLLBACK');
        return { success: false, emailId: email.id };
      }
      
      // Mark as processed atomically
      const updateQuery = 'UPDATE emails SET webhook_processed = true WHERE id = $1';
      await client.query(updateQuery, [email.id]);
      
      await client.query('COMMIT');
      return { success: true, emailId: email.id };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in atomic webhook processing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * NEW: Save email and mark as webhook processed for specific user (24/7 multi-user support)
   * This enables true multi-user processing where each user has their own email processing
   */
  async saveEmailAndMarkAsWebhookProcessedForUser(
    email: ParsedEmail, 
    userId: string
  ): Promise<{ success: boolean; emailId: number | null }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if this email already exists for this specific user
      const emailQuery = 'SELECT id, webhook_processed FROM emails WHERE gmail_id = $1 AND user_id = $2 FOR UPDATE';
      const emailResult = await client.query(emailQuery, [email.id, userId]);
      
      if (emailResult.rows.length > 0) {
        // Email exists for this user - check if already processed
        const existingEmail = emailResult.rows[0];
        if (existingEmail.webhook_processed) {
          await client.query('ROLLBACK');
          return { success: false, emailId: existingEmail.id };
        }
        
        // Update existing email and mark as processed
        const updateQuery = `
          UPDATE emails 
          SET subject = $1, body = $2, is_read = $3, webhook_processed = true, updated_at = NOW()
          WHERE id = $4
          RETURNING id
        `;
        const updateResult = await client.query(updateQuery, [
          email.subject, email.body, email.isRead, existingEmail.id
        ]);
        
        await client.query('COMMIT');
        return { success: true, emailId: updateResult.rows[0].id };
      } else {
        // New email for this user - insert with webhook_processed = true and user_id
        const insertQuery = `
          INSERT INTO emails (
            gmail_id, thread_id, subject, from_email, to_email, body, 
            received_at, is_read, webhook_processed, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
          RETURNING id
        `;
        const insertResult = await client.query(insertQuery, [
          email.id, email.threadId, email.subject, email.from, 
          email.to, email.body, email.date, email.isRead, userId
        ]);
        
        await client.query('COMMIT');
        return { success: true, emailId: insertResult.rows[0].id };
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error in saveEmailAndMarkAsWebhookProcessedForUser:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically save email and mark as webhook processed
   * This is the main method to use for webhook processing to prevent duplicates
   */
  async saveEmailAndMarkAsWebhookProcessed(email: ParsedEmail): Promise<{ success: boolean; emailId: number | null }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // First, try to get existing email with lock
      const emailQuery = 'SELECT id, webhook_processed FROM emails WHERE gmail_id = $1 FOR UPDATE';
      const emailResult = await client.query(emailQuery, [email.id]);
      
      if (emailResult.rows.length > 0) {
        // Email exists - check if already processed
        const existingEmail = emailResult.rows[0];
        if (existingEmail.webhook_processed) {
          await client.query('ROLLBACK');
          return { success: false, emailId: existingEmail.id };
        }
        
        // Update existing email and mark as processed
        const updateQuery = `
          UPDATE emails 
          SET subject = $1, body = $2, is_read = $3, webhook_processed = true
          WHERE id = $4
        `;
        await client.query(updateQuery, [email.subject, email.body, email.isRead, existingEmail.id]);
        
        await client.query('COMMIT');
        return { success: true, emailId: existingEmail.id };
      } else {
        // Email doesn't exist - insert new email with webhook_processed = true
        const insertQuery = `
          INSERT INTO emails (gmail_id, thread_id, subject, from_email, to_email, body, received_at, is_read, webhook_processed)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
          RETURNING id
        `;
        
        const values = [
          email.id,
          email.threadId,
          email.subject,
          email.from,
          email.to,
          email.body,
          email.date,
          email.isRead,
        ];
        
        const result = await client.query(insertQuery, values);
        const emailId = result.rows[0].id;
        
        await client.query('COMMIT');
        return { success: true, emailId };
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in atomic email save and webhook processing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get emails that haven't been processed by webhook yet
   */
  async getUnprocessedEmails(limit: number = 10): Promise<DatabaseEmail[]> {
    try {
      const query = `
        SELECT * FROM emails 
        WHERE webhook_processed = FALSE OR webhook_processed IS NULL
        ORDER BY received_at DESC 
        LIMIT $1;
      `;
      
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching unprocessed emails:', error);
      throw error;
    }
  }
}