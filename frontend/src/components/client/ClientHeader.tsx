import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Menu,
  X,
  Bell,
  Flame,
  ChevronDown,
  User,
  LogOut,
  MessageSquare,
  Loader2,
  ArrowRight,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ClientHeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  title: string;
  subtitle?: string;
  currentStreak: number;
  userDisplayName: string;
  userEmail: string;
  userAvatar?: string;
  onNavigateToView?: (viewId: string) => void;
  unreadNotifications?: number;
}

interface NotificationItem {
  id: string;
  professional_id: string;
  professional_name: string;
  professional_avatar: string | null;
  content: string;
  created_at: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ClientHeader: React.FC<ClientHeaderProps> = ({
  sidebarOpen,
  toggleSidebar,
  title,
  subtitle,
  currentStreak,
  userDisplayName,
  userEmail,
  userAvatar,
  onNavigateToView,
  unreadNotifications = 0,
}) => {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Use profile avatar if available, otherwise generate default
  const avatarUrl = profile?.avatar_url || userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=CFAFA3&color=2D2A3E`;

  // Fetch recent notifications when dropdown opens
  const fetchRecentNotifications = async () => {
    if (!user?.id) return;
    
    setLoadingNotifications(true);
    try {
      // Fetch recent unread messages from professionals
      const { data: notes, error } = await supabase
        .from('routine_notes')
        .select('*')
        .eq('client_id', user.id)
        .eq('client_deleted', false)
        .eq('sender_type', 'professional')
        .eq('read_status', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (notes && notes.length > 0) {
        // Get unique professional IDs
        const professionalIds = [...new Set(notes.map(note => note.professional_id))];

        // Fetch professional profiles
        const { data: professionalProfiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', professionalIds);

        // Map notes to notification items
        const notificationItems: NotificationItem[] = notes.map(note => {
          const professionalProfile = professionalProfiles?.find(p => p.id === note.professional_id);
          return {
            id: note.id,
            professional_id: note.professional_id,
            professional_name: professionalProfile?.full_name || 'Your Professional',
            professional_avatar: professionalProfile?.avatar_url || null,
            content: note.content,
            created_at: note.created_at,
          };
        });

        setNotifications(notificationItems);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showNotifications) {
      fetchRecentNotifications();
    }
  }, [showNotifications]);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await signOut();
    navigate('/');
  };

  const handleProfileClick = () => {
    setShowUserMenu(false);
    if (onNavigateToView) {
      onNavigateToView('profile');
    } else {
      navigate('/client/profile');
    }
  };

  const handleViewAllNotifications = () => {
    setShowNotifications(false);
    if (onNavigateToView) {
      onNavigateToView('notifications');
    } else {
      navigate('/client/notifications');
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 lg:px-8 py-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Streak Badge */}
          {currentStreak > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl border border-orange-200">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-orange-600">{currentStreak}</span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadNotifications > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{unreadNotifications} unread message{unreadNotifications !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto">
                    {loadingNotifications ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#CFAFA3]" />
                      </div>
                    ) : notifications.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="flex gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={handleViewAllNotifications}
                          >
                            <div className="flex-shrink-0">
                              {notification.professional_avatar ? (
                                <img
                                  src={notification.professional_avatar}
                                  alt={notification.professional_name}
                                  className="w-10 h-10 rounded-full object-cover border border-gray-100"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center">
                                  <User className="w-5 h-5 text-[#CFAFA3]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{notification.professional_name}</p>
                              <p className="text-sm text-gray-600 truncate">{notification.content}</p>
                              <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notification.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <MessageSquare className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No new notifications</p>
                      </div>
                    )}
                  </div>

                  {/* View All Button - show if more than 3 notifications */}
                  {(unreadNotifications > 3 || notifications.length > 0) && (
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <button
                        onClick={handleViewAllNotifications}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#b89a8f] transition-colors text-sm font-medium"
                      >
                        View All Notifications
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <img
                src={avatarUrl}
                alt={userDisplayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-gray-100"
              />
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-medium text-sm">{userDisplayName}</p>
                    <p className="text-xs text-gray-500">{userEmail}</p>
                  </div>
                  <button 
                    onClick={handleProfileClick}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm"
                  >
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ClientHeader;
