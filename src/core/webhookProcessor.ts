/**
 * Webhook Processor
 * Core business logic for processing Gmail webhook notifications
 */
import { serviceContainer } from './serviceContainer';

export class WebhookProcessor {
  /**
   * Process Gmail notification for multiple users
   */
  async processGmailNotificationMultiUser(notification: any): Promise<void> {
    try {
      console.log('🌍 Processing Gmail notification for target user...');

      const tokenStorageService = serviceContainer.get('tokenStorageService');

      // Extract target email from notification
      const targetEmail = notification.emailAddress;
      if (!targetEmail) {
        console.log('⚠️ No emailAddress found in notification. Processing for all active users as fallback.');

        // Fallback: Get all users with active webhooks
        const activeUsers = await tokenStorageService.getActiveWebhookUsers();
        console.log(`👥 Found ${activeUsers.length} active users with webhook subscriptions`);

        if (activeUsers.length === 0) {
          console.log('⚠️ No active webhook users found. Skipping processing.');
          return;
        }

        // Process notification for each active user
        const processingPromises = activeUsers.map(async (userTokens) => {
          try {
            console.log(`🔄 Processing notification for user: ${userTokens.gmailAddress} (${userTokens.userId.substring(0, 8)}...)`);

            const gmailService = serviceContainer.get('gmailService');

            // Initialize Gmail service for this specific user
            await gmailService.initializeForUser(userTokens.userId);

            // Process the notification for this user
            await this.processGmailNotificationForUser(notification, userTokens.userId);

            console.log(`✅ Completed processing for user: ${userTokens.gmailAddress}`);
          } catch (userError) {
            console.error(`❌ Error processing notification for user ${userTokens.gmailAddress}:`, userError);

            // If the error is auth-related, disable webhook for this user
            const errorMessage = userError instanceof Error ? userError.message : String(userError);
            if (errorMessage?.includes('invalid_grant') || errorMessage?.includes('unauthorized')) {
              console.log(`⚠️ Disabling webhook for user ${userTokens.gmailAddress} due to auth issues`);
              await tokenStorageService.disableWebhookForUser(userTokens.userId, 'Authentication failed during webhook processing');
            }
          }
        });

        // Wait for all user processing to complete
        await Promise.allSettled(processingPromises);
        return;
      }

      console.log(`🎯 Processing notification for specific user: ${targetEmail}`);

      // Find the specific user ID for this notification
      const targetUserId = await tokenStorageService.getUserIdByEmail(targetEmail);
      if (!targetUserId) {
        console.log(`⚠️ Target user ${targetEmail} not found. Skipping processing.`);
        return;
      }

      // Get the user's tokens to check if webhook is active
      const targetUserTokens = await tokenStorageService.getUserTokens(targetUserId);
      if (!targetUserTokens || !targetUserTokens.webhookActive) {
        console.log(`⚠️ Target user ${targetEmail} webhook not active. Skipping processing.`);
        return;
      }

      console.log(`👤 Found target user: ${targetUserTokens.gmailAddress} (${targetUserId.substring(0, 8)}...)`);

      // Process notification for the specific user only
      const processingPromises = [targetUserTokens].map(async (userTokens) => {
        try {
          console.log(`🔄 Processing notification for user: ${userTokens.gmailAddress} (${userTokens.userId.substring(0, 8)}...)`);

          const gmailService = serviceContainer.get('gmailService');

          // Initialize Gmail service for this specific user
          await gmailService.initializeForUser(userTokens.userId);

          // Process the notification for this user
          await this.processGmailNotificationForUser(notification, userTokens.userId);

          console.log(`✅ Completed processing for user: ${userTokens.gmailAddress}`);
        } catch (userError) {
          console.error(`❌ Error processing notification for user ${userTokens.gmailAddress}:`, userError);

          // If the error is auth-related, disable webhook for this user
          const errorMessage = userError instanceof Error ? userError.message : String(userError);
          if (errorMessage?.includes('invalid_grant') || errorMessage?.includes('unauthorized')) {
            console.log(`⚠️ Disabling webhook for user ${userTokens.gmailAddress} due to auth issues`);
            await tokenStorageService.disableWebhookForUser(userTokens.userId, 'Authentication failed during webhook processing');
          }
        }
      });

      // Wait for all user processing to complete
      await Promise.allSettled(processingPromises);

      console.log('🎉 Multi-user webhook processing completed for all active users');

    } catch (error) {
      console.error('❌ Critical error in multi-user webhook processing:', error);
    }
  }

  /**
   * Process Gmail notification for a specific user
   */
  private async processGmailNotificationForUser(notification: any, userId: string): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('🚀 Real-time email processing initiated...');
      console.log('🔄 Processing Gmail notification for auto-draft generation...');

      const gmailService = serviceContainer.get('gmailService');
      const emailModel = serviceContainer.get('emailModel');
      const intelligentEmailRouter = serviceContainer.get('intelligentEmailRouter');

      const historyId = notification.historyId;
      console.log(`📊 History ID: ${historyId}`);

      let emailsToProcess: any[] = [];

      // Step 1: Extract email data based on notification type
      if (notification.messageId) {
        console.log(`📩 Specific email received: ${notification.messageId}`);

        // Fetch the specific email
        const email = await gmailService.getEmailByMessageId(notification.messageId);
        if (email) {
          // Check if this specific email has been processed by webhook FOR THIS USER
          const existingEmail = await emailModel.getEmailByGmailId(email.id, userId);
          if (!existingEmail || !existingEmail.webhook_processed) {
            emailsToProcess = [email];
            const parsedEmail = gmailService.parseEmail(email);
            console.log(`📧 Specific email "${parsedEmail.subject}" added to processing queue for user (webhook_processed: ${existingEmail?.webhook_processed || 'new email'})`);
          } else {
            const parsedEmail = gmailService.parseEmail(email);
            console.log(`⏭️ Specific email "${parsedEmail.subject}" already processed by webhook for this user, skipping`);
            emailsToProcess = [];
          }
        }
      } else {
        console.log('📧 General notification - checking for new emails...');

        // Get recent emails and filter for new ones
        const recentEmails = await gmailService.getRecentEmails(5);

        for (const email of recentEmails) {
          // Check if we've already processed this email via webhook FOR THIS USER
          const existingEmail = await emailModel.getEmailByGmailId(email.id, userId);
          if (!existingEmail || !existingEmail.webhook_processed) {
            emailsToProcess.push(email);
            const parsedEmail = gmailService.parseEmail(email);
            console.log(`📧 Email "${parsedEmail.subject}" added to processing queue for user (webhook_processed: ${existingEmail?.webhook_processed || 'new email'})`);
          } else {
            const parsedEmail = gmailService.parseEmail(email);
            console.log(`⏭️ Email "${parsedEmail.subject}" already processed by webhook for this user, skipping`);
          }
        }
      }

      console.log(`📬 Found ${emailsToProcess.length} new emails to process`);

      // Step 2: Process emails in parallel with concurrency limit (SAFE PARALLEL PROCESSING)
      if (emailsToProcess.length > 0) {
        const CONCURRENCY_LIMIT = 3; // Limit concurrent API calls to avoid rate limits
        console.log(`🔄 [PARALLEL] Processing ${emailsToProcess.length} emails with concurrency limit: ${CONCURRENCY_LIMIT}`);

        const processWithConcurrencyLimit = async () => {
          const results: Array<{
            status: 'success' | 'skipped' | 'duplicate' | 'error';
            emailId: string;
            reason?: string;
            processingTime?: number;
          }> = [];

          for (let i = 0; i < emailsToProcess.length; i += CONCURRENCY_LIMIT) {
            const batch = emailsToProcess.slice(i, i + CONCURRENCY_LIMIT);
            const batchNumber = Math.floor(i / CONCURRENCY_LIMIT) + 1;
            console.log(`🔄 [PARALLEL] Processing batch ${batchNumber}: ${batch.length} emails`);

            // Process batch in parallel using Promise.allSettled for safe error handling
            const batchPromises = batch.map(emailData => this.processEmailSafe(emailData, userId));
            const batchResults = await Promise.allSettled(batchPromises);

            // Extract results and log any failures
            batchResults.forEach((result, index) => {
              if (result.status === 'fulfilled') {
                results.push(result.value);
              } else {
                console.error(`❌ [PARALLEL] Batch ${batchNumber} email ${index + 1} failed:`, result.reason);
                results.push({
                  status: 'error',
                  emailId: batch[index]?.id || 'unknown',
                  reason: result.reason?.message || 'Unknown error'
                });
              }
            });

            // Small delay between batches to be gentle on APIs
            if (i + CONCURRENCY_LIMIT < emailsToProcess.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          return results;
        };

        const processingResults = await processWithConcurrencyLimit();

        // Log processing summary
        const successful = processingResults.filter(r => r.status === 'success').length;
        const skipped = processingResults.filter(r => r.status === 'skipped').length;
        const duplicates = processingResults.filter(r => r.status === 'duplicate').length;
        const errors = processingResults.filter(r => r.status === 'error').length;

        console.log(`📊 [PARALLEL] Processing Summary:`);
        console.log(`   ✅ Successful: ${successful}`);
        console.log(`   ⏭️ Skipped: ${skipped}`);
        console.log(`   🔄 Duplicates: ${duplicates}`);
        console.log(`   ❌ Errors: ${errors}`);

        if (successful > 0 || skipped > 0) {
          console.log(`🎉 [PARALLEL] Successfully processed ${successful + skipped} emails!`);
        }
      } else {
        console.log(`📭 [PARALLEL] No emails to process`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`🎉 Gmail notification processing COMPLETE! Total time: ${totalTime}ms`);

    } catch (error) {
      console.error('❌ Error in processGmailNotificationForUser:', error);

      // Graceful degradation - store for manual processing
      await this.storeFailedNotification(notification, error);
    }
  }

  /**
   * Process individual email safely with error handling
   */
  private async processEmailSafe(emailData: any, userId: string): Promise<{
    status: 'success' | 'skipped' | 'duplicate' | 'error';
    emailId: string;
    reason?: string;
    processingTime?: number;
  }> {
    const processingStartTime = Date.now();

    try {
      const gmailService = serviceContainer.get('gmailService');
      const emailModel = serviceContainer.get('emailModel');
      const intelligentEmailRouter = serviceContainer.get('intelligentEmailRouter');

      // Parse email content
      const parsedEmail = gmailService.parseEmail(emailData);
      console.log(`📧 [PARALLEL] Processing: "${parsedEmail.subject}" from ${parsedEmail.from}`);

      // Step 3: Smart email filtering
      const shouldGenerateResponse = await this.shouldGenerateResponseForEmail(parsedEmail, userId);
      if (!shouldGenerateResponse.generate) {
        console.log(`⏭️ [PARALLEL] Skipping email: ${shouldGenerateResponse.reason}`);

        // Atomically save email and mark as webhook processed FOR THIS USER (even though no draft was generated)
        const result = await emailModel.saveEmailAndMarkAsWebhookProcessedForUser(parsedEmail, userId);
        if (result.success) {
          console.log(`🏷️ [PARALLEL] Email ID ${result.emailId} marked as webhook_processed = true for user (filtered out)`);
        } else {
          console.log(`⏭️ [PARALLEL] Email already processed by webhook for this user, skipping (filtered out)`);
        }
        return {
          status: 'skipped',
          emailId: parsedEmail.id,
          reason: shouldGenerateResponse.reason,
          processingTime: Date.now() - processingStartTime
        };
      }

      console.log(`✅ [PARALLEL] Email qualifies for response generation: ${shouldGenerateResponse.reason}`);

      // Step 4: Atomically save email and mark as webhook processed FOR THIS USER
      const result = await emailModel.saveEmailAndMarkAsWebhookProcessedForUser(parsedEmail, userId);
      if (!result.success) {
        console.log(`⏭️ [PARALLEL] Email already processed by webhook for this user, skipping draft generation`);
        return {
          status: 'duplicate',
          emailId: parsedEmail.id,
          processingTime: Date.now() - processingStartTime
        };
      }

      const emailId = result.emailId!;

      // 🚀 PHASE 3: Process email through intelligent router (replaces dual processing)
      console.log(`🧠 [PARALLEL] Routing email ${parsedEmail.id} through intelligent router...`);
      const routingResult = await intelligentEmailRouter.routeEmail(
        parsedEmail,
        userId,
        emailId // Use the email DB ID we already have
      );

      console.log(`✅ [PARALLEL] Email routed to ${routingResult.routingDecision.route.toUpperCase()} pipeline`);
      console.log(`🎯 [PARALLEL] Routing reasoning: ${routingResult.routingDecision.reasoning}`);

      if (routingResult.meetingResult?.isMeetingRequest) {
        console.log(`📅 [PARALLEL] Meeting detected! Type: ${routingResult.meetingResult.meetingRequest?.meetingType}, Confidence: ${routingResult.meetingResult.confidence}%`);
        if (routingResult.meetingResult.response) {
          console.log(`🤖 [PARALLEL] Meeting response generated: ${routingResult.meetingResult.response.actionTaken}`);
        }
      } else if (routingResult.autoDraftResult) {
        console.log(`📝 [PARALLEL] Auto-draft generated: "${routingResult.autoDraftResult.subject}"`);
        console.log(`🎯 [PARALLEL] Tone: ${routingResult.autoDraftResult.tone}, Urgency: ${routingResult.autoDraftResult.urgencyLevel}`);
      } else if (routingResult.routingDecision.route === 'skip') {
        console.log(`⏭️ [PARALLEL] Email skipped: ${routingResult.routingDecision.reasoning}`);
      }

      const totalProcessingTime = Date.now() - processingStartTime;
      console.log(`⚡ [PARALLEL] Email processing time: ${totalProcessingTime}ms`);

      // Email is already marked as webhook_processed by the atomic operation above
      console.log(`🏷️ [PARALLEL] Email ID ${emailId} already marked as webhook_processed = true`);

      return {
        status: 'success',
        emailId: parsedEmail.id,
        processingTime: totalProcessingTime
      };

    } catch (emailError) {
      console.error(`❌ [PARALLEL] Error processing email:`, emailError);
      return {
        status: 'error',
        emailId: emailData.id || 'unknown',
        reason: emailError instanceof Error ? emailError.message : 'Unknown error',
        processingTime: Date.now() - processingStartTime
      };
    }
  }

  /**
   * Smart email filtering logic
   */
  private async shouldGenerateResponseForEmail(email: any, userId: string): Promise<{
    generate: boolean;
    reason: string;
    classification?: string;
  }> {
    const fromEmail = email.from.toLowerCase();
    const subject = email.subject;
    const body = email.body;

    console.log(`🔍 Smart filtering email: "${subject}" from ${fromEmail}`);

    const aiService = serviceContainer.get('aiService');
    const promotionalEmailModel = serviceContainer.get('promotionalEmailModel');

    console.log(`✅ [LOOP PREVENTION DISABLED] Proceeding with email processing: "${subject}" from ${fromEmail}`);

    // Skip no-reply addresses (fast check)
    const noReplyPatterns = ['no-reply', 'noreply', 'do-not-reply', 'donotreply'];
    if (noReplyPatterns.some(pattern => fromEmail.includes(pattern))) {
      return { generate: false, reason: 'No-reply email address' };
    }

    // Skip obvious auto-generated emails (fast check)
    const autoGenerated = ['automated', 'auto-generated', 'system generated', 'bounce', 'delivery failure'];
    if (autoGenerated.some(keyword => subject.toLowerCase().includes(keyword)) ||
        autoGenerated.some(keyword => body.toLowerCase().includes(keyword.toLowerCase()))) {
      return { generate: false, reason: 'Auto-generated email detected' };
    }

    // Use AI classification for newsletter vs personal email detection
    try {
      const classification = await aiService.classifyEmail(subject, body, fromEmail);

      if (classification === 'newsletter') {
        // 🆕 NEW: Save promotional email instead of just discarding
        try {
          await promotionalEmailModel.savePromotionalEmail({
            gmail_id: email.id,
            user_id: userId,
            thread_id: email.threadId,
            subject: email.subject,
            from_email: email.from,
            to_email: email.to,
            body: email.body,
            classification_reason: 'newsletter',
            received_at: email.date
          });
          console.log(`📰 Promotional email saved for user ${userId}: "${subject}"`);
        } catch (saveError) {
          console.error('❌ Error saving promotional email:', saveError);
          // Continue with filtering even if save fails
        }

        return { generate: false, reason: 'AI classified as newsletter/promotional content', classification: 'newsletter' };
      } else {
        return { generate: true, reason: 'AI classified as personal/business communication', classification: 'personal' };
      }
    } catch (error) {
      console.error('❌ AI classification failed, defaulting to generate:', error);
      return { generate: true, reason: 'AI classification failed - defaulting to process' };
    }
  }

  /**
   * Store failed notification for manual review
   */
  private async storeFailedNotification(_notification: any, _error: any): Promise<void> {
    try {
      console.log('💾 Storing failed notification for manual review...');
      // Store failed notification for manual processing
      // Implementation would depend on your specific storage requirements
    } catch (storeError) {
      console.error('❌ Failed to store failed notification:', storeError);
    }
  }
}