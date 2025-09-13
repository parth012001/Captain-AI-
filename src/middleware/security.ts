/**
 * Production Security Middleware
 * Rate limiting, security headers, and other production security measures
 */

import { Request, Response, NextFunction } from 'express';
import { env, features } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * Simple in-memory rate limiter
 * In production, you'd want to use Redis or similar for distributed systems
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(clientId: string): boolean {
    const now = Date.now();
    const clientData = this.requests.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // First request or window expired
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (clientData.count >= this.maxRequests) {
      logger.warn(`Rate limit exceeded for client: ${clientId}`);
      return false;
    }

    clientData.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [clientId, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(clientId);
      }
    }
  }
}

// Create rate limiters for different endpoints
const generalLimiter = new RateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes
const authLimiter = new RateLimiter(10, 15 * 60 * 1000);     // 10 auth requests per 15 minutes
const apiLimiter = new RateLimiter(200, 15 * 60 * 1000);     // 200 API requests per 15 minutes

// Cleanup old entries every 5 minutes
setInterval(() => {
  generalLimiter.cleanup();
  authLimiter.cleanup();
  apiLimiter.cleanup();
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware
 */
export function rateLimit(limiter: RateLimiter = generalLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!features.enableStrictSecurity) {
      return next(); // Skip in development
    }

    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    
    if (!limiter.isAllowed(clientId)) {
      logger.warn(`Rate limit exceeded`, { 
        clientId, 
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 15 * 60 // 15 minutes
      });
    }

    next();
  };
}

/**
 * Specific rate limiters for different endpoint types
 */
export const authRateLimit = rateLimit(authLimiter);
export const apiRateLimit = rateLimit(apiLimiter);

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Remove powered by header
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Request logging middleware
 */
export function requestLogging(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const clientId = req.ip || req.socket.remoteAddress || 'unknown';

  // Log request start
  logger.debug(`Incoming request`, {
    method: req.method,
    url: req.url,
    clientId,
    userAgent: req.get('User-Agent')
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    
    logger.info(`Request completed`, {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      clientId
    });

    return originalEnd(chunk, encoding, cb);
  };

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  logger.error(`Request error [${errorId}]`, {
    error: error.message,
    stack: env.NODE_ENV === 'development' ? error.stack : undefined,
    method: req.method,
    url: req.url,
    clientId: req.ip
  });

  // Don't expose internal errors in production
  const message = env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(error.status || 500).json({
    error: message,
    errorId: env.NODE_ENV === 'development' ? errorId : undefined
  });
}

/**
 * Health check bypass middleware
 * Skip security measures for health check endpoints
 */
export function healthCheckBypass(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/health/ready') {
    return next();
  }
  
  // Apply security middleware for all other endpoints
  securityHeaders(req, res, () => {
    rateLimit()(req, res, next);
  });
}