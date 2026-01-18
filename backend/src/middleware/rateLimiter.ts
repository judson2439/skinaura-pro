/**
 * Rate Limiting Middleware for HIPAA Compliance
 * Protects against brute force attacks and API abuse
 * 
 * Different rate limits for different endpoint types:
 * - Auth endpoints (login/signup): Strict limits to prevent brute force
 * - API endpoints: General limits for normal usage
 * - Admin endpoints: Moderate limits for admin operations
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logAudit, getClientIp, getUserAgent } from '../lib/auditLogger.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Custom key generator that uses IP address
 * Falls back to socket address if IP is not available
 */
const getKeyFromRequest = (req: Request): string => {
  const ip = getClientIp(req);
  return ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * Custom handler for when rate limit is exceeded
 * Logs the event for security monitoring
 */
const createRateLimitHandler = (limitType: string) => {
  return async (req: Request, res: Response): Promise<void> => {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    // Log rate limit exceeded event
    await logAudit({
      action: 'PERMISSION_DENIED',
      resourceType: 'system',
      ipAddress: ip,
      userAgent: userAgent,
      details: {
        reason: 'rate_limit_exceeded',
        limit_type: limitType,
        path: req.path,
        method: req.method,
      },
      status: 'denied',
      errorMessage: `Rate limit exceeded for ${limitType}`,
    });

    console.warn(`⚠️ RATE LIMIT: ${limitType} limit exceeded from IP ${ip} on ${req.method} ${req.path}`);

    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  };
};

/**
 * Skip rate limiting for certain conditions
 */
const skipFunction = (req: Request): boolean => {
  // Skip rate limiting for health check endpoints
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }
  return false;
};

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/signup
 * 
 * Limits: 5 requests per 15 minutes per IP
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 attempts per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('auth'),
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

/**
 * Moderate rate limiter for signup endpoints
 * Prevents account creation abuse
 * 
 * Limits: 3 signups per hour per IP
 */
export const signupRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3, // 3 signups per hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('signup'),
  message: {
    success: false,
    error: 'Too many signup attempts. Please try again in an hour.',
  },
});

/**
 * Rate limiter for password reset requests
 * Prevents password reset abuse/enumeration
 * 
 * Limits: 3 requests per 15 minutes per IP
 */
export const passwordResetRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 3, // 3 attempts per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('password_reset'),
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again in 15 minutes.',
  },
});

/**
 * Rate limiter for verification code resend
 * Prevents SMS/email abuse
 * 
 * Limits: 3 requests per 5 minutes per IP
 */
export const verificationResendRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 3, // 3 resends per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('verification_resend'),
  message: {
    success: false,
    error: 'Too many verification requests. Please try again in 5 minutes.',
  },
});

/**
 * General API rate limiter for authenticated endpoints
 * Prevents API abuse while allowing normal usage
 * 
 * Limits: 100 requests per minute per IP
 */
export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // 100 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('api'),
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
});

/**
 * Stricter rate limiter for file upload endpoints
 * Prevents storage abuse
 * 
 * Limits: 20 uploads per minute per IP
 */
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20, // 20 uploads per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('upload'),
  message: {
    success: false,
    error: 'Too many uploads. Please try again later.',
  },
});

/**
 * Rate limiter for admin endpoints
 * More permissive but still protected
 * 
 * Limits: 200 requests per minute per IP
 */
export const adminRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 200, // 200 requests per minute
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('admin'),
  message: {
    success: false,
    error: 'Too many admin requests. Please slow down.',
  },
});

/**
 * Very strict rate limiter for sensitive operations
 * Like exporting data, bulk operations, etc.
 * 
 * Limits: 10 requests per hour per IP
 */
export const sensitiveOperationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 requests per hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: getKeyFromRequest,
  skip: skipFunction,
  handler: createRateLimitHandler('sensitive'),
  message: {
    success: false,
    error: 'Too many sensitive operations. Please try again later.',
  },
});

export default {
  authRateLimiter,
  signupRateLimiter,
  passwordResetRateLimiter,
  verificationResendRateLimiter,
  apiRateLimiter,
  uploadRateLimiter,
  adminRateLimiter,
  sensitiveOperationRateLimiter,
};
