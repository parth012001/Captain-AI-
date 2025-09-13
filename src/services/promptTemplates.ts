import { ResponseRequest } from './response';

export interface PromptContext {
  relationshipType: string;
  urgencyLevel: 'high' | 'medium' | 'low';
  senderProfile?: any;
  threadHistory?: any;
  userToneProfile?: any;
  learningInsights?: any[];
  contextSources?: string[];
}

export interface QualityScore {
  overall: number;
  breakdown: {
    appropriateness: number;
    completeness: number;
    tonalConsistency: number;
    professionalismLevel: number;
    contextRelevance: number;
  };
  recommendations: string[];
}

export class PromptTemplateService {

  /**
   * Build the professional system prompt with role definition and relationship context
   */
  buildSystemPrompt(relationshipType: string, urgencyLevel: string): string {
    return `You are an AI email assistant that writes responses on behalf of a busy professional. Your responses should be indistinguishable from how this person would naturally write.

CORE PRINCIPLES:
- Maintain the user's authentic voice and writing style
- Understand business communication nuances and hierarchy
- Adapt tone based on relationship dynamics
- Handle urgency appropriately without over-reacting
- Be concise yet complete in your responses

${this.getRelationshipGuidance(relationshipType)}

${this.getUrgencyGuidance(urgencyLevel)}

RESPONSE QUALITY STANDARDS:
- Professional but natural language
- Clear structure with logical flow  
- Appropriate level of detail for the context
- Action-oriented when decisions/next steps are needed
- Respectful acknowledgment of the sender's time and concerns

OUTPUT FORMAT: You MUST respond with valid JSON in this exact format:
{
  "subject": "appropriate email subject with proper Re: formatting",
  "body": "complete email body with proper business formatting",
  "reasoning": "brief explanation of your approach and tone choices",
  "confidence_factors": ["list", "of", "factors", "supporting", "your", "response"]
}`;
  }

  /**
   * Get detailed relationship-specific guidance
   */
  private getRelationshipGuidance(relationshipType: string): string {
    const guidance = {
      boss: `
BOSS RELATIONSHIP DYNAMICS:
You are responding to your supervisor or someone in authority. Key behaviors:

TONE APPROACH:
- Use respectful, professional language (Dear [Name] or appropriate title)
- Be concise and action-oriented - executives value brevity
- Acknowledge their authority and priorities explicitly
- Provide clear timelines and firm commitments
- Avoid casual language, pushback, or lengthy explanations
- Show accountability and ownership

STRUCTURAL PATTERN:
1. Direct acknowledgment of their request/concern
2. Immediate action statement ("I will..." not "I can...")
3. Clear timeline with specific deliverables
4. Professional availability statement for follow-up

LANGUAGE EXAMPLES:
- "Thank you for bringing this to my attention"
- "I will ensure this is completed by [specific time]"
- "I take full responsibility for..."
- "Please let me know if you need any updates before then"`,

      client: `
CLIENT RELATIONSHIP DYNAMICS:
You are responding to a client who pays for your services. Key behaviors:

TONE APPROACH:
- Service-oriented, helpful, and solution-focused
- Professional but warm - build relationship while solving problems
- Proactive communication about potential issues or opportunities
- Demonstrate expertise without being condescending
- Always provide clear next steps and timelines

STRUCTURAL PATTERN:
1. Appreciation for their business/inquiry
2. Clear understanding of their needs/concerns
3. Specific solution or action plan
4. Next steps with timelines
5. Invitation for further questions/collaboration

LANGUAGE EXAMPLES:
- "Thank you for reaching out about..."
- "I understand your concern regarding..."
- "Here's how we'll address this..."
- "I'll keep you updated on progress..."
- "Please don't hesitate to contact me if..."`,

      peer: `
PEER RELATIONSHIP DYNAMICS:
You are responding to a colleague at a similar level. Key behaviors:

TONE APPROACH:
- Collaborative, professional but friendly
- Use "we" language to show partnership
- Share information transparently
- Offer help and support naturally
- Balance professionalism with approachability

STRUCTURAL PATTERN:
1. Friendly but professional greeting
2. Collaborative approach to the topic
3. Information sharing or problem-solving
4. Offer of additional help or support
5. Casual but professional closing

LANGUAGE EXAMPLES:
- "Thanks for checking in on..."
- "Happy to help with..."
- "Let's coordinate on..."
- "I can also support..."
- "Feel free to reach out if you need anything else"`,

      vendor: `
VENDOR RELATIONSHIP DYNAMICS:
You are responding to someone providing services to your organization. Key behaviors:

TONE APPROACH:
- Business-focused and direct
- Clear about expectations and requirements
- Professional but not overly warm
- Decision-oriented when needed
- Efficient communication style

STRUCTURAL PATTERN:
1. Direct acknowledgment of their communication
2. Clear feedback or direction
3. Specific requirements or next steps
4. Timeline expectations
5. Professional closing

LANGUAGE EXAMPLES:
- "Thank you for the proposal/update..."
- "We need to see..."
- "Please provide..."
- "The timeline for this is..."
- "We'll review and get back to you by..."`,

      stranger: `
STRANGER/UNKNOWN RELATIONSHIP DYNAMICS:
You are responding to someone you haven't interacted with before. Key behaviors:

TONE APPROACH:
- Politely professional and slightly formal
- Helpful but appropriately cautious
- Clear about your role and capabilities
- Professional boundaries maintained

STRUCTURAL PATTERN:
1. Polite acknowledgment
2. Professional response to their inquiry
3. Clear information or next steps
4. Professional closing with contact info

LANGUAGE EXAMPLES:
- "Thank you for your inquiry..."
- "I'd be happy to help..."
- "Please let me know if you need additional information..."
- "Best regards"`
    };

    return guidance[relationshipType as keyof typeof guidance] || guidance.stranger;
  }

  /**
   * Get urgency-specific guidance
   */
  private getUrgencyGuidance(urgencyLevel: string): string {
    switch (urgencyLevel) {
      case 'high':
        return `
URGENCY HANDLING - HIGH PRIORITY:
- Acknowledge urgency immediately in your response
- Be more direct and concise than usual
- Provide specific timelines (hours/by end of day)
- Offer immediate next steps or interim updates
- Use phrases like "I understand the urgency" or "I'll prioritize this"
- Avoid lengthy explanations - focus on action

URGENT LANGUAGE PATTERNS:
- "I understand this is urgent and will..."
- "I'm prioritizing this immediately..."
- "I'll have an update for you by [specific time]..."
- "Let me address this right away..."`;

      case 'low':
        return `
URGENCY HANDLING - LOW PRIORITY:
- Take a more relaxed, thoughtful tone
- Allow for more detailed explanations if helpful
- Flexible timelines are appropriate
- No rush implied in language
- Can include more context or background

RELAXED LANGUAGE PATTERNS:
- "When you have a chance..."
- "No rush on this..."
- "I'll work on this over the next few days..."
- "Let me know what works best for your timeline..."`;

      default: // medium
        return `
URGENCY HANDLING - MEDIUM PRIORITY:
- Balanced, professional tone with appropriate timeliness
- Standard business timeline expectations
- Professional acknowledgment without panic
- Clear next steps with reasonable deadlines

STANDARD LANGUAGE PATTERNS:
- "I'll take care of this..."
- "I'll get back to you by [reasonable timeframe]..."
- "Let me work on this and update you..."
- "I'll have this completed by..."`;
    }
  }

  /**
   * Build intelligent context instructions (NO MORE TEXT DUMPING!)
   */
  buildIntelligentContext(contextData: any): string {
    let contextInstructions = '\n';

    // Thread conversation continuity
    if (contextData.threadHistory) {
      contextInstructions += this.buildThreadContinuity(contextData.threadHistory);
    }

    // User tone profile application
    if (contextData.userToneProfile) {
      contextInstructions += this.buildToneAlignment(contextData.userToneProfile);
    }

    // Sender-specific intelligence
    if (contextData.senderProfile) {
      contextInstructions += this.buildSenderIntelligence(contextData.senderProfile);
    }

    return contextInstructions;
  }

  /**
   * Adapt system prompt behaviorally based on learning patterns (NO TEXT DUMPING)
   */
  adaptPromptFromLearning(basePrompt: string, learningPatterns: any[], relationshipType: string): string {
    let adaptedPrompt = basePrompt;
    
    if (!learningPatterns || learningPatterns.length === 0) {
      return adaptedPrompt;
    }

    console.log('🧠 Adapting prompt based on learning patterns:', learningPatterns.length, 'patterns');
    
    // Apply specific behavioral adaptations (NOT text dumping!)
    for (const pattern of learningPatterns) {
      if (pattern.success_rate < 75) { // Only apply if pattern shows room for improvement
        
        switch (pattern.pattern_type) {
          case 'tone':
            adaptedPrompt = this.adaptToneBehavior(adaptedPrompt, pattern, relationshipType);
            break;
          case 'length':
            adaptedPrompt = this.adaptLengthBehavior(adaptedPrompt, pattern);
            break;
          case 'formality':
            adaptedPrompt = this.adaptFormalityBehavior(adaptedPrompt, pattern, relationshipType);
            break;
          case 'structure':
            adaptedPrompt = this.adaptStructureBehavior(adaptedPrompt, pattern);
            break;
        }
      }
    }

    return adaptedPrompt;
  }

  /**
   * Specific behavioral adaptations (replace generic text with specific instructions)
   */
  private adaptToneBehavior(prompt: string, pattern: any, relationshipType: string): string {
    // Replace generic tone guidance with specific behavioral changes
    if (pattern.recommendation?.includes('formal')) {
      console.log('🎯 Learning adaptation: Making tone more formal for', relationshipType);
      // Modify the actual prompt structure, not just add text
      return prompt.replace(
        /Use [a-z\s]+ language/g, 
        'Use formal, respectful language with proper titles'
      );
    } else if (pattern.recommendation?.includes('casual')) {
      console.log('🎯 Learning adaptation: Making tone more casual for', relationshipType);
      return prompt.replace(
        /formal.*language/gi,
        'friendly but professional language'
      );
    }
    return prompt;
  }

  private adaptLengthBehavior(prompt: string, pattern: any): string {
    if (pattern.recommendation?.includes('concise') || pattern.recommendation?.includes('shorter')) {
      console.log('🎯 Learning adaptation: Making responses more concise');
      // Modify prompt to enforce brevity
      return prompt + '\n\nIMPORTANT: Keep response concise and direct. Avoid lengthy explanations.';
    } else if (pattern.recommendation?.includes('detailed') || pattern.recommendation?.includes('longer')) {
      console.log('🎯 Learning adaptation: Making responses more detailed');
      return prompt + '\n\nIMPORTANT: Provide detailed, comprehensive responses with full context.';
    }
    return prompt;
  }

  private adaptFormalityBehavior(prompt: string, pattern: any, relationshipType: string): string {
    if (pattern.recommendation?.includes('more formal')) {
      console.log('🎯 Learning adaptation: Increasing formality for', relationshipType);
      // Structurally modify greeting patterns
      const relationshipGuidance = this.getRelationshipGuidance(relationshipType);
      if (relationshipGuidance.includes('Dear')) {
        return prompt.replace(
          relationshipGuidance,
          relationshipGuidance.replace(/Hi|Hello/g, 'Dear')
        );
      }
    }
    return prompt;
  }

  private adaptStructureBehavior(prompt: string, pattern: any): string {
    if (pattern.recommendation?.includes('greeting')) {
      console.log('🎯 Learning adaptation: Modifying greeting structure');
      return prompt + '\n\nGREETING ADAPTATION: Use more personalized greetings based on user feedback.';
    } else if (pattern.recommendation?.includes('closing')) {
      console.log('🎯 Learning adaptation: Modifying closing structure');
      return prompt + '\n\nCLOSING ADAPTATION: Use more appropriate closing based on learned patterns.';
    }
    return prompt;
  }

  /**
   * Build thread continuity instructions
   */
  private buildThreadContinuity(threadHistory: any): string {
    if (!threadHistory.context_summary) return '';

    return `CONVERSATION CONTINUITY:
This email continues an ongoing thread about: ${threadHistory.context_summary}

- Reference relevant points from the conversation naturally
- Maintain consistency with previous commitments or decisions
- Build upon established context rather than starting fresh
${threadHistory.key_decisions && threadHistory.key_decisions.length > 0 ? 
  `- Remember these decisions were made: ${threadHistory.key_decisions.slice(0, 2).join(', ')}` : ''}

`;
  }

  /**
   * Apply user's authentic tone profile
   */
  private buildToneAlignment(userToneProfile: any): string {
    if (!userToneProfile.profile_text) return '';

    // Extract key patterns from tone profile
    const toneGuidance = `USER'S AUTHENTIC VOICE PATTERNS:
Based on analysis of their actual sent emails, this person typically:

${this.extractTonePatterns(userToneProfile.profile_text)}

IMPORTANT: Mirror these natural patterns in your response to maintain authenticity.

`;
    return toneGuidance;
  }

  /**
   * Extract actionable patterns from tone profile
   */
  private extractTonePatterns(profileText: string): string {
    // Basic pattern extraction - could be enhanced with NLP
    let patterns = '';
    
    if (profileText.includes('formal')) {
      patterns += '- Uses formal language and proper business etiquette\n';
    }
    if (profileText.includes('brief') || profileText.includes('concise')) {
      patterns += '- Prefers concise, direct communication\n';
    }
    if (profileText.includes('warm') || profileText.includes('friendly')) {
      patterns += '- Maintains a warm, approachable tone\n';
    }
    if (profileText.includes('Best regards') || profileText.includes('Best')) {
      patterns += '- Typically closes with "Best regards" or similar\n';
    }
    if (profileText.includes('thanks') || profileText.includes('Thank you')) {
      patterns += '- Frequently uses appreciation and gratitude\n';
    }

    return patterns || '- Professional, courteous communication style\n';
  }

  /**
   * Build sender-specific intelligence
   */
  private buildSenderIntelligence(senderProfile: any): string {
    let intelligence = `SENDER INTELLIGENCE:
`;

    if (senderProfile.display_name) {
      intelligence += `- Person: ${senderProfile.display_name}`;
      if (senderProfile.company) {
        intelligence += ` from ${senderProfile.company}`;
      }
      intelligence += '\n';
    }

    if (senderProfile.email_count > 1) {
      intelligence += `- Relationship: ${senderProfile.email_count} previous emails, ${senderProfile.relationship_type} relationship\n`;
    }

    if (senderProfile.formality_preference) {
      intelligence += `- Communication style: Prefers ${senderProfile.formality_preference} tone\n`;
    }

    intelligence += '\n';
    return intelligence;
  }

  /**
   * Construct the final user prompt with context
   */
  buildUserPrompt(request: ResponseRequest, contextInstructions: string): string {
    return `${contextInstructions}

ORIGINAL EMAIL TO RESPOND TO:
From: ${request.recipientEmail}
Subject: ${request.originalSubject}
Body: ${request.originalBody}

${request.customInstructions ? `
SPECIAL INSTRUCTIONS:
${request.customInstructions}
` : ''}

Generate an appropriate email response following all the guidance above. Ensure your response maintains the user's authentic voice while being perfectly appropriate for the relationship and context.`;
  }
}

/**
 * Response Quality Service - Advanced validation beyond basic checks
 */
export class ResponseQualityService {
  
  async validateResponseQuality(
    response: any, 
    request: ResponseRequest, 
    context: PromptContext
  ): Promise<QualityScore> {
    
    const scores = {
      appropriateness: this.checkAppropriatenesss(response, context),
      completeness: this.checkCompleteness(response, request),
      tonalConsistency: this.checkTonalConsistency(response, context),
      professionalismLevel: this.checkProfessionalism(response, context),
      contextRelevance: this.checkContextRelevance(response, request)
    };

    const overall = Object.values(scores).reduce((a, b) => a + b) / Object.keys(scores).length;
    const recommendations = this.generateImprovements(scores, context);

    return {
      overall,
      breakdown: scores,
      recommendations
    };
  }

  private checkAppropriatenesss(response: any, context: PromptContext): number {
    let score = 100;
    const body = response.body.toLowerCase();

    // Relationship appropriateness
    switch (context.relationshipType) {
      case 'boss':
        if (body.includes('hey') || body.includes('sup')) score -= 30;
        if (!body.includes('dear') && !body.includes('hi')) score -= 10;
        break;
      case 'client':
        if (body.includes('whatever') || body.includes('idk')) score -= 40;
        break;
    }

    // Urgency appropriateness
    if (context.urgencyLevel === 'high') {
      if (!body.includes('urgent') && !body.includes('priority') && !body.includes('immediately')) {
        score -= 15;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private checkCompleteness(response: any, request: ResponseRequest): number {
    let score = 80; // Base score

    // Check if response addresses the original email
    const originalBody = request.originalBody.toLowerCase();
    const responseBody = response.body.toLowerCase();

    // Look for question responses
    if (originalBody.includes('?')) {
      // Simple check for question acknowledgment
      if (responseBody.includes('question') || responseBody.includes('answer') || 
          responseBody.includes('yes') || responseBody.includes('no')) {
        score += 10;
      } else {
        score -= 20;
      }
    }

    // Check for proper email structure
    if (!response.body.includes('\n')) score -= 10; // Multi-line responses are better
    if (response.body.length < 50) score -= 15; // Too short
    if (response.body.length > 1000) score -= 10; // Too long

    return Math.max(0, Math.min(100, score));
  }

  private checkTonalConsistency(response: any, context: PromptContext): number {
    let score = 85; // Base score
    const body = response.body.toLowerCase();

    // Check for tone profile alignment
    if (context.userToneProfile) {
      const profile = context.userToneProfile.profile_text?.toLowerCase() || '';
      
      if (profile.includes('formal') && (body.includes('hey') || body.includes('sup'))) {
        score -= 25;
      }
      if (profile.includes('brief') && response.body.length > 300) {
        score -= 15;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private checkProfessionalism(response: any, context: PromptContext): number {
    let score = 90; // Base score
    const body = response.body.toLowerCase();

    // Professional language check
    const unprofessionalWords = ['dude', 'bro', 'whatever', 'lol', 'omg', 'wtf'];
    for (const word of unprofessionalWords) {
      if (body.includes(word)) score -= 20;
    }

    // Proper greeting/closing
    if (!body.includes('hi') && !body.includes('hello') && !body.includes('dear')) score -= 10;
    if (!body.includes('regards') && !body.includes('thanks') && !body.includes('best')) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private checkContextRelevance(response: any, request: ResponseRequest): number {
    let score = 75; // Base score

    // Simple keyword overlap check
    const originalWords = request.originalBody.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3);
    const responseWords = response.body.toLowerCase().split(/\s+/);
    
    const overlap = originalWords.filter(word => responseWords.includes(word));
    const relevanceRatio = overlap.length / Math.min(originalWords.length, 10);
    
    score += relevanceRatio * 25; // Up to 25 point bonus for relevance

    return Math.max(0, Math.min(100, score));
  }

  private generateImprovements(scores: any, context: PromptContext): string[] {
    const improvements: string[] = [];

    if (scores.appropriateness < 70) {
      improvements.push(`Tone not appropriate for ${context.relationshipType} relationship`);
    }
    if (scores.completeness < 60) {
      improvements.push('Response incomplete - address all points from original email');
    }
    if (scores.tonalConsistency < 70) {
      improvements.push('Response tone inconsistent with user\'s natural writing style');
    }
    if (scores.professionalismLevel < 80) {
      improvements.push('Language not professional enough for business communication');
    }
    if (scores.contextRelevance < 60) {
      improvements.push('Response not relevant enough to original email content');
    }

    return improvements;
  }
}