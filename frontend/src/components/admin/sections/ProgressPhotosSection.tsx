/**
 * @fileoverview Progress Photos Section Component for Admin Dashboard
 * Manages all user progress photos with comments and annotations
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  Camera,
  Image,
  Users,
  Loader2,
  MessageSquare,
  Eye,
  Edit,
  RefreshCw,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CustomSelect } from '@/components/ui/custom-select';
import PhotoDetailModal from '@/components/admin/modals/PhotoDetailModal';

// ============================================================================
// TYPES
// ============================================================================

interface DBProgressPhoto {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  notes: string | null;
  skin_analysis: Record<string, unknown> | null;
  tags: string[] | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
  photo_type: string | null;
  title: string | null;
}

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
  // Counts
  comments_count?: number;
  annotations_count?: number;
}

interface UserInfo {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const dbToProgressPhoto = (dbPhoto: DBProgressPhoto): ProgressPhoto => {
  return {
    id: dbPhoto.id,
    client_id: dbPhoto.client_id,
    photo_url: dbPhoto.photo_url,
    thumbnail_url: dbPhoto.thumbnail_url,
    photo_type: (dbPhoto.photo_type as 'before' | 'after' | 'progress') || 'progress',
    title: dbPhoto.title,
    notes: dbPhoto.notes,
    tags: dbPhoto.tags,
    skin_analysis: dbPhoto.skin_analysis,
    taken_at: dbPhoto.taken_at || dbPhoto.created_at,
    created_at: dbPhoto.created_at,
    updated_at: dbPhoto.updated_at,
  };
};

// ============================================================================
// COMPONENT
// ============================================================================

const ProgressPhotosSection: React.FC = () => {
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [users, setUsers] = useState<Map<string, UserInfo>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhotoType, setSelectedPhotoType] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 12;

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    before: 0,
    after: 0,
    progress: 0,
    usersWithPhotos: 0,
    withComments: 0,
    withAnnotations: 0,
  });

  // ============================================================================
  // FETCH DATA
  // ============================================================================

  const fetchPhotos = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Build query
      let query = supabase
        .from('progress_photos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply filters
      if (selectedPhotoType) {
        query = query.eq('photo_type', selectedPhotoType);
      }

      if (selectedUser) {
        query = query.eq('client_id', selectedUser);
      }

      // Apply pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data: photosData, error: photosError, count } = await query;

      if (photosError) {
        console.error('Error fetching photos:', photosError);
        toast({
          title: 'Error',
          description: 'Failed to load progress photos. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setTotalCount(count || 0);

      // Map to ProgressPhoto type
      const mappedPhotos = (photosData || []).map(dbToProgressPhoto);

      // Get unique user IDs
      const userIds = [...new Set(mappedPhotos.map(p => p.client_id))];

      // Fetch user info for these photos
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, avatar_url, role')
          .in('id', userIds);

        if (!usersError && usersData) {
          const userMap = new Map<string, UserInfo>();
          usersData.forEach(u => {
            userMap.set(u.id, {
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              avatar_url: u.avatar_url,
              role: u.role,
            });
          });
          setUsers(prev => {
            const newMap = new Map(prev);
            userMap.forEach((value, key) => newMap.set(key, value));
            return newMap;
          });
        }
      }

      // Fetch comments and annotations counts
      if (mappedPhotos.length > 0) {
        const photoIds = mappedPhotos.map(p => p.id);

        // Get comments count per photo
        const { data: commentsData } = await supabase
          .from('photo_comments')
          .select('photo_id')
          .in('photo_id', photoIds);

        const commentsCounts = new Map<string, number>();
        (commentsData || []).forEach(c => {
          commentsCounts.set(c.photo_id, (commentsCounts.get(c.photo_id) || 0) + 1);
        });

        // Get annotations count per photo
        const { data: annotationsData } = await supabase
          .from('photo_annotations')
          .select('photo_id')
          .in('photo_id', photoIds);

        const annotationsCounts = new Map<string, number>();
        (annotationsData || []).forEach(a => {
          annotationsCounts.set(a.photo_id, (annotationsCounts.get(a.photo_id) || 0) + 1);
        });

        // Add counts to photos
        mappedPhotos.forEach(photo => {
          photo.comments_count = commentsCounts.get(photo.id) || 0;
          photo.annotations_count = annotationsCounts.get(photo.id) || 0;
        });
      }

      setPhotos(mappedPhotos);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, selectedPhotoType, selectedUser, toast]);

  const fetchStats = useCallback(async () => {
    try {
      // Get total counts by type
      const { data: allPhotos, error } = await supabase
        .from('progress_photos')
        .select('id, client_id, photo_type');

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      const before = allPhotos?.filter(p => p.photo_type === 'before').length || 0;
      const after = allPhotos?.filter(p => p.photo_type === 'after').length || 0;
      const progress = allPhotos?.filter(p => p.photo_type === 'progress' || !p.photo_type).length || 0;
      const usersWithPhotos = new Set(allPhotos?.map(p => p.client_id)).size;

      // Get photos with comments
      const { data: photosWithComments } = await supabase
        .from('photo_comments')
        .select('photo_id');
      const withComments = new Set(photosWithComments?.map(c => c.photo_id)).size;

      // Get photos with annotations
      const { data: photosWithAnnotations } = await supabase
        .from('photo_annotations')
        .select('photo_id');
      const withAnnotations = new Set(photosWithAnnotations?.map(a => a.photo_id)).size;

      setStats({
        total: allPhotos?.length || 0,
        before,
        after,
        progress,
        usersWithPhotos,
        withComments,
        withAnnotations,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      // Get all users who have photos
      const { data: photoUsers } = await supabase
        .from('progress_photos')
        .select('client_id');

      const userIds = [...new Set(photoUsers?.map(p => p.client_id) || [])];

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, avatar_url, role')
          .in('id', userIds);

        if (usersData) {
          const userMap = new Map<string, UserInfo>();
          usersData.forEach(u => {
            userMap.set(u.id, {
              id: u.id,
              full_name: u.full_name,
              email: u.email,
              avatar_url: u.avatar_url,
              role: u.role,
            });
          });
          setUsers(userMap);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPhotos();
    fetchStats();
    fetchAllUsers();
  }, []);

  // Refetch when filters or page change
  useEffect(() => {
    fetchPhotos();
  }, [currentPage, selectedPhotoType, selectedUser]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedPhotoType, selectedUser]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = () => {
    fetchPhotos(true);
    fetchStats();
  };

  const handleViewDetails = (photo: ProgressPhoto) => {
    setSelectedPhoto(photo);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedPhoto(null);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedPhotoType('');
    setSelectedUser('');
    setCurrentPage(1);
  };

  // Filter photos by search query (client-side)
  const filteredPhotos = photos.filter(photo => {
    if (!searchQuery) return true;
    const user = users.get(photo.client_id);
    const searchLower = searchQuery.toLowerCase();
    return (
      (photo.title?.toLowerCase().includes(searchLower)) ||
      (photo.notes?.toLowerCase().includes(searchLower)) ||
      (photo.tags?.some(tag => tag.toLowerCase().includes(searchLower))) ||
      (user?.full_name?.toLowerCase().includes(searchLower)) ||
      (user?.email?.toLowerCase().includes(searchLower))
    );
  });

  // Pagination
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // User options for filter
  const userOptions = [
    { value: '', label: 'All Users' },
    ...Array.from(users.values()).map(u => ({
      value: u.id,
      label: u.full_name || u.email,
    })),
  ];

  // Photo type options
  const photoTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'progress', label: 'Progress' },
  ];

  const getPhotoTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'before':
        return 'bg-blue-500 text-white';
      case 'after':
        return 'bg-green-500 text-white';
      default:
        return 'bg-purple-500 text-white';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Progress Photos</h2>
          <p className="text-gray-500">View and manage all user progress photos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total Photos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Image className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.before}</p>
              <p className="text-xs text-gray-500">Before</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Image className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.after}</p>
              <p className="text-xs text-gray-500">After</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Image className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.progress}</p>
              <p className="text-xs text-gray-500">Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.usersWithPhotos}</p>
              <p className="text-xs text-gray-500">Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.withComments}</p>
              <p className="text-xs text-gray-500">With Comments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Edit className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.withAnnotations}</p>
              <p className="text-xs text-gray-500">With Markups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, title, notes, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Photo Type Filter */}
          <div className="min-w-[150px]">
            <CustomSelect
              value={selectedPhotoType}
              onChange={setSelectedPhotoType}
              options={photoTypeOptions}
              placeholder="All Types"
            />
          </div>

          {/* User Filter */}
          <div className="min-w-[200px]">
            <CustomSelect
              value={selectedUser}
              onChange={setSelectedUser}
              options={userOptions}
              placeholder="All Users"
            />
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedPhotoType || selectedUser) && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Filter className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading progress photos...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredPhotos.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Photos Found</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-4">
            {searchQuery || selectedPhotoType || selectedUser
              ? 'No photos match your current filters. Try adjusting your search criteria.'
              : 'No progress photos have been uploaded yet.'}
          </p>
          {(searchQuery || selectedPhotoType || selectedUser) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-amber-600 hover:bg-amber-50 rounded-lg font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Photos Grid */}
      {!loading && filteredPhotos.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredPhotos.map((photo) => {
              const user = users.get(photo.client_id);
              const photoTypeLabel = photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1);

              return (
                <div
                  key={photo.id}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Photo */}
                  <div
                    onClick={() => handleViewDetails(photo)}
                    className="relative cursor-pointer aspect-square bg-gray-100"
                  >
                    <img
                      src={photo.thumbnail_url || photo.photo_url}
                      alt={photo.title || 'Progress photo'}
                      className="w-full h-full object-cover transition-transform hover:scale-105"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== photo.photo_url) {
                          target.src = photo.photo_url;
                        }
                      }}
                    />
                    {/* Photo type badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPhotoTypeBadgeClass(photo.photo_type)}`}>
                        {photoTypeLabel}
                      </span>
                    </div>
                    {/* Indicators */}
                    <div className="absolute top-3 right-3 flex gap-1">
                      {(photo.annotations_count || 0) > 0 && (
                        <div className="px-2 py-1 bg-orange-500 rounded-lg flex items-center gap-1">
                          <Edit className="w-3 h-3 text-white" />
                          <span className="text-white text-xs">{photo.annotations_count}</span>
                        </div>
                      )}
                      {(photo.comments_count || 0) > 0 && (
                        <div className="px-2 py-1 bg-pink-500 rounded-lg flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-white" />
                          <span className="text-white text-xs">{photo.comments_count}</span>
                        </div>
                      )}
                    </div>
                    {/* Date */}
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-lg flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-white" />
                      <p className="text-white text-xs">
                        {new Date(photo.taken_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || 'User'}
                          className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center border-2 border-gray-100">
                          <Users className="w-5 h-5 text-amber-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user?.full_name || 'Unknown User'}
                        </p>
                        {photo.title && (
                          <p className="text-xs text-gray-500 truncate">{photo.title}</p>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {photo.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {photo.tags.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                            +{photo.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handleViewDetails(photo)}
                        className="w-full flex items-center justify-center gap-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} photos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-amber-500 text-white'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Photo Detail Modal */}
      {showDetailModal && selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          user={users.get(selectedPhoto.client_id) || null}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default ProgressPhotosSection;
