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
} from '../lib/auth.js';

const router = Router();

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
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
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

    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: 'client',
      skinType: signupData.skinType,
      concerns: signupData.concerns,
      avatarUrl: signupData.avatarUrl,
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

    // Create professional account with all profile details
    const result = await createUser({
      email: signupData.email,
      password: signupData.password,
      fullName: signupData.fullName,
      phone: signupData.phone,
      role: 'professional',
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
router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
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
router.post('/resend-phone-verification', async (req: Request, res: Response): Promise<void> => {
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
 * User sign-in with role validation
 */
router.post('/signin', async (req: Request, res: Response): Promise<void> => {
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

    const result = await authenticateUser(email, password);

    if (!result.success) {
      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: result.error || 'Invalid credentials',
        data: result.needsVerification ? { needsVerification: true } : undefined,
      } as AuthResponse);
      return;
    }

    // Get actual role from user profile
    const actualRole = result.user?.role || 'client';
    
    // If selectedRole is provided, validate it matches
    if (selectedRole && actualRole !== selectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${selectedRole}', actual '${actualRole}'`);
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
 * Client sign-in with role validation
 */
router.post('/client/signin', async (req: Request, res: Response): Promise<void> => {
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

    const result = await authenticateUser(email, password);

    if (!result.success) {
      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: result.error || 'Invalid credentials',
        data: result.needsVerification ? { needsVerification: true } : undefined,
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must match selected role
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'client';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
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

    console.log(`✅ Client sign-in successful for: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Sign-in successful',
      data: {
        user: result.user,
        token: result.token,
        redirectTo: '/client',
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
 * Professional sign-in with role validation
 */
router.post('/professional/signin', async (req: Request, res: Response): Promise<void> => {
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

    const result = await authenticateUser(email, password);

    if (!result.success) {
      const statusCode = result.needsVerification ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        error: result.error || 'Invalid credentials',
        data: result.needsVerification ? { needsVerification: true } : undefined,
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must match selected role
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'professional';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
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
 * Admin sign-in with role validation
 */
router.post('/admin/signin', async (req: Request, res: Response): Promise<void> => {
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

    const result = await authenticateUser(email, password);

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: result.error || 'Invalid credentials',
      } as AuthResponse);
      return;
    }

    // Validate role - user's actual role must be admin
    const actualRole = result.user?.role || 'client';
    const expectedRole = selectedRole || 'admin';
    
    if (actualRole !== expectedRole) {
      console.log(`⚠️ Role mismatch for ${email}: selected '${expectedRole}', actual '${actualRole}'`);
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

export default router;
