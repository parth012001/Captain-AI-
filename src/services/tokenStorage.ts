import { pool } from '../database/connection';
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export interface UserTokenData {
  userId: string;
  gmailAddress: string;
  refreshTokenEncrypted: string;
  accessTokenEncrypted?: string;
  accessTokenExpiresAt?: Date;
  webhookActive: boolean;
  webhookExpiresAt?: Date;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  onboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
}

export class TokenStorageService {
  
  /**
   * Encrypt sensitive token data before storing in database
   */
  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt token data retrieved from database
   */
  private decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Token decryption failed');
    }
  }

  /**
   * Generate consistent user ID from Gmail address
   */
  generateUserId(gmailAddress: string): string {
    return crypto
      .createHash('sha256')
      .update(gmailAddress.toLowerCase())
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Save user tokens to database after OAuth
   */
  async saveUserTokens(
    gmailAddress: string, 
    tokens: TokenCredentials
  ): Promise<string> {
    try {
      const userId = this.generateUserId(gmailAddress);
      
      console.log(`💾 Saving tokens for user: ${gmailAddress}`);
      
      const query = `
        INSERT INTO user_gmail_tokens (
          user_id, gmail_address, refresh_token_encrypted, 
          access_token_encrypted, access_token_expires_at, webhook_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          access_token_expires_at = EXCLUDED.access_token_expires_at,
          webhook_active = true,
          updated_at = NOW()
        RETURNING user_id
      `;

      const values = [
        userId,
        gmailAddress,
        this.encrypt(tokens.refreshToken),
        tokens.accessToken ? this.encrypt(tokens.accessToken) : null,
        tokens.expiresAt || new Date(Date.now() + 3600 * 1000), // 1 hour default
      ];

      const result = await pool.query(query, values);
      console.log(`✅ Tokens saved for user ID: ${userId}`);
      
      return userId;
    } catch (error) {
      console.error('❌ Error saving user tokens:', error);
      throw error;
    }
  }

  /**
   * Get user tokens from database for webhook processing
   */
  async getUserTokens(userId: string): Promise<UserTokenData | null> {
    try {
      const query = `
        SELECT user_id, gmail_address, refresh_token_encrypted,
               access_token_encrypted, access_token_expires_at,
               webhook_active, webhook_expires_at, first_name, last_name,
               full_name, onboarding_completed, created_at, updated_at
        FROM user_gmail_tokens 
        WHERE user_id = $1 AND webhook_active = true
      `;

      const result = await pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        gmailAddress: row.gmail_address,
        refreshTokenEncrypted: row.refresh_token_encrypted,
        accessTokenEncrypted: row.access_token_encrypted,
        accessTokenExpiresAt: row.access_token_expires_at,
        webhookActive: row.webhook_active,
        webhookExpiresAt: row.webhook_expires_at,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        onboardingCompleted: row.onboarding_completed,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('❌ Error getting user tokens:', error);
      return null;
    }
  }

  /**
   * Check if a user exists by email address (for intent-based auth)
   */
  async getUserByEmail(gmailAddress: string): Promise<UserTokenData | null> {
    try {
      const query = `
        SELECT user_id, gmail_address, first_name, last_name, full_name, 
               onboarding_completed, webhook_active, created_at, updated_at
        FROM user_gmail_tokens
        WHERE gmail_address = $1
      `;
      
      const result = await pool.query(query, [gmailAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        gmailAddress: row.gmail_address,
        refreshTokenEncrypted: '', // Don't expose tokens in this check
        accessTokenEncrypted: undefined,
        accessTokenExpiresAt: undefined,
        webhookActive: row.webhook_active,
        webhookExpiresAt: undefined,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        onboardingCompleted: row.onboarding_completed,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('❌ Error checking user existence:', error);
      return null;
    }
  }

  /**
   * Get decrypted credentials for API calls
   */
  async getDecryptedCredentials(userId: string): Promise<TokenCredentials | null> {
    try {
      const tokenData = await this.getUserTokens(userId);
      if (!tokenData) return null;

      return {
        refreshToken: this.decrypt(tokenData.refreshTokenEncrypted),
        accessToken: tokenData.accessTokenEncrypted 
          ? this.decrypt(tokenData.accessTokenEncrypted) 
          : '',
        expiresAt: tokenData.accessTokenExpiresAt
      };
    } catch (error) {
      console.error('❌ Error getting decrypted credentials:', error);
      return null;
    }
  }

  /**
   * Update access token after refresh
   */
  async updateAccessToken(
    userId: string, 
    accessToken: string, 
    expiresAt?: Date
  ): Promise<void> {
    try {
      const query = `
        UPDATE user_gmail_tokens 
        SET access_token_encrypted = $2,
            access_token_expires_at = $3,
            updated_at = NOW()
        WHERE user_id = $1
      `;

      const values = [
        userId,
        this.encrypt(accessToken),
        expiresAt || new Date(Date.now() + 3600 * 1000) // 1 hour default
      ];

      await pool.query(query, values);
      console.log(`✅ Access token updated for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error updating access token:', error);
      throw error;
    }
  }

  /**
   * Get all active webhook users for processing
   */
  async getActiveWebhookUsers(): Promise<UserTokenData[]> {
    try {
      const query = `
        SELECT user_id, gmail_address, refresh_token_encrypted,
               access_token_encrypted, access_token_expires_at,
               webhook_active, webhook_expires_at, created_at, updated_at
        FROM user_gmail_tokens
        WHERE webhook_active = true AND refresh_token_encrypted IS NOT NULL
        ORDER BY created_at ASC
      `;

      const result = await pool.query(query);
      return result.rows.map(row => ({
        userId: row.user_id,
        gmailAddress: row.gmail_address,
        refreshTokenEncrypted: row.refresh_token_encrypted,
        accessTokenEncrypted: row.access_token_encrypted,
        accessTokenExpiresAt: row.access_token_expires_at,
        webhookActive: row.webhook_active,
        webhookExpiresAt: row.webhook_expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error getting active webhook users:', error);
      return [];
    }
  }

  /**
   * Disable webhook for user (e.g., when tokens are revoked)
   */
  async disableWebhookForUser(userId: string, reason: string = 'Token error'): Promise<void> {
    try {
      const query = `
        UPDATE user_gmail_tokens 
        SET webhook_active = false, updated_at = NOW()
        WHERE user_id = $1
      `;

      await pool.query(query, [userId]);
      console.log(`⚠️ Webhook disabled for user ${userId}: ${reason}`);
    } catch (error) {
      console.error('❌ Error disabling webhook:', error);
    }
  }

  /**
   * Get user ID from Gmail address
   */
  async getUserIdByEmail(gmailAddress: string): Promise<string | null> {
    try {
      const query = `
        SELECT user_id FROM user_gmail_tokens 
        WHERE gmail_address = $1
      `;

      const result = await pool.query(query, [gmailAddress.toLowerCase()]);
      return result.rows.length > 0 ? result.rows[0].user_id : null;
    } catch (error) {
      console.error('❌ Error getting user ID by email:', error);
      return null;
    }
  }

  /**
   * Update webhook expiration after successful webhook setup/renewal
   */
  async updateWebhookExpiration(userId: string, expirationDate: Date): Promise<void> {
    try {
      const query = `
        UPDATE user_gmail_tokens 
        SET webhook_expires_at = $2, updated_at = NOW()
        WHERE user_id = $1
      `;

      await pool.query(query, [userId, expirationDate]);
      console.log(`✅ Webhook expiration updated for user ${userId}: ${expirationDate}`);
    } catch (error) {
      console.error('❌ Error updating webhook expiration:', error);
      throw error;
    }
  }

  /**
   * Get users with webhooks expiring soon (within 24 hours)
   */
  async getUsersWithExpiringWebhooks(): Promise<UserTokenData[]> {
    try {
      const query = `
        SELECT user_id, gmail_address, refresh_token_encrypted,
               access_token_encrypted, access_token_expires_at,
               webhook_active, webhook_expires_at, created_at, updated_at
        FROM user_gmail_tokens
        WHERE webhook_active = true 
          AND webhook_expires_at IS NOT NULL 
          AND webhook_expires_at <= NOW() + INTERVAL '24 hours'
          AND refresh_token_encrypted IS NOT NULL
        ORDER BY webhook_expires_at ASC
      `;

      const result = await pool.query(query);
      return result.rows.map(row => ({
        userId: row.user_id,
        gmailAddress: row.gmail_address,
        refreshTokenEncrypted: row.refresh_token_encrypted,
        accessTokenEncrypted: row.access_token_encrypted,
        accessTokenExpiresAt: row.access_token_expires_at,
        webhookActive: row.webhook_active,
        webhookExpiresAt: row.webhook_expires_at,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        onboardingCompleted: row.onboarding_completed,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error getting users with expiring webhooks:', error);
      return [];
    }
  }

  /**
   * Update user profile information
   */
  async updateUserProfile(userId: string, profileData: {
    firstName: string;
    lastName: string;
    fullName: string;
    onboardingCompleted: boolean;
  }): Promise<void> {
    try {
      const query = `
        UPDATE user_gmail_tokens 
        SET first_name = $2, last_name = $3, full_name = $4, 
            onboarding_completed = $5, updated_at = NOW()
        WHERE user_id = $1
      `;

      await pool.query(query, [
        userId,
        profileData.firstName,
        profileData.lastName,
        profileData.fullName,
        profileData.onboardingCompleted
      ]);

      console.log(`✅ User profile updated for ${userId}: ${profileData.fullName}`);
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  }
}