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
  TreatmentPlanPdf,
  getStatusColor,
  calculatePlanProgress,
  CLIENT_IMAGES,
} from '@/components/professional/modals/treatmentPlanTypes';
import CreateTreatmentPlanModal from '@/components/professional/modals/CreateTreatmentPlanModal';
import TreatmentPlanDetailModal from '@/components/professional/modals/TreatmentPlanDetailModal';
import EncryptedImage from '@/components/ui/encrypted-image';
import { apiClient } from '@/lib/apiClient';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { fixUtf8Mojibake } from '@/lib/utils';

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
  // Auth session is managed by authStorage
  
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
  // FETCH CLIENTS FROM BACKEND API
  // ============================================================================
  
  const fetchClients = async () => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    
    if (!token) {
      setClientsLoading(false);
      return;
    }

    setClientsLoading(true);

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { clients: Array<{ id: string; full_name: string | null; avatar_url: string | null }> };
        error?: string;
      }>('/api/treatment-plans/clients');

      if (response.data.success && response.data.data) {
        const clientsData = response.data.data.clients || [];

        // Map database data to TreatmentPlanClient interface (only use actual avatar_url; no placeholder images)
        const mappedClients: TreatmentPlanClient[] = clientsData.map((clientData) => ({
          id: clientData.id,
          name: clientData.full_name || 'Unknown',
          image: clientData.avatar_url || '',
        }));

        setClients(mappedClients);
      } else {
        console.error('Error fetching clients:', response.data.error);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setClientsLoading(false);
    }
  };


  // ============================================================================
  // FETCH TREATMENT PLANS FROM BACKEND API
  // ============================================================================

  const fetchTreatmentPlans = async () => {
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
      
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          plans: any[];
          milestones: any[];
          products: any[];
          routines: any[];
          appointments: any[];
          pdfs: any[];
        };
        error?: string;
      }>('/api/treatment-plans');

      if (!response.data.success || !response.data.data) {
        console.error('Error fetching treatment plans:', response.data.error);
        setError(response.data.error || 'Failed to load treatment plans');
        setLoading(false);
        return;
      }

      const plansData = response.data.data?.plans || [];
      const milestonesData = response.data.data?.milestones || [];
      const productsData = response.data.data?.products || [];
      const routinesData = response.data.data?.routines || [];
      const appointmentsData = response.data.data?.appointments || [];
      const pdfsData = response.data.data?.pdfs || [];

      // Group related data by plan_id
      const milestonesMap: Record<string, TreatmentPlanMilestone[]> = {};
      const productsMap: Record<string, TreatmentPlanProduct[]> = {};
      const routinesMap: Record<string, TreatmentPlanRoutine[]> = {};
      const appointmentsMap: Record<string, TreatmentPlanAppointment[]> = {};
      const pdfsMap: Record<string, TreatmentPlanPdf[]> = {};

      milestonesData.forEach((milestone: any) => {
        if (!milestonesMap[milestone.plan_id]) milestonesMap[milestone.plan_id] = [];
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

      productsData.forEach((product: any) => {
        if (!productsMap[product.plan_id]) productsMap[product.plan_id] = [];
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

      routinesData.forEach((routine: any) => {
        if (!routinesMap[routine.plan_id]) routinesMap[routine.plan_id] = [];
        routinesMap[routine.plan_id].push({
          id: routine.id,
          plan_id: routine.plan_id,
          routine_name: routine.routine_name,
          routine_type: routine.routine_type || undefined,
          notes: routine.notes || undefined,
        });
      });

      appointmentsData.forEach((appointment: any) => {
        if (!appointmentsMap[appointment.plan_id]) appointmentsMap[appointment.plan_id] = [];
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

      pdfsData.forEach((pdf: any) => {
        if (!pdfsMap[pdf.plan_id]) pdfsMap[pdf.plan_id] = [];
        pdfsMap[pdf.plan_id].push({
          id: pdf.id,
          plan_id: pdf.plan_id,
          professional_pdf_upload_id: pdf.professional_pdf_upload_id,
          original_name: pdf.original_name || 'PDF',
          created_at: pdf.created_at,
        });
      });

      // Map database data to TreatmentPlan interface
      const mappedPlans: TreatmentPlan[] = plansData.map((plan: any) => ({
        id: plan.id,
        client_id: plan.client_id,
        professional_id: plan.professional_id,
        title: plan.title,
        description: plan.description || undefined,
        goals: plan.goals || [],
        start_date: plan.start_date,
        end_date: plan.end_date,
        status: plan.status || 'active',
        milestones: milestonesMap[plan.id] || [],
        products: productsMap[plan.id] || [],
        routines: routinesMap[plan.id] || [],
        appointments: appointmentsMap[plan.id] || [],
        pdfs: pdfsMap[plan.id] || [],
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








  // Fetch data on mount
  useEffect(() => {
    fetchClients();
    fetchTreatmentPlans();
  }, []);

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
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) {
      console.error('No auth token');
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { plan: any };
        error?: string;
      }>('/api/treatment-plans', {
        client_id: data.clientId,
        title: data.title,
        description: data.description || null,
        goals: data.goals,
        start_date: data.startDate,
        end_date: data.endDate,
        notes: data.notes || null,
      });

      if (!response.data.success || !response.data.data?.plan) {
        console.error('Error creating treatment plan:', response.data.error);
        throw new Error(response.data.error || 'Failed to create plan');
      }

      const newPlanData = response.data.data.plan;

      // Map the returned data to TreatmentPlan interface
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
        milestones: [],
        products: [],
        routines: [],
        appointments: [],
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
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        data?: { plan: any };
        error?: string;
      }>(`/api/treatment-plans/${planId}/status`, { status });

      if (!response.data.success) {
        console.error('Error updating status:', response.data.error);
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
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/treatment-plans/${planId}`);

      if (!response.data.success) {
        console.error('Error deleting plan:', response.data.error);
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
  // Updates the updated_at timestamp when related data changes
  // ============================================================================

  const updatePlanInDatabase = async (_updatedPlan: TreatmentPlan) => {
    // The backend endpoints already update the plan's updated_at timestamp
    // This function is kept for compatibility but no longer needed
  };


  // ============================================================================
  // MILESTONE HANDLERS - Integrated with treatment_plan_milestones table
  // ============================================================================

  const handleAddMilestone = async (milestone: Omit<TreatmentPlanMilestone, 'id' | 'plan_id' | 'completed'>) => {
    if (!selectedPlan) return;
    
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { milestone: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/milestones`, {
        title: milestone.title,
        description: milestone.description || null,
        target_date: milestone.target_date,
      });

      if (!response.data.success || !response.data.data?.milestone) {
        console.error('Error creating milestone:', response.data.error);
        return;
      }

      const newMilestoneData = response.data.data.milestone;

      const newMilestone: TreatmentPlanMilestone = {
        id: newMilestoneData.id,
        plan_id: newMilestoneData.plan_id,
        title: newMilestoneData.title,
        description: newMilestoneData.description || undefined,
        target_date: newMilestoneData.target_date,
        completed: newMilestoneData.completed || false,
        completed_at: newMilestoneData.completed_at || undefined,
      };

      const updatedPlan = {
        ...selectedPlan,
        milestones: [...selectedPlan.milestones, newMilestone],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error adding milestone:', err);
    }
  };

  const handleUpdateMilestone = async (milestoneId: string, data: Partial<TreatmentPlanMilestone>) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        data?: { milestone: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/milestones/${milestoneId}`, data);

      if (!response.data.success) {
        console.error('Error updating milestone:', response.data.error);
        return;
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
    } catch (err) {
      console.error('Error updating milestone:', err);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/milestones/${milestoneId}`);

      if (!response.data.success) {
        console.error('Error deleting milestone:', response.data.error);
        return;
      }

      const updatedPlan = {
        ...selectedPlan,
        milestones: selectedPlan.milestones.filter(m => m.id !== milestoneId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error deleting milestone:', err);
    }
  };


  // ============================================================================
  // PRODUCT HANDLERS - Integrated with treatment_plan_products table
  // ============================================================================

  const handleAddProduct = async (product: Omit<TreatmentPlanProduct, 'id' | 'plan_id'>) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { product: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/products`, {
        product_name: product.product_name,
        product_brand: product.product_brand || null,
        product_category: product.product_category || null,
        usage_instructions: product.usage_instructions || null,
        priority: product.priority || 'recommended',
      });

      if (!response.data.success || !response.data.data?.product) {
        console.error('Error creating product:', response.data.error);
        return;
      }

      const newProductData = response.data.data.product;

      const newProduct: TreatmentPlanProduct = {
        id: newProductData.id,
        plan_id: newProductData.plan_id,
        product_name: newProductData.product_name,
        product_brand: newProductData.product_brand || undefined,
        product_category: newProductData.product_category || undefined,
        usage_instructions: newProductData.usage_instructions || undefined,
        priority: newProductData.priority || 'recommended',
      };

      const updatedPlan = {
        ...selectedPlan,
        products: [...selectedPlan.products, newProduct],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/products/${productId}`);

      if (!response.data.success) {
        console.error('Error deleting product:', response.data.error);
        return;
      }

      const updatedPlan = {
        ...selectedPlan,
        products: selectedPlan.products.filter(p => p.id !== productId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };




  // ============================================================================
  // ROUTINE HANDLERS - Integrated with treatment_plan_routines table
  // ============================================================================

  const handleAddRoutine = async (routine: Omit<TreatmentPlanRoutine, 'id' | 'plan_id'>) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { routine: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/routines`, {
        routine_name: routine.routine_name,
        routine_type: routine.routine_type || null,
        notes: routine.notes || null,
      });

      if (!response.data.success || !response.data.data?.routine) {
        console.error('Error creating routine:', response.data.error);
        return;
      }

      const newRoutineData = response.data.data.routine;

      const newRoutine: TreatmentPlanRoutine = {
        id: newRoutineData.id,
        plan_id: newRoutineData.plan_id,
        routine_name: newRoutineData.routine_name,
        routine_type: newRoutineData.routine_type || undefined,
        notes: newRoutineData.notes || undefined,
      };

      const updatedPlan = {
        ...selectedPlan,
        routines: [...selectedPlan.routines, newRoutine],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error adding routine:', err);
    }
  };

  const handleDeleteRoutine = async (routineId: string) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/routines/${routineId}`);

      if (!response.data.success) {
        console.error('Error deleting routine:', response.data.error);
        return;
      }

      const updatedPlan = {
        ...selectedPlan,
        routines: selectedPlan.routines.filter(r => r.id !== routineId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error deleting routine:', err);
    }
  };




  // ============================================================================
  // APPOINTMENT HANDLERS - Integrated with treatment_plan_appointments table
  // ============================================================================

  const handleAddAppointment = async (appointment: Omit<TreatmentPlanAppointment, 'id' | 'plan_id' | 'completed'>) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { appointment: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/appointments`, {
        appointment_type: appointment.appointment_type,
        scheduled_date: appointment.scheduled_date,
        scheduled_time: appointment.scheduled_time || null,
        duration_minutes: appointment.duration_minutes || 60,
        notes: appointment.notes || null,
      });

      if (!response.data.success || !response.data.data?.appointment) {
        console.error('Error creating appointment:', response.data.error);
        return;
      }

      const newAppointmentData = response.data.data.appointment;

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

      const updatedPlan = {
        ...selectedPlan,
        appointments: [...selectedPlan.appointments, newAppointment],
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error adding appointment:', err);
    }
  };

  const handleUpdateAppointment = async (appointmentId: string, data: Partial<TreatmentPlanAppointment>) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        data?: { appointment: any };
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/appointments/${appointmentId}`, data);

      if (!response.data.success) {
        console.error('Error updating appointment:', response.data.error);
        return;
      }

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
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!selectedPlan) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/treatment-plans/${selectedPlan.id}/appointments/${appointmentId}`);

      if (!response.data.success) {
        console.error('Error deleting appointment:', response.data.error);
        return;
      }

      const updatedPlan = {
        ...selectedPlan,
        appointments: selectedPlan.appointments.filter(a => a.id !== appointmentId),
        updated_at: new Date().toISOString(),
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    } catch (err) {
      console.error('Error deleting appointment:', err);
    }
  };

  // ============================================================================
  // ATTACHED PDF HANDLERS
  // ============================================================================

  const handleAddPdf = async (pdf_upload_id: string) => {
    if (!selectedPlan) return;
    const token = getAuthSession()?.token || getAuthToken();
    if (!token) return;
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.post<{ success: boolean; data?: { attachment: TreatmentPlanPdf | null }; error?: string }>(
        `/api/treatment-plans/${selectedPlan.id}/pdfs`,
        { pdf_upload_id }
      );
      if (!response.data.success) {
        console.error('Error attaching PDF:', response.data.error);
        return;
      }
      const attachment = response.data.data?.attachment;
      if (attachment) {
        const updatedPlan = {
          ...selectedPlan,
          pdfs: [...selectedPlan.pdfs, attachment],
          updated_at: new Date().toISOString(),
        };
        setSelectedPlan(updatedPlan);
        setPlans(plans.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
      }
    } catch (err) {
      console.error('Error attaching PDF:', err);
    }
  };

  const handleDeletePdf = async (attachmentId: string) => {
    if (!selectedPlan) return;
    const token = getAuthSession()?.token || getAuthToken();
    if (!token) return;
    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.delete<{ success: boolean; error?: string }>(
        `/api/treatment-plans/${selectedPlan.id}/pdfs/${attachmentId}`
      );
      if (!response.data.success) {
        console.error('Error removing PDF:', response.data.error);
        return;
      }
      const updatedPlan = {
        ...selectedPlan,
        pdfs: selectedPlan.pdfs.filter(p => p.id !== attachmentId),
        updated_at: new Date().toISOString(),
      };
      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
    } catch (err) {
      console.error('Error removing PDF:', err);
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
                    {client?.image ? (
                      <EncryptedImage
                        src={client.image}
                        alt={client?.name || 'Client'}
                        className="w-10 h-10 rounded-full object-cover"
                        fallbackClassName="w-10 h-10 rounded-full bg-gradient-to-br from-[#cab0a5] to-[#a57865] flex items-center justify-center text-white text-sm font-medium"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium flex-shrink-0">
                        {(client?.name || 'U').trim().split(/\s+/).filter(Boolean).map((s) => s[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900 line-clamp-1">{fixUtf8Mojibake(plan.title)}</h3>
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
        onAddPdf={handleAddPdf}
        onDeletePdf={handleDeletePdf}
      />
    </div>
  );
};

export default TreatmentPlansSection;
