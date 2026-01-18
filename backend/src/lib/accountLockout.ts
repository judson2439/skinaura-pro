/**
 * Account Lockout Service for HIPAA Compliance
 * 
 * Tracks failed login attempts and locks accounts after too many failures.
 * This prevents brute force attacks on user accounts.
 * 
 * Configuration:
 * - MAX_FAILED_ATTEMPTS: 5 attempts
 * - LOCKOUT_DURATION_MINUTES: 15 minutes
 * - ATTEMPT_WINDOW_MINUTES: 30 minutes (attempts older than this are cleared)
 */

import { query, queryOne } from '../config/database.js';
import { logAudit, getClientIp, getUserAgent } from './auditLogger.js';
import { Request } from 'express';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum failed login attempts before lockout */
export const MAX_FAILED_ATTEMPTS = 5;

/** How long the account stays locked (in minutes) */
export const LOCKOUT_DURATION_MINUTES = 15;

/** Time window for counting failed attempts (in minutes) */
export const ATTEMPT_WINDOW_MINUTES = 30;

// ============================================================================
// TYPES
// ============================================================================

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: Date;
}

export interface AccountLockStatus {
  isLocked: boolean;
  failedAttempts: number;
  lockoutExpiresAt: Date | null;
  remainingMinutes: number | null;
}

export interface LockoutCheckResult {
  allowed: boolean;
  isLocked: boolean;
  failedAttempts: number;
  remainingMinutes?: number;
  message?: string;
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

/**
 * Create the login_attempts table if it doesn't exist
 * Call this on server startup
 */
export const initLoginAttemptsTable = async (): Promise<void> => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        success BOOLEAN NOT NULL DEFAULT false,
        failure_reason VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create index for efficient lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created 
      ON login_attempts(email, created_at DESC)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created 
      ON login_attempts(ip_address, created_at DESC)
    `);

    console.log('✅ Login attempts table initialized');
  } catch (error) {
    console.error('❌ Failed to initialize login_attempts table:', error);
  }
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Record a login attempt (success or failure)
 */
export const recordLoginAttempt = async (
  email: string,
  success: boolean,
  req?: Request,
  failureReason?: string
): Promise<void> => {
  try {
    const ipAddress = req ? getClientIp(req) : null;
    const userAgent = req ? getUserAgent(req) : null;

    await query(
      `INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2::inet, $3, $4, $5)`,
      [email.toLowerCase(), ipAddress, userAgent, success, failureReason || null]
    );

    // If successful login, clear old failed attempts for this email
    if (success) {
      await clearFailedAttempts(email);
    }
  } catch (error) {
    // Don't throw - logging failures shouldn't break login
    console.error('❌ Failed to record login attempt:', error);
  }
};

/**
 * Get the number of recent failed login attempts for an email
 */
export const getFailedAttemptCount = async (email: string): Promise<number> => {
  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - ATTEMPT_WINDOW_MINUTES);

    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM login_attempts 
       WHERE email = $1 
         AND success = false 
         AND created_at > $2`,
      [email.toLowerCase(), windowStart.toISOString()]
    );

    return parseInt(result?.count || '0', 10);
  } catch (error) {
    console.error('❌ Failed to get failed attempt count:', error);
    return 0;
  }
};

/**
 * Get the most recent failed attempt timestamp
 */
export const getLastFailedAttempt = async (email: string): Promise<Date | null> => {
  try {
    const result = await queryOne<{ created_at: Date }>(
      `SELECT created_at FROM login_attempts 
       WHERE email = $1 AND success = false 
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    return result?.created_at || null;
  } catch (error) {
    console.error('❌ Failed to get last failed attempt:', error);
    return null;
  }
};

/**
 * Check if an account is currently locked
 */
export const checkAccountLockStatus = async (email: string): Promise<AccountLockStatus> => {
  try {
    const failedAttempts = await getFailedAttemptCount(email);
    
    if (failedAttempts < MAX_FAILED_ATTEMPTS) {
      return {
        isLocked: false,
        failedAttempts,
        lockoutExpiresAt: null,
        remainingMinutes: null,
      };
    }

    // Account has too many failed attempts - check if lockout has expired
    const lastFailed = await getLastFailedAttempt(email);
    
    if (!lastFailed) {
      return {
        isLocked: false,
        failedAttempts: 0,
        lockoutExpiresAt: null,
        remainingMinutes: null,
      };
    }

    const lockoutExpiresAt = new Date(lastFailed);
    lockoutExpiresAt.setMinutes(lockoutExpiresAt.getMinutes() + LOCKOUT_DURATION_MINUTES);

    const now = new Date();
    const isLocked = now < lockoutExpiresAt;
    const remainingMs = lockoutExpiresAt.getTime() - now.getTime();
    const remainingMinutes = isLocked ? Math.ceil(remainingMs / 60000) : null;

    return {
      isLocked,
      failedAttempts,
      lockoutExpiresAt: isLocked ? lockoutExpiresAt : null,
      remainingMinutes,
    };
  } catch (error) {
    console.error('❌ Failed to check account lock status:', error);
    // Fail open - don't lock out users due to errors
    return {
      isLocked: false,
      failedAttempts: 0,
      lockoutExpiresAt: null,
      remainingMinutes: null,
    };
  }
};

/**
 * Check if a login attempt is allowed (not locked out)
 * Returns detailed status for the auth flow
 */
export const checkLoginAllowed = async (
  email: string,
  req?: Request
): Promise<LockoutCheckResult> => {
  const status = await checkAccountLockStatus(email);

  if (status.isLocked) {
    // Log the blocked attempt
    if (req) {
      await logAudit({
        userEmail: email,
        action: 'LOGIN_FAILED',
        resourceType: 'session',
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        details: {
          reason: 'account_locked',
          failed_attempts: status.failedAttempts,
          lockout_expires_at: status.lockoutExpiresAt?.toISOString(),
          remaining_minutes: status.remainingMinutes,
        },
        status: 'denied',
        errorMessage: 'Account is temporarily locked',
      });
    }

    return {
      allowed: false,
      isLocked: true,
      failedAttempts: status.failedAttempts,
      remainingMinutes: status.remainingMinutes || 0,
      message: `Account is temporarily locked. Please try again in ${status.remainingMinutes} minute(s).`,
    };
  }

  return {
    allowed: true,
    isLocked: false,
    failedAttempts: status.failedAttempts,
  };
};

/**
 * Handle a failed login attempt
 * Records the attempt and checks if account should be locked
 */
export const handleFailedLogin = async (
  email: string,
  req?: Request,
  failureReason?: string
): Promise<{ locked: boolean; attemptsRemaining: number; message: string }> => {
  // Record the failed attempt
  await recordLoginAttempt(email, false, req, failureReason);

  // Check current status
  const failedAttempts = await getFailedAttemptCount(email);
  const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);

  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    // Log account lockout event
    await logAudit({
      userEmail: email,
      action: 'PERMISSION_DENIED',
      resourceType: 'session',
      ipAddress: req ? getClientIp(req) : undefined,
      userAgent: req ? getUserAgent(req) : undefined,
      details: {
        event: 'account_locked',
        failed_attempts: failedAttempts,
        lockout_duration_minutes: LOCKOUT_DURATION_MINUTES,
      },
      status: 'denied',
      errorMessage: 'Account locked due to too many failed login attempts',
    });

    console.warn(`🔒 SECURITY: Account locked for ${email} after ${failedAttempts} failed attempts`);

    return {
      locked: true,
      attemptsRemaining: 0,
      message: `Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`,
    };
  }

  return {
    locked: false,
    attemptsRemaining,
    message: `Invalid credentials. ${attemptsRemaining} attempt(s) remaining before account lockout.`,
  };
};

/**
 * Handle a successful login
 * Clears failed attempts for the email
 */
export const handleSuccessfulLogin = async (
  email: string,
  req?: Request
): Promise<void> => {
  await recordLoginAttempt(email, true, req);
};

/**
 * Clear failed attempts for an email (used on successful login or admin unlock)
 */
export const clearFailedAttempts = async (email: string): Promise<void> => {
  try {
    await query(
      `DELETE FROM login_attempts 
       WHERE email = $1 AND success = false`,
      [email.toLowerCase()]
    );
  } catch (error) {
    console.error('❌ Failed to clear failed attempts:', error);
  }
};

/**
 * Admin function to unlock an account
 */
export const adminUnlockAccount = async (
  email: string,
  adminEmail: string,
  req?: Request
): Promise<{ success: boolean; message: string }> => {
  try {
    // Clear all failed attempts
    await clearFailedAttempts(email);

    // Log the admin action
    await logAudit({
      userEmail: adminEmail,
      action: 'UPDATE',
      resourceType: 'user_profile',
      ipAddress: req ? getClientIp(req) : undefined,
      userAgent: req ? getUserAgent(req) : undefined,
      details: {
        action: 'admin_unlock_account',
        target_email: email,
      },
      status: 'success',
    });

    console.log(`🔓 Admin ${adminEmail} unlocked account for ${email}`);

    return {
      success: true,
      message: `Account for ${email} has been unlocked.`,
    };
  } catch (error) {
    console.error('❌ Failed to unlock account:', error);
    return {
      success: false,
      message: 'Failed to unlock account. Please try again.',
    };
  }
};

/**
 * Get login attempt history for an email (for admin review)
 */
export const getLoginAttemptHistory = async (
  email: string,
  limit: number = 50
): Promise<LoginAttempt[]> => {
  try {
    const attempts = await query<LoginAttempt>(
      `SELECT * FROM login_attempts 
       WHERE email = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [email.toLowerCase(), limit]
    );

    return attempts;
  } catch (error) {
    console.error('❌ Failed to get login attempt history:', error);
    return [];
  }
};

/**
 * Clean up old login attempts (run periodically)
 * Keeps attempts for 7 days for security review
 */
export const cleanupOldAttempts = async (): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await query(
      `DELETE FROM login_attempts WHERE created_at < $1`,
      [cutoffDate.toISOString()]
    );

    // Return number of deleted rows (if available)
    return 0;
  } catch (error) {
    console.error('❌ Failed to cleanup old login attempts:', error);
    return 0;
  }
};

export default {
  initLoginAttemptsTable,
  recordLoginAttempt,
  getFailedAttemptCount,
  checkAccountLockStatus,
  checkLoginAllowed,
  handleFailedLogin,
  handleSuccessfulLogin,
  clearFailedAttempts,
  adminUnlockAccount,
  getLoginAttemptHistory,
  cleanupOldAttempts,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
};
