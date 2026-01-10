import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sun,
  Moon,
  Check,
  ShoppingCart,
  Package,
  Loader2,
  Calendar,
  RefreshCw,
  ClipboardList,
  User,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { CustomSelect } from '@/components/ui/custom-select';
import SendNoteModal from '@/components/client/modals/SendNoteModal';




// ============================================================================
// DATABASE TYPES
// ============================================================================

interface DBClientRoutineAssignment {
  id: string;
  routine_id: string;
  client_id: string;
  professional_id: string;
  is_active: boolean;
  assigned_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DBRoutineTemplate {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DBRoutineStep {
  id: string;
  routine_id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  duration_seconds: number | null;
  product_category: string | null;
  product_recommendation: string | null;
  tips: string | null;
  is_optional: boolean;
  created_at: string;
}

interface DBUserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface DBRoutineStepProduct {
  id: string;
  routine_step_id: string;
  product_id: string;
  quantity?: number;
  notes?: string | null;
  created_at?: string;
}

interface DBProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  purchase_url: string | null;
}

interface DBRoutineStepCompletion {
  id: string;
  client_id: string;
  routine_step_id: string;
  completion_date: string;
  created_at: string;
}

// ============================================================================
// FRONTEND TYPES
// ============================================================================

interface StepProduct {
  id: string;
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  purchaseUrl: string | null;
}

interface RoutineStep {
  id: string;
  step: number;
  product: string;
  productImage: string;
  notes: string;
  completed: boolean;
  daysUsed: number;
  tips?: string;
  isOptional?: boolean;
  productCategory?: string;
  products: StepProduct[]; // Products associated with this step
}

interface Routine {
  id: string;
  name: string;
  description: string;
  scheduleType: string;
  scheduleDays: string[];
  steps: RoutineStep[];
  professionalId: string;
  assignedAt: string;
}

interface Professional {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface GroupedRoutines {
  professional: Professional;
  routines: Routine[];
}

// Schedule type configuration
interface ScheduleTypeConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  gradientClass: string;
  iconColorClass: string;
}

const SCHEDULE_TYPE_CONFIG: Record<string, ScheduleTypeConfig> = {
  morning: {
    key: 'morning',
    label: 'Morning Routine',
    icon: <Sun className="w-5 h-5" />,
    gradientClass: 'bg-gradient-to-r from-amber-400 to-orange-400',
    iconColorClass: 'text-amber-600',
  },
  evening: {
    key: 'evening',
    label: 'Evening Routine',
    icon: <Moon className="w-5 h-5" />,
    gradientClass: 'bg-gradient-to-r from-indigo-500 to-purple-500',
    iconColorClass: 'text-indigo-600',
  },
  weekly: {
    key: 'weekly',
    label: 'Weekly Routine',
    icon: <Calendar className="w-5 h-5" />,
    gradientClass: 'bg-gradient-to-r from-purple-500 to-pink-500',
    iconColorClass: 'text-purple-600',
  },
  custom: {
    key: 'custom',
    label: 'Custom Routine',
    icon: <Settings className="w-5 h-5" />,
    gradientClass: 'bg-gradient-to-r from-teal-500 to-cyan-500',
    iconColorClass: 'text-teal-600',
  },
  daily: {
    key: 'daily',
    label: 'Daily Routine',
    icon: <RefreshCw className="w-5 h-5" />,
    gradientClass: 'bg-gradient-to-r from-green-500 to-emerald-500',
    iconColorClass: 'text-green-600',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getScheduleIcon = (scheduleType: string) => {
  const config = SCHEDULE_TYPE_CONFIG[scheduleType];
  if (config) {
    return React.cloneElement(config.icon as React.ReactElement, {
      className: `w-5 h-5 ${config.iconColorClass}`,
    });
  }
  return <ClipboardList className="w-5 h-5 text-gray-600" />;
};

const getScheduleLabel = (scheduleType: string) => {
  const config = SCHEDULE_TYPE_CONFIG[scheduleType];
  return config ? config.label : `${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Routine`;
};

// Get today's date in YYYY-MM-DD format (local timezone)
const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================================
// COMPONENT
// ============================================================================

const MyRoutineSection: React.FC = () => {
  const { toast } = useToast();
  
  // Get auth token for API calls
  const authToken = getAuthToken();

  // Data state
  const [groupedRoutines, setGroupedRoutines] = useState<GroupedRoutines[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('all');
  const [selectedScheduleType, setSelectedScheduleType] = useState<string>('all');

  // Completion state - tracks step IDs that are completed today
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  // Track completion record IDs for deletion
  const [completionRecordIds, setCompletionRecordIds] = useState<Map<string, string>>(new Map());
  // Loading state for toggling
  const [togglingStepId, setTogglingStepId] = useState<string | null>(null);

  // Send Note Modal state
  const [isSendNoteModalOpen, setIsSendNoteModalOpen] = useState(false);


  // ============================================================================
  // FETCH TODAY'S COMPLETIONS
  // ============================================================================

  const fetchTodayCompletions = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          stepCompletions: Array<{ id: string; routine_step_id: string; completion_date: string }>;
          completedStepIds: string[];
        };
        error?: string;
      }>('/api/client/completions/today');

      if (!response.data.success) {
        console.error('Error fetching completions:', response.data.error);
        return;
      }

      const { stepCompletions, completedStepIds } = response.data.data || { stepCompletions: [], completedStepIds: [] };

      if (stepCompletions && stepCompletions.length > 0) {
        const completedStepIdsSet = new Set<string>(completedStepIds);
        const recordIdMap = new Map<string, string>();

        stepCompletions.forEach((completion) => {
          recordIdMap.set(completion.routine_step_id, completion.id);
        });

        setCompletedSteps(completedStepIdsSet);
        setCompletionRecordIds(recordIdMap);
      } else {
        setCompletedSteps(new Set());
        setCompletionRecordIds(new Map());
      }
    } catch (error) {
      console.error('Unexpected error fetching completions:', error);
    }
  }, []);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (authToken) {
      fetchRoutines();
    }
  }, [authToken]);

  const fetchRoutines = async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          routines: Array<DBRoutineTemplate & {
            assigned_at: string;
            assignment_notes: string | null;
            steps: Array<DBRoutineStep & { 
              products: Array<{ 
                id: string; 
                routine_step_id: string; 
                product_id: string; 
                name: string; 
                brand: string | null; 
                image_url: string | null; 
                purchase_url: string | null 
              }> 
            }>;
          }>;
          professionals: Array<{ id: string; name: string; email: string; avatarUrl: string | null }>;
        };
        error?: string;
      }>('/api/client/routines');

      if (!response.data.success) {
        console.error('Error fetching routines:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to fetch routine assignments',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const routinesData = response.data.data?.routines || [];
      const professionalsData = response.data.data?.professionals || [];

      if (routinesData.length === 0) {
        setGroupedRoutines([]);
        setProfessionals([]);
        setLoading(false);
        return;
      }

      // Build professionals map
      const professionalsMap = new Map<string, Professional>();
      professionalsData.forEach(p => {
        professionalsMap.set(p.id, {
          id: p.id,
          name: p.name,
          email: p.email,
          avatarUrl: p.avatarUrl,
        });
      });

      // Build step products map
      const stepProductsMap = new Map<string, StepProduct[]>();
      routinesData.forEach(routine => {
        routine.steps.forEach(step => {
          if (step.products && step.products.length > 0) {
            const products: StepProduct[] = step.products.map(p => ({
              id: `${step.id}-${p.product_id}`,
              productId: p.product_id,
              name: p.name,
              brand: p.brand,
              imageUrl: p.image_url,
              purchaseUrl: p.purchase_url,
            }));
            stepProductsMap.set(step.id, products);
          }
        });
      });

      // Group routines by professional
      const groupedByProfessional = new Map<string, Routine[]>();
      const addedRoutineIds = new Set<string>();

      routinesData.forEach(routine => {
        // Skip if we've already added this routine
        if (addedRoutineIds.has(routine.id)) return;
        addedRoutineIds.add(routine.id);

        const stepProducts = stepProductsMap;

        const mappedRoutine: Routine = {
          id: routine.id,
          name: routine.name,
          description: routine.description || '',
          scheduleType: routine.schedule_type,
          scheduleDays: routine.schedule_days || [],
          professionalId: routine.professional_id,
          assignedAt: routine.assigned_at,
          steps: routine.steps.map((step) => {
            const products = stepProducts.get(step.id) || [];
            const firstProductImage = products.length > 0 ? products[0].imageUrl : null;
            
            return {
              id: step.id,
              step: step.step_order,
              product: step.step_name,
              productImage: firstProductImage || '',
              notes: step.description || '',
              completed: false,
              daysUsed: Math.floor(Math.random() * 30),
              tips: step.tips || undefined,
              isOptional: step.is_optional,
              productCategory: step.product_category || undefined,
              products: products,
            };
          }),
        };

        const existing = groupedByProfessional.get(routine.professional_id) || [];
        existing.push(mappedRoutine);
        groupedByProfessional.set(routine.professional_id, existing);
      });

      // Build final grouped structure
      const grouped: GroupedRoutines[] = [];
      groupedByProfessional.forEach((routines, professionalId) => {
        const professional = professionalsMap.get(professionalId);
        if (professional) {
          grouped.push({
            professional,
            routines,
          });
        }
      });

      setGroupedRoutines(grouped);
      setProfessionals(Array.from(professionalsMap.values()));

      // Fetch today's completions AFTER routines are loaded
      await fetchTodayCompletions();

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Get all routines as a flat list from groupedRoutines
  // MUST be defined before filter handlers that use it
  // Deduplicate by routine.id to prevent same routine appearing multiple times
  const allRoutines = useMemo(() => {
    const routineMap = new Map<string, Routine>();
    groupedRoutines.forEach(group => {
      group.routines.forEach(routine => {
        // Only add if not already in map (deduplicate by routine.id)
        if (!routineMap.has(routine.id)) {
          routineMap.set(routine.id, routine);
        }
      });
    });
    return Array.from(routineMap.values());
  }, [groupedRoutines]);

  // ============================================================================
  // FILTER HANDLERS
  // ============================================================================

  // Helper function to get available schedule types for a professional
  // Uses allRoutines for consistency with the filtering logic
  const getAvailableScheduleTypesForProfessional = (professionalId: string): string[] => {
    const types: string[] = [];
    
    // Filter routines by professional (same logic as routinesFilteredByProfessional)
    const relevantRoutines = professionalId === 'all' 
      ? allRoutines 
      : allRoutines.filter(routine => routine.professionalId === professionalId);
    
    // Extract unique schedule types
    relevantRoutines.forEach(routine => {
      if (routine.scheduleType && !types.includes(routine.scheduleType)) {
        types.push(routine.scheduleType);
      }
    });
    
    return types;
  };

  // Handle professional change - reset schedule type if needed
  const handleProfessionalChange = (professionalId: string) => {
    console.log('handleProfessionalChange called with:', professionalId);
    setSelectedProfessionalId(professionalId);
    
    // Get available schedule types for the new professional
    const availableTypes = getAvailableScheduleTypesForProfessional(professionalId);
    console.log('Available types for professional:', availableTypes);
    
    // Use functional update to get the current schedule type
    setSelectedScheduleType(currentScheduleType => {
      // If current schedule type is not available for the new professional, auto-select first available
      if (availableTypes.length > 0 && !availableTypes.includes(currentScheduleType)) {
        const priorityOrder = ['morning', 'evening', 'daily', 'weekly', 'custom'];
        const firstMatch = priorityOrder.find(type => availableTypes.includes(type));
        const newType = firstMatch || availableTypes[0];
        console.log('Changing schedule type from', currentScheduleType, 'to', newType);
        return newType;
      }
      return currentScheduleType;
    });
  };

  // ============================================================================
  // AVAILABLE SCHEDULE TYPES
  // ============================================================================

  // Get available schedule types based on selected professional
  // Uses allRoutines and filters by routine.professionalId to ensure consistency with filtering logic
  const availableScheduleTypes = useMemo(() => {
    const types: string[] = [];
    
    // Filter routines by professional first (same logic as routinesFilteredByProfessional)
    const relevantRoutines = selectedProfessionalId === 'all' 
      ? allRoutines 
      : allRoutines.filter(routine => routine.professionalId === selectedProfessionalId);
    
    // Extract unique schedule types
    relevantRoutines.forEach(routine => {
      if (routine.scheduleType && !types.includes(routine.scheduleType)) {
        types.push(routine.scheduleType);
      }
    });
    
    // Sort by priority order
    const priorityOrder = ['morning', 'evening', 'daily', 'weekly', 'custom'];
    return types.sort((a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [allRoutines, selectedProfessionalId]);

  // Set default selected schedule type when available types change
  useEffect(() => {
    if (availableScheduleTypes.length > 0 && !availableScheduleTypes.includes(selectedScheduleType)) {
      setSelectedScheduleType(availableScheduleTypes[0]);
    }
  }, [availableScheduleTypes, selectedScheduleType]);

  // ============================================================================
  // FILTERED DATA - CORRECTED LOGIC
  // ============================================================================

  // Step 1: Filter routines by professional_id
  const routinesFilteredByProfessional = useMemo(() => {
    if (selectedProfessionalId === 'all') {
      return allRoutines;
    }
    // Filter by the selected professional's ID
    return allRoutines.filter(routine => routine.professionalId === selectedProfessionalId);
  }, [allRoutines, selectedProfessionalId]);

  // Step 2: Filter by schedule_type
  const filteredRoutines = useMemo(() => {
    if (!selectedScheduleType || selectedScheduleType === 'all') {
      return routinesFilteredByProfessional;
    }
    // Filter by the selected schedule type - exact match
    return routinesFilteredByProfessional.filter(routine => routine.scheduleType === selectedScheduleType);
  }, [routinesFilteredByProfessional, selectedScheduleType]);

  // Debug logging - remove in production
  useEffect(() => {
    console.log('=== FILTER DEBUG ===');
    console.log('Selected Professional ID:', selectedProfessionalId);
    console.log('Selected Schedule Type:', selectedScheduleType);
    console.log('All Routines:', allRoutines.map(r => ({ id: r.id, name: r.name, professionalId: r.professionalId, scheduleType: r.scheduleType })));
    console.log('After Professional Filter:', routinesFilteredByProfessional.map(r => ({ id: r.id, name: r.name, professionalId: r.professionalId, scheduleType: r.scheduleType })));
    console.log('After Schedule Type Filter:', filteredRoutines.map(r => ({ id: r.id, name: r.name, professionalId: r.professionalId, scheduleType: r.scheduleType })));
    console.log('Available Schedule Types:', availableScheduleTypes);
    console.log('====================');
  }, [selectedProfessionalId, selectedScheduleType, allRoutines, routinesFilteredByProfessional, filteredRoutines, availableScheduleTypes]);

  // Get all steps from filtered routines for display
  const allSteps = useMemo(() => {
    const steps: { routine: Routine; step: RoutineStep }[] = [];
    filteredRoutines.forEach(routine => {
      routine.steps.forEach(step => {
        steps.push({ routine, step });
      });
    });
    return steps.sort((a, b) => a.step.step - b.step.step);
  }, [filteredRoutines]);

  // Calculate progress - use completedSteps Set to determine completion
  const completedCount = allSteps.filter(s => completedSteps.has(s.step.id)).length;
  const totalCount = allSteps.length;
  const routineProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;


  // ============================================================================
  // HANDLERS
  // ============================================================================

  const onToggleRoutineStep = async (stepId: string) => {
    const token = getAuthToken();
    if (!token) return;
    
    // Prevent multiple clicks while processing
    if (togglingStepId === stepId) return;
    setTogglingStepId(stepId);

    const isCurrentlyCompleted = completedSteps.has(stepId);

    try {
      apiClient.setAuthToken(token);

      if (isCurrentlyCompleted) {
        // ====================================================================
        // UNCOMPLETE: Delete the completion record
        // ====================================================================
        await apiClient.delete(`/api/client/step-completions/${stepId}`);

        // Update local state
        setCompletedSteps(prev => {
          const newSet = new Set(prev);
          newSet.delete(stepId);
          return newSet;
        });
        setCompletionRecordIds(prev => {
          const newMap = new Map(prev);
          newMap.delete(stepId);
          return newMap;
        });

        console.log('Step uncompleted:', stepId);

      } else {
        // ====================================================================
        // COMPLETE: Insert a new completion record
        // ====================================================================
        const response = await apiClient.post<{
          success: boolean;
          data?: { completion: { id: string } };
          error?: string;
        }>('/api/client/step-completions', { step_id: stepId });

        if (!response.data.success) {
          console.error('Error inserting completion:', response.data.error);
          toast({
            title: 'Error',
            description: 'Failed to mark step as complete',
            variant: 'destructive',
          });
          setTogglingStepId(null);
          return;
        }

        // Update local state
        setCompletedSteps(prev => {
          const newSet = new Set(prev);
          newSet.add(stepId);
          return newSet;
        });
        
        const completionId = response.data.data?.completion?.id;
        if (completionId) {
          setCompletionRecordIds(prev => {
            const newMap = new Map(prev);
            newMap.set(stepId, completionId);
            return newMap;
          });
        }

        console.log('Step completed:', stepId, 'Record ID:', completionId);

        // Show success feedback
        toast({
          title: 'Step Completed!',
          description: 'Great job keeping up with your routine!',
        });
      }
    } catch (error) {
      console.error('Unexpected error toggling step:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setTogglingStepId(null);
    }
  };

  // Handle sending note to professional
  const handleSendNote = async (professionalId: string, note: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('User not authenticated');
    }

    apiClient.setAuthToken(token);

    // Send the note via the conversations API
    const response = await apiClient.post<{
      success: boolean;
      data?: { message: unknown };
      error?: string;
    }>(`/api/client/conversations/${professionalId}/messages`, {
      content: note,
    });

    if (!response.data.success) {
      console.error('Error sending note:', response.data.error);
      throw new Error(response.data.error || 'Failed to send note');
    }

    console.log('Note sent successfully to professional:', professionalId);
  };




  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
        <span className="ml-2 text-gray-600">Loading routines...</span>
      </div>
    );
  }

  if (groupedRoutines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Routines Assigned</h3>
        <p className="text-gray-500 max-w-md">
          You don't have any routines assigned yet. Your skincare professional will assign routines for you.
        </p>
      </div>
    );
  }

  // Build professional options for select
  const professionalOptions = [
    { value: 'all', label: 'All Professionals' },
    ...professionals.map(p => ({ value: p.id, label: p.name })),
  ];

  // Get current schedule type config
  const currentScheduleConfig = SCHEDULE_TYPE_CONFIG[selectedScheduleType];

  return (
    <div className="space-y-6">
      {/* Professional Filter and Send Note Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by Professional:</span>
          <div className="w-64">
            <CustomSelect
              options={professionalOptions}
              value={selectedProfessionalId}
              onChange={handleProfessionalChange}
              placeholder="Select Professional"
            />
          </div>
        </div>
        
        {/* Send Note Button */}
        {professionals.length > 0 && (
          <button
            onClick={() => setIsSendNoteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl hover:bg-[#B89A8E] transition-colors shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="font-medium">Send Note</span>
          </button>
        )}
      </div>



      {/* Schedule Type Toggle - Dynamic based on available types */}
      {availableScheduleTypes.length > 0 && (
        <div className="flex items-center justify-center">
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100 flex-wrap gap-1">
            {availableScheduleTypes.map(scheduleType => {
              const config = SCHEDULE_TYPE_CONFIG[scheduleType];
              const isSelected = selectedScheduleType === scheduleType;
              
              // Fallback for unknown schedule types
              const icon = config?.icon || <ClipboardList className="w-5 h-5" />;
              const label = config?.label || `${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} Routine`;
              const gradientClass = config?.gradientClass || 'bg-gradient-to-r from-gray-500 to-gray-600';

              return (
                <button
                  key={scheduleType}
                  onClick={() => setSelectedScheduleType(scheduleType)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    isSelected
                      ? `${gradientClass} text-white shadow-lg`
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Progress Card */}
      {allSteps.length > 0 && (
        <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium mb-1">
                {getScheduleLabel(selectedScheduleType)} Progress
              </h3>
              <p className="text-white/60 text-sm">{completedCount} of {totalCount} steps completed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{routineProgress}%</p>
              {routineProgress === 100 && <p className="text-green-400 text-sm">+50 pts</p>}
            </div>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full transition-all duration-500"
              style={{ width: `${routineProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty State for filtered view */}
      {allSteps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-gray-100">
          {currentScheduleConfig ? (
            React.cloneElement(currentScheduleConfig.icon as React.ReactElement, {
              className: `w-12 h-12 ${currentScheduleConfig.iconColorClass} mb-4 opacity-50`,
            })
          ) : (
            <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
          )}
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {getScheduleLabel(selectedScheduleType)}
          </h3>
          <p className="text-gray-500 max-w-md">
            You don't have a {selectedScheduleType} routine assigned from the selected professional.
          </p>
        </div>
      )}

      {/* Routine Steps */}
      <div className="space-y-4">
        {allSteps.map(({ routine, step }) => {
          const isCompleted = completedSteps.has(step.id);
          const isToggling = togglingStepId === step.id;
          const hasProducts = step.products && step.products.length > 0;
          const firstProduct = hasProducts ? step.products[0] : null;
          // Use composite key to ensure uniqueness (routine.id + step.id)
          const uniqueKey = `${routine.id}-${step.id}`;
          
          return (
            <div
              key={uniqueKey}
              className={`bg-white rounded-2xl p-5 border shadow-sm transition-all ${
                isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-100 hover:border-[#CFAFA3]/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => onToggleRoutineStep(step.id)}
                  disabled={isToggling}
                  className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-400 hover:bg-[#CFAFA3] hover:text-white'
                  } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isToggling ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isCompleted ? (
                    <Check className="w-7 h-7" />
                  ) : (
                    <span className="text-xl font-bold">{step.step}</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className={`font-medium text-lg ${isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                      {step.product}
                    </h4>
                    {step.daysUsed >= 25 && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> {step.daysUsed} days - Reorder
                      </span>
                    )}
                    {step.isOptional && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{step.notes}</p>
                  {step.tips && (
                    <p className="text-xs text-[#CFAFA3] mt-1 italic">Tip: {step.tips}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Used {step.daysUsed} days consecutively</p>
                  
                  {/* Show product info if available */}
                  {hasProducts && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {step.products.map((product) => (
                        <div 
                          key={product.id}
                          className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg text-xs"
                        >
                          {product.imageUrl && (
                            <img 
                              src={product.imageUrl} 
                              alt={product.name}
                              className="w-5 h-5 rounded object-cover"
                            />
                          )}
                          <span className="text-gray-700">{product.name}</span>
                          {product.brand && (
                            <span className="text-gray-400">({product.brand})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Product Image - Show first product image or placeholder */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {firstProduct?.imageUrl ? (
                    <img 
                      src={firstProduct.imageUrl} 
                      alt={firstProduct.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : step.productImage ? (
                    <img src={step.productImage} alt={step.product} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
              </div>
              {/* Routine name indicator */}
              {selectedProfessionalId === 'all' && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                  {getScheduleIcon(routine.scheduleType)}
                  <span>{routine.name}</span>
                  <span className="text-gray-300">•</span>
                  <span>
                    {groupedRoutines.find(g => g.professional.id === routine.professionalId)?.professional.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send Note Modal */}
      <SendNoteModal
        isOpen={isSendNoteModalOpen}
        onClose={() => setIsSendNoteModalOpen(false)}
        professionals={professionals}
        onSubmit={handleSendNote}
      />
    </div>
  );
};

export default MyRoutineSection;
