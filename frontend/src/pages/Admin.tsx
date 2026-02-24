/**
 * @fileoverview Admin Dashboard Page
 * Provides administrative controls and overview for the SkinAura PRO platform.
 * 
 * Session Management:
 * - On mount, checks localStorage for admin session using centralized auth storage
 * - Validates JWT token expiration and 10-minute inactivity timeout
 * - If valid session exists, stays on admin page
 * - If no session or invalid session, redirects to "/" and clears localStorage
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminTabType, PlatformMetrics, UserProfile, Product, AdminRoutineTemplate } from '@/components/admin/types';
import AdminHeader from '@/components/admin/AdminHeader';
import OverviewSection from '@/components/admin/sections/OverviewSection';
import UsersSection from '@/components/admin/sections/UsersSection';
import ProductsSection from '@/components/admin/sections/ProductsSection';
import RoutinesSection from '@/components/admin/sections/RoutinesSection';
import RoutineTemplatesSection from '@/components/admin/sections/RoutineTemplatesSection';
import ProgressPhotosSection from '@/components/admin/sections/ProgressPhotosSection';
import AuditLogsSection from '@/components/admin/sections/AuditLogsSection';
import { Loader2 } from 'lucide-react';
import { validateAuthSession, getAuthSession, clearAuthSession } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';

// ============================================================================
// CONSTANTS
// ============================================================================

const ADMIN_SESSION_KEY = 'glowplan_admin_session';

// ============================================================================
// TYPE DEFINITIONS 
// ============================================================================

interface AdminSessionData {
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  user: {
    id: string;
    email: string;
  };
  profile: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  loginTime: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getAdminSessionFromStorage = (): AdminSessionData | null => {
  try {
    const stored = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!stored) {
      return null;
    }
    const data: AdminSessionData = JSON.parse(stored);
    return data;
  } catch (error) {
    console.error('Error reading admin session from localStorage:', error);
    return null;
  }
};

const clearAdminSession = (): void => {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (error) {
    console.error('Error clearing admin session from localStorage:', error);
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalRoutines, setTotalRoutines] = useState(0);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [adminProfile, setAdminProfile] = useState<AdminSessionData['profile'] | null>(null);

  // Platform Metrics State
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetrics>({
    totalActiveProfessionals: 0,
    totalActiveClients: 0,
    routinesCompletedToday: 3421,
    routinesCompletedAllTime: 847293,
    professionalChange: 8.2,
    clientChange: 12.5,
  });

  // Track user activity and auto-logout after 10 minutes of inactivity
  useInactivityTimeout({
    enabled: !isCheckingSession && !!adminProfile,
  });

  // Check admin session on mount
  useEffect(() => {
    const checkAdminSession = () => {
      // Validate auth session using centralized auth storage
      const { valid, reason } = validateAuthSession();
      const customSession = getAuthSession();
      
      // Check if we have a valid session
      if (!customSession || !customSession.token) {
        clearAuthSession();
        clearAdminSession();
        navigate('/', { replace: true });
        return;
      }

      if (!valid && reason) {
        
        // Show toast if session expired due to inactivity
        if (reason === 'Session expired due to inactivity') {
          toast({
            title: 'Session Expired',
            description: 'You have been logged out due to inactivity. Please sign in again.',
            variant: 'destructive',
            duration: 5000,
          });
        }
        
        clearAuthSession();
        clearAdminSession();
        navigate('/', { replace: true });
        return;
      }
      
      // Verify role is admin
      if (customSession.user.role !== 'admin') {
        if (customSession.user.role === 'client') {
          navigate('/client', { replace: true });
        } else {
          navigate('/professional', { replace: true });
        }
        return;
      }
      
      // Session is valid, set admin profile
      setAdminProfile({
        id: customSession.user.id,
        email: customSession.user.email,
        full_name: customSession.user.full_name,
        role: customSession.user.role,
      });
      setIsCheckingSession(false);
    };

    checkAdminSession();
  }, [navigate, toast]);

  // Handle admin logout
  const handleLogout = () => {
    clearAuthSession();
    clearAdminSession();
    navigate('/', { replace: true });
  };

  // Handle users loaded from UsersSection
  const handleUsersLoaded = useCallback((users: UserProfile[]) => {
    const professionals = users.filter(u => u.role === 'professional').length;
    const clients = users.filter(u => u.role === 'client').length;
    setPlatformMetrics(prev => ({
      ...prev,
      totalActiveProfessionals: professionals,
      totalActiveClients: clients,
    }));
  }, []);

  // Handle products loaded from ProductsSection
  const handleProductsLoaded = useCallback((products: Product[]) => {
    setTotalProducts(products.length);
  }, []);

  // Handle routines loaded from RoutinesSection
  const handleRoutinesLoaded = useCallback((routines: AdminRoutineTemplate[]) => {
    setTotalRoutines(routines.length);
  }, []);

  // Handle refresh for overview
  const handleRefreshMetrics = async () => {
    setIsRefreshing(true);
    // The actual refresh will happen in the child components
    setLastUpdated(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#CFAFA3] mx-auto mb-4" />
          <p className="text-gray-600">Verifying admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <AdminHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        adminProfile={adminProfile}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <OverviewSection onRefresh={handleRefreshMetrics} />
        )}

        {activeTab === 'users' && (
          <UsersSection onUsersLoaded={handleUsersLoaded} />
        )}

        {activeTab === 'products' && (
          <ProductsSection onProductsLoaded={handleProductsLoaded} />
        )}

        {activeTab === 'routines' && (
          <RoutinesSection onRoutinesLoaded={handleRoutinesLoaded} />
        )}

        {activeTab === 'routine-templates' && (
          <RoutineTemplatesSection />
        )}

        {activeTab === 'progress-photos' && (
          <ProgressPhotosSection />
        )}

        {activeTab === 'audit-logs' && (
          <AuditLogsSection />
        )}
      </main>
    </div>
  );
};

export default Admin;
