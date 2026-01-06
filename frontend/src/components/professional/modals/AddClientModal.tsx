import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Mail, CheckCircle, Send, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  onClientAdded,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyInvited, setAlreadyInvited] = useState(false);
  const [success, setSuccess] = useState<{ message: string; alreadyRegistered?: boolean } | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  // Get the current user's professional ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfessionalId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInviteClient = async () => {
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!professionalId) {
      setError('Unable to identify your account. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);
    setAlreadyInvited(false);
    setSuccess(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('invite-client', {
        body: { 
          professional_id: professionalId,
          email: email.trim().toLowerCase() 
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to send invitation');
      }

      if (!data.success) {
        // Check if it's an "already invited" error
        if (data.alreadyInvited) {
          setAlreadyInvited(true);
          setError(data.error);
          return;
        }
        throw new Error(data.error || 'Failed to send invitation');
      }

      // Success!
      setSuccess({
        message: data.message,
        alreadyRegistered: data.alreadyRegistered,
      });

      // If client was added directly (already registered), notify parent
      if (data.alreadyRegistered) {
        onClientAdded();
      }

      // Clear email field
      setEmail('');

    } catch (err) {
      console.error('Error inviting client:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while sending the invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setAlreadyInvited(false);
    setSuccess(null);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleInviteClient();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Add New Client</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">
                  {success.alreadyRegistered ? 'Client Added!' : 'Invitation Sent!'}
                </p>
                <p className="text-sm text-green-700 mt-1">{success.message}</p>
                {!success.alreadyRegistered && (
                  <p className="text-xs text-green-600 mt-2">
                    The client will receive an email with instructions to create their account and connect with you.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-full mt-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Already Invited Warning */}
        {alreadyInvited && error && !success && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">Invitation Already Sent</p>
                <p className="text-sm text-amber-700 mt-1">{error}</p>
                <p className="text-xs text-amber-600 mt-2">
                  You can wait for the client to accept or the invitation to expire before sending a new one.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message (non-already-invited errors) */}
        {error && !alreadyInvited && !success && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Content - Only show if no success */}
        {!success && (
          <>
            {/* Description */}
            <div className="mb-6 p-4 bg-[#CFAFA3]/10 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-[#CFAFA3]" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Invite by Email</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter your client's email address. They will receive an invitation to create an account and connect with you.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setAlreadyInvited(false);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="client@example.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                  disabled={loading}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                If the client already has an account, they will be added directly to your client list.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleInviteClient}
                disabled={loading || !email.trim()}
                className="flex-1 py-3 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Invitation
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddClientModal;
