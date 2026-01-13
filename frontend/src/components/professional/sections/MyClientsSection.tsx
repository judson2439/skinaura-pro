import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Users,
  UserPlus,
  Flame,
  Check,
  Clock,
  Eye,
  MessageSquare,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import ClientProfileModal, { ClientProfile } from '@/components/professional/modals/ClientProfileModal';
import AddClientModal from '@/components/professional/modals/AddClientModal';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken, getAuthSession } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

interface Client {
  id: string;
  name: string;
  email: string;
  image: string;
  phone?: string;
  skinType: string;
  concerns: string[];
  currentStreak: number;
  points: number;
  level: string;
  compliance: number;
  routineCompletedToday: boolean;
  isRealClient: boolean;
}

interface MyClientsSectionProps {
  onOpenAddClientModal?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MyClientsSection: React.FC<MyClientsSectionProps> = () => {
  // Auth session is managed by authStorage
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  
  // SMS Modal state
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [selectedClientForSMS, setSelectedClientForSMS] = useState<Client | null>(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);

  // Fetch clients from backend API
  const fetchClients = async () => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      apiClient.setAuthToken(token);
      
      // Use the dashboard endpoint which returns all client data with gamification and compliance
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          clients: Array<{
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
          }>;
          stats: {
            totalClients: number;
            completedToday: number;
            needAttention: number;
            avgCompliance: number;
          };
        };
        error?: string;
      }>('/api/professional/dashboard');

      if (response.data.success && response.data.data) {
        const dashboardClients = response.data.data.clients || [];

        // Map dashboard clients to Client interface
        const mappedClients: Client[] = dashboardClients.map(client => ({
          id: client.id,
          name: client.name,
          email: client.email,
          image: client.image,
          phone: client.phone,
          skinType: client.skinType || 'Unknown',
          concerns: client.concerns || [],
          currentStreak: client.currentStreak,
          points: 0, // Dashboard doesn't return points, calculate level instead
          level: client.level,
          compliance: client.compliance,
          routineCompletedToday: client.routineCompletedToday,
          isRealClient: client.isRegistered,
        }));

        setClients(mappedClients);
      } else {
        console.error('Error fetching clients:', response.data.error);
        setError(response.data.error || 'Failed to load clients');
      }
    } catch (err: any) {
      console.error('Error fetching clients:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  // Filter clients based on search
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.skinType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.concerns.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleViewProfile = (client: Client) => {
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
    setShowProfileModal(true);
  };

  const handleCloseProfileModal = () => {
    setShowProfileModal(false);
    setSelectedClient(null);
  };

  const openSMSModal = (client: Client) => {
    setSelectedClientForSMS(client);
    // Don't include "Hi [name]" as the edge function adds that prefix
    setSmsMessage(`This is a friendly reminder to complete your skincare routine today! Your skin will thank you.`);
    setShowSMSModal(true);
  };

  const closeSMSModal = () => {
    setShowSMSModal(false);
    setSelectedClientForSMS(null);
    setSmsMessage('');
  };

  const sendSMSReminder = async () => {
    if (!selectedClientForSMS || !smsMessage.trim()) return;
    
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) {
      toast({
        title: 'Authentication Error',
        description: 'Please log in again.',
        variant: 'destructive',
      });
      return;
    }

    setSendingSMS(true);
    try {
      const clientFirstName = selectedClientForSMS.name.split(' ')[0];
      
      apiClient.setAuthToken(token);
      
      // Call the backend SMS endpoint
      const response = await apiClient.post<{
        success: boolean;
        message?: string;
        data?: { messageSid: string };
        error?: string;
      }>('/api/professional/sms/send', {
        clientId: selectedClientForSMS.id,
        phone: selectedClientForSMS.phone,
        message: smsMessage,
        clientName: clientFirstName,
      });

      if (!response.data.success) {
        console.error('Error sending SMS:', response.data.error);
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
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSendingSMS(false);
    }
  };


  const handleOpenAddClientModal = () => {
    setShowAddClientModal(true);
  };

  const handleCloseAddClientModal = () => {
    setShowAddClientModal(false);
  };

  const handleClientAdded = () => {
    // Refresh the client list from database
    fetchClients();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3] mx-auto mb-4" />
          <p className="text-gray-500">Loading clients...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
        <p className="text-red-600 text-center">{error}</p>
        <button
          onClick={fetchClients}
          className="mt-4 mx-auto block px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1"
          />
        </div>
        <button
          onClick={handleOpenAddClientModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors"
        >
          <Plus className="w-5 h-5" /> Add Client
        </button>
      </div>

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Clients Found</h3>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'Try a different search term' : 'Add your first client to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenAddClientModal}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <UserPlus className="w-5 h-5" /> Add Your First Client
            </button>
          )}
        </div>
      )}

      {/* Clients Grid */}
      {filteredClients.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className={`bg-white rounded-2xl p-6 border shadow-sm ${
                client.isRealClient ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              {client.isRealClient && (
                <div className="flex items-center gap-1 mb-3">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    Registered Client
                  </span>
                </div>
              )}
              <div className="flex items-start gap-4 mb-4">
                <EncryptedImage
                  src={client.image}
                  alt={client.name}
                  className="w-16 h-16 rounded-xl object-cover"
                  fallbackClassName="w-16 h-16 rounded-xl"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-lg">{client.name}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.level === 'Platinum'
                          ? 'bg-cyan-100 text-cyan-700'
                          : client.level === 'Gold'
                          ? 'bg-yellow-100 text-yellow-700'
                          : client.level === 'Silver'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {client.level}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{client.skinType} Skin</p>
                  <p className="text-xs text-gray-400">{client.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {client.concerns.slice(0, 3).map((concern, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-[#CFAFA3]/10 text-[#CFAFA3] text-xs rounded-full"
                      >
                        {concern}
                      </span>
                    ))}
                    {client.concerns.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        +{client.concerns.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-orange-500 mb-1">
                    <Flame className="w-4 h-4" />
                    <span className="font-bold">{client.currentStreak}</span>
                  </div>
                  <p className="text-xs text-gray-500">Streak</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="font-bold text-[#CFAFA3] mb-1">{client.points}</p>
                  <p className="text-xs text-gray-500">Points</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p
                    className={`font-bold mb-1 ${
                      client.compliance >= 80
                        ? 'text-green-600'
                        : client.compliance >= 60
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  >
                    {client.compliance}%
                  </p>
                  <p className="text-xs text-gray-500">Compliance</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Today's Routine</p>
                  {client.routineCompletedToday ? (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" /> Completed
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Pending
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewProfile(client)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Profile"
                  >
                    <Eye className="w-4 h-4 text-gray-400 hover:text-[#CFAFA3]" />
                  </button>
                  {client.phone && (
                    <button
                      onClick={() => openSMSModal(client)}
                      className="p-2 bg-[#CFAFA3] text-white rounded-lg hover:bg-[#B89A8E] transition-colors"
                      title="Send SMS Reminder"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client Profile Modal */}
      {selectedClient && (
        <ClientProfileModal
          client={selectedClient}
          isOpen={showProfileModal}
          onClose={handleCloseProfileModal}
          onUpdate={(updatedClient) => {
            console.log('Client updated:', updatedClient);
            handleCloseProfileModal();
            // Refresh the client list to show updated data
            fetchClients();
          }}
        />
      )}

      {/* Add Client Modal */}
      <AddClientModal
        isOpen={showAddClientModal}
        onClose={handleCloseAddClientModal}
        onClientAdded={handleClientAdded}
      />

      {/* SMS Modal */}
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
              <EncryptedImage
                src={selectedClientForSMS.image}
                alt={selectedClientForSMS.name}
                className="w-12 h-12 rounded-full object-cover"
                fallbackClassName="w-12 h-12 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
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

export default MyClientsSection;
