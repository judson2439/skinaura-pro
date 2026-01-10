import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import {
  Bell,
  CheckCheck,
  Search,
  Loader2,
  Inbox,
  Eye,
  User,
} from 'lucide-react';
import ProfessionalChatModal from '../modals/ProfessionalChatModal';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalGroup {
  professional_id: string;
  professional_name: string;
  professional_avatar: string | null;
  unread_count: number;
  total_count: number;
  last_message: string;
  last_message_time: string;
  last_sender_type: 'client' | 'professional';
}

interface NotificationsSectionProps {
  onNavigateToView?: (viewId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  onNavigateToView,
  onUnreadCountChange,
}) => {
  const [professionalGroups, setProfessionalGroups] = useState<ProfessionalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState<{
    id: string;
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Fetch all conversations grouped by professional
  const fetchConversations = useCallback(async (showLoading = true) => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    if (showLoading) {
      setLoading(true);
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { conversations: ProfessionalGroup[] };
        error?: string;
      }>('/api/client/conversations');

      if (!response.data.success) {
        console.error('Error fetching conversations:', response.data.error);
        return;
      }

      const conversations = response.data.data?.conversations || [];
      setProfessionalGroups(conversations);
      
      // Notify parent of unread count change
      const totalUnread = conversations.reduce((sum, g) => sum + g.unread_count, 0);
      if (onUnreadCountChange) {
        onUnreadCountChange(totalUnread);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [onUnreadCountChange]);

  // Initial fetch
  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  // Poll for new messages (replaces real-time subscription)
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const pollInterval = setInterval(() => {
      fetchConversations(false);
    }, 15000); // Poll every 15 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchConversations]);

  // Mark all as read
  const markAllAsRead = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        error?: string;
      }>('/api/client/notifications/mark-all-read');

      if (!response.data.success) {
        console.error('Error marking all as read:', response.data.error);
        return;
      }

      // Update local state
      setProfessionalGroups(prev =>
        prev.map(group => ({ ...group, unread_count: 0 }))
      );
      
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Handle opening chat modal
  const handleViewChat = (group: ProfessionalGroup) => {
    setSelectedProfessional({
      id: group.professional_id,
      name: group.professional_name,
      avatar_url: group.professional_avatar,
    });
    setIsChatModalOpen(true);
  };

  // Handle messages read callback
  const handleMessagesRead = () => {
    // Update the unread count for the selected professional
    if (selectedProfessional) {
      setProfessionalGroups(prev => {
        const updated = prev.map(group =>
          group.professional_id === selectedProfessional.id
            ? { ...group, unread_count: 0 }
            : group
        );
        const totalUnread = updated.reduce((sum, g) => sum + g.unread_count, 0);
        if (onUnreadCountChange) {
          onUnreadCountChange(totalUnread);
        }
        return updated;
      });
    }
  };

  // Handle chat modal close - refresh conversations
  const handleChatModalClose = () => {
    setIsChatModalOpen(false);
    setSelectedProfessional(null);
    // Refresh conversations to get updated last message
    fetchConversations(false);
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

  // Filter professional groups
  const filteredGroups = professionalGroups.filter(group => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        group.professional_name.toLowerCase().includes(query) ||
        group.last_message.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const totalUnreadCount = professionalGroups.reduce((sum, g) => sum + g.unread_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#CFAFA3]" />
            Notifications
            {totalUnreadCount > 0 && (
              <span className="ml-2 px-2.5 py-0.5 bg-red-500 text-white text-sm font-semibold rounded-full">
                {totalUnreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            View and manage conversations with your skincare professionals
          </p>
        </div>

        {totalUnreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#b89a8f] transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search professionals or messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CFAFA3]/20 focus:border-[#CFAFA3]"
          />
        </div>
      </div>

      {/* Professional Groups List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredGroups.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredGroups.map((group) => (
              <div
                key={group.professional_id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${
                  group.unread_count > 0 ? 'bg-[#CFAFA3]/5' : ''
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0 relative">
                  {group.professional_avatar ? (
                    <img
                      src={group.professional_avatar}
                      alt={group.professional_name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-gray-100">
                      <User className="w-7 h-7 text-[#CFAFA3]" />
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
                        {group.professional_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {group.last_sender_type === 'client' && (
                          <span className="text-gray-400">You: </span>
                        )}
                        {group.last_message}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-xs ${group.unread_count > 0 ? 'text-[#CFAFA3] font-medium' : 'text-gray-400'}`}>
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
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#b89a8f] transition-colors"
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
                : 'Messages from your skincare professionals will appear here'}
            </p>
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {selectedProfessional && (
        <ProfessionalChatModal
          isOpen={isChatModalOpen}
          onClose={handleChatModalClose}
          professional={selectedProfessional}
          onMessagesRead={handleMessagesRead}
        />
      )}
    </div>
  );
};

export default NotificationsSection;
