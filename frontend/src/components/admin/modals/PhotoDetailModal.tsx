/**
 * @fileoverview Photo Detail Modal for Admin Dashboard
 * Shows detailed view of a progress photo with comments and annotations
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  MessageSquare,
  Edit,
  Eye,
  ExternalLink,
  Tag,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface ProgressPhoto {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  photo_type: 'before' | 'after' | 'progress';
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  skin_analysis: Record<string, unknown> | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  professional_name?: string;
  professional_avatar?: string;
}

interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  professional_name?: string;
}

interface PhotoDetailModalProps {
  photo: ProgressPhoto;
  user: UserInfo | null;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  user,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>([]);
  const [viewingMarkup, setViewingMarkup] = useState<PhotoAnnotation | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showMarkup, setShowMarkup] = useState(false);

  // Fetch comments and annotations from backend API
  useEffect(() => {
    const fetchPhotoDetails = async () => {
      const authToken = getAuthToken();
      if (!authToken) return;

      setLoading(true);
      try {
        apiClient.setAuthToken(authToken);
        const response = await apiClient.get<{
          success: boolean;
          data?: { comments: PhotoComment[]; annotations: PhotoAnnotation[] };
        }>(`/api/admin/progress-photos/${photo.id}/details`);

        if (response.data.success && response.data.data) {
          // Map comments with fallback for professional name
          const mappedComments: PhotoComment[] = (response.data.data.comments || []).map((c: PhotoComment) => ({
            ...c,
            professional_name: c.professional_name || 'Professional',
            professional_avatar: c.professional_avatar || undefined,
          }));
          setComments(mappedComments);

          // Map annotations with fallback for professional name
          const mappedAnnotations: PhotoAnnotation[] = (response.data.data.annotations || []).map((a: PhotoAnnotation) => ({
            ...a,
            professional_name: a.professional_name || 'Professional',
          }));
          setAnnotations(mappedAnnotations);
        }
      } catch (error) {
        console.error('Error fetching photo details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotoDetails();
  }, [photo.id]);

  const latestMarkup = annotations.length > 0 ? annotations[0] : null;
  const displayImage = showMarkup && latestMarkup ? latestMarkup.markup_image : photo.photo_url;

  const getPhotoTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'before':
        return 'bg-blue-100 text-blue-700';
      case 'after':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-purple-100 text-purple-700';
    }
  };

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden">
          <div className="bg-white rounded-2xl overflow-hidden relative">
            {/* Close button - positioned inside the modal card */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-20"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <div className="grid md:grid-cols-2 max-h-[85vh]">

              {/* Photo Section */}
              <div className="relative bg-gray-900 flex items-center justify-center min-h-[400px]">
                {/* Zoom Controls */}
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                  <button
                    onClick={() => setZoom(z => Math.min(z + 0.25, 2))}
                    className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                    className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                    title="Reset Zoom"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  {latestMarkup && (
                    <button
                      onClick={() => setShowMarkup(!showMarkup)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        showMarkup ? 'bg-amber-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                    >
                      {showMarkup ? 'Show Original' : 'Show Markup'}
                    </button>
                  )}
                </div>

                {/* Image */}
                <div
                  className="transition-transform duration-200"
                  style={{ transform: `scale(${zoom})` }}
                >
                  <EncryptedImage
                    src={displayImage}
                    alt={photo.title || 'Progress photo'}
                    className="max-w-full max-h-[500px] object-contain"
                    fallbackClassName="max-w-full max-h-[500px] bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
                  />
                </div>

                {/* Markup indicator */}
                {showMarkup && latestMarkup && (
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-full">
                    Viewing Professional Markup
                  </div>
                )}
              </div>

              {/* Details Section */}
              <div className="p-6 flex flex-col max-h-[500px] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getPhotoTypeBadgeClass(
                      photo.photo_type
                    )}`}
                  >
                    {photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                  </span>
                  <button
                    onClick={onClose}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors md:hidden"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                {/* Date */}
                <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(photo.taken_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>

                {/* User Info */}
                {user && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                    {user.avatar_url ? (
                      <EncryptedImage
                        src={user.avatar_url}
                        alt={user.full_name || 'User'}
                        className="w-10 h-10 rounded-full object-cover"
                        fallbackClassName="w-10 h-10 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-amber-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.full_name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    {user.role && (
                      <span className="ml-auto px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full capitalize">
                        {user.role}
                      </span>
                    )}
                  </div>
                )}

                {/* Title */}
                {photo.title && (
                  <h3 className="font-serif font-bold text-xl text-gray-900 mb-2">
                    {photo.title}
                  </h3>
                )}

                {/* Notes */}
                {photo.notes && (
                  <p className="text-gray-600 mb-4">{photo.notes}</p>
                )}

                {/* Tags */}
                {photo.tags && photo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {photo.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-amber-100 text-amber-700 text-sm rounded-full flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Annotations Section */}
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit className="w-4 h-4 text-amber-600" />
                    <h4 className="font-medium text-gray-900 text-sm">
                      Image Markups ({annotations.length})
                    </h4>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    </div>
                  ) : annotations.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-2">
                      No markups for this photo.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[120px] overflow-y-auto">
                      {annotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="flex items-center justify-between text-sm bg-white p-2 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <EncryptedImage
                              src={ann.markup_image}
                              alt="Markup thumbnail"
                              className="w-10 h-10 rounded object-cover border border-gray-200"
                              fallbackClassName="w-10 h-10 rounded object-cover border border-gray-200 bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-700 font-medium truncate">
                                {ann.professional_name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(ann.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setViewingMarkup(ann)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View markup"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                            <a
                              href={ann.markup_image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-500" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="flex-1 border-t border-gray-100 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Professional Feedback ({comments.length})
                  </h4>

                  {loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No feedback for this photo yet.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[200px] overflow-y-auto">
                      {comments.map((comment) => (
                        <div key={comment.id} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {comment.professional_avatar ? (
                                <img
                                  src={comment.professional_avatar}
                                  alt={comment.professional_name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                  <User className="w-3 h-3 text-amber-600" />
                                </div>
                              )}
                              <span className="text-xs font-medium text-amber-600">
                                {comment.professional_name}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Photo ID:</span>{' '}
                      <span className="font-mono">{photo.id.slice(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(photo.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Markup Viewer Modal */}
      {viewingMarkup && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh]">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
              <div className="text-white">
                <h3 className="font-medium">Markup by {viewingMarkup.professional_name}</h3>
                <p className="text-sm text-gray-300">
                  {new Date(viewingMarkup.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingMarkup.markup_image}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Original
                </a>
                <button
                  onClick={() => setViewingMarkup(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="flex items-center justify-center h-full pt-16">
              <EncryptedImage
                src={viewingMarkup.markup_image}
                alt="Markup"
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                fallbackClassName="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoDetailModal;
