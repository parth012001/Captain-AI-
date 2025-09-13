import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { EmailMessage, ParsedEmail } from '../types';
import { TokenStorageService } from './tokenStorage';

dotenv.config();

export class GmailService {
  public oauth2Client: OAuth2Client; // Made public for OAuth callback access
  private gmail: any;
  public tokenStorageService: TokenStorageService;
  private currentUserId: string | null = null;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.tokenStorageService = new TokenStorageService();
  }

  getAuthUrl(intent?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    // Add intent to the OAuth state parameter so we can retrieve it in the callback
    const state = intent ? JSON.stringify({ intent }) : undefined;

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state
    });
  }

  async setTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      console.log('✅ OAuth tokens set successfully');
      return tokens;
    } catch (error) {
      console.error('❌ Error setting tokens:', error);
      throw error;
    }
  }

  async setStoredTokens(accessToken: string, refreshToken: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  /**
   * Verify the service is initialized for the correct user
   */
  private ensureCorrectUserContext(expectedUserId: string): void {
    if (this.currentUserId !== expectedUserId) {
      console.warn(`⚠️ Gmail service context mismatch: expected ${expectedUserId}, current ${this.currentUserId}`);
      throw new Error(`Gmail service not initialized for user ${expectedUserId}. Call initializeForUser() first.`);
    }
  }

  /**
   * NEW: Initialize Gmail service for specific user using database tokens
   * This enables 24/7 operation even when user is logged out
   */
  async initializeForUser(userId: string): Promise<void> {
    try {
      console.log(`🔑 Initializing Gmail service for user: ${userId}`);
      
      const credentials = await this.tokenStorageService.getDecryptedCredentials(userId);
      if (!credentials) {
        throw new Error(`No tokens found for user: ${userId}`);
      }

      // Check if access token is expired and refresh if needed
      const now = new Date();
      const expiresAt = credentials.expiresAt || new Date(0);
      
      if (now >= expiresAt) {
        console.log(`🔄 Access token expired for user ${userId}, refreshing...`);
        await this.refreshUserAccessToken(userId);
        
        // Get fresh credentials after refresh
        const freshCredentials = await this.tokenStorageService.getDecryptedCredentials(userId);
        if (!freshCredentials) {
          throw new Error(`Failed to refresh tokens for user: ${userId}`);
        }
        
        this.oauth2Client.setCredentials({
          access_token: freshCredentials.accessToken,
          refresh_token: freshCredentials.refreshToken
        });
      } else {
        this.oauth2Client.setCredentials({
          access_token: credentials.accessToken,
          refresh_token: credentials.refreshToken
        });
      }
      
      this.currentUserId = userId;
      console.log(`✅ Gmail service initialized for user: ${userId}`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize Gmail service for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * NEW: Refresh access token for a specific user
   */
  async refreshUserAccessToken(userId: string): Promise<void> {
    try {
      console.log(`🔄 Refreshing access token for user: ${userId}`);
      
      const credentials = await this.tokenStorageService.getDecryptedCredentials(userId);
      if (!credentials || !credentials.refreshToken) {
        throw new Error(`No refresh token found for user: ${userId}`);
      }

      // Set refresh token and get new access token
      this.oauth2Client.setCredentials({
        refresh_token: credentials.refreshToken
      });

      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!newCredentials.access_token) {
        throw new Error('Failed to get new access token');
      }

      // Update database with new access token
      await this.tokenStorageService.updateAccessToken(
        userId,
        newCredentials.access_token,
        new Date(Date.now() + 3600 * 1000) // 1 hour from now
      );

      console.log(`✅ Access token refreshed for user: ${userId}`);
      
    } catch (error) {
      console.error(`❌ Failed to refresh access token for user ${userId}:`, error);
      
      // If refresh fails, the user's tokens might be revoked
      // Disable webhook for this user
      await this.tokenStorageService.disableWebhookForUser(
        userId, 
        'Token refresh failed - likely revoked'
      );
      
      throw error;
    }
  }

  /**
   * NEW: Get all users with active webhooks (for multi-user processing)
   */
  async getActiveWebhookUsers() {
    return await this.tokenStorageService.getActiveWebhookUsers();
  }

  /**
   * NEW: Initialize for user by Gmail address (helper method)
   */
  async initializeForGmailAddress(gmailAddress: string): Promise<void> {
    const userId = await this.tokenStorageService.getUserIdByEmail(gmailAddress);
    if (!userId) {
      throw new Error(`No user found for Gmail address: ${gmailAddress}`);
    }
    await this.initializeForUser(userId);
  }

  async getEmailByMessageId(messageId: string): Promise<EmailMessage | null> {
    try {
      console.log(`📧 Fetching email with ID: ${messageId}`);
      
      const emailResponse = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });
      
      console.log(`✅ Successfully fetched email: ${messageId}`);
      return emailResponse.data;
    } catch (error) {
      console.error(`❌ Error fetching email ${messageId}:`, error);
      return null;
    }
  }

  async getRecentEmails(maxResults: number = 50): Promise<EmailMessage[]> {
    try {
      // Get list of email IDs
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox', // Only inbox emails
      });

      if (!response.data.messages) {
        console.log('No messages found');
        return [];
      }

      console.log(`📧 Found ${response.data.messages.length} emails`);

      // Get full email content for each message
      const emails: EmailMessage[] = [];
      
      for (const message of response.data.messages.slice(0, 10)) { // Limit to 10 for testing
        try {
          const emailResponse = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });
          
          emails.push(emailResponse.data);
        } catch (error) {
          console.error(`Error fetching email ${message.id}:`, error);
        }
      }

      return emails;
    } catch (error) {
      console.error('❌ Error fetching emails:', error);
      throw error;
    }
  }

  /**
   * Safely fetch sent emails with user context validation
   */
  async getSentEmailsForUser(userId: string, maxResults: number = 50): Promise<EmailMessage[]> {
    // Ensure we're initialized for the correct user
    this.ensureCorrectUserContext(userId);
    
    return this.getSentEmails(maxResults);
  }

  async getSentEmails(maxResults: number = 50): Promise<EmailMessage[]> {
    try {
      console.log(`📤 Fetching up to ${maxResults} sent emails for tone analysis...`);
      
      // Get list of sent email IDs
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:sent', // Only sent emails
      });

      if (!response.data.messages) {
        console.log('No sent messages found');
        return [];
      }

      console.log(`📤 Found ${response.data.messages.length} sent emails`);

      // Get full email content for each message
      const emails: EmailMessage[] = [];
      
      for (const message of response.data.messages) {
        try {
          const emailResponse = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });
          
          emails.push(emailResponse.data);
        } catch (error) {
          // Handle 404 errors gracefully - these are expected in multi-user systems
          if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
            console.log(`⚠️ Email ${message.id} not accessible - skipping (cross-user access blocked)`);
          } else {
            console.error(`❌ Error fetching sent email ${message.id}:`, 
              error instanceof Error ? error.message : 'Unknown error');
          }
          // Continue processing other emails regardless of individual failures
          continue;
        }
      }

      return emails;
    } catch (error) {
      console.error('❌ Error fetching sent emails:', error);
      throw error;
    }
  }

  filterSentEmailsForToneAnalysis(emails: EmailMessage[]): EmailMessage[] {
    const filtered: EmailMessage[] = [];
    const rejectedReasons: {[key: string]: number} = {};
    
    for (const email of emails) {
      const parsed = this.parseEmail(email);
      
      // Smart filtering criteria with detailed logging
      const validationResult = this.isValidForToneAnalysisWithReason(parsed);
      if (validationResult.valid) {
        filtered.push(email);
      } else {
        rejectedReasons[validationResult.reason] = (rejectedReasons[validationResult.reason] || 0) + 1;
        console.log(`❌ REJECTED: "${parsed.subject.substring(0, 50)}" - Reason: ${validationResult.reason}`);
      }
    }
    
    console.log(`🔍 Filtered ${filtered.length} emails from ${emails.length} sent emails`);
    console.log(`📊 Rejection Breakdown:`, rejectedReasons);
    return filtered;
  }

  private isValidForToneAnalysisWithReason(email: ParsedEmail): {valid: boolean, reason: string} {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    
    // Skip if completely empty (parsing issue)
    if (email.body.length === 0) {
      return {valid: false, reason: `Empty body (parsing issue)`};
    }
    
    // Skip auto-replies and out-of-office messages
    const autoReplyKeywords = [
      'out of office', 'automatic reply', 'auto-reply', 'autoreply',
      'away message', 'vacation message', 'i am currently out',
      'thank you for your email', 'i will respond when i return'
    ];
    
    for (const keyword of autoReplyKeywords) {
      if (subject.includes(keyword) || body.includes(keyword)) {
        return {valid: false, reason: `Auto-reply detected (${keyword})`};
      }
    }
    
    // Only reject FULL forwards (not replies with quotes)
    const fullForwardPatterns = [
      '---------- forwarded message',
      'begin forwarded message',
    ];
    
    for (const pattern of fullForwardPatterns) {
      if (body.includes(pattern)) {
        return {valid: false, reason: `Full forward detected (${pattern})`};
      }
    }
    
    // Check for original content vs quoted content
    const lines = email.body.split('\n');
    const quotedLines = lines.filter(line => line.trim().startsWith('>')).length;
    const quoteRatio = quotedLines / Math.max(lines.length, 1);
    
    // Get non-quoted content to check for minimum original text
    const originalLines = lines.filter(line => !line.trim().startsWith('>'));
    const originalText = originalLines.join('\n').trim();
    
    // Reject if mostly quoted AND has very little original content
    if (quoteRatio > 0.8 && originalText.length < 30) {
      return {valid: false, reason: `Too much quoted content (${Math.round(quoteRatio * 100)}%) with minimal original text`};
    }
    
    // Require minimum meaningful content
    if (originalText.length < 20) {
      return {valid: false, reason: `Too little original content (${originalText.length} chars)`};
    }
    
    // Skip common automated emails
    const automatedPatterns = [
      'no-reply@', 'noreply@', 'donotreply@',
      'this is an automated', 'automated message',
      'please do not reply to this email'
    ];
    
    for (const pattern of automatedPatterns) {
      if (email.from.toLowerCase().includes(pattern) || body.includes(pattern)) {
        return {valid: false, reason: `Automated email detected (${pattern})`};
      }
    }
    
    return {valid: true, reason: 'Valid'};
  }

  private isValidForToneAnalysis(email: ParsedEmail): boolean {
    return this.isValidForToneAnalysisWithReason(email).valid;
  }

  parseEmail(emailData: EmailMessage): ParsedEmail {
    const headers = emailData.payload.headers;
    const getHeader = (name: string) => 
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract email body with bulletproof parsing
    let body = '';
    let parsingAttempts: string[] = [];
    
    const extractBodyFromPart = (part: any, context: string = ''): string => {
      if (!part?.body?.data) {
        parsingAttempts.push(`${context}: No body data`);
        return '';
      }
      try {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        parsingAttempts.push(`${context}: SUCCESS (${decoded.length} chars)`);
        return decoded;
      } catch (error) {
        parsingAttempts.push(`${context}: Base64 decode failed - ${error}`);
        // Try different encodings as fallback
        try {
          const decoded = Buffer.from(part.body.data, 'base64').toString('latin1');
          parsingAttempts.push(`${context}: SUCCESS with latin1 fallback (${decoded.length} chars)`);
          return decoded;
        } catch (error2) {
          parsingAttempts.push(`${context}: All encoding attempts failed`);
          return '';
        }
      }
    };
    
    // Strategy 1: Direct body
    if (emailData.payload.body?.data) {
      body = extractBodyFromPart(emailData.payload, 'Direct body');
    } 
    
    // Strategy 2: Multipart emails - comprehensive extraction
    else if (emailData.payload.parts) {
      // Try text/plain first
      for (const part of emailData.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = extractBodyFromPart(part, 'text/plain in parts');
          if (body) break;
        }
      }
      
      // Try HTML as fallback
      if (!body) {
        for (const part of emailData.payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            body = extractBodyFromPart(part, 'text/html fallback');
            if (body) {
              // Aggressive HTML cleanup
              body = body.replace(/<style[^>]*>.*?<\/style>/gis, ' ');
              body = body.replace(/<script[^>]*>.*?<\/script>/gis, ' ');
              body = body.replace(/<[^>]*>/g, ' ');
              body = body.replace(/&nbsp;/g, ' ');
              body = body.replace(/&[a-z]+;/gi, ' ');
              body = body.replace(/\s+/g, ' ');
              break;
            }
          }
        }
      }
      
      // Try ANY mime type with body content as last resort
      if (!body) {
        for (const part of emailData.payload.parts) {
          if (part.body?.data && !part.mimeType?.includes('image') && !part.mimeType?.includes('application')) {
            body = extractBodyFromPart(part, `fallback-${part.mimeType}`);
            if (body) break;
          }
        }
      }
      
      // Handle deeply nested parts
      if (!body) {
        const extractFromNestedParts = (parts: any[], depth: number = 0): string => {
          if (depth > 3) return ''; // Prevent infinite recursion
          
          for (const part of parts) {
            if ((part as any).parts) {
              const nestedBody = extractFromNestedParts((part as any).parts, depth + 1);
              if (nestedBody) return nestedBody;
            } else if (part.body?.data) {
              const extracted = extractBodyFromPart(part, `nested-${depth}-${part.mimeType}`);
              if (extracted) return extracted;
            }
          }
          return '';
        };
        
        body = extractFromNestedParts(emailData.payload.parts);
      }
    }

    // Final fallback: Use snippet if everything else fails
    if (!body && emailData.snippet) {
      body = emailData.snippet;
      parsingAttempts.push(`Final fallback: Used Gmail snippet (${body.length} chars)`);
    }

    // Clean up body text
    body = body.replace(/\r\n/g, '\n').trim();
    
    // Log parsing attempts for failed emails
    if (!body || body.length < 10) {
      console.error(`🚨 EMAIL PARSING FAILED for ${emailData.id}:`);
      console.error(`Subject: ${getHeader('Subject')}`);
      console.error(`From: ${getHeader('From')}`);
      console.error(`Parsing attempts:`, parsingAttempts);
      console.error(`Final body length: ${body.length}`);
      console.error(`Gmail snippet: ${emailData.snippet}`);
      
      // Store failed parsing info for debugging
      (global as any).failedEmails = (global as any).failedEmails || [];
      (global as any).failedEmails.push({
        id: emailData.id,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        attempts: parsingAttempts,
        bodyLength: body.length,
        snippet: emailData.snippet
      });
    }

    return {
      id: emailData.id,
      threadId: emailData.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: new Date(parseInt(emailData.internalDate)),
      body,
      isRead: !emailData.labelIds.includes('UNREAD'),
    };
  }

  // Phase 2.4: Just-in-time context - Gmail relationship discovery
  async getSenderRelationshipHistory(senderEmail: string): Promise<{
    totalEmails: number;
    recentEmails: number;
    firstInteraction: Date | null;
    lastInteraction: Date | null;
    classification: 'stranger' | 'new_contact' | 'known_contact';
  }> {
    try {
      console.log(`🔍 Discovering relationship history with ${senderEmail}...`);
      
      // Search for all emails from/to this sender
      const searchQuery = `from:${senderEmail} OR to:${senderEmail}`;
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: 100 // Get more for accurate counting
      });

      const totalEmails = response.data.resultSizeEstimate || 0;
      const messages = response.data.messages || [];

      let firstInteraction: Date | null = null;
      let lastInteraction: Date | null = null;
      let recentEmails = 0;

      if (messages.length > 0) {
        // Get first and last message details for dates
        try {
          const firstMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: messages[messages.length - 1].id, // Last in list = oldest
            format: 'minimal'
          });
          
          const lastMessage = await this.gmail.users.messages.get({
            userId: 'me', 
            id: messages[0].id, // First in list = newest
            format: 'minimal'
          });

          if (firstMessage.data.internalDate) {
            firstInteraction = new Date(parseInt(firstMessage.data.internalDate));
          }
          
          if (lastMessage.data.internalDate) {
            lastInteraction = new Date(parseInt(lastMessage.data.internalDate));
          }

          // Count recent emails (last 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          recentEmails = messages.filter((msg: any) => {
            // This is approximate - for exact count we'd need to fetch each message
            return true; // For now, assume recent if in first 10 results
          }).slice(0, 10).length;

        } catch (error) {
          console.warn('⚠️ Could not get message details for dates:', error);
        }
      }

      // Classify sender relationship
      let classification: 'stranger' | 'new_contact' | 'known_contact';
      if (totalEmails === 0) {
        classification = 'stranger';
      } else if (totalEmails <= 3) {
        classification = 'new_contact';  
      } else {
        classification = 'known_contact';
      }

      const result = {
        totalEmails,
        recentEmails,
        firstInteraction,
        lastInteraction,
        classification
      };

      console.log(`✅ Sender relationship: ${classification} (${totalEmails} total emails)`);
      return result;

    } catch (error) {
      console.error('❌ Error discovering sender relationship:', error);
      return {
        totalEmails: 0,
        recentEmails: 0,
        firstInteraction: null,
        lastInteraction: null,
        classification: 'stranger'
      };
    }
  }

  // Get recent emails from/to specific sender for context
  async getRecentSenderEmails(senderEmail: string, maxResults: number = 5): Promise<ParsedEmail[]> {
    try {
      console.log(`📧 Fetching ${maxResults} recent emails with ${senderEmail}...`);
      
      const searchQuery = `from:${senderEmail} OR to:${senderEmail}`;
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults: maxResults
      });

      const messages = response.data.messages || [];
      const emails: ParsedEmail[] = [];

      for (const message of messages) {
        try {
          const emailData = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          const parsed = this.parseEmail(emailData.data);
          emails.push(parsed);
        } catch (error) {
          console.warn(`⚠️ Could not parse email ${message.id}:`, error);
        }
      }

      console.log(`✅ Retrieved ${emails.length} recent emails with ${senderEmail}`);
      return emails;

    } catch (error) {
      console.error('❌ Error fetching recent sender emails:', error);
      return [];
    }
  }

  // Check if email is part of existing thread and get thread context
  async getThreadEmails(threadId: string): Promise<ParsedEmail[]> {
    try {
      console.log(`🧵 Fetching thread emails for ${threadId}...`);
      
      const response = await this.gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full'
      });

      const messages = response.data.messages || [];
      const emails: ParsedEmail[] = [];

      for (const message of messages) {
        try {
          const parsed = this.parseEmail(message);
          emails.push(parsed);
        } catch (error) {
          console.warn(`⚠️ Could not parse thread message:`, error);
        }
      }

      console.log(`✅ Retrieved ${emails.length} emails from thread ${threadId}`);
      return emails;

    } catch (error) {
      console.error('❌ Error fetching thread emails:', error);
      return [];
    }
  }

  // 📡 Webhook/Push Notification Methods

  async checkCredentials(): Promise<void> {
    try {
      // Test credentials by making a simple API call
      await this.gmail.users.getProfile({ userId: 'me' });
      console.log('✅ Gmail credentials are valid');
    } catch (error) {
      console.error('❌ Invalid Gmail credentials:', error);
      throw new Error('Invalid or expired Gmail credentials');
    }
  }

  async setupWebhook(): Promise<any> {
    try {
      console.log('📡 Setting up Gmail push notifications with Pub/Sub...');
      
      // Check if Pub/Sub topic is configured
      const pubsubTopic = process.env.GMAIL_PUBSUB_TOPIC;
      const webhookDomain = process.env.WEBHOOK_DOMAIN;
      
      if (!pubsubTopic || !webhookDomain) {
        throw new Error('Missing GMAIL_PUBSUB_TOPIC or WEBHOOK_DOMAIN environment variables');
      }
      
      console.log(`📡 Using Pub/Sub topic: ${pubsubTopic}`);
      console.log(`📡 Webhook endpoint: ${webhookDomain}/webhooks/gmail`);
      
      // Set up Gmail watch with Pub/Sub topic
      const watchRequest = {
        userId: 'me',
        requestBody: {
          topicName: pubsubTopic,
          labelIds: ['INBOX'],
          labelFilterAction: 'include'
        }
      };
      
      const response = await this.gmail.users.watch(watchRequest);
      
      // Update webhook expiration in database if user is initialized
      if (this.currentUserId && response.data.expiration) {
        try {
          const expirationDate = new Date(parseInt(response.data.expiration));
          await this.tokenStorageService.updateWebhookExpiration(this.currentUserId, expirationDate);
          console.log(`📅 Webhook expiration saved: ${expirationDate}`);
        } catch (expError) {
          console.warn('⚠️ Failed to save webhook expiration:', expError);
        }
      }
      
      console.log('✅ Gmail webhook setup successful with real Pub/Sub integration!');
      console.log('📊 Watch details:', {
        historyId: response.data.historyId,
        expiration: response.data.expiration,
        pubsubTopic: pubsubTopic,
        webhookUrl: `${webhookDomain}/webhooks/gmail`
      });

      return {
        ...response.data,
        pubsubTopic,
        webhookUrl: `${webhookDomain}/webhooks/gmail`
      };
    } catch (error) {
      console.error('❌ Error setting up Gmail webhook:', error);
      throw error;
    }
  }

  async getWebhookStatus(): Promise<any> {
    try {
      console.log('🔍 Checking Gmail webhook status...');
      
      // Get user profile to check watch status
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      
      // Note: Gmail API doesn't have a direct "get watch status" method
      // We need to track this in our own database or by attempting to set up watch
      return {
        email: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal,
        note: 'Gmail API does not provide direct watch status. Use setup-webhook to establish/refresh subscription.'
      };
    } catch (error) {
      console.error('❌ Error checking webhook status:', error);
      throw error;
    }
  }

  async stopWebhook(): Promise<any> {
    try {
      console.log('🛑 Stopping Gmail webhook...');
      
      // Stop Gmail watch
      const response = await this.gmail.users.stop({ userId: 'me' });
      
      console.log('✅ Gmail webhook stopped successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Error stopping Gmail webhook:', error);
      throw error;
    }
  }

  // Process incremental changes using historyId
  async getEmailChanges(startHistoryId: string): Promise<any[]> {
    try {
      console.log(`📊 Fetching email changes since history ID: ${startHistoryId}`);
      
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        labelId: 'INBOX',
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
      });

      const changes = response.data.history || [];
      console.log(`✅ Found ${changes.length} changes since ${startHistoryId}`);
      
      return changes;
    } catch (error) {
      console.error('❌ Error fetching email changes:', error);
      throw error;
    }
  }

  /**
   * Send email via Gmail API
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param body - Email body (HTML or plain text)
   * @param threadId - Optional thread ID for replies
   * @returns Promise with Gmail message ID
   */
  /**
   * Safely send email with user context validation
   */
  async sendEmailForUser(userId: string, to: string, subject: string, body: string, threadId?: string): Promise<{ messageId: string; threadId: string }> {
    // Ensure we're initialized for the correct user
    this.ensureCorrectUserContext(userId);
    
    return this.sendEmail(to, subject, body, threadId);
  }

  async sendEmail(to: string, subject: string, body: string, threadId?: string): Promise<{ messageId: string; threadId: string }> {
    try {
      console.log(`📤 Sending email to: ${to}`);
      console.log(`📝 Subject: ${subject}`);
      
      // Create email message in RFC 2822 format
      const message = this.createEmailMessage(to, subject, body, threadId);
      
      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
          threadId: threadId || undefined
        }
      });

      const messageId = response.data.id;
      const responseThreadId = response.data.threadId;
      
      console.log(`✅ Email sent successfully!`);
      console.log(`📧 Message ID: ${messageId}`);
      console.log(`🧵 Thread ID: ${responseThreadId}`);
      
      return {
        messageId,
        threadId: responseThreadId
      };
    } catch (error) {
      // Handle different types of Gmail API errors appropriately
      const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
      
      if (status === 404) {
        console.error('❌ Send failed: Gmail send permission not available or target not found');
        throw new Error('Gmail send permission not available - user may need to re-authenticate with send scope');
      } else if (status === 403) {
        console.error('❌ Send failed: Insufficient permissions');
        throw new Error('Insufficient Gmail API permissions - check OAuth scopes');
      } else if (status === 429) {
        console.error('❌ Send failed: Rate limit exceeded');
        throw new Error('Gmail API rate limit exceeded - try again later');
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Error sending email:', message);
        throw new Error(`Failed to send email: ${message}`);
      }
    }
  }

  /**
   * Create email message in RFC 2822 format
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param body - Email body
   * @param threadId - Optional thread ID for replies
   * @returns Base64 encoded email message
   */
  private createEmailMessage(to: string, subject: string, body: string, threadId?: string): string {
    const boundary = 'boundary_' + Math.random().toString(36).substring(2, 15);
    const date = new Date().toUTCString();
    
    // Get sender email from authenticated user
    const fromEmail = process.env.GOOGLE_USER_EMAIL || 'me';
    
    let message = '';
    
    // Email headers
    message += `To: ${to}\r\n`;
    message += `From: ${fromEmail}\r\n`;
    message += `Subject: ${subject}\r\n`;
    message += `Date: ${date}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    
    if (threadId) {
      message += `In-Reply-To: <${threadId}@gmail.com>\r\n`;
      message += `References: <${threadId}@gmail.com>\r\n`;
    }
    
    message += `\r\n`;
    
    // Plain text part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += this.formatPlainText(body) + `\r\n\r\n`;
    
    // HTML part
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/html; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    message += this.textToHtml(body) + `\r\n\r\n`;
    
    // End boundary
    message += `--${boundary}--\r\n`;
    
    // Encode to base64url
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    return encodedMessage;
  }

  /**
   * Format plain text for email display
   * @param text - Plain text string
   * @returns Formatted plain text string
   */
  private formatPlainText(text: string): string {
    return text
      .replace(/\n\n/g, '\n\n') // Preserve double line breaks
      .replace(/\n/g, '\n')     // Preserve single line breaks
      .trim();
  }

  /**
   * Convert plain text to HTML for email display
   * @param text - Plain text string
   * @returns HTML formatted string
   */
  private textToHtml(text: string): string {
    return text
      .replace(/\n\n/g, '</p><p>')  // Double line breaks become paragraph breaks
      .replace(/\n/g, '<br>')       // Single line breaks become <br>
      .replace(/^/, '<p>')          // Start with <p>
      .replace(/$/, '</p>')         // End with </p>
      .replace(/<p><\/p>/g, '')     // Remove empty paragraphs
      .trim();
  }
}