import React, { useState, useEffect } from 'react';
import {
  Plus,
  ClipboardList,
  Loader2,
  Play,
  CheckCircle2,
  Users,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  TreatmentPlan,
  TreatmentPlanClient,
  TreatmentPlanMilestone,
  TreatmentPlanProduct,
  TreatmentPlanRoutine,
  TreatmentPlanAppointment,
  getStatusColor,
  calculatePlanProgress,
  CLIENT_IMAGES,
} from '@/components/professional/modals/treatmentPlanTypes';
import CreateTreatmentPlanModal from '@/components/professional/modals/CreateTreatmentPlanModal';
import TreatmentPlanDetailModal from '@/components/professional/modals/TreatmentPlanDetailModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// ============================================================================
// TYPES
// ============================================================================

interface TreatmentPlansSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const TreatmentPlansSection: React.FC<TreatmentPlansSectionProps> = ({
  onNavigateToView,
}) => {
  const { user } = useAuth();
  
  // Data state
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [clients, setClients] = useState<TreatmentPlanClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);

  // Stats
  const totalPlans = plans.length;
  const activePlans = plans.filter(p => p.status === 'active').length;
  const completedPlans = plans.filter(p => p.status === 'completed').length;
  const uniqueClients = new Set(plans.map(p => p.client_id)).size;

  // ============================================================================
  // FETCH CLIENTS FROM DATABASE
  // ============================================================================
  
  const fetchClients = async () => {
    if (!user?.id) {
      setClientsLoading(false);
      return;
    }

    setClientsLoading(true);

    try {
      // Step 1: Get all client_ids from client_professional_relationships
      // where professional_id matches the current signed-in professional
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('client_professional_relationships')
        .select('client_id')
        .eq('professional_id', user.id);

      if (relationshipsError) {
        console.error('Error fetching relationships:', relationshipsError);
        setClientsLoading(false);
        return;
      }

      // Extract client IDs from relationships
      const clientIds = relationshipsData?.map(r => r.client_id) || [];

      if (clientIds.length === 0) {
        // No clients found for this professional
        setClients([]);
        setClientsLoading(false);
        return;
      }

      // Step 2: Get client details from user_profiles using the client_ids
      const { data: clientsData, error: clientsError } = await supabase
        .from('user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', clientIds);

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        setClientsLoading(false);
        return;
      }

      // Step 3: Map database data to TreatmentPlanClient interface
      const mappedClients: TreatmentPlanClient[] = (clientsData || []).map((clientData, index) => ({
        id: clientData.id,
        name: clientData.full_name || 'Unknown',
        image: clientData.avatar_url || CLIENT_IMAGES[index % CLIENT_IMAGES.length] || `https://ui-avatars.com/api/?name=${encodeURIComponent(clientData.full_name || 'U')}&background=CFAFA3&color=fff`,
      }));

      setClients(mappedClients);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setClientsLoading(false);
    }
  };


  // ============================================================================
  // FETCH TREATMENT PLANS FROM DATABASE (with milestones)
  // ============================================================================

  const fetchTreatmentPlans = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch treatment plans
      const { data: plansData, error: plansError } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (plansError) {
        console.error('Error fetching treatment plans:', plansError);
        setError('Failed to load treatment plans');
        setLoading(false);
        return;
      }

      // Fetch milestones for all plans
      const planIds = (plansData || []).map(p => p.id);
      let milestonesMap: Record<string, TreatmentPlanMilestone[]> = {};
      let productsMap: Record<string, TreatmentPlanProduct[]> = {};
      let routinesMap: Record<string, TreatmentPlanRoutine[]> = {};
      let appointmentsMap: Record<string, TreatmentPlanAppointment[]> = {};

      if (planIds.length > 0) {
        // Fetch milestones
        const { data: milestonesData, error: milestonesError } = await supabase
          .from('treatment_plan_milestones')
          .select('*')
          .in('plan_id', planIds)
          .order('order_index', { ascending: true });

        if (milestonesError) {
          console.error('Error fetching milestones:', milestonesError);
        } else {
          // Group milestones by plan_id
          (milestonesData || []).forEach(milestone => {
            if (!milestonesMap[milestone.plan_id]) {
              milestonesMap[milestone.plan_id] = [];
            }
            milestonesMap[milestone.plan_id].push({
              id: milestone.id,
              plan_id: milestone.plan_id,
              title: milestone.title,
              description: milestone.description || undefined,
              target_date: milestone.target_date,
              completed: milestone.completed || false,
              completed_at: milestone.completed_at || undefined,
            });
          });
        }

        // Fetch products from treatment_plan_products table
        const { data: productsData, error: productsError } = await supabase
          .from('treatment_plan_products')
          .select('*')
          .in('plan_id', planIds)
          .order('created_at', { ascending: true });

        if (productsError) {
          console.error('Error fetching products:', productsError);
        } else {
          // Group products by plan_id
          (productsData || []).forEach(product => {
            if (!productsMap[product.plan_id]) {
              productsMap[product.plan_id] = [];
            }
            productsMap[product.plan_id].push({
              id: product.id,
              plan_id: product.plan_id,
              product_name: product.product_name,
              product_brand: product.product_brand || undefined,
              product_category: product.product_category || undefined,
              usage_instructions: product.usage_instructions || undefined,
              priority: product.priority || 'recommended',
            });
          });
        }

        // Fetch routines from treatment_plan_routines table
        const { data: routinesData, error: routinesError } = await supabase
          .from('treatment_plan_routines')
          .select('*')
          .in('plan_id', planIds)
          .order('created_at', { ascending: true });

        if (routinesError) {
          console.error('Error fetching routines:', routinesError);
        } else {
          // Group routines by plan_id
          (routinesData || []).forEach(routine => {
            if (!routinesMap[routine.plan_id]) {
              routinesMap[routine.plan_id] = [];
            }
            routinesMap[routine.plan_id].push({
              id: routine.id,
              plan_id: routine.plan_id,
              routine_name: routine.routine_name,
              routine_type: routine.routine_type || undefined,
              notes: routine.notes || undefined,
            });
          });
        }

        // Fetch appointments from treatment_plan_appointments table
        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('treatment_plan_appointments')
          .select('*')
          .in('plan_id', planIds)
          .order('scheduled_date', { ascending: true });

        if (appointmentsError) {
          console.error('Error fetching appointments:', appointmentsError);
        } else {
          // Group appointments by plan_id
          (appointmentsData || []).forEach(appointment => {
            if (!appointmentsMap[appointment.plan_id]) {
              appointmentsMap[appointment.plan_id] = [];
            }
            appointmentsMap[appointment.plan_id].push({
              id: appointment.id,
              plan_id: appointment.plan_id,
              appointment_type: appointment.appointment_type,
              scheduled_date: appointment.scheduled_date,
              scheduled_time: appointment.scheduled_time || undefined,
              duration_minutes: appointment.duration_minutes || 60,
              notes: appointment.notes || undefined,
              completed: appointment.completed || false,
            });
          });
        }
      }

      // Map database data to TreatmentPlan interface
      const mappedPlans: TreatmentPlan[] = (plansData || []).map(plan => ({
        id: plan.id,
        client_id: plan.client_id,
        professional_id: plan.professional_id,
        title: plan.title,
        description: plan.description || undefined,
        goals: plan.goals || [],
        start_date: plan.start_date,
        end_date: plan.end_date,
        status: plan.status || 'active',
        milestones: milestonesMap[plan.id] || [], // Fetched from treatment_plan_milestones table
        products: productsMap[plan.id] || [], // Fetched from treatment_plan_products table
        routines: routinesMap[plan.id] || [], // Fetched from treatment_plan_routines table
        appointments: appointmentsMap[plan.id] || [], // Fetched from treatment_plan_appointments table
        notes: plan.notes || undefined,
        created_at: plan.created_at,
        updated_at: plan.updated_at || undefined,
      }));


      setPlans(mappedPlans);
    } catch (err) {
      console.error('Error fetching treatment plans:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };








  // Fetch data on mount and when user changes
  useEffect(() => {
    fetchClients();
    fetchTreatmentPlans();
  }, [user?.id]);

  // ============================================================================
  // CREATE TREATMENT PLAN
  // ============================================================================

  const handleCreatePlan = async (data: {
    clientId: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    goals: string[];
    notes: string;
  }) => {
    if (!user?.id) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Insert the treatment plan into the database
      // Only include columns that exist in the treatment_plans table:
      // id, professional_id, client_id, title, description, start_date, end_date, status, goals, notes, created_at, updated_at
      const { data: newPlanData, error: insertError } = await supabase
        .from('treatment_plans')
        .insert({
          professional_id: user.id,
          client_id: data.clientId,
          title: data.title,
          description: data.description || null,
          goals: data.goals,
          start_date: data.startDate,
          end_date: data.endDate,
          status: 'active',
          notes: data.notes || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating treatment plan:', insertError);
        throw insertError;
      }

      // Map the returned data to TreatmentPlan interface
      // Note: milestones, products, routines, appointments are managed locally (not in DB)
      const newPlan: TreatmentPlan = {
        id: newPlanData.id,
        client_id: newPlanData.client_id,
        professional_id: newPlanData.professional_id,
        title: newPlanData.title,
        description: newPlanData.description || undefined,
        goals: newPlanData.goals || [],
        start_date: newPlanData.start_date,
        end_date: newPlanData.end_date,
        status: newPlanData.status || 'active',
        milestones: [], // Managed locally
        products: [], // Managed locally
        routines: [], // Managed locally
        appointments: [], // Managed locally
        notes: newPlanData.notes || undefined,
        created_at: newPlanData.created_at,
        updated_at: newPlanData.updated_at || undefined,
      };

      // Update local state
      setPlans([newPlan, ...plans]);
      setShowCreateModal(false);
      
      // Open detail modal to add more info
      setSelectedPlan(newPlan);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error creating treatment plan:', err);
      throw err;
    }
  };


  // ============================================================================
  // UPDATE TREATMENT PLAN STATUS
  // ============================================================================

  const handleUpdateStatus = async (planId: string, status: TreatmentPlan['status']) => {
    try {
      const { error: updateError } = await supabase
        .from('treatment_plans')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', planId);

      if (updateError) {
        console.error('Error updating status:', updateError);
        return;
      }

      setPlans(plans.map(p => p.id === planId ? { ...p, status, updated_at: new Date().toISOString() } : p));
      if (selectedPlan?.id === planId) {
        setSelectedPlan({ ...selectedPlan, status, updated_at: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // ============================================================================
  // DELETE TREATMENT PLAN
  // ============================================================================

  const handleDeletePlan = async (planId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('treatment_plans')
        .delete()
        .eq('id', planId);

      if (deleteError) {
        console.error('Error deleting plan:', deleteError);
        return;
      }

      setPlans(plans.filter(p => p.id !== planId));
      setShowDetailModal(false);
      setSelectedPlan(null);
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
  };

  // ============================================================================
  // UPDATE PLAN IN DATABASE (helper function)
  // Note: milestones, products, routines, appointments columns don't exist in DB
  // These are managed locally in state only and won't persist across page refreshes
  // ============================================================================

  const updatePlanInDatabase = async (updatedPlan: TreatmentPlan) => {
    // Since milestones, products, routines, appointments columns don't exist in the DB,
    // we only update the updated_at timestamp to indicate the plan was modified
    try {
      const { error: updateError } = await supabase
        .from('treatment_plans')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedPlan.id);

      if (updateError) {
        console.error('Error updating plan:', updateError);
      }
    } catch (err) {
      console.error('Error updating plan:', err);
    }
  };


  // ============================================================================
  // MILESTONE HANDLERS - Integrated with treatment_plan_milestones table
  // ============================================================================

  const handleAddMilestone = async (milestone: Omit<TreatmentPlanMilestone, 'id' | 'plan_id' | 'completed'>) => {
    if (!selectedPlan) return;
    
    try {
      // Calculate order_index for the new milestone
      const orderIndex = selectedPlan.milestones.length;

      // Insert milestone into the database
      const { data: newMilestoneData, error: insertError } = await supabase
        .from('treatment_plan_milestones')
        .insert({
          plan_id: selectedPlan.id,
          title: milestone.title,
          description: milestone.description || null,
          target_date: milestone.target_date, // Format: 'YYYY-MM-DD' (date type)
          completed: false,
          order_index: orderIndex,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating milestone:', insertError);
        throw insertError;
      }

      // Map the returned data to TreatmentPlanMilestone interface
      const newMilestone: TreatmentPlanMilestone = {
        id: newMilestoneData.id,
        plan_id: newMilestoneData.plan_id,
        title: newMilestoneData.title,
        description: newMilestoneData.description || undefined,
        target_date: newMilestoneData.target_date,
        completed: newMilestoneData.completed || false,
        completed_at: newMilestoneData.completed_at || undefined,
      };

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        milestones: [...selectedPlan.milestones, newMilestone],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error adding milestone:', err);
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, data: Partial<TreatmentPlanMilestone>) => {
    if (!selectedPlan) return;

    try {
      // Prepare update data for the database
      const updateData: Record<string, any> = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.target_date !== undefined) updateData.target_date = data.target_date;
      if (data.completed !== undefined) {
        updateData.completed = data.completed;
        // Set completed_at timestamp when marking as completed
        updateData.completed_at = data.completed ? new Date().toISOString() : null;
      }

      // Update milestone in the database
      const { error: updateError } = await supabase
        .from('treatment_plan_milestones')
        .update(updateData)
        .eq('id', milestoneId);

      if (updateError) {
        console.error('Error updating milestone:', updateError);
        throw updateError;
      }

      // Update local state
      const updatedMilestones = selectedPlan.milestones.map(m => 
        m.id === milestoneId 
          ? { 
              ...m, 
              ...data,
              completed_at: data.completed ? new Date().toISOString() : (data.completed === false ? undefined : m.completed_at)
            } 
          : m
      );

      const updatedPlan = {
        ...selectedPlan,
        milestones: updatedMilestones,
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error updating milestone:', err);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!selectedPlan) return;

    try {
      // Delete milestone from the database
      const { error: deleteError } = await supabase
        .from('treatment_plan_milestones')
        .delete()
        .eq('id', milestoneId);

      if (deleteError) {
        console.error('Error deleting milestone:', deleteError);
        throw deleteError;
      }

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        milestones: selectedPlan.milestones.filter(m => m.id !== milestoneId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  };


  // ============================================================================
  // PRODUCT HANDLERS - Integrated with treatment_plan_products table
  // ============================================================================

  const handleAddProduct = async (product: Omit<TreatmentPlanProduct, 'id' | 'plan_id'>) => {
    if (!selectedPlan) return;

    try {
      // Insert product into the database
      // Table columns: id, plan_id, product_name, product_brand, product_category, usage_instructions, priority, created_at
      const { data: newProductData, error: insertError } = await supabase
        .from('treatment_plan_products')
        .insert({
          plan_id: selectedPlan.id,
          product_name: product.product_name,
          product_brand: product.product_brand || null,
          product_category: product.product_category || null,
          usage_instructions: product.usage_instructions || null,
          priority: product.priority || 'recommended',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating product:', insertError);
        throw insertError;
      }

      // Map the returned data to TreatmentPlanProduct interface
      const newProduct: TreatmentPlanProduct = {
        id: newProductData.id,
        plan_id: newProductData.plan_id,
        product_name: newProductData.product_name,
        product_brand: newProductData.product_brand || undefined,
        product_category: newProductData.product_category || undefined,
        usage_instructions: newProductData.usage_instructions || undefined,
        priority: newProductData.priority || 'recommended',
      };

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        products: [...selectedPlan.products, newProduct],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!selectedPlan) return;

    try {
      // Delete product from the database
      const { error: deleteError } = await supabase
        .from('treatment_plan_products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        throw deleteError;
      }

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        products: selectedPlan.products.filter(p => p.id !== productId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };




  // ============================================================================
  // ROUTINE HANDLERS - Integrated with treatment_plan_routines table
  // ============================================================================

  const handleAddRoutine = async (routine: Omit<TreatmentPlanRoutine, 'id' | 'plan_id'>) => {
    if (!selectedPlan) return;

    try {
      // Insert routine into the database
      // Table columns: id, plan_id, routine_name, routine_type, notes, created_at
      const { data: newRoutineData, error: insertError } = await supabase
        .from('treatment_plan_routines')
        .insert({
          plan_id: selectedPlan.id,
          routine_name: routine.routine_name,
          routine_type: routine.routine_type || null,
          notes: routine.notes || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating routine:', insertError);
        throw insertError;
      }

      // Map the returned data to TreatmentPlanRoutine interface
      const newRoutine: TreatmentPlanRoutine = {
        id: newRoutineData.id,
        plan_id: newRoutineData.plan_id,
        routine_name: newRoutineData.routine_name,
        routine_type: newRoutineData.routine_type || undefined,
        notes: newRoutineData.notes || undefined,
      };

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        routines: [...selectedPlan.routines, newRoutine],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error adding routine:', err);
    }
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!selectedPlan) return;

    try {
      // Delete routine from the database
      const { error: deleteError } = await supabase
        .from('treatment_plan_routines')
        .delete()
        .eq('id', routineId);

      if (deleteError) {
        console.error('Error deleting routine:', deleteError);
        throw deleteError;
      }

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        routines: selectedPlan.routines.filter(r => r.id !== routineId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };




  // ============================================================================
  // APPOINTMENT HANDLERS - Integrated with treatment_plan_appointments table
  // ============================================================================

  const handleAddAppointment = async (appointment: Omit<TreatmentPlanAppointment, 'id' | 'plan_id' | 'completed'>) => {
    if (!selectedPlan) return;

    try {
      // Insert appointment into the database
      // Table columns: id, plan_id, appointment_type, scheduled_date, scheduled_time, duration_minutes, notes, completed, created_at
      const { data: newAppointmentData, error: insertError } = await supabase
        .from('treatment_plan_appointments')
        .insert({
          plan_id: selectedPlan.id,
          appointment_type: appointment.appointment_type,
          scheduled_date: appointment.scheduled_date, // Format: 'YYYY-MM-DD' (date type)
          scheduled_time: appointment.scheduled_time || null, // Format: 'HH:MM:SS' or 'HH:MM' (time type)
          duration_minutes: appointment.duration_minutes || 60,
          notes: appointment.notes || null,
          completed: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating appointment:', insertError);
        throw insertError;
      }

      // Map the returned data to TreatmentPlanAppointment interface
      const newAppointment: TreatmentPlanAppointment = {
        id: newAppointmentData.id,
        plan_id: newAppointmentData.plan_id,
        appointment_type: newAppointmentData.appointment_type,
        scheduled_date: newAppointmentData.scheduled_date,
        scheduled_time: newAppointmentData.scheduled_time || undefined,
        duration_minutes: newAppointmentData.duration_minutes || 60,
        notes: newAppointmentData.notes || undefined,
        completed: newAppointmentData.completed || false,
      };

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        appointments: [...selectedPlan.appointments, newAppointment],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error adding appointment:', err);
    }
  };

  const handleUpdateAppointment = async (appointmentId: string, data: Partial<TreatmentPlanAppointment>) => {
    if (!selectedPlan) return;

    try {
      // Prepare update data for the database
      const updateData: Record<string, any> = {};
      
      if (data.appointment_type !== undefined) updateData.appointment_type = data.appointment_type;
      if (data.scheduled_date !== undefined) updateData.scheduled_date = data.scheduled_date;
      if (data.scheduled_time !== undefined) updateData.scheduled_time = data.scheduled_time || null;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.completed !== undefined) updateData.completed = data.completed;

      // Update appointment in the database
      const { error: updateError } = await supabase
        .from('treatment_plan_appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (updateError) {
        console.error('Error updating appointment:', updateError);
        throw updateError;
      }

      // Update local state
      const updatedAppointments = selectedPlan.appointments.map(a => 
        a.id === appointmentId ? { ...a, ...data } : a
      );

      const updatedPlan = {
        ...selectedPlan,
        appointments: updatedAppointments,
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!selectedPlan) return;

    try {
      // Delete appointment from the database
      const { error: deleteError } = await supabase
        .from('treatment_plan_appointments')
        .delete()
        .eq('id', appointmentId);

      if (deleteError) {
        console.error('Error deleting appointment:', deleteError);
        throw deleteError;
      }

      // Update local state
      const updatedPlan = {
        ...selectedPlan,
        appointments: selectedPlan.appointments.filter(a => a.id !== appointmentId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
      
      // Update the treatment plan's updated_at timestamp
      await updatePlanInDatabase(updatedPlan);
    } catch (err) {
      console.error('Error deleting appointment:', err);
    }
  };



  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedPlan(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Treatment Plans</h2>
          <p className="text-gray-500">Create comprehensive treatment plans for your clients</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" /> Create Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#CFAFA3]/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPlans}</p>
              <p className="text-xs text-gray-500">Total Plans</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Play className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activePlans}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{completedPlans}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{uniqueClients}</p>
              <p className="text-xs text-gray-500">Clients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="text-red-700 font-medium">{error}</p>
              <button
                onClick={fetchTreatmentPlans}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && plans.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Treatment Plans Yet</h3>
          <p className="text-gray-500 mb-6">Create your first treatment plan to help clients achieve their skincare goals</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" /> Create Your First Plan
          </button>
        </div>
      )}

      {/* Plans Grid */}
      {!loading && !error && plans.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const progress = calculatePlanProgress(plan);
            const client = clients.find(c => c.id === plan.client_id);

            return (
              <div
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan);
                  setShowDetailModal(true);
                }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={client?.image || CLIENT_IMAGES[0]}
                      alt={client?.name || 'Client'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-medium text-gray-900 line-clamp-1">{plan.title}</h3>
                      <p className="text-xs text-gray-500">{client?.name || 'Unknown Client'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                    {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                  </span>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-[#CFAFA3]">{progress.overallProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] rounded-full transition-all"
                      style={{ width: `${progress.overallProgress}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-bold text-gray-900">{progress.completedMilestones}/{progress.totalMilestones}</p>
                    <p className="text-xs text-gray-500">Milestones</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-bold text-gray-900">{plan.products.length}</p>
                    <p className="text-xs text-gray-500">Products</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-sm font-bold text-gray-900">{progress.daysRemaining}</p>
                    <p className="text-xs text-gray-500">Days Left</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span>{new Date(plan.start_date).toLocaleDateString()}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>{new Date(plan.end_date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateTreatmentPlanModal
        isOpen={showCreateModal}
        clients={clients}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePlan}
      />

      <TreatmentPlanDetailModal
        isOpen={showDetailModal}
        plan={selectedPlan}
        clients={clients}
        onClose={handleCloseDetailModal}
        onUpdateStatus={handleUpdateStatus}
        onDeletePlan={handleDeletePlan}
        onAddMilestone={handleAddMilestone}
        onUpdateMilestone={handleUpdateMilestone}
        onDeleteMilestone={handleDeleteMilestone}
        onAddProduct={handleAddProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddRoutine={handleAddRoutine}
        onDeleteRoutine={handleDeleteRoutine}
        onAddAppointment={handleAddAppointment}
        onUpdateAppointment={handleUpdateAppointment}
        onDeleteAppointment={handleDeleteAppointment}
      />
    </div>
  );
};

export default TreatmentPlansSection;
