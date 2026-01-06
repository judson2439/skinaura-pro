import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ClipboardList,
  Loader2,
  Edit,
  Trash2,
  Users,
  UserPlus,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  Routine,
  RoutineStep,
  RoutineClient,
  RoutineAssignment,
  ScheduleType,
  getScheduleIcon,
  getScheduleLabel,
  mapDBRoutineToFrontend,
  mapDBStepToFrontend,
  RoutineTemplateDB,
  RoutineStepDB,
  ClientRoutineAssignmentDB,
} from '@/components/professional/modals/routineTypes';
import CreateRoutineModal from '@/components/professional/modals/CreateRoutineModal';
import EditRoutineModal from '@/components/professional/modals/EditRoutineModal';
import AssignRoutineModal from '@/components/professional/modals/AssignRoutineModal';
import AddClientPlaceholderModal from '@/components/professional/modals/AddClientPlaceholderModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

interface ManageRoutinesSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// User profile type from database
interface UserProfileDB {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  skin_type: string | null;
  concerns: string[] | null;
  professional_id: string | null;
  created_at: string;
  updated_at: string;
}

// Delete confirmation state
interface DeleteConfirmation {
  routineId: string;
  routineName: string;
}

// ============================================================================
// DELETE CONFIRM MODAL COMPONENT
// ============================================================================

interface DeleteConfirmModalProps {
  isOpen: boolean;
  routineName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  routineName,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isDeleting ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
            Delete Routine
          </h3>
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{routineName}"</span>? 
            This will also remove all client assignments for this routine.
          </p>
          <p className="text-sm text-red-500 mt-2">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

const ManageRoutinesSection: React.FC<ManageRoutinesSectionProps> = ({
  onNavigateToView,
}) => {
  const { profile } = useAuth();
  const { toast } = useToast();

  // Data state
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [clients, setClients] = useState<RoutineClient[]>([]);
  const [assignments, setAssignments] = useState<RoutineAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selected routine for editing/assigning
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  // ============================================================================
  // FETCH CLIENTS FROM SUPABASE
  // ============================================================================

  const fetchClients = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Step 1: Get all client_ids from client_professional_relationships 
      // where professional_id matches current professional
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('client_professional_relationships')
        .select('client_id')
        .eq('professional_id', profile.id);

      if (relationshipsError) {
        console.error('Error fetching client_professional_relationships:', relationshipsError);
        return;
      }

      // Extract client_ids from relationships
      const clientIds = (relationshipsData || []).map(r => r.client_id);

      if (clientIds.length === 0) {
        setClients([]);
        return;
      }

      // Step 2: Fetch client details from user_profiles for all linked clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', clientIds)
        .order('full_name', { ascending: true });

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
      }

      // Map database clients to RoutineClient format
      const mappedClients: RoutineClient[] = (clientsData || []).map((client: UserProfileDB) => ({
        id: client.id,
        name: client.full_name || client.email,
        email: client.email,
        image: client.avatar_url || undefined,
        avatar_url: client.avatar_url || undefined,
        skin_type: client.skin_type || undefined,
        concerns: client.concerns || undefined,
        assignedRoutines: [],
      }));

      setClients(mappedClients);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  }, [profile?.id]);








  // ============================================================================
  // FETCH ASSIGNMENTS FROM SUPABASE
  // ============================================================================

  const fetchAssignments = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Fetch all active assignments for this professional
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('client_routine_assignments')
        .select('*')
        .eq('professional_id', profile.id)
        .eq('is_active', true);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        return;
      }

      // Map database assignments to RoutineAssignment format
      const mappedAssignments: RoutineAssignment[] = (assignmentsData || []).map((assignment: ClientRoutineAssignmentDB) => ({
        id: assignment.id,
        routine_id: assignment.routine_id,
        client_id: assignment.client_id,
        professional_id: assignment.professional_id,
        is_active: assignment.is_active,
        notes: assignment.notes || undefined,
        assigned_at: assignment.assigned_at,
        created_at: assignment.created_at,
        updated_at: assignment.updated_at,
      }));

      setAssignments(mappedAssignments);

      // Update clients with their assigned routines
      setClients(prevClients => prevClients.map(client => ({
        ...client,
        assignedRoutines: mappedAssignments
          .filter(a => a.client_id === client.id)
          .map(a => a.routine_id),
      })));
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  }, [profile?.id]);

  // ============================================================================
  // FETCH ROUTINES FROM SUPABASE
  // ============================================================================

  const fetchRoutines = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch routine templates for the current professional
      const { data: routineData, error: routineError } = await supabase
        .from('routine_templates')
        .select('*')
        .eq('professional_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (routineError) {
        console.error('Error fetching routines:', routineError);
        setError('Failed to load routines. Please try again.');
        return;
      }

      if (!routineData || routineData.length === 0) {
        setRoutines([]);
        return;
      }

      // Fetch all steps for these routines
      const routineIds = routineData.map((r: RoutineTemplateDB) => r.id);
      const { data: stepsData, error: stepsError } = await supabase
        .from('routine_steps')
        .select('*')
        .in('routine_id', routineIds)
        .order('step_order', { ascending: true });

      if (stepsError) {
        console.error('Error fetching routine steps:', stepsError);
        // Continue without steps
      }

      // Map database data to frontend format
      const mappedRoutines = routineData.map((routine: RoutineTemplateDB) => {
        const routineSteps = (stepsData || []).filter(
          (step: RoutineStepDB) => step.routine_id === routine.id
        );
        return mapDBRoutineToFrontend(routine, routineSteps);
      });

      setRoutines(mappedRoutines);
    } catch (err) {
      console.error('Error fetching routines:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Fetch all data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([fetchRoutines(), fetchClients()]);
      await fetchAssignments(); // Fetch assignments after clients are loaded
      setLoading(false);
    };
    fetchAllData();
  }, [fetchRoutines, fetchClients, fetchAssignments]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Get clients assigned to a routine
  const getRoutineClients = (routineId: string) => {
    const assignedClientIds = assignments
      .filter(a => a.routine_id === routineId)
      .map(a => a.client_id);
    return clients.filter(c => assignedClientIds.includes(c.id));
  };

  // Get clients who can be assigned (not already assigned to this routine)
  const getAssignableClients = (routineId: string) => {
    const assignedClientIds = assignments
      .filter(a => a.routine_id === routineId)
      .map(a => a.client_id);
    return clients.filter(c => !assignedClientIds.includes(c.id));
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateRoutine = async (name: string, description: string, scheduleType: ScheduleType) => {
    if (!profile?.id) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a routine.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Insert into routine_templates table
      const { data: newRoutineData, error: insertError } = await supabase
        .from('routine_templates')
        .insert({
          professional_id: profile.id,
          name: name.trim(),
          description: description.trim() || null,
          schedule_type: scheduleType,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating routine:', insertError);
        toast({
          title: 'Error',
          description: 'Failed to create routine. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Map the new routine to frontend format
      const newRoutine = mapDBRoutineToFrontend(newRoutineData as RoutineTemplateDB, []);

      // Update local state
      setRoutines(prev => [newRoutine, ...prev]);
      setShowCreateModal(false);

      toast({
        title: 'Success',
        description: 'Routine created successfully!',
      });

      // Open edit modal to add steps
      setSelectedRoutine(newRoutine);
      setShowEditModal(true);
    } catch (err) {
      console.error('Error creating routine:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open delete confirmation modal
  const openDeleteConfirmation = (routine: Routine) => {
    setDeleteConfirmation({
      routineId: routine.id,
      routineName: routine.name,
    });
  };

  // Close delete confirmation modal
  const closeDeleteConfirmation = () => {
    if (!isDeleting) {
      setDeleteConfirmation(null);
    }
  };

  // Confirm and execute delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    const routineId = deleteConfirmation.routineId;
    setIsDeleting(true);

    try {
      // First delete all steps for this routine
      const { error: stepsError } = await supabase
        .from('routine_steps')
        .delete()
        .eq('routine_id', routineId);

      if (stepsError) {
        console.error('Error deleting routine steps:', stepsError);
      }

      // Then delete the routine (or soft delete by setting is_active to false)
      const { error: routineError } = await supabase
        .from('routine_templates')
        .update({ is_active: false })
        .eq('id', routineId);

      if (routineError) {
        console.error('Error deleting routine:', routineError);
        toast({
          title: 'Error',
          description: 'Failed to delete routine. Please try again.',
          variant: 'destructive',
        });
        setIsDeleting(false);
        return;
      }

      // Also deactivate all assignments for this routine
      await supabase
        .from('client_routine_assignments')
        .update({ is_active: false })
        .eq('routine_id', routineId);

      // Update local state
      setRoutines(prev => prev.filter(r => r.id !== routineId));
      setAssignments(prev => prev.filter(a => a.routine_id !== routineId));

      toast({
        title: 'Success',
        description: 'Routine deleted successfully.',
      });

      // Close the modal
      setDeleteConfirmation(null);
    } catch (err) {
      console.error('Error deleting routine:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };


  const handleAddStep = async (step: Omit<RoutineStep, 'id' | 'step_order'>) => {
    if (!selectedRoutine) return;

    try {
      const newStepOrder = selectedRoutine.steps.length + 1;

      // Insert step into database
      const { data: newStepData, error: insertError } = await supabase
        .from('routine_steps')
        .insert({
          routine_id: selectedRoutine.id,
          step_order: newStepOrder,
          step_name: step.step_name || step.product_name || 'New Step',
          description: step.description || step.instructions || null,
          product_category: step.product_category || step.product_type || null,
          product_recommendation: step.product_recommendation || null,
          tips: step.tips || null,
          duration_seconds: step.duration_seconds || null,
          is_optional: step.is_optional || false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error adding step:', insertError);
        toast({
          title: 'Error',
          description: 'Failed to add step. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Map to frontend format
      const newStep = mapDBStepToFrontend(newStepData as RoutineStepDB);

      // Update selected routine
      const updatedRoutine = {
        ...selectedRoutine,
        steps: [...selectedRoutine.steps, newStep],
        updated_at: new Date().toISOString(),
      };

      setSelectedRoutine(updatedRoutine);
      setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutine : r));

      toast({
        title: 'Success',
        description: 'Step added successfully!',
      });
    } catch (err) {
      console.error('Error adding step:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedRoutine) return;

    try {
      // First delete any linked products for this step
      const { error: linkDeleteError } = await supabase
        .from('routine_step_products')
        .delete()
        .eq('routine_step_id', stepId);

      if (linkDeleteError) {
        console.error('Error deleting linked products:', linkDeleteError);
        // Continue with step deletion even if link deletion fails
      }

      // Delete step from database
      const { error: deleteError } = await supabase
        .from('routine_steps')
        .delete()
        .eq('id', stepId);

      if (deleteError) {
        console.error('Error deleting step:', deleteError);
        toast({
          title: 'Error',
          description: 'Failed to delete step. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state and reorder remaining steps
      const updatedSteps = selectedRoutine.steps
        .filter(s => s.id !== stepId)
        .map((s, idx) => ({ ...s, step_order: idx + 1, order: idx + 1 }));

      // Update step orders in database
      for (const step of updatedSteps) {
        await supabase
          .from('routine_steps')
          .update({ step_order: step.step_order })
          .eq('id', step.id);
      }

      const updatedRoutine = {
        ...selectedRoutine,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      };

      setSelectedRoutine(updatedRoutine);
      setRoutines(prev => prev.map(r => r.id === updatedRoutine.id ? updatedRoutine : r));

      toast({
        title: 'Success',
        description: 'Step deleted successfully.',
      });
    } catch (err) {
      console.error('Error deleting step:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };


  const handleAssignRoutine = async (clientId: string, notes: string) => {
    if (!selectedRoutine || !profile?.id) {
      toast({
        title: 'Error',
        description: 'Unable to assign routine. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check if assignment already exists
      const { data: existingAssignment, error: checkError } = await supabase
        .from('client_routine_assignments')
        .select('id, is_active')
        .eq('routine_id', selectedRoutine.id)
        .eq('client_id', clientId)
        .eq('professional_id', profile.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing assignment:', checkError);
      }

      let newAssignment: RoutineAssignment;

      if (existingAssignment) {
        // If assignment exists but is inactive, reactivate it
        if (!existingAssignment.is_active) {
          const { data: updatedAssignment, error: updateError } = await supabase
            .from('client_routine_assignments')
            .update({
              is_active: true,
              notes: notes.trim() || null,
              assigned_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingAssignment.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error reactivating assignment:', updateError);
            toast({
              title: 'Error',
              description: 'Failed to assign routine. Please try again.',
              variant: 'destructive',
            });
            return;
          }

          newAssignment = {
            id: updatedAssignment.id,
            routine_id: updatedAssignment.routine_id,
            client_id: updatedAssignment.client_id,
            professional_id: updatedAssignment.professional_id,
            is_active: updatedAssignment.is_active,
            notes: updatedAssignment.notes || undefined,
            assigned_at: updatedAssignment.assigned_at,
            created_at: updatedAssignment.created_at,
            updated_at: updatedAssignment.updated_at,
          };
        } else {
          // Assignment already exists and is active
          toast({
            title: 'Info',
            description: 'This routine is already assigned to this client.',
          });
          setShowAssignModal(false);
          setSelectedRoutine(null);
          return;
        }
      } else {
        // Insert new assignment into client_routine_assignments table
        const { data: insertedAssignment, error: insertError } = await supabase
          .from('client_routine_assignments')
          .insert({
            routine_id: selectedRoutine.id,
            client_id: clientId,
            professional_id: profile.id,
            is_active: true,
            notes: notes.trim() || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error assigning routine:', insertError);
          toast({
            title: 'Error',
            description: 'Failed to assign routine. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        newAssignment = {
          id: insertedAssignment.id,
          routine_id: insertedAssignment.routine_id,
          client_id: insertedAssignment.client_id,
          professional_id: insertedAssignment.professional_id,
          is_active: insertedAssignment.is_active,
          notes: insertedAssignment.notes || undefined,
          assigned_at: insertedAssignment.assigned_at,
          created_at: insertedAssignment.created_at,
          updated_at: insertedAssignment.updated_at,
        };
      }

      // Update local state
      setAssignments(prev => [...prev.filter(a => a.id !== newAssignment.id), newAssignment]);
      
      // Update client's assigned routines
      setClients(prevClients => prevClients.map(client => {
        if (client.id === clientId) {
          const updatedRoutines = [...new Set([...client.assignedRoutines, selectedRoutine.id])];
          return { ...client, assignedRoutines: updatedRoutines };
        }
        return client;
      }));

      setShowAssignModal(false);
      setSelectedRoutine(null);

      // Get client name for toast message
      const assignedClient = clients.find(c => c.id === clientId);
      toast({
        title: 'Success',
        description: `Routine "${selectedRoutine.name}" assigned to ${assignedClient?.name || 'client'} successfully!`,
      });
    } catch (err) {
      console.error('Error assigning routine:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenEditModal = (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowEditModal(true);
  };

  const handleOpenAssignModal = (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowAssignModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedRoutine(null);
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedRoutine(null);
  };

  const handleEditToAssign = () => {
    setShowEditModal(false);
    setShowAssignModal(true);
  };

  const handleAddClientFromAssign = () => {
    setShowAssignModal(false);
    setSelectedRoutine(null);
    setShowAddClientModal(true);
  };

  const handleNavigateToClients = () => {
    setShowAddClientModal(false);
    if (onNavigateToView) {
      onNavigateToView('clients');
    }
  };

  const assignableClients = selectedRoutine ? getAssignableClients(selectedRoutine.id) : clients;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Routine Templates</h2>
          <p className="text-gray-500">Create and manage skincare routines for your clients</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" /> Create Routine
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchRoutines}
            className="ml-auto text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && routines.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Routines Yet</h3>
          <p className="text-gray-500 mb-6">Create your first routine template to assign to clients</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" /> Create Your First Routine
          </button>
        </div>
      )}

      {/* Routines Grid */}
      {!loading && !error && routines.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routines.map((routine) => {
            const assignedClients = getRoutineClients(routine.id);
            return (
              <div key={routine.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      routine.schedule_type === 'morning' ? 'bg-amber-100' :
                      routine.schedule_type === 'evening' ? 'bg-indigo-100' :
                      routine.schedule_type === 'daily' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {getScheduleIcon(routine.schedule_type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{routine.name}</h3>
                      <p className="text-xs text-gray-500">{getScheduleLabel(routine.schedule_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(routine)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit Routine"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => openDeleteConfirmation(routine)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Routine"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {routine.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{routine.description}</p>
                )}

                {/* Steps Preview */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">{routine.steps.length} Steps</p>
                  <div className="space-y-1">
                    {routine.steps.slice(0, 3).map((step, idx) => (
                      <div key={step.id} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs flex items-center justify-center font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-gray-700 truncate">{step.step_name || step.product_name}</span>
                      </div>
                    ))}
                    {routine.steps.length > 3 && (
                      <p className="text-xs text-gray-400 pl-7">+{routine.steps.length - 3} more steps</p>
                    )}
                  </div>
                </div>

                {/* Assigned Clients */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">{assignedClients.length} clients</span>
                  </div>
                  <button
                    onClick={() => handleOpenAssignModal(routine)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" /> Assign
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateRoutineModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateRoutine}
      />

      <EditRoutineModal
        isOpen={showEditModal}
        routine={selectedRoutine}
        onClose={handleCloseEditModal}
        onAddStep={handleAddStep}
        onDeleteStep={handleDeleteStep}
        onAssign={handleEditToAssign}
      />

      <AssignRoutineModal
        isOpen={showAssignModal}
        routine={selectedRoutine}
        assignableClients={assignableClients}
        onClose={handleCloseAssignModal}
        onAssign={handleAssignRoutine}
        onAddClient={handleAddClientFromAssign}
      />

      <AddClientPlaceholderModal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        onNavigateToClients={handleNavigateToClients}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmation !== null}
        routineName={deleteConfirmation?.routineName || ''}
        isDeleting={isDeleting}
        onClose={closeDeleteConfirmation}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default ManageRoutinesSection;
