import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import ClientSidebar, { CLIENT_NAV_ITEMS } from '@/components/client/ClientSidebar';
import ClientHeader from '@/components/client/ClientHeader';
import ClientFooter from '@/components/client/ClientFooter';
import DashboardSection from '@/components/client/sections/DashboardSection';
import MyRoutineSection from '@/components/client/sections/MyRoutineSection';
import MyProductsSection from '@/components/client/sections/MyProductsSection';
import ProgressPhotosSection from '@/components/client/sections/ProgressPhotosSection';
import FaceAnalysisSection from '@/components/client/sections/FaceAnalysisSection';
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
  badges_earned: number;
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
  const { user, profile, initialized, loading, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientStats, setClientStats] = useState<ClientStats>({
    level: 'Bronze',
    points: 0,
    currentStreak: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Get active view from URL parameter
  const activeView = section || 'dashboard';

  // Session check on page load/refresh
  // If no session after initialization, redirect to landing page
  // If session exists but wrong role, redirect to appropriate page
  useEffect(() => {
    if (!initialized) {
      // Still checking session, wait...
      return;
    }

    // Session check complete
    if (!isAuthenticated || !user) {
      // No session found - user is signed out, redirect to landing
      console.log('No session found, redirecting to landing page');
      navigate('/', { replace: true });
      return;
    }

    // User is authenticated, check role
    if (profile && profile.role !== 'client') {
      // User is not a client, redirect to professional page
      console.log('User is not a client, redirecting to professional page');
      navigate('/professional', { replace: true });
    }
  }, [initialized, isAuthenticated, user, profile, navigate]);

  // Fetch gamification stats from database
  useEffect(() => {
    const fetchGamificationStats = async () => {
      if (!user?.id) {
        setStatsLoading(false);
        return;
      }

      try {
        // Fetch user's gamification data
        const { data: gamificationData, error } = await supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No record found - user hasn't started gamification yet
            // Create initial record
            const { data: newData, error: insertError } = await supabase
              .from('user_gamification')
              .insert({
                user_id: user.id,
                points: 0,
                level: 'Bronze',
                current_streak: 0,
                longest_streak: 0,
                total_routines_completed: 0,
                badges_earned: 0,
              })
              .select()
              .single();

            if (!insertError && newData) {
              setClientStats({
                level: newData.level || 'Bronze',
                points: newData.points || 0,
                currentStreak: newData.current_streak || 0,
              });
            }
          } else {
            console.error('Error fetching gamification stats:', error);
          }
        } else if (gamificationData) {
          // Calculate level based on points (in case it's out of sync)
          const calculatedLevel = calculateLevel(gamificationData.points || 0);
          
          setClientStats({
            level: calculatedLevel,
            points: gamificationData.points || 0,
            currentStreak: gamificationData.current_streak || 0,
          });

          // Update level in database if it's different
          if (calculatedLevel !== gamificationData.level) {
            await supabase
              .from('user_gamification')
              .update({ level: calculatedLevel })
              .eq('user_id', user.id);
          }
        }
      } catch (err) {
        console.error('Error in fetchGamificationStats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    if (initialized && isAuthenticated && user) {
      fetchGamificationStats();
    }
  }, [initialized, isAuthenticated, user]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user?.id) return;

      try {
        // Fetch unread messages from professionals
        const { data, error } = await supabase
          .from('routine_notes')
          .select('id')
          .eq('client_id', user.id)
          .eq('client_deleted', false)
          .eq('sender_type', 'professional')
          .eq('read_status', false);

        if (error) {
          console.error('Error fetching unread count:', error);
          return;
        }

        setUnreadNotifications(data?.length || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    if (initialized && isAuthenticated && user) {
      fetchUnreadCount();
    }
  }, [initialized, isAuthenticated, user]);

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user?.id || !initialized || !isAuthenticated) return;

    const channel = supabase
      .channel('client_notifications_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'routine_notes',
          filter: `client_id=eq.${user.id}`,
        },
        async () => {
          // Refetch unread count when notes change
          const { data } = await supabase
            .from('routine_notes')
            .select('id')
            .eq('client_id', user.id)
            .eq('client_deleted', false)
            .eq('sender_type', 'professional')
            .eq('read_status', false);

          setUnreadNotifications(data?.length || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, initialized, isAuthenticated]);

  // Handle unread count change from NotificationsSection
  const handleUnreadCountChange = (count: number) => {
    setUnreadNotifications(count);
  };

  // Show loading state while checking session
  if (!initialized || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Checking session...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <p className="text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Get user data from profile or fallback to defaults
  const userDisplayName = profile?.full_name || user.user_metadata?.full_name || 'User';
  const userEmail = profile?.email || user.email || '';
  const userAvatar = profile?.avatar_url || undefined;

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
