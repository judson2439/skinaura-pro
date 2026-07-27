/**
 * @fileoverview Admin Relationship Section
 * Lists professionals; each row expands to show linked clients.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Loader2,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { UserProfile } from '../types';
import EncryptedImage from '@/components/ui/encrypted-image';

const PROFESSIONALS_PER_PAGE = 10;

interface RelatedClient {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  relationship_id: string;
  relationship_status: string;
  relationship_created_at: string;
  relationship_updated_at: string;
  submission_status: boolean | null;
}

const formatJoined = (dateString: string | null) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const RelationshipSection: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProfessionalId, setExpandedProfessionalId] = useState<string | null>(null);
  const [clientCache, setClientCache] = useState<Record<string, RelatedClient[]>>({});
  const [loadingClientsFor, setLoadingClientsFor] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState<Record<string, string>>({});

  const fetchProfessionals = async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    setIsLoading(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { users: UserProfile[] };
      }>('/api/admin/users');

      if (response.data.success && response.data.data?.users) {
        setUsers(response.data.data.users);
      } else {
        setUsers([]);
      }
      setClientCache({});
      setExpandedProfessionalId(null);
      setClientsError({});
    } catch (error) {
      console.error('Error fetching professionals:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientsForProfessional = async (professionalId: string) => {
    if (professionalId in clientCache) return;

    const authToken = getAuthToken();
    if (!authToken) return;

    setLoadingClientsFor(professionalId);
    setClientsError(prev => {
      const next = { ...prev };
      delete next[professionalId];
      return next;
    });

    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { clients: RelatedClient[] };
        error?: string;
      }>(`/api/admin/professionals/${professionalId}/clients`);

      if (response.data.success && response.data.data?.clients) {
        setClientCache(prev => ({
          ...prev,
          [professionalId]: response.data!.data!.clients,
        }));
      } else {
        setClientCache(prev => ({ ...prev, [professionalId]: [] }));
        setClientsError(prev => ({
          ...prev,
          [professionalId]: response.data.error || 'Failed to load clients',
        }));
      }
    } catch (error) {
      console.error('Error fetching clients for professional:', error);
      setClientCache(prev => ({ ...prev, [professionalId]: [] }));
      setClientsError(prev => ({
        ...prev,
        [professionalId]: 'Failed to load clients',
      }));
    } finally {
      setLoadingClientsFor(current => (current === professionalId ? null : current));
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, []);

  const professionals = useMemo(
    () => users.filter(u => u.role === 'professional'),
    [users]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return professionals;
    const q = searchQuery.toLowerCase();
    return professionals.filter(
      p =>
        p.full_name?.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.business_name?.toLowerCase().includes(q)
    );
  }, [professionals, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PROFESSIONALS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(p => Math.min(p, totalPages));
  }, [totalPages]);

  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (page - 1) * PROFESSIONALS_PER_PAGE,
    page * PROFESSIONALS_PER_PAGE
  );

  const toggleProfessionalRow = (professionalId: string) => {
    if (expandedProfessionalId === professionalId) {
      setExpandedProfessionalId(null);
      return;
    }
    setExpandedProfessionalId(professionalId);
    if (!(professionalId in clientCache)) {
      void loadClientsForProfessional(professionalId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Professionals</h2>
          <p className="text-sm text-gray-500 mt-1">
            {professionals.length} professional{professionals.length === 1 ? '' : 's'} on the platform.
            Click a row to see linked clients.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchProfessionals}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone, or business..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {professionals.length === 0 ? 'No professionals yet' : 'No matches'}
            </h3>
            <p className="text-gray-500 text-sm">
              {professionals.length === 0
                ? 'Professionals will appear here once they sign up.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th
                      className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10 px-3 py-3"
                      aria-hidden
                    />
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Professional
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Contact
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Business
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      License
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(pro => {
                    const isOpen = expandedProfessionalId === pro.id;
                    const clients = clientCache[pro.id];
                    const isLoadingClients = loadingClientsFor === pro.id;
                    const err = clientsError[pro.id];

                    return (
                      <React.Fragment key={pro.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          onClick={() => toggleProfessionalRow(pro.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleProfessionalRow(pro.id);
                            }
                          }}
                          className={`cursor-pointer transition-colors ${
                            isOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-4 align-middle">
                            <ChevronDown
                              className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                              aria-hidden
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 min-w-[200px]">
                              {pro.avatar_url ? (
                                <EncryptedImage
                                  src={pro.avatar_url}
                                  alt={pro.full_name || 'Professional'}
                                  className="w-10 h-10 rounded-full object-cover shrink-0"
                                  fallbackClassName="w-10 h-10 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center shrink-0">
                                  <span className="text-sm font-medium text-[#2D2A3E]">
                                    {pro.full_name?.split(' ').map(n => n[0]).join('') ||
                                      pro.email[0].toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {pro.full_name || 'Unnamed'}
                                </p>
                                <p className="text-xs text-gray-500 font-mono truncate">
                                  {pro.id.slice(0, 8)}…
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{pro.email}</p>
                            <p className="text-xs text-gray-500">{pro.phone || '—'}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px]">
                            <span className="line-clamp-2">{pro.business_name || '—'}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {pro.license_number || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {formatJoined(pro.created_at)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-gray-50/90">
                            <td colSpan={6} className="px-6 py-4 border-t border-gray-100">
                              <div className="pl-1 sm:pl-6 border-l-2 border-[#CFAFA3]/60">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                  Linked clients
                                </p>
                                {isLoadingClients ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading clients…
                                  </div>
                                ) : err ? (
                                  <p className="text-sm text-red-600 py-2">{err}</p>
                                ) : !clients || clients.length === 0 ? (
                                  <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                    <User className="w-4 h-4 text-gray-400" />
                                    No clients linked to this professional yet.
                                  </div>
                                ) : (
                                  <ul className="space-y-3">
                                    {clients.map(c => (
                                      <li
                                        key={c.relationship_id}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2.5"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-medium text-blue-800">
                                              {c.full_name?.split(' ').map(n => n[0]).join('') ||
                                                c.email[0].toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {c.full_name || 'Unnamed client'}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">{c.email}</p>
                                            {c.phone && (
                                              <p className="text-xs text-gray-500">{c.phone}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClass(c.relationship_status)}`}
                                          >
                                            {c.relationship_status}
                                          </span>
                                          {c.submission_status === true && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                              Submitted
                                            </span>
                                          )}
                                          <span className="text-xs text-gray-500 whitespace-nowrap">
                                            Linked {formatJoined(c.relationship_created_at)}
                                          </span>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > PROFESSIONALS_PER_PAGE && (
              <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PROFESSIONALS_PER_PAGE + 1} to{' '}
                  {Math.min(page * PROFESSIONALS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="text-sm text-gray-600 tabular-nums px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RelationshipSection;
