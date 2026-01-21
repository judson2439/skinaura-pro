/**
 * @fileoverview Auth storage utility for managing JWT tokens and user session in localStorage.
 * Handles token expiration, session persistence, and activity-based timeout.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const AUTH_STORAGE_KEY = 'skinaura_auth';
export const AUTH_TOKEN_KEY = 'skinaura_auth_token';
export const LAST_ACTIVITY_KEY = 'skinaura_last_activity';

// Inactivity timeout in milliseconds (10 minutes)
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'client' | 'professional' | 'admin';
  avatar_url?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  loginTime: string;
  lastActivity: string;
}

// ============================================================================
// JWT TOKEN UTILITIES
// ============================================================================

/**
 * Decode a JWT token payload without verification (for client-side use)
 */
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
};

/**
 * Check if a JWT token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
};

/**
 * Get token expiration time in milliseconds
 */
export const getTokenExpirationTime = (token: string): number | null => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }
  return payload.exp * 1000;
};

// ============================================================================
// SESSION STORAGE FUNCTIONS
// ============================================================================

/**
 * Save auth session to localStorage
 */
export const saveAuthSession = (user: AuthUser, token: string): void => {
  try {
    const session: AuthSession = {
      user,
      token,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (error) {
    console.error('❌ Failed to save auth session:', error);
  }
};

/**
 * Get auth session from localStorage
 */
export const getAuthSession = (): AuthSession | null => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    
    const session: AuthSession = JSON.parse(stored);
    return session;
  } catch (error) {
    console.error('❌ Failed to read auth session:', error);
    return null;
  }
};

/**
 * Get auth token from localStorage
 */
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('❌ Failed to read auth token:', error);
    return null;
  }
};

/**
 * Clear auth session from localStorage
 */
export const clearAuthSession = (): void => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    // Also clear legacy keys
    localStorage.removeItem('skinaura_user');
    localStorage.removeItem('glowplan_session');
    localStorage.removeItem('glowplan_profile');
    localStorage.removeItem('glowplan_admin_session');
  } catch (error) {
    console.error('❌ Failed to clear auth session:', error);
  }
};

// ============================================================================
// ACTIVITY TRACKING
// ============================================================================

/**
 * Update last activity timestamp
 */
export const updateLastActivity = (): void => {
  try {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    
    // Also update session
    const session = getAuthSession();
    if (session) {
      session.lastActivity = new Date().toISOString();
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }
  } catch (error) {
    console.error('❌ Failed to update last activity:', error);
  }
};

/**
 * Get last activity timestamp
 */
export const getLastActivity = (): number | null => {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!stored) {
      return null;
    }
    return parseInt(stored, 10);
  } catch (error) {
    console.error('❌ Failed to read last activity:', error);
    return null;
  }
};

/**
 * Check if session has expired due to inactivity
 */
export const isSessionExpiredByInactivity = (): boolean => {
  const lastActivity = getLastActivity();
  if (!lastActivity) {
    return true;
  }
  
  const now = Date.now();
  const elapsed = now - lastActivity;
  
  return elapsed > INACTIVITY_TIMEOUT_MS;
};

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate the current auth session
 * Checks both token expiration and inactivity timeout
 */
export const validateAuthSession = (): { valid: boolean; reason?: string } => {
  const session = getAuthSession();
  
  if (!session) {
    return { valid: false, reason: 'No session found' };
  }
  
  if (!session.token) {
    return { valid: false, reason: 'No token found' };
  }
  
  // Check JWT token expiration
  if (isTokenExpired(session.token)) {
    return { valid: false, reason: 'Token expired' };
  }
  
  // Check inactivity timeout
  if (isSessionExpiredByInactivity()) {
    return { valid: false, reason: 'Session expired due to inactivity' };
  }
  
  return { valid: true };
};

/**
 * Check if user is authenticated (has valid session)
 */
export const isAuthenticated = (): boolean => {
  const { valid } = validateAuthSession();
  return valid;
};

/**
 * Get current user from session
 */
export const getCurrentUser = (): AuthUser | null => {
  const session = getAuthSession();
  if (!session) {
    return null;
  }
  
  const { valid } = validateAuthSession();
  if (!valid) {
    return null;
  }
  
  return session.user;
};

/**
 * Get current user role
 */
export const getCurrentUserRole = (): 'client' | 'professional' | 'admin' | null => {
  const user = getCurrentUser();
  return user?.role || null;
};

// Custom event name for session updates
export const AUTH_SESSION_UPDATED_EVENT = 'skinaura_auth_session_updated';

/**
 * Dispatch event to notify components that the session has been updated
 */
const dispatchSessionUpdatedEvent = (): void => {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_UPDATED_EVENT));
};

/**
 * Update user data in the current session (after profile update)
 */
export const updateAuthSessionUser = (updatedUser: Partial<AuthUser>): void => {
  try {
    const session = getAuthSession();
    if (!session) {
      console.warn('No session to update');
      return;
    }

    // Merge updated user data with existing user
    session.user = {
      ...session.user,
      ...updatedUser,
    };
    session.lastActivity = new Date().toISOString();

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    // Dispatch event to notify components
    dispatchSessionUpdatedEvent();
  } catch (error) {
    console.error('❌ Failed to update auth session user:', error);
  }
};

export default {
  saveAuthSession,
  getAuthSession,
  getAuthToken,
  clearAuthSession,
  updateLastActivity,
  getLastActivity,
  isSessionExpiredByInactivity,
  validateAuthSession,
  isAuthenticated,
  getCurrentUser,
  getCurrentUserRole,
  updateAuthSessionUser,
  isTokenExpired,
  INACTIVITY_TIMEOUT_MS,
  AUTH_SESSION_UPDATED_EVENT,
};
