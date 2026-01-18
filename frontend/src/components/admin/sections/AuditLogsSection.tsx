/**
 * @fileoverview Audit Logs Section for Admin Dashboard
 * HIPAA-compliant audit log viewer with filtering, search, and statistics.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Activity,
  Eye,
  FileText,
  Lock,
  Unlock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  Monitor,
  BarChart3,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { AuditLogRecord, AuditLogStats } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const ACTION_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  LOGIN: { bg: 'bg-green-100', text: 'text-green-700', icon: <Unlock className="w-3 h-3" /> },
  LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Lock className="w-3 h-3" /> },
  LOGIN_FAILED: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
  PERMISSION_DENIED: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
  VIEW: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Eye className="w-3 h-3" /> },
  VIEW_LIST: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <FileText className="w-3 h-3" /> },
  CREATE: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  UPDATE: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Activity className="w-3 h-3" /> },
  DELETE: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
  PASSWORD_RESET: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Lock className="w-3 h-3" /> },
  PASSWORD_CHANGE: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Lock className="w-3 h-3" /> },
  UPLOAD: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <TrendingUp className="w-3 h-3" /> },
  EXPORT: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: <Download className="w-3 h-3" /> },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-green-100', text: 'text-green-700' },
  failure: { bg: 'bg-red-100', text: 'text-red-700' },
  denied: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

const RESOURCE_LABELS: Record<string, string> = {
  user_profile: 'User Profile',
  progress_photo: 'Progress Photo',
  treatment_plan: 'Treatment Plan',
  routine: 'Routine',
  skin_analysis: 'Skin Analysis',
  message: 'Message',
  annotation: 'Annotation',
  comment: 'Comment',
  product: 'Product',
  session: 'Session',
  notification: 'Notification',
  invitation: 'Invitation',
  gamification: 'Gamification',
  badge: 'Badge',
  avatar: 'Avatar',
  system: 'System',
};

// ============================================================================
// COMPONENT
// ============================================================================

const AuditLogsSection: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [securityEvents, setSecurityEvents] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [total, setTotal] = useState(0);

  // Filters
  const [searchEmail, setSearchEmail] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Active tab
  const [activeTab, setActiveTab] = useState<'logs' | 'stats' | 'security'>('logs');

  // Get date range values
  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        return { startDate: todayStart.toISOString(), endDate: now.toISOString() };
      case '7days':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { startDate: weekAgo.toISOString(), endDate: now.toISOString() };
      case '30days':
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return { startDate: monthAgo.toISOString(), endDate: now.toISOString() };
      default:
        return { startDate: undefined, endDate: undefined };
    }
  }, [dateRange]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      apiClient.setAuthToken(authToken);
      const { startDate, endDate } = getDateRange();

      const params = new URLSearchParams();
      if (searchEmail) params.append('userEmail', searchEmail);
      if (filterAction) params.append('action', filterAction);
      if (filterResource) params.append('resourceType', filterResource);
      if (filterStatus) params.append('status', filterStatus);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());

      const response = await apiClient.get<{
        success: boolean;
        data?: {
          logs: AuditLogRecord[];
          total: number;
        };
      }>(`/api/admin/audit-logs?${params.toString()}`);

      if (response.data.success && response.data.data) {
        setLogs(response.data.data.logs);
        setTotal(response.data.data.total);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    }
  }, [searchEmail, filterAction, filterResource, filterStatus, dateRange, page, limit, getDateRange]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      apiClient.setAuthToken(authToken);
      const { startDate, endDate } = getDateRange();

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<{
        success: boolean;
        data?: { stats: AuditLogStats };
      }>(`/api/admin/audit-logs/stats?${params.toString()}`);

      if (response.data.success && response.data.data) {
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  }, [dateRange, getDateRange]);

  // Fetch security events
  const fetchSecurityEvents = useCallback(async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { logs: AuditLogRecord[] };
      }>('/api/admin/audit-logs/security-events');

      if (response.data.success && response.data.data) {
        setSecurityEvents(response.data.data.logs);
      }
    } catch (error) {
      console.error('Error fetching security events:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      await Promise.all([fetchLogs(), fetchStats(), fetchSecurityEvents()]);
      setLoading(false);
    };
    fetchAllData();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchLogs();
    }
  }, [filterAction, filterResource, filterStatus, dateRange, page]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchLogs(), fetchStats(), fetchSecurityEvents()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Handle search
  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  // Toggle expanded row
  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Format date/time
  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateTime(date);
  };

  // Get action styling
  const getActionStyle = (action: string) => {
    return ACTION_COLORS[action] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Activity className="w-3 h-3" /> };
  };

  // Get status styling
  const getStatusStyle = (status: string) => {
    return STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  };

  // Parse user agent
  const parseUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'User Email', 'Action', 'Resource Type', 'Resource ID', 'Status', 'IP Address'];
    const rows = logs.map(log => [
      log.created_at,
      log.user_email || 'N/A',
      log.action,
      log.resource_type,
      log.resource_id || 'N/A',
      log.status,
      log.ip_address || 'N/A',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-gray-500">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
            <p className="text-sm text-gray-500">
              HIPAA-compliant activity tracking • {total.toLocaleString()} total events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEvents.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Events</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.byStatus.find(s => s.status === 'success')?.count.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500">Successful</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {(stats.byStatus.find(s => s.status === 'failure')?.count || 0) +
                   (stats.byStatus.find(s => s.status === 'denied')?.count || 0)}
                </p>
                <p className="text-xs text-gray-500">Failed / Denied</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{securityEvents.length}</p>
                <p className="text-xs text-gray-500">Security Events</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'text-gray-900 border-gray-900'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          All Logs
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'stats'
              ? 'text-gray-900 border-gray-900'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Statistics
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'security'
              ? 'text-gray-900 border-gray-900'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Security Events
          {securityEvents.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              {securityEvents.length}
            </span>
          )}
        </button>
      </div>

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by email..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>

              {/* Date Range */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-300"
              >
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>

              {/* Toggle Filters */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  showFilters ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(filterAction || filterResource || filterStatus) && (
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            </div>

            {/* Extended Filters */}
            {showFilters && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-300"
                >
                  <option value="">All Actions</option>
                  <option value="LOGIN">Login</option>
                  <option value="LOGIN_FAILED">Login Failed</option>
                  <option value="VIEW">View</option>
                  <option value="VIEW_LIST">View List</option>
                  <option value="CREATE">Create</option>
                  <option value="UPDATE">Update</option>
                  <option value="DELETE">Delete</option>
                  <option value="PASSWORD_RESET">Password Reset</option>
                  <option value="PERMISSION_DENIED">Permission Denied</option>
                </select>

                <select
                  value={filterResource}
                  onChange={(e) => setFilterResource(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-300"
                >
                  <option value="">All Resources</option>
                  <option value="session">Session</option>
                  <option value="user_profile">User Profile</option>
                  <option value="progress_photo">Progress Photo</option>
                  <option value="treatment_plan">Treatment Plan</option>
                  <option value="skin_analysis">Skin Analysis</option>
                  <option value="routine">Routine</option>
                  <option value="message">Message</option>
                  <option value="product">Product</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-300"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                  <option value="denied">Denied</option>
                </select>

                {(filterAction || filterResource || filterStatus) && (
                  <button
                    onClick={() => {
                      setFilterAction('');
                      setFilterResource('');
                      setFilterStatus('');
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      IP / Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        No audit logs found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const actionStyle = getActionStyle(log.action);
                      const statusStyle = getStatusStyle(log.status);
                      const isExpanded = expandedRows.has(log.id);

                      return (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {formatRelativeTime(log.created_at)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDateTime(log.created_at)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {log.user_email || 'Anonymous'}
                                  </p>
                                  {log.user_role && (
                                    <p className="text-xs text-gray-500 capitalize">{log.user_role}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionStyle.bg} ${actionStyle.text}`}>
                                {actionStyle.icon}
                                {log.action.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900">
                                {RESOURCE_LABELS[log.resource_type] || log.resource_type}
                              </p>
                              {log.resource_id && (
                                <p className="text-xs text-gray-500 font-mono">
                                  {log.resource_id.substring(0, 8)}...
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="text-sm text-gray-900">{log.ip_address || 'N/A'}</p>
                                  <p className="text-xs text-gray-500">{parseUserAgent(log.user_agent)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => toggleRow(log.id)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="space-y-3">
                                  <p className="text-xs font-semibold text-gray-600 uppercase">Details</p>
                                  <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                  {log.error_message && (
                                    <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-semibold text-red-700">Error Message</p>
                                        <p className="text-sm text-red-600">{log.error_message}</p>
                                      </div>
                                    </div>
                                  )}
                                  {log.user_agent && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">User Agent</p>
                                      <p className="text-xs text-gray-500 break-all">{log.user_agent}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total.toLocaleString()} results
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-600">
                    Page {page} of {Math.ceil(total / limit)}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(Math.ceil(total / limit), page + 1))}
                    disabled={page >= Math.ceil(total / limit)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Actions Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Actions Breakdown</h3>
                <p className="text-sm text-gray-500">Activity by action type</p>
              </div>
            </div>
            <div className="space-y-3">
              {stats.byAction.slice(0, 8).map((item) => {
                const percentage = (item.count / stats.totalEvents) * 100;
                const style = getActionStyle(item.action);
                return (
                  <div key={item.action} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`inline-flex items-center gap-1.5 ${style.text}`}>
                        {style.icon}
                        {item.action.replace('_', ' ')}
                      </span>
                      <span className="font-medium text-gray-900">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${style.bg} rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resources Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <PieChart className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Resources Accessed</h3>
                <p className="text-sm text-gray-500">Activity by resource type</p>
              </div>
            </div>
            <div className="space-y-3">
              {stats.byResource.slice(0, 8).map((item, index) => {
                const percentage = (item.count / stats.totalEvents) * 100;
                const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'];
                return (
                  <div key={item.resource_type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {RESOURCE_LABELS[item.resource_type] || item.resource_type}
                      </span>
                      <span className="font-medium text-gray-900">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[index % colors.length]} rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Most Active Users</h3>
                <p className="text-sm text-gray-500">Top users by activity count</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {stats.topUsers.map((user, index) => (
                <div key={user.user_email} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">#{index + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.user_email}</p>
                    <p className="text-xs text-gray-500">{user.count.toLocaleString()} events</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Security Events</h3>
                <p className="text-sm text-gray-500">
                  Failed logins, permission denials, and other security-related events
                </p>
              </div>
            </div>
          </div>

          {securityEvents.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
              <p className="text-gray-500">No security events detected in the monitored period.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {securityEvents.slice(0, 50).map((event) => {
                const actionStyle = getActionStyle(event.action);
                return (
                  <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 ${actionStyle.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        {actionStyle.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionStyle.bg} ${actionStyle.text}`}>
                            {event.action.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(event.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 mt-1">
                          {event.user_email || 'Unknown user'} • {event.ip_address || 'Unknown IP'}
                        </p>
                        {event.error_message && (
                          <p className="text-sm text-red-600 mt-1">{event.error_message}</p>
                        )}
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {Object.entries(event.details).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                <span className="font-medium">{key}:</span> {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogsSection;
