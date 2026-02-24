/**
 * @fileoverview Create Template Routine Modal (Admin)
 * Matches professional "Create New Routine" + "Add New Step": template fields and step fields only.
 * Template: name, description, schedule (single select: Morning / Evening / Daily / Weekly).
 * Step: Product Name *, Instructions, Product Type.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, Sun, Moon, Calendar, RefreshCw } from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { PRODUCT_CATEGORIES } from '../types';

interface StepForm {
  step_order: number;
  step_name: string;   // Product Name *
  description: string; // Instructions
  product_category: string; // Product Type
}

type ScheduleValue = 'morning' | 'evening' | 'daily' | 'weekly';

interface CreateTemplateRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SCHEDULE_OPTIONS: { value: ScheduleValue; label: string; icon: typeof Sun }[] = [
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'evening', label: 'Evening', icon: Moon },
  { value: 'daily', label: 'Daily', icon: RefreshCw },
  { value: 'weekly', label: 'Weekly', icon: Calendar },
];

const CreateTemplateRoutineModal: React.FC<CreateTemplateRoutineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>('morning');
  const [steps, setSteps] = useState<StepForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = () => {
    setSteps((prev) => [
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
    setSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  };

  const updateStep = (index: number, field: keyof StepForm, value: string) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Routine name is required.');
      return;
    }
    setError(null);
    setSaving(true);

    const authToken = getAuthToken();
    if (!authToken) {
      setError('Not authenticated.');
      setSaving(false);
      return;
    }

    try {
      apiClient.setAuthToken(authToken);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        schedule_type: schedule,
        schedule_days: null,
        is_active: true,
        steps: steps
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

      const response = await apiClient.post<{
        success: boolean;
        data?: { template: unknown; steps: unknown[] };
        error?: string;
      }>('/api/admin/template-routines', payload);

      if (response.data.success) {
        resetForm();
        onSuccess();
      } else {
        setError(response.data.error || 'Failed to create template routine.');
      }
    } catch (err) {
      console.error('Error creating template routine:', err);
      setError('Failed to create template routine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSchedule('morning');
    setSteps([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Create New Routine</h3>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Routine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Anti-Aging Morning Routine"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this routine..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
            <div className="grid grid-cols-2 gap-2">
              {SCHEDULE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSchedule(value)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    schedule === value
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Steps (optional)</label>
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
              {steps.map((step, index) => (
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
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex-1 py-3 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Routine
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplateRoutineModal;
