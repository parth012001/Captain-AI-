import { Pool } from 'pg';

export interface UserProfile {
  userId: string;
  gmailAddress: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  onboardingCompleted: boolean;
}

export class UserProfileService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const query = `
        SELECT user_id, gmail_address, first_name, last_name, full_name, onboarding_completed
        FROM user_gmail_tokens 
        WHERE user_id = $1
      `;
      
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        userId: row.user_id,
        gmailAddress: row.gmail_address,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: row.full_name,
        onboardingCompleted: row.onboarding_completed
      };
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Get user signature for AI draft generation
   */
  async getUserSignature(userId: string): Promise<string> {
    try {
      const profile = await this.getUserProfile(userId);
      
      if (!profile || !profile.firstName) {
        // Fallback to email-based name extraction
        const emailName = profile?.gmailAddress?.split('@')[0] || 'User';
        return `Best regards,\n${emailName}`;
      }
      
      // Use the actual name from onboarding
      return `Best regards,\n${profile.firstName}`;
    } catch (error) {
      console.error('❌ Error getting user signature:', error);
      return 'Best regards,\nUser';
    }
  }

  /**
   * Check if user has completed profile setup (has name data)
   */
  async hasCompleteProfile(userId: string): Promise<boolean> {
    try {
      const profile = await this.getUserProfile(userId);
      return profile?.onboardingCompleted === true && !!profile?.firstName;
    } catch (error) {
      console.error('❌ Error checking profile completion:', error);
      return false;
    }
  }
}
