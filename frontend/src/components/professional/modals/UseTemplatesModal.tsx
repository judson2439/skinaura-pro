/**
 * Use Templates Modal – browse platform template_routine_templates and template_routine_steps.
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
  ChevronLeft,
  Layers,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES (match backend template_routine_templates + template_routine_steps)
// ============================================================================

export interface PlatformTemplateStepSummary {
  step_order: number;
  step_name: string;
}

export interface PlatformTemplateRoutine {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps_count?: number;
  steps?: PlatformTemplateStepSummary[];
}

export interface PlatformTemplateStep {
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

interface UseTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySuccess?: () => void;
}

const SCHEDULE_OPTIONS: { value: string; label: string; icon: typeof Sun }[] = [
  { value: 'morning', label: 'Morning', icon: Sun },
  { value: 'evening', label: 'Evening', icon: Moon },
  { value: 'daily', label: 'Daily', icon: RefreshCw },
  { value: 'weekly', label: 'Weekly', icon: Calendar },
];

function getScheduleIcon(scheduleType: string) {
  const opt = SCHEDULE_OPTIONS.find((o) => o.value === scheduleType);
  if (opt) {
    const Icon = opt.icon;
    return <Icon className="w-5 h-5" />;
  }
  return <Layers className="w-5 h-5 text-gray-500" />;
}

function getScheduleLabel(scheduleType: string): string {
  return SCHEDULE_OPTIONS.find((o) => o.value === scheduleType)?.label || scheduleType;
}

// ============================================================================
// COMPONENT
// ============================================================================

const UseTemplatesModal: React.FC<UseTemplatesModalProps> = ({ isOpen, onClose, onApplySuccess }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PlatformTemplateRoutine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    template: PlatformTemplateRoutine;
    steps: PlatformTemplateStep[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.get<{
        success: boolean;
        data?: { templates: PlatformTemplateRoutine[] };
      }>('/api/professional/template-routines');

      if (res.data.success && res.data.data?.templates) {
        setTemplates(res.data.data.templates);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error('Error fetching template routines:', err);
      setError('Failed to load templates.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setSelectedId(null);
      setDetail(null);
    }
  }, [isOpen]);

  const fetchDetail = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;

    setDetailLoading(true);
    setError(null);
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.get<{
        success: boolean;
        data?: { template: PlatformTemplateRoutine; steps: PlatformTemplateStep[] };
      }>(`/api/professional/template-routines/${id}`);

      if (res.data.success && res.data.data) {
        setDetail({
          template: res.data.data.template,
          steps: res.data.data.steps || [],
        });
        setSelectedId(id);
      } else {
        setError('Failed to load template details.');
      }
    } catch (err) {
      console.error('Error fetching template detail:', err);
      setError('Failed to load template details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApply = async (templateId: string) => {
    const token = getAuthToken();
    if (!token) return;

    setApplyingId(templateId);
    setError(null);
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.post<{ success: boolean; data?: unknown; error?: string }>(
        `/api/professional/template-routines/${templateId}/apply`
      );
      if (res.data.success) {
        toast({
          title: 'Template applied',
          description: 'Routine has been added to your routines.',
        });
        onApplySuccess?.();
        handleClose();
      } else {
        toast({
          title: 'Error',
          description: res.data.error || 'Failed to apply template.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error applying template:', err);
      toast({
        title: 'Error',
        description: 'Failed to apply template. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setApplyingId(null);
    }
  };

  const handleBack = () => {
    setSelectedId(null);
    setDetail(null);
    setError(null);
  };

  const handleClose = () => {
    handleBack();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl min-h-[88vh] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          {detail ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to templates
            </button>
          ) : (
            <h3 className="text-xl font-serif font-bold text-gray-900">Use Templates</h3>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
          )}

          {detail ? (
            detailLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
              </div>
            ) : detail.template ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-serif font-bold text-gray-900">{detail.template.name}</h4>
                    {detail.template.description && (
                      <p className="text-gray-600 mt-1">{detail.template.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                        {getScheduleIcon(detail.template.schedule_type)}
                        {SCHEDULE_OPTIONS.find((s) => s.value === detail.template.schedule_type)?.label ||
                          detail.template.schedule_type}
                      </span>
                      {detail.template.schedule_days && detail.template.schedule_days.length > 0 && (
                        <span className="text-sm text-gray-500">
                          Days: {detail.template.schedule_days.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApply(detail.template.id)}
                    disabled={applyingId === detail.template.id}
                    className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {applyingId === detail.template.id ? 'Applying…' : 'Apply'}
                  </button>
                </div>

                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-3">
                    Steps ({detail.steps.length})
                  </h5>
                  {detail.steps.length === 0 ? (
                    <p className="text-gray-500 text-sm">No steps defined.</p>
                  ) : (
                    <ul className="space-y-4">
                      {detail.steps.map((step) => (
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
                          {step.product_recommendation && (
                            <p className="text-sm text-gray-500 mt-1">{step.product_recommendation}</p>
                          )}
                          {step.tips && (
                            <p className="text-sm text-gray-500 mt-1 italic">{step.tips}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null
          ) : loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No platform templates available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {templates.map((t) => {
                const stepList = t.steps ?? [];
                const stepsToShow = stepList.slice(0, 3);
                const remainingCount = stepList.length - stepsToShow.length;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => fetchDetail(t.id)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchDetail(t.id)}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            t.schedule_type === 'morning'
                              ? 'bg-amber-100'
                              : t.schedule_type === 'evening'
                                ? 'bg-indigo-100'
                                : t.schedule_type === 'daily'
                                  ? 'bg-green-100'
                                  : 'bg-purple-100'
                          }`}
                        >
                          {getScheduleIcon(t.schedule_type)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{t.name}</h3>
                          <p className="text-xs text-gray-500">{getScheduleLabel(t.schedule_type)}</p>
                        </div>
                      </div>
                    </div>

                    {t.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{t.description}</p>
                    )}

                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">
                        {stepList.length} Steps
                      </p>
                      <div className="space-y-1">
                        {stepsToShow.length === 0 ? (
                          <p className="text-xs text-gray-400">No steps</p>
                        ) : (
                          <>
                            {stepsToShow.map((step, idx) => (
                              <div key={step.step_order} className="flex items-center gap-2 text-sm">
                                <span className="w-5 h-5 rounded-full bg-[#CFAFA3]/20 text-[#CFAFA3] text-xs flex items-center justify-center font-medium flex-shrink-0">
                                  {step.step_order}
                                </span>
                                <span className="text-gray-700 truncate">{step.step_name}</span>
                              </div>
                            ))}
                            {remainingCount > 0 && (
                              <p className="text-xs text-gray-400 pl-7">+{remainingCount} more steps</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(t.id);
                        }}
                        disabled={applyingId === t.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#B89A8E] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors disabled:opacity-50"
                      >
                        {applyingId === t.id ? 'Applying…' : 'Apply'}
                      </button>
                      <span className="text-sm font-medium text-[#CFAFA3] hover:text-[#B89A8E] cursor-pointer">
                        View details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UseTemplatesModal;
