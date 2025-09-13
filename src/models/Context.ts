import { pool } from '../database/connection';
import { ContextMemory } from '../services/context';

export class ContextModel {
  
  // Process email through full context analysis pipeline
  async processEmailForContext(emailId: number): Promise<void> {
    try {
      console.log(`🔄 Processing email ${emailId} for full context analysis`);
      
      // Mark email as being processed
      await pool.query(
        'UPDATE emails SET context_analyzed = FALSE WHERE id = $1',
        [emailId]
      );

      // Context analysis will be triggered by the service layer
      console.log(`✅ Email ${emailId} queued for context processing`);
    } catch (error) {
      console.error('❌ Error processing email for context:', error);
      throw error;
    }
  }

  // Mark email as context analyzed
  async markEmailContextAnalyzed(emailId: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE emails SET context_analyzed = TRUE WHERE id = $1',
        [emailId]
      );
      console.log(`✅ Email ${emailId} marked as context analyzed`);
    } catch (error) {
      console.error('❌ Error marking email as analyzed:', error);
      throw error;
    }
  }

  // Get emails that need context analysis
  async getEmailsNeedingContextAnalysis(limit: number = 20): Promise<any[]> {
    try {
      const query = `
        SELECT e.*, et.thread_id as existing_thread_id 
        FROM emails e
        LEFT JOIN email_threads et ON e.thread_id = et.thread_id
        WHERE e.context_analyzed = FALSE
        ORDER BY e.received_at DESC
        LIMIT $1
      `;
      
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting emails for context analysis:', error);
      return [];
    }
  }

  // Store contextual memory
  async saveContextMemory(memory: {
    memory_type: string;
    title: string;
    content: string;
    context_tags: string[];
    related_emails: number[];
    related_threads: string[];
    related_entities: number[];
    importance_score: number;
  }): Promise<number> {
    try {
      const query = `
        INSERT INTO context_memories (
          memory_type, title, content, context_tags,
          related_emails, related_threads, related_entities, importance_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id;
      `;

      const values = [
        memory.memory_type,
        memory.title,
        memory.content,
        memory.context_tags,
        memory.related_emails,
        memory.related_threads,
        memory.related_entities,
        memory.importance_score
      ];

      const result = await pool.query(query, values);
      console.log(`✅ Context memory saved: ${memory.title}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error saving context memory:', error);
      throw error;
    }
  }

  // Search context memories
  async searchContextMemories(query: string, limit: number = 10): Promise<ContextMemory[]> {
    try {
      // Simple text search for now (can be enhanced with vector search later)
      const searchQuery = `
        SELECT * FROM context_memories
        WHERE content ILIKE $1 OR title ILIKE $1 OR $2 = ANY(context_tags)
        ORDER BY importance_score DESC, reference_count DESC
        LIMIT $3;
      `;

      const searchTerm = `%${query}%`;
      const result = await pool.query(searchQuery, [searchTerm, query, limit]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error searching context memories:', error);
      return [];
    }
  }

  // Update memory reference count
  async incrementMemoryReference(memoryId: number): Promise<void> {
    try {
      await pool.query(`
        UPDATE context_memories 
        SET reference_count = reference_count + 1,
            last_referenced = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [memoryId]);
    } catch (error) {
      console.error('❌ Error updating memory reference:', error);
    }
  }

  // Get context statistics
  async getContextStats(): Promise<any> {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_emails,
          COUNT(*) FILTER (WHERE context_analyzed = TRUE) as analyzed_emails,
          COUNT(*) FILTER (WHERE context_analyzed = FALSE) as pending_emails,
          (SELECT COUNT(*) FROM email_threads) as total_threads,
          (SELECT COUNT(*) FROM sender_profiles) as total_senders,
          (SELECT COUNT(*) FROM extracted_entities) as total_entities,
          (SELECT COUNT(*) FROM context_memories) as total_memories
        FROM emails;
      `);

      return stats.rows[0];
    } catch (error) {
      console.error('❌ Error getting context stats:', error);
      return {};
    }
  }

  // Get thread analytics
  async getThreadAnalytics(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          thread_id,
          subject_line,
          participant_count,
          message_count,
          is_active,
          EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - last_message_date)) as days_since_last,
          array_length(key_decisions, 1) as decisions_count,
          array_length(commitments, 1) as commitments_count
        FROM email_threads
        ORDER BY last_message_date DESC
        LIMIT 20;
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting thread analytics:', error);
      return [];
    }
  }

  // Get sender relationship insights
  async getSenderInsights(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          email_address,
          display_name,
          company,
          job_title,
          relationship_type,
          relationship_strength,
          communication_frequency,
          email_count,
          EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - last_interaction)) as days_since_last
        FROM sender_profiles
        ORDER BY email_count DESC, last_interaction DESC
        LIMIT 20;
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting sender insights:', error);
      return [];
    }
  }

  // Get entity insights
  async getEntityInsights(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          entity_type,
          entity_value,
          COUNT(*) as mention_count,
          AVG(confidence_score) as avg_confidence,
          MAX(created_at) as last_mentioned
        FROM extracted_entities
        GROUP BY entity_type, entity_value
        HAVING COUNT(*) >= 2
        ORDER BY mention_count DESC, avg_confidence DESC
        LIMIT 50;
      `;

      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting entity insights:', error);
      return [];
    }
  }

  // Get context for specific thread
  async getThreadFullContext(threadId: string): Promise<any> {
    try {
      const threadQuery = `
        SELECT * FROM email_threads WHERE thread_id = $1
      `;
      
      const entitiesQuery = `
        SELECT entity_type, entity_value, confidence_score
        FROM extracted_entities 
        WHERE thread_id = $1
        ORDER BY confidence_score DESC
      `;

      const memoriesQuery = `
        SELECT title, content, memory_type, importance_score
        FROM context_memories
        WHERE $1 = ANY(related_threads)
        ORDER BY importance_score DESC
      `;

      const [threadResult, entitiesResult, memoriesResult] = await Promise.all([
        pool.query(threadQuery, [threadId]),
        pool.query(entitiesQuery, [threadId]),
        pool.query(memoriesQuery, [threadId])
      ]);

      return {
        thread: threadResult.rows[0],
        entities: entitiesResult.rows,
        memories: memoriesResult.rows
      };
    } catch (error) {
      console.error('❌ Error getting thread full context:', error);
      return null;
    }
  }

  // Clean up old context data
  async cleanupOldContext(daysOld: number = 90): Promise<void> {
    try {
      console.log(`🧹 Cleaning up context data older than ${daysOld} days...`);

      // Clean old entities from inactive threads
      await pool.query(`
        DELETE FROM extracted_entities 
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
        AND thread_id IN (
          SELECT thread_id FROM email_threads WHERE is_active = FALSE
        );
      `);

      // Clean old memories with low importance and no recent references
      await pool.query(`
        DELETE FROM context_memories 
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
        AND importance_score < 30
        AND last_referenced < CURRENT_TIMESTAMP - INTERVAL '${daysOld/2} days';
      `);

      // Update inactive threads
      await pool.query(`
        UPDATE email_threads 
        SET is_active = FALSE
        WHERE last_message_date < CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND is_active = TRUE;
      `);

      console.log(`✅ Context cleanup completed`);
    } catch (error) {
      console.error('❌ Error cleaning up old context:', error);
    }
  }

  // Context health check
  async contextHealthCheck(): Promise<any> {
    try {
      const healthQueries = [
        // Check for emails missing context analysis
        `SELECT COUNT(*) as unprocessed_emails FROM emails WHERE context_analyzed = FALSE`,
        
        // Check for threads without context
        `SELECT COUNT(*) as threads_no_context FROM email_threads WHERE context_summary IS NULL`,
        
        // Check for senders without profiles
        `SELECT COUNT(DISTINCT from_email) as senders_no_profile 
         FROM emails e 
         WHERE NOT EXISTS (SELECT 1 FROM sender_profiles sp WHERE sp.email_address = e.from_email)`,
        
        // Check entity extraction health
        `SELECT 
           COUNT(*) as total_entities,
           AVG(confidence_score) as avg_confidence
         FROM extracted_entities`,
         
        // Check memory bank health
        `SELECT 
           COUNT(*) as total_memories,
           COUNT(*) FILTER (WHERE last_referenced > CURRENT_TIMESTAMP - INTERVAL '7 days') as recent_memories
         FROM context_memories`
      ];

      const results = await Promise.all(
        healthQueries.map(query => pool.query(query))
      );

      const health = {
        unprocessed_emails: results[0].rows[0].unprocessed_emails,
        threads_no_context: results[1].rows[0].threads_no_context,
        senders_no_profile: results[2].rows[0].senders_no_profile,
        total_entities: results[3].rows[0].total_entities,
        avg_entity_confidence: Math.round(results[3].rows[0].avg_confidence || 0),
        total_memories: results[4].rows[0].total_memories,
        recent_memories: results[4].rows[0].recent_memories,
        overall_health: 'good' // Will be calculated based on metrics
      };

      // Calculate overall health
      const issues = [
        health.unprocessed_emails > 10,
        health.threads_no_context > 5,
        health.avg_entity_confidence < 70,
        health.recent_memories === 0 && health.total_memories > 0
      ].filter(Boolean).length;

      if (issues === 0) health.overall_health = 'excellent';
      else if (issues <= 1) health.overall_health = 'good';
      else if (issues <= 2) health.overall_health = 'fair';
      else health.overall_health = 'poor';

      return health;
    } catch (error) {
      console.error('❌ Error checking context health:', error);
      return { overall_health: 'error' };
    }
  }
}