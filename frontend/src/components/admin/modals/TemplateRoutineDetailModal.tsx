/**
 * @fileoverview Template Routine Detail Modal (Admin)
 * View and edit a single template routine with its steps.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Sun,
  Moon,
  Calendar,
  RefreshCw,
  Package,
  Edit2,
  Trash2,
  Plus,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import {
  AdminRoutineTemplate,
  AdminRoutineStep,
  SCHEDULE_TYPES,
  PRODUCT_CATEGORIES,
} from '../types';

interface TemplateRoutineDetailModalProps {
  templateId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ScheduleValue = 'morning' | 'evening' | 'daily' | 'weekly';

const SCHEDULE_OPTIONS: { value: ScheduleValue; label: string; icon: typeof Sun }[] = [
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'evening', label: 'Evening', icon: Moon },
  { value: 'daily', label: 'Daily', icon: RefreshCw },
  { value: 'weekly', label: 'Weekly', icon: Calendar },
];

const TemplateRoutineDetailModal: React.FC<TemplateRoutineDetailModalProps> = ({
  templateId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [template, setTemplate] = useState<AdminRoutineTemplate | null>(null);
  const [steps, setSteps] = useState<AdminRoutineStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Edit form state (only used in edit mode)
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSchedule, setFormSchedule] = useState<ScheduleValue>('morning');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSteps, setFormSteps] = useState<{ step_order: number; step_name: string; description: string; product_category: string }[]>([]);

  useEffect(() => {
    if (!isOpen || !templateId) {
      setTemplate(null);
      setSteps([]);
      setError(null);
      setMode('view');
      return;
    }

    const fetchDetail = async () => {
      const authToken = getAuthToken();
      if (!authToken) return;

      setLoading(true);
      setError(null);
      try {
        apiClient.setAuthToken(authToken);
        const response = await apiClient.get<{
          success: boolean;
          data?: { template: AdminRoutineTemplate; steps: AdminRoutineStep[] };
        }>(`/api/admin/template-routines/${templateId}`);

        if (response.data.success && response.data.data) {
          const t = response.data.data.template;
          const s = response.data.data.steps || [];
          setTemplate(t);
          setSteps(s);
          setFormName(t.name);
          setFormDescription(t.description || '');
          setFormSchedule((t.schedule_type as ScheduleValue) || 'morning');
          setFormIsActive(t.is_active);
          setFormSteps(
            s.length > 0
              ? s.map((st) => ({
                  step_order: st.step_order,
                  step_name: st.step_name,
                  description: st.description || '',
                  product_category: st.product_category || '',
                }))
              : []
          );
        } else {
          setError('Failed to load template.');
        }
      } catch (err) {
        console.error('Error fetching template routine:', err);
        setError('Failed to load template routine.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, templateId]);

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
        return null;
    }
  };

  const handleEdit = () => {
    setFormName(template?.name ?? '');
    setFormDescription(template?.description ?? '');
    setFormSchedule((template?.schedule_type as ScheduleValue) ?? 'morning');
    setFormIsActive(template?.is_active ?? true);
    setFormSteps(
      steps.map((st) => ({
        step_order: st.step_order,
        step_name: st.step_name,
        description: st.description || '',
        product_category: st.product_category || '',
      }))
    );
    setMode('edit');
    setError(null);
  };

  const handleCancelEdit = () => {
    setMode('view');
    setError(null);
  };

  const addStep = () => {
    setFormSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        step_name: '',
        description: '',
        product_category: '',
      },
    ]);
  };

  const removeStep = (index: number) => {
    setFormSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  };

  const updateStep = (
    index: number,
    field: 'step_name' | 'description' | 'product_category',
    value: string
  ) => {
    setFormSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!templateId || !template) return;
    if (!formName.trim()) {
      setError('Routine name is required.');
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) return;

    setSaving(true);
    setError(null);
    try {
      apiClient.setAuthToken(authToken);
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        schedule_type: formSchedule,
        schedule_days: null,
        is_active: formIsActive,
        steps: formSteps
          .filter((s) => s.step_name.trim())
          .map((s, i) => ({
            step_order: i + 1,
            step_name: s.step_name.trim(),
            description: s.description.trim() || null,
            duration_seconds: null,
            product_category: s.product_category.trim() || null,
            product_recommendation: null,
            tips: null,
            is_optional: false,
          })),
      };

      const response = await apiClient.put<{
        success: boolean;
          data?: { template: AdminRoutineTemplate; steps: AdminRoutineStep[] };
        error?: string;
      }>(`/api/admin/template-routines/${templateId}`, payload);

      if (response.data.success && response.data.data) {
        setTemplate(response.data.data.template);
        setSteps(response.data.data.steps || []);
        setMode('view');
        onSuccess?.();
      } else {
        setError(response.data.error || 'Failed to update template.');
      }
    } catch (err) {
      console.error('Error updating template routine:', err);
      setError('Failed to update template routine.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Template Routine Details</h3>
          <div className="flex items-center gap-2">
            {mode === 'view' && template && (
              <button
                onClick={handleEdit}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : error && mode === 'view' ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : template ? (
            mode === 'view' ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{template.name}</h4>
                  {template.description && (
                    <p className="text-gray-600 mt-1">{template.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      {getScheduleIcon(template.schedule_type)}
                      {SCHEDULE_TYPES.find((s) => s.value === template.schedule_type)?.label ||
                        template.schedule_type}
                    </span>
                    {template.schedule_days && template.schedule_days.length > 0 && (
                      <span className="text-sm text-gray-500">
                        Days: {template.schedule_days.join(', ')}
                      </span>
                    )}
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        template.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Created {template.created_at ? new Date(template.created_at).toLocaleString() : '—'}
                  </p>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">
                    Steps ({steps.length})
                  </h5>
                  {steps.length === 0 ? (
                    <p className="text-gray-500 text-sm">No steps defined.</p>
                  ) : (
                    <ul className="space-y-4">
                      {steps.map((step) => (
                        <li
                          key={step.id}
                          className="p-4 border border-gray-100 rounded-xl bg-gray-50/50"
                        >
                          <span className="text-xs font-medium text-gray-400">
                            Step {step.step_order}
                          </span>
                          <p className="font-medium text-gray-900 mt-1">{step.step_name}</p>
                          {step.description && (
                            <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                          )}
                          {step.product_category && (
                            <span className="inline-flex items-center gap-1 mt-2 text-sm text-gray-500">
                              <Package className="w-3.5 h-3.5" />
                              {step.product_category}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Routine Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Anti-Aging Morning Routine"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe this routine..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SCHEDULE_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormSchedule(value)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          formSchedule === value
                            ? 'border-[#CFAFA3] bg-[#CFAFA3]/10 text-[#CFAFA3]'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-[#CFAFA3] focus:ring-[#CFAFA3]"
                  />
                  <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Steps</label>
                    <button
                      type="button"
                      onClick={addStep}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#CFAFA3] hover:text-[#B89A8E]"
                    >
                      <Plus className="w-4 h-4" />
                      Add step
                    </button>
                  </div>
                  <div className="space-y-4">
                    {formSteps.map((step, index) => (
                      <div
                        key={index}
                        className="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-500">Step {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
                          <input
                            type="text"
                            value={step.step_name}
                            onChange={(e) => updateStep(index, 'step_name', e.target.value)}
                            placeholder="e.g., Vitamin C Serum"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Instructions</label>
                          <input
                            type="text"
                            value={step.description}
                            onChange={(e) => updateStep(index, 'description', e.target.value)}
                            placeholder="e.g., Apply 3-4 drops to clean skin"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Product Type</label>
                          <select
                            value={step.product_category}
                            onChange={(e) => updateStep(index, 'product_category', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                          >
                            <option value="">Select type...</option>
                            {PRODUCT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !formName.trim()}
                    className="flex-1 py-3 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TemplateRoutineDetailModal;
