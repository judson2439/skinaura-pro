/**
 * Reset Password Page
 * Allows users to reset their password using a token from the email link.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/apiClient';
import { checkPasswordStrength, type PasswordStrength } from '@/lib/security';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Shield,
} from 'lucide-react';

interface VerifyTokenResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    userId: string;
  };
}

interface ResetPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Token from URL
  const token = searchParams.get('token');
  
  // States
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('invalid');
        setErrorMessage('No reset token provided. Please request a new password reset link.');
        return;
      }

      try {
        const response = await apiClient.post<VerifyTokenResponse>('/api/auth/verify-reset-token', {
          token,
        });

        if (response.data.success) {
          setStatus('valid');
        } else {
          setStatus('invalid');
          setErrorMessage(response.data.error || 'Invalid or expired reset link.');
        }
      } catch (error: any) {
        console.error('Token verification error:', error);
        setStatus('invalid');
        setErrorMessage(error.data?.error || 'Invalid or expired reset link. Please request a new one.');
      }
    };

    verifyToken();
  }, [token]);

  // Handle password change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    // Check password strength
    if (value) {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
    
    // Clear errors
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (errors.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: undefined }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password length
    if (password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return;
    }
    
    // Check password match
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.post<ResetPasswordResponse>('/api/auth/reset-password', {
        token,
        password,
      });

      if (response.data.success) {
        setStatus('success');
        toast({
          title: 'Password Reset Successful',
          description: 'Your password has been reset. You can now sign in with your new password.',
        });
        
        // Redirect to home with login modal after 2 seconds
        setTimeout(() => {
          navigate('/?login=true', { replace: true });
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(response.data.error || 'Failed to reset password.');
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to reset password.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      setStatus('error');
      setErrorMessage(error.data?.error || 'Failed to reset password. Please try again.');
      toast({
        title: 'Error',
        description: error.data?.error || 'Failed to reset password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get password strength color based on score (0-4 scale)
  const getStrengthColor = () => {
    if (!passwordStrength) return 'bg-gray-200';
    if (passwordStrength.score <= 1) return 'bg-red-500';
    if (passwordStrength.score === 2) return 'bg-yellow-500';
    if (passwordStrength.score === 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Get password strength width
  const getStrengthWidth = () => {
    if (!passwordStrength) return '0%';
    return `${(passwordStrength.score / 4) * 100}%`;
  };

  // Get strength text color
  const getStrengthTextColor = () => {
    if (!passwordStrength) return 'text-gray-500';
    if (passwordStrength.score <= 1) return 'text-red-500';
    if (passwordStrength.score === 2) return 'text-yellow-600';
    if (passwordStrength.score === 3) return 'text-blue-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6">
          <img 
            src="https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png" 
            alt="SkinAura PRO"
            className="w-8 h-8"
          />
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Verifying Reset Link
            </h1>
            <p className="text-gray-600">
              Please wait while we verify your password reset link...
            </p>
          </div>
        )}

        {/* Invalid Token State */}
        {status === 'invalid' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Invalid Reset Link
            </h1>
            <p className="text-gray-600 mb-6">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        )}

        {/* Valid Token - Reset Password Form */}
        {status === 'valid' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-[#CFAFA3]" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-2">
                Reset Your Password
              </h1>
              <p className="text-gray-600">
                Enter your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] transition-all ${
                      errors.password ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                )}
                
                {/* Password Strength Indicator */}
                {password && passwordStrength && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Password strength:</span>
                      <span className={`font-medium capitalize ${getStrengthTextColor()}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: getStrengthWidth() }}
                      />
                    </div>
                    {passwordStrength.suggestions.length > 0 && (
                      <ul className="text-xs text-gray-500 space-y-1 mt-2">
                        {passwordStrength.suggestions.map((tip, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-gray-400" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] transition-all ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-200'
                    }`}
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
                )}
                {/* Password match indicator */}
                {confirmPassword && password && confirmPassword === password && (
                  <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword}
                className="w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Password Reset Successful!
            </h1>
            <p className="text-gray-600 mb-6">
              Your password has been reset successfully. Redirecting you to sign in...
            </p>
            <Loader2 className="w-6 h-6 text-[#CFAFA3] animate-spin mx-auto" />
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Reset Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        )}

        {/* Help Link */}
        <p className="text-sm text-gray-500 mt-6 text-center">
          Need help?{' '}
          <a href="mailto:support@skinaura.pro" className="text-[#CFAFA3] hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
