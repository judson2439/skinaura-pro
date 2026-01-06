import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  Loader2,
  Building2,
  Calendar,
  Shield,
  CheckCircle,
  FileText,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileSectionProps {
  userRole: 'client' | 'professional';
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProfileSection: React.FC<ProfileSectionProps> = ({ userRole }) => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number || '');

  // Update form state when profile changes
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setBusinessName(profile.business_name || '');
      setLicenseNumber(profile.license_number || '');
    }
  }, [profile]);

  // Reset form to current profile values
  const resetForm = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setBusinessName(profile?.business_name || '');
    setLicenseNumber(profile?.license_number || '');
    setIsEditing(false);
  };

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Refresh profile to get updated data
      await refreshProfile();

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle profile save
  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);

    try {
      const updateData: any = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      };

      // Add professional-specific fields
      if (userRole === 'professional') {
        updateData.business_name = businessName.trim() || null;
        updateData.license_number = licenseNumber.trim() || null;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Refresh profile to get updated data
      await refreshProfile();

      setIsEditing(false);

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Generate default avatar URL
  const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=${userRole === 'professional' ? '2D2A3E' : 'CFAFA3'}&color=${userRole === 'professional' ? 'FFFFFF' : '2D2A3E'}&size=200`;
  const avatarUrl = profile?.avatar_url || defaultAvatarUrl;

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your account information</p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-[#2D2A3E] text-white rounded-xl hover:bg-[#3D3A4E] transition-colors"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D2A3E] text-white rounded-xl hover:bg-[#3D3A4E] transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#CFAFA3]/30">
                  {isUploadingAvatar ? (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
                    </div>
                  ) : (
                    <img
                      src={avatarUrl}
                      alt={profile?.full_name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-[#2D2A3E] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#3D3A4E] transition-colors disabled:opacity-50"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              {/* Name & Role */}
              <h2 className="mt-4 text-xl font-bold text-gray-900">
                {profile?.full_name || 'User'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  userRole === 'professional'
                    ? 'bg-[#2D2A3E] text-white'
                    : 'bg-[#CFAFA3]/20 text-[#2D2A3E]'
                }`}>
                  {userRole === 'professional' ? 'Professional' : 'Client'}
                </span>
              </div>

              {/* Email Verification Status */}
              <div className="flex items-center gap-2 mt-4 text-sm">
                {user?.email_confirmed_at ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-600">Email verified</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600">Email not verified</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Account Info Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Member since</p>
                  <p className="font-medium text-gray-900">{formatDate(profile?.created_at || null)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-gray-500">Account ID</p>
                  <p className="font-medium text-gray-900 font-mono text-xs">{user?.id?.slice(0, 8)}...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-6">Profile Details</h3>
            
            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4" />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                    {profile?.full_name || 'Not set'}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                  {profile?.email || user?.email || 'Not set'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                    {profile?.phone || 'Not set'}
                  </p>
                )}
              </div>

              {/* Professional-specific fields */}
              {userRole === 'professional' && (
                <>
                  {/* Business Name */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Building2 className="w-4 h-4" />
                      Business Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                        placeholder="Enter your business name"
                      />
                    ) : (
                      <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                        {profile?.business_name || 'Not set'}
                      </p>
                    )}
                  </div>

                  {/* License Number */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <FileText className="w-4 h-4" />
                      License Number
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent"
                        placeholder="Enter your license number"
                      />
                    ) : (
                      <p className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                        {profile?.license_number || 'Not set'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Security</h3>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500">Last changed: Unknown</p>
              </div>
              <button
                onClick={() => {
                  // Trigger password reset email
                  if (user?.email) {
                    supabase.auth.resetPasswordForEmail(user.email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    }).then(({ error }) => {
                      if (error) {
                        toast({
                          title: 'Error',
                          description: error.message,
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: 'Password reset email sent',
                          description: 'Check your email for a link to reset your password.',
                        });
                      }
                    });
                  }
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;
