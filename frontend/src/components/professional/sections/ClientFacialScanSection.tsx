import React, { useState, useEffect, useCallback } from 'react';
import { ScanFace, Loader2, RefreshCw, User, Calendar, Eye, CheckCircle, Circle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import FacialScanReportDetailModal, {
  type FacialScanReportEntry,
} from '@/components/shared/FacialScanReportDetailModal';

// ============================================================================
// TYPES
// ============================================================================

/** API returns full skin_analysis row; use shared entry type for modal */
type SkinAnalysisEntry = FacialScanReportEntry & { sent?: boolean };

interface ClientProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ClientFacialScanSection: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyses, setAnalyses] = useState<SkinAnalysisEntry[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedReport, setSelectedReport] = useState<SkinAnalysisEntry | null>(null);

  const handleOpenReportDetail = useCallback(
    async (analysis: SkinAnalysisEntry) => {
      setSelectedReport(analysis);
      if (analysis.checked) return;
      const token = getAuthToken();
      if (!token) return;
      try {
        apiClient.setAuthToken(token);
        await apiClient.patch<{ success: boolean; data?: { analysis: SkinAnalysisEntry } }>(
          `/api/professional/facial-scan-reports/${analysis.id}/check`
        );
        setAnalyses((prev) =>
          prev.map((a) => (a.id === analysis.id ? { ...a, checked: true } : a))
        );
        setSelectedReport((current) =>
          current?.id === analysis.id ? { ...current, checked: true } : current
        );
      } catch (err) {
        console.error('Failed to mark report as checked:', err);
      }
    },
    []
  );

  const fetchReports = useCallback(async (showRefreshIndicator = false) => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      apiClient.setAuthToken(token);
      const response = await apiClient.get<{
        success: boolean;
        data?: { analyses: SkinAnalysisEntry[]; clients: ClientProfile[] };
        error?: string;
      }>('/api/professional/facial-scan-reports');

      if (!response.data.success) {
        toast({
          title: 'Error',
          description: response.data.error || 'Failed to load facial scan reports.',
          variant: 'destructive',
        });
        return;
      }

      if (response.data.data) {
        setAnalyses(response.data.data.analyses);
        setClients(response.data.data.clients);
      }
    } catch (err) {
      console.error('Failed to fetch facial scan reports:', err);
      toast({
        title: 'Error',
        description: 'Failed to load facial scan reports. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const getClientName = (userId: string) => {
    const client = clients.find(c => c.id === userId);
    return client?.full_name || client?.email || 'Unknown client';
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm p-8 lg:p-12">
        <div className="flex flex-col items-center justify-center min-h-[320px]">
          <Loader2 className="w-10 h-10 animate-spin text-[#CFAFA3]" />
          <p className="mt-4 text-gray-500">Loading facial scan reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-gray-200/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CFAFA3]/20 to-[#E8D5D0]/30 flex items-center justify-center">
            <ScanFace className="w-5 h-5 text-[#CFAFA3]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#2D2A3E]">Client Facial Scan Reports</h2>
            <p className="text-sm text-gray-500">
              Reports shared by your active clients (sent = true)
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchReports(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="p-4 lg:p-6">
        {analyses.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <ScanFace className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-base font-medium text-[#2D2A3E] mb-1">No reports yet</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              Facial scan reports from active clients will appear here once they are sent.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {[...analyses]
              .sort((a, b) => {
                const aChecked = !!a.checked;
                const bChecked = !!b.checked;
                if (aChecked !== bChecked) return aChecked ? 1 : -1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
              .map((analysis) => {
              const health = analysis.skin_health != null ? Number(analysis.skin_health) : null;
              const avgScore = health ?? 0;
              return (
                <li
                  key={analysis.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-200/80 hover:bg-gray-50/50 transition-all cursor-pointer"
                  onClick={() => handleOpenReportDetail(analysis)}
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                    {analysis.original_area ? (
                      <EncryptedImage
                        src={analysis.original_area}
                        alt="Scan"
                        className="w-full h-full object-cover"
                        fallbackIcon="user"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0]">
                        <User className="w-8 h-8 text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#2D2A3E] truncate">
                      {getClientName(analysis.user_id)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>{formatDate(analysis.created_at)}</span>
                      {health != null && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              avgScore >= 80 ? 'bg-green-100 text-green-700' :
                              avgScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              avgScore >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {avgScore}% Health
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex-shrink-0">
                    Sent
                  </span>
                  {analysis.checked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Checked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full flex-shrink-0">
                      <Circle className="w-3.5 h-3.5" />
                      Unchecked
                    </span>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-1 px-3 py-2 bg-[#CFAFA3] text-[#2D2A3E] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/80 transition-colors flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenReportDetail(analysis);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    View detail
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedReport && (
        <FacialScanReportDetailModal
          entry={selectedReport}
          clientName={getClientName(selectedReport.user_id)}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
};

export default ClientFacialScanSection;
