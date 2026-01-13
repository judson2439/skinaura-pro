/**
 * @fileoverview Routine Detail Modal for Admin
 * View and edit routine details including steps.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ClipboardList,
  Sun,
  Moon,
  RefreshCw,
  Calendar,
  User,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { AdminRoutineTemplate, AdminRoutineStep, SCHEDULE_TYPES } from '../types';

interface RoutineDetailModalProps {
  routine: AdminRoutineTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (routine: AdminRoutineTemplate) => void;
  mode: 'view' | 'edit';
}

const RoutineDetailModal: React.FC<RoutineDetailModalProps> = ({
  routine,
  isOpen,
  onClose,
  onSave,
  mode,
}) => {
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [steps, setSteps] = useState<AdminRoutineStep[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule_type: 'morning',
    is_active: true,
  });

  // Update form data when routine changes
  useEffect(() => {
    if (routine) {
      setFormData({
        name: routine.name,
        description: routine.description || '',
        schedule_type: routine.schedule_type,
        is_active: routine.is_active,
      });
      fetchRoutineSteps(routine.id);
    }
  }, [routine]);

  // Update editing mode when mode prop changes
  useEffect(() => {
    setIsEditing(mode === 'edit');
  }, [mode]);

  // Fetch routine steps with linked products from backend API
  const fetchRoutineSteps = async (routineId: string) => {
    const authToken = getAuthToken();
    if (!authToken) return;

    setIsLoadingSteps(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { steps: AdminRoutineStep[] };
      }>(`/api/admin/routines/${routineId}/steps`);

      if (response.data.success && response.data.data) {
        setSteps(response.data.data.steps || []);
      } else {
        setSteps([]);
      }
    } catch (err) {
      console.error('Error fetching routine steps:', err);
      setError('Failed to load routine steps');
    } finally {
      setIsLoadingSteps(false);
    }
  };

  const handleSave = async () => {
    const authToken = getAuthToken();
    if (!routine || !authToken) return;

    setIsSaving(true);
    setError(null);

    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.put<{
        success: boolean;
        error?: string;
      }>(`/api/admin/routines/${routine.id}`, {
        name: formData.name,
        description: formData.description || null,
        schedule_type: formData.schedule_type,
        is_active: formData.is_active,
      });

      if (response.data.success) {
        onSave({
          ...routine,
          name: formData.name,
          description: formData.description || null,
          schedule_type: formData.schedule_type,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        });

        setIsEditing(false);
      } else {
        throw new Error(response.data.error || 'Failed to update routine');
      }
    } catch (err) {
      console.error('Error updating routine:', err);
      setError('Failed to update routine. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStepExpanded = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getScheduleIcon = (scheduleType: string) => {
    switch (scheduleType) {
      case 'morning':
        return <Sun className="w-5 h-5 text-amber-500" />;
      case 'evening':
        return <Moon className="w-5 h-5 text-indigo-500" />;
      case 'daily':
        return <RefreshCw className="w-5 h-5 text-green-500" />;
      case 'weekly':
        return <Calendar className="w-5 h-5 text-purple-500" />;
      default:
        return <ClipboardList className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !routine) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Edit Routine' : 'Routine Details'}
              </h2>
              <p className="text-sm text-gray-500">
                {routine.professional_name || 'Unknown Professional'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Routine Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                />
              ) : (
                <p className="text-gray-900 font-medium">{routine.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
                />
              ) : (
                <p className="text-gray-600">{routine.description || 'No description'}</p>
              )}
            </div>

            {/* Schedule Type & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Type
                </label>
                {isEditing ? (
                  <select
                    value={formData.schedule_type}
                    onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                  >
                    {SCHEDULE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    {getScheduleIcon(routine.schedule_type)}
                    <span className="text-gray-900 capitalize">{routine.schedule_type}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: true })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.is_active
                          ? 'bg-green-100 text-green-700 border-2 border-green-300'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: false })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        !formData.is_active
                          ? 'bg-gray-200 text-gray-700 border-2 border-gray-400'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                ) : (
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      routine.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {routine.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
            </div>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User className="w-4 h-4" />
                <span>Professional: {routine.professional_email || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Created: {formatDate(routine.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Steps Section */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#CFAFA3]" />
              Routine Steps ({steps.length})
            </h3>

            {isLoadingSteps ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#CFAFA3]" />
              </div>
            ) : steps.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No steps in this routine</p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="border border-gray-200 rounded-xl overflow-hidden"
                  >
                    {/* Step Header */}
                    <button
                      onClick={() => toggleStepExpanded(step.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center text-sm font-medium text-[#CFAFA3]">
                          {index + 1}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{step.step_name}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            {step.product_category && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                {step.product_category}
                              </span>
                            )}
                            {step.duration_seconds && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(step.duration_seconds)}
                              </span>
                            )}
                            {step.is_optional && (
                              <span className="text-amber-600">Optional</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {expandedSteps.has(step.id) ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* Step Details (Expanded) */}
                    {expandedSteps.has(step.id) && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                        <div className="space-y-3 text-sm">
                          {step.description && (
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Description</p>
                              <p className="text-gray-700">{step.description}</p>
                            </div>
                          )}
                          {step.tips && (
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Tips</p>
                              <p className="text-gray-700">{step.tips}</p>
                            </div>
                          )}
                          {step.product_recommendation && (
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Product Recommendation</p>
                              <p className="text-gray-700">{step.product_recommendation}</p>
                            </div>
                          )}
                          {step.linked_product && (
                            <div>
                              <p className="text-gray-500 text-xs mb-1">Linked Product</p>
                              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                                {step.linked_product.image_url ? (
                                  <img
                                    src={step.linked_product.image_url}
                                    alt={step.linked_product.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {step.linked_product.name}
                                  </p>
                                  {step.linked_product.brand && (
                                    <p className="text-xs text-gray-500">
                                      {step.linked_product.brand}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
          <div className="text-sm text-gray-500">
            Last updated: {formatDate(routine.updated_at)}
          </div>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: routine.name,
                      description: routine.description || '',
                      schedule_type: routine.schedule_type,
                      is_active: routine.is_active,
                    });
                  }}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Edit Routine
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutineDetailModal;
