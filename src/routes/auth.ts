import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { TokenStorageService } from '../services/tokenStorage';

const router = Router();
const tokenStorageService = new TokenStorageService();

// User profile endpoint - get current user info
router.get('/me', authMiddleware.authenticate, async (req, res) => {
  try {
    const userTokens = await tokenStorageService.getUserTokens(req.userId!);
    
    if (!userTokens) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User data not found in database'
      });
    }

    res.json({
      user: {
        id: userTokens.userId,
        email: userTokens.gmailAddress,
        firstName: userTokens.firstName,
        lastName: userTokens.lastName,
        fullName: userTokens.fullName,
        onboardingCompleted: userTokens.onboardingCompleted,
        webhookActive: userTokens.webhookActive,
        createdAt: userTokens.createdAt,
        lastUpdated: userTokens.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      message: 'Internal server error'
    });
  }
});

// Update user profile endpoint - save user name and profile data
router.post('/profile', authMiddleware.authenticate, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'First name and last name are required'
      });
    }

    // Validate input
    if (firstName.length < 1 || firstName.length > 100) {
      return res.status(400).json({
        error: 'Invalid first name',
        message: 'First name must be between 1 and 100 characters'
      });
    }

    if (lastName.length < 1 || lastName.length > 100) {
      return res.status(400).json({
        error: 'Invalid last name',
        message: 'Last name must be between 1 and 100 characters'
      });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    
    // Update user profile in database
    await tokenStorageService.updateUserProfile(req.userId!, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: fullName,
      onboardingCompleted: true
    });

    console.log(`✅ User profile updated: ${req.userEmail} - ${fullName}`);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.userId,
        email: req.userEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: fullName,
        onboardingCompleted: true
      }
    });
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Internal server error'
    });
  }
});

// Logout endpoint - revoke user access
router.post('/logout', authMiddleware.authenticate, async (req, res) => {
  try {
    // Disable webhook for user (marks tokens as inactive)
    await tokenStorageService.disableWebhookForUser(req.userId!, 'User logout');
    
    console.log(`🔓 User logged out: ${req.userEmail} (${req.userId?.substring(0, 8)}...)`);
    
    res.json({
      message: 'Successfully logged out',
      note: 'Your tokens have been revoked'
    });
  } catch (error) {
    console.error('❌ Error during logout:', error);
    res.status(500).json({
      error: 'Failed to logout',
      message: 'Internal server error during logout'
    });
  }
});

// Health check for auth system
router.get('/health', async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    res.json({
      status: 'healthy',
      jwt_configured: !!jwtSecret,
      encryption_configured: !!encryptionKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Auth health check failed'
    });
  }
});

export default router;