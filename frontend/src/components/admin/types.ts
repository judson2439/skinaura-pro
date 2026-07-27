/**
 * @fileoverview Admin Dashboard Types
 */

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  skin_type: string | null;
  concerns: string[] | null;
  business_name: string | null;
  license_number: string | null;
  ncea_certified_profile_number: string | null;
  professional_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Product {
  id: string;
  professional_id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  purchase_url: string | null;
  ingredients: string[] | null;
  skin_types: string[] | null;
  concerns: string[] | null;
  is_active: boolean | null;
  is_global: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  // Joined data
  professional_name?: string;
  professional_email?: string;
}

export interface PlatformMetrics {
  totalActiveProfessionals: number;
  totalActiveClients: number;
  routinesCompletedToday: number;
  routinesCompletedAllTime: number;
  professionalChange: number;
  clientChange: number;
}

export interface RevenueMetrics {
  mrr: number;
  mrrChange: number;
  activeSubscriptions: number;
  churnRate: number;
  avgRevenuePerUser: number;
}

export interface APIUsageMetrics {
  faceAgeScansToday: number;
  faceAgeScansMonth: number;
  faceAgeScanLimit: number;
  twilioSMSToday: number;
  twilioSMSMonth: number;
  twilioSMSLimit: number;
  apiCostToday: number;
  apiCostMonth: number;
}

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
  'Exfoliant',
  'Essence',
  'Mist',
  'Lip Care',
  'Body Care',
];

export type AdminTabType =
  | 'overview'
  | 'users'
  | 'relationship'
  | 'products'
  | 'routines'
  | 'routine-templates'
  | 'progress-photos'
  | 'audit-logs';

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogRecord {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogStats {
  totalEvents: number;
  byAction: { action: string; count: number }[];
  byResource: { resource_type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  topUsers: { user_email: string; count: number }[];
}

export interface AdminNavItem {
  id: AdminTabType;
  label: string;
  icon: string;
}

// ============================================================================
// ROUTINE TYPES FOR ADMIN
// ============================================================================

export interface AdminRoutineTemplate {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  professional_name?: string;
  professional_email?: string;
  steps_count?: number;
  assignments_count?: number;
}

export interface AdminRoutineStep {
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
  // Joined product data
  linked_product?: {
    id: string;
    name: string;
    brand: string | null;
    image_url: string | null;
  } | null;
}

export const SCHEDULE_TYPES = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'custom', label: 'Custom' },
  { value: 'weekly', label: 'Weekly' },
];
