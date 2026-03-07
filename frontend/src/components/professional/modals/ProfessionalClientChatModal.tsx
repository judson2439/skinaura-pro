import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, MessageSquare, User } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import EncryptedImage from '@/components/ui/encrypted-image';

interface NoteMessage {
  id: string;
  content: string;
  created_at: string;
  sender_type?: 'client' | 'professional' | null;
}

interface ProfessionalClientChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string | null;
  clientName: string;
  clientAvatarUrl: string | null;
}

const ProfessionalClientChatModal: React.FC<ProfessionalClientChatModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  clientAvatarUrl,
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<NoteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    const token = getAuthToken();
    if (!token || !clientId) return;

    setLoading(true);
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.get<{
        success: boolean;
        data?: { notes: NoteMessage[] };
        error?: string;
      }>(`/api/professional/clients/${clientId}/notes`);

      if (!response.data.success) {
        console.error('Error fetching notes:', response.data.error);
        return;
      }
      setMessages(response.data.data?.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAuthToken();
    if (!newMessage.trim() || !token || !clientId) return;

    setSending(true);
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.post<{
        success: boolean;
        data?: { note: NoteMessage };
        error?: string;
      }>(`/api/professional/clients/${clientId}/notes`, {
        content: newMessage.trim(),
      });

      if (!response.data.success) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to send message.',
          variant: 'destructive',
        });
        return;
      }
      if (response.data.data?.note) {
        setMessages(prev => [...prev, { ...response.data!.note!, sender_type: 'professional' }]);
      }
      setNewMessage('');
      scrollToBottom();
      toast({ title: 'Message sent', description: 'Your message has been sent.' });
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const groupMessagesByDate = (list: NoteMessage[]) => {
    const groups: { date: string; messages: NoteMessage[] }[] = [];
    let currentDate = '';
    list.forEach(msg => {
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

  useEffect(() => {
    if (isOpen && clientId) {
      fetchMessages();
    } else {
      setMessages([]);
      setNewMessage('');
    }
  }, [isOpen, clientId, fetchMessages]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, messages.length]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 h-[80vh] max-h-[700px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#CFAFA3]/5 to-[#CFAFA3]/10">
          <div className="flex items-center gap-3">
            {clientAvatarUrl ? (
              <EncryptedImage
                src={clientAvatarUrl}
                alt={clientName}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                fallbackClassName="w-12 h-12 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-white shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center border-2 border-white shadow-md">
                <User className="w-6 h-6 text-[#CFAFA3]" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{clientName}</h2>
              <p className="text-sm text-gray-500">Notes & messages</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No messages yet</h3>
              <p className="text-gray-500 text-sm">Start a conversation with {clientName}</p>
            </div>
          ) : (
            <>
              {messageGroups.map((group, groupIndex) => (
                <div key={groupIndex}>
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 bg-white rounded-full text-xs text-gray-500 shadow-sm border border-gray-100">
                      {formatDateHeader(group.date)}
                    </div>
                  </div>
                  {group.messages.map(msg => {
                    const sender = (msg.sender_type ?? 'professional').toString().toLowerCase();
                    const isProfessional = sender === 'professional';
                    return (
                      <div
                        key={msg.id}
                        className={`flex mb-3 ${isProfessional ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${isProfessional ? 'order-1' : 'order-2'}`}>
                          {isProfessional ? (
                            <div className="flex flex-col items-end">
                              <div className="px-4 py-2.5 bg-[#CFAFA3] text-white rounded-2xl rounded-br-md shadow-sm">
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                              </div>
                              <span className="text-xs text-gray-400 mt-1 mr-1">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-end gap-2">
                              {clientAvatarUrl ? (
                                <EncryptedImage
                                  src={clientAvatarUrl}
                                  alt={clientName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  fallbackClassName="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center flex-shrink-0">
                                  <User className="w-4 h-4 text-[#CFAFA3]" />
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
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
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3]/20 focus:border-[#CFAFA3] resize-none transition-all text-gray-900 placeholder:text-gray-400 pr-12"
                style={{ minHeight: '48px', maxHeight: '120px' }}
                disabled={sending}
              />
              <span className="absolute right-3 bottom-1 text-xs text-gray-400">
                {newMessage.length}/1000
              </span>
            </div>
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex-shrink-0 w-12 h-12 bg-[#CFAFA3] text-white rounded-xl hover:bg-[#b89a8f] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
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

export default ProfessionalClientChatModal;
