import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Camera,
  Package,
  Bell,
  FileText,
  Send,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingTask {
  id: string;
  label: string;
  completed: boolean;
}

interface OnboardingStep {
  id: string;
  day: string;
  title: string;
  duration: string;
  tasks: OnboardingTask[];
}

interface OnboardingSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'skinaura_onboarding_progress';

const INITIAL_STEPS: OnboardingStep[] = [
  {
    id: 'initial-setup',
    day: 'Day 0',
    title: 'Initial Setup',
    duration: '15-30 minutes',
    tasks: [
      { id: 'setup-1', label: 'Log in and confirm your profile and clinic details', completed: false },
      { id: 'setup-2', label: 'Set your default cadence (routine reminders, progress photo prompts, provider review)', completed: false },
      { id: 'setup-3', label: 'Add your top 20 SKUs to the Product Library', completed: false },
    ],
  },
  {
    id: 'first-clients',
    day: 'Day 1',
    title: 'First Clients',
    duration: '30-60 minutes',
    tasks: [
      { id: 'clients-1', label: 'Create 3 client profiles', completed: false },
      { id: 'clients-2', label: 'Assign routines (AM/PM + weekly treatments)', completed: false },
      { id: 'clients-3', label: 'Turn on notifications', completed: false },
      { id: 'clients-4', label: 'Set progress photo cadence for client uploads', completed: false },
      { id: 'clients-5', label: 'Send client invites', completed: false },
    ],
  },
  {
    id: 'confirm-template',
    day: 'Day 2',
    title: 'Confirm & Template',
    duration: '30 minutes',
    tasks: [
      { id: 'template-1', label: 'Confirm clients have accepted invites and can see their routines', completed: false },
      { id: 'template-2', label: 'Review first client progress photos if uploaded', completed: false },
      { id: 'template-3', label: 'Add provider markup/feedback for 1-2 clients', completed: false },
      { id: 'template-4', label: 'Save 2-3 routine templates (Acne, Hyperpigmentation, Barrier Repair)', completed: false },
    ],
  },
  {
    id: 'first-review',
    day: 'Day 7',
    title: 'First Review Cycle',
    duration: '30 minutes',
    tasks: [
      { id: 'review-1', label: 'Review new client uploads (photos + notes)', completed: false },
      { id: 'review-2', label: 'Provide markup/feedback for active clients', completed: false },
      { id: 'review-3', label: 'Adjust routines only if necessary (one variable at a time)', completed: false },
    ],
  },
  {
    id: 'scale-standardize',
    day: 'Day 14',
    title: 'Scale & Standardize',
    duration: '30-60 minutes',
    tasks: [
      { id: 'scale-1', label: 'Confirm your workflow is stable with templates and delegation', completed: false },
      { id: 'scale-2', label: 'Invite 10-20 more clients', completed: false },
      { id: 'scale-3', label: 'Standardize provider review cadence (weekly/biweekly/monthly)', completed: false },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const loadProgress = (): OnboardingStep[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load onboarding progress:', e);
  }
  return INITIAL_STEPS;
};

const saveProgress = (steps: OnboardingStep[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
  } catch (e) {
    console.error('Failed to save onboarding progress:', e);
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const OnboardingSection: React.FC<OnboardingSectionProps> = ({ onNavigateToView }) => {
  const [steps, setSteps] = useState<OnboardingStep[]>(loadProgress);
  const [showResetModal, setShowResetModal] = useState(false);

  // Calculate overall progress
  const totalTasks = steps.reduce((sum, step) => sum + step.tasks.length, 0);
  const completedTasks = steps.reduce(
    (sum, step) => sum + step.tasks.filter(t => t.completed).length,
    0
  );
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Save progress whenever steps change
  useEffect(() => {
    saveProgress(steps);
  }, [steps]);

  // Toggle task completion
  const toggleTask = (stepId: string, taskId: string) => {
    setSteps(prevSteps =>
      prevSteps.map(step => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          tasks: step.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        };
      })
    );
  };

  // Calculate step progress
  const getStepProgress = (step: OnboardingStep) => {
    const completed = step.tasks.filter(t => t.completed).length;
    return Math.round((completed / step.tasks.length) * 100);
  };

  // Show reset confirmation modal
  const handleReset = () => {
    setShowResetModal(true);
  };

  // Confirm reset
  const confirmReset = () => {
    setSteps(INITIAL_STEPS);
    setShowResetModal(false);
  };

  // Cancel reset
  const cancelReset = () => {
    setShowResetModal(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Header Badge */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#CFAFA3]/20 rounded-full text-sm text-[#8B5A4A]">
          <span>Scan</span>
          <span className="text-gray-400">→</span>
          <span>Plan</span>
          <span className="text-gray-400">→</span>
          <span>Track</span>
          <span className="text-gray-400">→</span>
          <span>Adjust</span>
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold text-[#2D2A3E]">Quick Start Wizard</h1>
        <p className="text-gray-600 mt-2">
          Follow this 14-day guided setup to get your practice fully operational with SkinAura PRO
        </p>
      </div>

      {/* Overall Progress Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-800">Overall Progress</span>
          <span className="text-[#CFAFA3] font-bold">{completedTasks} / {totalTasks}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
          <span>{progressPercent}% complete • Progress saved automatically</span>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const stepProgress = getStepProgress(step);
          const isCompleted = stepProgress === 100;

          return (
            <div
              key={step.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                isCompleted ? 'border-green-200' : 'border-gray-100'
              }`}
            >
              {/* Step Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                      isCompleted 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-[#CFAFA3]/20 text-[#8B5A4A]'
                    }`}>
                      {step.day}
                    </span>
                    <h3 className="font-serif text-xl font-bold text-[#2D2A3E]">{step.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <Clock className="w-4 h-4" />
                      <span>{step.duration}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Progress</p>
                    <p className={`text-xl font-bold ${
                      isCompleted ? 'text-green-600' : 'text-[#CFAFA3]'
                    }`}>
                      {stepProgress}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="px-6 pb-6 space-y-3">
                {step.tasks.map((task) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleTask(step.id, task.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleTask(step.id, task.id);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      task.completed
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <span className={`text-sm ${
                      task.completed ? 'text-green-800 line-through' : 'text-gray-700'
                    }`}>
                      {task.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Celebration */}
      {progressPercent === 100 && (
        <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-center text-white">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#CFAFA3]" />
          <h3 className="font-serif text-xl font-bold mb-2">Congratulations!</h3>
          <p className="text-white/80">
            You've completed the Quick Start Wizard. Your practice is now fully operational with SkinAura PRO!
          </p>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h4 className="font-medium text-gray-800 mb-4">Quick Links</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateToView?.('clients')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Users className="w-6 h-6 text-[#CFAFA3]" />
            <span className="text-sm text-gray-700">My Clients</span>
          </button>
          <button
            onClick={() => onNavigateToView?.('products')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Package className="w-6 h-6 text-[#CFAFA3]" />
            <span className="text-sm text-gray-700">Products</span>
          </button>
          <button
            onClick={() => onNavigateToView?.('routines')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-6 h-6 text-[#CFAFA3]" />
            <span className="text-sm text-gray-700">Routines</span>
          </button>
          <button
            onClick={() => onNavigateToView?.('notifications')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-6 h-6 text-[#CFAFA3]" />
            <span className="text-sm text-gray-700">Notifications</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-serif font-bold text-lg text-[#2D2A3E]">Reset Progress</h3>
              </div>
              <button
                onClick={cancelReset}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-600">
                Are you sure you want to reset all onboarding progress? This will clear all completed tasks and cannot be undone.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={cancelReset}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingSection;
