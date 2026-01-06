import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
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

interface RoutineNote {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  sender_type: 'client' | 'professional';
  read_status: boolean;
  client_deleted: boolean;
  professional_deleted: boolean;
  created_at: string;
}

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
  const { user } = useAuth();
  const [professionalGroups, setProfessionalGroups] = useState<ProfessionalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState<{
    id: string;
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Fetch all notifications and group by professional
  const fetchNotifications = async (showLoading = true) => {
    if (!user?.id) return;

    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch all notes for this client
      const { data: notes, error } = await supabase
        .from('routine_notes')
        .select('*')
        .eq('client_id', user.id)
        .eq('client_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (notes && notes.length > 0) {
        // Get unique professional IDs
        const professionalIds = [...new Set(notes.map(note => note.professional_id))];

        // Fetch professional profiles
        const { data: professionalProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', professionalIds);

        if (profileError) {
          console.error('Error fetching professional profiles:', profileError);
        }

        // Group notes by professional
        const groupedByProfessional: { [professionalId: string]: RoutineNote[] } = {};
        notes.forEach(note => {
          if (!groupedByProfessional[note.professional_id]) {
            groupedByProfessional[note.professional_id] = [];
          }
          groupedByProfessional[note.professional_id].push(note);
        });

        // Create professional groups with stats
        const groups: ProfessionalGroup[] = Object.entries(groupedByProfessional).map(([professionalId, professionalNotes]) => {
          const professionalProfile = professionalProfiles?.find(p => p.id === professionalId);
          const unreadCount = professionalNotes.filter(
            n => !n.read_status && n.sender_type === 'professional'
          ).length;
          const lastNote = professionalNotes[0]; // Already sorted by created_at desc

          return {
            professional_id: professionalId,
            professional_name: professionalProfile?.full_name || 'Your Professional',
            professional_avatar: professionalProfile?.avatar_url || null,
            unread_count: unreadCount,
            total_count: professionalNotes.length,
            last_message: lastNote.content,
            last_message_time: lastNote.created_at,
            last_sender_type: lastNote.sender_type || 'professional',
          };
        });

        // Sort by unread count (desc) then by last message time (desc)
        groups.sort((a, b) => {
          if (b.unread_count !== a.unread_count) {
            return b.unread_count - a.unread_count;
          }
          return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
        });

        setProfessionalGroups(groups);
        
        // Notify parent of unread count change
        const totalUnread = groups.reduce((sum, g) => sum + g.unread_count, 0);
        if (onUnreadCountChange) {
          onUnreadCountChange(totalUnread);
        }
      } else {
        setProfessionalGroups([]);
        if (onUnreadCountChange) {
          onUnreadCountChange(0);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };


  // Set up real-time subscription for INSERT events
  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch with loading
    fetchNotifications(true);

    // Subscribe to real-time INSERT events on routine_notes table
    const channel = supabase
      .channel('client_notifications_section_inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'routine_notes',
          filter: `client_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New notification received:', payload);
          // Refetch to update groups WITHOUT showing loading spinner
          fetchNotifications(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);


  // Mark all as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('routine_notes')
        .update({ read_status: true })
        .eq('client_id', user.id)
        .eq('sender_type', 'professional')
        .eq('read_status', false);

      if (error) {
        console.error('Error marking all as read:', error);
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
          onClose={() => {
            setIsChatModalOpen(false);
            setSelectedProfessional(null);
          }}
          professional={selectedProfessional}
          onMessagesRead={handleMessagesRead}
        />
      )}
    </div>
  );
};

export default NotificationsSection;
