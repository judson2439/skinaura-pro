import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Check,
  AlertCircle,
  TrendingUp,
  Flame,
  X,
  Eye,
  Phone,
  MessageSquare,
  Loader2,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/apiClient';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { EncryptedImage } from '@/components/ui/encrypted-image';

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

interface ProfessionalDashboardSectionProps {
  onNavigateToView?: (viewId: string) => void;
  onOpenClientProfile?: (client: Client) => void;
  onOpenSMSModal?: (client: Client) => void;
}

interface DashboardStats {
  totalClients: number;
  completedToday: number;
  needAttention: number;
  avgCompliance: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProfessionalDashboardSection: React.FC<ProfessionalDashboardSectionProps> = ({
  onNavigateToView,
  onOpenClientProfile,
  onOpenSMSModal,
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [allDisplayClients, setAllDisplayClients] = useState<Client[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalClients: 0,
    completedToday: 0,
    needAttention: 0,
    avgCompliance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // SMS Modal state
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [selectedClientForSMS, setSelectedClientForSMS] = useState<Client | null>(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);

  // Fetch dashboard data from backend API
  const fetchDashboardData = useCallback(async () => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Set auth token for API client
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          clients: Client[];
          stats: DashboardStats;
        };
        error?: string;
      }>('/api/professional/dashboard');

      if (response.data.success && response.data.data) {
        setAllDisplayClients(response.data.data.clients);
        setDashboardStats(response.data.data.stats);
      } else {
        console.error('Error fetching dashboard:', response.data.error);
        setError(response.data.error || 'Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Use stats from backend or calculate from clients as fallback
  const totalClients = dashboardStats.totalClients || allDisplayClients.length;
  const registeredClients = allDisplayClients.filter(c => c.isRegistered);
  const completedToday = dashboardStats.completedToday;
  const needAttention = dashboardStats.needAttention;
  const avgCompliance = dashboardStats.avgCompliance;

  const setActiveView = (viewId: string) => {
    if (onNavigateToView) {
      onNavigateToView(viewId);
    }
  };

  const openSMSModal = (client: Client) => {
    if (onOpenSMSModal) {
      onOpenSMSModal(client);
    } else {
      // Fallback to internal modal
      setSelectedClientForSMS(client);
      // Don't include "Hi [name]" as the edge function adds that prefix
      setSmsMessage(`This is a friendly reminder to complete your skincare routine today! Your skin will thank you.`);
      setShowSMSModal(true);
    }
  };

  const closeSMSModal = () => {
    setShowSMSModal(false);
    setSelectedClientForSMS(null);
    setSmsMessage('');
  };

  const sendSMSReminder = async () => {
    if (!selectedClientForSMS || !smsMessage.trim()) return;
    
    setSendingSMS(true);
    try {
      const authSession = getAuthSession();
      const token = authSession?.token || getAuthToken();
      
      if (!token) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to send SMS reminders.',
          variant: 'destructive',
        });
        return;
      }

      // Set auth token for API client
      apiClient.setAuthToken(token);
      
      const clientFirstName = selectedClientForSMS.name.split(' ')[0];
      
      // Call the backend SMS endpoint
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        error?: string;
      }>('/api/professional/sms/send', {
        clientId: selectedClientForSMS.id,
        phone: selectedClientForSMS.phone,
        message: smsMessage,
        clientName: clientFirstName,
      });

      if (!response.data.success) {
        console.error('SMS API error:', response.data.error);
        toast({
          title: 'Failed to send SMS',
          description: response.data.error || 'An error occurred while sending the SMS reminder.',
          variant: 'destructive',
        });
        return;
      }

      // Success
      toast({
        title: 'SMS Sent Successfully',
        description: `Reminder sent to ${selectedClientForSMS.name}`,
      });
      
      closeSMSModal();
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      toast({
        title: 'Failed to send SMS',
        description: error.data?.error || error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSendingSMS(false);
    }
  };

  const openClientProfile = (client: Client) => {
    if (onOpenClientProfile) {
      onOpenClientProfile(client);
    }
  };


  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          <span className="ml-3 text-gray-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
          <div className="flex items-center gap-3 text-red-600">
            <AlertCircle className="w-6 h-6" />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#CFAFA3]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            {registeredClients.length > 0 && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                {registeredClients.length} registered
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalClients}</p>
          <p className="text-sm text-gray-500">Total Clients</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
          <p className="text-sm text-gray-500">Completed Today</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{needAttention}</p>
          <p className="text-sm text-gray-500">Need Attention</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgCompliance}%</p>
          <p className="text-sm text-gray-500">Avg Compliance</p>
        </div>
      </div>

      {/* Clients Needing Attention */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-serif font-bold text-lg mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Clients Needing Attention
        </h3>
        <div className="space-y-3">
          {allDisplayClients
            .filter(c => !c.routineCompletedToday || c.compliance < 70)
            .slice(0, 5)
            .map((client) => (
              <div
                key={client.id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  client.isRegistered
                    ? 'bg-green-50/50 border-green-200'
                    : 'bg-red-50 border-red-100'
                }`}
              >
                <EncryptedImage
                  src={client.image}
                  alt={client.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                  fallbackClassName="w-12 h-12 rounded-full border-2 border-white shadow-sm"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{client.name}</p>
                    {client.isRegistered && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Registered
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {!client.routineCompletedToday
                      ? "Hasn't completed today's routine"
                      : `${client.compliance}% compliance`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      client.currentStreak === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {client.currentStreak} day streak
                  </span>
                  {client.phone && (
                    <button
                      onClick={() => openSMSModal(client)}
                      className="p-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#B89A8E] transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          {allDisplayClients.filter(c => !c.routineCompletedToday || c.compliance < 70).length === 0 && (
            <p className="text-center text-gray-500 py-4">All clients are on track!</p>
          )}
        </div>
      </div>

      {/* All Clients Overview */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-lg">All Clients</h3>
          <button
            onClick={() => setActiveView('clients')}
            className="text-sm text-[#CFAFA3] hover:underline"
          >
            View All
          </button>
        </div>
        
        {allDisplayClients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No clients yet</p>
            <p className="text-sm text-gray-400">Add clients to see them here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Streak</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Level</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Compliance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Today</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {allDisplayClients.slice(0, 8).map((client) => (
                  <tr
                    key={client.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${
                      client.isRegistered ? 'bg-green-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <EncryptedImage
                          src={client.image}
                          alt={client.name}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          fallbackClassName="w-8 h-8 rounded-full border border-gray-200"
                        />
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {client.isRegistered ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Registered
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
                          Demo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-orange-500">
                        <Flame className="w-4 h-4" />
                        <span className="font-medium">{client.currentStreak}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          client.level === 'Diamond'
                            ? 'bg-cyan-100 text-cyan-700'
                            : client.level === 'Platinum'
                            ? 'bg-slate-200 text-slate-700'
                            : client.level === 'Gold'
                            ? 'bg-yellow-100 text-yellow-700'
                            : client.level === 'Silver'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {client.level}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              client.compliance >= 80
                                ? 'bg-green-500'
                                : client.compliance >= 60
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${client.compliance}%` }}
                          />
                        </div>
                        <span className="text-sm">{client.compliance}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {client.routineCompletedToday ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Check className="w-4 h-4" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500">
                          <X className="w-4 h-4" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openClientProfile(client)}
                          className="p-2 hover:bg-[#CFAFA3]/10 rounded-lg transition-colors"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4 text-[#CFAFA3]" />
                        </button>
                        {client.phone && (
                          <button
                            onClick={() => openSMSModal(client)}
                            className="p-2 hover:bg-[#CFAFA3]/10 rounded-lg transition-colors"
                            title="Send SMS Reminder"
                          >
                            <Phone className="w-4 h-4 text-[#CFAFA3]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SMS Modal (fallback if not using parent modal) */}
      {showSMSModal && selectedClientForSMS && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif font-bold">Send SMS Reminder</h3>
              <button
                onClick={closeSMSModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <img
                src={selectedClientForSMS.image}
                alt={selectedClientForSMS.name}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedClientForSMS.name)}&background=CFAFA3&color=fff`;
                }}
              />
              <div>
                <p className="font-medium">{selectedClientForSMS.name}</p>
                <p className="text-sm text-gray-500">{selectedClientForSMS.phone}</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
                rows={4}
                placeholder="Enter your message..."
              />
              <p className="text-xs text-gray-400 mt-1">{smsMessage.length} characters</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeSMSModal}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendSMSReminder}
                disabled={sendingSMS || !smsMessage.trim()}
                className="flex-1 py-3 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {sendingSMS ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send SMS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalDashboardSection;
