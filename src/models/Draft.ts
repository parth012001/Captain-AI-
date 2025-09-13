import { pool } from '../database/connection';

export interface Draft {
  id: number;
  email_id: number;
  subject: string;
  body: string;
  category: string;
  confidence_score: number;
  quality_score: number;
  status: 'pending' | 'approved' | 'sent' | 'declined';
  created_at: Date;
  approved_at?: Date;
  sent_at?: Date;
}

export interface ToneProfile {
  id: number;
  profile_text: string;
  confidence_score: number;
  email_samples_analyzed: number;
  insights?: string;
  is_real_data: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SentEmail {
  id: number;
  gmail_id: string;
  subject: string;
  body: string;
  to_email: string;
  sent_at: Date;
  analyzed_for_tone: boolean;
}

export interface PendingDraftWithEmail extends Draft {
  original_subject: string;
  from_email: string;
}

export class DraftModel {
  async saveDraft(draft: {
    email_id: number;
    subject: string;
    body: string;
    category: string;
    confidence_score: number;
    quality_score: number;
  }): Promise<number> {
    try {
      const query = `
        INSERT INTO drafts (email_id, subject, body, category, confidence_score, quality_score)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      
      const values = [
        draft.email_id,
        draft.subject,
        draft.body,
        draft.category,
        draft.confidence_score,
        draft.quality_score,
      ];

      const result = await pool.query(query, values);
      
      // Mark email as having a draft
      await pool.query(
        'UPDATE emails SET has_draft = TRUE WHERE id = $1',
        [draft.email_id]
      );

      console.log(`✅ Draft saved for email ${draft.email_id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  }

  async getDraftsByEmail(emailId: number): Promise<Draft[]> {
    try {
      const query = `
        SELECT * FROM drafts 
        WHERE email_id = $1 
        ORDER BY created_at DESC;
      `;
      
      const result = await pool.query(query, [emailId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching drafts:', error);
      throw error;
    }
  }

  async getPendingDrafts(limit: number = 20): Promise<PendingDraftWithEmail[]> {
    try {
      const query = `
        SELECT d.*, e.subject as original_subject, e.from_email 
        FROM drafts d
        JOIN emails e ON d.email_id = e.id
        WHERE d.status = 'pending'
        ORDER BY d.created_at DESC
        LIMIT $1;
      `;
      
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching pending drafts:', error);
      throw error;
    }
  }

  async updateDraftStatus(draftId: number, status: Draft['status']): Promise<void> {
    try {
      const query = `
        UPDATE drafts 
        SET status = $1, 
            approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
            sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
        WHERE id = $2;
      `;
      
      await pool.query(query, [status, draftId]);
      console.log(`✅ Draft ${draftId} status updated to ${status}`);
    } catch (error) {
      console.error('Error updating draft status:', error);
      throw error;
    }
  }

  async saveToneProfile(profile: {
    profile_text: string;
    confidence_score: number;
    email_samples_analyzed: number;
    insights?: string;
    is_real_data: boolean;
  }): Promise<number> {
    try {
      const query = `
        INSERT INTO tone_profiles (profile_text, confidence_score, email_samples_analyzed, insights, is_real_data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      
      const values = [
        profile.profile_text,
        profile.confidence_score,
        profile.email_samples_analyzed,
        profile.insights || null,
        profile.is_real_data,
      ];

      const result = await pool.query(query, values);
      const dataType = profile.is_real_data ? 'real' : 'mock';
      console.log(`✅ Tone profile saved with ${profile.email_samples_analyzed} ${dataType} email samples`);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving tone profile:', error);
      throw error;
    }
  }

  async getLatestToneProfile(): Promise<ToneProfile | null> {
    try {
      const query = `
        SELECT * FROM tone_profiles 
        ORDER BY created_at DESC 
        LIMIT 1;
      `;
      
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching tone profile:', error);
      throw error;
    }
  }

  async getLatestRealToneProfile(): Promise<ToneProfile | null> {
    try {
      const query = `
        SELECT * FROM tone_profiles 
        WHERE is_real_data = TRUE 
        ORDER BY created_at DESC 
        LIMIT 1;
      `;
      
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching real tone profile:', error);
      throw error;
    }
  }

  async getToneProfileHistory(limit: number = 5): Promise<ToneProfile[]> {
    try {
      const query = `
        SELECT * FROM tone_profiles 
        ORDER BY created_at DESC 
        LIMIT $1;
      `;
      
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching tone profile history:', error);
      throw error;
    }
  }

  async deleteToneProfile(profileId: number): Promise<void> {
    try {
      const query = 'DELETE FROM tone_profiles WHERE id = $1';
      await pool.query(query, [profileId]);
      console.log(`✅ Tone profile ${profileId} deleted`);
    } catch (error) {
      console.error('Error deleting tone profile:', error);
      throw error;
    }
  }

  async saveSentEmail(sentEmail: {
    gmail_id: string;
    subject: string;
    body: string;
    to_email: string;
    sent_at: Date;
  }): Promise<number> {
    try {
      const query = `
        INSERT INTO sent_emails (gmail_id, subject, body, to_email, sent_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (gmail_id) DO UPDATE SET
          subject = EXCLUDED.subject,
          body = EXCLUDED.body
        RETURNING id;
      `;
      
      const values = [
        sentEmail.gmail_id,
        sentEmail.subject,
        sentEmail.body,
        sentEmail.to_email,
        sentEmail.sent_at,
      ];

      const result = await pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error saving sent email:', error);
      throw error;
    }
  }

  async getSentEmailsForToneAnalysis(limit: number = 50): Promise<SentEmail[]> {
    try {
      const query = `
        SELECT * FROM sent_emails 
        WHERE analyzed_for_tone = FALSE
        ORDER BY sent_at DESC
        LIMIT $1;
      `;
      
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching sent emails:', error);
      throw error;
    }
  }

  async markEmailsAnalyzed(emailIds: number[]): Promise<void> {
    try {
      const query = `
        UPDATE sent_emails 
        SET analyzed_for_tone = TRUE 
        WHERE id = ANY($1);
      `;
      
      await pool.query(query, [emailIds]);
      console.log(`✅ Marked ${emailIds.length} emails as analyzed`);
    } catch (error) {
      console.error('Error marking emails as analyzed:', error);
      throw error;
    }
  }
}