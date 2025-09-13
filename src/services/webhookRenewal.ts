import { TokenStorageService } from './tokenStorage';
import { GmailService } from './gmail';

export class WebhookRenewalService {
  private tokenStorageService: TokenStorageService;
  private renewalInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.tokenStorageService = new TokenStorageService();
  }

  /**
   * Start automatic webhook renewal service
   * Checks every 6 hours for webhooks expiring in the next 24 hours
   */
  startRenewalService(): void {
    console.log('🔄 Starting webhook renewal service...');
    
    // Run immediately on startup
    this.checkAndRenewWebhooks();
    
    // Then run every 6 hours
    this.renewalInterval = setInterval(() => {
      this.checkAndRenewWebhooks();
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
    
    console.log('✅ Webhook renewal service started (checks every 6 hours)');
  }

  /**
   * Stop the renewal service
   */
  stopRenewalService(): void {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
      console.log('🛑 Webhook renewal service stopped');
    }
  }

  /**
   * Check for expiring webhooks and renew them
   */
  private async checkAndRenewWebhooks(): Promise<void> {
    try {
      console.log('🔍 Checking for expiring webhooks...');
      
      const expiringUsers = await this.tokenStorageService.getUsersWithExpiringWebhooks();
      
      if (expiringUsers.length === 0) {
        console.log('✅ No webhooks need renewal at this time');
        return;
      }

      console.log(`⚠️ Found ${expiringUsers.length} webhook(s) expiring within 24 hours`);

      // Renew webhooks for each user
      for (const user of expiringUsers) {
        await this.renewWebhookForUser(user.userId, user.gmailAddress);
      }

    } catch (error) {
      console.error('❌ Error in webhook renewal check:', error);
    }
  }

  /**
   * Renew webhook for a specific user
   */
  private async renewWebhookForUser(userId: string, gmailAddress: string): Promise<void> {
    try {
      console.log(`🔄 Renewing webhook for user: ${gmailAddress}`);

      const gmailService = new GmailService();
      
      // Initialize Gmail service for the user
      await gmailService.initializeForUser(userId);
      
      // Setup/renew the webhook
      const watchResponse = await gmailService.setupWebhook();
      
      console.log(`✅ Webhook renewed successfully for ${gmailAddress}:`);
      console.log(`   - New expiration: ${new Date(parseInt(watchResponse.expiration))}`);
      console.log(`   - History ID: ${watchResponse.historyId}`);

    } catch (error) {
      console.error(`❌ Failed to renew webhook for ${gmailAddress}:`, error);
      
      // If renewal fails, disable webhook to prevent continuous failures
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('credentials')) {
        console.warn(`🚨 Disabling webhook for ${gmailAddress} due to invalid credentials`);
        await this.tokenStorageService.disableWebhookForUser(userId, 'Invalid credentials');
      }
    }
  }

  /**
   * Manually trigger webhook renewal check (for testing/debugging)
   */
  async manualRenewalCheck(): Promise<void> {
    console.log('🔧 Manual webhook renewal check triggered');
    await this.checkAndRenewWebhooks();
  }

  /**
   * Get webhook status for all active users
   */
  async getWebhookStatus(): Promise<any[]> {
    try {
      const activeUsers = await this.tokenStorageService.getActiveWebhookUsers();
      
      return activeUsers.map(user => ({
        userId: user.userId,
        gmailAddress: user.gmailAddress,
        webhookActive: user.webhookActive,
        webhookExpiresAt: user.webhookExpiresAt,
        timeUntilExpiration: user.webhookExpiresAt 
          ? Math.max(0, user.webhookExpiresAt.getTime() - Date.now()) 
          : null,
        needsRenewal: user.webhookExpiresAt 
          ? user.webhookExpiresAt.getTime() <= (Date.now() + 24 * 60 * 60 * 1000)
          : false
      }));
    } catch (error) {
      console.error('❌ Error getting webhook status:', error);
      return [];
    }
  }
}