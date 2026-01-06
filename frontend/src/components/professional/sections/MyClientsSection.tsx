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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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

interface UserGamification {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
}

interface RoutineCompletion {
  client_id: string;
  completion_date: string;
  routine_type: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate level based on points
const calculateLevel = (points: number): string => {
  if (points >= 5000) return 'Diamond';
  if (points >= 3000) return 'Platinum';
  if (points >= 1500) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
};

// Calculate compliance percentage based on routine completions
const calculateCompliance = (
  completions: RoutineCompletion[],
  clientId: string,
  daysToCheck: number = 30
): number => {
  const clientCompletions = completions.filter(c => c.client_id === clientId);
  
  // Get unique completion dates for this client
  const uniqueDates = new Set(clientCompletions.map(c => c.completion_date));
  
  // Calculate compliance as percentage of days with at least one completion
  const compliance = Math.round((uniqueDates.size / daysToCheck) * 100);
  return Math.min(compliance, 100); // Cap at 100%
};

// Check if routine was completed today
const checkCompletedToday = (
  completions: RoutineCompletion[],
  clientId: string
): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return completions.some(c => c.client_id === clientId && c.completion_date === today);
};

// ============================================================================
// COMPONENT
// ============================================================================

const MyClientsSection: React.FC<MyClientsSectionProps> = () => {
  const { user, profile } = useAuth();
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

  // Fetch clients from database
  const fetchClients = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Get all client_ids from client_professional_relationships
      // where professional_id matches the current signed-in professional
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('client_professional_relationships')
        .select('client_id')
        .eq('professional_id', user.id);

      if (relationshipsError) {
        console.error('Error fetching relationships:', relationshipsError);
        setError('Failed to load client relationships');
        setLoading(false);
        return;
      }

      // Extract client IDs from relationships
      const clientIds = relationshipsData?.map(r => r.client_id) || [];

      if (clientIds.length === 0) {
        // No clients found for this professional
        setClients([]);
        setLoading(false);
        return;
      }

      // Step 2: Get client details from user_profiles using the client_ids
      const { data: clientsData, error: clientsError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', clientIds);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        setError('Failed to load client details');
        setLoading(false);
        return;
      }

      // Step 3: Get gamification data for all clients
      const { data: gamificationData, error: gamificationError } = await supabase
        .from('user_gamification')
        .select('user_id, current_streak, longest_streak, points, total_routines_completed, level, last_completion_date')
        .in('user_id', clientIds);

      if (gamificationError) {
        console.error('Error fetching gamification data:', gamificationError);
        // Continue without gamification data - use defaults
      }

      // Step 4: Get routine completions for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const { data: completionsData, error: completionsError } = await supabase
        .from('routine_completions')
        .select('client_id, completion_date, routine_type')
        .in('client_id', clientIds)
        .gte('completion_date', thirtyDaysAgoStr);

      if (completionsError) {
        console.error('Error fetching completions:', completionsError);
        // Continue without completions data - use defaults
      }

      // Create lookup maps
      const gamificationMap = new Map<string, UserGamification>();
      (gamificationData || []).forEach((g: UserGamification) => {
        gamificationMap.set(g.user_id, g);
      });

      const completions: RoutineCompletion[] = (completionsData || []).map(c => ({
        client_id: c.client_id,
        completion_date: c.completion_date,
        routine_type: c.routine_type,
      }));

      // Step 5: Map database data to Client interface with real data
      const mappedClients: Client[] = (clientsData || []).map(clientData => {
        const gamification = gamificationMap.get(clientData.id);
        const compliance = calculateCompliance(completions, clientData.id);
        const completedToday = checkCompletedToday(completions, clientData.id);
        
        // Get real values from gamification data or use defaults
        const points = gamification?.points || 0;
        const streak = gamification?.current_streak || 0;
        const level = gamification?.level || calculateLevel(points);
        
        return {
          id: clientData.id,
          name: clientData.full_name || 'Unknown',
          email: clientData.email || '',
          image: clientData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientData.full_name || 'U')}&background=CFAFA3&color=fff`,
          phone: clientData.phone || undefined,
          skinType: clientData.skin_type || 'Unknown',
          concerns: clientData.concerns || [],
          currentStreak: streak,
          points: points,
          level: level,
          compliance: compliance,
          routineCompletedToday: completedToday,
          isRealClient: true,
        };
      });

      setClients(mappedClients);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };


  // Fetch clients on mount and when user changes
  useEffect(() => {
    fetchClients();
  }, [user?.id]);

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
    
    setSendingSMS(true);
    try {
      // Get the professional's name from profile
      const professionalName = profile?.full_name || 'Your Skincare Professional';
      const clientFirstName = selectedClientForSMS.name.split(' ')[0];
      
      // Call the send-sms-reminder edge function
      const { data, error } = await supabase.functions.invoke('send-sms-reminder', {
        body: {
          to: selectedClientForSMS.phone,
          message: smsMessage,
          clientName: clientFirstName,
          professionalName: professionalName,
        },
      });

      if (error) {
        console.error('Error sending SMS:', error);
        toast({
          title: 'Failed to send SMS',
          description: error.message || 'An error occurred while sending the SMS reminder.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.error) {
        console.error('SMS API error:', data.error);
        toast({
          title: 'Failed to send SMS',
          description: data.error,
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
                <img
                  src={client.image}
                  alt={client.name}
                  className="w-16 h-16 rounded-xl object-cover"
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
              <img
                src={selectedClientForSMS.image}
                alt={selectedClientForSMS.name}
                className="w-12 h-12 rounded-full object-cover"
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
