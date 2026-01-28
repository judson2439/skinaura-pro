import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import {
  UserPlus,
  Loader2,
  Inbox,
  User,
  Check,
  X,
  ArrowLeft,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface InvitationNotification {
  id: string;
  client_id: string;
  professional_id: string;
  professional_name: string;
  professional_avatar: string | null;
  professional_business_name: string | null;
  status: 'unread' | 'read' | 'accepted' | 'declined';
  created_at: string;
  read_at: string | null;
  responded_at: string | null;
}

interface InvitationNotificationsSectionProps {
  onNavigateToView?: (viewId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const InvitationNotificationsSection: React.FC<InvitationNotificationsSectionProps> = ({
  onNavigateToView,
  onUnreadCountChange,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = useParams();
  
  // Check if we're viewing a specific invitation
  const invitationId = params.section?.startsWith('invitation-') 
    ? params.section.replace('invitation-', '') 
    : null;

  const [notifications, setNotifications] = useState<InvitationNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<InvitationNotification | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch all invitation notifications
  const fetchNotifications = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { notifications: InvitationNotification[] };
        error?: string;
      }>('/api/client/invitation-notifications');

      if (!response.data.success) {
        console.error('Error fetching invitations:', response.data.error);
        return;
      }

      const fetchedNotifications = response.data.data?.notifications || [];
      setNotifications(fetchedNotifications);
      
      // Update unread count
      const unreadCount = fetchedNotifications.filter(n => n.status === 'unread').length;
      if (onUnreadCountChange) {
        onUnreadCountChange(unreadCount);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  // Fetch single notification
  const fetchNotificationDetail = useCallback(async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { notification: InvitationNotification };
        error?: string;
      }>(`/api/client/invitation-notifications/${id}`);

      if (response.data.success && response.data.data?.notification) {
        setSelectedNotification(response.data.data.notification);
        
        // Mark as read if unread
        if (response.data.data.notification.status === 'unread') {
          await markAsRead(id);
        }
      }
    } catch (error) {
      console.error('Error fetching invitation detail:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fetch detail if invitationId is present
  useEffect(() => {
    if (invitationId) {
      fetchNotificationDetail(invitationId);
    } else {
      setSelectedNotification(null);
    }
  }, [invitationId, fetchNotificationDetail]);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      await apiClient.patch(`/api/client/invitation-notifications/${id}/read`);
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, status: 'read' as const } : n)
      );
      
      // Update unread count
      const newUnreadCount = notifications.filter(n => n.id !== id && n.status === 'unread').length;
      if (onUnreadCountChange) {
        onUnreadCountChange(newUnreadCount);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Accept invitation
  const handleAccept = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    setActionLoading(id);
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/client/invitation-notifications/${id}/accept`);

      if (response.data.success) {
        toast({
          title: 'Connected!',
          description: response.data.message || 'You are now connected with the professional.',
          duration: 5000,
        });
        
        // Remove from list or navigate back
        setNotifications(prev => {
          const updatedNotifications = prev.filter(n => n.id !== id);
          // Update unread count after removing this notification
          const newUnreadCount = updatedNotifications.filter(n => n.status === 'unread').length;
          if (onUnreadCountChange) {
            onUnreadCountChange(newUnreadCount);
          }
          return updatedNotifications;
        });
        if (selectedNotification?.id === id) {
          if (onNavigateToView) {
            onNavigateToView('invitations');
          } else {
            navigate('/client/invitations');
          }
        }
      } else {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to accept invitation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Decline invitation
  const handleDecline = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    setActionLoading(id);
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/client/invitation-notifications/${id}/decline`);

      if (response.data.success) {
        toast({
          title: 'Declined',
          description: 'Invitation has been declined.',
          duration: 3000,
        });
        
        // Remove from list
        setNotifications(prev => {
          const updatedNotifications = prev.filter(n => n.id !== id);
          // Update unread count after removing this notification
          const newUnreadCount = updatedNotifications.filter(n => n.status === 'unread').length;
          if (onUnreadCountChange) {
            onUnreadCountChange(newUnreadCount);
          }
          return updatedNotifications;
        });
        if (selectedNotification?.id === id) {
          if (onNavigateToView) {
            onNavigateToView('invitations');
          } else {
            navigate('/client/invitations');
          }
        }
      } else {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to decline invitation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Dismiss notification (close icon click)
  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    await markAsRead(id);
    // Navigate to detail page if clicking on the notification
    if (!e) {
      if (onNavigateToView) {
        onNavigateToView(`invitation-${id}`);
      } else {
        navigate(`/client/invitation-${id}`);
      }
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
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Render detail view
  if (selectedNotification) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => {
            if (onNavigateToView) {
              onNavigateToView('invitations');
            } else {
              navigate('/client/invitations');
            }
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invitations
        </button>

        {/* Invitation Detail Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#CFAFA3]/20 to-[#E8D5D0]/20 p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              {selectedNotification.professional_avatar ? (
                <EncryptedImage
                  src={selectedNotification.professional_avatar}
                  alt={selectedNotification.professional_name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                  fallbackClassName="w-20 h-20 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-4 border-white shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-4 border-white shadow-md">
                  <User className="w-10 h-10 text-[#CFAFA3]" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedNotification.professional_name}
                </h2>
                {selectedNotification.professional_business_name && (
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Building2 className="w-4 h-4" />
                    <span>{selectedNotification.professional_business_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-[#CFAFA3]/5 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <UserPlus className="w-6 h-6 text-[#CFAFA3] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Connection Request
                  </h3>
                  <p className="text-gray-600">
                    <strong>{selectedNotification.professional_name}</strong> would like to add you as a client. 
                    By accepting, you'll be connected and can receive personalized skincare routines, 
                    product recommendations, and treatment plans.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
              <Clock className="w-4 h-4" />
              <span>Received {formatTimeAgo(selectedNotification.created_at)}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleAccept(selectedNotification.id)}
                disabled={actionLoading === selectedNotification.id}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#CFAFA3] text-white rounded-xl hover:bg-[#b89a8f] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedNotification.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Accept & Connect
                  </>
                )}
              </button>
              <button
                onClick={() => handleDecline(selectedNotification.id)}
                disabled={actionLoading === selectedNotification.id}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedNotification.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Decline
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserPlus className="w-6 h-6 text-[#CFAFA3]" />
          Connection Invitations
          {notifications.filter(n => n.status === 'unread').length > 0 && (
            <span className="ml-2 px-2.5 py-0.5 bg-[#CFAFA3] text-white text-sm font-semibold rounded-full">
              {notifications.filter(n => n.status === 'unread').length}
            </span>
          )}
        </h1>
        <p className="text-gray-500 mt-1">
          Professionals who want to connect with you
        </p>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {notifications.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                  notification.status === 'unread' ? 'bg-[#CFAFA3]/5' : ''
                }`}
                onClick={() => {
                  if (onNavigateToView) {
                    onNavigateToView(`invitation-${notification.id}`);
                  } else {
                    navigate(`/client/invitation-${notification.id}`);
                  }
                }}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 relative">
                  {notification.professional_avatar ? (
                    <EncryptedImage
                      src={notification.professional_avatar}
                      alt={notification.professional_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                      fallbackClassName="w-14 h-14 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-gray-100">
                      <User className="w-7 h-7 text-[#CFAFA3]" />
                    </div>
                  )}
                  {notification.status === 'unread' && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#CFAFA3] rounded-full border-2 border-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-base ${notification.status === 'unread' ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                    {notification.professional_name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    Wants to connect with you as a client
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAccept(notification.id);
                    }}
                    disabled={actionLoading === notification.id}
                    className="p-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#b89a8f] transition-colors disabled:opacity-50"
                    title="Accept"
                  >
                    {actionLoading === notification.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecline(notification.id);
                    }}
                    disabled={actionLoading === notification.id}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    title="Decline"
                  >
                    {actionLoading === notification.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No pending invitations
            </h3>
            <p className="text-gray-500">
              When skincare professionals invite you to connect, they'll appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationNotificationsSection;
