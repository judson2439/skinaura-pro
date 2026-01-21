import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuthSession, clearAuthSession, validateAuthSession, getAuthToken, AUTH_SESSION_UPDATED_EVENT, AuthSession } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import ClientSidebar, { CLIENT_NAV_ITEMS } from '@/components/client/ClientSidebar';
import ClientHeader from '@/components/client/ClientHeader';
import ClientFooter from '@/components/client/ClientFooter';
import DashboardSection from '@/components/client/sections/DashboardSection';
import MyRoutineSection from '@/components/client/sections/MyRoutineSection';
import MyProductsSection from '@/components/client/sections/MyProductsSection';
import ProgressPhotosSection from '@/components/client/sections/ProgressPhotosSection';
import FaceAnalysisSection from '@/components/client/sections/FaceAnalysisSection';
import FaceAnalysisV2Section from '@/components/client/sections/FaceAnalysisV2Section';
import TreatmentPlansSection from '@/components/client/sections/TreatmentPlansSection';
import AchievementsSection from '@/components/client/sections/AchievementsSection';
import LeaderboardSection from '@/components/client/sections/LeaderboardSection';
import HelpSection from '@/components/client/sections/HelpSection';
import NotificationsSection from '@/components/client/sections/NotificationsSection';
import ProfileSection from '@/components/shared/ProfileSection';
import { Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ClientStats {
  level: string;
  points: number;
  currentStreak: number;
}

interface UserGamification {
  user_id: string;
  points: number;
  level: string;
  current_streak: number;
  longest_streak: number;
  total_routines_completed: number;
  last_activity_date: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const LEVELS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 500 },
  { name: 'Gold', minPoints: 1500 },
  { name: 'Platinum', minPoints: 3500 },
  { name: 'Diamond', minPoints: 7000 },
];

function calculateLevel(points: number): string {
  let currentLevel = LEVELS[0].name;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      currentLevel = LEVELS[i].name;
      break;
    }
  }
  return currentLevel;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ClientPage: React.FC = () => {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientStats, setClientStats] = useState<ClientStats>({
    level: 'Bronze',
    points: 0,
    currentStreak: 0,
  });
  
  // Auth session state - allows re-render when session is updated (e.g., avatar change)
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession());

  // Track user activity and auto-logout after 10 minutes of inactivity
  useInactivityTimeout({
    enabled: !!authSession,
  });
  
  // Listen for auth session updates (e.g., when avatar is changed in profile)
  useEffect(() => {
    const handleSessionUpdate = () => {
      setAuthSession(getAuthSession());
    };
    
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, handleSessionUpdate);
    
    return () => {
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, handleSessionUpdate);
    };
  }, []);
  const [statsLoading, setStatsLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Get active view from URL parameter
  const activeView = section || 'dashboard';

  // Session check on page load/refresh
  // If no session after initialization, redirect to landing page
  // If session exists but wrong role, redirect to appropriate page
  useEffect(() => {
    // Get auth session from storage
    const authSession = getAuthSession();
    const hasValidAuth = authSession && authSession.token;
    
    // If we have custom auth, validate it
    if (hasValidAuth) {
      const { valid, reason } = validateAuthSession();
      
      if (!valid && reason) {
        // Only redirect for actual expiration, not "No session found"
        if (reason === 'Session expired due to inactivity' || reason === 'Token expired') {
          toast({
            title: 'Session Expired',
            description: reason === 'Session expired due to inactivity' 
              ? 'You have been logged out due to inactivity. Please sign in again.'
              : 'Your session has expired. Please sign in again.',
            variant: 'destructive',
            duration: 5000,
          });
          
          clearAuthSession();
          navigate('/', { replace: true });
          setIsCheckingSession(false);
          return;
        }
      }
    }

    // Check if user has any valid session
    if (!hasValidAuth) {
      navigate('/', { replace: true });
      setIsCheckingSession(false);
      return;
    }

    // Get role from auth storage
    const userRole = authSession?.user?.role;

    // User is authenticated, check role
    if (userRole && userRole !== 'client') {
      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/professional', { replace: true });
      }
    }
    
    setIsCheckingSession(false);
  }, [navigate, toast]);

  // Fetch gamification stats from database
  useEffect(() => {
    const fetchGamificationStats = async () => {
      const token = getAuthToken();
      if (!token) {
        setStatsLoading(false);
        return;
      }

      try {
        apiClient.setAuthToken(token);
        
        // Fetch user's gamification data
        const response = await apiClient.get<{
          success: boolean;
          data?: { gamification: UserGamification | null };
          error?: string;
        }>('/api/client/gamification');

        if (!response.data.success) {
          console.error('Error fetching gamification stats:', response.data.error);
          setStatsLoading(false);
          return;
        }

        const gamificationData = response.data.data?.gamification;

        if (!gamificationData) {
          // No record found - create initial record
          const createResponse = await apiClient.post<{
            success: boolean;
            data?: { gamification: UserGamification };
          }>('/api/client/gamification');

          if (createResponse.data.success && createResponse.data.data?.gamification) {
            const newData = createResponse.data.data.gamification;
            setClientStats({
              level: newData.level || 'Bronze',
              points: newData.points || 0,
              currentStreak: newData.current_streak || 0,
            });
          }
        } else {
          // Calculate level based on points (in case it's out of sync)
          const calculatedLevel = calculateLevel(gamificationData.points || 0);
          
          setClientStats({
            level: calculatedLevel,
            points: gamificationData.points || 0,
            currentStreak: gamificationData.current_streak || 0,
          });

          // Update level in database if it's different
          if (calculatedLevel !== gamificationData.level) {
            await apiClient.patch('/api/client/gamification', { level: calculatedLevel });
          }
        }
      } catch (err) {
        console.error('Error in fetchGamificationStats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    if (!isCheckingSession && getAuthToken()) {
      fetchGamificationStats();
    }
  }, [isCheckingSession]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        apiClient.setAuthToken(token);
        
        const response = await apiClient.get<{
          success: boolean;
          data?: { count: number };
          error?: string;
        }>('/api/client/notifications/unread-count');

        if (!response.data.success) {
          console.error('Error fetching unread count:', response.data.error);
          return;
        }

        setUnreadNotifications(response.data.data?.count || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    if (!isCheckingSession && getAuthToken()) {
      fetchUnreadCount();
    }
  }, [isCheckingSession]);

  // Poll for notification updates (replaces real-time subscription)
  useEffect(() => {
    const token = getAuthToken();
    if (!token || isCheckingSession) return;

    const pollInterval = setInterval(async () => {
      try {
        apiClient.setAuthToken(token);
        
        const response = await apiClient.get<{
          success: boolean;
          data?: { count: number };
        }>('/api/client/notifications/unread-count');

        if (response.data.success) {
          setUnreadNotifications(response.data.data?.count || 0);
        }
      } catch (err) {
        console.error('Error polling notifications:', err);
      }
    }, 30000000); // Poll every 30 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [isCheckingSession]);

  // Handle unread count change from NotificationsSection
  const handleUnreadCountChange = (count: number) => {
    setUnreadNotifications(count);
  };

  // Show loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Checking session...</p>
        </div>
      </div>
    );
  }

  // Check for valid auth session (using state variable)
  const hasValidSession = authSession && authSession.token;

  // Don't render content if not authenticated (will redirect)
  if (!hasValidSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Get user data from auth session, or fallback to defaults
  const storedUser = authSession?.user;
  const userDisplayName = storedUser?.full_name || 'User';
  const userEmail = storedUser?.email || '';
  const userAvatar = storedUser?.avatar_url || undefined;

  const handleNavigateToView = (viewId: string) => {
    navigate(`/client/${viewId}`);
    setSidebarOpen(false); // Close mobile sidebar after navigation
  };

  const getPageTitle = () => {
    if (activeView === 'profile') {
      return 'My Profile';
    }
    const navItem = CLIENT_NAV_ITEMS.find(item => item.id === activeView);
    return navItem?.label || 'Dashboard';
  };

  const getPageSubtitle = () => {
    if (activeView === 'profile') {
      return 'Manage your account';
    }
    if (statsLoading) {
      return 'Loading...';
    }
    return `${clientStats.currentStreak} day streak`;
  };

  const renderSection = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <DashboardSection
            clientStats={clientStats}
            userDisplayName={userDisplayName}
            onNavigateToView={handleNavigateToView}
          />
        );
      case 'routine':
        return <MyRoutineSection />;
      case 'products':
        return <MyProductsSection />;
      case 'photos':
        return <ProgressPhotosSection />;
      case 'face-analysis':
        return <FaceAnalysisSection />;
      case 'face-analysis-v2':
        return <FaceAnalysisV2Section />;
      case 'treatments':
        return <TreatmentPlansSection />;
      case 'notifications':
        return (
          <NotificationsSection 
            onNavigateToView={handleNavigateToView}
            onUnreadCountChange={handleUnreadCountChange}
          />
        );
      case 'achievements':
        return <AchievementsSection />;
      case 'leaderboard':
        return <LeaderboardSection />;
      case 'help':
        return <HelpSection />;
      case 'profile':
        return <ProfileSection userRole="client" />;
      default:
        return (
          <DashboardSection
            clientStats={clientStats}
            userDisplayName={userDisplayName}
          />
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">

      <div className="flex h-full">
        {/* Sidebar - Fixed height */}
        <ClientSidebar
          sidebarOpen={sidebarOpen}
          activeView={activeView}
          onNavigateToView={handleNavigateToView}
          userDisplayName={userDisplayName}
          userAvatar={userAvatar}
          clientStats={clientStats}
          unreadNotifications={unreadNotifications}
        />

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content - Scrollable */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header - Fixed */}
          <ClientHeader
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            currentStreak={clientStats.currentStreak}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            onNavigateToView={handleNavigateToView}
            unreadNotifications={unreadNotifications}
          />

          {/* Page Content - Scrollable */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto">
              {renderSection()}
            </div>
          </main>
          {/* Footer inside scrollable area */}
          <ClientFooter />
        </div>
      </div>
    </div>
  );
};

export default ClientPage;
