import { pool } from '../database/connection';
import { AIService } from './ai';
import { ParsedEmail } from '../types';

export interface EmailThread {
  id: number;
  thread_id: string;
  subject_line: string;
  participants: string[];
  participant_count: number;
  message_count: number;
  first_message_date: Date;
  last_message_date: Date;
  is_active: boolean;
  context_summary?: string;
  key_decisions?: string[];
  commitments?: string[];
}

export interface SenderProfile {
  id: number;
  email_address: string;
  display_name?: string;
  company?: string;
  job_title?: string;
  relationship_type: string;
  relationship_strength: string;
  communication_frequency: string;
  formality_preference: string;
  response_time_expectation?: number;
  signature_pattern?: string;
  timezone?: string;
  email_count: number;
  last_interaction?: Date;
  first_interaction?: Date;
  notes?: string;
}

export interface ExtractedEntity {
  id: number;
  email_id: number;
  thread_id: string;
  entity_type: string;
  entity_value: string;
  entity_context: string;
  confidence_score: number;
  extraction_method: string;
  is_verified: boolean;
}

export interface ContextMemory {
  id: number;
  memory_type: string;
  title: string;
  content: string;
  context_tags: string[];
  related_emails: number[];
  related_threads: string[];
  related_entities: number[];
  importance_score: number;
  last_referenced: Date;
  reference_count: number;
}

export class ContextService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  // Thread Context Analysis
  async analyzeThreadContext(emails: ParsedEmail[]): Promise<EmailThread | null> {
    if (emails.length === 0) return null;

    try {
      const threadId = emails[0].threadId;
      const participants = [...new Set(emails.map(email => email.from))];
      
      // Sort emails by date to understand conversation flow
      const sortedEmails = emails.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      console.log(`🧵 Analyzing thread context for ${threadId} (${emails.length} emails, ${participants.length} participants)`);

      // Generate context summary using AI
      const contextSummary = await this.generateThreadSummary(sortedEmails);
      
      // Extract key decisions and commitments
      const keyDecisions = await this.extractKeyDecisions(sortedEmails);
      const commitments = await this.extractCommitments(sortedEmails);

      // Store or update thread context
      const threadContext: EmailThread = {
        id: 0, // Will be set by database
        thread_id: threadId,
        subject_line: emails[0].subject,
        participants,
        participant_count: participants.length,
        message_count: emails.length,
        first_message_date: sortedEmails[0].date,
        last_message_date: sortedEmails[sortedEmails.length - 1].date,
        is_active: this.isThreadActive(sortedEmails),
        context_summary: contextSummary,
        key_decisions: keyDecisions,
        commitments
      };

      return await this.saveThreadContext(threadContext);
    } catch (error) {
      console.error('❌ Error analyzing thread context:', error);
      return null;
    }
  }

  private async generateThreadSummary(emails: ParsedEmail[]): Promise<string> {
    try {
      const conversationText = emails.map((email, index) => 
        `Email ${index + 1} (${email.from}): ${email.subject}\n${email.body.substring(0, 300)}`
      ).join('\n\n---\n\n');

      const prompt = `Analyze this email conversation thread and provide a concise summary:

${conversationText}

Provide a 2-3 sentence summary covering:
1. Main topic/purpose of the conversation
2. Key participants and their roles
3. Current status or next steps

Keep it factual and concise.`;

      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || 'Conversation thread analysis';
    } catch (error) {
      console.error('❌ Error generating thread summary:', error);
      return 'Unable to generate thread summary';
    }
  }

  private async extractKeyDecisions(emails: ParsedEmail[]): Promise<string[]> {
    try {
      const conversationText = emails.map(email => email.body).join('\n\n');
      
      const prompt = `Extract key decisions made in this email conversation:

${conversationText.substring(0, 2000)}

Return ONLY the key decisions as a JSON array of strings. If no clear decisions, return empty array.
Example: ["Decided to meet Tuesday at 2pm", "Agreed to use PostgreSQL database"]`;

      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return [];

      try {
        const decisions = JSON.parse(content);
        return Array.isArray(decisions) ? decisions : [];
      } catch {
        // Fallback: try to extract decisions from text response
        return content.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
      }
    } catch (error) {
      console.error('❌ Error extracting key decisions:', error);
      return [];
    }
  }

  private async extractCommitments(emails: ParsedEmail[]): Promise<string[]> {
    try {
      const conversationText = emails.map(email => email.body).join('\n\n');
      
      const prompt = `Extract commitments and action items from this email conversation:

${conversationText.substring(0, 2000)}

Return ONLY commitments/action items as a JSON array of strings. If none found, return empty array.
Example: ["John will send the proposal by Friday", "Team will review the code by Monday"]`;

      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return [];

      try {
        const commitments = JSON.parse(content);
        return Array.isArray(commitments) ? commitments : [];
      } catch {
        return content.split('\n').filter(line => line.trim().length > 0).slice(0, 5);
      }
    } catch (error) {
      console.error('❌ Error extracting commitments:', error);
      return [];
    }
  }

  private isThreadActive(emails: ParsedEmail[]): boolean {
    if (emails.length === 0) return false;
    
    const lastEmail = emails[emails.length - 1];
    const daysSinceLastEmail = (Date.now() - lastEmail.date.getTime()) / (1000 * 60 * 60 * 24);
    
    // Consider thread active if last email was within 7 days
    return daysSinceLastEmail <= 7;
  }

  private async saveThreadContext(threadContext: EmailThread): Promise<EmailThread> {
    try {
      const query = `
        INSERT INTO email_threads (
          thread_id, subject_line, participants, participant_count, 
          message_count, first_message_date, last_message_date, is_active,
          context_summary, key_decisions, commitments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (thread_id) DO UPDATE SET
          subject_line = EXCLUDED.subject_line,
          participants = EXCLUDED.participants,
          participant_count = EXCLUDED.participant_count,
          message_count = EXCLUDED.message_count,
          last_message_date = EXCLUDED.last_message_date,
          is_active = EXCLUDED.is_active,
          context_summary = EXCLUDED.context_summary,
          key_decisions = EXCLUDED.key_decisions,
          commitments = EXCLUDED.commitments,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const values = [
        threadContext.thread_id,
        threadContext.subject_line,
        threadContext.participants,
        threadContext.participant_count,
        threadContext.message_count,
        threadContext.first_message_date,
        threadContext.last_message_date,
        threadContext.is_active,
        threadContext.context_summary,
        threadContext.key_decisions,
        threadContext.commitments
      ];

      const result = await pool.query(query, values);
      console.log(`✅ Thread context saved: ${threadContext.thread_id}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error saving thread context:', error);
      throw error;
    }
  }

  // Sender Intelligence Analysis
  async analyzeSender(email: ParsedEmail): Promise<SenderProfile> {
    try {
      console.log(`👤 Analyzing sender profile: ${email.from}`);

      // Check if sender profile already exists
      let senderProfile = await this.getSenderProfile(email.from);
      
      if (!senderProfile) {
        // Create new sender profile
        senderProfile = await this.createSenderProfile(email);
      } else {
        // Update existing profile
        senderProfile = await this.updateSenderProfile(senderProfile, email);
      }

      return senderProfile;
    } catch (error) {
      console.error('❌ Error analyzing sender:', error);
      throw error;
    }
  }

  public async getSenderProfile(emailAddress: string): Promise<SenderProfile | null> {
    try {
      const query = 'SELECT * FROM sender_profiles WHERE email_address = $1';
      const result = await pool.query(query, [emailAddress]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching sender profile:', error);
      return null;
    }
  }

  private async createSenderProfile(email: ParsedEmail): Promise<SenderProfile> {
    try {
      // Extract sender information from email
      const displayName = this.extractDisplayName(email.from);
      const company = await this.extractCompanyFromSignature(email.body);
      const jobTitle = await this.extractJobTitleFromSignature(email.body);
      const relationshipType = this.classifyRelationship(email);
      const formalityPreference = this.analyzeFormalityLevel(email.body);

      const query = `
        INSERT INTO sender_profiles (
          email_address, display_name, company, job_title, 
          relationship_type, relationship_strength, communication_frequency,
          formality_preference, email_count, first_interaction, last_interaction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;

      const values = [
        email.from,
        displayName,
        company,
        jobTitle,
        relationshipType,
        'weak', // Initial relationship strength
        'rare', // Initial communication frequency
        formalityPreference,
        1, // First email
        email.date,
        email.date
      ];

      const result = await pool.query(query, values);
      console.log(`✅ New sender profile created: ${email.from}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating sender profile:', error);
      throw error;
    }
  }

  private async updateSenderProfile(profile: SenderProfile, email: ParsedEmail): Promise<SenderProfile> {
    try {
      const query = `
        UPDATE sender_profiles 
        SET email_count = email_count + 1,
            last_interaction = $1,
            communication_frequency = $2,
            relationship_strength = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE email_address = $4
        RETURNING *;
      `;

      // Calculate updated communication frequency and relationship strength
      const newFrequency = this.calculateCommunicationFrequency(profile);
      const newStrength = this.calculateRelationshipStrength(profile);

      const values = [email.date, newFrequency, newStrength, email.from];
      const result = await pool.query(query, values);
      
      console.log(`✅ Sender profile updated: ${email.from} (${profile.email_count + 1} emails)`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating sender profile:', error);
      throw error;
    }
  }

  private extractDisplayName(fromField: string): string {
    // Extract name from "Name <email@domain.com>" format
    const match = fromField.match(/^(.+?)\s*<(.+)>$/);
    if (match) {
      return match[1].trim().replace(/"/g, '');
    }
    return fromField.split('@')[0]; // Fallback to email username
  }

  private async extractCompanyFromSignature(emailBody: string): Promise<string | undefined> {
    // Simple regex-based company extraction from signature
    const companyPatterns = [
      /(?:at|@)\s+([A-Z][A-Za-z\s&.,]+(?:Inc|LLC|Corp|Company|Ltd))/i,
      /([A-Z][A-Za-z\s&.,]+(?:Inc|LLC|Corp|Company|Ltd))/i
    ];

    for (const pattern of companyPatterns) {
      const match = emailBody.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private async extractJobTitleFromSignature(emailBody: string): Promise<string | undefined> {
    // Extract job titles from common signature patterns
    const titlePatterns = [
      /(CEO|CTO|CFO|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Consultant|President)/i,
      /(?:^|\n)([A-Z][a-z]+(?: [A-Z][a-z]+)*),?\s*$/m
    ];

    for (const pattern of titlePatterns) {
      const match = emailBody.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private classifyRelationship(email: ParsedEmail): string {
    // Basic relationship classification based on email patterns
    const body = email.body.toLowerCase();
    const subject = email.subject.toLowerCase();

    // Check for boss/authority indicators
    if (body.includes('please ensure') || body.includes('need this by') || subject.includes('urgent')) {
      return 'boss';
    }

    // Check for client indicators
    if (body.includes('proposal') || body.includes('quote') || body.includes('invoice')) {
      return 'client';
    }

    // Check for vendor indicators
    if (body.includes('service') || body.includes('product') || body.includes('offer')) {
      return 'vendor';
    }

    // Default to peer
    return 'peer';
  }

  private analyzeFormalityLevel(emailBody: string): string {
    const body = emailBody.toLowerCase();
    
    // Check for formal indicators
    const formalIndicators = ['dear sir', 'yours sincerely', 'respectfully', 'kindly', 'pursuant'];
    const casualIndicators = ['hey', 'thanks!', 'cheers', 'catch up', 'let me know'];

    const formalScore = formalIndicators.reduce((score, indicator) => 
      score + (body.includes(indicator) ? 1 : 0), 0);
    const casualScore = casualIndicators.reduce((score, indicator) => 
      score + (body.includes(indicator) ? 1 : 0), 0);

    if (formalScore > casualScore) return 'formal';
    if (casualScore > formalScore) return 'casual';
    return 'semi-formal';
  }

  private calculateCommunicationFrequency(profile: SenderProfile): string {
    if (profile.email_count >= 10) return 'daily';
    if (profile.email_count >= 5) return 'weekly';
    if (profile.email_count >= 2) return 'monthly';
    return 'rare';
  }

  private calculateRelationshipStrength(profile: SenderProfile): string {
    if (profile.email_count >= 10) return 'strong';
    if (profile.email_count >= 5) return 'medium';
    return 'weak';
  }

  // Get thread context for draft generation
  public async getThreadContext(threadId: string): Promise<any> {
    try {
      const query = `
        SELECT * 
        FROM email_threads 
        WHERE thread_id = $1
      `;
      const result = await pool.query(query, [threadId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching thread context:', error);
      return null;
    }
  }

  async getThreadContextForDraft(threadId: string): Promise<string> {
    try {
      const query = `
        SELECT context_summary, key_decisions, commitments 
        FROM email_threads 
        WHERE thread_id = $1
      `;
      
      const result = await pool.query(query, [threadId]);
      if (result.rows.length === 0) return '';

      const thread = result.rows[0];
      let context = '';
      
      if (thread.context_summary) {
        context += `Thread Context: ${thread.context_summary}\n`;
      }
      
      if (thread.key_decisions && thread.key_decisions.length > 0) {
        context += `Previous Decisions: ${thread.key_decisions.join(', ')}\n`;
      }
      
      if (thread.commitments && thread.commitments.length > 0) {
        context += `Commitments Made: ${thread.commitments.join(', ')}\n`;
      }

      return context.trim();
    } catch (error) {
      console.error('❌ Error getting thread context:', error);
      return '';
    }
  }

  // Get sender context for draft generation
  async getSenderContextForDraft(senderEmail: string): Promise<string> {
    try {
      const profile = await this.getSenderProfile(senderEmail);
      if (!profile) return '';

      let context = `Sender: ${profile.display_name || senderEmail}`;
      
      if (profile.company) context += ` (${profile.company})`;
      if (profile.job_title) context += `, ${profile.job_title}`;
      
      context += `\nRelationship: ${profile.relationship_type} (${profile.relationship_strength})`;
      context += `\nCommunication: ${profile.formality_preference}, ${profile.communication_frequency}`;
      
      if (profile.email_count > 1) {
        context += `\nHistory: ${profile.email_count} previous emails`;
      }

      return context;
    } catch (error) {
      console.error('❌ Error getting sender context:', error);
      return '';
    }
  }

  // Entity Extraction
  async extractEntities(email: ParsedEmail): Promise<ExtractedEntity[]> {
    try {
      console.log(`🔍 Extracting entities from email: ${email.id}`);

      const entities: ExtractedEntity[] = [];

      // Extract companies using AI and regex
      const companies = await this.extractCompanies(email);
      entities.push(...companies);

      // Extract people names
      const people = await this.extractPeople(email);
      entities.push(...people);

      // Extract projects and initiatives
      const projects = await this.extractProjects(email);
      entities.push(...projects);

      // Extract dates and deadlines
      const dates = this.extractDates(email);
      entities.push(...dates);

      // Extract amounts and financial information
      const amounts = this.extractAmounts(email);
      entities.push(...amounts);

      // Save entities to database
      for (const entity of entities) {
        await this.saveEntity(entity);
      }

      console.log(`✅ Extracted ${entities.length} entities from email ${email.id}`);
      return entities;
    } catch (error) {
      console.error('❌ Error extracting entities:', error);
      return [];
    }
  }

  private async extractCompanies(email: ParsedEmail): Promise<ExtractedEntity[]> {
    try {
      const prompt = `Extract company names from this email content:

Subject: ${email.subject}
Body: ${email.body.substring(0, 1000)}

Return ONLY a JSON array of company names found. Include context where found.
Example: [{"name": "Google Inc", "context": "meeting with Google Inc representatives"}]`;

      const response = await this.aiService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) return [];

      try {
        const companies = JSON.parse(content);
        return Array.isArray(companies) ? companies.map(company => ({
          id: 0,
          email_id: parseInt(email.id),
          thread_id: email.threadId,
          entity_type: 'company',
          entity_value: typeof company === 'string' ? company : company.name,
          entity_context: typeof company === 'object' ? company.context : '',
          confidence_score: 80,
          extraction_method: 'ai',
          is_verified: false
        })) : [];
      } catch {
        return [];
      }
    } catch (error) {
      console.error('❌ Error extracting companies:', error);
      return [];
    }
  }

  private async extractPeople(email: ParsedEmail): Promise<ExtractedEntity[]> {
    try {
      // Use regex for common name patterns
      const namePatterns = [
        /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // First Last
        /\b([A-Z][a-z]+ [A-Z]\. [A-Z][a-z]+)\b/g, // First M. Last
      ];

      const entities: ExtractedEntity[] = [];
      const emailText = `${email.subject} ${email.body}`;

      for (const pattern of namePatterns) {
        let match;
        while ((match = pattern.exec(emailText)) !== null) {
          const name = match[1];
          
          // Skip common false positives
          if (this.isLikelyPersonName(name)) {
            entities.push({
              id: 0,
              email_id: parseInt(email.id),
              thread_id: email.threadId,
              entity_type: 'person',
              entity_value: name,
              entity_context: this.getContextAroundMatch(emailText, match.index, name.length),
              confidence_score: 70,
              extraction_method: 'regex',
              is_verified: false
            });
          }
        }
      }

      // Remove duplicates
      return entities.filter((entity, index, self) => 
        self.findIndex(e => e.entity_value === entity.entity_value) === index
      );
    } catch (error) {
      console.error('❌ Error extracting people:', error);
      return [];
    }
  }

  private async extractProjects(email: ParsedEmail): Promise<ExtractedEntity[]> {
    try {
      const projectKeywords = [
        'project', 'initiative', 'campaign', 'launch', 'program', 
        'release', 'version', 'phase', 'milestone'
      ];

      const entities: ExtractedEntity[] = [];
      const emailText = `${email.subject} ${email.body}`.toLowerCase();

      // Look for project mentions
      for (const keyword of projectKeywords) {
        const regex = new RegExp(`\\b${keyword}\\s+([A-Za-z0-9\\s]+?)\\b`, 'gi');
        let match;
        
        while ((match = regex.exec(emailText)) !== null) {
          const projectName = match[1].trim().substring(0, 50); // Limit length
          
          if (projectName.length > 3) {
            entities.push({
              id: 0,
              email_id: parseInt(email.id),
              thread_id: email.threadId,
              entity_type: 'project',
              entity_value: projectName,
              entity_context: this.getContextAroundMatch(emailText, match.index, match[0].length),
              confidence_score: 60,
              extraction_method: 'regex',
              is_verified: false
            });
          }
        }
      }

      return entities.slice(0, 5); // Limit to 5 projects per email
    } catch (error) {
      console.error('❌ Error extracting projects:', error);
      return [];
    }
  }

  private extractDates(email: ParsedEmail): ExtractedEntity[] {
    try {
      const entities: ExtractedEntity[] = [];
      const emailText = `${email.subject} ${email.body}`;

      // Date patterns
      const datePatterns = [
        /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g, // MM/DD/YYYY
        /\b(\d{1,2}-\d{1,2}-\d{4})\b/g, // MM-DD-YYYY
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
        /\b(next|this)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
        /\b(today|tomorrow|next week|next month)\b/gi
      ];

      for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(emailText)) !== null) {
          entities.push({
            id: 0,
            email_id: parseInt(email.id),
            thread_id: email.threadId,
            entity_type: 'date',
            entity_value: match[1] || match[0],
            entity_context: this.getContextAroundMatch(emailText, match.index, match[0].length),
            confidence_score: 85,
            extraction_method: 'regex',
            is_verified: false
          });
        }
      }

      return entities.slice(0, 10); // Limit to 10 dates per email
    } catch (error) {
      console.error('❌ Error extracting dates:', error);
      return [];
    }
  }

  private extractAmounts(email: ParsedEmail): ExtractedEntity[] {
    try {
      const entities: ExtractedEntity[] = [];
      const emailText = `${email.subject} ${email.body}`;

      // Amount patterns
      const amountPatterns = [
        /\$[\d,]+(?:\.\d{2})?/g, // $1,000.00
        /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|USD|usd)\b/gi,
        /\b(?:budget|cost|price|fee|amount|total|revenue|profit|loss)\s*:?\s*\$?[\d,]+(?:\.\d{2})?/gi
      ];

      for (const pattern of amountPatterns) {
        let match;
        while ((match = pattern.exec(emailText)) !== null) {
          entities.push({
            id: 0,
            email_id: parseInt(email.id),
            thread_id: email.threadId,
            entity_type: 'amount',
            entity_value: match[0],
            entity_context: this.getContextAroundMatch(emailText, match.index, match[0].length),
            confidence_score: 90,
            extraction_method: 'regex',
            is_verified: false
          });
        }
      }

      return entities.slice(0, 5); // Limit to 5 amounts per email
    } catch (error) {
      console.error('❌ Error extracting amounts:', error);
      return [];
    }
  }

  private isLikelyPersonName(name: string): boolean {
    // Filter out common false positives
    const falsePositives = [
      'Best Regards', 'Thank You', 'Please Let', 'Will Be', 'New York',
      'San Francisco', 'Los Angeles', 'United States', 'Machine Learning'
    ];
    
    return !falsePositives.some(fp => 
      name.toLowerCase().includes(fp.toLowerCase())
    ) && name.length <= 30;
  }

  private getContextAroundMatch(text: string, matchIndex: number, matchLength: number): string {
    const start = Math.max(0, matchIndex - 50);
    const end = Math.min(text.length, matchIndex + matchLength + 50);
    return text.substring(start, end).trim();
  }

  private async saveEntity(entity: ExtractedEntity): Promise<void> {
    try {
      const query = `
        INSERT INTO extracted_entities (
          email_id, thread_id, entity_type, entity_value, 
          entity_context, confidence_score, extraction_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING;
      `;

      const values = [
        entity.email_id,
        entity.thread_id,
        entity.entity_type,
        entity.entity_value,
        entity.entity_context,
        entity.confidence_score,
        entity.extraction_method
      ];

      await pool.query(query, values);
    } catch (error) {
      console.error('❌ Error saving entity:', error);
    }
  }

  // Get entities for context
  async getEntitiesForThread(threadId: string): Promise<ExtractedEntity[]> {
    try {
      const query = `
        SELECT * FROM extracted_entities 
        WHERE thread_id = $1 
        ORDER BY confidence_score DESC, created_at DESC
      `;
      
      const result = await pool.query(query, [threadId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting entities for thread:', error);
      return [];
    }
  }

  // Comprehensive context for draft generation
  async getFullContextForDraft(email: ParsedEmail): Promise<string> {
    try {
      let fullContext = '';

      // Get thread context
      const threadContext = await this.getThreadContextForDraft(email.threadId);
      if (threadContext) {
        fullContext += `\n=== THREAD CONTEXT ===\n${threadContext}\n`;
      }

      // Get sender context
      const senderContext = await this.getSenderContextForDraft(email.from);
      if (senderContext) {
        fullContext += `\n=== SENDER CONTEXT ===\n${senderContext}\n`;
      }

      // Get relevant entities
      const entities = await this.getEntitiesForThread(email.threadId);
      if (entities.length > 0) {
        const entitySummary = entities
          .slice(0, 10) // Top 10 entities
          .map(e => `${e.entity_type}: ${e.entity_value}`)
          .join(', ');
        fullContext += `\n=== ENTITIES MENTIONED ===\n${entitySummary}\n`;
      }

      return fullContext.trim();
    } catch (error) {
      console.error('❌ Error getting full context:', error);
      return '';
    }
  }

  // Phase 2.4: Just-in-time context analysis for specific emails
  async analyzeEmailsJustInTime(emails: ParsedEmail[]): Promise<{
    senderProfiles: SenderProfile[];
    threadContexts: EmailThread[];
    entities: ExtractedEntity[];
    analysisTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting just-in-time analysis for ${emails.length} emails...`);
      
      const results = {
        senderProfiles: [] as SenderProfile[],
        threadContexts: [] as EmailThread[],
        entities: [] as ExtractedEntity[],
        analysisTime: 0
      };

      // Group emails by thread for efficient processing
      const emailsByThread = new Map<string, ParsedEmail[]>();
      for (const email of emails) {
        const threadId = email.threadId;
        if (!emailsByThread.has(threadId)) {
          emailsByThread.set(threadId, []);
        }
        emailsByThread.get(threadId)!.push(email);
      }

      // Analyze each thread
      for (const [threadId, threadEmails] of emailsByThread) {
        try {
          // Analyze thread context (only if multiple emails in thread)
          if (threadEmails.length > 1) {
            console.log(`🧵 Analyzing thread context for ${threadId} (${threadEmails.length} emails)`);
            const threadContext = await this.analyzeThreadContext(threadEmails);
            if (threadContext) {
              results.threadContexts.push(threadContext);
            }
          }

          // Analyze unique senders in this thread
          const uniqueSenders = [...new Set(threadEmails.map(email => email.from))];
          for (const sender of uniqueSenders) {
            try {
              console.log(`👤 Analyzing sender: ${sender}`);
              const senderProfile = await this.analyzeSender(threadEmails.find(e => e.from === sender)!);
              results.senderProfiles.push(senderProfile);
            } catch (error) {
              console.warn(`⚠️ Could not analyze sender ${sender}:`, error);
            }
          }

          // Extract entities from each email
          for (const email of threadEmails) {
            try {
              console.log(`🏷️ Extracting entities from email ${email.id}`);
              const entities = await this.extractEntities(email);
              results.entities.push(...entities);
            } catch (error) {
              console.warn(`⚠️ Could not extract entities from email ${email.id}:`, error);
            }
          }

        } catch (error) {
          console.warn(`⚠️ Error analyzing thread ${threadId}:`, error);
        }
      }

      const analysisTime = (Date.now() - startTime) / 1000;
      results.analysisTime = analysisTime;

      console.log(`✅ Just-in-time analysis completed in ${analysisTime.toFixed(1)}s:`);
      console.log(`  - ${results.senderProfiles.length} sender profiles analyzed`);
      console.log(`  - ${results.threadContexts.length} thread contexts created`);
      console.log(`  - ${results.entities.length} entities extracted`);

      return results;

    } catch (error) {
      console.error('❌ Error in just-in-time analysis:', error);
      return {
        senderProfiles: [],
        threadContexts: [],
        entities: [],
        analysisTime: (Date.now() - startTime) / 1000
      };
    }
  }

  // Analyze a single sender's profile from recent emails (lightweight version)
  async quickSenderAnalysis(senderEmail: string, recentEmails: ParsedEmail[]): Promise<SenderProfile | null> {
    try {
      console.log(`⚡ Quick sender analysis for ${senderEmail} based on ${recentEmails.length} emails...`);

      if (recentEmails.length === 0) return null;

      // Use the first email for basic analysis, but consider patterns across all
      const firstEmail = recentEmails[0];
      const fullAnalysis = await this.analyzeSender(firstEmail);

      // Enhance with patterns from recent emails
      const subjects = recentEmails.map(email => email.subject.toLowerCase());
      const avgLength = recentEmails.reduce((sum, email) => sum + email.body.length, 0) / recentEmails.length;
      
      // Determine communication frequency based on recent emails
      let frequency = 'weekly';
      if (recentEmails.length >= 10) frequency = 'daily';
      else if (recentEmails.length >= 5) frequency = 'weekly';
      else frequency = 'monthly';

      // Update the profile with recent patterns
      fullAnalysis.communication_frequency = frequency;
      fullAnalysis.email_count = recentEmails.length;
      fullAnalysis.notes = `Recent communication patterns: avg ${Math.round(avgLength)} chars per email`;

      console.log(`✅ Quick sender analysis completed for ${senderEmail}`);
      return fullAnalysis;

    } catch (error) {
      console.error(`❌ Error in quick sender analysis for ${senderEmail}:`, error);
      return null;
    }
  }
}