import React, { useState, useEffect } from 'react';
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
  Send,
  RefreshCw,
  Calendar,
  Tag,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import ImageMarkupEditor from '@/components/professional/modals/ImageMarkupEditor';
import { AnnotationData } from '@/hooks/usePhotoAnnotations';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CustomSelect } from '@/components/ui/custom-select';

// ============================================================================
// TYPES
// ============================================================================

// Database type for photo_comments table
interface DBPhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Database type for photo_annotations table
interface DBPhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  updated_at: string;
}

interface PhotoComment {
  id: string;
  content: string;
  created_at: string;
  professional_id: string;
  professional_name?: string;
}

interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  professional_name?: string;
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
}

interface Client {
  id: string;
  name: string;
  email: string;
  image: string;
  isRegistered: boolean;
}

// Database types - Matching actual progress_photos table structure
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

// Database type for user_profiles table
interface DBUserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  skin_type: string | null;
  concerns: string[] | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

// Database type for client_professional_relationships table
interface DBClientProfessionalRelationship {
  id: string;
  client_id: string;
  professional_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Convert database record to ProgressPhoto type
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

// Convert database user profile to Client type
const dbToClient = (dbProfile: DBUserProfile): Client => {
  return {
    id: dbProfile.id,
    name: dbProfile.full_name || 'Unknown',
    email: dbProfile.email || '',
    image: dbProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbProfile.full_name || 'U')}&background=CFAFA3&color=fff`,
    isRegistered: true,
  };
};

// ============================================================================
// COMPONENT
// ============================================================================

const ClientPhotosSection: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [photoSearchQuery, setPhotoSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showMarkupEditor, setShowMarkupEditor] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>([]);
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [loadingPhotoDetails, setLoadingPhotoDetails] = useState(false);
  const [viewingMarkup, setViewingMarkup] = useState<PhotoAnnotation | null>(null);
  const [deletingAnnotation, setDeletingAnnotation] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);

  // ============================================================================
  // FETCH DATA FROM DATABASE
  // ============================================================================

  const fetchData = async (showRefreshIndicator = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // ========================================================================
      // STEP 1: Get all client_ids from client_professional_relationships table
      // where professional_id matches the current signed-in professional's id
      // ========================================================================
      console.log('Fetching client relationships for professional:', user.id);
      
      const { data: relationshipsData, error: relationshipsError } = await supabase
        .from('client_professional_relationships')
        .select('client_id, professional_id, created_at')
        .eq('professional_id', user.id);

      if (relationshipsError) {
        console.error('Error fetching client_professional_relationships:', relationshipsError);
        toast({
          title: 'Error',
          description: 'Failed to load client relationships. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('Relationships data:', relationshipsData);

      // Extract unique client IDs from the relationships
      const clientIds: string[] = [];
      if (relationshipsData && relationshipsData.length > 0) {
        relationshipsData.forEach((relationship: DBClientProfessionalRelationship) => {
          if (relationship.client_id && !clientIds.includes(relationship.client_id)) {
            clientIds.push(relationship.client_id);
          }
        });
      }

      console.log('Client IDs extracted:', clientIds);

      if (clientIds.length === 0) {
        // No clients found for this professional
        console.log('No clients found for this professional');
        setPhotos([]);
        setClients([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // ========================================================================
      // STEP 2: Get client details from user_profiles table using the client_ids
      // ========================================================================
      console.log('Fetching client profiles for IDs:', clientIds);
      
      const { data: clientsData, error: clientsError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, phone, skin_type, concerns, role, created_at, updated_at')
        .in('id', clientIds);

      if (clientsError) {
        console.error('Error fetching user_profiles:', clientsError);
        toast({
          title: 'Error',
          description: 'Failed to load client details. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('Clients data:', clientsData);

      // Map database data to Client interface
      const mappedClients: Client[] = (clientsData || []).map((profile: DBUserProfile) => 
        dbToClient(profile)
      );
      setClients(mappedClients);

      // ========================================================================
      // STEP 3: Get progress_photos from progress_photos table
      // where client_id matches any of the client_ids from step 1
      // ========================================================================
      console.log('Fetching progress photos for client IDs:', clientIds);
      
      const { data: photosData, error: photosError } = await supabase
        .from('progress_photos')
        .select('*')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false });

      if (photosError) {
        console.error('Error fetching progress_photos:', photosError);
        toast({
          title: 'Error',
          description: 'Failed to load progress photos. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      console.log('Photos data:', photosData);

      // Map database data to ProgressPhoto interface
      const mappedPhotos: ProgressPhoto[] = (photosData || []).map((photo: DBProgressPhoto) => 
        dbToProgressPhoto(photo)
      );
      setPhotos(mappedPhotos);

      console.log('Successfully loaded', mappedClients.length, 'clients and', mappedPhotos.length, 'photos');

    } catch (error) {
      console.error('Unexpected error fetching data:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch comments and annotations for a specific photo
  const fetchPhotoDetails = async (photoId: string) => {
    if (!user?.id) return;

    setLoadingPhotoDetails(true);
    try {
      // Fetch comments from photo_comments table
      const { data: commentsData, error: commentsError } = await supabase
        .from('photo_comments')
        .select('*')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
      } else {
        // Get professional names for comments
        const professionalIds = [...new Set((commentsData || []).map((c: DBPhotoComment) => c.professional_id))];
        let professionalNames: Record<string, string> = {};
        
        if (professionalIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', professionalIds);
          
          if (profilesData) {
            professionalNames = profilesData.reduce((acc: Record<string, string>, p: { id: string; full_name: string | null }) => {
              acc[p.id] = p.full_name || 'Professional';
              return acc;
            }, {});
          }
        }

        const mappedComments: PhotoComment[] = (commentsData || []).map((c: DBPhotoComment) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          professional_id: c.professional_id,
          professional_name: c.professional_id === user.id ? 'You' : (professionalNames[c.professional_id] || 'Professional'),
        }));
        setComments(mappedComments);
      }

      // Fetch annotations from photo_annotations table
      const { data: annotationsData, error: annotationsError } = await supabase
        .from('photo_annotations')
        .select('*')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: false });

      if (annotationsError) {
        console.error('Error fetching annotations:', annotationsError);
      } else {
        // Get professional names for annotations
        const professionalIds = [...new Set((annotationsData || []).map((a: DBPhotoAnnotation) => a.professional_id))];
        let professionalNames: Record<string, string> = {};
        
        if (professionalIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('id, full_name')
            .in('id', professionalIds);
          
          if (profilesData) {
            professionalNames = profilesData.reduce((acc: Record<string, string>, p: { id: string; full_name: string | null }) => {
              acc[p.id] = p.full_name || 'Professional';
              return acc;
            }, {});
          }
        }

        const mappedAnnotations: PhotoAnnotation[] = (annotationsData || []).map((a: DBPhotoAnnotation) => ({
          id: a.id,
          photo_id: a.photo_id,
          professional_id: a.professional_id,
          markup_image: a.markup_image,
          created_at: a.created_at,
          professional_name: a.professional_id === user.id ? 'You' : (professionalNames[a.professional_id] || 'Professional'),
        }));
        setAnnotations(mappedAnnotations);
      }
    } catch (error) {
      console.error('Error fetching photo details:', error);
    } finally {
      setLoadingPhotoDetails(false);
    }
  };

  // Fetch data on component mount and when user changes
  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  // Fetch photo details when a photo is selected
  useEffect(() => {
    if (selectedPhoto && showPhotoModal) {
      fetchPhotoDetails(selectedPhoto.id);
    } else {
      // Clear comments and annotations when modal is closed
      setComments([]);
      setAnnotations([]);
    }
  }, [selectedPhoto?.id, showPhotoModal]);

  // Create client lookup map for quick access
  const clientLookup = new Map(clients.map(c => [c.id, c]));

  // Filter photos based on search query and selected client filter
  const filteredPhotos = photos.filter(photo => {
    const client = clientLookup.get(photo.client_id);
    const clientName = client?.name || '';
    
    // Search filter - match against client name, photo title, notes, or tags
    const matchesSearch = !photoSearchQuery || 
      clientName.toLowerCase().includes(photoSearchQuery.toLowerCase()) ||
      (photo.title?.toLowerCase().includes(photoSearchQuery.toLowerCase())) ||
      (photo.notes?.toLowerCase().includes(photoSearchQuery.toLowerCase())) ||
      (photo.tags?.some(tag => tag.toLowerCase().includes(photoSearchQuery.toLowerCase())));
    
    // Client filter - match against selected client
    const matchesClient = !selectedClientFilter || photo.client_id === selectedClientFilter;
    
    return matchesSearch && matchesClient;
  });

  // Calculate stats
  const totalPhotos = photos.length;
  const beforePhotos = photos.filter(p => p.photo_type === 'before').length;
  const afterPhotos = photos.filter(p => p.photo_type === 'after').length;
  const progressPhotos = photos.filter(p => p.photo_type === 'progress').length;
  const clientsWithPhotos = new Set(photos.map(p => p.client_id)).size;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setNewComment('');
    setComments([]);
    setAnnotations([]);
    setViewingMarkup(null);
  };

  const handleAddComment = async () => {
    if (!selectedPhoto || !newComment.trim() || !user?.id) return;
    
    setAddingComment(true);
    try {
      // Save comment to photo_comments table
      const { data: newCommentData, error: insertError } = await supabase
        .from('photo_comments')
        .insert({
          photo_id: selectedPhoto.id,
          professional_id: user.id,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting comment:', insertError);
        throw new Error(`Failed to add feedback: ${insertError.message}`);
      }
      
      // Add the new comment to local state
      const newCommentObj: PhotoComment = {
        id: newCommentData.id,
        content: newCommentData.content,
        created_at: newCommentData.created_at,
        professional_id: newCommentData.professional_id,
        professional_name: 'You',
      };
      
      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');

      toast({
        title: 'Feedback Added',
        description: 'Your feedback has been added to the photo.',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user?.id) return;

    setDeletingComment(commentId);
    try {
      const { error: deleteError } = await supabase
        .from('photo_comments')
        .delete()
        .eq('id', commentId)
        .eq('professional_id', user.id);

      if (deleteError) {
        console.error('Error deleting comment:', deleteError);
        throw new Error(`Failed to delete feedback: ${deleteError.message}`);
      }

      // Remove from local state
      setComments(prev => prev.filter(c => c.id !== commentId));

      toast({
        title: 'Feedback Deleted',
        description: 'Your feedback has been removed.',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingComment(null);
    }
  };

  const handleSaveAnnotation = async (annotationData: AnnotationData, imageBlob: Blob) => {
    if (!selectedPhoto || !user?.id) {
      toast({
        title: 'Error',
        description: 'Missing photo or user information.',
        variant: 'destructive',
      });
      return;
    }

    setSavingAnnotation(true);
    try {
      // Generate unique filename for the markup image
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `markups/${user.id}/${selectedPhoto.id}/${timestamp}-${randomStr}.png`;

      // Upload the annotated image to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, imageBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading markup image:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get the public URL for the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(fileName);

      const markupImageUrl = publicUrlData.publicUrl;

      // Save the annotation record to photo_annotations table
      const { data: annotationRecord, error: insertError } = await supabase
        .from('photo_annotations')
        .insert({
          photo_id: selectedPhoto.id,
          professional_id: user.id,
          markup_image: markupImageUrl,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving annotation record:', insertError);
        throw new Error(`Failed to save annotation: ${insertError.message}`);
      }

      // Update local state with the new annotation
      const newAnnotation: PhotoAnnotation = {
        id: annotationRecord.id,
        photo_id: selectedPhoto.id,
        professional_id: user.id,
        markup_image: markupImageUrl,
        created_at: annotationRecord.created_at,
        professional_name: 'You',
      };
      
      setAnnotations(prev => [newAnnotation, ...prev]);
      setShowMarkupEditor(false);

      toast({
        title: 'Annotation Saved',
        description: 'Your markup has been saved successfully.',
      });
    } catch (error) {
      console.error('Error saving annotation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save annotation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: string, markupImageUrl: string) => {
    if (!user?.id) return;

    setDeletingAnnotation(annotationId);
    try {
      // Delete the annotation record from database
      const { error: deleteError } = await supabase
        .from('photo_annotations')
        .delete()
        .eq('id', annotationId)
        .eq('professional_id', user.id);

      if (deleteError) {
        console.error('Error deleting annotation:', deleteError);
        throw new Error(`Failed to delete markup: ${deleteError.message}`);
      }

      // Try to delete the image from storage (extract path from URL)
      try {
        const url = new URL(markupImageUrl);
        const pathParts = url.pathname.split('/storage/v1/object/public/progress-photos/');
        if (pathParts.length > 1) {
          const filePath = pathParts[1];
          await supabase.storage.from('progress-photos').remove([filePath]);
        }
      } catch (storageError) {
        console.warn('Could not delete image from storage:', storageError);
        // Continue anyway - the record is deleted
      }

      // Remove from local state
      setAnnotations(prev => prev.filter(a => a.id !== annotationId));

      toast({
        title: 'Markup Deleted',
        description: 'Your markup has been removed.',
      });
    } catch (error) {
      console.error('Error deleting annotation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete markup. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAnnotation(null);
    }
  };

  const handleViewClientProfile = (clientId: string) => {
    console.log('View client profile:', clientId);
    // TODO: Integrate with client profile modal
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  // Client filter options for CustomSelect
  const clientFilterOptions = [
    { value: '', label: 'All Clients' },
    ...clients.map(client => ({
      value: client.id,
      label: client.name,
    })),
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Client Progress Photos</h2>
          <p className="text-gray-500">View and provide feedback on client photos</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name, photo title, or tags..."
            value={photoSearchQuery}
            onChange={(e) => setPhotoSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1"
          />
          {photoSearchQuery && (
            <button
              onClick={() => setPhotoSearchQuery('')}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="min-w-[200px]">
          <CustomSelect
            value={selectedClientFilter}
            onChange={setSelectedClientFilter}
            options={clientFilterOptions}
            placeholder="All Clients"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#CFAFA3]/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPhotos}</p>
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
              <p className="text-2xl font-bold text-gray-900">{beforePhotos}</p>
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
              <p className="text-2xl font-bold text-gray-900">{afterPhotos}</p>
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
              <p className="text-2xl font-bold text-gray-900">{progressPhotos}</p>
              <p className="text-xs text-gray-500">Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{clientsWithPhotos}</p>
              <p className="text-xs text-gray-500">Clients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading client photos...</p>
          </div>
        </div>
      )}

      {/* Empty State - No Clients */}
      {!loading && clients.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Clients Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            You don't have any clients linked to your account yet. Add clients from the "My Clients" section to view their progress photos here.
          </p>
        </div>
      )}

      {/* Empty State - No Photos */}
      {!loading && clients.length > 0 && photos.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Photos Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Your clients haven't uploaded any progress photos yet. Photos will appear here once they start documenting their skincare journey.
          </p>
        </div>
      )}

      {/* Empty State - No Search Results */}
      {!loading && clients.length > 0 && photos.length > 0 && filteredPhotos.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-[#CFAFA3]" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Photos Found</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {photoSearchQuery
              ? `No photos match "${photoSearchQuery}". Try a different search term.`
              : 'No photos found for the selected client.'}
          </p>
          <button
            onClick={() => {
              setPhotoSearchQuery('');
              setSelectedClientFilter('');
            }}
            className="mt-4 px-4 py-2 text-[#CFAFA3] hover:bg-[#CFAFA3]/10 rounded-lg font-medium transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Photos Grid */}
      {!loading && filteredPhotos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => {
            const clientInfo = clientLookup.get(photo.client_id);
            const clientName = clientInfo?.name || 'Unknown Client';
            const clientImage = clientInfo?.image || '';
            const isRegistered = clientInfo?.isRegistered || false;
            const photoTypeLabel = photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1);
            const photoTypeClass =
              photo.photo_type === 'before'
                ? 'bg-blue-500 text-white'
                : photo.photo_type === 'after'
                ? 'bg-green-500 text-white'
                : 'bg-purple-500 text-white';

            return (
              <div
                key={photo.id}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Photo */}
                <div
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setShowPhotoModal(true);
                  }}
                  className="relative cursor-pointer aspect-square bg-gray-100"
                >
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.title || 'Progress photo'}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                    onError={(e) => {
                      // Fallback to main photo_url if thumbnail fails
                      const target = e.target as HTMLImageElement;
                      if (target.src !== photo.photo_url) {
                        target.src = photo.photo_url;
                      }
                    }}
                  />
                  {/* Photo type badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${photoTypeClass}`}>
                      {photoTypeLabel}
                    </span>
                  </div>
                  {/* Tags indicator */}
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded-lg flex items-center gap-1">
                      <Tag className="w-3 h-3 text-white" />
                      <p className="text-white text-xs">{photo.tags.length}</p>
                    </div>
                  )}
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

                {/* Client Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={clientImage}
                      alt={clientName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{clientName}</p>
                        {isRegistered && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium flex-shrink-0">
                            Registered
                          </span>
                        )}
                      </div>
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
                      onClick={() => {
                        setSelectedPhoto(photo);
                        setShowPhotoModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-1 py-2 bg-[#CFAFA3] text-white rounded-lg text-sm font-medium hover:bg-[#B89A8E] transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" /> Feedback
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Detail Modal */}
      {showPhotoModal && selectedPhoto && !showMarkupEditor && !viewingMarkup && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Close button - positioned outside modal for dark background */}
            <button
              onClick={handleClosePhotoModal}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-lg z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="bg-white rounded-2xl overflow-hidden relative">
              <div className="grid md:grid-cols-2 max-h-[85vh]">
                {/* Photo */}
                <div className="relative bg-black flex items-center justify-center">
                  <img
                    src={selectedPhoto.photo_url}
                    alt={selectedPhoto.title || 'Progress photo'}
                    className="w-full h-[400px] md:h-[500px] object-contain"
                  />
                </div>


                {/* Details & Comments */}
                <div className="p-6 flex flex-col max-h-[500px] overflow-y-auto">
                  {/* Header row with badge, annotate button, and close button */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedPhoto.photo_type === 'before'
                          ? 'bg-blue-100 text-blue-700'
                          : selectedPhoto.photo_type === 'after'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {selectedPhoto.photo_type.charAt(0).toUpperCase() +
                        selectedPhoto.photo_type.slice(1)}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Annotate Button */}
                      <button
                        onClick={() => setShowMarkupEditor(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                      >
                        <Edit className="w-4 h-4" /> Annotate
                      </button>
                      {/* Close button */}
                      <button
                        onClick={handleClosePhotoModal}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        aria-label="Close modal"
                      >
                        <X className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2 mb-4 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedPhoto.taken_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>


                  {/* Client Info */}
                  {clientLookup.get(selectedPhoto.client_id) && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                      <img
                        src={clientLookup.get(selectedPhoto.client_id)?.image}
                        alt={clientLookup.get(selectedPhoto.client_id)?.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {clientLookup.get(selectedPhoto.client_id)?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {clientLookup.get(selectedPhoto.client_id)?.email}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.title && (
                    <h3 className="font-serif font-bold text-xl text-gray-900 mb-2">
                      {selectedPhoto.title}
                    </h3>
                  )}

                  {selectedPhoto.notes && (
                    <p className="text-gray-600 mb-4">{selectedPhoto.notes}</p>
                  )}

                  {/* Tags */}
                  {selectedPhoto.tags && selectedPhoto.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedPhoto.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-[#CFAFA3]/10 text-[#CFAFA3] text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Saved Annotations Section */}
                  <div className="mb-4 p-3 bg-[#CFAFA3]/10 rounded-xl border border-[#CFAFA3]/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Edit className="w-4 h-4 text-[#CFAFA3]" />
                      <h4 className="font-medium text-gray-900 text-sm">
                        Image Markups ({annotations.length})
                      </h4>
                    </div>
                    
                    {loadingPhotoDetails ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="w-5 h-5 text-[#CFAFA3] animate-spin" />
                      </div>
                    ) : annotations.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">
                        No markups yet. Click "Annotate" to add one.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[120px] overflow-y-auto">
                        {annotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="flex items-center justify-between text-sm bg-white p-2 rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <img
                                src={ann.markup_image}
                                alt="Markup thumbnail"
                                className="w-10 h-10 rounded object-cover border border-gray-200"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-700 font-medium truncate">
                                  {ann.professional_name || 'Professional'}
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
                              {ann.professional_id === user?.id && (
                                <button
                                  onClick={() => handleDeleteAnnotation(ann.id, ann.markup_image)}
                                  disabled={deletingAnnotation === ann.id}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete markup"
                                >
                                  {deletingAnnotation === ann.id ? (
                                    <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowMarkupEditor(true)}
                      className="w-full mt-2 py-1.5 text-[#CFAFA3] hover:bg-[#CFAFA3]/10 rounded-lg text-sm font-medium transition-colors"
                    >
                      Add New Markup
                    </button>
                  </div>

                  {/* Comments Section */}
                  <div className="flex-1 border-t border-gray-100 pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Feedback ({comments.length})
                    </h4>

                    {loadingPhotoDetails ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-[#CFAFA3] animate-spin" />
                      </div>
                    ) : comments.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No feedback yet. Be the first to add feedback!
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[150px] overflow-y-auto">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-3 bg-gray-50 rounded-xl group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-[#CFAFA3]">
                                {comment.professional_name || 'Professional'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </span>
                                {comment.professional_id === user?.id && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    disabled={deletingComment === comment.id}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                                    title="Delete feedback"
                                  >
                                    {deletingComment === comment.id ? (
                                      <Loader2 className="w-3 h-3 text-red-500 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3 h-3 text-red-500" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-gray-700">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="pt-4 border-t border-gray-100 mt-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm"
                        placeholder="Add feedback..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || addingComment}
                        className="px-4 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Markup Viewer Modal */}
      {viewingMarkup && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4">
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
            <div className="flex items-center justify-center h-full">
              <img
                src={viewingMarkup.markup_image}
                alt="Markup"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Markup Editor */}
      {showMarkupEditor && selectedPhoto && (
        <ImageMarkupEditor
          imageUrl={selectedPhoto.photo_url}
          saving={savingAnnotation}
          onSave={handleSaveAnnotation}
          onCancel={() => setShowMarkupEditor(false)}
        />
      )}
    </div>
  );
};

export default ClientPhotosSection;
