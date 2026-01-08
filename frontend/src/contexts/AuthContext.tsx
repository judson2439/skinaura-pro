/**
 * @fileoverview Authentication context for managing user session, authentication, and profile data.
 * Implements custom JWT-based authentication with localStorage session management.
 * 
 * Key Features:
 * - Session persistence using localStorage with custom JWT tokens
 * - On page refresh, checks localStorage for existing session
 * - 10-minute inactivity timeout with auto-logout
 * - Automatic profile fetching from user_profiles table
 * - Sign in, sign up, and sign out functionality
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { sanitizeInput } from '@/lib/security';
import {
  AuthUser as StoredAuthUser,
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
  validateAuthSession,
  updateLastActivity,
  isSessionExpiredByInactivity,
  INACTIVITY_TIMEOUT_MS,
} from '@/lib/authStorage';

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_STORAGE_KEY = 'glowplan_session';
const PROFILE_STORAGE_KEY = 'glowplan_profile';
const INACTIVITY_CHECK_INTERVAL = 30000; // Check every 30 seconds

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'client' | 'professional' | 'admin';
  avatar_url: string | null;
  skin_type: string | null;
  concerns: string[] | null;
  business_name: string | null;
  license_number: string | null;
  professional_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: 'client' | 'professional';
  skinType?: string;
  concerns?: string[];
  businessName?: string;
  licenseNumber?: string;
  avatarFile?: File | null;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  needsEmailVerification?: boolean;
  role?: 'client' | 'professional' | 'admin';
}

interface StoredSessionData {
  session: Session;
  user: User;
  profile: UserProfile | null;
}

interface AuthContextType {
  // State
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  isAuthenticated: boolean;
  /** JWT token for API calls */
  authToken: string | null;
  
  // Actions
  signIn: (data: SignInData) => Promise<AuthResult>;
  signUp: (data: SignUpData) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<AuthResult>;
  /** Update activity timestamp (call on user interactions) */
  updateActivity: () => void;
  /** Set auth from custom backend login */
  setCustomAuth: (user: StoredAuthUser, token: string) => void;
  /** Clear auth session (for logout) */
  clearAuth: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// HOOK
// ============================================================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================================================
// HELPER FUNCTIONS FOR LOCALSTORAGE
// ============================================================================

const saveSessionToStorage = (session: Session, user: User, profile: UserProfile | null): void => {
  try {
    const data: StoredSessionData = { session, user, profile };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    console.log('Session saved to localStorage');
  } catch (error) {
    console.error('Error saving session to localStorage:', error);
  }
};

const getSessionFromStorage = (): StoredSessionData | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const data: StoredSessionData = JSON.parse(stored);
    return data;
  } catch (error) {
    console.error('Error reading session from localStorage:', error);
    return null;
  }
};

const clearSessionFromStorage = (): void => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    console.log('Session cleared from localStorage');
  } catch (error) {
    console.error('Error clearing session from localStorage:', error);
  }
};

// ============================================================================
// PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Computed property for authentication status
  // Check both Supabase session and custom auth token
  const isAuthenticated = !!(session && user) || !!authToken;

  // Set custom auth from backend login
  const setCustomAuth = useCallback((user: StoredAuthUser, token: string) => {
    console.log('Setting custom auth for user:', user.email);
    
    // Save to localStorage
    saveAuthSession(user, token);
    
    // Update state
    setAuthToken(token);
    
    // Create profile from user data
    const newProfile: UserProfile = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || null,
      role: user.role,
      avatar_url: user.avatar_url || null,
      skin_type: null,
      concerns: null,
      business_name: null,
      license_number: null,
      professional_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setProfile(newProfile);
    
    // Update activity timestamp
    updateLastActivity();
    
    console.log('✅ Custom auth set successfully');
  }, []);

  // Clear auth session (for logout or expiration)
  const clearAuth = useCallback(() => {
    console.log('Clearing auth session...');
    
    // Clear all storage
    clearAuthSession();
    clearSessionFromStorage();
    
    // Clear state
    setSession(null);
    setUser(null);
    setProfile(null);
    setAuthToken(null);
    
    console.log('✅ Auth session cleared');
  }, []);

  // Update activity (for manual activity tracking)
  const handleUpdateActivity = useCallback(() => {
    updateLastActivity();
  }, []);

  // Fetch user profile from user_profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  // Initialize session on mount - Check localStorage for existing session
  useEffect(() => {
    const initializeAuth = () => {
      console.log('Initializing auth - checking localStorage for existing session...');
      
      // First, check for custom auth session (from our backend)
      const customSession = getAuthSession();
      
      if (customSession && customSession.token) {
        console.log('Custom auth session found in localStorage');
        
        // Validate the session (check token expiration and inactivity)
        const { valid, reason } = validateAuthSession();
        
        if (!valid) {
          console.log(`Custom session invalid: ${reason}, clearing...`);
          clearAuthSession();
          setAuthToken(null);
          setProfile(null);
          // Continue to check Supabase session below
        } else {
          // Session is valid, restore state
          setAuthToken(customSession.token);
          
          // Create a profile from the stored user data
          const storedUser = customSession.user;
          const restoredProfile: UserProfile = {
            id: storedUser.id,
            email: storedUser.email,
            full_name: storedUser.full_name,
            phone: storedUser.phone || null,
            role: storedUser.role,
            avatar_url: storedUser.avatar_url || null,
            skin_type: null,
            concerns: null,
            business_name: null,
            license_number: null,
            professional_id: null,
            created_at: customSession.loginTime,
            updated_at: customSession.lastActivity,
          };
          
          setProfile(restoredProfile);
          console.log('Custom session restored from localStorage, role:', storedUser.role);
          setInitialized(true);
          return;
        }
      }
      
      // Check Supabase localStorage for existing session (legacy/fallback)
      const storedData = getSessionFromStorage();
      
      if (storedData && storedData.session && storedData.user) {
        console.log('Supabase session found in localStorage, user is authenticated');
        
        // Check if session is expired
        const expiresAt = storedData.session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt && expiresAt < now) {
          console.log('Session expired, clearing localStorage');
          clearSessionFromStorage();
          setSession(null);
          setUser(null);
          setProfile(null);
          setInitialized(true);
          return;
        }
        
        // Session is valid, restore state
        setSession(storedData.session);
        setUser(storedData.user);
        setProfile(storedData.profile);
        console.log('Session restored from localStorage, role:', storedData.profile?.role);
      } else {
        console.log('No session found in localStorage - user is signed out');
        // No session in localStorage - user is signed out
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthToken(null);
      }
      
      // Mark initialization as complete
      setInitialized(true);
      console.log('Auth initialization complete');
    };

    initializeAuth();
  }, []);

  // Inactivity timeout checker - runs every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const checkInactivity = () => {
      if (isSessionExpiredByInactivity()) {
        console.log('⏰ Session expired due to inactivity (10 minutes)');
        
        // Clear all auth data
        clearAuthSession();
        clearSessionFromStorage();
        
        setSession(null);
        setUser(null);
        setProfile(null);
        setAuthToken(null);
        
        // Redirect will be handled by the page components
      }
    };

    const intervalId = setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  // Activity tracking - update on user interactions
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    let lastUpdate = 0;

    const handleActivity = () => {
      const now = Date.now();
      // Throttle to once per second
      if (now - lastUpdate < 1000) {
        return;
      }
      lastUpdate = now;
      updateLastActivity();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial activity update
    updateLastActivity();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated]);

  // Upload avatar to Supabase storage
  const uploadAvatar = async (userId: string, avatarFile: File): Promise<string | null> => {
    try {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `avatars/${userId}/avatar.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, avatarFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Avatar upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      return null;
    }
  };

  // Sign In
  const signIn = async (data: SignInData): Promise<AuthResult> => {
    setLoading(true);
    
    try {
      // Step 1: Sign in with Supabase Auth (checks auth.users table)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (authError) {
        console.error('Login error:', authError);
        
        if (authError.message.includes('Invalid login credentials')) {
          return { success: false, error: 'Invalid email or password. Please try again.' };
        } else if (authError.message.includes('Email not confirmed')) {
          return { success: false, error: 'Please verify your email before signing in.', needsEmailVerification: true };
        }
        
        return { success: false, error: authError.message };
      }

      if (!authData.user || !authData.session) {
        return { success: false, error: 'Failed to sign in. Please try again.' };
      }

      // Step 2: Fetch user profile to get role (from user_profiles table)
      const userProfile = await fetchProfile(authData.user.id);
      
      // Step 3: Update last_logged_at timestamp in user_profiles
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ last_logged_at: new Date().toISOString() })
        .eq('id', authData.user.id);
      
      if (updateError) {
        console.error('Error updating last_logged_at:', updateError);
        // Don't fail the login if this update fails, just log it
      }
      
      // Step 4: Save session to localStorage
      saveSessionToStorage(authData.session, authData.user, userProfile);
      
      // Step 5: Update state
      setSession(authData.session);
      setUser(authData.user);
      setProfile(userProfile);

      if (!userProfile) {
        // Try to get role from user metadata as fallback
        const role = authData.user.user_metadata?.role as 'client' | 'professional' | undefined;
        return { success: true, role };
      }

      // Return success with role for navigation
      return { success: true, role: userProfile.role };


    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  // Sign Up
  const signUp = async (data: SignUpData): Promise<AuthResult> => {
    setLoading(true);
    
    try {
      // Step 1: Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/confirm-email`,
          data: {
            full_name: sanitizeInput(data.fullName.trim()),
            role: data.role,
          }
        }
      });

      if (authError) {
        console.error('Signup error:', authError);
        
        if (authError.message.includes('already registered')) {
          return { success: false, error: 'This email is already registered. Please sign in instead.' };
        }
        
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create account. Please try again.' };
      }

      const userId = authData.user.id;

      // Step 2: Upload avatar if provided
      let avatarUrl: string | null = null;
      if (data.avatarFile) {
        avatarUrl = await uploadAvatar(userId, data.avatarFile);
      }

      // Step 3: Create user profile in user_profiles table
      const profileData: Record<string, any> = {
        id: userId,
        email: data.email.trim().toLowerCase(),
        full_name: sanitizeInput(data.fullName.trim()),
        phone: data.phone ? sanitizeInput(data.phone.trim()) : null,
        avatar_url: avatarUrl,
        role: data.role,
      };

      // Add role-specific fields
      if (data.role === 'client') {
        profileData.skin_type = data.skinType || null;
        profileData.concerns = data.concerns && data.concerns.length > 0 ? data.concerns : null;
        profileData.business_name = null;
        profileData.license_number = null;
        profileData.professional_id = null;
      } else {
        profileData.skin_type = null;
        profileData.concerns = null;
        profileData.business_name = data.businessName ? sanitizeInput(data.businessName.trim()) : null;
        profileData.license_number = data.licenseNumber ? sanitizeInput(data.licenseNumber.trim()) : null;
        profileData.professional_id = null;
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Note: The auth user is already created, so we just log this error
        // The user can still verify their email and we can handle profile creation later
      }

      // Step 4: If session is available (email verification disabled), save to localStorage
      if (authData.session) {
        const userProfile: UserProfile = {
          id: userId,
          email: profileData.email,
          full_name: profileData.full_name,
          phone: profileData.phone,
          role: data.role,
          avatar_url: avatarUrl,
          skin_type: profileData.skin_type,
          concerns: profileData.concerns,
          business_name: profileData.business_name,
          license_number: profileData.license_number,
          professional_id: profileData.professional_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        saveSessionToStorage(authData.session, authData.user, userProfile);
        setSession(authData.session);
        setUser(authData.user);
        setProfile(userProfile);
      }

      return { success: true, needsEmailVerification: !authData.session, role: data.role };

    } catch (error: any) {
      console.error('Signup error:', error);
      return { success: false, error: error.message || 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
    setLoading(true);
    
    try {
      // Step 1: Clear localStorage first
      clearSessionFromStorage();
      
      // Step 2: Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
      }
      
      // Step 3: Clear state
      setSession(null);
      setUser(null);
      setProfile(null);
      
      console.log('User signed out successfully');
      
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if Supabase sign out fails, clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // Refresh Profile
  const refreshProfile = async (): Promise<void> => {
    if (!user) return;
    
    const userProfile = await fetchProfile(user.id);
    setProfile(userProfile);
    
    // Update localStorage with new profile
    if (session && userProfile) {
      saveSessionToStorage(session, user, userProfile);
    }
  };

  // Update Profile
  const updateProfile = async (updates: Partial<UserProfile>): Promise<AuthResult> => {
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        return { success: false, error: error.message };
      }

      // Refresh profile after update
      await refreshProfile();
      
      return { success: true };

    } catch (error: any) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    initialized,
    isAuthenticated,
    authToken,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    updateProfile,
    updateActivity: handleUpdateActivity,
    setCustomAuth,
    clearAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
