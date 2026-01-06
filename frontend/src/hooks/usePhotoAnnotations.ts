// ============================================================================
// TYPES
// ============================================================================

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  color: string;
}

export interface DrawingPath extends BaseAnnotation {
  type: 'pen' | 'highlighter';
  points: AnnotationPoint[];
  width: number;
  opacity: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'arrow' | 'line' | 'circle' | 'rectangle';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width: number;
}

export interface MarkerAnnotation extends BaseAnnotation {
  type: 'marker';
  x: number;
  y: number;
  label: string;
}

export type Annotation = DrawingPath | TextAnnotation | ShapeAnnotation | MarkerAnnotation;

export interface AnnotationData {
  annotations: Annotation[];
  width: number;
  height: number;
}

export interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  title?: string;
  notes?: string;
  annotation_data: AnnotationData;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

export const generateAnnotationId = (): string => {
  return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// HOOK
// ============================================================================

import { useState, useCallback } from 'react';

interface UsePhotoAnnotationsReturn {
  annotations: PhotoAnnotation[];
  loading: boolean;
  error: string | null;
  fetchAnnotations: (photoId: string) => Promise<void>;
  saveAnnotation: (photoId: string, annotationData: AnnotationData, title?: string, notes?: string) => Promise<PhotoAnnotation | null>;
  updateAnnotation: (annotationId: string, annotationData: AnnotationData, title?: string, notes?: string) => Promise<PhotoAnnotation | null>;
  deleteAnnotation: (annotationId: string) => Promise<boolean>;
}

export const usePhotoAnnotations = (): UsePhotoAnnotationsReturn => {
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnotations = useCallback(async (photoId: string) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/photos/${photoId}/annotations`);
      // const data = await response.json();
      // setAnnotations(data);
      
      // Mock data for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setAnnotations([]);
    } catch (err) {
      setError('Failed to fetch annotations');
      console.error('Error fetching annotations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAnnotation = useCallback(async (
    photoId: string,
    annotationData: AnnotationData,
    title?: string,
    notes?: string
  ): Promise<PhotoAnnotation | null> => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/photos/${photoId}/annotations`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ annotationData, title, notes }),
      // });
      // const newAnnotation = await response.json();
      
      // Mock save for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newAnnotation: PhotoAnnotation = {
        id: generateAnnotationId(),
        photo_id: photoId,
        professional_id: 'mock_professional_id',
        title,
        notes,
        annotation_data: annotationData,
        created_at: new Date().toISOString(),
      };
      
      setAnnotations(prev => [...prev, newAnnotation]);
      return newAnnotation;
    } catch (err) {
      setError('Failed to save annotation');
      console.error('Error saving annotation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAnnotation = useCallback(async (
    annotationId: string,
    annotationData: AnnotationData,
    title?: string,
    notes?: string
  ): Promise<PhotoAnnotation | null> => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnnotations(prev => prev.map(ann => {
        if (ann.id === annotationId) {
          return {
            ...ann,
            annotation_data: annotationData,
            title,
            notes,
            updated_at: new Date().toISOString(),
          };
        }
        return ann;
      }));
      
      const updated = annotations.find(a => a.id === annotationId);
      return updated || null;
    } catch (err) {
      setError('Failed to update annotation');
      console.error('Error updating annotation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [annotations]);

  const deleteAnnotation = useCallback(async (annotationId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
      return true;
    } catch (err) {
      setError('Failed to delete annotation');
      console.error('Error deleting annotation:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    annotations,
    loading,
    error,
    fetchAnnotations,
    saveAnnotation,
    updateAnnotation,
    deleteAnnotation,
  };
};

export default usePhotoAnnotations;

