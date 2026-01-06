import React from 'react';
import { X, Loader2, MessageSquare, Trash2, Edit, User } from 'lucide-react';
import { ProgressPhoto, PhotoAnnotation, PhotoComment } from './progressPhotosTypes';
import AnnotationViewer from './AnnotationViewer';

// ============================================================================
// TYPES
// ============================================================================

interface PhotoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: ProgressPhoto | null;
  annotations: PhotoAnnotation[];
  comments: PhotoComment[];
  annotationsLoading: boolean;
  commentsLoading: boolean;
  onDelete: (photoId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  isOpen,
  onClose,
  photo,
  annotations,
  comments,
  annotationsLoading,
  commentsLoading,
  onDelete,
}) => {
  if (!isOpen || !photo) return null;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this photo?')) return;
    onDelete(photo.id);
  };

  const isLoading = annotationsLoading || commentsLoading;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-lg"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Photo with Annotations */}
            <div className="relative bg-gray-900 min-h-[400px] md:min-h-[550px]">
              {annotationsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              ) : annotations.length > 0 ? (
                <AnnotationViewer
                  imageUrl={photo.photo_url}
                  annotations={annotations}
                  showControls={true}
                  className="h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={photo.photo_url}
                    alt={photo.title || 'Progress photo'}
                    className="max-w-full max-h-[550px] object-contain"
                  />
                </div>
              )}
            </div>


            {/* Details & Comments - Entire section scrollable */}
            <div className="p-6 max-h-[550px] overflow-y-auto">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    photo.photo_type === 'before' ? 'bg-blue-100 text-blue-700' :
                    photo.photo_type === 'after' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                  </span>
                  {annotations.length > 0 && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#CFAFA3]/10 text-[#CFAFA3] flex items-center gap-1">
                      <Edit className="w-3 h-3" />
                      {annotations.length} Markup{annotations.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {new Date(photo.taken_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              {photo.title && (
                <h3 className="font-serif font-bold text-xl text-gray-900 mb-2">{photo.title}</h3>
              )}

              {photo.notes && (
                <p className="text-gray-600 mb-4">{photo.notes}</p>
              )}

              {/* Professional Annotations Info */}
              {annotations.length > 0 && (
                <div className="mb-4 p-4 bg-gradient-to-r from-[#CFAFA3]/10 to-[#E8D5D0]/10 rounded-xl border border-[#CFAFA3]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit className="w-5 h-5 text-[#CFAFA3]" />
                    <h4 className="font-medium text-gray-900">Professional Markup Available</h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Your skincare professional has marked up this photo with feedback. 
                    Use the controls on the image to toggle between the original and marked-up version.
                  </p>
                  <div className="space-y-2">
                    {annotations.map((ann) => (
                      <div key={ann.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-[#CFAFA3]" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">
                              {ann.professional_name || 'Your Professional'}
                            </span>
                            <p className="text-xs text-gray-400">
                              {new Date(ann.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Professional Feedback ({comments.length})
                </h4>

                {commentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-[#CFAFA3] animate-spin" />
                  </div>
                ) : comments.length === 0 && annotations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No feedback yet</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Check the image markup for visual feedback from your professional
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          {comment.professional_avatar ? (
                            <img 
                              src={comment.professional_avatar} 
                              alt={comment.professional_name || 'Professional'}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center">
                              <User className="w-3 h-3 text-[#CFAFA3]" />
                            </div>
                          )}
                          <span className="text-xs font-medium text-[#CFAFA3]">
                            {comment.professional_name || 'Your Professional'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{comment.content}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(comment.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <div className="pt-4 border-t border-gray-100 mt-4">
                <button
                  onClick={handleDelete}
                  className="w-full py-2 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete Photo
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoDetailModal;
