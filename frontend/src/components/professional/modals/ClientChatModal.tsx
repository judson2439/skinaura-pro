import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageSquare, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  sender_type: 'client' | 'professional';
  read_status: boolean;
  created_at: string;
}

interface ClientInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ClientChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientInfo;
  onMessagesRead: () => void;
}

const ClientChatModal: React.FC<ClientChatModalProps> = ({
  isOpen,
  onClose,
  client,
  onMessagesRead,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch chat history
  const fetchMessages = async () => {
    if (!user?.id || !client.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('routine_notes')
        .select('*')
        .eq('client_id', client.id)
        .eq('professional_id', user.id)
        .or('client_deleted.eq.false,client_deleted.is.null')
        .or('professional_deleted.eq.false,professional_deleted.is.null')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark all unread messages from this client as read
  const markMessagesAsRead = async () => {
    if (!user?.id || !client.id) return;

    try {
      const { error } = await supabase
        .from('routine_notes')
        .update({ read_status: true })
        .eq('client_id', client.id)
        .eq('professional_id', user.id)
        .eq('sender_type', 'client')
        .eq('read_status', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        return;
      }

      // Update local state
      setMessages(prev =>
        prev.map(msg =>
          msg.sender_type === 'client' ? { ...msg, read_status: true } : msg
        )
      );

      // Notify parent component
      onMessagesRead();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !user?.id || !client.id) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('routine_notes')
        .insert({
          client_id: client.id,
          professional_id: user.id,
          content: newMessage.trim(),
          sender_type: 'professional',
          read_status: false,
          client_deleted: false,
          professional_deleted: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error',
          description: 'Failed to send message. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Add the new message to the list
      setMessages(prev => [...prev, data]);
      setNewMessage('');

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent to the client.',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format date header
  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';

    messages.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  // Effects
  useEffect(() => {
    if (isOpen && client.id) {
      fetchMessages();
    }
  }, [isOpen, client.id]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
      // Mark messages as read when modal opens
      markMessagesAsRead();
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!isOpen || !user?.id || !client.id) return;

    const channel = supabase
      .channel(`chat_${client.id}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'routine_notes',
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.professional_id === user.id) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            
            // If it's from client, mark as read immediately
            if (newMsg.sender_type === 'client') {
              supabase
                .from('routine_notes')
                .update({ read_status: true })
                .eq('id', newMsg.id)
                .then(() => {
                  onMessagesRead();
                });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, user?.id, client.id]);

  if (!isOpen) return null;

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 h-[80vh] max-h-[700px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#5a4a3f]/5 to-[#CFAFA3]/10">
          <div className="flex items-center gap-3">
            {client.avatar_url ? (
              <img
                src={client.avatar_url}
                alt={client.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-white shadow-md">
                <User className="w-6 h-6 text-[#5a4a3f]" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
              <p className="text-sm text-gray-500">Chat History</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#5a4a3f]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No messages yet</h3>
              <p className="text-gray-500 text-sm">
                Start a conversation with {client.name}
              </p>
            </div>
          ) : (
            <>
              {messageGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Date Header */}
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 bg-white rounded-full text-xs text-gray-500 shadow-sm border border-gray-100">
                      {formatDateHeader(group.date)}
                    </div>
                  </div>

                  {/* Messages */}
                  {group.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex mb-3 ${
                        msg.sender_type === 'professional' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[75%] ${
                          msg.sender_type === 'professional'
                            ? 'order-1'
                            : 'order-2'
                        }`}
                      >
                        {/* Avatar for client messages */}
                        {msg.sender_type === 'client' && (
                          <div className="flex items-end gap-2">
                            {client.avatar_url ? (
                              <img
                                src={client.avatar_url}
                                alt={client.name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-[#5a4a3f]" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <div className="px-4 py-2.5 bg-white rounded-2xl rounded-bl-md shadow-sm border border-gray-100">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400 mt-1 ml-1">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Professional messages */}
                        {msg.sender_type === 'professional' && (
                          <div className="flex flex-col items-end">
                            <div className="px-4 py-2.5 bg-[#5a4a3f] text-white rounded-2xl rounded-br-md shadow-sm">
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 mt-1 mr-1">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, 1000))}
                placeholder="Type your message..."
                rows={1}
                maxLength={1000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5a4a3f]/20 focus:border-[#5a4a3f] resize-none transition-all text-gray-900 placeholder:text-gray-400 pr-12"
                style={{
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
                disabled={sending}
              />
              <span className="absolute right-3 bottom-1 text-xs text-gray-400">
                {newMessage.length}/1000
              </span>
            </div>
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex-shrink-0 w-12 h-12 bg-[#5a4a3f] text-white rounded-xl hover:bg-[#4a3a2f] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default ClientChatModal;
