import { GmailService } from './gmail';
import { ContextService } from './context';
import { ParsedEmail } from '../types';

export interface ContextGatheringStrategy {
  strategy: 'stranger' | 'new_contact' | 'known_contact';
  processingTime: number; // estimated seconds
  contextSources: string[];
  description: string;
}

export interface GatheredContext {
  senderRelationship: any;
  threadHistory?: ParsedEmail[];
  senderHistory?: ParsedEmail[];
  contextSummary: string;
  confidence: number;
  sources: string[];
}

export class ContextStrategyService {
  private gmailService: GmailService;
  private contextService: ContextService;

  constructor(gmailService: GmailService, contextService: ContextService) {
    this.gmailService = gmailService;
    this.contextService = contextService;
  }

  // Determine the best context gathering strategy for a response request
  async determineContextStrategy(recipientEmail: string, threadId?: string): Promise<ContextGatheringStrategy> {
    try {
      console.log(`🎯 Determining context strategy for ${recipientEmail}...`);

      // Step 1: Gmail relationship discovery
      const relationship = await this.gmailService.getSenderRelationshipHistory(recipientEmail);
      
      // Step 2: Check if this is part of an existing thread
      const hasThread = threadId && threadId.length > 0;

      // Step 3: Determine strategy based on relationship and thread context
      let strategy: ContextGatheringStrategy;

      if (relationship.classification === 'stranger') {
        strategy = {
          strategy: 'stranger',
          processingTime: 5,
          contextSources: ['generic_professional_tone'],
          description: 'No context needed - generate generic professional response'
        };
      } else if (relationship.classification === 'new_contact') {
        strategy = {
          strategy: 'new_contact',
          processingTime: hasThread ? 15 : 10,
          contextSources: hasThread ? ['thread_history', 'basic_sender_info'] : ['basic_sender_info'],
          description: 'Minimal context - fetch thread history or basic sender information'
        };
      } else { // known_contact
        strategy = {
          strategy: 'known_contact', 
          processingTime: hasThread ? 25 : 20,
          contextSources: hasThread ? ['thread_history', 'sender_history', 'entity_context'] : ['sender_history', 'entity_context'],
          description: 'Full context - comprehensive relationship and conversation history'
        };
      }

      console.log(`✅ Strategy determined: ${strategy.strategy} (~${strategy.processingTime}s processing)`);
      return strategy;

    } catch (error) {
      console.error('❌ Error determining context strategy:', error);
      // Fallback to basic strategy
      return {
        strategy: 'new_contact',
        processingTime: 10,
        contextSources: ['basic_sender_info'],
        description: 'Fallback strategy due to error'
      };
    }
  }

  // Execute the context gathering based on the determined strategy
  async gatherContextByStrategy(
    strategy: ContextGatheringStrategy, 
    recipientEmail: string, 
    threadId?: string
  ): Promise<GatheredContext> {
    try {
      console.log(`📡 Executing ${strategy.strategy} context gathering...`);
      const startTime = Date.now();

      let gatheredContext: GatheredContext = {
        senderRelationship: null,
        contextSummary: '',
        confidence: 0,
        sources: []
      };

      // Always get basic sender relationship info
      gatheredContext.senderRelationship = await this.gmailService.getSenderRelationshipHistory(recipientEmail);
      gatheredContext.sources.push('sender_relationship');

      switch (strategy.strategy) {
        case 'stranger':
          gatheredContext = await this.gatherStrangerContext(gatheredContext, recipientEmail);
          break;

        case 'new_contact':
          gatheredContext = await this.gatherNewContactContext(gatheredContext, recipientEmail, threadId);
          break;

        case 'known_contact':
          gatheredContext = await this.gatherKnownContactContext(gatheredContext, recipientEmail, threadId);
          break;
      }

      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Context gathering completed in ${processingTime.toFixed(1)}s`);

      return gatheredContext;

    } catch (error) {
      console.error('❌ Error gathering context:', error);
      // Return minimal context on error
      return {
        senderRelationship: { classification: 'stranger', totalEmails: 0 },
        contextSummary: 'Unable to gather context due to error',
        confidence: 0,
        sources: ['error_fallback']
      };
    }
  }

  // Context gathering for complete strangers
  private async gatherStrangerContext(context: GatheredContext, recipientEmail: string): Promise<GatheredContext> {
    context.contextSummary = `First-time contact with ${recipientEmail}. Using generic professional tone.`;
    context.confidence = 100; // High confidence for strangers - we know we don't know them
    context.sources.push('generic_professional');
    
    return context;
  }

  // Context gathering for new contacts (1-3 emails)
  private async gatherNewContactContext(
    context: GatheredContext, 
    recipientEmail: string, 
    threadId?: string
  ): Promise<GatheredContext> {
    
    // If part of thread, get thread history
    if (threadId) {
      try {
        context.threadHistory = await this.gmailService.getThreadEmails(threadId);
        context.sources.push('thread_history');
        
        context.contextSummary = `New contact with existing conversation thread (${context.threadHistory.length} messages). ` +
                                 `Limited relationship history (${context.senderRelationship.totalEmails} total emails).`;
      } catch (error) {
        console.warn('⚠️ Could not fetch thread history for new contact:', error);
      }
    }

    // Get basic sender domain/company info
    const domain = recipientEmail.split('@')[1];
    context.contextSummary = context.contextSummary || 
      `New contact from ${domain}. Limited interaction history (${context.senderRelationship.totalEmails} emails).`;
    
    context.confidence = 60; // Medium confidence - some info but limited
    context.sources.push('domain_analysis');

    return context;
  }

  // Context gathering for known contacts (4+ emails)
  private async gatherKnownContactContext(
    context: GatheredContext, 
    recipientEmail: string, 
    threadId?: string
  ): Promise<GatheredContext> {
    
    // If part of thread, get complete thread history
    if (threadId) {
      try {
        context.threadHistory = await this.gmailService.getThreadEmails(threadId);
        context.sources.push('thread_history');
      } catch (error) {
        console.warn('⚠️ Could not fetch thread history:', error);
      }
    }

    // Always get recent sender history for known contacts
    try {
      context.senderHistory = await this.gmailService.getRecentSenderEmails(recipientEmail, 8);
      context.sources.push('sender_history');
    } catch (error) {
      console.warn('⚠️ Could not fetch sender history:', error);
    }

    // Build comprehensive context summary
    const threadInfo = context.threadHistory ? 
      `Current thread has ${context.threadHistory.length} messages. ` : '';
    const senderInfo = context.senderHistory ? 
      `Recent history shows ${context.senderHistory.length} interactions. ` : '';
    
    context.contextSummary = `Known contact with substantial history (${context.senderRelationship.totalEmails} total emails). ` +
                            threadInfo + senderInfo +
                            `First contact: ${context.senderRelationship.firstInteraction?.toDateString()}.`;

    context.confidence = 90; // High confidence - lots of historical data
    context.sources.push('comprehensive_history');

    return context;
  }

  // Generate context-aware prompt additions for AI
  generateContextPrompt(gatheredContext: GatheredContext): string {
    let prompt = '\n';

    // Add relationship context
    if (gatheredContext.senderRelationship) {
      const rel = gatheredContext.senderRelationship;
      prompt += `SENDER RELATIONSHIP:\n`;
      prompt += `- Classification: ${rel.classification}\n`;
      prompt += `- Total email history: ${rel.totalEmails} emails\n`;
      if (rel.firstInteraction) {
        prompt += `- Relationship started: ${rel.firstInteraction.toDateString()}\n`;
      }
      if (rel.lastInteraction) {
        prompt += `- Last contact: ${rel.lastInteraction.toDateString()}\n`;
      }
      prompt += '\n';
    }

    // Add thread context if available
    if (gatheredContext.threadHistory && gatheredContext.threadHistory.length > 0) {
      prompt += `CONVERSATION THREAD:\n`;
      prompt += `- Thread contains ${gatheredContext.threadHistory.length} messages\n`;
      prompt += `- Recent messages in this thread:\n`;
      
      // Show last 3 messages for context
      const recentMessages = gatheredContext.threadHistory.slice(-3);
      recentMessages.forEach((email, index) => {
        const direction = email.from.includes('@gmail.com') ? 'You sent' : 'They sent';
        prompt += `  ${index + 1}. ${direction}: "${email.subject}" (${email.date.toDateString()})\n`;
      });
      prompt += '\n';
    }

    // Add sender history context if available
    if (gatheredContext.senderHistory && gatheredContext.senderHistory.length > 0) {
      prompt += `RECENT COMMUNICATION PATTERNS:\n`;
      prompt += `- Recent ${gatheredContext.senderHistory.length} emails with this sender show:\n`;
      
      // Analyze recent topics (basic implementation)
      const recentSubjects = gatheredContext.senderHistory.slice(0, 3).map(email => email.subject);
      prompt += `  Recent topics: ${recentSubjects.join(', ')}\n`;
      prompt += '\n';
    }

    // Add context confidence and sources
    prompt += `CONTEXT CONFIDENCE: ${gatheredContext.confidence}% (Sources: ${gatheredContext.sources.join(', ')})\n`;
    prompt += `CONTEXT SUMMARY: ${gatheredContext.contextSummary}\n\n`;

    return prompt;
  }
}