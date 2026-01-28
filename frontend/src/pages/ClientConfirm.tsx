/**
 * @fileoverview Client confirmation page for invited clients.
 * Handles token validation, signup, email/phone verification, and relationship creation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { saveAuthSession, AuthUser } from '@/lib/authStorage';
import {
  validateInput,
  checkPasswordStrength,
  encryptData,
  type PasswordStrength,
} from '@/lib/security';
import { apiClient } from '@/lib/apiClient';
import { encryptFile } from '@/lib/encryption';
import {
  X,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Loader2,
  Droplets,
  CheckCircle,
  Camera,
  AlertCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'];

const SKIN_CONCERNS = [
  'Acne', 'Hyperpigmentation', 'Dark spots', 'Fine lines', 'Wrinkles',
  'Dehydration', 'Redness', 'Texture', 'Uneven tone', 'Dullness'
];

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const PasswordStrengthIndicator: React.FC<{ strength: PasswordStrength }> = ({ strength }) => {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const color = colors[strength.score];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= strength.score ? color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${
          strength.score <= 1 ? 'text-red-500' :
          strength.score === 2 ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {strength.label}
        </span>
        {strength.suggestions.length > 0 && (
          <span className="text-xs text-gray-400">{strength.suggestions[0]}</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TYPES
// ============================================================================

type PageView = 'loading' | 'expired' | 'signup' | 'verify-email' | 'verify-phone' | 'success';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ClientConfirm: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Token and invitation state
  const token = searchParams.get('token');
  const [view, setView] = useState<PageView>('loading');
  const [invitationData, setInvitationData] = useState<{
    email: string;
    professionalId: string;
    professionalName: string;
    businessName: string;
  } | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [skinType, setSkinType] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // Validation and security state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // Email verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendingCode, setResendingCode] = useState(false);

  // Phone verification state
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [resendingPhoneCode, setResendingPhoneCode] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setView('expired');
        return;
      }

      try {
        const response = await apiClient.post<{
          success: boolean;
          message?: string;
          error?: string;
          data?: {
            email: string;
            professionalId: string;
            professionalName: string;
            businessName: string;
            expired?: boolean;
            alreadyAccepted?: boolean;
          };
        }>('/api/auth/verify-invitation-token', { token });

        if (!response.data.success) {
          if (response.data.data?.expired || response.data.data?.alreadyAccepted) {
            setView('expired');
          } else {
            setView('expired');
          }
          return;
        }

        if (response.data.data) {
          setInvitationData({
            email: response.data.data.email,
            professionalId: response.data.data.professionalId,
            professionalName: response.data.data.professionalName,
            businessName: response.data.data.businessName,
          });
          setEmail(response.data.data.email);
          setView('signup');
        }
      } catch (error: any) {
        console.error('Token verification error:', error);
        setView('expired');
      }
    };

    verifyToken();
  }, [token]);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(checkPasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  // Client-side validation
  const validateFormData = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName || fullName.trim().length < 2) {
      newErrors.fullName = 'Full name is required (at least 2 characters)';
    } else if (fullName.length > 100) {
      newErrors.fullName = 'Name must be less than 100 characters';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (passwordStrength && passwordStrength.score < 2) {
      newErrors.password = 'Please choose a stronger password';
    }

    if (phone) {
      const phoneValidation = validateInput(phone, 'phone');
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error!;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle avatar file selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Please select a valid image file (JPG, PNG, GIF, WebP)', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setAvatarFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormData() || !token) return;

    setLoading(true);
    
    try {
      // Encrypt avatar if provided
      let avatarEncrypted: string | undefined;
      let avatarIv: string | undefined;
      let avatarMimeType: string | undefined;
      
      if (avatarFile) {
        try {
          const encryptedAvatar = await encryptFile(avatarFile);
          avatarEncrypted = encryptedAvatar.encrypted;
          avatarIv = encryptedAvatar.iv;
          avatarMimeType = encryptedAvatar.mimeType;
        } catch (err) {
          console.warn('⚠️ Failed to encrypt avatar, continuing without it');
        }
      }

      // Build signup data
      const signupData = {
        token,
        email: email.trim().toLowerCase(),
        password: password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        skinType: skinType || undefined,
        concerns: selectedConcerns.length > 0 ? selectedConcerns : undefined,
        avatarEncrypted,
        avatarIv,
        avatarMimeType,
      };

      const encryptedPayload = await encryptData(signupData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data?: {
          user?: { id: string; email: string; full_name: string };
          needsVerification?: boolean;
          professionalId?: string;
          invitationId?: string;
        };
        error?: string;
      }>('/api/auth/invited-client/signup', encryptedPayload);

      if (!response.data.success) {
        const errorMsg = response.data.error || 'Failed to create account';
        setErrors({ email: errorMsg });
        toast({
          title: 'Signup Failed',
          description: errorMsg,
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Store data for verification flow
      if (response.data.data?.user) {
        setClientId(response.data.data.user.id);
      }
      if (response.data.data?.invitationId) {
        setInvitationId(response.data.data.invitationId);
      }

      toast({
        title: 'Account Created!',
        description: response.data.message || 'Please check your email for verification code.',
      });

      // Store email for verification and show verification view
      setVerificationEmail(email.trim().toLowerCase());
      setView('verify-email');

    } catch (error: any) {
      console.error('Signup error:', error);
      const errorMessage = error.data?.error || error.message || 'An unexpected error occurred. Please try again.';
      toast({
        title: 'Signup Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle email verification code submission
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      setErrors({ verificationCode: 'Please enter a 6-digit code' });
      return;
    }

    setLoading(true);

    try {
      const verifyData = {
        email: verificationEmail,
        code: verificationCode,
      };

      const encryptedPayload = await encryptData(verifyData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        error?: string;
        data?: { needsPhoneVerification?: boolean };
      }>('/api/auth/verify-email', encryptedPayload);

      if (!response.data.success) {
        setErrors({ verificationCode: response.data.error || 'Invalid verification code' });
        toast({
          title: 'Verification Failed',
          description: response.data.error || 'Invalid verification code',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Check if phone verification is needed (based on feature flag on backend)
      const needsPhoneVerification = response.data.data?.needsPhoneVerification ?? false;

      if (needsPhoneVerification) {
        toast({
          title: 'Email Verified!',
          description: 'Now please verify your phone number.',
        });

        // Move to phone verification
        setVerificationCode('');
        setVerificationPhone(phone);
        setView('verify-phone');
      } else {
        // Phone verification disabled - go to success/login
        toast({
          title: 'Email Verified!',
          description: 'Your account is ready. You can now sign in.',
        });

        // Move to success view
        setVerificationCode('');
        setView('success');
      }

    } catch (error: any) {
      console.error('Verification error:', error);
      const errorMessage = error.data?.error || error.message || 'Verification failed';
      setErrors({ verificationCode: errorMessage });
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle send phone verification code
  const handleSendPhoneCode = async () => {
    if (!verificationPhone) {
      setErrors({ phone: 'Please enter your phone number' });
      return;
    }

    setSendingPhoneCode(true);

    try {
      const sendData = {
        email: verificationEmail,
        phone: verificationPhone,
      };

      const encryptedPayload = await encryptData(sendData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        error?: string;
      }>('/api/auth/send-phone-verification', encryptedPayload);

      if (!response.data.success) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to send verification code',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Code Sent!',
        description: 'A verification code has been sent to your phone.',
      });

    } catch (error: any) {
      console.error('Send phone code error:', error);
      toast({
        title: 'Error',
        description: error.data?.error || error.message || 'Failed to send code',
        variant: 'destructive'
      });
    } finally {
      setSendingPhoneCode(false);
    }
  };

  // Handle phone verification code submission
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneVerificationCode || phoneVerificationCode.length !== 6) {
      setErrors({ phoneVerificationCode: 'Please enter a 6-digit code' });
      return;
    }

    setLoading(true);

    try {
      const verifyData = {
        email: verificationEmail,
        code: phoneVerificationCode,
      };

      const encryptedPayload = await encryptData(verifyData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        error?: string;
      }>('/api/auth/verify-phone', encryptedPayload);

      if (!response.data.success) {
        setErrors({ phoneVerificationCode: response.data.error || 'Invalid verification code' });
        toast({
          title: 'Verification Failed',
          description: response.data.error || 'Invalid verification code',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Complete the invitation - create the relationship
      if (invitationId && clientId) {
        const completeResponse = await apiClient.post<{
          success: boolean;
          message?: string;
          error?: string;
        }>('/api/auth/complete-invitation', {
          invitationId,
          clientId,
        });

        if (!completeResponse.data.success) {
          console.error('Failed to complete invitation:', completeResponse.data.error);
          // Still proceed to success since account is created
        }
      }

      toast({
        title: 'Phone Verified!',
        description: 'Your account is now fully verified. You can sign in.',
      });

      setView('success');

    } catch (error: any) {
      console.error('Phone verification error:', error);
      const errorMessage = error.data?.error || error.message || 'Verification failed';
      setErrors({ phoneVerificationCode: errorMessage });
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle resend email verification code
  const handleResendCode = async () => {
    if (!verificationEmail) return;

    setResendingCode(true);

    try {
      const resendData = { email: verificationEmail };
      const encryptedPayload = await encryptData(resendData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        error?: string;
      }>('/api/auth/resend-verification', encryptedPayload);

      if (!response.data.success) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to resend verification code',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Code Sent!',
        description: 'A new verification code has been sent to your email.',
      });

    } catch (error: any) {
      console.error('Resend error:', error);
      toast({
        title: 'Error',
        description: error.data?.error || error.message || 'Failed to resend code',
        variant: 'destructive'
      });
    } finally {
      setResendingCode(false);
    }
  };

  // Handle resend phone verification code
  const handleResendPhoneCode = async () => {
    if (!verificationEmail) return;

    setResendingPhoneCode(true);

    try {
      const resendData = { email: verificationEmail };
      const encryptedPayload = await encryptData(resendData);

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        error?: string;
      }>('/api/auth/resend-phone-verification', encryptedPayload);

      if (!response.data.success) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to resend verification code',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Code Sent!',
        description: 'A new verification code has been sent to your phone.',
      });

    } catch (error: any) {
      console.error('Resend phone code error:', error);
      toast({
        title: 'Error',
        description: error.data?.error || error.message || 'Failed to resend code',
        variant: 'destructive'
      });
    } finally {
      setResendingPhoneCode(false);
    }
  };

  const toggleConcern = (concern: string) => {
    setSelectedConcerns(prev =>
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    );
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  // Render loading state
  const renderLoading = () => (
    <div className="text-center py-12">
      <Loader2 className="w-12 h-12 animate-spin text-[#CFAFA3] mx-auto mb-4" />
      <p className="text-gray-600">Verifying your invitation...</p>
    </div>
  );

  // Render expired state
  const renderExpired = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
        <XCircle className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
        Invitation Expired
      </h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        This invitation link has expired or is no longer valid. Please contact your skincare professional to request a new invitation.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
      >
        Go to Home
      </Link>
    </div>
  );

  // Render signup form
  const renderSignupForm = () => (
    <div>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-4">
          <img 
            src="https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png" 
            alt="SkinAura Logo"
            className="w-8 h-8"
          />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">
          Create Your Account
        </h2>
        <p className="text-gray-500 mt-1">
          You've been invited by <strong>{invitationData?.professionalName}</strong>
        </p>
        <p className="text-sm text-[#CFAFA3]">
          {invitationData?.businessName}
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleAvatarSelect}
          className="hidden"
        />

        {/* Profile Picture Upload */}
        <div className="flex flex-col items-center mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Profile Picture (Optional)</label>
          <div className="relative">
            {avatarPreview ? (
              <div className="relative">
                <EncryptedImage
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#CFAFA3]/30"
                  fallbackClassName="w-24 h-24 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
                />
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#CFAFA3] text-white rounded-full flex items-center justify-center hover:bg-[#B89A8E] transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-[#CFAFA3] hover:bg-[#CFAFA3]/5 transition-all group"
              >
                <Camera className="w-8 h-8 text-gray-400 group-hover:text-[#CFAFA3] transition-colors" />
                <span className="text-xs text-gray-400 group-hover:text-[#CFAFA3] mt-1">Add Photo</span>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">JPG, PNG, GIF, WebP up to 5MB</p>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setErrors({ ...errors, fullName: '' }); }}
                className={`w-full pl-12 pr-4 py-3 border ${errors.fullName ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                placeholder="Your full name"
                autoComplete="name"
                maxLength={100}
              />
            </div>
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                readOnly
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Email is set from your invitation</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErrors({ ...errors, phone: '' }); }}
                className={`w-full pl-12 pr-4 py-3 border ${errors.phone ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
              />
            </div>
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: '' }); }}
                  className={`w-full pl-12 pr-4 py-3 border ${errors.password ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              {passwordStrength && <PasswordStrengthIndicator strength={passwordStrength} />}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors({ ...errors, confirmPassword: '' }); }}
                  className={`w-full pl-12 pr-4 py-3 border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#CFAFA3]"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPassword ? 'Hide passwords' : 'Show passwords'}
          </button>
        </div>

        {/* Skin Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skin Type</label>
          <div className="relative">
            <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none appearance-none bg-white"
            >
              <option value="">Select your skin type</option>
              {SKIN_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Skin Concerns */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Skin Concerns (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {SKIN_CONCERNS.map(concern => (
              <button
                key={concern}
                type="button"
                onClick={() => toggleConcern(concern)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedConcerns.includes(concern)
                    ? 'bg-[#CFAFA3] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {concern}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6">
        Already have an account?{' '}
        <Link to="/" className="text-[#CFAFA3] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );

  // Render email verification form
  const renderVerifyEmail = () => (
    <div>
      <button
        onClick={() => setView('signup')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[#2D2A3E]" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-2">Verify Your Email</h2>
        <p className="text-gray-600 mb-2">
          We've sent a 6-digit verification code to
        </p>
        <p className="font-medium text-[#2D2A3E] mb-6">{verificationEmail}</p>
      </div>

      <form onSubmit={handleVerifyEmail} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
            Enter Verification Code
          </label>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setVerificationCode(value);
              setErrors({ ...errors, verificationCode: '' });
            }}
            className={`w-full py-4 text-center text-2xl font-bold tracking-[0.5em] border ${
              errors.verificationCode ? 'border-red-300' : 'border-gray-200'
            } rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
            placeholder="000000"
            maxLength={6}
            autoFocus
          />
          {errors.verificationCode && (
            <p className="text-red-500 text-xs mt-2 text-center">{errors.verificationCode}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || verificationCode.length !== 6}
          className="w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Email'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 mb-2">Didn't receive the code?</p>
        <button
          onClick={handleResendCode}
          disabled={resendingCode}
          className="text-[#CFAFA3] font-medium hover:underline disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
        >
          {resendingCode ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Resend Verification Code'
          )}
        </button>
      </div>

      <p className="text-center text-gray-500 mt-6 text-sm">
        Check your spam folder if you don't see the email.
      </p>
    </div>
  );

  // Render phone verification form
  const renderVerifyPhone = () => (
    <div>
      <button
        onClick={() => setView('verify-email')}
        className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6">
          <Phone className="w-8 h-8 text-[#2D2A3E]" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-2">Verify Your Phone</h2>
        <p className="text-gray-600 mb-2">
          Enter your phone number to receive a verification code
        </p>
      </div>

      <div className="space-y-6">
        {/* Phone number input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={verificationPhone}
                onChange={(e) => {
                  setVerificationPhone(e.target.value);
                  setErrors({ ...errors, phone: '' });
                }}
                className={`w-full pl-12 pr-4 py-3 border ${
                  errors.phone ? 'border-red-300' : 'border-gray-200'
                } rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <button
              type="button"
              onClick={handleSendPhoneCode}
              disabled={sendingPhoneCode || !verificationPhone}
              className="px-4 py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {sendingPhoneCode ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Send Code'
              )}
            </button>
          </div>
          {errors.phone && (
            <p className="text-red-500 text-xs mt-2">{errors.phone}</p>
          )}
        </div>

        {/* Verification code input */}
        <form onSubmit={handleVerifyPhone}>
          <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
            Enter Verification Code
          </label>
          <input
            type="text"
            value={phoneVerificationCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPhoneVerificationCode(value);
              setErrors({ ...errors, phoneVerificationCode: '' });
            }}
            className={`w-full py-4 text-center text-2xl font-bold tracking-[0.5em] border ${
              errors.phoneVerificationCode ? 'border-red-300' : 'border-gray-200'
            } rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
            placeholder="000000"
            maxLength={6}
          />
          {errors.phoneVerificationCode && (
            <p className="text-red-500 text-xs mt-2 text-center">{errors.phoneVerificationCode}</p>
          )}

          <button
            type="submit"
            disabled={loading || phoneVerificationCode.length !== 6}
            className="w-full mt-4 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Phone'
            )}
          </button>
        </form>
      </div>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 mb-2">Didn't receive the code?</p>
        <button
          onClick={handleResendPhoneCode}
          disabled={resendingPhoneCode}
          className="text-[#CFAFA3] font-medium hover:underline disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
        >
          {resendingPhoneCode ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            'Resend Verification Code'
          )}
        </button>
      </div>

      <div className="mt-6 p-4 bg-green-50 rounded-xl">
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>Email verified: <strong>{verificationEmail}</strong></span>
        </div>
      </div>
    </div>
  );

  // Render success state
  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
        Welcome to SkinAura PRO!
      </h2>
      <p className="text-gray-600 mb-2">
        Your account is now active and you're connected with
      </p>
      <p className="font-medium text-[#2D2A3E] mb-6">
        {invitationData?.professionalName} from {invitationData?.businessName}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
      >
        Sign In to Your Account
      </Link>
    </div>
  );

  // Render current view
  const renderView = () => {
    switch (view) {
      case 'loading':
        return renderLoading();
      case 'expired':
        return renderExpired();
      case 'signup':
        return renderSignupForm();
      case 'verify-email':
        return renderVerifyEmail();
      case 'verify-phone':
        return renderVerifyPhone();
      case 'success':
        return renderSuccess();
      default:
        return renderLoading();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex justify-end rounded-t-3xl">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </Link>
        </div>
        <div className="p-6">
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default ClientConfirm;
