/**
 * Authentication utilities for PostgreSQL-based auth
 * Handles password hashing, JWT tokens, and user management
 * Uses 'auth' table for users and 'authentications' table for verification codes
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { env } from '../config/env.js';
import { 
  generateVerificationCode, 
  getVerificationCodeExpiry, 
  sendVerificationEmail,
  sendWelcomeEmail 
} from './email.js';
import {
  generatePhoneVerificationCode,
  getPhoneVerificationCodeExpiry,
  sendVerificationSms,
  sendWelcomeSms,
} from './sms.js';

// Types based on the database schema
export interface AuthUser {
  id: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface Authentication {
  user_id: string;
  phone_verification_code?: string;
  phone_verification_expired_at?: Date;
  email_verification_code?: string;
  email_verification_expired_at?: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  token?: string;
  error?: string;
  needsVerification?: boolean;
}

export interface VerificationResult {
  success: boolean;
  error?: string;
  needsPhoneVerification?: boolean;
  phone?: string;
}

// Password hashing configuration
const SALT_ROUNDS = 12;

// Verification code encryption salt (use env variable in production)
const VERIFICATION_CODE_SALT = env.ENCRYPTION_KEY || 'skinaura-verification-salt';

/**
 * Hash/encrypt a verification code using SHA-256 with salt
 * This ensures the code is stored securely and can only be compared, not decrypted
 */
export const hashVerificationCode = (code: string): string => {
  return crypto
    .createHmac('sha256', VERIFICATION_CODE_SALT)
    .update(code)
    .digest('hex');
};

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate a simple JWT-like token
 */
export const generateToken = (userId: string, email: string): string => {
  const payload = {
    sub: userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${header}.${payloadB64}`)
    .digest('base64url');
  
  return `${header}.${payloadB64}.${signature}`;
};

/**
 * Verify and decode a token
 */
export const verifyToken = (token: string): { valid: boolean; payload?: Record<string, unknown> } => {
  try {
    const [header, payload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }
    
    return { valid: true, payload: decodedPayload };
  } catch {
    return { valid: false };
  }
};

/**
 * Find user by email from auth table
 */
export const findUserByEmail = async (email: string): Promise<AuthUser | null> => {
  return queryOne<AuthUser>(
    'SELECT * FROM auth WHERE email = $1',
    [email.toLowerCase()]
  );
};

/**
 * Find user by ID from auth table
 */
export const findUserById = async (id: string): Promise<AuthUser | null> => {
  return queryOne<AuthUser>(
    'SELECT * FROM auth WHERE id = $1',
    [id]
  );
};

/**
 * Create a new user in auth table, user_profiles table, and send verification email
 */
export const createUser = async (userData: {
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
}): Promise<AuthResult> => {
  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(userData.email);
    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // Generate UUID for new user
    const userId = crypto.randomUUID();

    // Default role to 'client' if not provided
    const role = userData.role || 'client';

    // Insert user into auth table (basic auth info)
    await query(
      `INSERT INTO auth (id, email, password, full_name, email_verified, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        userData.email.toLowerCase(),
        passwordHash,
        userData.fullName,
        false, // email_verified
        false, // phone_verified
      ]
    );

    // Insert user profile into user_profiles table (all profile info)
    await query(
      `INSERT INTO user_profiles (
        id, email, full_name, phone, role, avatar_url, 
        skin_type, concerns, business_name, license_number,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        userId,
        userData.email.toLowerCase(),
        userData.fullName,
        userData.phone || null,
        role,
        userData.avatarUrl || null,
        userData.skinType || null,
        userData.concerns && userData.concerns.length > 0 ? userData.concerns : null,
        userData.businessName || null,
        userData.licenseNumber || null,
      ]
    );

    // Generate email verification code
    const verificationCode = generateVerificationCode();
    const codeExpiry = getVerificationCodeExpiry();

    // Hash the verification code before storing (for security)
    const hashedCode = hashVerificationCode(verificationCode);

    // Insert verification record into authentications table with hashed code
    await query(
      `INSERT INTO authentications (user_id, email_verification_code, email_verification_expired_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         email_verification_code = $2,
         email_verification_expired_at = $3`,
      [userId, hashedCode, codeExpiry]
    );

    // Send verification email (with plain code - user needs to enter this)
    const emailResult = await sendVerificationEmail(
      userData.email.toLowerCase(),
      userData.fullName,
      verificationCode
    );

    if (!emailResult.success) {
      console.warn('⚠️ Failed to send verification email, but user was created');
    }

    console.log(`✅ User created: ${userData.email} (${role}), verification code sent`);

    return {
      success: true,
      user: {
        id: userId,
        email: userData.email.toLowerCase(),
        full_name: userData.fullName,
        phone: userData.phone,
        email_verified: false,
        phone_verified: false,
      },
      needsVerification: true,
    };
  } catch (error) {
    console.error('❌ Create user error:', error);
    return { success: false, error: 'Failed to create user' };
  }
};

/**
 * Verify email with code
 */
export const verifyEmailCode = async (
  email: string,
  code: string
): Promise<VerificationResult> => {
  try {
    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if already verified
    if (user.email_verified) {
      return { success: false, error: 'Email already verified' };
    }

    // Get verification record
    const authRecord = await queryOne<Authentication>(
      `SELECT * FROM authentications WHERE user_id = $1`,
      [user.id]
    );

    if (!authRecord) {
      return { success: false, error: 'Verification record not found' };
    }

    // Hash the received code and compare with stored hash
    const hashedInputCode = hashVerificationCode(code);
    if (authRecord.email_verification_code !== hashedInputCode) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Check expiry
    if (authRecord.email_verification_expired_at && 
        new Date(authRecord.email_verification_expired_at) < new Date()) {
      return { success: false, error: 'Verification code expired' };
    }

    // Update user as verified
    await query(
      `UPDATE auth SET email_verified = true WHERE id = $1`,
      [user.id]
    );

    // Clear verification code
    await query(
      `UPDATE authentications SET email_verification_code = NULL, email_verification_expired_at = NULL WHERE user_id = $1`,
      [user.id]
    );

    // Send welcome email
    await sendWelcomeEmail(user.email, user.full_name, 'client');

    console.log(`✅ Email verified for: ${email}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Email verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
};

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (email: string): Promise<VerificationResult> => {
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.email_verified) {
      return { success: false, error: 'Email already verified' };
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const codeExpiry = getVerificationCodeExpiry();

    // Hash the verification code before storing (for security)
    const hashedCode = hashVerificationCode(verificationCode);

    // Update verification record with hashed code
    await query(
      `UPDATE authentications 
       SET email_verification_code = $1, email_verification_expired_at = $2 
       WHERE user_id = $3`,
      [hashedCode, codeExpiry, user.id]
    );

    // Send verification email (with plain code - user needs to enter this)
    const emailResult = await sendVerificationEmail(
      user.email,
      user.full_name,
      verificationCode
    );

    if (!emailResult.success) {
      return { success: false, error: 'Failed to send verification email' };
    }

    console.log(`✅ Verification email resent to: ${email}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    return { success: false, error: 'Failed to resend verification email' };
  }
};

/**
 * Send phone verification code
 */
export const sendPhoneVerificationCode = async (
  email: string,
  phone: string
): Promise<VerificationResult> => {
  try {
    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if email is verified first
    if (!user.email_verified) {
      return { success: false, error: 'Please verify your email first' };
    }

    // Check if phone is already verified
    if (user.phone_verified) {
      return { success: false, error: 'Phone already verified' };
    }

    // Update user's phone number if different
    if (user.phone !== phone) {
      await query(
        `UPDATE auth SET phone = $1 WHERE id = $2`,
        [phone, user.id]
      );
    }

    // Generate phone verification code
    const verificationCode = generatePhoneVerificationCode();
    const codeExpiry = getPhoneVerificationCodeExpiry();

    // Hash the verification code before storing
    const hashedCode = hashVerificationCode(verificationCode);

    // Update verification record with phone code
    await query(
      `UPDATE authentications 
       SET phone_verification_code = $1, phone_verification_expired_at = $2 
       WHERE user_id = $3`,
      [hashedCode, codeExpiry, user.id]
    );

    // Send verification SMS (with plain code)
    const smsResult = await sendVerificationSms(phone, verificationCode);

    if (!smsResult.success) {
      return { success: false, error: 'Failed to send verification SMS' };
    }

    console.log(`✅ Phone verification code sent to: ${phone}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Send phone verification error:', error);
    return { success: false, error: 'Failed to send verification code' };
  }
};

/**
 * Verify phone with code
 */
export const verifyPhoneCode = async (
  email: string,
  code: string
): Promise<VerificationResult> => {
  try {
    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if phone is already verified
    if (user.phone_verified) {
      return { success: false, error: 'Phone already verified' };
    }

    // Get verification record
    const authRecord = await queryOne<Authentication>(
      `SELECT * FROM authentications WHERE user_id = $1`,
      [user.id]
    );

    if (!authRecord) {
      return { success: false, error: 'Verification record not found' };
    }

    // Hash the received code and compare with stored hash
    const hashedInputCode = hashVerificationCode(code);
    if (authRecord.phone_verification_code !== hashedInputCode) {
      return { success: false, error: 'Invalid verification code' };
    }

    // Check expiry
    if (authRecord.phone_verification_expired_at && 
        new Date(authRecord.phone_verification_expired_at) < new Date()) {
      return { success: false, error: 'Verification code expired' };
    }

    // Update user as phone verified
    await query(
      `UPDATE auth SET phone_verified = true WHERE id = $1`,
      [user.id]
    );

    // Clear phone verification code
    await query(
      `UPDATE authentications SET phone_verification_code = NULL, phone_verification_expired_at = NULL WHERE user_id = $1`,
      [user.id]
    );

    // Send welcome SMS
    if (user.phone) {
      await sendWelcomeSms(user.phone);
    }

    console.log(`✅ Phone verified for: ${email}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Phone verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
};

/**
 * Resend phone verification code
 */
export const resendPhoneVerificationCode = async (
  email: string
): Promise<VerificationResult> => {
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.phone) {
      return { success: false, error: 'No phone number on file' };
    }

    if (user.phone_verified) {
      return { success: false, error: 'Phone already verified' };
    }

    // Generate new verification code
    const verificationCode = generatePhoneVerificationCode();
    const codeExpiry = getPhoneVerificationCodeExpiry();

    // Hash the verification code before storing
    const hashedCode = hashVerificationCode(verificationCode);

    // Update verification record
    await query(
      `UPDATE authentications 
       SET phone_verification_code = $1, phone_verification_expired_at = $2 
       WHERE user_id = $3`,
      [hashedCode, codeExpiry, user.id]
    );

    // Send verification SMS
    const smsResult = await sendVerificationSms(user.phone, verificationCode);

    if (!smsResult.success) {
      return { success: false, error: 'Failed to send verification SMS' };
    }

    console.log(`✅ Phone verification code resent to: ${user.phone}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Resend phone verification error:', error);
    return { success: false, error: 'Failed to resend verification code' };
  }
};

/**
 * Authenticate user with email and password
 */
export const authenticateUser = async (
  email: string,
  password: string
): Promise<AuthResult> => {
  try {
    // Find user by email
    const user = await findUserByEmail(email);
    
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check if email is verified
    if (!user.email_verified) {
      return { 
        success: false, 
        error: 'Please verify your email before signing in',
        needsVerification: true,
      };
    }

    // Check if phone is verified (require both email and phone verification)
    if (!user.phone_verified) {
      return { 
        success: false, 
        error: 'Please verify your phone number before signing in',
        needsVerification: true,
      };
    }

    // Generate token
    const token = generateToken(user.id, user.email);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        email_verified: user.email_verified,
        phone_verified: user.phone_verified,
      },
      token,
    };
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
};

export default {
  hashPassword,
  verifyPassword,
  hashVerificationCode,
  generateToken,
  verifyToken,
  findUserByEmail,
  findUserById,
  createUser,
  verifyEmailCode,
  resendVerificationEmail,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  resendPhoneVerificationCode,
  authenticateUser,
};
