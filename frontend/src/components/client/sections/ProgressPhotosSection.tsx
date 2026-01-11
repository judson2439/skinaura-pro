import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  Loader2,
  MessageSquare,
  Edit,
} from 'lucide-react';
import { ProgressPhoto, PhotoAnnotation, PhotoComment } from '../modals/progressPhotosTypes';
import UploadPhotoModal from '../modals/UploadPhotoModal';
import PhotoDetailModal from '../modals/PhotoDetailModal';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/encryption';

// ============================================================================
// TYPES - Matching actual progress_photos table structure
// ============================================================================

interface DBProgressPhoto {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  notes: string | null;
  skin_analysis: Record<string, unknown> | null;
  tags: string[] | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
  photo_type: string | null;
  title: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Convert database record to ProgressPhoto type
const dbToProgressPhoto = (dbPhoto: DBProgressPhoto): ProgressPhoto => {
  return {
    id: dbPhoto.id,
    photo_url: dbPhoto.photo_url,
    photo_type: (dbPhoto.photo_type as 'before' | 'after' | 'progress') || 'progress',
    title: dbPhoto.title || undefined,
    notes: dbPhoto.notes || undefined,
    taken_at: dbPhoto.taken_at || dbPhoto.created_at,
    created_at: dbPhoto.created_at,
    comments: [],
    annotations: [],
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProgressPhotosSection: React.FC = () => {
  const { toast } = useToast();
  
  // Get auth token for API calls
  const authToken = getAuthToken();

  // State
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);

  // Upload form states
  const [uploadPhotoType, setUploadPhotoType] = useState<'before' | 'after' | 'progress'>('progress');
  const [uploadPhotoTitle, setUploadPhotoTitle] = useState('');
  const [uploadPhotoNotes, setUploadPhotoNotes] = useState('');

  // Annotations and comments state for selected photo
  const [photoAnnotations, setPhotoAnnotations] = useState<PhotoAnnotation[]>([]);
  const [photoComments, setPhotoComments] = useState<PhotoComment[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Track which photos have annotations/comments for badge display
  const [photoMetadata, setPhotoMetadata] = useState<Record<string, { hasAnnotations: boolean; hasComments: boolean }>>({});

  // ============================================================================
  // FETCH PHOTOS FROM DATABASE
  // ============================================================================

  const fetchPhotos = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { 
          photos: DBProgressPhoto[]; 
          metadata: Record<string, { hasAnnotations: boolean; hasComments: boolean }>;
        };
        error?: string;
      }>('/api/client/progress-photos');

      if (!response.data.success) {
        console.error('Error fetching photos:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to load progress photos. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      if (response.data.data) {
        const progressPhotos = response.data.data.photos.map(dbToProgressPhoto);
        setPhotos(progressPhotos);
        setPhotoMetadata(response.data.data.metadata || {});
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to load progress photos. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FETCH ANNOTATIONS FOR SELECTED PHOTO
  // ============================================================================

  const fetchAnnotations = async (photoId: string) => {
    const token = getAuthToken();
    if (!token) return;

    setAnnotationsLoading(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { annotations: PhotoAnnotation[] };
        error?: string;
      }>(`/api/client/progress-photos/${photoId}/annotations`);

      if (response.data.success && response.data.data) {
        setPhotoAnnotations(response.data.data.annotations);
      } else {
        setPhotoAnnotations([]);
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
      setPhotoAnnotations([]);
    } finally {
      setAnnotationsLoading(false);
    }
  };

  // ============================================================================
  // FETCH COMMENTS FOR SELECTED PHOTO
  // ============================================================================

  const fetchComments = async (photoId: string) => {
    const token = getAuthToken();
    if (!token) return;

    setCommentsLoading(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { comments: PhotoComment[] };
        error?: string;
      }>(`/api/client/progress-photos/${photoId}/comments`);

      if (response.data.success && response.data.data) {
        setPhotoComments(response.data.data.comments);
      } else {
        setPhotoComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setPhotoComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  // Fetch photos on component mount
  useEffect(() => {
    fetchPhotos();
  }, [authToken]);

  // Group photos by month
  const photosByMonth = photos.reduce((acc, photo) => {
    const date = new Date(photo.taken_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(photo);
    return acc;
  }, {} as Record<string, ProgressPhoto[]>);

  // Sort month keys in descending order (newest first)
  const monthKeys = Object.keys(photosByMonth).sort((a, b) => b.localeCompare(a));

  // ============================================================================
  // UPLOAD PHOTO HANDLER
  // ============================================================================

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const token = getAuthToken();
    if (!file || !token) return;

    setUploading(true);

    try {
      // Step 1: Upload photo to backend using encrypted image upload
      const uploadResult = await uploadImage(file, 'photos', token);

      if (!uploadResult.success || !uploadResult.data?.image_url) {
        console.error('Upload error:', uploadResult.error);
        toast({
          title: 'Upload Failed',
          description: 'Failed to upload photo. Please try again.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      const photoUrl = uploadResult.data.image_url;

      // Step 2: Create progress photo record
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { photo: DBProgressPhoto };
        error?: string;
      }>('/api/client/progress-photos', {
        photo_url: photoUrl,
        photo_type: uploadPhotoType,
        title: uploadPhotoTitle || null,
        notes: uploadPhotoNotes || null,
      });

      if (!response.data.success || !response.data.data?.photo) {
        console.error('Database insert error:', response.data.error);
        
        // Clean up: Delete uploaded file if database insert fails
        try {
          const match = photoUrl.match(/\/api\/images\/(\w+)\/([^/]+)$/);
          if (match) {
            const [, category, filename] = match;
            await apiClient.delete(`/api/images/${category}/${filename}`);
          }
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }

        toast({
          title: 'Error',
          description: 'Failed to save photo record. Please try again.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Step 3: Add new photo to state
      const newPhoto = dbToProgressPhoto(response.data.data.photo);
      setPhotos(prev => [newPhoto, ...prev]);
      
      // Initialize metadata for new photo
      setPhotoMetadata(prev => ({
        ...prev,
        [newPhoto.id]: { hasAnnotations: false, hasComments: false }
      }));

      // Step 4: Show success message and close modal
      toast({
        title: 'Photo Uploaded',
        description: 'Your progress photo has been uploaded successfully.',
      });

      closeUploadModal();

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Close upload modal and reset form
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadPhotoType('progress');
    setUploadPhotoTitle('');
    setUploadPhotoNotes('');
  };

  // Close photo detail modal
  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setPhotoAnnotations([]);
    setPhotoComments([]);
  };

  // Handle photo delete
  const handleDeletePhoto = async (photoId: string) => {
    const token = getAuthToken();
    if (!token) return;

    try {
      // Find the photo to get the URL for storage deletion
      const photoToDelete = photos.find(p => p.id === photoId);
      
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        data?: { photo_url: string };
        error?: string;
      }>(`/api/client/progress-photos/${photoId}`);

      if (!response.data.success) {
        console.error('Delete error:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to delete photo. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Try to delete from storage if we have the URL
      const photoUrl = response.data.data?.photo_url || photoToDelete?.photo_url;
      if (photoUrl) {
        try {
          const match = photoUrl.match(/\/api\/images\/(\w+)\/([^/]+)$/);
          if (match) {
            const [, category, filename] = match;
            await apiClient.delete(`/api/images/${category}/${filename}`);
          }
        } catch (storageError) {
          console.error('Storage delete error:', storageError);
          // Continue even if storage delete fails
        }
      }

      // Update local state
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      closePhotoModal();

      toast({
        title: 'Photo Deleted',
        description: 'Your progress photo has been deleted.',
      });

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete photo. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open photo in detail modal and fetch annotations/comments
  const openPhotoDetail = async (photo: ProgressPhoto) => {
    setSelectedPhoto(photo);
    setShowPhotoModal(true);
    
    // Fetch annotations and comments for this photo
    await Promise.all([
      fetchAnnotations(photo.id),
      fetchComments(photo.id)
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header with upload button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Progress Photos</h2>
          <p className="text-gray-500">Track your skincare journey with before and after photos</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
        >
          <Upload className="w-5 h-5" /> Upload Photo
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && photos.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Photos Yet</h3>
          <p className="text-gray-500 mb-6">Start documenting your skincare journey by uploading your first photo</p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Camera className="w-5 h-5" /> Upload Your First Photo
          </button>
        </div>
      )}

      {/* Photos Timeline */}
      {!loading && photos.length > 0 && (
        <div className="space-y-8">
          {monthKeys.map((monthKey) => {
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const monthPhotos = photosByMonth[monthKey];

            return (
              <div key={monthKey}>
                <h3 className="font-serif font-bold text-lg text-gray-900 mb-4">{monthName}</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {monthPhotos.map((photo) => {
                    const metadata = photoMetadata[photo.id];
                    const hasAnnotations = metadata?.hasAnnotations || false;
                    const hasComments = metadata?.hasComments || false;
                    
                    return (
                      <div
                        key={photo.id}
                        onClick={() => openPhotoDetail(photo)}
                        className="relative group cursor-pointer rounded-xl overflow-hidden aspect-square bg-gray-100"
                      >
                        <EncryptedImage
                          src={photo.photo_url}
                          alt={photo.title || 'Progress photo'}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          fallbackIcon="user"
                          showFallback={true}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              photo.photo_type === 'before' ? 'bg-blue-500 text-white' :
                              photo.photo_type === 'after' ? 'bg-green-500 text-white' :
                              'bg-purple-500 text-white'
                            }`}>
                              {photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                            </span>
                            {photo.title && (
                              <p className="text-white text-sm mt-1 truncate">{photo.title}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Badges for annotations and comments */}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {hasAnnotations && (
                            <div className="w-6 h-6 bg-[#CFAFA3] rounded-full flex items-center justify-center" title="Has professional markup">
                              <Edit className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {hasComments && (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center" title="Has professional feedback">
                              <MessageSquare className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <UploadPhotoModal
        isOpen={showUploadModal}
        onClose={closeUploadModal}
        uploading={uploading}
        photoType={uploadPhotoType}
        setPhotoType={setUploadPhotoType}
        photoTitle={uploadPhotoTitle}
        setPhotoTitle={setUploadPhotoTitle}
        photoNotes={uploadPhotoNotes}
        setPhotoNotes={setUploadPhotoNotes}
        onFileSelect={handlePhotoFileSelect}
      />

      {/* Photo Detail Modal */}
      <PhotoDetailModal
        isOpen={showPhotoModal}
        onClose={closePhotoModal}
        photo={selectedPhoto}
        annotations={photoAnnotations}
        comments={photoComments}
        annotationsLoading={annotationsLoading}
        commentsLoading={commentsLoading}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
};

export default ProgressPhotosSection;
