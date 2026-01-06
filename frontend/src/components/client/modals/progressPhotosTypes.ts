// ============================================================================
// PROGRESS PHOTOS TYPES
// ============================================================================

export interface PhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  // Joined from profiles table
  professional_name?: string;
  professional_avatar?: string;
}

export interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  updated_at: string;
  // Joined from profiles table
  professional_name?: string;
}

export interface ProgressPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'progress';
  title?: string;
  notes?: string;
  taken_at: string;
  created_at: string;
  // These will be fetched separately
  comments: PhotoComment[];
  annotations: PhotoAnnotation[];
  has_annotations?: boolean;
  has_comments?: boolean;
}
