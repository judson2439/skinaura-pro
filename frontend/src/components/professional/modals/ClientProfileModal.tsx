import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Droplets,
  AlertCircle,
  Flame,
  Trophy,
  Medal,
  Crown,
  Check,
  Clock,
  Camera,
  Edit,
  Save,
  Loader2,
  Target,
  FileText,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Plus,
  Trash2,
  Sun,
  Moon,
  Package,
  ShoppingBag,
  Filter,
  ClipboardList,
  Flag,
  Play,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

export interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone?: string;
  skin_type?: string;
  concerns?: string[];
}

interface ClientStats {
  current_streak: number;
  longest_streak: number;
  points: number;
  level: string;
  total_routines_completed: number;
  compliance_rate: number;
}

interface AssignedRoutine {
  id: string;
  routine_id: string;
  routine_name: string;
  schedule_type: string;
  assigned_at: string;
  is_active: boolean;
  steps: {
    id: string;
    step_order: number;
    product_name: string;
    product_type: string | null;
    instructions: string | null;
  }[];
  professional_notes?: string | null;
}

interface ClientProduct {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  notes?: string;
  added_via: 'manual' | 'photo';
  days_used: number;
  created_at: string;
}

interface TreatmentPlan {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled' | 'draft';
  start_date: string;
  end_date: string;
  goals: string[];
  milestones: {
    id: string;
    title: string;
    description?: string;
    target_date: string;
    completed: boolean;
    completed_at?: string;
  }[];
  products: {
    id: string;
    product_name: string;
    product_brand?: string;
    product_category?: string;
    priority: 'essential' | 'recommended' | 'optional';
    usage_instructions?: string;
  }[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

interface PhotoRecord {
  id: string;
  photo_url: string;
  photo_type: string;
  title?: string;
  taken_at: string;
}

interface ClientProfileModalProps {
  client: ClientProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedClient: ClientProfile) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AWARD_LEVELS = [
  { name: 'Bronze', minPoints: 0, color: 'from-amber-600 to-amber-700', icon: Medal },
  { name: 'Silver', minPoints: 500, color: 'from-gray-400 to-gray-500', icon: Medal },
  { name: 'Gold', minPoints: 1500, color: 'from-yellow-400 to-amber-500', icon: Crown },
  { name: 'Platinum', minPoints: 3000, color: 'from-cyan-300 to-blue-400', icon: Crown },
  { name: 'Diamond', minPoints: 5000, color: 'from-purple-400 to-pink-500', icon: Trophy },
];

const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'];
const COMMON_CONCERNS = [
  'Acne', 'Hyperpigmentation', 'Dark spots', 'Fine lines', 'Wrinkles',
  'Dehydration', 'Redness', 'Texture', 'Large pores', 'Uneven tone',
  'Acne scars', 'Dullness', 'Sun damage', 'Melasma'
];

// ============================================================================
// COMPONENT
// ============================================================================

const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  client,
  isOpen,
  onClose,
  onUpdate
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'routines' | 'products' | 'treatment-plans' | 'photos' | 'notes'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<ClientProfile>(client);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);

  // API helper function using apiClient
  const apiRequest = async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    try {
      const authToken = getAuthToken();
      if (authToken) {
        apiClient.setAuthToken(authToken);
      }
      
      const method = (options.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      let response;
      
      if (method === 'GET') {
        response = await apiClient.get<{ success: boolean; data?: T; error?: string }>(endpoint);
      } else if (method === 'POST') {
        response = await apiClient.post<{ success: boolean; data?: T; error?: string }>(
          endpoint,
          options.body ? JSON.parse(options.body as string) : undefined
        );
      } else if (method === 'PUT') {
        response = await apiClient.put<{ success: boolean; data?: T; error?: string }>(
          endpoint,
          options.body ? JSON.parse(options.body as string) : undefined
        );
      } else if (method === 'PATCH') {
        response = await apiClient.patch<{ success: boolean; data?: T; error?: string }>(
          endpoint,
          options.body ? JSON.parse(options.body as string) : undefined
        );
      } else if (method === 'DELETE') {
        response = await apiClient.delete<{ success: boolean; data?: T; error?: string }>(endpoint);
      } else {
        throw new Error(`Unsupported method: ${method}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('API request error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  // Real data states
  const [clientStats, setClientStats] = useState<ClientStats>({
    current_streak: 0,
    longest_streak: 0,
    points: 0,
    level: 'Bronze',
    total_routines_completed: 0,
    compliance_rate: 0
  });
  const [assignedRoutines, setAssignedRoutines] = useState<AssignedRoutine[]>([]);
  const [clientProducts, setClientProducts] = useState<ClientProduct[]>([]);
  const [treatmentPlans, setTreatmentPlans] = useState<TreatmentPlan[]>([]);
  const [clientPhotos, setClientPhotos] = useState<PhotoRecord[]>([]);

  // Reset state when client changes
  useEffect(() => {
    setEditedClient(client);
    setActiveTab('overview');
    setIsEditing(false);
    setExpandedRoutine(null);
    setExpandedPlan(null);
    setProductCategoryFilter('all');
    setEditingNoteId(null);
    setEditingNoteContent('');
  }, [client.id]);

  // Fetch all client data from database
  useEffect(() => {
    if (isOpen && client.id) {
      fetchClientData();
    }
  }, [isOpen, client.id]);

  const fetchClientData = async () => {
    setLoadingData(true);
    try {
      const result = await apiRequest<{
        stats: ClientStats;
        treatmentPlans: TreatmentPlan[];
        assignedRoutines: AssignedRoutine[];
        products: ClientProduct[];
        photos: PhotoRecord[];
        notes: Note[];
      }>(`/api/professional/clients/${client.id}/profile`);

      if (result.success && result.data) {
        setClientStats(result.data.stats);
        setTreatmentPlans(result.data.treatmentPlans || []);
        setAssignedRoutines(result.data.assignedRoutines || []);
        setClientProducts(result.data.products || []);
        setClientPhotos(result.data.photos || []);
        setNotes(result.data.notes || []);
      } else {
        console.error('Error fetching client data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Get current level info
  const getCurrentLevel = (points: number) => {
    for (let i = AWARD_LEVELS.length - 1; i >= 0; i--) {
      if (points >= AWARD_LEVELS[i].minPoints) {
        return { current: AWARD_LEVELS[i], next: AWARD_LEVELS[i + 1] || null };
      }
    }
    return { current: AWARD_LEVELS[0], next: AWARD_LEVELS[1] };
  };

  // Get schedule icon
  const getScheduleIcon = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning': return Sun;
      case 'evening': return Moon;
      default: return Clock;
    }
  };

  // Get schedule label
  const getScheduleLabel = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning': return 'Morning';
      case 'evening': return 'Evening';
      case 'daily': return 'Daily';
      default: return scheduleType;
    }
  };

  // Treatment plan helpers
  const getStatusColor = (status: TreatmentPlan['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'paused': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'essential': return 'bg-red-100 text-red-700 border-red-200';
      case 'recommended': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'optional': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getPlanProgress = (plan: TreatmentPlan) => {
    const totalMilestones = plan.milestones.length;
    const completedMilestones = plan.milestones.filter(m => m.completed).length;
    const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
    const endDate = new Date(plan.end_date);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    return { totalMilestones, completedMilestones, overallProgress, daysRemaining };
  };

  // Handle save client
  const handleSaveClient = async () => {
    setSaving(true);
    try {
      const result = await apiRequest(`/api/professional/clients/${client.id}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editedClient.full_name,
          phone: editedClient.phone,
          skin_type: editedClient.skin_type,
          concerns: editedClient.concerns,
        }),
      });

      if (!result.success) {
        console.error('Error updating client:', result.error);
        return;
      }

      if (onUpdate) {
        onUpdate(editedClient);
      }
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Handle add note (CREATE)
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const result = await apiRequest<{ note: Note }>(
        `/api/professional/clients/${client.id}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ content: newNote.trim() }),
        }
      );

      if (!result.success || !result.data?.note) {
        console.error('Error adding note:', result.error);
        return;
      }

      const note: Note = {
        id: result.data.note.id,
        content: result.data.note.content,
        created_at: result.data.note.created_at,
        updated_at: result.data.note.updated_at || undefined,
      };
      setNotes([note, ...notes]);
      setNewNote('');
    } finally {
      setAddingNote(false);
    }
  };

  // Handle update note (UPDATE)
  const handleUpdateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    setSavingNote(true);
    try {
      const result = await apiRequest<{ note: Note }>(
        `/api/professional/clients/${client.id}/notes/${noteId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: editingNoteContent.trim() }),
        }
      );

      if (!result.success || !result.data?.note) {
        console.error('Error updating note:', result.error);
        return;
      }

      setNotes(notes.map(n => 
        n.id === noteId 
          ? { ...n, content: result.data!.note.content, updated_at: result.data!.note.updated_at }
          : n
      ));
      setEditingNoteId(null);
      setEditingNoteContent('');
    } finally {
      setSavingNote(false);
    }
  };

  // Handle delete note (DELETE)
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      const result = await apiRequest(
        `/api/professional/clients/${client.id}/notes/${noteId}`,
        { method: 'DELETE' }
      );

      if (!result.success) {
        console.error('Error deleting note:', result.error);
        return;
      }

      setNotes(notes.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error in handleDeleteNote:', error);
    }
  };

  // Start editing a note
  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  // Cancel editing
  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  // Filter products
  const filteredProducts = productCategoryFilter === 'all'
    ? clientProducts
    : clientProducts.filter(p => p.category === productCategoryFilter);

  const productCategories = [...new Set(clientProducts.map(p => p.category).filter(Boolean))];

  if (!isOpen) return null;

  const levelInfo = getCurrentLevel(clientStats.points);
  const activePlans = treatmentPlans.filter(p => p.status === 'active');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              {client.avatar_url ? (
                <EncryptedImage
                  src={client.avatar_url}
                  alt={client.full_name || 'Client'}
                  className="w-16 h-16 rounded-xl object-cover"                  
                  fallbackClassName="w-16 h-16 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                  <User className="w-8 h-8 text-[#2D2A3E]" />
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${levelInfo.current.color} flex items-center justify-center`}>
                <levelInfo.current.icon className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-gray-900">
                {client.full_name || 'Unknown Client'}
              </h2>
              <p className="text-sm text-gray-500">{client.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${levelInfo.current.color} text-white`}>
                  {clientStats.level}
                </span>
                <span className="text-xs text-gray-400">{clientStats.points.toLocaleString()} points</span>
                <span className="text-xs text-gray-400">• {assignedRoutines.length} routines</span>
                <span className="text-xs text-gray-400">• {clientProducts.length} products</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
            ) : (
              <button
                onClick={handleSaveClient}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl hover:bg-[#B89A8E] transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'routines', label: 'Routines', icon: Clock, count: assignedRoutines.length },
            { id: 'products', label: 'Products', icon: ShoppingBag, count: clientProducts.length },
            { id: 'treatment-plans', label: 'Treatment Plans', icon: ClipboardList, count: treatmentPlans.length },
            { id: 'photos', label: 'Photos', icon: Camera, count: clientPhotos.length },
            { id: 'notes', label: 'Notes', icon: FileText, count: notes.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#CFAFA3] text-[#CFAFA3]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Client Info Section */}
                  <div className="bg-gray-50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-[#CFAFA3]" />
                        Client Information
                      </h3>
                    </div>
                    
                    {isEditing ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-500 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={editedClient.full_name || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-500 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={editedClient.phone || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-500 mb-1">Skin Type</label>
                          <select
                            value={editedClient.skin_type || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, skin_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                          >
                            <option value="">Select skin type...</option>
                            {SKIN_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-500 mb-1">Concerns</label>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {COMMON_CONCERNS.map(concern => (
                              <button
                                key={concern}
                                type="button"
                                onClick={() => {
                                  const concerns = editedClient.concerns || [];
                                  if (concerns.includes(concern)) {
                                    setEditedClient({ ...editedClient, concerns: concerns.filter(c => c !== concern) });
                                  } else {
                                    setEditedClient({ ...editedClient, concerns: [...concerns, concern] });
                                  }
                                }}
                                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                  (editedClient.concerns || []).includes(concern)
                                    ? 'bg-[#CFAFA3] text-white'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                              >
                                {concern}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-[#CFAFA3]">{client.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm font-medium text-gray-900">{client.phone || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Droplets className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Skin Type</p>
                            <p className="text-sm font-medium text-gray-900">{client.skin_type || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Concerns</p>
                            {client.concerns && client.concerns.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {client.concerns.map((concern, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-[#CFAFA3]/10 text-[#CFAFA3] text-xs rounded-full">
                                    {concern}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-gray-900">None specified</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats Section */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Flame className="w-4 h-4 text-orange-500" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{clientStats.current_streak}</p>
                      <p className="text-xs text-orange-500">Current Streak</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Trophy className="w-4 h-4 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{clientStats.longest_streak}</p>
                      <p className="text-xs text-purple-600">Longest Streak</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{clientStats.total_routines_completed}</p>
                      <p className="text-xs text-green-600">Routines Done</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-[#CFAFA3]/20 flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-[#CFAFA3]" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{clientStats.compliance_rate}%</p>
                      <p className="text-xs text-[#CFAFA3]">Compliance</p>
                    </div>
                  </div>

                  {/* Level Progress */}
                  <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-xl p-5 text-white">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${levelInfo.current.color} flex items-center justify-center`}>
                        <levelInfo.current.icon className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <p className="text-[#CFAFA3] text-sm">Current Level</p>
                        <h3 className="text-2xl font-bold">{clientStats.level}</h3>
                        <p className="text-[#CFAFA3] text-sm">{clientStats.points.toLocaleString()} points</p>
                      </div>
                    </div>
                    {levelInfo.next ? (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-[#CFAFA3]">Progress to {levelInfo.next.name}</span>
                          <span className="text-[#CFAFA3]">{(levelInfo.next.minPoints - clientStats.points).toLocaleString()} pts to go</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, ((clientStats.points - levelInfo.current.minPoints) / (levelInfo.next.minPoints - levelInfo.current.minPoints)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[#CFAFA3] text-sm">Max level reached!</p>
                    )}
                  </div>

                  {/* Treatment Plans Summary */}
                  {activePlans.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-[#CFAFA3]" />
                          Active Treatment Plans
                        </h3>
                        <span className="px-2 py-0.5 bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs font-medium rounded-full">
                          {activePlans.length} active
                        </span>
                      </div>
                      <div className="space-y-3">
                        {activePlans.slice(0, 2).map(plan => {
                          const progress = getPlanProgress(plan);
                          return (
                            <div key={plan.id} className="bg-white rounded-lg p-4 border border-gray-100">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-medium text-gray-900 text-sm">{plan.title}</h4>
                                  <p className="text-xs text-gray-500">{progress.daysRemaining} days remaining</p>
                                </div>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(plan.status)}`}>
                                  {plan.status}
                                </span>
                              </div>
                              <div className="mt-3">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500">Progress</span>
                                  <span className="font-medium text-[#CFAFA3]">{progress.overallProgress}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] rounded-full transition-all duration-500"
                                    style={{ width: `${progress.overallProgress}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setActiveTab('treatment-plans')}
                        className="mt-3 w-full py-2 text-sm text-[#CFAFA3] hover:text-[#B89A8E] font-medium flex items-center justify-center gap-1"
                      >
                        View all treatment plans
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* No Treatment Plans */}
                  {activePlans.length === 0 && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-[#CFAFA3]" />
                          Active Treatment Plans
                        </h3>
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs font-medium rounded-full">
                          0 active
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 text-center py-4">No active treatment plans for this client</p>
                    </div>
                  )}

                  {/* Routine Summary */}
                  {assignedRoutines.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#CFAFA3]" />
                          Assigned Routines
                        </h3>
                        <span className="px-2 py-0.5 bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs font-medium rounded-full">
                          {assignedRoutines.length} active
                        </span>
                      </div>
                      <div className="space-y-3">
                        {assignedRoutines.slice(0, 3).map(routine => {
                          const ScheduleIcon = getScheduleIcon(routine.schedule_type);
                          return (
                            <div key={routine.id} className="bg-white rounded-lg p-4 border border-gray-100">
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  routine.schedule_type === 'morning' ? 'bg-amber-100' :
                                  routine.schedule_type === 'evening' ? 'bg-indigo-100' :
                                  'bg-[#CFAFA3]/20'
                                }`}>
                                  <ScheduleIcon className={`w-4 h-4 ${
                                    routine.schedule_type === 'morning' ? 'text-amber-600' :
                                    routine.schedule_type === 'evening' ? 'text-indigo-600' :
                                    'text-[#CFAFA3]'
                                  }`} />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900 text-sm">{routine.routine_name}</h4>
                                  <p className="text-xs text-gray-500">{routine.steps.length} steps</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setActiveTab('routines')}
                        className="mt-3 w-full py-2 text-sm text-[#CFAFA3] hover:text-[#B89A8E] font-medium flex items-center justify-center gap-1"
                      >
                        View all routines
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* No Routines */}
                  {assignedRoutines.length === 0 && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#CFAFA3]" />
                          Assigned Routines
                        </h3>
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs font-medium rounded-full">
                          0 active
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 text-center py-4">No routines assigned to this client</p>
                    </div>
                  )}
                </div>
              )}

              {/* Routines Tab */}
              {activeTab === 'routines' && (
                <div className="space-y-4">
                  {assignedRoutines.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Routines Assigned</h3>
                      <p className="text-gray-500 text-sm">Assign a routine to this client to track their progress</p>
                    </div>
                  ) : (
                    assignedRoutines.map(routine => {
                      const ScheduleIcon = getScheduleIcon(routine.schedule_type);
                      const isExpanded = expandedRoutine === routine.id;
                      
                      return (
                        <div key={routine.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                          <div 
                            className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedRoutine(isExpanded ? null : routine.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                  routine.schedule_type === 'morning' ? 'bg-amber-100' :
                                  routine.schedule_type === 'evening' ? 'bg-indigo-100' :
                                  'bg-[#CFAFA3]/20'
                                }`}>
                                  <ScheduleIcon className={`w-5 h-5 ${
                                    routine.schedule_type === 'morning' ? 'text-amber-600' :
                                    routine.schedule_type === 'evening' ? 'text-indigo-600' :
                                    'text-[#CFAFA3]'
                                  }`} />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">{routine.routine_name}</h4>
                                  <p className="text-sm text-gray-500">{getScheduleLabel(routine.schedule_type)} Routine • {routine.steps.length} steps</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  routine.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {routine.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50 p-5">
                              {routine.professional_notes && (
                                <div className="mb-4 p-3 bg-[#CFAFA3]/10 rounded-lg border border-[#CFAFA3]/20">
                                  <p className="text-xs text-[#CFAFA3] font-medium mb-1">Professional Notes</p>
                                  <p className="text-sm text-gray-700">{routine.professional_notes}</p>
                                </div>
                              )}
                              
                              <h5 className="text-sm font-medium text-gray-700 mb-3">Routine Steps</h5>
                              <div className="space-y-2">
                                {routine.steps.map((step) => (
                                  <div key={step.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
                                    <div className="w-6 h-6 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                                      {step.step_order}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 text-sm">{step.product_name}</span>
                                        {step.product_type && (
                                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                            {step.product_type}
                                          </span>
                                        )}
                                      </div>
                                      {step.instructions && (
                                        <p className="text-xs text-gray-500 mt-1">{step.instructions}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Products Tab */}
              {activeTab === 'products' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Client's Products</h3>
                      <p className="text-sm text-gray-500">Products this client is currently using</p>
                    </div>
                    {productCategories.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#CFAFA3] outline-none"
                        >
                          <option value="all">All Categories</option>
                          {productCategories.map(cat => (
                            <option key={cat} value={cat!}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {clientProducts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl">
                      <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Products Added</h3>
                      <p className="text-gray-500 text-sm">This client hasn't added any products yet</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredProducts.map((product) => (
                        <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                          <div className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                            {product.image_url ? (
                              <EncryptedImage
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                fallbackClassName="w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center"
                              />
                            ) : (
                              <Package className="w-12 h-12 text-gray-300" />
                            )}
                            <div className="absolute top-3 left-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                product.added_via === 'photo' ? 'bg-purple-100 text-purple-700' : 'bg-[#CFAFA3]/20 text-[#CFAFA3]'
                              }`}>
                                {product.added_via === 'photo' ? 'Photo' : 'Manual'}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            {product.brand && (
                              <p className="text-xs text-[#CFAFA3] font-medium mb-1">{product.brand}</p>
                            )}
                            <h4 className="font-medium text-gray-900 line-clamp-1 mb-1">{product.name}</h4>
                            {product.category && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                                {product.category}
                              </span>
                            )}
                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                              <span className="text-xs text-gray-400">
                                {new Date(product.created_at).toLocaleDateString()}
                              </span>
                              {product.days_used > 0 && (
                                <span className="text-xs text-[#CFAFA3]">{product.days_used} days used</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Treatment Plans Tab */}
              {activeTab === 'treatment-plans' && (
                <div className="space-y-6">
                  {treatmentPlans.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl">
                      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Treatment Plans</h3>
                      <p className="text-gray-500 text-sm">Create a treatment plan for this client</p>
                    </div>
                  ) : (
                    <>
                      {activePlans.length > 0 && (
                        <div>
                          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                            <Play className="w-5 h-5 text-green-600" />
                            Active Plans ({activePlans.length})
                          </h3>
                          <div className="space-y-4">
                            {activePlans.map((plan) => {
                              const progress = getPlanProgress(plan);
                              const isExpanded = expandedPlan === plan.id;

                              return (
                                <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                  <div
                                    onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="flex items-start justify-between mb-4">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <h4 className="font-serif font-bold text-lg text-gray-900">{plan.title}</h4>
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                                            Active
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                          {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>

                                    <div className="grid grid-cols-4 gap-4 mb-4">
                                      <div className="text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center mb-1">
                                          <span className="text-lg font-bold text-white">{progress.overallProgress}%</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Overall</p>
                                      </div>
                                      <div className="text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 flex items-center justify-center mb-1">
                                          <span className="text-lg font-bold text-purple-600">{progress.completedMilestones}/{progress.totalMilestones}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Milestones</p>
                                      </div>
                                      <div className="text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-1">
                                          <span className="text-lg font-bold text-blue-600">{plan.products.length}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Products</p>
                                      </div>
                                      <div className="text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-1">
                                          <span className="text-lg font-bold text-amber-600">{progress.daysRemaining}</span>
                                        </div>
                                        <p className="text-xs text-gray-500">Days Left</p>
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-500">Progress</span>
                                        <span className="font-medium text-[#CFAFA3]">{progress.overallProgress}%</span>
                                      </div>
                                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] rounded-full transition-all duration-500"
                                          style={{ width: `${progress.overallProgress}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="border-t border-gray-100 p-6 space-y-6 bg-gray-50/50">
                                      {plan.description && (
                                        <p className="text-gray-600">{plan.description}</p>
                                      )}

                                      {plan.goals.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                            <Target className="w-4 h-4 text-[#CFAFA3]" /> Goals
                                          </h5>
                                          <div className="flex flex-wrap gap-2">
                                            {plan.goals.map((goal, idx) => (
                                              <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#CFAFA3] rounded-full text-sm border border-[#CFAFA3]/20">
                                                <Target className="w-3 h-3" />
                                                {goal}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {plan.milestones.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                                            <Flag className="w-4 h-4 text-[#CFAFA3]" /> Milestones
                                          </h5>
                                          <div className="space-y-2">
                                            {plan.milestones.map((milestone) => (
                                              <div
                                                key={milestone.id}
                                                className={`flex items-center gap-3 p-4 rounded-xl border ${
                                                  milestone.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
                                                }`}
                                              >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                  milestone.completed ? 'bg-green-500 text-white' : 'border-2 border-gray-300'
                                                }`}>
                                                  {milestone.completed && <Check className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1">
                                                  <p className={`font-medium ${milestone.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                                    {milestone.title}
                                                  </p>
                                                </div>
                                                <span className="text-sm text-gray-500">
                                                  {new Date(milestone.target_date).toLocaleDateString()}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {plan.products.length > 0 && (
                                        <div>
                                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                                            <Package className="w-4 h-4 text-[#CFAFA3]" /> Recommended Products
                                          </h5>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {plan.products.map((product) => (
                                              <div key={product.id} className={`p-4 rounded-xl border ${getPriorityColor(product.priority)}`}>
                                                <div className="flex items-start justify-between mb-2">
                                                  <div>
                                                    <p className="font-medium text-gray-900">{product.product_name}</p>
                                                    {product.product_brand && (
                                                      <p className="text-xs text-gray-500">{product.product_brand}</p>
                                                    )}
                                                  </div>
                                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                                    product.priority === 'essential' ? 'bg-red-200 text-red-800' :
                                                    product.priority === 'recommended' ? 'bg-blue-200 text-blue-800' :
                                                    'bg-gray-200 text-gray-700'
                                                  }`}>
                                                    {product.priority}
                                                  </span>
                                                </div>
                                                {product.usage_instructions && (
                                                  <p className="text-sm text-gray-600">{product.usage_instructions}</p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {plan.notes && (
                                        <div className="p-4 bg-[#CFAFA3]/5 rounded-xl border border-[#CFAFA3]/20">
                                          <h5 className="text-sm font-medium text-gray-700 mb-2">Professional Notes</h5>
                                          <p className="text-sm text-gray-600">{plan.notes}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Photos Tab */}
              {activeTab === 'photos' && (
                <div className="space-y-4">
                  {clientPhotos.length === 0 ? (
                    <div className="text-center py-12">
                      <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Progress Photos</h3>
                      <p className="text-gray-500 text-sm">Client hasn't uploaded any progress photos yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {clientPhotos.map(photo => (
                        <div 
                          key={photo.id} 
                          className="relative group rounded-xl overflow-hidden aspect-square bg-gray-100 cursor-pointer"
                          onClick={() => setSelectedPhoto(photo)}
                        >
                          <EncryptedImage
                            src={photo.photo_url}
                            alt={photo.title || 'Progress photo'}
                            className="w-full h-full object-cover"
                            fallbackClassName="w-full h-full bg-gray-100 flex items-center justify-center"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                photo.photo_type === 'before' ? 'bg-blue-500 text-white' :
                                photo.photo_type === 'after' ? 'bg-green-500 text-white' :
                                'bg-purple-500 text-white'
                              }`}>
                                {photo.photo_type}
                              </span>
                              <p className="text-white text-xs mt-1">
                                {new Date(photo.taken_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  {/* Add Note Form */}
                  <div className="bg-gray-50 rounded-xl p-5">
                    <h4 className="font-medium text-gray-900 mb-3">Add Private Note</h4>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none mb-3"
                      rows={3}
                      placeholder="Add a private note about this client..."
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote || !newNote.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors disabled:opacity-50"
                    >
                      {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add Note
                    </button>
                  </div>

                  {/* Notes List */}
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Notes Yet</h3>
                      <p className="text-gray-500 text-sm">Add your first note about this client</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => (
                        <div key={note.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                          {editingNoteId === note.id ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <textarea
                                value={editingNoteContent}
                                onChange={(e) => setEditingNoteContent(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
                                rows={4}
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUpdateNote(note.id)}
                                  disabled={savingNote || !editingNoteContent.trim()}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors disabled:opacity-50"
                                >
                                  {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditingNote}
                                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              <div className="flex items-start justify-between mb-2">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  Note
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startEditingNote(note)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                    title="Edit note"
                                  >
                                    <Edit className="w-4 h-4 text-gray-400 hover:text-[#CFAFA3]" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                    title="Delete note"
                                  >
                                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-400">
                                  Created: {new Date(note.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {note.updated_at && note.updated_at !== note.created_at && (
                                  <p className="text-xs text-gray-400">
                                    • Updated: {new Date(note.updated_at).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="max-w-4xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <EncryptedImage
                src={selectedPhoto.photo_url}
                alt={selectedPhoto.title || 'Progress photo'}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                fallbackClassName="w-full h-96 bg-gray-800 flex items-center justify-center rounded-lg"
              />
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-lg">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedPhoto.photo_type === 'before' ? 'bg-blue-500 text-white' :
                    selectedPhoto.photo_type === 'after' ? 'bg-green-500 text-white' :
                    'bg-purple-500 text-white'
                  }`}>
                    {selectedPhoto.photo_type.charAt(0).toUpperCase() + selectedPhoto.photo_type.slice(1)}
                  </span>
                  <span className="text-white/80 text-sm">
                    {new Date(selectedPhoto.taken_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                {selectedPhoto.title && (
                  <p className="text-white mt-2">{selectedPhoto.title}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfileModal;
