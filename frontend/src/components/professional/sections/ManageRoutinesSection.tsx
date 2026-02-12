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
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { getAuthSession } from '@/lib/authStorage';
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
  const session = getAuthSession();
  const profile = session?.user;
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
  // FETCH CLIENTS FROM BACKEND API
  // ============================================================================

  const fetchClients = useCallback(async () => {
    if (!profile?.id) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { clients: UserProfileDB[] };
        error?: string;
      }>('/api/routines/clients/list');

      if (!response.data.success) {
        console.error('Error fetching clients:', response.data.error);
        return;
      }

      const clientsData = response.data.data?.clients || [];

      // Map database clients to RoutineClient format
      const mappedClients: RoutineClient[] = clientsData.map((client: UserProfileDB) => ({
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
  // FETCH ASSIGNMENTS FROM BACKEND API
  // ============================================================================

  const fetchAssignments = useCallback(async () => {
    if (!profile?.id) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { assignments: ClientRoutineAssignmentDB[] };
        error?: string;
      }>('/api/routines/assignments');

      if (!response.data.success) {
        console.error('Error fetching assignments:', response.data.error);
        return;
      }

      const assignmentsData = response.data.data?.assignments || [];

      // Map database assignments to RoutineAssignment format
      const mappedAssignments: RoutineAssignment[] = assignmentsData.map((assignment: ClientRoutineAssignmentDB) => ({
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
  // FETCH ROUTINES FROM BACKEND API
  // ============================================================================

  const fetchRoutines = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { routines: RoutineTemplateDB[]; steps: RoutineStepDB[] };
        error?: string;
      }>('/api/routines');

      if (!response.data.success) {
        console.error('Error fetching routines:', response.data.error);
        setError('Failed to load routines. Please try again.');
        return;
      }

      const routineData = response.data.data?.routines || [];
      const stepsData = response.data.data?.steps || [];

      if (routineData.length === 0) {
        setRoutines([]);
        return;
      }

      // Map database data to frontend format
      const mappedRoutines = routineData.map((routine: RoutineTemplateDB) => {
        const routineSteps = stepsData.filter(
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

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { routine: RoutineTemplateDB };
        error?: string;
      }>('/api/routines', {
        name: name.trim(),
        description: description.trim() || null,
        schedule_type: scheduleType,
      });

      if (!response.data.success || !response.data.data?.routine) {
        console.error('Error creating routine:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to create routine. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Map the new routine to frontend format
      const newRoutine = mapDBRoutineToFrontend(response.data.data.routine, []);

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

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication required.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/routines/${routineId}`);

      if (!response.data.success) {
        console.error('Error deleting routine:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to delete routine. Please try again.',
          variant: 'destructive',
        });
        setIsDeleting(false);
        return;
      }

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

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { step: RoutineStepDB };
        error?: string;
      }>(`/api/routines/${selectedRoutine.id}/steps`, {
        step_name: step.step_name || step.product_name || 'New Step',
        description: step.description || step.instructions || null,
        product_category: step.product_category || step.product_type || null,
        product_recommendation: step.product_recommendation || null,
        tips: step.tips || null,
        duration_seconds: step.duration_seconds || null,
        is_optional: step.is_optional || false,
      });

      if (!response.data.success || !response.data.data?.step) {
        console.error('Error adding step:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to add step. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Map to frontend format
      const newStep = mapDBStepToFrontend(response.data.data.step);

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

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/routines/${selectedRoutine.id}/steps/${stepId}`);

      if (!response.data.success) {
        console.error('Error deleting step:', response.data.error);
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

  const handleUpdateRoutineName = async (routineId: string, name: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.patch<{
        success: boolean;
        data?: { routine: { id: string; name: string } };
        error?: string;
      }>(`/api/routines/${routineId}`, { name: name.trim() });

      if (!response.data.success || !response.data.data?.routine) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to update routine name.',
          variant: 'destructive',
        });
        return;
      }

      const updatedName = response.data.data.routine.name;
      setRoutines(prev =>
        prev.map(r => (r.id === routineId ? { ...r, name: updatedName } : r))
      );
      if (selectedRoutine?.id === routineId) {
        setSelectedRoutine(prev => (prev ? { ...prev, name: updatedName } : null));
      }
    } catch (err) {
      console.error('Error updating routine name:', err);
      toast({
        title: 'Error',
        description: 'Failed to update routine name. Please try again.',
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

    const token = getAuthToken();
    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { assignment: ClientRoutineAssignmentDB };
        message?: string;
        error?: string;
      }>('/api/routines/assignments', {
        routine_id: selectedRoutine.id,
        client_id: clientId,
        notes: notes.trim() || null,
      });

      if (!response.data.success) {
        console.error('Error assigning routine:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to assign routine. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Check if it was already assigned
      if (response.data.message === 'Routine is already assigned to this client') {
        toast({
          title: 'Info',
          description: 'This routine is already assigned to this client.',
        });
        setShowAssignModal(false);
        setSelectedRoutine(null);
        return;
      }

      const assignmentData = response.data.data?.assignment;
      if (!assignmentData) {
        toast({
          title: 'Error',
          description: 'Failed to assign routine. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const newAssignment: RoutineAssignment = {
        id: assignmentData.id,
        routine_id: assignmentData.routine_id,
        client_id: assignmentData.client_id,
        professional_id: assignmentData.professional_id,
        is_active: assignmentData.is_active,
        notes: assignmentData.notes || undefined,
        assigned_at: assignmentData.assigned_at,
        created_at: assignmentData.created_at,
        updated_at: assignmentData.updated_at,
      };

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
        onUpdateName={handleUpdateRoutineName}
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
