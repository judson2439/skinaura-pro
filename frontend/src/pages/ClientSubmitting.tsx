/**
 * Client Submitting page: updates submission_status for the current client
 * in client_professional_relationships, then redirects to client dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthSession, getAuthToken, clearFirstLoginFlag } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { Loader2 } from 'lucide-react';

const ClientSubmitting: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const submitAndRedirect = async () => {
      const session = getAuthSession();
      const token = getAuthToken();
      const firstLogin = searchParams.get('firstLogin');

      if (!token || !session?.user) {
        navigate('/', { replace: true });
        return;
      }

      if (session.user.role !== 'client') {
        navigate('/professional', { replace: true });
        return;
      }

      const dashboardPath = firstLogin === '1' ? '/client/dashboard?firstLogin=1' : '/client/dashboard';

      try {
        apiClient.setAuthToken(token);

        const response = await apiClient.post<{
          success: boolean;
          message?: string;
          error?: string;
          data?: { updated?: number };
        }>('/api/client/submit-consultation');

        if (response.data.success) {
          const userId = session.user.id;
          if (userId) {
            localStorage.setItem(`jotform_consultation_submitted_${userId}`, 'true');
          }
          clearFirstLoginFlag();
          navigate(dashboardPath, { replace: true });
        } else {
          setError(response.data.error || 'Update failed');
          setTimeout(() => navigate(dashboardPath, { replace: true }), 3000);
        }
      } catch (err: unknown) {
        console.error('Submit consultation error:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setTimeout(() => navigate(dashboardPath, { replace: true }), 3000);
      }
    };

    submitAndRedirect();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#F9F7F5] via-white to-[#F9F7F5] p-4">
      <div className="flex flex-col items-center gap-6">
        <Loader2 className="w-12 h-12 animate-spin text-[#CFAFA3]" />
        <p className="text-gray-600 font-medium">
          {error ? 'Redirecting to dashboard...' : 'Submitting your consultation...'}
        </p>
        {error && (
          <p className="text-sm text-red-500 max-w-md text-center">{error}</p>
        )}
      </div>
    </div>
  );
};

export default ClientSubmitting;
