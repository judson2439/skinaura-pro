import React from 'react';
import {
  Sun,
  Moon,
  Calendar,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';

// ============================================================================
// DATABASE TYPES (matching Supabase tables)
// ============================================================================

export interface RoutineTemplateDB {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutineStepDB {
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

// ============================================================================
// FRONTEND TYPES
// ============================================================================

export interface RoutineStep {
  id: string;
  routine_id?: string;
  step_order: number;
  step_name: string;
  description?: string;
  duration_seconds?: number;
  product_category?: string;
  product_recommendation?: string;
  tips?: string;
  is_optional?: boolean;
  // Legacy fields for backward compatibility
  product_name?: string;
  product_type?: string;
  instructions?: string;
  order?: number;
}

export interface Routine {
  id: string;
  professional_id?: string;
  name: string;
  description?: string;
  schedule_type: ScheduleType;
  schedule_days?: string[];
  is_active?: boolean;
  steps: RoutineStep[];
  created_at: string;
  updated_at?: string;
}

export interface RoutineClient {
  id: string;
  name: string;
  email?: string;
  image?: string;
  avatar_url?: string;
  skin_type?: string;
  concerns?: string[];
  assignedRoutines: string[];
}

// Database type for client_routine_assignments
export interface ClientRoutineAssignmentDB {
  id: string;
  routine_id: string;
  client_id: string;
  professional_id: string;
  is_active: boolean;
  assigned_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineAssignment {
  id: string;
  routine_id: string;
  client_id: string;
  professional_id?: string;
  is_active?: boolean;
  notes?: string;
  assigned_at: string;
  created_at?: string;
  updated_at?: string;
}


export type ScheduleType = 'morning' | 'evening' | 'daily' | 'weekly';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getScheduleIcon = (scheduleType: string): React.ReactNode => {
  switch (scheduleType) {
    case 'morning':
      return React.createElement(Sun, { className: 'w-5 h-5 text-amber-600' });
    case 'evening':
      return React.createElement(Moon, { className: 'w-5 h-5 text-indigo-600' });
    case 'daily':
      return React.createElement(RefreshCw, { className: 'w-5 h-5 text-green-600' });
    case 'weekly':
      return React.createElement(Calendar, { className: 'w-5 h-5 text-purple-600' });
    default:
      return React.createElement(ClipboardList, { className: 'w-5 h-5 text-gray-600' });
  }
};

export const getScheduleLabel = (scheduleType: string): string => {
  switch (scheduleType) {
    case 'morning':
      return 'Morning';
    case 'evening':
      return 'Evening';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return 'Weekly';
    default:
      return scheduleType;
  }
};

// Convert DB routine step to frontend format
export const mapDBStepToFrontend = (dbStep: RoutineStepDB): RoutineStep => ({
  id: dbStep.id,
  routine_id: dbStep.routine_id,
  step_order: dbStep.step_order,
  step_name: dbStep.step_name,
  description: dbStep.description || undefined,
  duration_seconds: dbStep.duration_seconds || undefined,
  product_category: dbStep.product_category || undefined,
  product_recommendation: dbStep.product_recommendation || undefined,
  tips: dbStep.tips || undefined,
  is_optional: dbStep.is_optional,
  // Legacy field mapping
  product_name: dbStep.step_name,
  product_type: dbStep.product_category || undefined,
  instructions: dbStep.description || undefined,
  order: dbStep.step_order,
});

// Convert DB routine template to frontend format
export const mapDBRoutineToFrontend = (dbRoutine: RoutineTemplateDB, steps: RoutineStepDB[] = []): Routine => ({
  id: dbRoutine.id,
  professional_id: dbRoutine.professional_id,
  name: dbRoutine.name,
  description: dbRoutine.description || undefined,
  schedule_type: dbRoutine.schedule_type as ScheduleType,
  schedule_days: dbRoutine.schedule_days || undefined,
  is_active: dbRoutine.is_active,
  steps: steps.map(mapDBStepToFrontend).sort((a, b) => a.step_order - b.step_order),
  created_at: dbRoutine.created_at,
  updated_at: dbRoutine.updated_at,
});

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export const PRODUCT_TYPES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Treatment',
  'Eye Cream',
  'Mask',
  'Oil',
  'Nutrition',
  'Vitamins',
] as const;
