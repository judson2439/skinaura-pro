/**
 * @fileoverview Admin Routines Section Component
 * Displays and manages all routine templates on the platform.
 */

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle,
  Users,
  Layers,
  Search,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { AdminRoutineTemplate, SCHEDULE_TYPES } from '../types';
import RoutineDetailModal from '../modals/RoutineDetailModal';
import RoutineDeleteModal from '../modals/RoutineDeleteModal';

interface RoutinesSectionProps {
  onRoutinesLoaded?: (routines: AdminRoutineTemplate[]) => void;
}

const RoutinesSection: React.FC<RoutinesSectionProps> = ({ onRoutinesLoaded }) => {
  const { authToken } = useAuth();
  const [routines, setRoutines] = useState<AdminRoutineTemplate[]>([]);
  const [filteredRoutines, setFilteredRoutines] = useState<AdminRoutineTemplate[]>([]);
  const [isLoadingRoutines, setIsLoadingRoutines] = useState(false);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [routineCurrentPage, setRoutineCurrentPage] = useState(1);
  const [totalRoutines, setTotalRoutines] = useState(0);
  const [selectedRoutine, setSelectedRoutine] = useState<AdminRoutineTemplate | null>(null);
  const [isRoutineDetailModalOpen, setIsRoutineDetailModalOpen] = useState(false);
  const [routineDetailModalMode, setRoutineDetailModalMode] = useState<'view' | 'edit'>('view');
  const [isRoutineDeleteModalOpen, setIsRoutineDeleteModalOpen] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<AdminRoutineTemplate | null>(null);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);
  const [selectedRoutines, setSelectedRoutines] = useState<Set<string>>(new Set());
  const routinesPerPage = 10;

  // Fetch routines from backend API
  const fetchRoutines = async () => {
    if (!authToken) return;

    setIsLoadingRoutines(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { routines: AdminRoutineTemplate[]; total: number };
      }>('/api/admin/routines');

      if (response.data.success && response.data.data) {
        setRoutines(response.data.data.routines || []);
        setTotalRoutines(response.data.data.total || 0);
        onRoutinesLoaded?.(response.data.data.routines || []);
      }
    } catch (error) {
      console.error('Error fetching routines:', error);
      setRoutines([]);
    } finally {
      setIsLoadingRoutines(false);
    }
  };

  // Filter routines based on search and filters
  useEffect(() => {
    let filtered = [...routines];

    if (routineSearchQuery) {
      const query = routineSearchQuery.toLowerCase();
      filtered = filtered.filter(routine =>
        routine.name.toLowerCase().includes(query) ||
        routine.description?.toLowerCase().includes(query) ||
        routine.professional_name?.toLowerCase().includes(query) ||
        routine.professional_email?.toLowerCase().includes(query)
      );
    }

    if (scheduleFilter !== 'all') {
      filtered = filtered.filter(routine => routine.schedule_type === scheduleFilter);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(routine => routine.is_active === true);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(routine => routine.is_active === false);
      }
    }

    setFilteredRoutines(filtered);
    setRoutineCurrentPage(1);
  }, [routines, routineSearchQuery, scheduleFilter, statusFilter]);

  // Fetch routines on mount
  useEffect(() => {
    fetchRoutines();
  }, [authToken]);

  // Paginated routines
  const paginatedRoutines = filteredRoutines.slice(
    (routineCurrentPage - 1) * routinesPerPage,
    routineCurrentPage * routinesPerPage
  );

  const totalRoutinePages = Math.ceil(filteredRoutines.length / routinesPerPage);

  // Routine stats
  const activeRoutinesCount = routines.filter(r => r.is_active).length;
  const totalStepsCount = routines.reduce((sum, r) => sum + (r.steps_count || 0), 0);
  const totalAssignmentsCount = routines.reduce((sum, r) => sum + (r.assignments_count || 0), 0);

  const handleViewRoutine = (routine: AdminRoutineTemplate) => {
    setSelectedRoutine(routine);
    setRoutineDetailModalMode('view');
    setIsRoutineDetailModalOpen(true);
  };

  const handleEditRoutine = (routine: AdminRoutineTemplate) => {
    setSelectedRoutine(routine);
    setRoutineDetailModalMode('edit');
    setIsRoutineDetailModalOpen(true);
  };

  const handleSaveRoutine = async (updatedRoutine: AdminRoutineTemplate) => {
    setRoutines(routines.map(r => r.id === updatedRoutine.id ? { ...r, ...updatedRoutine } : r));
    setIsRoutineDetailModalOpen(false);
  };

  const handleDeleteRoutine = (routine: AdminRoutineTemplate) => {
    setRoutineToDelete(routine);
    setIsRoutineDeleteModalOpen(true);
  };

  const confirmDeleteRoutine = async () => {
    if (!routineToDelete || !authToken) return;
    
    setIsDeletingRoutine(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.delete<{
        success: boolean;
        error?: string;
      }>(`/api/admin/routines/${routineToDelete.id}`);

      if (response.data.success) {
        setRoutines(routines.filter(r => r.id !== routineToDelete.id));
        setIsRoutineDeleteModalOpen(false);
        setRoutineToDelete(null);
      } else {
        throw new Error(response.data.error || 'Failed to delete routine');
      }
    } catch (error) {
      console.error('Error deleting routine:', error);
      alert('Failed to delete routine. Please try again.');
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const handleSelectRoutine = (routineId: string) => {
    const newSelected = new Set(selectedRoutines);
    if (newSelected.has(routineId)) {
      newSelected.delete(routineId);
    } else {
      newSelected.add(routineId);
    }
    setSelectedRoutines(newSelected);
  };

  const handleSelectAllRoutines = () => {
    if (selectedRoutines.size === paginatedRoutines.length) {
      setSelectedRoutines(new Set());
    } else {
      setSelectedRoutines(new Set(paginatedRoutines.map(r => r.id)));
    }
  };

  const handleBulkDeleteRoutines = async () => {
    if (selectedRoutines.size === 0 || !authToken) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedRoutines.size} routine(s)? This will also delete all associated steps and assignments.`)) return;

    setIsDeletingRoutine(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.post<{
        success: boolean;
        error?: string;
      }>('/api/admin/routines/bulk-delete', {
        routineIds: Array.from(selectedRoutines),
      });

      if (response.data.success) {
        setRoutines(routines.filter(r => !selectedRoutines.has(r.id)));
        setSelectedRoutines(new Set());
      } else {
        throw new Error(response.data.error || 'Failed to delete routines');
      }
    } catch (error) {
      console.error('Error deleting routines:', error);
      alert('Failed to delete routines. Please try again.');
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  const exportRoutines = () => {
    const csvContent = [
      ['ID', 'Name', 'Description', 'Schedule Type', 'Active', 'Steps', 'Assignments', 'Professional', 'Professional Email', 'Created At'].join(','),
      ...filteredRoutines.map(routine => [
        routine.id,
        `"${routine.name.replace(/"/g, '""')}"`,
        `"${(routine.description || '').replace(/"/g, '""')}"`,
        routine.schedule_type,
        routine.is_active ? 'Yes' : 'No',
        routine.steps_count || 0,
        routine.assignments_count || 0,
        `"${(routine.professional_name || '').replace(/"/g, '""')}"`,
        routine.professional_email || '',
        routine.created_at || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routines_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} min ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getScheduleIcon = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'evening':
        return <Moon className="w-4 h-4 text-indigo-500" />;
      case 'daily':
        return <RefreshCw className="w-4 h-4 text-green-500" />;
      case 'weekly':
        return <Calendar className="w-4 h-4 text-purple-500" />;
      default:
        return <ClipboardList className="w-4 h-4 text-gray-500" />;
    }
  };

  const getScheduleBadgeColor = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning':
        return 'bg-amber-100 text-amber-700';
      case 'evening':
        return 'bg-indigo-100 text-indigo-700';
      case 'daily':
        return 'bg-green-100 text-green-700';
      case 'weekly':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Routine Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage all routine templates across the platform ({totalRoutines} total routines)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportRoutines}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={fetchRoutines}
            disabled={isLoadingRoutines}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingRoutines ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={routineSearchQuery}
                onChange={(e) => setRoutineSearchQuery(e.target.value)}
                placeholder="Search by name, description, or professional..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Schedule:</span>
            <select
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 text-sm"
            >
              <option value="all">All Schedules</option>
              {SCHEDULE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {selectedRoutines.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selectedRoutines.size} selected</span>
              <button
                onClick={handleBulkDeleteRoutines}
                disabled={isDeletingRoutine}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalRoutines}</p>
              <p className="text-xs text-gray-500">Total Routines</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeRoutinesCount}</p>
              <p className="text-xs text-gray-500">Active Routines</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalStepsCount}</p>
              <p className="text-xs text-gray-500">Total Steps</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalAssignmentsCount}</p>
              <p className="text-xs text-gray-500">Client Assignments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Routines Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoadingRoutines ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredRoutines.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No routines found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRoutines.size === paginatedRoutines.length && paginatedRoutines.length > 0}
                        onChange={handleSelectAllRoutines}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Routine</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Schedule</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Steps</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Professional</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Created</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRoutines.map((routine) => (
                    <tr key={routine.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRoutines.has(routine.id)}
                          onChange={() => handleSelectRoutine(routine.id)}
                          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center">
                            <ClipboardList className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{routine.name}</p>
                            <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">
                              {routine.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getScheduleBadgeColor(routine.schedule_type)}`}>
                          {getScheduleIcon(routine.schedule_type)}
                          <span className="capitalize">{routine.schedule_type}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{routine.steps_count || 0}</span>
                          <span className="text-xs text-gray-500">steps</span>
                        </div>
                        {(routine.assignments_count || 0) > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Users className="w-3 h-3" />
                            {routine.assignments_count} assigned
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          routine.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {routine.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{routine.professional_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{routine.professional_email || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(routine.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleViewRoutine(routine)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button 
                            onClick={() => handleEditRoutine(routine)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </button>
                          <button 
                            onClick={() => handleDeleteRoutine(routine)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((routineCurrentPage - 1) * routinesPerPage) + 1} to {Math.min(routineCurrentPage * routinesPerPage, filteredRoutines.length)} of {filteredRoutines.length} routines
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRoutineCurrentPage(p => Math.max(1, p - 1))}
                  disabled={routineCurrentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalRoutinePages) }, (_, i) => {
                    let pageNum;
                    if (totalRoutinePages <= 5) {
                      pageNum = i + 1;
                    } else if (routineCurrentPage <= 3) {
                      pageNum = i + 1;
                    } else if (routineCurrentPage >= totalRoutinePages - 2) {
                      pageNum = totalRoutinePages - 4 + i;
                    } else {
                      pageNum = routineCurrentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setRoutineCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          routineCurrentPage === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setRoutineCurrentPage(p => Math.min(totalRoutinePages, p + 1))}
                  disabled={routineCurrentPage === totalRoutinePages || totalRoutinePages === 0}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Routine Modals */}
      <RoutineDetailModal
        routine={selectedRoutine}
        isOpen={isRoutineDetailModalOpen}
        onClose={() => setIsRoutineDetailModalOpen(false)}
        onSave={handleSaveRoutine}
        mode={routineDetailModalMode}
      />

      <RoutineDeleteModal
        routine={routineToDelete}
        isOpen={isRoutineDeleteModalOpen}
        onClose={() => {
          setIsRoutineDeleteModalOpen(false);
          setRoutineToDelete(null);
        }}
        onConfirm={confirmDeleteRoutine}
        isDeleting={isDeletingRoutine}
      />
    </div>
  );
};

export default RoutinesSection;
