import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import ProfessionalSidebar, { PROFESSIONAL_NAV_ITEMS } from '@/components/professional/ProfessionalSidebar';
import ProfessionalHeader from '@/components/professional/ProfessionalHeader';
import ProfessionalFooter from '@/components/professional/ProfessionalFooter';
import ProfessionalDashboardSection from '@/components/professional/sections/ProfessionalDashboardSection';
import MyClientsSection from '@/components/professional/sections/MyClientsSection';
import ClientPhotosSection from '@/components/professional/sections/ClientPhotosSection';
import ManageRoutinesSection from '@/components/professional/sections/ManageRoutinesSection';
import TreatmentPlansSection from '@/components/professional/sections/TreatmentPlansSection';
import AnalyticsSection from '@/components/professional/sections/AnalyticsSection';
import ProductLibrarySection from '@/components/professional/sections/ProductLibrarySection';
import NotificationsSection from '@/components/professional/sections/NotificationsSection';
import HelpSection from '@/components/client/sections/HelpSection';
import ProfileSection from '@/components/shared/ProfileSection';
import ClientProfileModal, { ClientProfile } from '@/components/professional/modals/ClientProfileModal';
import { Loader2 } from 'lucide-react';


// ============================================================================
// TYPES
// ============================================================================

interface Client {
  id: string;
  name: string;
  email: string;
  image: string;
  phone?: string;
  skinType?: string;
  concerns?: string[];
  currentStreak: number;
  level: string;
  compliance: number;
  routineCompletedToday: boolean;
  isRegistered: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProfessionalPage: React.FC = () => {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { user, profile, initialized, loading, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalClients, setTotalClients] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Client Profile Modal state
  const [showClientProfileModal, setShowClientProfileModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);

  // Get active view from URL parameter
  const activeView = section || 'dashboard';

  // Fetch real client count from database
  useEffect(() => {
    const fetchClientCount = async () => {
      if (!user?.id) return;

      try {
        const { count, error } = await supabase
          .from('client_professional_relationships')
          .select('*', { count: 'exact', head: true })
          .eq('professional_id', user.id)
          .eq('status', 'active');

        if (error) {
          console.error('Error fetching client count:', error);
          return;
        }

        setTotalClients(count || 0);
      } catch (err) {
        console.error('Error fetching client count:', err);
      }
    };

    fetchClientCount();
  }, [user?.id]);

  // Fetch unread notifications count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user?.id) return;

      try {
        // Count unread notes from clients where professional_id matches current user
        // and sender_type is 'client' or null (messages from clients)
        const { data: notes, error } = await supabase
          .from('routine_notes')
          .select('id, sender_type, read_status')
          .eq('professional_id', user.id)
          .eq('read_status', false)
          .eq('professional_deleted', false);

        if (error) {
          console.error('Error fetching unread count:', error);
          return;
        }

        // Filter in JS to count only messages from clients (sender_type is 'client' or null)
        const unreadFromClients = notes?.filter(
          note => note.sender_type === 'client' || !note.sender_type
        ).length || 0;

        setUnreadNotifications(unreadFromClients);
      } catch (err) {
        console.error('Error fetching unread notifications:', err);
      }
    };

    fetchUnreadCount();

    // Subscribe to real-time updates for new notes
    const channel = supabase
      .channel('sidebar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'routine_notes',
        },
        () => {
          // Refetch unread count when notes change
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);



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
    if (profile && profile.role !== 'professional') {
      // User is not a professional, redirect to client page
      console.log('User is not a professional, redirecting to client page');
      navigate('/client', { replace: true });
    }
  }, [initialized, isAuthenticated, user, profile, navigate]);

  // Show loading state while checking session
  if (!initialized || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D2A3E]" />
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
          <Loader2 className="w-8 h-8 animate-spin text-[#2D2A3E]" />
          <p className="text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Get user data from profile or fallback to defaults
  const userDisplayName = profile?.full_name || user.user_metadata?.full_name || 'Professional';
  const userEmail = profile?.email || user.email || '';
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || '';
  const businessName = profile?.business_name || 'Your Business';


  const handleNavigateToView = (viewId: string) => {
    navigate(`/professional/${viewId}`);
    setSidebarOpen(false); // Close mobile sidebar after navigation
  };

  const handleOpenClientProfile = (client: Client) => {
    // Convert Client to ClientProfile format
    const clientProfile: ClientProfile = {
      id: client.id,
      email: client.email,
      full_name: client.name,
      avatar_url: client.image,
      phone: client.phone,
      skin_type: client.skinType,
      concerns: client.concerns,
    };
    setSelectedClient(clientProfile);
    setShowClientProfileModal(true);
  };

  const handleCloseClientProfileModal = () => {
    setShowClientProfileModal(false);
    setSelectedClient(null);
  };

  const handleUpdateClient = (updatedClient: ClientProfile) => {
    // Update the selected client with new data
    setSelectedClient(updatedClient);
    // Optionally refresh the client list in the dashboard
    console.log('Client updated:', updatedClient);
  };

  // SMS Modal is handled internally by ProfessionalDashboardSection


  const handleOpenAddClientModal = () => {
    console.log('Opening add client modal');
    // TODO: Implement add client modal
  };

  const getPageTitle = () => {
    if (activeView === 'profile') {
      return 'My Profile';
    }
    if (activeView === 'notifications') {
      return 'Notifications';
    }
    const navItem = PROFESSIONAL_NAV_ITEMS.find(item => item.id === activeView);
    return navItem?.label || 'Dashboard';
  };

  const getPageSubtitle = () => {
    if (activeView === 'profile') {
      return 'Manage your account';
    }
    if (activeView === 'notifications') {
      return 'View and manage client notes';
    }
    return `Welcome back, ${userDisplayName.split(' ')[0]}`;
  };


  const renderSection = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <ProfessionalDashboardSection
            onNavigateToView={handleNavigateToView}
            onOpenClientProfile={handleOpenClientProfile}
          />
        );

      case 'clients':
        return (
          <MyClientsSection
            onOpenAddClientModal={handleOpenAddClientModal}
          />
        );
      case 'photos':
        return <ClientPhotosSection />;
      case 'routines':
        return (
          <ManageRoutinesSection
            onNavigateToView={handleNavigateToView}
          />
        );
      case 'treatments':
        return (
          <TreatmentPlansSection
            onNavigateToView={handleNavigateToView}
          />
        );
      case 'analytics':
        return (
          <AnalyticsSection
            onNavigateToView={handleNavigateToView}
          />
        );
      case 'products':
        return (
          <ProductLibrarySection
            onNavigateToView={handleNavigateToView}
          />
        );
      case 'help':
        return <HelpSection userRole="professional" />;
      case 'profile':
        return <ProfileSection userRole="professional" />;
      case 'notifications':
        return (
          <NotificationsSection
            onNavigateToView={handleNavigateToView}
          />
        );
      default:
        return (
          <ProfessionalDashboardSection
            onNavigateToView={handleNavigateToView}
            onOpenClientProfile={handleOpenClientProfile}
          />
        );
    }


  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
      <div className="flex h-full">
        {/* Sidebar - Fixed height */}
        <ProfessionalSidebar
          sidebarOpen={sidebarOpen}
          activeView={activeView}
          onNavigateToView={handleNavigateToView}
          userDisplayName={userDisplayName}
          userAvatar={userAvatar}
          totalClients={totalClients}
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
          <ProfessionalHeader
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
            onNavigateToView={handleNavigateToView}
          />

          {/* Page Content - Scrollable */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="mx-auto">
              {renderSection()}
            </div>
          </main>
          {/* Footer inside scrollable area */}
          <ProfessionalFooter />
        </div>
      </div>

      {/* Client Profile Modal */}
      {selectedClient && (
        <ClientProfileModal
          client={selectedClient}
          isOpen={showClientProfileModal}
          onClose={handleCloseClientProfileModal}
          onUpdate={handleUpdateClient}
        />
      )}
    </div>
  );
};

export default ProfessionalPage;
