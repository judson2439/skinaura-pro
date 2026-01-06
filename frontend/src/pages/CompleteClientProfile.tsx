import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  Lock, Eye, EyeOff, CheckCircle, XCircle, Loader2,
  User, Phone, Mail, Camera, Droplets, X
} from 'lucide-react';

// Constants
const SKIN_TYPES = ['Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'];

const SKIN_CONCERNS = [
  'Acne', 'Hyperpigmentation', 'Dark spots', 'Fine lines', 'Wrinkles',
  'Dehydration', 'Redness', 'Texture', 'Uneven tone', 'Dullness'
];

const CompleteClientProfile: React.FC = () => {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [skinType, setSkinType] = useState('');
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  
  // Avatar state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // User metadata
  const [userId, setUserId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  // Password validation
  const passwordRequirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains a number', met: /[0-9]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every(req => req.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allRequirementsMet && passwordsMatch && fullName.trim().length >= 2 && !isLoading;

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/');
        return;
      }
      
      // Get user info from session
      setUserId(session.user.id);
      setEmail(session.user.email || '');
      
      // Get professional_id from user metadata
      const metadata = session.user.user_metadata;
      if (metadata?.invited_by_professional_id) {
        setProfessionalId(metadata.invited_by_professional_id);
      }
      
      setIsCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  // Handle avatar file selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Please select a valid image file (JPG, PNG, GIF, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be less than 5MB');
      return;
    }

    setAvatarFile(file);
    setErrorMessage('');
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const toggleConcern = (concern: string) => {
    setSelectedConcerns(prev =>
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit || !userId) return;

    setIsLoading(true);
    setErrorMessage('');
    setStatus('idle');

    try {
      // 1. Upload avatar if provided
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `avatars/${userId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('progress-photos')
          .upload(fileName, avatarFile, {
            contentType: avatarFile.type,
            upsert: true
          });

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          // Continue without avatar if upload fails
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('progress-photos')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // 2. Call the edge function to update password and create profile
      const { data, error } = await supabase.functions.invoke('complete-client-profile', {
        body: {
          email: email.toLowerCase(),
          password: password,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          avatar_url: avatarUrl,
          skin_type: skinType || null,
          concerns: selectedConcerns.length > 0 ? selectedConcerns : null,
          professional_id: professionalId
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to complete profile');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus('success');
      
      // Redirect to client dashboard after 2 seconds
      setTimeout(() => {
        navigate('/client/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('Error setting up account:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to set up account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
          <Link 
            to="/"
            className="flex items-center gap-2 text-gray-500 hover:text-[#CFAFA3] transition-colors text-sm"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-4">
            <img 
              src="https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png" 
              alt="SkinAura Logo"
              className="w-8 h-8"
            />
          </div>

          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
                Account Created Successfully!
              </h1>
              <p className="text-gray-600 mb-6">
                Your account has been set up. Redirecting you to your dashboard...
              </p>
              <Loader2 className="w-6 h-6 text-[#CFAFA3] animate-spin mx-auto" />
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-1">
                  Create Client Account
                </h1>
                <p className="text-gray-500 text-sm">
                  Join SkinAura PRO today
                </p>
              </div>

              {status === 'error' && errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Hidden file input */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />

                {/* Profile Picture Upload */}
                <div className="flex flex-col items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                    Profile Picture (Optional)
                  </label>
                  <div className="relative">
                    {avatarPreview ? (
                      <div className="relative">
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="w-20 h-20 rounded-full object-cover border-4 border-[#CFAFA3]/30"
                        />
                        <button
                          type="button"
                          onClick={removeAvatar}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#CFAFA3] text-white rounded-full flex items-center justify-center hover:bg-[#B89A8E] transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-[#CFAFA3] hover:bg-[#CFAFA3]/5 transition-all group"
                      >
                        <Camera className="w-6 h-6 text-gray-400 group-hover:text-[#CFAFA3] transition-colors" />
                        <span className="text-xs text-gray-400 group-hover:text-[#CFAFA3] mt-1">Add Photo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">JPG, PNG, GIF, WebP up to 5MB</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Email (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent transition-all text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent transition-all text-sm ${
                          confirmPassword.length > 0 && !passwordsMatch 
                            ? 'border-red-300 bg-red-50' 
                            : confirmPassword.length > 0 && passwordsMatch 
                              ? 'border-green-300 bg-green-50' 
                              : 'border-gray-200'
                        }`}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Show/Hide Passwords Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#CFAFA3] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? 'Hide passwords' : 'Show passwords'}
                  </button>
                </div>

                {/* Password Requirements */}
                {password.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Password requirements:</p>
                    <div className="grid grid-cols-2 gap-1">
                      {passwordRequirements.map((req, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          {req.met ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-gray-300" />
                          )}
                          <span className={`text-xs ${req.met ? 'text-green-600' : 'text-gray-500'}`}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skin Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skin Type
                  </label>
                  <div className="relative">
                    <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={skinType}
                      onChange={(e) => setSkinType(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent appearance-none bg-white text-sm"
                    >
                      <option value="">Select your skin type</option>
                      {SKIN_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Skin Concerns */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skin Concerns (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_CONCERNS.map(concern => (
                      <button
                        key={concern}
                        type="button"
                        onClick={() => toggleConcern(concern)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-3 rounded-xl font-medium transition-all ${
                    canSubmit
                      ? 'bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white hover:shadow-lg hover:shadow-[#CFAFA3]/30'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating Account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

              <p className="text-center text-gray-500 text-sm mt-4">
                Already have an account?{' '}
                <Link to="/" className="text-[#CFAFA3] font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center">
            Need help?{' '}
            <a href="mailto:support@skinaura.pro" className="text-[#CFAFA3] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompleteClientProfile;
