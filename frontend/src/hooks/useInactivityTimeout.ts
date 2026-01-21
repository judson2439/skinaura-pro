/**
 * @fileoverview Hook for monitoring user inactivity and auto-logout after timeout.
 * Tracks mouse movement, clicks, key presses, and touch events.
 * Auto-logs out and redirects to "/" after 10 minutes of inactivity.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  updateLastActivity,
  isSessionExpiredByInactivity,
  clearAuthSession,
  getAuthSession,
  INACTIVITY_TIMEOUT_MS,
} from '@/lib/authStorage';

// ============================================================================
// TYPES
// ============================================================================

interface UseInactivityTimeoutOptions {
  /** Callback to execute on logout (e.g., clearing auth state) */
  onLogout?: () => void;
  /** Whether to enable the inactivity tracking (default: true) */
  enabled?: boolean;
  /** Check interval in milliseconds (default: 30 seconds) */
  checkInterval?: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to monitor user inactivity and auto-logout after 10 minutes.
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   useInactivityTimeout({
 *     onLogout: () => {
 *       // Clear any additional state
 *     },
 *   });
 *   
 *   return <div>Protected content</div>;
 * };
 * ```
 */
export const useInactivityTimeout = (options: UseInactivityTimeoutOptions = {}) => {
  const {
    onLogout,
    enabled = true,
    checkInterval = 30000, // Check every 30 seconds
  } = options;

  const navigate = useNavigate();
  const { toast } = useToast();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityUpdateRef = useRef<number>(0);

  // Throttled activity update (update at most once per second)
  const handleActivity = useCallback(() => {
    const now = Date.now();
    
    // Throttle updates to once per second
    if (now - lastActivityUpdateRef.current < 1000) {
      return;
    }
    
    lastActivityUpdateRef.current = now;
    updateLastActivity();
  }, []);

  // Check for session expiration
  const checkSessionExpiration = useCallback(() => {
    const session = getAuthSession();
    
    // If no session, no need to check
    if (!session) {
      return;
    }

    // Check if session expired due to inactivity
    if (isSessionExpiredByInactivity()) {
      // Clear the auth session
      clearAuthSession();
      
      // Call the logout callback if provided
      if (onLogout) {
        onLogout();
      }
      
      // Show toast notification
      toast({
        title: 'Session Expired',
        description: 'You have been logged out due to inactivity. Please sign in again.',
        variant: 'destructive',
        duration: 5000,
      });
      
      // Redirect to landing page
      navigate('/', { replace: true });
    }
  }, [onLogout, navigate, toast]);

  // Setup activity listeners and expiration check
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check if there's an active session
    const session = getAuthSession();
    if (!session) {
      return;
    }

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the expiration check interval
    checkIntervalRef.current = setInterval(checkSessionExpiration, checkInterval);

    // Initial activity update
    updateLastActivity();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, handleActivity, checkSessionExpiration, checkInterval]);

  // Return utility functions
  return {
    /** Manually update activity timestamp */
    updateActivity: handleActivity,
    /** Check session expiration now */
    checkExpiration: checkSessionExpiration,
    /** Timeout duration in minutes */
    timeoutMinutes: INACTIVITY_TIMEOUT_MS / 60000,
  };
};

export default useInactivityTimeout;
