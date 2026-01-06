// ============================================================================
// TYPES
// ============================================================================

export interface TreatmentPlanMilestone {
  id: string;
  plan_id: string;
  title: string;
  description?: string;
  target_date: string;
  completed: boolean;
  completed_at?: string;
}

export interface TreatmentPlanProduct {
  id: string;
  plan_id: string;
  product_name: string;
  product_brand?: string;
  product_category?: string;
  usage_instructions?: string;
  priority: 'essential' | 'recommended' | 'optional';
}

export interface TreatmentPlanRoutine {
  id: string;
  plan_id: string;
  routine_id?: string;
  routine_name: string;
  routine_type?: string;
  notes?: string;
}

export interface TreatmentPlanAppointment {
  id: string;
  plan_id: string;
  appointment_type: string;
  scheduled_date: string;
  scheduled_time?: string;
  duration_minutes: number;
  notes?: string;
  completed: boolean;
}

export interface TreatmentPlan {
  id: string;
  client_id: string;
  professional_id: string;
  title: string;
  description?: string;
  goals: string[];
  start_date: string;
  end_date: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  milestones: TreatmentPlanMilestone[];
  products: TreatmentPlanProduct[];
  routines: TreatmentPlanRoutine[];
  appointments: TreatmentPlanAppointment[];
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface TreatmentPlanClient {
  id: string;
  name: string;
  image: string;
}

export interface PlanProgress {
  totalMilestones: number;
  completedMilestones: number;
  overallProgress: number;
  daysRemaining: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700';
    case 'paused':
      return 'bg-amber-100 text-amber-700';
    case 'completed':
      return 'bg-blue-100 text-blue-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'essential':
      return 'bg-red-100 text-red-700';
    case 'recommended':
      return 'bg-amber-100 text-amber-700';
    case 'optional':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const calculatePlanProgress = (plan: TreatmentPlan): PlanProgress => {
  const totalMilestones = plan.milestones.length;
  const completedMilestones = plan.milestones.filter(m => m.completed).length;
  
  const today = new Date();
  const endDate = new Date(plan.end_date);
  const startDate = new Date(plan.start_date);
  
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysPassed = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Calculate progress based on milestones if they exist, otherwise use time-based progress
  let overallProgress = 0;
  if (totalMilestones > 0) {
    overallProgress = Math.round((completedMilestones / totalMilestones) * 100);
  } else {
    overallProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100));
  }
  
  return {
    totalMilestones,
    completedMilestones,
    overallProgress,
    daysRemaining,
  };
};

// ============================================================================
// PRODUCT CATEGORIES
// ============================================================================

export const PRODUCT_CATEGORIES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Treatment',
  'Eye Cream',
  'Mask',
  'Oil',
] as const;

// ============================================================================
// CLIENT IMAGES (for fallback)
// ============================================================================

export const CLIENT_IMAGES = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
];

