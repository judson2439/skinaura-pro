import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Calendar,
  Clock,
  ChevronRight,
  Loader2,
  Play,
  CheckCircle2,
  Check,
  Target,
  Flag,
  Package,
  Award,
  AlertCircle,
  User,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import {
  TreatmentPlan,
  TreatmentPlanMilestone,
  TreatmentPlanProduct,
  TreatmentPlanRoutine,
  TreatmentPlanAppointment,
  getStatusColor,
  getPriorityColor,
  calculatePlanProgress,
} from '@/components/professional/modals/treatmentPlanTypes';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalInfo {
  id: string;
  full_name: string;
  avatar_url?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const TreatmentPlansSection: React.FC = () => {
  // Get auth token for API calls
  const authToken = getAuthToken();
  
  // Data state
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [professionals, setProfessionals] = useState<Record<string, ProfessionalInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);
  const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null);

  // ============================================================================
  // FETCH TREATMENT PLANS FROM DATABASE
  // ============================================================================

  const fetchTreatmentPlans = async () => {
    const token = getAuthToken();
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
          plans: TreatmentPlan[];
          professionals: Record<string, ProfessionalInfo>;
        };
        error?: string;
      }>('/api/client/treatment-plans');

      if (!response.data.success) {
        console.error('Error fetching treatment plans:', response.data.error);
        setError('Failed to load treatment plans');
        setLoading(false);
        return;
      }

      if (response.data.data) {
        setPlans(response.data.data.plans);
        setProfessionals(response.data.data.professionals);
      }
    } catch (err) {
      console.error('Error fetching treatment plans:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when auth token changes
  useEffect(() => {
    fetchTreatmentPlans();
  }, [authToken]);

  // ============================================================================
  // TOGGLE MILESTONE COMPLETION
  // ============================================================================

  const handleToggleMilestone = async (milestoneId: string, currentStatus: boolean) => {
    const token = getAuthToken();
    if (!selectedPlan || !token) return;

    setUpdatingMilestone(milestoneId);

    try {
      const newStatus = !currentStatus;

      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        data?: { 
          milestone: { 
            id: string; 
            completed: boolean; 
            completed_at: string | null;
          };
        };
        error?: string;
      }>(`/api/client/treatment-plans/milestones/${milestoneId}`, {
        completed: newStatus,
      });

      if (!response.data.success) {
        console.error('Error updating milestone:', response.data.error);
        return;
      }

      const completedAt = response.data.data?.milestone?.completed_at;

      // Update local state
      const updatedMilestones = selectedPlan.milestones.map(m =>
        m.id === milestoneId
          ? { ...m, completed: newStatus, completed_at: completedAt || undefined }
          : m
      );

      const updatedPlan = {
        ...selectedPlan,
        milestones: updatedMilestones,
      };

      setSelectedPlan(updatedPlan);
      setPlans(plans.map(p => (p.id === updatedPlan.id ? updatedPlan : p)));
    } catch (err) {
      console.error('Error toggling milestone:', err);
    } finally {
      setUpdatingMilestone(null);
    }
  };

  // Get active and completed plans
  const activePlans = plans.filter(p => p.status === 'active');
  const completedPlans = plans.filter(p => p.status === 'completed');
  const pausedPlans = plans.filter(p => p.status === 'paused');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">My Treatment Plans</h2>
        <p className="text-gray-500">Track your skincare journey and milestones</p>
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
          <p className="text-gray-500 mb-4">Your skincare professional will create a personalized treatment plan for you.</p>
          <p className="text-sm text-gray-400">Check back soon or contact your professional for more information.</p>
        </div>
      )}

      {/* Active Plans */}
      {!loading && !error && activePlans.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-green-600" />
            Active Plans ({activePlans.length})
          </h3>
          <div className="space-y-4">
            {activePlans.map((plan) => {
              const progress = calculatePlanProgress(plan);
              const isSelected = selectedPlan?.id === plan.id;
              const professional = professionals[plan.professional_id];

              return (
                <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Plan Header - Always Visible */}
                  <div
                    onClick={() => setSelectedPlan(isSelected ? null : plan)}
                    className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-serif font-bold text-lg text-gray-900">{plan.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                            Active
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                          </span>
                        </div>
                        {professional && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                            <User className="w-4 h-4" />
                            <span>By {professional.full_name}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>

                    {/* Progress Overview */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center mb-1">
                          <span className="text-lg font-bold text-white">{progress.overallProgress}%</span>
                        </div>
                        <p className="text-xs text-gray-500">Overall</p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 flex items-center justify-center mb-1">
                          <span className="text-lg font-bold text-purple-600">{progress.completedMilestones}/{progress.totalMilestones}</span>
                        </div>
                        <p className="text-xs text-gray-500">Milestones</p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-1">
                          <span className="text-lg font-bold text-blue-600">{plan.products.length}</span>
                        </div>
                        <p className="text-xs text-gray-500">Products</p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-1">
                          <span className="text-lg font-bold text-amber-600">{progress.daysRemaining}</span>
                        </div>
                        <p className="text-xs text-gray-500">Days Left</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium text-[#CFAFA3]">{progress.overallProgress}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] rounded-full transition-all"
                          style={{ width: `${progress.overallProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isSelected && (
                    <div className="border-t border-gray-100 p-6 space-y-6 bg-gray-50/50">
                      {/* Description & Goals */}
                      {(plan.description || plan.goals.length > 0) && (
                        <div>
                          {plan.description && (
                            <p className="text-gray-600 mb-3">{plan.description}</p>
                          )}
                          {plan.goals.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                <Target className="w-4 h-4 text-[#CFAFA3]" /> Goals
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {plan.goals.map((goal, idx) => (
                                  <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-white text-[#CFAFA3] rounded-full text-sm border border-[#CFAFA3]/20">
                                    <Target className="w-3 h-3" />
                                    {goal}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Milestones */}
                      {plan.milestones.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                            <Flag className="w-4 h-4 text-[#CFAFA3]" /> Milestones
                          </h5>
                          <div className="space-y-2">
                            {plan.milestones.map((milestone) => (
                              <div
                                key={milestone.id}
                                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                                  milestone.completed 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-white border-gray-100 hover:border-[#CFAFA3]/50'
                                }`}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleMilestone(milestone.id, milestone.completed);
                                  }}
                                  disabled={updatingMilestone === milestone.id}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                    milestone.completed 
                                      ? 'bg-green-500 text-white' 
                                      : 'border-2 border-gray-300 hover:border-[#CFAFA3] hover:bg-[#CFAFA3]/10'
                                  } ${updatingMilestone === milestone.id ? 'opacity-50' : ''}`}
                                >
                                  {updatingMilestone === milestone.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : milestone.completed ? (
                                    <Check className="w-5 h-5" />
                                  ) : null}
                                </button>
                                <div className="flex-1">
                                  <p className={`font-medium ${milestone.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                                    {milestone.title}
                                  </p>
                                  {milestone.description && (
                                    <p className="text-sm text-gray-500">{milestone.description}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-500">
                                    {new Date(milestone.target_date).toLocaleDateString()}
                                  </p>
                                  {milestone.completed && milestone.completed_at && (
                                    <p className="text-xs text-green-600">
                                      Completed {new Date(milestone.completed_at).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Products */}
                      {plan.products.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                            <Package className="w-4 h-4 text-[#CFAFA3]" /> Recommended Products
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {plan.products.map((product) => (
                              <div key={product.id} className={`p-4 rounded-xl border ${getPriorityColor(product.priority)} bg-opacity-50`}>
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="font-medium text-gray-900">{product.product_name}</p>
                                    {product.product_brand && (
                                      <p className="text-xs text-gray-500">{product.product_brand}</p>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                    product.priority === 'essential' ? 'bg-red-200 text-red-800' :
                                    product.priority === 'recommended' ? 'bg-amber-200 text-amber-800' :
                                    'bg-gray-200 text-gray-700'
                                  }`}>
                                    {product.priority}
                                  </span>
                                </div>
                                {product.product_category && (
                                  <span className="inline-block px-2 py-0.5 bg-white/50 rounded text-xs text-gray-600 mb-2">
                                    {product.product_category}
                                  </span>
                                )}
                                {product.usage_instructions && (
                                  <p className="text-sm text-gray-600">{product.usage_instructions}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Routines */}
                      {plan.routines.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                            <Clock className="w-4 h-4 text-[#CFAFA3]" /> Assigned Routines
                          </h5>
                          <div className="space-y-2">
                            {plan.routines.map((routine) => (
                              <div key={routine.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                                <div className="w-10 h-10 rounded-lg bg-[#CFAFA3]/10 flex items-center justify-center">
                                  <Clock className="w-5 h-5 text-[#CFAFA3]" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{routine.routine_name}</p>
                                  {routine.routine_type && (
                                    <span className="text-xs text-[#CFAFA3] capitalize">{routine.routine_type}</span>
                                  )}
                                  {routine.notes && (
                                    <p className="text-sm text-gray-500 mt-1">{routine.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Appointments */}
                      {plan.appointments.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-[#CFAFA3]" /> Scheduled Appointments
                          </h5>
                          <div className="space-y-2">
                            {plan.appointments.map((apt) => {
                              const isOverdue = !apt.completed && new Date(apt.scheduled_date) < new Date();
                              return (
                                <div
                                  key={apt.id}
                                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                                    apt.completed 
                                      ? 'bg-green-50 border-green-200' 
                                      : isOverdue
                                        ? 'bg-red-50 border-red-200'
                                        : 'bg-white border-gray-100'
                                  }`}
                                >
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    apt.completed 
                                      ? 'bg-green-500 text-white' 
                                      : isOverdue
                                        ? 'bg-red-100'
                                        : 'bg-[#CFAFA3]/10'
                                  }`}>
                                    {apt.completed ? (
                                      <Check className="w-5 h-5" />
                                    ) : (
                                      <Calendar className={`w-5 h-5 ${isOverdue ? 'text-red-500' : 'text-[#CFAFA3]'}`} />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <p className={`font-medium ${apt.completed ? 'text-green-700' : isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                                      {apt.appointment_type}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {new Date(apt.scheduled_date).toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })}
                                      {apt.scheduled_time && ` at ${apt.scheduled_time}`}
                                    </p>
                                    {apt.notes && (
                                      <p className="text-sm text-gray-500 mt-1">{apt.notes}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-sm text-gray-500">{apt.duration_minutes} min</span>
                                    {apt.completed && (
                                      <p className="text-xs text-green-600">Completed</p>
                                    )}
                                    {isOverdue && (
                                      <p className="text-xs text-red-600">Overdue</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {plan.notes && (
                        <div className="p-4 bg-[#CFAFA3]/5 rounded-xl border border-[#CFAFA3]/20">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Professional Notes</h5>
                          <p className="text-sm text-gray-600">{plan.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paused Plans */}
      {!loading && !error && pausedPlans.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Paused Plans ({pausedPlans.length})
          </h3>
          <div className="space-y-3">
            {pausedPlans.map((plan) => {
              const progress = calculatePlanProgress(plan);
              const isSelected = selectedPlan?.id === plan.id;
              const professional = professionals[plan.professional_id];

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{plan.title}</h4>
                        <p className="text-xs text-gray-500">
                          {professional?.full_name || 'Your Professional'} • Paused
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-600">{progress.completedMilestones}/{progress.totalMilestones} milestones</p>
                        <p className="text-xs text-gray-500">{progress.overallProgress}% completed</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-amber-200">
                      {plan.description && (
                        <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Duration: {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-amber-600 mt-2">
                        This plan is currently paused. Contact your professional for more information.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Plans */}
      {!loading && !error && completedPlans.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Completed Plans ({completedPlans.length})
          </h3>
          <div className="space-y-3">
            {completedPlans.map((plan) => {
              const progress = calculatePlanProgress(plan);
              const isSelected = selectedPlan?.id === plan.id;
              const professional = professionals[plan.professional_id];

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(isSelected ? null : plan)}
                  className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Award className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{plan.title}</h4>
                        <p className="text-xs text-gray-500">
                          {professional?.full_name || 'Your Professional'} • Completed {plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-blue-600">{progress.completedMilestones}/{progress.totalMilestones} milestones</p>
                        <p className="text-xs text-gray-500">{progress.overallProgress}% completed</p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded view for completed plans */}
                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {plan.description && (
                        <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      )}
                      {plan.goals.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Achieved Goals</p>
                          <div className="flex flex-wrap gap-2">
                            {plan.goals.map((goal, idx) => (
                              <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                                <Check className="w-3 h-3" />
                                {goal}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-gray-500">
                        Duration: {new Date(plan.start_date).toLocaleDateString()} - {new Date(plan.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentPlansSection;
