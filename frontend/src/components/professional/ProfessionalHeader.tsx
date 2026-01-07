import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import {
  Menu,
  X,
  Bell,
  ChevronDown,
  User,
  LogOut,
  AlertCircle,
  TrendingUp,
  UserPlus,
  MessageSquare,
  Check,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalHeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  title: string;
  subtitle?: string;
  userDisplayName: string;
  userEmail: string;
  userAvatar?: string;
  onNavigateToView?: (viewId: string) => void;
}

interface RoutineNote {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  read_status: boolean;
  client_deleted: boolean;
  professional_deleted: boolean;
  created_at: string;
  client_name?: string;
  client_avatar?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProfessionalHeader: React.FC<ProfessionalHeaderProps> = ({
  sidebarOpen,
  toggleSidebar,
  title,
  subtitle,
  userDisplayName,
  userEmail,
  userAvatar,
  onNavigateToView,
}) => {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadNotes, setUnreadNotes] = useState<RoutineNote[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Use profile avatar if available
  const avatarUrl = profile?.avatar_url || userAvatar || null;

  // Fetch unread notes from routine_notes table (only client messages)
  const fetchUnreadNotes = async () => {
    if (!user?.id) return;

    try {
      // Fetch notes where professional_id matches current user, read_status is false, sender_type is client, and not deleted
      const { data: notes, error } = await supabase
        .from('routine_notes')
        .select('*')
        .eq('professional_id', user.id)
        .eq('read_status', false)
        .eq('professional_deleted', false)
        .or('sender_type.eq.client,sender_type.is.null')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching routine notes:', error);
        return;
      }

      if (notes && notes.length > 0) {
        // Get unique client IDs
        const clientIds = [...new Set(notes.map(note => note.client_id))];
        
        // Fetch client profiles
        const { data: clientProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', clientIds);

        if (profileError) {
          console.error('Error fetching client profiles:', profileError);
        }

        // Map client info to notes
        const notesWithClientInfo = notes.map(note => {
          const clientProfile = clientProfiles?.find(p => p.id === note.client_id);
          return {
            ...note,
            client_name: clientProfile?.full_name || 'Unknown Client',
            client_avatar: clientProfile?.avatar_url || null,
          };
        });

        setUnreadNotes(notesWithClientInfo);
        setUnreadCount(notesWithClientInfo.length);
      } else {
        setUnreadNotes([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread notes:', error);
    }
  };


  // Mark a note as read
  const markNoteAsRead = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('routine_notes')
        .update({ read_status: true })
        .eq('id', noteId);

      if (error) {
        console.error('Error marking note as read:', error);
        return;
      }

      // Update local state
      setUnreadNotes(prev => prev.filter(note => note.id !== noteId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking note as read:', error);
    }
  };

  // Mark all notes as read
  const markAllAsRead = async () => {
    if (unreadNotes.length === 0) return;

    try {
      const noteIds = unreadNotes.map(note => note.id);
      
      const { error } = await supabase
        .from('routine_notes')
        .update({ read_status: true })
        .in('id', noteIds);

      if (error) {
        console.error('Error marking all notes as read:', error);
        return;
      }

      setUnreadNotes([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notes as read:', error);
    }
  };

  // Set up real-time subscription for INSERT events
  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch
    fetchUnreadNotes();

    // Subscribe to real-time INSERT events on routine_notes table
    const channel = supabase
      .channel('routine_notes_inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'routine_notes',
          filter: `professional_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New note received:', payload);
          
          // Get the new note data
          const newNote = payload.new as any;
          
          // Only process if it's from a client (sender_type is 'client' or null), unread, and not deleted
          const isClientMessage = newNote.sender_type === 'client' || !newNote.sender_type;
          if (isClientMessage && newNote.read_status === false && newNote.professional_deleted === false) {
            // Fetch client info for the new note
            try {
              const { data: clientProfile, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, avatar_url')
                .eq('id', newNote.client_id)
                .single();

              if (!error && clientProfile) {
                const noteWithClientInfo: RoutineNote = {
                  ...newNote,
                  client_name: clientProfile.full_name || 'Unknown Client',
                  client_avatar: clientProfile.avatar_url || undefined,
                };

                // Add new note to the beginning of the list
                setUnreadNotes(prev => [noteWithClientInfo, ...prev]);
                setUnreadCount(prev => prev + 1);
              } else {
                // If we can't get client info, still add the note
                const noteWithDefaultInfo: RoutineNote = {
                  ...newNote,
                  client_name: 'Unknown Client',
                  client_avatar: undefined,
                };
                setUnreadNotes(prev => [noteWithDefaultInfo, ...prev]);
                setUnreadCount(prev => prev + 1);
              }
            } catch (error) {
              console.error('Error fetching client info for new note:', error);
              // Still add the note even if we can't get client info
              const noteWithDefaultInfo: RoutineNote = {
                ...newNote,
                client_name: 'Unknown Client',
                client_avatar: undefined,
              };
              setUnreadNotes(prev => [noteWithDefaultInfo, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          }
        }

      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);


  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

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
      navigate('/professional/profile');
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
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#5a4a3f] hover:text-[#3d3229] font-medium flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {/* Notes List - Show only first 3 */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {unreadNotes.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {unreadNotes.slice(0, 3).map((note) => (
                          <div
                            key={note.id}
                            className="flex gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => markNoteAsRead(note.id)}
                          >
                            <div className="flex-shrink-0">
                              {note.client_avatar ? (
                                <img
                                  src={note.client_avatar}
                                  alt={note.client_name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center">
                                  <MessageSquare className="w-5 h-5 text-[#5a4a3f]" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                New note from {note.client_name}
                              </p>
                              <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                                {note.content}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTimeAgo(note.created_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markNoteAsRead(note.id);
                              }}
                              className="flex-shrink-0 p-1 hover:bg-gray-200 rounded-full transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <Bell className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500">No new notifications</p>
                        <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                      </div>
                    )}
                  </div>

                  {/* View All Button - Show if more than 3 unread notifications */}
                  {unreadNotes.length > 3 && (
                    <div className="border-t border-gray-100 p-3">
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          if (onNavigateToView) {
                            onNavigateToView('notifications');
                          }
                        }}
                        className="w-full py-2 text-sm font-medium text-[#5a4a3f] hover:text-[#4a3a2f] hover:bg-[#CFAFA3]/10 rounded-lg transition-colors"
                      >
                        View all {unreadNotes.length} notifications
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
              <EncryptedImage
                src={avatarUrl}
                alt={userDisplayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-gray-100"
                fallbackClassName="w-9 h-9 rounded-full border-2 border-gray-100"
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

export default ProfessionalHeader;
