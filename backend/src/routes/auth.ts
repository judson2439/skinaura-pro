/**
 * Authentication routes with encrypted request handling.
 * Uses PostgreSQL for user authentication and storage.
 * Users must verify email before they can sign in.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { decryptRequestData, EncryptedPayload } from '../lib/crypto.js';
import { 
  authenticateUser, 
  createUser, 
  verifyEmailCode, 
  resendVerificationEmail,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  resendPhoneVerificationCode,
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
} from '../lib/auth.js';
import { logAudit, getClientIp, getUserAgent } from '../lib/auditLogger.js';
import {
  authRateLimiter,
  signupRateLimiter,
  passwordResetRateLimiter,
  verificationResendRateLimiter,
} from '../middleware/rateLimiter.js';
import {
  checkLoginAllowed,
  handleFailedLogin,
  handleSuccessfulLogin,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
} from '../lib/accountLockout.js';
import { query, queryOne } from '../config/database.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique filename for encrypted files
 */
const generateFilename = (ext: string = '.enc'): string => {
  const hash = crypto.randomBytes(16).toString('hex');
  return `enc_${hash}${ext}`;
};

/**
 * Save pre-encrypted avatar data from frontend during signup
 * Frontend encrypts the image, backend just stores the encrypted data as-is
 * @param encryptedData - Base64 encoded encrypted image data
 * @param iv - Base64 encoded IV
 * @param mimeType - MIME type of the original image
 * @returns The avatar URL path or null if failed
 */
const saveEncryptedAvatar = (encryptedData: string, iv: string, mimeType?: string): string | null => {
  try {
    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const detectedMimeType = mimeType || 'image/jpeg';
    const ext = detectedMimeType.split('/')[1] === 'jpeg' ? '.jpg' : `.${detectedMimeType.split('/')[1]}`;
    const filename = generateFilename(ext);
    const filePath = path.join(uploadDir, filename);

    // Save the encrypted data as JSON (same format as image.ts)
    const fileData = JSON.stringify({
      encrypted: encryptedData,
      iv: iv,
      mimeType: detectedMimeType,
    });
    
    fs.writeFileSync(filePath, fileData, 'utf-8');

    console.log(`✅ Encrypted avatar saved: ${filename}`);

    // Return the URL path
    return `/api/images/avatars/${filename}`;
  } catch (error) {
    console.error('❌ Failed to save avatar:', error);
    return null;
  }
};

// Types
interface SignInRequest {
  email: string;
  password: string;
  selectedRole?: 'client' | 'professional' | 'admin';
}

interface SignUpRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: 'client' | 'professional';
  skinType?: string;
  concerns?: string[];
  businessName?: string;
  licenseNumber?: string;
  avatarUrl?: string;
  // Pre-encrypted avatar data from frontend
  avatarEncrypted?: string;  // Base64 encoded encrypted image
  avatarIv?: string;         // Base64 encoded IV
  avatarMimeType?: string;   // Original mime type
}

interface VerifyEmailRequest {
  email: string;
  code: string;
}

interface ResendVerificationRequest {
  email: string;
}

interface SendPhoneVerificationRequest {
  email: string;
  phone: string;
}

interface VerifyPhoneRequest {
  email: string;
  code: string;
}

interface ResendPhoneVerificationRequest {
  email: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: {
      id: string;
      email: string;
      full_name: string;
      phone?: string;
      email_verified: boolean;
      phone_verified?: boolean;
      role?: string;
      avatar_url?: string;
    };
    token?: string;
    needsPhoneVerification?: boolean;
    redirectTo?: string;
    needsVerification?: boolean;
    roleMismatch?: boolean;
    actualRole?: string;
  };
  error?: string;
}

/**
 * Decrypt request middleware for auth routes
 */
const decryptAuthRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const body = req.body as EncryptedPayload | Record<string, unknown>;

  // Check if body is encrypted
  if (body && 'data' in body && 'iv' in body && 'timestamp' in body) {
    const result = decryptRequestData<Record<string, unknown>>(body as EncryptedPayload);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to decrypt request',
      } as AuthResponse);
      return;
    }

    req.body = result.data;
    console.log('✅ Request decrypted successfully');
  }

  next();
};

// Apply decryption middleware to all auth routes
router.use(decryptAuthRequest);

/**
 * POST /auth/signup
 * User registration with email verification
 */
router.post('/signup', signupRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const signupData = req.body as SignUpRequest;

    // Validate required fields
    if (!signupData.email || !signupData.password || !signupData.fullName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      } as AuthResponse);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupData.email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as AuthResponse);
      return;
    }

    // Password validation
    if (signupData.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as AuthResponse);
      return;
    }

    console.log(`📝 Sign-up attempt for: ${signupData.email}`);

    // Create user in database and send verification email
    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: signupData.role || 'client',
      skinType: signupData.skinType,
      concerns: signupData.concerns,
      businessName: signupData.businessName,
      licenseNumber: signupData.licenseNumber,
      avatarUrl: signupData.avatarUrl,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create account',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Account created for: ${signupData.email}, verification email sent`);

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for verification code.',
      data: {
        user: result.user,
        needsVerification: true,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Sign-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-up',
    } as AuthResponse);
  }
});

/**
 * POST /auth/client/signup
 * Client registration (alias for /signup)
 */
router.post('/client/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const signupData = req.body as SignUpRequest;

    if (!signupData.email || !signupData.password || !signupData.fullName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      } as AuthResponse);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupData.email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as AuthResponse);
      return;
    }

    if (signupData.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as AuthResponse);
      return;
    }

    console.log(`📝 Client sign-up attempt for: ${signupData.email}`);

    // Handle pre-encrypted avatar from frontend
    let avatarUrl = signupData.avatarUrl;
    if (signupData.avatarEncrypted && signupData.avatarIv && !avatarUrl) {
      avatarUrl = saveEncryptedAvatar(signupData.avatarEncrypted, signupData.avatarIv, signupData.avatarMimeType) || undefined;
    }

    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: 'client',
      skinType: signupData.skinType,
      concerns: signupData.concerns,
      avatarUrl: avatarUrl,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create account',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Client account created for: ${signupData.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for verification code.',
      data: {
        user: result.user,
        needsVerification: true,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Client sign-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-up',
    } as AuthResponse);
  }
});

/**
 * POST /auth/professional/signup
 * Professional registration
 */
router.post('/professional/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const signupData = req.body as SignUpRequest;

    if (!signupData.email || !signupData.password || !signupData.fullName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required',
      } as AuthResponse);
      return;
    }

    if (!signupData.businessName) {
      res.status(400).json({
        success: false,
        error: 'Business name is required for professionals',
      } as AuthResponse);
      return;
    }

    if (signupData.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as AuthResponse);
      return;
    }

    console.log(`📝 Professional sign-up attempt for: ${signupData.email}`);

    // Handle pre-encrypted avatar from frontend
    let avatarUrl = signupData.avatarUrl;
    if (signupData.avatarEncrypted && signupData.avatarIv && !avatarUrl) {
      avatarUrl = saveEncryptedAvatar(signupData.avatarEncrypted, signupData.avatarIv, signupData.avatarMimeType) || undefined;
    }

    // Create professional account with all profile details
    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: 'professional',
      businessName: signupData.businessName,
      licenseNumber: signupData.licenseNumber,
      avatarUrl: avatarUrl,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create account',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Professional account created for: ${signupData.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for verification code.',
      data: {
        user: result.user,
        needsVerification: true,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Professional sign-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-up',
    } as AuthResponse);
  }
});

/**
 * POST /auth/verify-email
 * Verify email with code
 */
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body as VerifyEmailRequest;

    if (!email || !code) {
      res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Email verification attempt for: ${email}`);

    const result = await verifyEmailCode(email, code);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Verification failed',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Email verified for: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Email verified! Now please verify your phone number.',
      data: {
        needsPhoneVerification: true,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
    } as AuthResponse);
  }
});

/**
 * POST /auth/resend-verification
 * Resend verification email
 */
router.post('/resend-verification', verificationResendRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as ResendVerificationRequest;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as AuthResponse);
      return;
    }

    console.log(`📧 Resend verification request for: ${email}`);

    const result = await resendVerificationEmail(email);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to resend verification email',
      } as AuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/send-phone-verification
 * Send phone verification code
 */
router.post('/send-phone-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone } = req.body as SendPhoneVerificationRequest;

    if (!email || !phone) {
      res.status(400).json({
        success: false,
        error: 'Email and phone number are required',
      } as AuthResponse);
      return;
    }

    // Basic phone validation
    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    if (cleanedPhone.length < 10) {
      res.status(400).json({
        success: false,
        error: 'Please enter a valid phone number',
      } as AuthResponse);
      return;
    }

    const result = await sendPhoneVerificationCode(email, phone);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send verification code',
      } as AuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your phone!',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Send phone verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/verify-phone
 * Verify phone with code
 */
router.post('/verify-phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body as VerifyPhoneRequest;

    if (!email || !code) {
      res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Phone verification attempt for: ${email}`);

    const result = await verifyPhoneCode(email, code);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Verification failed',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Phone verified for: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Phone verified successfully! You can now sign in.',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Phone verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
    } as AuthResponse);
  }
});

/**
 * POST /auth/resend-phone-verification
 * Resend phone verification code
 */
router.post('/resend-phone-verification', verificationResendRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as ResendPhoneVerificationRequest;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as AuthResponse);
      return;
    }

    console.log(`📱 Resend phone verification request for: ${email}`);

    const result = await resendPhoneVerificationCode(email);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to resend verification code',
      } as AuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your phone!',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Resend phone verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/signin
 * User sign-in with role validation and account lockout protection
 */
router.post('/signin', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, selectedRole } = req.body as SignInRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Sign-in attempt for: ${email}`);

    // Check if account is locked due to too many failed attempts
    const lockoutCheck = await checkLoginAllowed(email, req);
    if (!lockoutCheck.allowed) {
      console.warn(`🔒 Sign-in blocked - account locked for: ${email}`);
      res.status(429).json({
        success: false,
        error: lockoutCheck.message,
        message: lockoutCheck.message,
        data: {
          locked: true,
          remainingMinutes: lockoutCheck.remainingMinutes,
        },
      } as AuthResponse);
      return;
    }

    const result = await authenticateUser(email, password);

    if (!result.success) {
      // Handle failed login with lockout tracking
      const lockoutResult = await handleFailedLogin(
        email,
        req,
        result.needsVerification ? 'needs_verification' : 'invalid_credentials'
      );

      // Log failed login attempt
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: result.needsVerification ? 'needs_verification' : 'invalid_credentials',
          selectedRole,
          attempts_remaining: lockoutResult.attemptsRemaining,
          account_locked: lockoutResult.locked,
        },
        status: 'failure',
        errorMessage: result.error,
      });

      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        message: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        data: {
          ...(result.needsVerification ? { needsVerification: true } : {}),
          attemptsRemaining: lockoutResult.attemptsRemaining,
          locked: lockoutResult.locked,
        },
      } as AuthResponse);
      return;
    }

    // Get actual role from user profile
    const actualRole = result.user?.role || 'client';
    
    // If selectedRole is provided, validate it matches
    if (selectedRole && actualRole !== selectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${selectedRole}', actual '${actualRole}'`);
      
      // Log role mismatch attempt
      await logAudit({
        userId: result.user?.id,
        userEmail: email,
        userRole: actualRole,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: 'role_mismatch',
          selectedRole,
          actualRole,
        },
        status: 'failure',
        errorMessage: 'Role mismatch',
      });

      res.status(403).json({
        success: false,
        error: `You selected the wrong role. Your account is registered as "${actualRole}". Please select the correct role to sign in.`,
        data: {
          roleMismatch: true,
          actualRole: actualRole,
        },
      } as AuthResponse);
      return;
    }

    // Determine redirect path based on actual role
    let redirectTo = '/client';
    if (actualRole === 'admin') {
      redirectTo = '/admin';
    } else if (actualRole === 'professional') {
      redirectTo = '/professional';
    }

    // Clear failed login attempts on successful login
    await handleSuccessfulLogin(email, req);

    // Log successful login
    await logAudit({
      userId: result.user?.id,
      userEmail: email,
      userRole: actualRole,
      action: 'LOGIN',
      resourceType: 'session',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        method: 'email_password',
        redirectTo,
      },
      status: 'success',
    });

    console.log(`✅ Sign-in successful for: ${email} (role: ${actualRole})`);

    res.status(200).json({
      success: true,
      message: 'Sign-in successful',
      data: {
        user: result.user,
        token: result.token,
        redirectTo: redirectTo,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Sign-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-in',
    } as AuthResponse);
  }
});

/**
 * POST /auth/client/signin
 * Client sign-in with role validation and account lockout protection
 */
router.post('/client/signin', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, selectedRole } = req.body as SignInRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Client sign-in attempt for: ${email}`);

    // Check if account is locked
    const lockoutCheck = await checkLoginAllowed(email, req);
    if (!lockoutCheck.allowed) {
      console.warn(`🔒 Client sign-in blocked - account locked for: ${email}`);
      res.status(429).json({
        success: false,
        error: lockoutCheck.message,
        message: lockoutCheck.message,
        data: {
          locked: true,
          remainingMinutes: lockoutCheck.remainingMinutes,
        },
      } as AuthResponse);
      return;
    }

    const result = await authenticateUser(email, password);

    if (!result.success) {
      // Handle failed login with lockout tracking
      const lockoutResult = await handleFailedLogin(
        email,
        req,
        result.needsVerification ? 'needs_verification' : 'invalid_credentials'
      );

      // Log failed login
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: result.needsVerification ? 'needs_verification' : 'invalid_credentials',
          portal: 'client',
          attempts_remaining: lockoutResult.attemptsRemaining,
          account_locked: lockoutResult.locked,
        },
        status: 'failure',
        errorMessage: result.error,
      });

      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        message: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        data: {
          ...(result.needsVerification ? { needsVerification: true } : {}),
          attemptsRemaining: lockoutResult.attemptsRemaining,
          locked: lockoutResult.locked,
        },
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must match selected role
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'client';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
      
      // Log role mismatch
      await logAudit({
        userId: result.user?.id,
        userEmail: email,
        userRole: actualRole,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: 'role_mismatch',
          expectedRole,
          actualRole,
          portal: 'client',
        },
        status: 'failure',
      });

      res.status(403).json({
        success: false,
        error: `You selected the wrong role. Your account is registered as "${actualRole}". Please select the correct role to sign in.`,
        data: {
          roleMismatch: true,
          actualRole: actualRole,
        },
      } as AuthResponse);
      return;
    }

    // Clear failed login attempts on successful login
    await handleSuccessfulLogin(email, req);

    // Check if this is the user's first login by checking last_logged_at
    const userProfile = await queryOne<{ last_logged_at: string | null }>(
      `SELECT last_logged_at FROM user_profiles WHERE id = $1`,
      [result.user?.id]
    );
    const isFirstLogin = userProfile?.last_logged_at === null;

    // Update last_logged_at timestamp
    await query(
      `UPDATE user_profiles SET last_logged_at = NOW() WHERE id = $1`,
      [result.user?.id]
    );

    // Log successful login
    await logAudit({
      userId: result.user?.id,
      userEmail: email,
      userRole: actualRole,
      action: 'LOGIN',
      resourceType: 'session',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        method: 'email_password',
        portal: 'client',
        isFirstLogin,
      },
      status: 'success',
    });

    console.log(`✅ Client sign-in successful for: ${email}${isFirstLogin ? ' (first login)' : ''}`);

    res.status(200).json({
      success: true,
      message: 'Sign-in successful',
      data: {
        user: result.user,
        token: result.token,
        redirectTo: '/client',
        isFirstLogin,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Client sign-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-in',
    } as AuthResponse);
  }
});

/**
 * POST /auth/professional/signin
 * Professional sign-in with role validation and account lockout protection
 */
router.post('/professional/signin', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, selectedRole } = req.body as SignInRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Professional sign-in attempt for: ${email}`);

    // Check if account is locked
    const lockoutCheck = await checkLoginAllowed(email, req);
    if (!lockoutCheck.allowed) {
      console.warn(`🔒 Professional sign-in blocked - account locked for: ${email}`);
      res.status(429).json({
        success: false,
        error: lockoutCheck.message,
        message: lockoutCheck.message,
        data: {
          locked: true,
          remainingMinutes: lockoutCheck.remainingMinutes,
        },
      } as AuthResponse);
      return;
    }

    const result = await authenticateUser(email, password);

    if (!result.success) {
      // Handle failed login with lockout tracking
      const lockoutResult = await handleFailedLogin(
        email,
        req,
        result.needsVerification ? 'needs_verification' : 'invalid_credentials'
      );

      // Log failed login
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: result.needsVerification ? 'needs_verification' : 'invalid_credentials',
          portal: 'professional',
          attempts_remaining: lockoutResult.attemptsRemaining,
          account_locked: lockoutResult.locked,
        },
        status: 'failure',
        errorMessage: result.error,
      });

      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        message: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        data: {
          ...(result.needsVerification ? { needsVerification: true } : {}),
          attemptsRemaining: lockoutResult.attemptsRemaining,
          locked: lockoutResult.locked,
        },
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must match selected role
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'professional';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
      
      // Log role mismatch
      await logAudit({
        userId: result.user?.id,
        userEmail: email,
        userRole: actualRole,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: 'role_mismatch',
          expectedRole,
          actualRole,
          portal: 'professional',
        },
        status: 'failure',
      });

      res.status(403).json({
        success: false,
        error: `You selected the wrong role. Your account is registered as "${actualRole}". Please select the correct role to sign in.`,
        data: {
          roleMismatch: true,
          actualRole: actualRole,
        },
      } as AuthResponse);
      return;
    }

    // Clear failed login attempts on successful login
    await handleSuccessfulLogin(email, req);

    // Log successful login
    await logAudit({
      userId: result.user?.id,
      userEmail: email,
      userRole: actualRole,
      action: 'LOGIN',
      resourceType: 'session',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        method: 'email_password',
        portal: 'professional',
      },
      status: 'success',
    });

    console.log(`✅ Professional sign-in successful for: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Sign-in successful',
      data: {
        user: result.user,
        token: result.token,
        redirectTo: '/professional',
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Professional sign-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-in',
    } as AuthResponse);
  }
});

/**
 * POST /auth/admin/signin
 * Admin sign-in with role validation and account lockout protection
 */
router.post('/admin/signin', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, selectedRole } = req.body as SignInRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Admin sign-in attempt for: ${email}`);

    // Check if account is locked
    const lockoutCheck = await checkLoginAllowed(email, req);
    if (!lockoutCheck.allowed) {
      console.warn(`🔒 Admin sign-in blocked - account locked for: ${email}`);
      res.status(429).json({
        success: false,
        message: lockoutCheck.message,
        error: lockoutCheck.message,
        data: {
          locked: true,
          remainingMinutes: lockoutCheck.remainingMinutes,
        },
      } as AuthResponse);
      return;
    }

    const result = await authenticateUser(email, password);

    if (!result.success) {
      // Handle failed login with lockout tracking
      const lockoutResult = await handleFailedLogin(email, req, 'invalid_credentials');

      // Log failed admin login attempt
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: 'invalid_credentials',
          portal: 'admin',
          attempts_remaining: lockoutResult.attemptsRemaining,
          account_locked: lockoutResult.locked,
        },
        status: 'failure',
        errorMessage: result.error,
      });

      res.status(401).json({
        success: false,
        message: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        error: lockoutResult.locked ? lockoutResult.message : (result.error || 'Invalid credentials'),
        data: {
          attemptsRemaining: lockoutResult.attemptsRemaining,
          locked: lockoutResult.locked,
        },
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must be admin
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'admin';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
      
      // Log unauthorized admin access attempt - critical security event
      await logAudit({
        userId: result.user?.id,
        userEmail: email,
        userRole: actualRole,
        action: 'PERMISSION_DENIED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          reason: 'unauthorized_admin_access_attempt',
          expectedRole,
          actualRole,
          portal: 'admin',
        },
        status: 'denied',
      });

      res.status(403).json({
        success: false,
        error: `You selected the wrong role. Your account is registered as "${actualRole}". Please select the correct role to sign in.`,
        data: {
          roleMismatch: true,
          actualRole: actualRole,
        },
      } as AuthResponse);
      return;
    }

    // Clear failed login attempts on successful login
    await handleSuccessfulLogin(email, req);

    // Log successful admin login
    await logAudit({
      userId: result.user?.id,
      userEmail: email,
      userRole: actualRole,
      action: 'LOGIN',
      resourceType: 'session',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        method: 'email_password',
        portal: 'admin',
      },
      status: 'success',
    });

    console.log(`✅ Admin sign-in successful for: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Admin sign-in successful',
      data: {
        user: result.user,
        token: result.token,
        redirectTo: '/admin',
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Admin sign-in error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-in',
    } as AuthResponse);
  }
});

// ============================================================================
// PASSWORD RESET ROUTES
// ============================================================================

interface ForgotPasswordRequest {
  email: string;
}

interface VerifyResetTokenRequest {
  token: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', passwordResetRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as ForgotPasswordRequest;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as AuthResponse);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Password reset request for: ${email}`);

    const result = await requestPasswordReset(email.trim().toLowerCase());

    // Log password reset request
    await logAudit({
      userEmail: email.trim().toLowerCase(),
      action: 'PASSWORD_RESET',
      resourceType: 'user_profile',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        step: 'request',
        success: result.success,
      },
      status: result.success ? 'success' : 'failure',
    });

    // Always return success (don't reveal if email exists)
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, we\'ve sent password reset instructions.',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/verify-reset-token
 * Verify password reset token is valid
 */
router.post('/verify-reset-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body as VerifyResetTokenRequest;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Reset token is required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Verifying reset token`);

    const result = await verifyResetToken(token);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Invalid or expired reset link',
      } as AuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        userId: result.userId,
      },
    });

  } catch (error) {
    console.error('❌ Verify reset token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as ResetPasswordRequest;

    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      } as AuthResponse);
      return;
    }

    // Password validation
    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Password reset attempt`);

    const result = await resetPassword(token, password);

    if (!result.success) {
      // Log failed password reset
      await logAudit({
        action: 'PASSWORD_CHANGE',
        resourceType: 'user_profile',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: { 
          step: 'complete',
          reason: result.error,
        },
        status: 'failure',
        errorMessage: result.error,
      });

      res.status(400).json({
        success: false,
        error: result.error || 'Failed to reset password',
      } as AuthResponse);
      return;
    }

    // Log successful password change
    await logAudit({
      action: 'PASSWORD_CHANGE',
      resourceType: 'user_profile',
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: { 
        step: 'complete',
        method: 'reset_token',
      },
      status: 'success',
    });

    console.log(`✅ Password reset successful`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

// ============================================================================
// INVITATION TOKEN VERIFICATION ROUTES
// ============================================================================

interface VerifyInvitationTokenRequest {
  token: string;
}

interface InvitedClientSignupRequest {
  token: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  skinType?: string;
  concerns?: string[];
  avatarEncrypted?: string;
  avatarIv?: string;
  avatarMimeType?: string;
}

/**
 * POST /auth/verify-invitation-token
 * Verify if an invitation token is valid and not expired
 */
router.post('/verify-invitation-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body as VerifyInvitationTokenRequest;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Invitation token is required',
      } as AuthResponse);
      return;
    }

    console.log(`🔐 Verifying invitation token`);

    // Find invitation by token
    const invitation = await query<{
      id: string;
      email: string;
      professional_id: string;
      status: string;
      expires_at: string;
    }>(
      `SELECT id, email, professional_id, status, expires_at 
       FROM client_invitations 
       WHERE token = $1`,
      [token]
    );

    if (!invitation || invitation.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid invitation link. Please request a new invitation from your skincare professional.',
      } as AuthResponse);
      return;
    }

    const inv = invitation[0];

    // Check if expired
    if (new Date(inv.expires_at) < new Date()) {
      // Delete expired invitation
      await query(
        `DELETE FROM client_invitations WHERE id = $1`,
        [inv.id]
      );

      res.status(400).json({
        success: false,
        message: 'This invitation has expired. Please request a new invitation from your skincare professional.',
        data: { expired: true },
      } as AuthResponse);
      return;
    }

    // Check if already accepted
    if (inv.status === 'accepted') {
      res.status(400).json({
        success: false,
        message: 'This invitation has already been used. Please sign in to your account.',
        data: { alreadyAccepted: true },
      } as AuthResponse);
      return;
    }

    // Get professional info
    const professional = await queryOne<{
      full_name: string;
      business_name: string;
    }>(
      `SELECT full_name, business_name FROM user_profiles WHERE id = $1`,
      [inv.professional_id]
    );

    console.log(`✅ Invitation token is valid for email: ${inv.email}`);

    res.status(200).json({
      success: true,
      message: 'Invitation is valid',
      data: {
        email: inv.email,
        professionalId: inv.professional_id,
        professionalName: professional?.full_name || 'Your Skincare Professional',
        businessName: professional?.business_name || 'SkinAura PRO',
      },
    });

  } catch (error) {
    console.error('❌ Verify invitation token error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

/**
 * POST /auth/invited-client/signup
 * Sign up as an invited client - creates account and establishes professional relationship
 */
router.post('/invited-client/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const signupData = req.body as InvitedClientSignupRequest;

    // Validate required fields
    if (!signupData.token || !signupData.email || !signupData.password || !signupData.fullName) {
      res.status(400).json({
        success: false,
        error: 'Token, email, password, and full name are required',
      } as AuthResponse);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupData.email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      } as AuthResponse);
      return;
    }

    // Password validation
    if (signupData.password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      } as AuthResponse);
      return;
    }

    console.log(`📝 Invited client sign-up attempt for: ${signupData.email}`);

    // Verify the invitation token again
    const invitation = await queryOne<{
      id: string;
      email: string;
      professional_id: string;
      status: string;
      expires_at: string;
    }>(
      `SELECT id, email, professional_id, status, expires_at 
       FROM client_invitations 
       WHERE token = $1`,
      [signupData.token]
    );

    if (!invitation) {
      res.status(400).json({
        success: false,
        error: 'Invalid invitation token',
      } as AuthResponse);
      return;
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      await query(`DELETE FROM client_invitations WHERE id = $1`, [invitation.id]);
      res.status(400).json({
        success: false,
        message: 'This invitation has expired',
        error: 'This invitation has expired',
        data: { expired: true },
      } as AuthResponse);
      return;
    }

    // Check if already accepted
    if (invitation.status === 'accepted') {
      res.status(400).json({
        success: false,
        error: 'This invitation has already been used',
      } as AuthResponse);
      return;
    }

    // Verify email matches invitation
    if (signupData.email.toLowerCase() !== invitation.email.toLowerCase()) {
      res.status(400).json({
        success: false,
        error: 'Email does not match the invitation',
      } as AuthResponse);
      return;
    }

    // Handle pre-encrypted avatar from frontend
    let avatarUrl: string | undefined;
    if (signupData.avatarEncrypted && signupData.avatarIv) {
      avatarUrl = saveEncryptedAvatar(signupData.avatarEncrypted, signupData.avatarIv, signupData.avatarMimeType) || undefined;
    }

    // Create the user account
    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: 'client',
      skinType: signupData.skinType,
      concerns: signupData.concerns,
      avatarUrl: avatarUrl,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to create account',
      } as AuthResponse);
      return;
    }

    console.log(`✅ Invited client account created for: ${signupData.email}`);

    // Store professional_id for later use after verification
    // We'll create the relationship after phone verification
    // Store it in the invitation record
    await query(
      `UPDATE client_invitations 
       SET status = 'pending_verification'
       WHERE id = $1`,
      [invitation.id]
    );

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for verification code.',
      data: {
        user: result.user,
        needsVerification: true,
        professionalId: invitation.professional_id,
        invitationId: invitation.id,
      },
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Invited client sign-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during sign-up',
    } as AuthResponse);
  }
});

/**
 * POST /auth/complete-invitation
 * Complete the invitation after client has verified email and phone
 * Creates the client_professional_relationships entry
 */
router.post('/complete-invitation', async (req: Request, res: Response): Promise<void> => {
  try {
    const { invitationId, clientId } = req.body;

    if (!invitationId || !clientId) {
      res.status(400).json({
        success: false,
        error: 'Invitation ID and client ID are required',
      } as AuthResponse);
      return;
    }

    console.log(`📝 Completing invitation ${invitationId} for client ${clientId}`);

    // Get the invitation
    const invitation = await queryOne<{
      id: string;
      professional_id: string;
      status: string;
    }>(
      `SELECT id, professional_id, status FROM client_invitations WHERE id = $1`,
      [invitationId]
    );

    if (!invitation) {
      res.status(400).json({
        success: false,
        error: 'Invitation not found',
      } as AuthResponse);
      return;
    }

    // Check if already completed
    if (invitation.status === 'accepted') {
      res.status(400).json({
        success: false,
        error: 'Invitation already completed',
      } as AuthResponse);
      return;
    }

    // Create the client_professional_relationships entry
    await query(
      `INSERT INTO client_professional_relationships 
       (client_id, professional_id, status, created_at, updated_at)
       VALUES ($1, $2, 'active', NOW(), NOW())
       ON CONFLICT (client_id, professional_id) 
       DO UPDATE SET status = 'active', updated_at = NOW()`,
      [clientId, invitation.professional_id]
    );

    // Mark invitation as accepted
    await query(
      `UPDATE client_invitations 
       SET status = 'accepted', accepted_at = NOW()
       WHERE id = $1`,
      [invitationId]
    );

    console.log(`✅ Invitation completed - client ${clientId} connected to professional ${invitation.professional_id}`);

    res.status(200).json({
      success: true,
      message: 'Successfully connected with your skincare professional!',
    } as AuthResponse);

  } catch (error) {
    console.error('❌ Complete invitation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as AuthResponse);
  }
});

// ============================================================================
// PROFILE MANAGEMENT ENDPOINTS
// ============================================================================

// Auth middleware for profile routes
const profileAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authorization token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { verifyToken } = await import('../lib/auth.js');
    const result = verifyToken(token);

    if (!result.valid || !result.payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    (req as any).userId = result.payload.sub as string;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * GET /auth/profile
 * Get current user's profile
 */
router.get('/profile', profileAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`👤 Fetching profile for user: ${userId}`);

    const userProfile = await queryOne<{
      id: string;
      email: string;
      full_name: string | null;
      phone: string | null;
      avatar_url: string | null;
      role: string;
      skin_type: string | null;
      concerns: string[] | null;
      business_name: string | null;
      license_number: string | null;
      email_verified: boolean;
      phone_verified: boolean;
      created_at: string;
    }>(
      `SELECT up.id, up.email, up.full_name, up.phone, up.avatar_url, up.role, 
              up.skin_type, up.concerns, up.business_name, up.license_number, 
              COALESCE(a.email_verified, false) as email_verified, 
              COALESCE(a.phone_verified, false) as phone_verified, 
              up.created_at
       FROM user_profiles up
       LEFT JOIN auth a ON up.id = a.id
       WHERE up.id = $1`,
      [userId]
    );

    if (!userProfile) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
      return;
    }

    console.log(`✅ Profile fetched successfully for user: ${userId}`);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.full_name,
          phone: userProfile.phone,
          avatar_url: userProfile.avatar_url,
          role: userProfile.role,
          skin_type: userProfile.skin_type,
          concerns: userProfile.concerns,
          business_name: userProfile.business_name,
          license_number: userProfile.license_number,
          email_verified: userProfile.email_verified,
          phone_verified: userProfile.phone_verified,
          created_at: userProfile.created_at,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
});

/**
 * PUT /auth/profile
 * Update current user's profile
 */
router.put('/profile', profileAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    // Handle encrypted payload
    let data = req.body;
    if (req.body.encrypted && req.body.iv) {
      const decrypted = decryptRequestData(req.body as EncryptedPayload);
      if (!decrypted.success || !decrypted.data) {
        res.status(400).json({ success: false, error: 'Failed to decrypt request data' });
        return;
      }
      data = decrypted.data;
    }

    const { full_name, phone, business_name, license_number, skin_type, concerns, avatar_url } = data;

    console.log(`✏️ Updating profile for user: ${userId}`);

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name?.trim() || null);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone?.trim() || null);
    }

    if (business_name !== undefined) {
      updates.push(`business_name = $${paramIndex++}`);
      values.push(business_name?.trim() || null);
    }

    if (license_number !== undefined) {
      updates.push(`license_number = $${paramIndex++}`);
      values.push(license_number?.trim() || null);
    }

    if (skin_type !== undefined) {
      updates.push(`skin_type = $${paramIndex++}`);
      values.push(skin_type?.trim() || null);
    }

    if (concerns !== undefined) {
      updates.push(`concerns = $${paramIndex++}`);
      values.push(concerns);
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatar_url?.trim() || null);
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
      return;
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add user id for WHERE clause
    values.push(userId);

    const updateQuery = `
      UPDATE user_profiles 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;

    const updateResult = await queryOne<{ id: string }>(updateQuery, values);

    if (!updateResult) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
      return;
    }

    // Fetch updated profile with auth data
    const updatedProfile = await queryOne<{
      id: string;
      email: string;
      full_name: string | null;
      phone: string | null;
      avatar_url: string | null;
      role: string;
      skin_type: string | null;
      concerns: string[] | null;
      business_name: string | null;
      license_number: string | null;
      email_verified: boolean;
      phone_verified: boolean;
      created_at: string;
    }>(
      `SELECT up.id, up.email, up.full_name, up.phone, up.avatar_url, up.role, 
              up.skin_type, up.concerns, up.business_name, up.license_number, 
              COALESCE(a.email_verified, false) as email_verified, 
              COALESCE(a.phone_verified, false) as phone_verified, 
              up.created_at
       FROM user_profiles up
       LEFT JOIN auth a ON up.id = a.id
       WHERE up.id = $1`,
      [userId]
    );

    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: 'Profile not found after update',
      });
      return;
    }

    console.log(`✅ Profile updated successfully for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          full_name: updatedProfile.full_name,
          phone: updatedProfile.phone,
          avatar_url: updatedProfile.avatar_url,
          role: updatedProfile.role,
          skin_type: updatedProfile.skin_type,
          concerns: updatedProfile.concerns,
          business_name: updatedProfile.business_name,
          license_number: updatedProfile.license_number,
          email_verified: updatedProfile.email_verified,
          phone_verified: updatedProfile.phone_verified,
          created_at: updatedProfile.created_at,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

/**
 * POST /auth/profile/avatar
 * Upload avatar for current user (expects pre-encrypted image from frontend)
 */
router.post('/profile/avatar', profileAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    // Handle encrypted payload
    let data = req.body;
    if (req.body.encrypted && req.body.iv && !req.body.mimeType) {
      // This is an encrypted request payload, not image data
      const decrypted = decryptRequestData(req.body as EncryptedPayload);
      if (!decrypted.success || !decrypted.data) {
        res.status(400).json({ success: false, error: 'Failed to decrypt request data' });
        return;
      }
      data = decrypted.data;
    }

    const { encrypted, iv, mimeType } = data;

    if (!encrypted || !iv) {
      res.status(400).json({
        success: false,
        error: 'Missing encrypted image data or IV',
      });
      return;
    }

    console.log(`📷 Uploading avatar for user: ${userId}`);

    // Save the encrypted avatar
    const avatarUrl = saveEncryptedAvatar(encrypted, iv, mimeType);

    if (!avatarUrl) {
      res.status(500).json({
        success: false,
        error: 'Failed to save avatar',
      });
      return;
    }

    // Update user profile with new avatar URL
    const updateResult = await queryOne<{ id: string }>(
      `UPDATE user_profiles 
       SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [avatarUrl, userId]
    );

    if (!updateResult) {
      res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
      return;
    }

    // Fetch updated profile with auth data
    const updatedProfile = await queryOne<{
      id: string;
      email: string;
      full_name: string | null;
      phone: string | null;
      avatar_url: string | null;
      role: string;
      email_verified: boolean;
      phone_verified: boolean;
    }>(
      `SELECT up.id, up.email, up.full_name, up.phone, up.avatar_url, up.role, 
              COALESCE(a.email_verified, false) as email_verified, 
              COALESCE(a.phone_verified, false) as phone_verified
       FROM user_profiles up
       LEFT JOIN auth a ON up.id = a.id
       WHERE up.id = $1`,
      [userId]
    );

    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        error: 'Profile not found after update',
      });
      return;
    }

    console.log(`✅ Avatar uploaded successfully for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar_url: avatarUrl,
        user: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          full_name: updatedProfile.full_name,
          phone: updatedProfile.phone,
          avatar_url: updatedProfile.avatar_url,
          role: updatedProfile.role,
          email_verified: updatedProfile.email_verified,
          phone_verified: updatedProfile.phone_verified,
        },
      },
    });
  } catch (error) {
    console.error('❌ Error uploading avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar',
    });
  }
});

/**
 * POST /auth/request-password-reset
 * Request a password reset email (alias for /forgot-password, for frontend consistency)
 */
router.post('/request-password-reset', async (req: Request, res: Response): Promise<void> => {
  try {
    // Handle encrypted payload
    let data = req.body;
    if (req.body.encrypted && req.body.iv) {
      const decrypted = decryptRequestData(req.body as EncryptedPayload);
      if (!decrypted.success || !decrypted.data) {
        res.status(400).json({ success: false, error: 'Failed to decrypt request data' });
        return;
      }
      data = decrypted.data;
    }

    const { email } = data;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      });
      return;
    }

    console.log(`🔑 Password reset requested for: ${email}`);

    const result = await requestPasswordReset(email);

    if (!result.success) {
      // Still return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('❌ Error requesting password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
    });
  }
});

export default router;
