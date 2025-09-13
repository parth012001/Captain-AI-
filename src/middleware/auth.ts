import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenStorageService } from '../services/tokenStorage';

// Extend Express Request type to include user context
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export class AuthMiddleware {
  private tokenStorageService: TokenStorageService;

  constructor() {
    this.tokenStorageService = new TokenStorageService();
  }

  /**
   * Generate JWT token for authenticated user
   */
  generateToken(userId: string, email: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.sign(
      { 
        userId, 
        email,
        type: 'access_token'
      },
      jwtSecret,
      { 
        expiresIn: '24h',
        issuer: 'chief-ai',
        audience: 'chief-ai-users'
      }
    );
  }

  /**
   * Verify JWT token and extract user information
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('❌ JWT_SECRET not configured');
        return null;
      }

      const payload = jwt.verify(token, jwtSecret, {
        issuer: 'chief-ai',
        audience: 'chief-ai-users'
      }) as JWTPayload;

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('🕐 JWT token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.log('❌ Invalid JWT token');
      } else {
        console.error('❌ JWT verification failed:', error);
      }
      return null;
    }
  }

  /**
   * Express middleware to authenticate requests
   */
  authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token in Authorization header'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify JWT token
      const payload = this.verifyToken(token);
      if (!payload) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Token is expired or invalid. Please sign in again.'
        });
      }

      // Verify user still exists and has active tokens
      const userTokens = await this.tokenStorageService.getUserTokens(payload.userId);
      if (!userTokens || !userTokens.webhookActive) {
        return res.status(401).json({
          error: 'User access revoked',
          message: 'Your access has been revoked. Please sign in again.'
        });
      }

      // Add user context to request
      req.userId = payload.userId;
      req.userEmail = payload.email;

      console.log(`🔐 Authenticated user: ${payload.email} (${payload.userId.substring(0, 8)}...)`);
      
      next();
    } catch (error) {
      console.error('❌ Authentication middleware error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Internal server error during authentication'
      });
    }
  };

  /**
   * Optional middleware - only authenticate if token provided
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token provided, continue without authentication
        next();
        return;
      }

      // Token provided, verify it
      const token = authHeader.substring(7);
      const payload = this.verifyToken(token);
      
      if (payload) {
        // Valid token, add user context
        const userTokens = await this.tokenStorageService.getUserTokens(payload.userId);
        if (userTokens && userTokens.webhookActive) {
          req.userId = payload.userId;
          req.userEmail = payload.email;
        }
      }
      
      next();
    } catch (error) {
      console.error('❌ Optional authentication error:', error);
      // Continue without authentication on error
      next();
    }
  };

  /**
   * Middleware to ensure user context is available
   */
  requireUser = (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({
        error: 'User context required',
        message: 'This endpoint requires authentication'
      });
    }
    next();
  };
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();

// Helper function to get user ID with fallback (for gradual migration)
export function getUserId(req: Request): string {
  if (req.userId) {
    return req.userId;
  }
  
  // Fallback for development/testing
  console.warn('⚠️ No user context found, using default user for development');
  return 'default_user';
}

// Helper function for user email
export function getUserEmail(req: Request): string {
  return req.userEmail || 'unknown@example.com';
}