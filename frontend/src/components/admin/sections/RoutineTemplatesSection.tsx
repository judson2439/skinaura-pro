/**
 * @fileoverview Admin Routine Templates Section
 * List and create template routines (template_routine_templates + template_routine_steps).
 * Read: list + view detail. Create: new template with optional steps.
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Sun,
  Moon,
  Calendar,
  CalendarRange,
  ClipboardList,
  ChevronDown,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import {
  AdminRoutineTemplate,
  SCHEDULE_TYPES,
} from '../types';
import CreateTemplateRoutineModal from '../modals/CreateTemplateRoutineModal';
import TemplateRoutineDetailModal from '../modals/TemplateRoutineDetailModal';
import TemplateRoutineDeleteModal from '../modals/TemplateRoutineDeleteModal';

const RoutineTemplatesSection: React.FC = () => {
  const [templates, setTemplates] = useState<AdminRoutineTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<AdminRoutineTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{
    id: string;
    name: string;
    steps_count?: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    setIsLoading(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { templates: AdminRoutineTemplate[] };
      }>('/api/admin/template-routines');

      if (response.data.success && response.data.data) {
        setTemplates(response.data.data.templates || []);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching template routines:', error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    let filtered = [...templates];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
      );
    }
    if (scheduleFilter !== 'all') {
      filtered = filtered.filter((t) => t.schedule_type === scheduleFilter);
    }
    setFilteredTemplates(filtered);
  }, [templates, searchQuery, scheduleFilter]);

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchTemplates();
  };

  const handleViewTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setSelectedTemplateId(null);
    setIsDetailModalOpen(false);
  };

  const openDeleteModal = (template: AdminRoutineTemplate) => {
    setDeleteError(null);
    setTemplateToDelete({
      id: template.id,
      name: template.name,
      steps_count: template.steps_count,
    });
  };

  const closeDeleteModal = () => {
    if (!deletingId) setTemplateToDelete(null);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    const authToken = getAuthToken();
    if (!authToken) return;

    const { id } = templateToDelete;
    setDeleteError(null);
    setDeletingId(id);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.delete<{ success: boolean; error?: string }>(
        `/api/admin/template-routines/${id}`
      );
      if (response.data.success) {
        setTemplateToDelete(null);
        if (selectedTemplateId === id) {
          setSelectedTemplateId(null);
          setIsDetailModalOpen(false);
        }
        fetchTemplates();
      } else {
        setDeleteError(response.data.error || 'Failed to delete template.');
      }
    } catch (err) {
      console.error('Error deleting template routine:', err);
      setDeleteError('Failed to delete template routine. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getScheduleIcon = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'evening':
        return <Moon className="w-4 h-4 text-indigo-500" />;
      case 'custom':
      case 'daily':
        return <CalendarRange className="w-4 h-4 text-green-500" />;
      case 'weekly':
        return <Calendar className="w-4 h-4 text-purple-500" />;
      default:
        return <LayoutTemplate className="w-4 h-4 text-gray-500" />;
    }
  };

  const totalSteps = templates.reduce((sum, t) => sum + (t.steps_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Routine Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage platform template routines ({templates.length} templates, {totalSteps} total steps)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTemplates}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white text-sm font-medium rounded-xl hover:bg-[#B89A8E] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="routine-templates-schedule-filter" className="text-sm text-gray-500 shrink-0">
              Schedule:
            </label>
            <div className="relative">
              <select
                id="routine-templates-schedule-filter"
                value={scheduleFilter}
                onChange={(e) => setScheduleFilter(e.target.value)}
                className="min-w-[140px] pl-4 pr-9 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] focus:bg-white outline-none transition-all appearance-none cursor-pointer hover:bg-gray-50"
              >
                <option value="all">All</option>
                {SCHEDULE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20">
            <LayoutTemplate className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No template routines found</h3>
            <p className="text-gray-500 mb-4">
              {templates.length === 0
                ? 'Create your first template routine to get started.'
                : 'Try adjusting your search or filter.'}
            </p>
            {templates.length === 0 && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E]"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            )}
          </div>
        ) : (
          <>
            {deleteError && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center justify-between">
                <span>{deleteError}</span>
                <button
                  type="button"
                  onClick={() => setDeleteError(null)}
                  className="text-red-500 hover:text-red-700 font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Steps
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                        {getScheduleIcon(template.schedule_type)}
                        {SCHEDULE_TYPES.find((s) => s.value === template.schedule_type)?.label ||
                          (template.schedule_type === 'daily' ? 'Custom' : template.schedule_type)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">
                        {template.steps_count ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                          template.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {template.created_at
                        ? new Date(template.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewTemplate(template.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => openDeleteModal(template)}
                          disabled={deletingId === template.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete template"
                        >
                          {deletingId === template.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <CreateTemplateRoutineModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <TemplateRoutineDetailModal
        templateId={selectedTemplateId}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        onSuccess={fetchTemplates}
      />

      <TemplateRoutineDeleteModal
        templateName={templateToDelete?.name ?? ''}
        stepsCount={templateToDelete?.steps_count ?? 0}
        isOpen={templateToDelete !== null}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteTemplate}
        isDeleting={deletingId !== null}
      />
    </div>
  );
};

export default RoutineTemplatesSection;
