import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuthSession, clearAuthSession, isSessionExpiredByInactivity, validateAuthSession, getAuthToken, AUTH_SESSION_UPDATED_EVENT, AuthSession } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { apiClient } from '@/lib/apiClient';
import ProfessionalSidebar, { PROFESSIONAL_NAV_ITEMS } from '@/components/professional/ProfessionalSidebar';
import ProfessionalHeader from '@/components/professional/ProfessionalHeader';
import ProfessionalFooter from '@/components/professional/ProfessionalFooter';
import ProfessionalDashboardSection from '@/components/professional/sections/ProfessionalDashboardSection';
import OnboardingSection from '@/components/professional/sections/OnboardingSection';
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
  const { toast } = useToast();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalClients, setTotalClients] = useState(0);
  
  // Auth session state - allows re-render when session is updated (e.g., avatar change)
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => getAuthSession());

  // Track user activity and auto-logout after 10 minutes of inactivity
  useInactivityTimeout({
    enabled: !!authSession,
  });

  // Client Profile Modal state
  const [showClientProfileModal, setShowClientProfileModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);

  // Get active view from URL parameter
  const activeView = section || 'dashboard';
  
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

  // Fetch real client count from backend API
  const fetchClientCount = useCallback(async () => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    
    if (!token) return;

    try {
      // Set auth token for API client
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { count: number };
        error?: string;
      }>('/api/professional/clients/count');

      if (response.data.success && response.data.data) {
        setTotalClients(response.data.data.count);
      } else {
        console.error('Error fetching client count:', response.data.error);
      }
    } catch (err) {
      console.error('Error fetching client count:', err);
    }
  }, []);

  useEffect(() => {
    fetchClientCount();
  }, [fetchClientCount]);



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
        console.log(`Custom session invalid: ${reason}`);
        
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
      console.log('No session found, redirecting to landing page');
      navigate('/', { replace: true });
      setIsCheckingSession(false);
      return;
    }

    // Get role from auth storage
    const userRole = authSession?.user?.role;

    // User is authenticated, check role
    if (userRole && userRole !== 'professional') {
      console.log(`User role is ${userRole}, redirecting...`);
      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/client', { replace: true });
      }
    }
    
    setIsCheckingSession(false);
  }, [navigate, toast]);

  // Check for valid auth session (using state variable)
  const hasValidSession = authSession && authSession.token;

  // Show loading state while checking session
  if (isCheckingSession) {
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
  if (!hasValidSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D2A3E]" />
          <p className="text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Get user data from auth session, or fallback to defaults
  const storedUser = authSession?.user;
  const userDisplayName = storedUser?.full_name || 'Professional';
  const userEmail = storedUser?.email || '';
  const userAvatar = storedUser?.avatar_url || '';
  const businessName = 'Your Business';


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

      case 'onboarding':
        return (
          <OnboardingSection
            onNavigateToView={handleNavigateToView}
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
          unreadNotifications={0}
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
            userAvatar={userAvatar}
            onNavigateToView={handleNavigateToView}
          />

          {/* Page Content - Scrollable */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-8">
              <div className="mx-auto">
                {renderSection()}
              </div>
            </div>
            {/* Footer inside scrollable area */}
          </main>
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
