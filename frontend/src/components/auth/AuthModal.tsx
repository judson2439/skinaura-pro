/**
 * @fileoverview Authentication modal component for user login and registration.
 * Uses backend API with encrypted requests for PostgreSQL authentication.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Sparkles,
  Users,
  ArrowLeft,
  Loader2,
  Building,
  FileText,
  Droplets,
  CheckCircle,
  Camera,
  Shield,
} from 'lucide-react';
import EncryptedImage from '../ui/encrypted-image';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  initialRole?: 'client' | 'professional';
}

type AuthView = 'select-role' | 'login' | 'signup' | 'forgot-password' | 'verify-email' | 'verify-phone';

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
// MAIN COMPONENT
// ============================================================================

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login', initialRole }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<AuthView>(initialRole ? initialMode : 'select-role');
  const [selectedRole, setSelectedRole] = useState<'client' | 'professional' | 'admin' | null>(initialRole || null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [skinType, setSkinType] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

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

  // SMS consent state
  const [smsConsent, setSmsConsent] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [resendingPhoneCode, setResendingPhoneCode] = useState(false);

  // Reset view when modal opens with initialRole
  useEffect(() => {
    if (isOpen) {
      if (initialRole) {
        setSelectedRole(initialRole);
        setView(initialMode);
      } else {
        setView('select-role');
      }
    }
  }, [isOpen, initialRole, initialMode]);

  // Update password strength when password changes
  useEffect(() => {
    if (password) {
      setPasswordStrength(checkPasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, [password]);

  // Client-side validation
  const validateFormData = (isSignup: boolean): boolean => {
    const newErrors: Record<string, string> = {};

    const emailValidation = validateInput(email, 'email');
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error!;
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (isSignup && password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (isSignup) {
      if (!fullName || fullName.trim().length < 2) {
        newErrors.fullName = 'Full name is required (at least 2 characters)';
      } else if (fullName.length > 100) {
        newErrors.fullName = 'Name must be less than 100 characters';
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }

      if (passwordStrength && passwordStrength.score < 2) {
        newErrors.password = 'Please choose a stronger password';
      }

      if (selectedRole === 'professional') {
        if (!businessName || businessName.trim().length < 2) {
          newErrors.businessName = 'Business name is required';
        }
      }

      if (phone) {
        const phoneValidation = validateInput(phone, 'phone');
        if (!phoneValidation.valid) {
          newErrors.phone = phoneValidation.error!;
        }
      }

      // SMS consent is optional - no validation required
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

  // Handle login using AuthContext with encrypted backend API call
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormData(false)) return;

    setLoading(true);
    
    try {
      // Encrypt credentials before sending to backend (include selectedRole for validation)
      const credentials = {
        email: email.trim().toLowerCase(),
        password: password,
        selectedRole: selectedRole, // Send selected role for backend validation
      };

      const encryptedPayload = await encryptData(credentials);

      // Determine endpoint based on role
      let signInEndpoint: string;
      let redirectPath: string;

      if (selectedRole === 'admin') {
        signInEndpoint = '/api/auth/admin/signin';
        redirectPath = '/admin';
      } else if (selectedRole === 'professional') {
        signInEndpoint = '/api/auth/professional/signin';
        redirectPath = '/professional';
      } else {
        signInEndpoint = '/api/auth/client/signin';
        redirectPath = '/client';
      }

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data?: {
          user?: { id: string; email: string; full_name: string; role: string; avatar_url?: string; phone?: string };
          token?: string;
          redirectTo?: string;
          roleMismatch?: boolean;
          actualRole?: string;
          isFirstLogin?: boolean;
        };
        error?: string;
      }>(signInEndpoint, encryptedPayload);

      if (!response.data.success) {
        const errorMsg = response.data.error || 'Invalid credentials';
        
        // Check if this is a role mismatch error
        if (response.data.data?.roleMismatch) {
          const actualRole = response.data.data.actualRole || 'unknown';
          toast({
            title: 'Incorrect Role Selected',
            description: `Your account is registered as "${actualRole}". Please go back and select the correct role to sign in.`,
            variant: 'destructive',
            duration: 6000,
          });
          setErrors({ email: `Your account is a "${actualRole}" account` });
        } else {
          setErrors({ email: errorMsg });
          toast({
            title: 'Login Failed',
            description: errorMsg,
            variant: 'destructive'
          });
        }
        
        setLoading(false);
        return;
      }

      // Store auth session using the AuthContext method
      if (response.data.data?.user && response.data.data?.token) {
        const userData = response.data.data.user;
        const token = response.data.data.token;
        const isFirstLogin = response.data.data.isFirstLogin;
        
        // Use the role from backend response, fallback to selectedRole if not provided
        const userRole = (userData.role || selectedRole || 'client') as 'client' | 'professional' | 'admin';
        
        // Save auth session to localStorage
        const authUser: AuthUser = {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          phone: userData.phone,
          role: userRole,
          avatar_url: userData.avatar_url,
        };
        saveAuthSession(authUser, token, isFirstLogin);
      }

      toast({
        title: selectedRole === 'admin' ? 'Welcome Admin!' : 'Welcome back!',
        description: response.data.message || 'You have successfully logged in.',
      });

      onClose();
      resetForm();

      // Navigate to appropriate dashboard
      const finalRedirect = response.data.data?.redirectTo || redirectPath;
      navigate(finalRedirect);

    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle API errors
      const errorMessage = error.data?.error || error.message || 'An unexpected error occurred. Please try again.';
      setErrors({ email: errorMessage });
      
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };


  // Handle signup using backend API with encryption
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormData(true) || !selectedRole) return;
    
    // Admin cannot sign up - only sign in
    if (selectedRole === 'admin') {
      toast({
        title: 'Error',
        description: 'Admin accounts cannot be created through signup.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    
    try {
      // Encrypt avatar if provided (encryption happens on frontend)
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

      // Build signup data based on role
      const signupData = {
        email: email.trim().toLowerCase(),
        password: password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role: selectedRole as 'client' | 'professional',
        // Client-specific fields
        skinType: selectedRole === 'client' ? (skinType || undefined) : undefined,
        concerns: selectedRole === 'client' && selectedConcerns.length > 0 ? selectedConcerns : undefined,
        // Professional-specific fields
        businessName: selectedRole === 'professional' ? businessName.trim() : undefined,
        licenseNumber: selectedRole === 'professional' ? (licenseNumber.trim() || undefined) : undefined,
        // Pre-encrypted avatar data (frontend encrypts, backend just saves)
        avatarEncrypted,
        avatarIv,
        avatarMimeType,
      };

      const encryptedPayload = await encryptData(signupData);

      // Determine endpoint based on role
      const signupEndpoint = selectedRole === 'professional'
        ? '/api/auth/professional/signup'
        : '/api/auth/client/signup';

      const response = await apiClient.post<{
        success: boolean;
        message: string;
        data?: {
          user?: { id: string; email: string; full_name: string; role: string; avatar_url?: string };
          token?: string;
          redirectTo?: string;
        };
        error?: string;
      }>(signupEndpoint, encryptedPayload);

      if (!response.data.success) {
        const errorMsg = response.data.error || 'Failed to create account';
        
        // Check for email already registered error
        if (errorMsg.toLowerCase().includes('already registered') || 
            errorMsg.toLowerCase().includes('email already')) {
          setErrors({ email: 'This email is already registered. Please sign in instead.' });
          toast({
            title: 'Account Already Exists',
            description: 'An account with this email already exists. Please sign in instead.',
            variant: 'destructive'
          });
        } else {
          setErrors({ email: errorMsg });
          toast({
            title: 'Signup Failed',
            description: errorMsg,
            variant: 'destructive'
          });
        }
        setLoading(false);
        return;
      }

      // Note: Don't save full auth session during signup - user needs to verify first
      // Just store temporary data for the verification flow

      toast({
        title: 'Account Created!',
        description: response.data.message || 'Please check your email for verification code.',
      });

      // Store email for verification and show verification view
      setVerificationEmail(email.trim().toLowerCase());
      setView('verify-email');

    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle API errors
      const errorMessage = error.data?.error || error.message || 'An unexpected error occurred. Please try again.';
      
      if (errorMessage.toLowerCase().includes('already registered')) {
        setErrors({ email: 'This email is already registered. Please sign in instead.' });
      }
      
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

      toast({
        title: 'Email Verified!',
        description: 'Now please verify your phone number.',
      });

      // Move to phone verification
      setVerificationCode('');
      setVerificationPhone(phone); // Use phone from signup form
      setView('verify-phone');

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

      toast({
        title: 'Phone Verified!',
        description: 'Your account is now fully verified. You can sign in.',
      });

      // Clear form and go to login
      resetForm();
      setView('login');

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

  // Handle resend verification code
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

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = validateInput(email, 'email');
    if (!emailValidation.valid) {
      setErrors({ email: emailValidation.error! });
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiClient.post<{ success: boolean; message?: string; error?: string }>(
        '/api/auth/forgot-password',
        { email: email.trim().toLowerCase() }
      );

      if (response.data.success) {
        setResetEmailSent(true);
        toast({
          title: 'Email Sent',
          description: 'If an account with that email exists, you\'ll receive password reset instructions.',
        });
      } else {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to send reset email',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      // Still show success message for security (don't reveal if email exists)
      setResetEmailSent(true);
      toast({
        title: 'Email Sent',
        description: 'If an account with that email exists, you\'ll receive password reset instructions.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
    setSkinType('');
    setSelectedConcerns([]);
    setBusinessName('');
    setLicenseNumber('');
    setAvatarFile(null);
    setAvatarPreview('');
    setErrors({});
    setResetEmailSent(false);
    setPasswordStrength(null);
    setVerificationCode('');
    setVerificationEmail('');
    setPhoneVerificationCode('');
    setVerificationPhone('');
    setSmsConsent(false);
  };

  const handleRoleSelect = (role: 'client' | 'professional' | 'admin') => {
    setSelectedRole(role);
    setView('login');
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

  if (!isOpen) return null;

  // Role Selection View
  const renderRoleSelection = () => (
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6">
        <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={32} height={32}/>
      </div>
      <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-2">Welcome to SkinAura PRO</h2>
      <p className="text-gray-600 mb-8">Choose how you'd like to continue</p>

      <div className="space-y-4">
        <button
          onClick={() => handleRoleSelect('client')}
          className="w-full p-6 bg-gradient-to-r from-[#CFAFA3]/10 to-[#E8D5D0]/10 border-2 border-[#CFAFA3]/30 rounded-2xl hover:border-[#CFAFA3] hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center group-hover:scale-110 transition-transform">
              <User className="w-7 h-7 text-[#2D2A3E]" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg text-[#2D2A3E]">I'm a Client</h3>
              <p className="text-sm text-gray-500">Track your skincare routine and earn rewards</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleRoleSelect('professional')}
          className="w-full p-6 bg-gradient-to-r from-[#2D2A3E]/5 to-[#3D3A4E]/5 border-2 border-[#2D2A3E]/20 rounded-2xl hover:border-[#2D2A3E] hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg text-[#2D2A3E]">I'm a Professional</h3>
              <p className="text-sm text-gray-500">Manage clients and track their progress</p>
            </div>
          </div>
        </button>

        {/* Admin Option - Small and Simple */}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => handleRoleSelect('admin')}
            className="w-full py-2.5 px-4 text-sm text-gray-500 hover:text-[#2D2A3E] hover:bg-gray-50 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>Admin Access</span>
          </button>
        </div>
      </div>
    </div>
  );


  // Login Form
  const renderLoginForm = () => (
    <div>
      <button
        onClick={() => { setView('select-role'); setSelectedRole(null); resetForm(); }}
        className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-8">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedRole === 'client' ? 'from-[#CFAFA3] to-[#E8D5D0]' : selectedRole === 'admin' ? 'from-gray-600 to-gray-800' : 'from-[#2D2A3E] to-[#3D3A4E]'} flex items-center justify-center mx-auto mb-4`}>
          {selectedRole === 'client' ? <User className="w-7 h-7 text-[#2D2A3E]" /> : selectedRole === 'admin' ? <Shield className="w-7 h-7 text-white" /> : <Users className="w-7 h-7 text-white" />}
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">
          {selectedRole === 'client' ? 'Client Login' : selectedRole === 'admin' ? 'Admin Login' : 'Professional Login'}
        </h2>
        <p className="text-gray-500 mt-1">Welcome back! Sign in to continue.</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }}
              className={`w-full pl-12 pr-4 py-3 border ${errors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors({ ...errors, password: '' }); }}
              className={`w-full pl-12 pr-12 py-3 border ${errors.password ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setView('forgot-password')}
            className="text-sm text-[#CFAFA3] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            selectedRole === 'client'
              ? 'bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white hover:shadow-lg hover:shadow-[#CFAFA3]/30'
              : 'bg-[#2D2A3E] text-white hover:bg-[#3D3A4E]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6">
        Don't have an account?{' '}
        <button onClick={() => setView('signup')} className="text-[#CFAFA3] font-medium hover:underline">
          Sign up
        </button>
      </p>
    </div>
  );

  // Signup Form
  const renderSignupForm = () => (
    <div>
      <button
        onClick={() => { setView('login'); resetForm(); }}
        className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to login
      </button>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">
          Create {selectedRole === 'client' ? 'Client' : 'Professional'} Account
        </h2>
        <p className="text-gray-500 mt-1">Join SkinAura PRO today</p>
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
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
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

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }}
                className={`w-full pl-12 pr-4 py-3 border ${errors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
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

        {/* Client-specific fields */}
        {selectedRole === 'client' && (
          <>
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
          </>
        )}

        {/* Professional-specific fields */}
        {selectedRole === 'professional' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business/Practice Name *</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => { setBusinessName(e.target.value); setErrors({ ...errors, businessName: '' }); }}
                  className={`w-full pl-12 pr-4 py-3 border ${errors.businessName ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none`}
                  placeholder="Your business name"
                  maxLength={200}
                />
              </div>
              {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number (optional)</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                  placeholder="Professional license number"
                  maxLength={50}
                />
              </div>
            </div>
          </>
        )}

        {/* SMS Consent Checkbox */}
        <div className="flex items-start gap-3 mt-4">
          <input
            type="checkbox"
            id="smsConsent"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-[#CFAFA3] focus:ring-[#CFAFA3] focus:ring-2 cursor-pointer"
          />
          <label htmlFor="smsConsent" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
            By checking this box, I agree to receive text messages from SkinAura PRO at the phone number provided. 
            Message and data rates may apply. Reply STOP to unsubscribe. (Optional)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
            selectedRole === 'client'
              ? 'bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white hover:shadow-lg hover:shadow-[#CFAFA3]/30'
              : 'bg-[#2D2A3E] text-white hover:bg-[#3D3A4E]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
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
        <button onClick={() => setView('login')} className="text-[#CFAFA3] font-medium hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );

  // Forgot Password Form
  const renderForgotPassword = () => (
    <div>
      <button
        onClick={() => { setView('login'); setResetEmailSent(false); }}
        className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to login
      </button>

      {resetEmailSent ? (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-2">Check Your Email</h2>
          <p className="text-gray-600 mb-6">
            We've sent password reset instructions to <strong>{email}</strong>
          </p>
          <button
            onClick={() => { setView('login'); setResetEmailSent(false); resetForm(); }}
            className="w-full py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all"
          >
            Back to Login
          </button>
        </div>
      ) : (
        <>
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-[#2D2A3E]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">Reset Password</h2>
            <p className="text-gray-500 mt-1">Enter your email to receive reset instructions</p>
          </div>

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: '' }); }}
                  className={`w-full pl-12 pr-4 py-3 border ${errors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all`}
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
            </button>
          </form>
        </>
      )}
    </div>
  );

  // Email Verification View (after signup)
  const renderVerifyEmail = () => (
    <div>
      <button
        onClick={() => { setView('signup'); setVerificationCode(''); }}
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

  // Phone Verification View (after email verified)
  const renderVerifyPhone = () => (
    <div>
      <button
        onClick={() => { setView('verify-email'); setPhoneVerificationCode(''); }}
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

  // Render current view
  const renderView = () => {
    switch (view) {
      case 'select-role':
        return renderRoleSelection();
      case 'login':
        return renderLoginForm();
      case 'signup':
        return renderSignupForm();
      case 'forgot-password':
        return renderForgotPassword();
      case 'verify-email':
        return renderVerifyEmail();
      case 'verify-phone':
        return renderVerifyPhone();
      default:
        return renderRoleSelection();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-100 flex justify-end rounded-t-3xl">
          <button
            onClick={() => { onClose(); resetForm(); setView('select-role'); setSelectedRole(null); }}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
