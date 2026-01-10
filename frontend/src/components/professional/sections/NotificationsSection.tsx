import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import {
  Bell,
  MessageSquare,
  CheckCheck,
  Search,
  Loader2,
  Inbox,
  Eye,
  User,
  RefreshCw,
} from 'lucide-react';
import ClientChatModal from '../modals/ClientChatModal';

// ============================================================================
// TYPES
// ============================================================================

interface ClientGroup {
  client_id: string;
  client_name: string;
  client_avatar: string | null;
  unread_count: number;
  total_count: number;
  last_message: string;
  last_message_time: string;
  last_sender_type: 'client' | 'professional';
}

interface NotificationsSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// Polling interval in milliseconds (5 seconds)
const POLLING_INTERVAL = 5000;

// ============================================================================
// COMPONENT
// ============================================================================

const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  onNavigateToView,
}) => {
  const { user } = useAuth();
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  
  // Ref to track if component is mounted (for polling cleanup)
  const isMountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Get auth token
  const getToken = useCallback(() => {
    const authSession = getAuthSession();
    return authSession?.token || getAuthToken();
  }, []);

  // Fetch all notifications grouped by client
  const fetchNotifications = useCallback(async (showLoading = true) => {
    const token = getToken();
    
    if (!user?.id || !token) {
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { groups: ClientGroup[] };
        error?: string;
      }>('/api/professional/notifications/grouped');

      if (!isMountedRef.current) return;

      if (response.data.success && response.data.data) {
        setClientGroups(response.data.data.groups || []);
      } else {
        console.error('Error fetching notifications:', response.data.error);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      if (isMountedRef.current && showLoading) {
        setLoading(false);
      }
    }
  }, [user?.id, getToken]);

  // Set up polling for real-time updates
  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Initial fetch with loading
    fetchNotifications(true);

    // Set up polling interval
    pollingRef.current = setInterval(() => {
      if (isMountedRef.current && !isChatModalOpen) {
        fetchNotifications(false);
      }
    }, POLLING_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user?.id, fetchNotifications, isChatModalOpen]);

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    const token = getToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        error?: string;
      }>('/api/professional/notifications/read-all', {});

      if (response.data.success) {
        // Update local state
        setClientGroups(prev =>
          prev.map(group => ({ ...group, unread_count: 0 }))
        );
      } else {
        console.error('Error marking all as read:', response.data.error);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Handle opening chat modal
  const handleViewChat = (group: ClientGroup) => {
    setSelectedClient({
      id: group.client_id,
      name: group.client_name,
      avatar_url: group.client_avatar,
    });
    setIsChatModalOpen(true);
  };

  // Handle messages read callback
  const handleMessagesRead = () => {
    // Update the unread count for the selected client
    if (selectedClient) {
      setClientGroups(prev =>
        prev.map(group =>
          group.client_id === selectedClient.id
            ? { ...group, unread_count: 0 }
            : group
        )
      );
    }
  };

  // Handle chat modal close
  const handleChatModalClose = () => {
    setIsChatModalOpen(false);
    setSelectedClient(null);
    // Refresh notifications after closing chat
    fetchNotifications(false);
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchNotifications(true);
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

  // Filter client groups
  const filteredGroups = clientGroups.filter(group => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        group.client_name.toLowerCase().includes(query) ||
        group.last_message.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const totalUnreadCount = clientGroups.reduce((sum, g) => sum + g.unread_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#5a4a3f]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#5a4a3f]" />
            Notifications
            {totalUnreadCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-sm font-semibold rounded-full">
                {totalUnreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            View and manage conversations with your clients
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {totalUnreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-[#5a4a3f] text-white rounded-lg hover:bg-[#4a3a2f] transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5a4a3f]/20 focus:border-[#5a4a3f]"
          />
        </div>
      </div>

      {/* Client Groups List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredGroups.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredGroups.map((group) => (
              <div
                key={group.client_id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  group.unread_count > 0 ? 'bg-[#CFAFA3]/5' : ''
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 relative">
                  {group.client_avatar ? (
                    <img
                      src={group.client_avatar}
                      alt={group.client_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-gray-100">
                      <User className="w-7 h-7 text-[#5a4a3f]" />
                    </div>
                  )}
                  {/* Unread Badge */}
                  {group.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                      {group.unread_count > 99 ? '99+' : group.unread_count}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-base ${group.unread_count > 0 ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                        {group.client_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {group.last_sender_type === 'professional' && (
                          <span className="text-gray-400">You: </span>
                        )}
                        {group.last_message}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-xs ${group.unread_count > 0 ? 'text-[#5a4a3f] font-medium' : 'text-gray-400'}`}>
                        {formatTimeAgo(group.last_message_time)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {group.total_count} message{group.total_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* View Button */}
                <button
                  onClick={() => handleViewChat(group)}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#5a4a3f] text-white rounded-lg hover:bg-[#4a3a2f] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? 'Try a different search term'
                : 'Messages from your clients will appear here'}
            </p>
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {selectedClient && (
        <ClientChatModal
          isOpen={isChatModalOpen}
          onClose={handleChatModalClose}
          client={selectedClient}
          onMessagesRead={handleMessagesRead}
        />
      )}
    </div>
  );
};

export default NotificationsSection;
