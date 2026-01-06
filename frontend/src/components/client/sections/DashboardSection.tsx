import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Trophy,
  Star,
  Crown,
  Sun,
  Moon,
  Check,
  ShoppingCart,
  Loader2,
  ClipboardList,
  Calendar,
  Settings2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CustomSelect } from '@/components/ui/custom-select';

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

interface DBRoutineCompletion {
  id: string;
  client_id: string;
  completion_date: string;
  routine_type: string;
  completed_at: string;
}

interface DBStepCompletion {
  id: string;
  client_id: string;
  routine_step_id: string;
  completion_date: string;
  completed_at: string;
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
  products: StepProduct[];
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

interface UserGamification {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string | null;
  earned_at: string;
}

interface Badge {
  id: string;
  name: string;
  image: string;
  earned: boolean;
  earnedDate?: string;
}

interface LevelInfo {
  current: { name: string; color: string };
}

interface DashboardSectionProps {
  clientStats: {
    level: string;
    points: number;
    currentStreak: number;
  };
  userDisplayName: string;
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

type ScheduleType = 'morning' | 'evening' | 'weekly' | 'custom';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&auto=format&fit=crop&q=60';

const LEVEL_COLORS: Record<string, string> = {
  Bronze: 'from-amber-600 to-amber-700',
  Silver: 'from-gray-300 to-gray-400',
  Gold: 'from-amber-400 to-yellow-500',
  Platinum: 'from-slate-300 to-slate-500',
  Diamond: 'from-cyan-300 to-blue-400',
};

const SCHEDULE_TYPE_CONFIG: Record<ScheduleType, { label: string; shortLabel: string; icon: React.ElementType; colors: string; bgGradient: string; borderColor: string; textColor: string }> = {
  morning: {
    label: 'Morning Routine',
    shortLabel: 'AM',
    icon: Sun,
    colors: 'from-amber-400 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-600',
  },
  evening: {
    label: 'Evening Routine',
    shortLabel: 'PM',
    icon: Moon,
    colors: 'from-indigo-500 to-purple-500',
    bgGradient: 'from-indigo-50 to-purple-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-600',
  },
  weekly: {
    label: 'Weekly Routine',
    shortLabel: 'Weekly',
    icon: Calendar,
    colors: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
  },
  custom: {
    label: 'Custom Routine',
    shortLabel: 'Custom',
    icon: Settings2,
    colors: 'from-teal-500 to-emerald-500',
    bgGradient: 'from-teal-50 to-emerald-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-600',
  },
};


// ============================================================================
// COMPONENT
// ============================================================================

const DashboardSection: React.FC<DashboardSectionProps> = ({ 
  clientStats: initialClientStats, 
  userDisplayName,
  onNavigateToView 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Data state
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingRoutine, setCompletingRoutine] = useState(false);
  
  // Filter state
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [selectedScheduleType, setSelectedScheduleType] = useState<ScheduleType>('morning');
  
  // Completion state
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [todayCompletedRoutines, setTodayCompletedRoutines] = useState<Set<string>>(new Set());
  
  // Gamification data from database
  const [gamificationData, setGamificationData] = useState<UserGamification | null>(null);
  const [loadingGamification, setLoadingGamification] = useState(true);
  
  // Badges from database
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(true);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch gamification data
  useEffect(() => {
    const fetchGamificationData = async () => {
      if (!user?.id) {
        setLoadingGamification(false);
        return;
      }

      try {
        setLoadingGamification(true);
        const { data, error } = await supabase
          .from('user_gamification')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            console.log('No gamification record found for user, using defaults');
          } else {
            console.error('Error fetching gamification data:', error);
          }
          setGamificationData(null);
        } else {
          setGamificationData(data);
        }
      } catch (err) {
        console.error('Error fetching gamification data:', err);
        setGamificationData(null);
      } finally {
        setLoadingGamification(false);
      }
    };

    fetchGamificationData();
  }, [user?.id]);

  // Fetch badges from database
  useEffect(() => {
    const fetchBadges = async () => {
      if (!user?.id) {
        setLoadingBadges(false);
        return;
      }

      try {
        setLoadingBadges(true);
        const { data, error } = await supabase
          .from('user_badges')
          .select('*')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false });

        if (error) {
          console.error('Error fetching badges:', error);
          setBadges([]);
        } else if (data) {
          // Convert database badges to Badge interface
          const mappedBadges: Badge[] = data.map((badge: UserBadge) => ({
            id: badge.id,
            name: badge.badge_name,
            image: badge.badge_icon || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(badge.badge_name) + '&background=CFAFA3&color=2D2A3E',
            earned: true,
            earnedDate: badge.earned_at,
          }));
          setBadges(mappedBadges);
        }
      } catch (err) {
        console.error('Error fetching badges:', err);
        setBadges([]);
      } finally {
        setLoadingBadges(false);
      }
    };

    fetchBadges();
  }, [user?.id]);



  // Fetch routines
  useEffect(() => {
    if (user?.id) {
      fetchRoutines();
      fetchTodayCompletions();
    }
  }, [user?.id]);

  const fetchRoutines = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Get all routine assignments for this client
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('client_routine_assignments')
        .select('*')
        .eq('client_id', user.id)
        .eq('is_active', true);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        toast({
          title: 'Error',
          description: 'Failed to fetch routine assignments',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (!assignmentsData || assignmentsData.length === 0) {
        setRoutines([]);
        setProfessionals([]);
        setLoading(false);
        return;
      }

      const assignments = assignmentsData as DBClientRoutineAssignment[];

      // Get routine templates
      const routineIds = [...new Set(assignments.map(a => a.routine_id))];
      const { data: routinesData, error: routinesError } = await supabase
        .from('routine_templates')
        .select('*')
        .in('id', routineIds)
        .eq('is_active', true);

      if (routinesError) {
        console.error('Error fetching routines:', routinesError);
        setLoading(false);
        return;
      }

      const routinesDataTyped = routinesData as DBRoutineTemplate[];

      // Get professionals
      const professionalIds = [...new Set(routinesDataTyped.map(r => r.professional_id))];
      const { data: professionalsData, error: professionalsError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, role')
        .in('id', professionalIds);

      if (professionalsError) {
        console.error('Error fetching professionals:', professionalsError);
        setLoading(false);
        return;
      }

      const professionalsMap = new Map<string, Professional>();
      (professionalsData as DBUserProfile[]).forEach(p => {
        professionalsMap.set(p.id, {
          id: p.id,
          name: p.full_name || p.email,
          email: p.email,
          avatarUrl: p.avatar_url,
        });
      });

      // Get routine steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('routine_steps')
        .select('*')
        .in('routine_id', routineIds)
        .order('step_order', { ascending: true });

      if (stepsError) {
        console.error('Error fetching steps:', stepsError);
        setLoading(false);
        return;
      }

      // Get step products
      const stepIds = (stepsData as DBRoutineStep[]).map(s => s.id);
      let stepProductsMap = new Map<string, StepProduct[]>();

      if (stepIds.length > 0) {
        const { data: stepProductsData, error: stepProductsError } = await supabase
          .from('routine_step_products')
          .select(`
            routine_step_id,
            product_id,
            notes,
            products:product_id (
              id,
              name,
              brand,
              image_url,
              purchase_url
            )
          `)
          .in('routine_step_id', stepIds);

        if (!stepProductsError && stepProductsData) {
          stepProductsData.forEach((sp: any) => {
            const stepId = sp.routine_step_id;
            const product = sp.products;
            
            if (product) {
              const stepProduct: StepProduct = {
                id: `${sp.routine_step_id}-${sp.product_id}`,
                productId: product.id,
                name: product.name,
                brand: product.brand,
                imageUrl: product.image_url,
                purchaseUrl: product.purchase_url,
              };
              
              const existing = stepProductsMap.get(stepId) || [];
              existing.push(stepProduct);
              stepProductsMap.set(stepId, existing);
            }
          });
        }
      }

      // Build routines structure
      const stepsMap = new Map<string, DBRoutineStep[]>();
      (stepsData as DBRoutineStep[]).forEach(step => {
        const existing = stepsMap.get(step.routine_id) || [];
        existing.push(step);
        stepsMap.set(step.routine_id, existing);
      });

      const routinesMap = new Map<string, DBRoutineTemplate>();
      (routinesData as DBRoutineTemplate[]).forEach(r => {
        routinesMap.set(r.id, r);
      });

      const addedRoutineIds = new Set<string>();
      const mappedRoutines: Routine[] = [];

      assignments.forEach(assignment => {
        const routine = routinesMap.get(assignment.routine_id);
        if (!routine || addedRoutineIds.has(routine.id)) return;
        addedRoutineIds.add(routine.id);

        const steps = stepsMap.get(routine.id) || [];

        const mappedRoutine: Routine = {
          id: routine.id,
          name: routine.name,
          description: routine.description || '',
          scheduleType: routine.schedule_type,
          scheduleDays: routine.schedule_days || [],
          professionalId: routine.professional_id,
          assignedAt: assignment.assigned_at,
          steps: steps.map((step) => {
            const stepProducts = stepProductsMap.get(step.id) || [];
            const firstProductImage = stepProducts.length > 0 ? stepProducts[0].imageUrl : null;
            
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
              products: stepProducts,
            };
          }),
        };

        mappedRoutines.push(mappedRoutine);
      });

      setRoutines(mappedRoutines);
      setProfessionals(Array.from(professionalsMap.values()));

      // Set default professional if not set
      if (!selectedProfessionalId && professionalsMap.size > 0) {
        setSelectedProfessionalId(Array.from(professionalsMap.keys())[0]);
      }

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

  const fetchTodayCompletions = async () => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch today's routine completions
      const { data: routineCompletions, error: routineError } = await supabase
        .from('routine_completions')
        .select('*')
        .eq('client_id', user.id)
        .eq('completion_date', today);

      if (!routineError && routineCompletions) {
        const completedTypes = new Set(routineCompletions.map((rc: DBRoutineCompletion) => rc.routine_type));
        setTodayCompletedRoutines(completedTypes);
      }

      // Fetch today's step completions
      const { data: stepCompletions, error: stepError } = await supabase
        .from('routine_step_completions')
        .select('*')
        .eq('client_id', user.id)
        .eq('completion_date', today);

      if (!stepError && stepCompletions) {
        const completedStepIds = new Set(stepCompletions.map((sc: DBStepCompletion) => sc.routine_step_id));
        setCompletedSteps(completedStepIds);
      }
    } catch (error) {
      console.error('Error fetching today completions:', error);
    }
  };

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  // Use database data if available, otherwise fall back to initial props
  const clientStats = {
    level: gamificationData?.level || initialClientStats.level,
    points: gamificationData?.points ?? initialClientStats.points,
    currentStreak: gamificationData?.current_streak ?? initialClientStats.currentStreak,
    longestStreak: gamificationData?.longest_streak ?? 0,
    totalCompletions: gamificationData?.total_routines_completed ?? 0,
  };

  const levelInfo: LevelInfo = {
    current: {
      name: clientStats.level,
      color: LEVEL_COLORS[clientStats.level] || LEVEL_COLORS.Bronze,
    },
  };

  // Filter routines by professional
  const routinesForProfessional = useMemo(() => {
    if (!selectedProfessionalId) return routines;
    return routines.filter(r => r.professionalId === selectedProfessionalId);
  }, [routines, selectedProfessionalId]);

  // Get routines by schedule type
  const getRoutinesByType = (type: ScheduleType) => {
    return routinesForProfessional.filter(r => r.scheduleType === type);
  };

  const morningRoutines = useMemo(() => getRoutinesByType('morning'), [routinesForProfessional]);
  const eveningRoutines = useMemo(() => getRoutinesByType('evening'), [routinesForProfessional]);
  const weeklyRoutines = useMemo(() => getRoutinesByType('weekly'), [routinesForProfessional]);
  const customRoutines = useMemo(() => getRoutinesByType('custom'), [routinesForProfessional]);

  // Get steps by schedule type
  const getStepsByType = (type: ScheduleType) => {
    const targetRoutines = getRoutinesByType(type);
    return targetRoutines.flatMap(r => r.steps);
  };

  const morningSteps = useMemo(() => getStepsByType('morning'), [routinesForProfessional]);
  const eveningSteps = useMemo(() => getStepsByType('evening'), [routinesForProfessional]);
  const weeklySteps = useMemo(() => getStepsByType('weekly'), [routinesForProfessional]);
  const customSteps = useMemo(() => getStepsByType('custom'), [routinesForProfessional]);

  // Get current routine steps based on selected schedule type
  const currentRoutineSteps = useMemo(() => {
    const targetRoutines = getRoutinesByType(selectedScheduleType);
    const steps: { routine: Routine; step: RoutineStep }[] = [];
    targetRoutines.forEach(routine => {
      routine.steps.forEach(step => {
        steps.push({ routine, step });
      });
    });
    return steps.sort((a, b) => a.step.step - b.step.step);
  }, [routinesForProfessional, selectedScheduleType]);

  // Calculate progress for each type
  const getCompletionStatus = (type: ScheduleType) => {
    const steps = getStepsByType(type);
    const completedCount = steps.filter(s => completedSteps.has(s.id)).length;
    const isComplete = todayCompletedRoutines.has(type) || (steps.length > 0 && completedCount === steps.length);
    return { steps, completedCount, isComplete };
  };

  const morningStatus = getCompletionStatus('morning');
  const eveningStatus = getCompletionStatus('evening');
  const weeklyStatus = getCompletionStatus('weekly');
  const customStatus = getCompletionStatus('custom');

  const isTodayFullyComplete = morningStatus.isComplete && eveningStatus.isComplete;

  // Get available schedule types (only show types that have routines)
  const availableScheduleTypes = useMemo(() => {
    const types: ScheduleType[] = [];
    if (morningRoutines.length > 0) types.push('morning');
    if (eveningRoutines.length > 0) types.push('evening');
    if (weeklyRoutines.length > 0) types.push('weekly');
    if (customRoutines.length > 0) types.push('custom');
    return types;
  }, [morningRoutines, eveningRoutines, weeklyRoutines, customRoutines]);

  // Set default selected schedule type when available types change
  useEffect(() => {
    if (availableScheduleTypes.length > 0 && !availableScheduleTypes.includes(selectedScheduleType)) {
      setSelectedScheduleType(availableScheduleTypes[0]);
    }
  }, [availableScheduleTypes, selectedScheduleType]);


  // ============================================================================
  // HANDLERS
  // ============================================================================

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const handleProfessionalChange = (professionalId: string) => {
    setSelectedProfessionalId(professionalId);
  };

  const onToggleRoutineStep = async (stepId: string) => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];
    const isCurrentlyCompleted = completedSteps.has(stepId);

    // Optimistic update
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyCompleted) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });

    try {
      if (isCurrentlyCompleted) {
        // Remove completion
        await supabase
          .from('routine_step_completions')
          .delete()
          .eq('client_id', user.id)
          .eq('routine_step_id', stepId)
          .eq('completion_date', today);
      } else {
        // Add completion
        await supabase
          .from('routine_step_completions')
          .upsert({
            client_id: user.id,
            routine_step_id: stepId,
            completion_date: today,
          }, {
            onConflict: 'client_id,routine_step_id,completion_date'
          });
      }
    } catch (error) {
      console.error('Error toggling step completion:', error);
      // Revert on error
      setCompletedSteps(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyCompleted) {
          newSet.add(stepId);
        } else {
          newSet.delete(stepId);
        }
        return newSet;
      });
    }
  };

  const onConfirmRoutine = async (type: ScheduleType) => {
    if (!user?.id) return;

    setCompletingRoutine(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Mark all steps as completed
      const targetSteps = getStepsByType(type);
      const stepIds = targetSteps.map(s => s.id);

      // Insert step completions
      const stepCompletions = stepIds.map(stepId => ({
        client_id: user.id,
        routine_step_id: stepId,
        completion_date: today,
      }));

      if (stepCompletions.length > 0) {
        await supabase
          .from('routine_step_completions')
          .upsert(stepCompletions, {
            onConflict: 'client_id,routine_step_id,completion_date'
          });
      }

      // Insert routine completion
      await supabase
        .from('routine_completions')
        .upsert({
          client_id: user.id,
          completion_date: today,
          routine_type: type,
        }, {
          onConflict: 'client_id,completion_date,routine_type'
        });

      // Update local state
      setCompletedSteps(prev => {
        const newSet = new Set(prev);
        stepIds.forEach(id => newSet.add(id));
        return newSet;
      });

      setTodayCompletedRoutines(prev => {
        const newSet = new Set(prev);
        newSet.add(type);
        return newSet;
      });

      // Update gamification
      await updateGamification();

      toast({
        title: 'Routine Complete!',
        description: `Your ${type} routine has been completed. +50 points!`,
      });

    } catch (error) {
      console.error('Error confirming routine:', error);
      toast({
        title: 'Error',
        description: 'Failed to confirm routine completion',
        variant: 'destructive',
      });
    } finally {
      setCompletingRoutine(false);
    }
  };

  const updateGamification = async () => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    try {
      // Get current gamification data
      const { data: currentData, error: fetchError } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching gamification:', fetchError);
        return;
      }

      let newStreak = 1;
      let longestStreak = 1;
      let totalPoints = 50;
      let totalRoutines = 1;

      if (currentData) {
        const lastDate = currentData.last_completion_date;
        
        // Calculate streak
        if (lastDate === yesterday) {
          newStreak = (currentData.current_streak || 0) + 1;
        } else if (lastDate === today) {
          newStreak = currentData.current_streak || 1;
        } else {
          newStreak = 1;
        }

        longestStreak = Math.max(newStreak, currentData.longest_streak || 0);
        totalPoints = (currentData.points || 0) + 50;
        totalRoutines = (currentData.total_routines_completed || 0) + 1;
      }

      // Calculate level
      let level = 'Bronze';
      if (totalPoints >= 5000) level = 'Diamond';
      else if (totalPoints >= 2500) level = 'Platinum';
      else if (totalPoints >= 1000) level = 'Gold';
      else if (totalPoints >= 500) level = 'Silver';

      // Upsert gamification data
      const { error: upsertError } = await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          current_streak: newStreak,
          longest_streak: longestStreak,
          points: totalPoints,
          total_routines_completed: totalRoutines,
          level: level,
          last_completion_date: today,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error('Error updating gamification:', upsertError);
        return;
      }

      // Refresh gamification data
      setGamificationData({
        id: currentData?.id || '',
        user_id: user.id,
        current_streak: newStreak,
        longest_streak: longestStreak,
        points: totalPoints,
        total_routines_completed: totalRoutines,
        level: level,
        last_completion_date: today,
        created_at: currentData?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error updating gamification:', error);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderRoutineCard = (type: ScheduleType, status: { steps: RoutineStep[]; completedCount: number; isComplete: boolean }) => {
    const config = SCHEDULE_TYPE_CONFIG[type];
    const IconComponent = config.icon;
    const hasSteps = status.steps.length > 0;

    return (
      <div className={`rounded-2xl p-6 border shadow-sm transition-all ${
        status.isComplete 
          ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
          : `bg-gradient-to-br ${config.bgGradient} ${config.borderColor}`
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              status.isComplete ? 'bg-green-500' : `bg-gradient-to-br ${config.colors}`
            }`}>
              {status.isComplete ? <Check className="w-6 h-6 text-white" /> : <IconComponent className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-gray-900">{config.label}</h3>
              <p className="text-sm text-gray-500">{status.steps.length} steps</p>
            </div>
          </div>
          {status.isComplete && (
            <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full flex items-center gap-1">
              <Check className="w-4 h-4" /> Done
            </span>
          )}
        </div>
        
        {status.isComplete ? (
          <div className="text-center py-4">
            <p className="text-green-700 font-medium">Great job completing your {config.shortLabel} routine!</p>
            <p className="text-sm text-green-600 mt-1">+50 points earned</p>
          </div>
        ) : hasSteps ? (
          <>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Progress</span>
                <span className={`font-medium ${config.textColor}`}>
                  {status.completedCount}/{status.steps.length}
                </span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${config.colors} rounded-full transition-all`}
                  style={{ width: `${status.steps.length > 0 ? (status.completedCount / status.steps.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => onConfirmRoutine(type)}
              disabled={completingRoutine}
              className={`w-full py-3 bg-gradient-to-r ${config.colors} text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {completingRoutine ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <IconComponent className="w-5 h-5" /> Confirm {config.shortLabel} Routine Complete
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No {type} routine assigned</p>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  // Build professional options (without "All" option)
  const professionalOptions = professionals.map(p => ({ value: p.id, label: p.name }));

  // Get current schedule type config
  const currentConfig = SCHEDULE_TYPE_CONFIG[selectedScheduleType];
  const CurrentIcon = currentConfig.icon;
  const currentStatus = getCompletionStatus(selectedScheduleType);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E]">
        <div className="absolute inset-0 opacity-20">
          <img src={HERO_IMAGE} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
                Good {getTimeOfDay()}, {userDisplayName.split(' ')[0]}!
              </h1>
              <p className="text-white/80">Keep up your amazing skincare journey. You're doing great!</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-1">
                  {loadingGamification ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <span className="text-2xl font-bold text-white">{clientStats.currentStreak}</span>
                  )}
                </div>
                <p className="text-xs text-white/70">Day Streak</p>
              </div>
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${levelInfo.current.color} flex items-center justify-center mb-1`}>
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <p className="text-xs text-white/70">{clientStats.level}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Routine Confirmation Cards - Only show types that have routines */}
      {availableScheduleTypes.length > 0 && (
        <div className={`grid gap-4 ${
          availableScheduleTypes.length === 1 ? 'grid-cols-1' :
          availableScheduleTypes.length === 2 ? 'md:grid-cols-2' :
          availableScheduleTypes.length === 3 ? 'md:grid-cols-3' :
          'md:grid-cols-2 lg:grid-cols-4'
        }`}>
          {availableScheduleTypes.includes('morning') && renderRoutineCard('morning', morningStatus)}
          {availableScheduleTypes.includes('evening') && renderRoutineCard('evening', eveningStatus)}
          {availableScheduleTypes.includes('weekly') && renderRoutineCard('weekly', weeklyStatus)}
          {availableScheduleTypes.includes('custom') && renderRoutineCard('custom', customStatus)}
        </div>
      )}


      {/* Streak & Rewards Banner */}
      {isTodayFullyComplete && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl">Today's Routines Complete!</h3>
                <p className="text-white/80">You're building an amazing streak. Keep it up!</p>
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-amber-300" />
                <span className="text-3xl font-bold">{clientStats.currentStreak}</span>
              </div>
              <p className="text-sm text-white/70">Day Streak</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          {loadingGamification ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{clientStats.currentStreak}</p>
              <p className="text-sm text-gray-500">Current Streak</p>
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          {loadingGamification ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{clientStats.longestStreak}</p>
              <p className="text-sm text-gray-500">Longest Streak</p>
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#CFAFA3]/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-[#CFAFA3]" />
            </div>
          </div>
          {loadingGamification ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{clientStats.points.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Points</p>
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
          </div>
          {loadingGamification ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{clientStats.totalCompletions}</p>
              <p className="text-sm text-gray-500">Routines Done</p>
            </>
          )}
        </div>
      </div>

      {/* Today's Routine Steps */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="font-serif font-bold text-lg">Today's Routine Steps</h3>
          
          <div className="flex items-center gap-3">
            {/* Professional Select */}
            {professionals.length > 0 && (
              <div className="w-48">
                <CustomSelect
                  options={professionalOptions}
                  value={selectedProfessionalId}
                  onChange={handleProfessionalChange}
                  placeholder="Select Professional"
                />
              </div>
            )}
            
            {/* Schedule Type Toggle - Only show types that have routines */}
            {availableScheduleTypes.length > 0 && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                {availableScheduleTypes.includes('morning') && (
                  <button
                    onClick={() => setSelectedScheduleType('morning')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedScheduleType === 'morning' ? 'bg-white shadow text-amber-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Sun className="w-4 h-4" /> AM {morningStatus.isComplete && <Check className="w-3 h-3 text-green-500" />}
                  </button>
                )}
                {availableScheduleTypes.includes('evening') && (
                  <button
                    onClick={() => setSelectedScheduleType('evening')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedScheduleType === 'evening' ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Moon className="w-4 h-4" /> PM {eveningStatus.isComplete && <Check className="w-3 h-3 text-green-500" />}
                  </button>
                )}
                {availableScheduleTypes.includes('weekly') && (
                  <button
                    onClick={() => setSelectedScheduleType('weekly')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedScheduleType === 'weekly' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Calendar className="w-4 h-4" /> Weekly {weeklyStatus.isComplete && <Check className="w-3 h-3 text-green-500" />}
                  </button>
                )}
                {availableScheduleTypes.includes('custom') && (
                  <button
                    onClick={() => setSelectedScheduleType('custom')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      selectedScheduleType === 'custom' ? 'bg-white shadow text-teal-600' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Settings2 className="w-4 h-4" /> Custom {customStatus.isComplete && <Check className="w-3 h-3 text-green-500" />}
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
            <span className="ml-2 text-gray-600">Loading routines...</span>
          </div>
        ) : currentRoutineSteps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No {currentConfig.label}
            </h4>
            <p className="text-gray-500 max-w-md">
              You don't have a {selectedScheduleType} routine assigned yet. Your skincare professional will assign one for you.
            </p>
          </div>
        ) : (
          <>
            {/* Steps */}
            <div className="space-y-3">
              {currentRoutineSteps.map(({ routine, step }) => {
                const isCompleted = completedSteps.has(step.id);
                const hasProducts = step.products && step.products.length > 0;
                const firstProduct = hasProducts ? step.products[0] : null;
                
                return (
                  <div
                    key={`${routine.id}-${step.id}`}
                    onClick={() => onToggleRoutineStep(step.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                      isCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400 overflow-hidden">
                      {firstProduct?.imageUrl ? (
                        <img 
                          src={firstProduct.imageUrl} 
                          alt={firstProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium">{step.step}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium ${isCompleted ? 'text-green-700' : 'text-gray-900'}`}>
                          {hasProducts ? firstProduct?.name : step.product}
                        </p>
                        {step.daysUsed >= 25 && !isCompleted && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" /> Reorder Soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{step.notes || step.product}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-sm font-medium text-gray-600">{step.step}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirm Button at Bottom */}
            {!currentStatus.isComplete && (
              <button
                onClick={() => onConfirmRoutine(selectedScheduleType)}
                disabled={completingRoutine}
                className={`w-full mt-4 py-3 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r ${currentConfig.colors}`}
              >
                {completingRoutine ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CurrentIcon className="w-5 h-5" />
                    Confirm {currentConfig.shortLabel} Routine Complete
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Recent Badges */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-lg">Recent Achievements</h3>
          <button 
            onClick={() => onNavigateToView?.('achievements')} 
            className="text-sm text-[#CFAFA3] hover:underline"
          >
            View All
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {badges.filter(b => b.earned).slice(0, 4).map((badge) => (
            <div key={badge.id} className="flex-shrink-0 text-center">
              <div className="w-16 h-16 rounded-xl overflow-hidden mb-2 border-2 border-[#CFAFA3]">
                <img src={badge.image} alt={badge.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs font-medium text-gray-700">{badge.name}</p>
            </div>
          ))}
          {badges.filter(b => b.earned).length === 0 && (
            <p className="text-sm text-gray-500">Complete routines to earn badges!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSection;
