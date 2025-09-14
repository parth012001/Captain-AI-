import { AIService } from './ai';
import { ContextService } from './context';
import { ContextStrategyService } from './contextStrategy';
import { GmailService } from './gmail';
import { LearningService } from './learning';
import { pool } from '../database/connection';
import { PromptTemplateService, ResponseQualityService, PromptContext, QualityScore } from './promptTemplates';
import { UserProfileService } from './userProfile';

export interface ResponseRequest {
  emailId: string;
  recipientEmail: string;
  originalSubject: string;
  originalBody: string;
  responseType?: 'reply' | 'forward' | 'new';
  customInstructions?: string;
  userId?: string; // ✅ Add userId for user profile integration
}

export interface SmartResponse {
  id: string;
  subject: string;
  body: string;
  tone: string;
  urgencyLevel: 'high' | 'medium' | 'low';
  contextUsed: string[];
  relationshipType: string;
  generatedAt: Date;
}

export interface UrgencyKeywords {
  high: string[];
  medium: string[];
  low: string[];
}

export class ResponseService {
  private aiService: AIService;
  private contextService: ContextService;
  private contextStrategyService: ContextStrategyService;
  private gmailService: GmailService;
  private learningService: LearningService;
  private promptTemplateService: PromptTemplateService;
  private responseQualityService: ResponseQualityService;
  private userProfileService: UserProfileService; // ✅ Add UserProfileService
  private urgencyKeywords: UrgencyKeywords;

  constructor(aiService: AIService, contextService: ContextService, gmailService: GmailService) {
    this.aiService = aiService;
    this.contextService = contextService;
    this.gmailService = gmailService;
    this.contextStrategyService = new ContextStrategyService(this.gmailService, this.contextService);
    this.learningService = new LearningService(this.aiService);
    this.promptTemplateService = new PromptTemplateService();
    this.responseQualityService = new ResponseQualityService();
    this.userProfileService = new UserProfileService(pool); // ✅ Initialize UserProfileService
    this.urgencyKeywords = {
      high: ["urgent", "asap", "today", "deadline", "emergency", "immediately", "critical", "rush", "time-sensitive"],
      medium: ["soon", "this week", "priority", "important", "when possible", "at your convenience"],
      low: ["whenever", "no rush", "when you can", "eventually", "no hurry", "flexible"]
    };
  }

  async generateSmartResponse(request: ResponseRequest): Promise<SmartResponse> {
    try {
      console.log(`🤖 Generating smart response for email ${request.emailId}...`);
      
      // Step 1: Gather full context
      const contextData = await this.gatherFullContext(request);
      
      // Step 1.5: Get user profile data for personalized signatures
      let userProfile = null;
      let userSignature = null;
      if (request.userId) {
        userProfile = await this.userProfileService.getUserProfile(request.userId);
        if (userProfile) {
          userSignature = await this.userProfileService.getUserSignature(request.userId);
          contextData.userProfile = userProfile;
          contextData.userSignature = userSignature;
          console.log(`👤 User profile loaded: ${userProfile.firstName} ${userProfile.lastName}`);
        }
      }
      
      // Step 2: Detect urgency level
      const urgencyLevel = this.detectUrgency(request.originalBody);
      
      // Step 3: Get sender relationship info
      const senderProfile = await this.contextService.getSenderProfile(request.recipientEmail);
      
      // Step 4: Generate context-aware response
      const response = await this.generateContextAwareResponse(
        request, 
        contextData, 
        urgencyLevel, 
        senderProfile
      );
      
      // Step 5: Save response for tracking
      await this.saveGeneratedResponse(response, request);
      
      console.log(`✅ Smart response generated with ${response.contextUsed.length} context elements`);
      return response;
      
    } catch (error) {
      console.error('❌ Error generating smart response:', error);
      throw error;
    }
  }

  private async gatherFullContext(request: ResponseRequest): Promise<any> {
    try {
      console.log(`🎯 Starting just-in-time context gathering for ${request.recipientEmail}...`);

      // Step 1: Determine context strategy
      const email = request.emailId ? await this.getEmailById(request.emailId) : null;
      const threadId = email?.thread_id;
      
      const strategy = await this.contextStrategyService.determineContextStrategy(
        request.recipientEmail, 
        threadId
      );

      console.log(`📋 Context strategy: ${strategy.strategy} (~${strategy.processingTime}s expected)`);

      // Step 2: Gather context using determined strategy
      const gatheredContext = await this.contextStrategyService.gatherContextByStrategy(
        strategy,
        request.recipientEmail,
        threadId
      );

      // Step 3: Get user tone profile and learning insights (always needed)
      const userToneProfile = await this.getUserToneProfile();
      const learningInsights = request.userId ? await this.getRecentLearningInsights(request.userId) : [];

      // Step 4: Build context data structure (compatible with existing prompt system)
      const contextData: any = {
        // New just-in-time context
        contextStrategy: strategy.strategy,
        contextConfidence: gatheredContext.confidence,
        contextSources: gatheredContext.sources,
        
        // Existing context structure (for compatibility)
        threadHistory: gatheredContext.threadHistory ? {
          context_summary: gatheredContext.contextSummary,
          key_decisions: [],
          commitments: []
        } : null,
        
        senderProfile: gatheredContext.senderRelationship ? {
          display_name: request.recipientEmail.split('@')[0],
          email_address: request.recipientEmail,
          relationship_type: gatheredContext.senderRelationship.classification,
          email_count: gatheredContext.senderRelationship.totalEmails,
          formality_preference: gatheredContext.senderRelationship.classification === 'stranger' ? 'formal' : 
                                gatheredContext.senderRelationship.classification === 'known_contact' ? 'casual' : 'professional'
        } : null,
        
        recentEntities: [],
        decisions: [],
        commitments: [],
        userToneProfile,
        learningInsights,

        // New context data
        justInTimeContext: gatheredContext
      };

      console.log(`✅ Just-in-time context gathering completed`);
      console.log(`  - Strategy: ${strategy.strategy}`);
      console.log(`  - Sources: ${gatheredContext.sources.join(', ')}`);
      console.log(`  - Confidence: ${gatheredContext.confidence}%`);

      return contextData;

    } catch (error) {
      console.error('❌ Error in just-in-time context gathering:', error);
      
      // Fallback to basic context
      return {
        contextStrategy: 'stranger',
        contextConfidence: 0,
        contextSources: ['error_fallback'],
        threadHistory: null,
        senderProfile: null,
        recentEntities: [],
        decisions: [],
        commitments: [],
        userToneProfile: await this.getUserToneProfile(),
        learningInsights: request.userId ? await this.getRecentLearningInsights(request.userId) : [],
        justInTimeContext: {
          contextSummary: 'Error occurred during context gathering, using fallback response'
        }
      };
    }
  }

  private detectUrgency(emailBody: string): 'high' | 'medium' | 'low' {
    const lowercaseBody = emailBody.toLowerCase();
    
    // Check for explicit low urgency keywords first (most specific)
    if (this.urgencyKeywords.low.some(keyword => lowercaseBody.includes(keyword))) {
      return 'low';
    }
    
    // Check for high urgency keywords
    if (this.urgencyKeywords.high.some(keyword => lowercaseBody.includes(keyword))) {
      return 'high';
    }
    
    // Check for medium urgency keywords
    if (this.urgencyKeywords.medium.some(keyword => lowercaseBody.includes(keyword))) {
      return 'medium';
    }
    
    // Default to medium if no clear indicators
    return 'medium';
  }

  private async generateContextAwareResponse(
    request: ResponseRequest,
    contextData: any,
    urgencyLevel: 'high' | 'medium' | 'low',
    senderProfile: any
  ): Promise<SmartResponse> {
    
    console.log('🎯 Using professional prompt engineering system...');
    
    const relationshipType = senderProfile?.relationship_type || 'unknown';
    const contextUsed: string[] = ['professional_prompts'];
    
    // Build professional prompt context
    const promptContext: PromptContext = {
      relationshipType,
      urgencyLevel,
      senderProfile,
      threadHistory: contextData.threadHistory,
      userToneProfile: contextData.userToneProfile,
      learningInsights: contextData.learningInsights,
      contextSources: contextData.contextSources
    };
    
    // Get learning patterns from Phase 2.4 LearningService (USER-SPECIFIC!)
    console.log(`🧠 Getting learning patterns from Phase 2.4 LearningService for user ${request.userId ? request.userId.substring(0, 8) + '...' : 'anonymous'}...`);
    const learningPatterns = await this.learningService.generateLearningInsights(14, request.userId); // Last 14 days, user-specific
    
    // Generate professional system prompt
    let systemPrompt = this.promptTemplateService.buildSystemPrompt(relationshipType, urgencyLevel);
    
    // Add user signature instruction if available
    if (contextData.userSignature) {
      systemPrompt += `\n\nSIGNATURE REQUIREMENT:\nAlways end your email response with exactly this signature:\n${contextData.userSignature}`;
      contextUsed.push('user_signature');
      console.log(`✍️ User signature added: ${contextData.userSignature}`);
    }
    
    // BEHAVIORAL ADAPTATION: Apply learning patterns structurally (NO TEXT DUMPING!)
    if (learningPatterns.length > 0) {
      console.log('🎯 Applying', learningPatterns.length, 'learning patterns behaviorally');
      systemPrompt = this.promptTemplateService.adaptPromptFromLearning(systemPrompt, learningPatterns, relationshipType);
      contextUsed.push('behavioral_learning');
    }
    
    // Build intelligent context instructions (NO learning text dumping)
    const contextInstructions = this.promptTemplateService.buildIntelligentContext(contextData);
    
    // Build final user prompt with context
    const userPrompt = this.promptTemplateService.buildUserPrompt(request, contextInstructions);
    
    // Track context sources used
    if (contextData.threadHistory) contextUsed.push('thread_history');
    if (contextData.userToneProfile) contextUsed.push('user_tone');
    if (senderProfile) contextUsed.push('sender_relationship');
    
    console.log('📝 Prompt context built:', { relationshipType, urgencyLevel, contextSources: contextUsed });
    
    // Generate the response with professional prompts
    const aiResponse = await this.aiService.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 700 // Increased for more detailed professional responses
    });

    const generatedContent = aiResponse.choices[0]?.message?.content || '';
    
    // Parse and validate the JSON response
    const parsedResponse = await this.parseAndValidateJsonResponse(generatedContent, request.originalSubject);
    
    // Advanced quality validation
    const qualityScore = await this.responseQualityService.validateResponseQuality(
      parsedResponse, 
      request, 
      promptContext
    );
    
    console.log('📊 Response quality score:', qualityScore.overall.toFixed(1), '%');
    if (qualityScore.recommendations.length > 0) {
      console.log('💡 Quality recommendations:', qualityScore.recommendations);
    }
    
    return {
      id: this.generateResponseId(),
      subject: parsedResponse.subject,
      body: parsedResponse.body,
      tone: senderProfile?.formality_preference || 'professional',
      urgencyLevel,
      contextUsed,
      relationshipType,
      generatedAt: new Date()
    };
  }

  private buildContextPrompt(
    request: ResponseRequest,
    contextData: any,
    senderProfile: any,
    contextUsed: string[]
  ): string {
    let prompt = `Generate a professional email response to the following email:

ORIGINAL EMAIL:
Subject: ${request.originalSubject}
From: ${request.recipientEmail}
Body: ${request.originalBody}

`;

    // Add learning insights to improve response quality
    if (contextData.learningInsights && contextData.learningInsights.length > 0) {
      prompt += `LEARNED PATTERNS (Apply these improvements based on user feedback):
`;
      contextData.learningInsights.forEach((insight: any) => {
        prompt += `- ${insight.pattern_type} issue (${insight.frequency} times): ${insight.recommendation}\n`;
      });
      prompt += `\n`;
      contextUsed.push('learning_insights');
    }

    // Add thread history context
    if (contextData.threadHistory) {
      prompt += `CONVERSATION HISTORY:
${contextData.threadHistory.context_summary}

`;
      contextUsed.push('thread_history');
    }

    // Add sender relationship context
    if (senderProfile) {
      prompt += `SENDER RELATIONSHIP:
- Name: ${senderProfile.display_name}
- Company: ${senderProfile.company || 'Unknown'}
- Relationship: ${senderProfile.relationship_type}
- Communication style: ${senderProfile.formality_preference}
- Previous emails: ${senderProfile.email_count}

`;
      contextUsed.push('sender_relationship');
    }

    // Add recent entities context
    if (contextData.recentEntities && contextData.recentEntities.length > 0) {
      prompt += `RELEVANT CONTEXT:
Recent topics discussed: ${contextData.recentEntities.map((e: any) => e.entity_value).join(', ')}

`;
      contextUsed.push('recent_entities');
    }

    // Add user tone profile
    if (contextData.userToneProfile) {
      prompt += `YOUR COMMUNICATION STYLE:
- Tone: ${contextData.userToneProfile.dominant_tone}
- Formality: ${contextData.userToneProfile.formality_level}
- Key phrases: ${contextData.userToneProfile.signature_phrases?.slice(0, 3).join(', ') || 'N/A'}

`;
      contextUsed.push('user_tone');
    }

    // Add custom instructions if provided
    if (request.customInstructions) {
      prompt += `SPECIAL INSTRUCTIONS:
${request.customInstructions}

`;
      contextUsed.push('custom_instructions');
    }

    return prompt;
  }

  private getUrgencyInstructions(urgencyLevel: 'high' | 'medium' | 'low'): string {
    switch (urgencyLevel) {
      case 'high':
        return `URGENCY: HIGH - Respond promptly and acknowledge the urgency. Be direct and efficient.\n\n`;
      case 'low':
        return `URGENCY: LOW - Take a relaxed, thoughtful tone. No rush implied.\n\n`;
      default:
        return `URGENCY: MEDIUM - Balanced, professional tone with appropriate timeliness.\n\n`;
    }
  }

  private getRelationshipToneInstructions(senderProfile: any): string {
    if (!senderProfile) {
      return `TONE: Use professional, courteous language suitable for business communication.\n\n`;
    }

    const relationshipType = senderProfile.relationship_type;
    const formalityPreference = senderProfile.formality_preference;

    let instructions = `RELATIONSHIP TONE: `;
    
    switch (relationshipType) {
      case 'boss':
        instructions += `This is your supervisor. Use respectful, professional language. Be concise and action-oriented.`;
        break;
      case 'peer':
        instructions += `This is a colleague. Use collaborative, professional but friendly language.`;
        break;
      case 'client':
        instructions += `This is a client. Use service-oriented, professional language. Be helpful and solution-focused.`;
        break;
      case 'vendor':
        instructions += `This is a vendor/supplier. Use business-focused, direct language.`;
        break;
      default:
        instructions += `Use professional, courteous language.`;
    }

    if (formalityPreference) {
      instructions += ` Formality level: ${formalityPreference}.`;
    }

    return instructions + `\n\n`;
  }

  private async parseAndValidateJsonResponse(generatedContent: string, originalSubject: string): Promise<{ subject: string, body: string }> {
    try {
      console.log('🔍 Parsing AI response as JSON...');
      
      // Parse JSON response
      const parsed = JSON.parse(generatedContent);
      
      // Validate required fields
      if (!parsed.subject || !parsed.body) {
        throw new Error('Missing required fields: subject or body');
      }
      
      // Validate response content
      const validationResult = this.validateResponse(parsed);
      if (!validationResult.isValid) {
        console.warn('⚠️ Response validation failed:', validationResult.reason);
        // Don't throw here - use the response but log the issue
      }
      
      const result = {
        subject: this.sanitizeSubject(parsed.subject.trim(), originalSubject),
        body: this.sanitizeBody(parsed.body.trim())
      };
      
      console.log('✅ JSON response parsed successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Failed to parse JSON response:', error);
      console.log('Raw AI response:', generatedContent);
      
      // Fallback to text parsing for backwards compatibility
      return this.fallbackTextParsing(generatedContent, originalSubject);
    }
  }
  
  private validateResponse(response: any): { isValid: boolean, reason?: string } {
    // Basic validation rules
    if (!response.subject || response.subject.length < 3) {
      return { isValid: false, reason: 'Subject too short' };
    }
    
    if (!response.body || response.body.length < 10) {
      return { isValid: false, reason: 'Body too short' };
    }
    
    // Check for inappropriate content (basic)
    const inappropriateWords = ['fuck', 'shit', 'damn', 'asshole'];
    const bodyLower = response.body.toLowerCase();
    if (inappropriateWords.some(word => bodyLower.includes(word))) {
      return { isValid: false, reason: 'Inappropriate language detected' };
    }
    
    // Check for minimum professionalism
    if (this.lacksProfessionalism(response.body)) {
      return { isValid: false, reason: 'Lacks professional tone' };
    }
    
    return { isValid: true };
  }
  
  private lacksProfessionalism(body: string): boolean {
    const unprofessionalPatterns = [
      /^hey dude/i,
      /^sup\b/i,
      /whatever/i,
      /idk/i,
      /lol/i,
      /^yo\b/i
    ];
    
    return unprofessionalPatterns.some(pattern => pattern.test(body));
  }
  
  private sanitizeSubject(subject: string, originalSubject: string): string {
    // Ensure proper Re: formatting
    if (subject.toLowerCase().startsWith('re:')) {
      return subject;
    }
    
    // If original already has Re:, keep it
    if (originalSubject.startsWith('Re:')) {
      return originalSubject;
    }
    
    return `Re: ${originalSubject}`;
  }
  
  private sanitizeBody(body: string): string {
    // Remove any JSON artifacts that might have leaked through
    body = body.replace(/^["']|["']$/g, ''); // Remove quotes at start/end
    body = body.replace(/\\n/g, '\n'); // Convert escaped newlines
    
    // Ensure proper email formatting
    if (!body.trim().endsWith('.') && !body.trim().endsWith('!') && !body.trim().endsWith('?')) {
      body = body.trim() + '.';
    }
    
    return body.trim();
  }
  
  private fallbackTextParsing(generatedContent: string, originalSubject: string): { subject: string, body: string } {
    console.log('🔄 Using fallback text parsing...');
    
    // Try to parse structured response if AI provided one
    const subjectMatch = generatedContent.match(/Subject:\s*(.+)/i);
    const bodyMatch = generatedContent.match(/Body:\s*([\s\S]+)/i);

    let subject: string;
    let body: string;

    if (subjectMatch && bodyMatch) {
      subject = subjectMatch[1].trim();
      body = bodyMatch[1].trim();
    } else {
      // Treat entire content as body, generate subject
      body = generatedContent.trim();
      subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
    }

    return { 
      subject: this.sanitizeSubject(subject, originalSubject),
      body: this.sanitizeBody(body)
    };
  }


  /**
   * NEW: Record user edit for learning (proper Phase 2.4 integration)
   * Call this when user edits a response to feed back into learning system
   */
  async recordUserEdit(responseId: string, originalResponse: string, editedResponse: string): Promise<void> {
    try {
      console.log('📚 Recording user edit for learning system...');
      
      // Use Phase 2.4 LearningService to analyze the edit
      const editAnalysis = await this.learningService.analyzeEdit(responseId, originalResponse, editedResponse);
      
      console.log(`✅ Edit analysis completed: ${editAnalysis.editType} with ${editAnalysis.successScore}% success score`);
      console.log(`🎯 Learning insight: ${editAnalysis.learningInsight}`);
      
      // This will automatically update learning insights in the database via triggers
      // The next response generation will use these improved patterns
      
    } catch (error) {
      console.error('❌ Error recording user edit for learning:', error);
    }
  }

  /**
   * NEW: Get learning-enhanced success metrics (Phase 2.4 integration)
   */
  async getLearningMetrics(days: number = 7): Promise<any> {
    try {
      return await this.learningService.calculateSuccessMetrics(days);
    } catch (error) {
      console.error('❌ Error getting learning metrics:', error);
      return null;
    }
  }

  private generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private async saveGeneratedResponse(response: SmartResponse, request: ResponseRequest): Promise<void> {
    try {
      // Validate that userId is provided for proper user isolation
      if (!request.userId) {
        console.warn('⚠️ saveGeneratedResponse called without userId - this may cause user isolation issues');
      }

      const query = `
        INSERT INTO generated_responses (
          response_id, email_id, recipient_email, subject, body, 
          tone, urgency_level, context_used, 
          relationship_type, generated_at, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      const result = await pool.query(query, [
        response.id,
        request.emailId,
        request.recipientEmail,
        response.subject,
        response.body,
        response.tone,
        response.urgencyLevel,
        JSON.stringify(response.contextUsed),
        response.relationshipType,
        response.generatedAt,
        request.userId
      ]);

      console.log(`✅ Generated response saved with ID ${response.id} for user ${request.userId?.substring(0, 8)}...`);

    } catch (error) {
      console.error('❌ Error saving generated response:', error);
      // Don't throw - response generation succeeded even if saving failed
    }
  }

  // Helper methods
  private async getEmailById(emailId: string): Promise<any> {
    try {
      const result = await pool.query('SELECT * FROM emails WHERE id = $1', [emailId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching email:', error);
      return null;
    }
  }

  private async getRecentEntities(senderEmail: string): Promise<any[]> {
    try {
      const query = `
        SELECT DISTINCT entity_value, entity_type, ee.created_at
        FROM extracted_entities ee
        JOIN emails e ON ee.email_id = e.id
        WHERE e.from_email = $1 
        ORDER BY ee.created_at DESC 
        LIMIT 10
      `;
      const result = await pool.query(query, [senderEmail]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching recent entities:', error);
      return [];
    }
  }

  private async getUserToneProfile(): Promise<any> {
    try {
      const query = `
        SELECT * FROM tone_profiles 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      const result = await pool.query(query);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Error fetching tone profile:', error);
      return null;
    }
  }

  private async getRecentLearningInsights(userId: string): Promise<any[]> {
    try {
      // Get learning insights from the last 14 days that have actionable recommendations for this specific user
      const query = `
        SELECT pattern_type, pattern_value, frequency, success_rate, recommendation, confidence
        FROM learning_insights 
        WHERE user_id = $1
          AND last_updated >= CURRENT_DATE - INTERVAL '14 days'
          AND frequency >= 2
          AND success_rate < 75
        ORDER BY frequency DESC, success_rate ASC
        LIMIT 5
      `;
      const result = await pool.query(query, [userId]);
      return result.rows || [];
    } catch (error) {
      console.error('❌ Error fetching learning insights:', error);
      return [];
    }
  }
}