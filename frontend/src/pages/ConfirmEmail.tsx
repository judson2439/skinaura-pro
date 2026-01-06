import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CheckCircle, XCircle, Loader2, UserPlus } from 'lucide-react';

const ConfirmEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invited'>('loading');
  const [message, setMessage] = useState('');
  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check for error in URL params (Supabase redirects with error if something went wrong)
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'Email confirmation failed. Please try again.');
          return;
        }

        // Check for access_token and refresh_token (successful confirmation)
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');

        // Helper function to process successful confirmation
        const processSuccessfulConfirmation = async (accessToken: string, refreshToken: string, confirmationType: string | null) => {
          // Set the session with the tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            setStatus('error');
            setMessage('Failed to establish session. Please try logging in.');
            return false;
          }

          // Check if this is an invitation (type could be 'invite' or 'magiclink' for invitations)
          const user = sessionData?.user;
          if (user) {
            const userMetadata = user.user_metadata;
            
            // Check if user was invited by a professional
            if (userMetadata?.invited_by_professional_id || userMetadata?.invited_by_professional_name) {
              setInvitedBy(userMetadata.invited_by_professional_name || 'your skincare professional');
              setStatus('invited');
              setMessage('Your account has been created and you\'ve been connected with your skincare professional!');
              
              // Auto redirect to complete-client-profile page after 2 seconds
              setTimeout(() => {
                navigate('/complete-client-profile');
              }, 2000);
              
              return true;
            }
          }

          setStatus('success');
          setMessage('Your email has been verified successfully! You can now log in to your account.');
          return true;
        };

        // If we have tokens in query params, process them
        if (accessToken && refreshToken) {
          await processSuccessfulConfirmation(accessToken, refreshToken, type);
          return;
        }

        // Check if there's a hash fragment with tokens (Supabase sometimes uses hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');

        if (hashAccessToken && hashRefreshToken) {
          await processSuccessfulConfirmation(hashAccessToken, hashRefreshToken, hashType);
          return;
        }

        // If we reach here, check if user is already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check if user was invited
          const userMetadata = session.user?.user_metadata;
          if (userMetadata?.invited_by_professional_name) {
            setInvitedBy(userMetadata.invited_by_professional_name);
            setStatus('invited');
            setMessage('Your account has been created and you\'ve been connected with your skincare professional!');
            
            // Auto redirect to complete-client-profile page after 2 seconds
            setTimeout(() => {
              navigate('/complete-client-profile');
            }, 2000);
            
            return;
          }
          
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          return;
        }

        // No tokens found, might be a direct visit or expired link
        setStatus('error');
        setMessage('Invalid or expired confirmation link. Please request a new confirmation email.');

      } catch (err) {
        console.error('Email confirmation error:', err);
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    handleEmailConfirmation();
  }, [searchParams, navigate]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center mx-auto mb-6">
          <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={32} height={32}/>
        </div>

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Verifying Your Email
            </h1>
            <p className="text-gray-600 mb-6">
              Please wait while we confirm your email address...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Email Confirmed!
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            <Link 
              to="/" 
              className="inline-block w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-[#CFAFA3]/30 transition-all"
            >
              Go to Home
            </Link>
          </>
        )}

        {status === 'invited' && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-8 h-8 text-[#CFAFA3]" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Welcome to SkinAura!
            </h1>
            <p className="text-gray-600 mb-4">
              {message}
            </p>
            {invitedBy && (
              <div className="mb-6 p-4 bg-[#CFAFA3]/10 rounded-xl">
                <p className="text-sm text-gray-600">
                  You've been invited by
                </p>
                <p className="font-semibold text-[#2D2A3E]">
                  {invitedBy}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-sm mb-4">
              Redirecting you to complete your profile...
            </p>
            <Loader2 className="w-6 h-6 text-[#CFAFA3] animate-spin mx-auto mb-4" />
            <p className="text-xs text-gray-500 text-center">
              You can use{' '}
              <Link to="/reset-password" className="text-[#CFAFA3] hover:underline">
                Forgot Password
              </Link>
              {' '}if you are not available to set password now
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-[#2D2A3E] mb-4">
              Verification Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            <Link 
              to="/" 
              className="inline-block w-full py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all"
            >
              Back to Home
            </Link>
          </>
        )}

        <p className="text-sm text-gray-500 mt-6">
          Need help?{' '}
          <a href="mailto:support@skinaura.pro" className="text-[#CFAFA3] hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
};

export default ConfirmEmail;
