import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Trophy,
  Check,
  Loader2,
  BarChart3,
  Users,
  Camera,
  Package,
  Calendar,
  Download,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Target,
  Activity,
  Clock,
  Star,
  Award,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { API_CONFIG } from '@/config/api';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface ClientAnalytics {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  compliance: number;
  currentStreak: number;
  longestStreak: number;
  level: string;
  points: number;
  totalRoutinesCompleted: number;
  lastCompletionDate: string | null;
  joinedAt: string;
  routineCompletedToday: boolean;
}

interface OverviewMetrics {
  totalClients: number;
  avgCompliance: number;
  avgStreak: number;
  goldPlusClients: number;
  completedToday: number;
  totalPhotos: number;
  totalProducts: number;
  activeTreatmentPlans: number;
}

interface TrendData {
  date: string;
  completions: number;
  photos: number;
}

interface ProductAnalytics {
  category: string;
  count: number;
}

interface AnalyticsSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AWARD_LEVELS = [
  { name: 'Bronze', minPoints: 0, color: 'from-amber-600 to-amber-700', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
  { name: 'Silver', minPoints: 500, color: 'from-gray-400 to-gray-500', bgColor: 'bg-gray-100', textColor: 'text-gray-600' },
  { name: 'Gold', minPoints: 1500, color: 'from-yellow-400 to-yellow-500', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { name: 'Platinum', minPoints: 3500, color: 'from-cyan-400 to-cyan-500', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700' },
  { name: 'Diamond', minPoints: 7000, color: 'from-purple-400 to-purple-500', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
];

const TIME_PERIODS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
];

const BRAND_COLORS: Record<string, string> = {
  'Bronze': 'from-[#a57865] to-[#8a6354]',
  'Silver': 'from-[#cab0a5] to-[#b89a8e]',
  'Gold': 'from-[#e6d5b8] to-[#d4c4a8]',
  'Platinum': 'from-[#007185] to-[#005a6a]',
  'Diamond': 'from-[#2D2A3E] to-[#3D3A4E]',
};

// ============================================================================
// COMPONENT
// ============================================================================

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  onNavigateToView,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timePeriod, setTimePeriod] = useState('30');
  const [showTimePeriodDropdown, setShowTimePeriodDropdown] = useState(false);
  
  // Data states
  const [clients, setClients] = useState<ClientAnalytics[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>({
    totalClients: 0,
    avgCompliance: 0,
    avgStreak: 0,
    goldPlusClients: 0,
    completedToday: 0,
    totalPhotos: 0,
    totalProducts: 0,
    activeTreatmentPlans: 0,
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics[]>([]);
  const [previousMetrics, setPreviousMetrics] = useState<Partial<OverviewMetrics>>({});

  // Fetch all analytics data from backend API
  const fetchAnalyticsData = async () => {
    const authToken = getAuthToken();
    if (!authToken) return;
    
    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/professional/analytics?period=${timePeriod}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();

      if (result.success && result.data) {
        const { 
          clients: clientsData, 
          overviewMetrics: metrics, 
          trendData: trends, 
          productAnalytics: products,
          previousMetrics: prevMetrics 
        } = result.data;

        setClients(clientsData || []);
        setOverviewMetrics(metrics || {
          totalClients: 0,
          avgCompliance: 0,
          avgStreak: 0,
          goldPlusClients: 0,
          completedToday: 0,
          totalPhotos: 0,
          totalProducts: 0,
          activeTreatmentPlans: 0,
        });
        setTrendData(trends || []);
        setProductAnalytics(products || []);
        setPreviousMetrics(prevMetrics || {});
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timePeriod]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalyticsData();
  };

  // Export data to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Level', 'Points', 'Compliance %', 'Current Streak', 'Longest Streak', 'Routines Completed', 'Joined'];
    const rows = clients.map(c => [
      c.name,
      c.email,
      c.level,
      c.points,
      c.compliance,
      c.currentStreak,
      c.longestStreak,
      c.totalRoutinesCompleted,
      new Date(c.joinedAt).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Sorted clients
  const sortedByCompliance = useMemo(() => 
    [...clients].sort((a, b) => b.compliance - a.compliance),
    [clients]
  );

  const sortedByPoints = useMemo(() => 
    [...clients].sort((a, b) => b.points - a.points),
    [clients]
  );

  const clientsNeedingAttention = useMemo(() => 
    clients.filter(c => c.compliance < 50 || c.currentStreak === 0),
    [clients]
  );

  // Calculate trend change
  const complianceChange = previousMetrics.avgCompliance !== undefined
    ? overviewMetrics.avgCompliance - previousMetrics.avgCompliance
    : null;

  // Level distribution
  const levelDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    AWARD_LEVELS.forEach(l => dist[l.name] = 0);
    clients.forEach(c => {
      if (dist[c.level] !== undefined) {
        dist[c.level]++;
      }
    });
    return dist;
  }, [clients]);

  // Streak distribution
  const streakDistribution = useMemo(() => ({
    noStreak: clients.filter(c => c.currentStreak === 0).length,
    short: clients.filter(c => c.currentStreak >= 1 && c.currentStreak < 7).length,
    medium: clients.filter(c => c.currentStreak >= 7 && c.currentStreak < 30).length,
    long: clients.filter(c => c.currentStreak >= 30).length,
  }), [clients]);

  // Max values for chart scaling and Y-axis ticks (0, 1, 2, ... max)
  const maxTrendValue = Math.max(
    ...trendData.flatMap(d => [d.completions, d.photos]),
    1
  );
  const yAxisTicks = Array.from({ length: maxTrendValue + 1 }, (_, i) => i);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-500">Track client performance and engagement metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Period Selector */}
          <div className="relative">
            <button
              onClick={() => setShowTimePeriodDropdown(!showTimePeriodDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">
                {TIME_PERIODS.find(p => p.value === timePeriod)?.label}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showTimePeriodDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10">
                {TIME_PERIODS.map(period => (
                  <button
                    key={period.value}
                    onClick={() => {
                      setTimePeriod(period.value);
                      setShowTimePeriodDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      timePeriod === period.value ? 'text-[#007185] font-medium' : 'text-gray-700'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D2A3E] text-white rounded-xl hover:bg-[#3D3A4E] transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#cab0a5] to-[#b89a8e] rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 opacity-80" />
            {complianceChange !== null && (
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                complianceChange >= 0 ? 'bg-white/20' : 'bg-red-500/20'
              }`}>
                {complianceChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {Math.abs(complianceChange)}%
              </div>
            )}
          </div>
          <p className="text-3xl font-bold">{overviewMetrics.avgCompliance}%</p>
          <p className="text-white/80 text-sm">Avg. Compliance</p>
        </div>
        <div className="bg-gradient-to-br from-[#a57865] to-[#8a6354] rounded-2xl p-5 text-white">
          <Flame className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-3xl font-bold">{overviewMetrics.avgStreak}</p>
          <p className="text-white/80 text-sm">Avg. Streak (days)</p>
        </div>
        <div className="bg-gradient-to-br from-[#007185] to-[#005a6a] rounded-2xl p-5 text-white">
          <Trophy className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-3xl font-bold">{overviewMetrics.goldPlusClients}</p>
          <p className="text-white/80 text-sm">Gold+ Clients</p>
        </div>
        <div className="bg-gradient-to-br from-[#e6d5b8] to-[#d4c4a8] rounded-2xl p-5 text-[#2D2A3E]">
          <Check className="w-8 h-8 mb-3 opacity-80" />
          <p className="text-3xl font-bold">{overviewMetrics.completedToday}/{overviewMetrics.totalClients}</p>
          <p className="text-[#2D2A3E]/70 text-sm">Completed Today</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overviewMetrics.totalClients}</p>
              <p className="text-sm text-gray-500">Total Clients</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overviewMetrics.totalPhotos}</p>
              <p className="text-sm text-gray-500">Photos Uploaded</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overviewMetrics.totalProducts}</p>
              <p className="text-sm text-gray-500">Products in Library</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{overviewMetrics.activeTreatmentPlans}</p>
              <p className="text-sm text-gray-500">Active Plans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Trend Chart */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-serif font-bold text-lg">Routine Completion Trend</h3>
            <p className="text-sm text-gray-500">Daily routine completions over time</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#007185]"></div>
              <span className="text-gray-500">Completions</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#cab0a5]"></div>
              <span className="text-gray-500">Photos</span>
            </div>
          </div>
        </div>
        
        {trendData.length > 0 ? (
          <div className="relative">
            {/* Y-axis labels - 0, 1, 2, ... max */}
            <div className="absolute left-0 top-0 w-8 flex flex-col justify-between text-xs text-gray-400" style={{ height: '140px' }}>
              {yAxisTicks.slice().reverse().map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            
            {/* Chart + grid area (bars sit on top of grid) */}
            <div className="ml-10 relative" style={{ height: '140px' }}>
              {/* Gray grid - horizontal lines */}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div className="flex-1 border-t border-gray-200" />
                <div className="flex-1 border-t border-gray-200" />
                <div className="flex-1 border-t border-gray-200" />
              </div>
              {/* Gray grid - vertical lines (one per day) */}
              <div className="absolute inset-0 flex gap-0.5 pointer-events-none">
                {trendData.map((day) => (
                  <div key={day.date} className="flex-1 min-w-0 border-r border-gray-200 first:border-l first:border-gray-200" />
                ))}
              </div>
              {/* Bars - two per day */}
              <div className="absolute inset-0 flex gap-0.5 items-end">
                {trendData.map((day) => (
                  <div key={day.date} className="flex-1 min-w-0 flex items-end justify-center gap-0.5 h-full">
                    <div 
                      className="w-full max-w-5 bg-[#007185] rounded-t transition-all hover:bg-[#005a6a]"
                      style={{ 
                        height: `${(day.completions / maxTrendValue) * 100}%`,
                        minHeight: day.completions > 0 ? '4px' : '0'
                      }}
                      title={`${day.completions} completions`}
                    />
                    <div 
                      className="w-full max-w-5 bg-[#cab0a5] rounded-t transition-all hover:bg-[#b89a8e]"
                      style={{ 
                        height: `${(day.photos / maxTrendValue) * 100}%`,
                        minHeight: day.photos > 0 ? '4px' : '0'
                      }}
                      title={`${day.photos} photos`}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* X-axis line - below the chart */}
            <div className="ml-10 h-px bg-gray-300" />
            
            {/* Date labels - below X-axis */}
            <div className="ml-10 flex gap-0.5 pt-2">
              {trendData.map((day, idx) => (
                <div key={day.date} className="flex-1 min-w-0 flex justify-center">
                  {(idx === 0 || idx === trendData.length - 1 || idx % 7 === 0) && (
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No data available for this period</p>
            </div>
          </div>
        )}
      </div>

      {/* Client Compliance Overview */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif font-bold text-lg">Client Compliance Overview</h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#007185]"></div>
              <span className="text-gray-500">80%+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#a57865]"></div>
              <span className="text-gray-500">50-79%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#cab0a5]"></div>
              <span className="text-gray-500">&lt;50%</span>
            </div>
          </div>
        </div>
        
        {sortedByCompliance.length > 0 ? (
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            {sortedByCompliance.map((client) => (
              <div key={client.id} className="flex items-center gap-4">
                {client.avatar_url ? (
                  <EncryptedImage 
                    src={client.avatar_url} 
                    alt={client.name} 
                    className="w-8 h-8 rounded-full object-cover" 
                    fallbackClassName="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#cab0a5] to-[#a57865] flex items-center justify-center text-white text-sm font-medium">
                    {client.name.charAt(0)}
                  </div>
                )}
                <div className="w-32 truncate text-sm font-medium">{client.name}</div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        client.compliance >= 80 ? 'bg-[#007185]' :
                        client.compliance >= 50 ? 'bg-[#a57865]' : 'bg-[#cab0a5]'
                      }`} 
                      style={{ width: `${client.compliance}%` }} 
                    />
                  </div>
                </div>
                <div className="w-12 text-right font-medium">{client.compliance}%</div>
                <button
                  onClick={() => onNavigateToView?.('clients')}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="View Profile"
                >
                  <Eye className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No clients found</p>
          </div>
        )}
      </div>

      {/* Level Distribution & Streak Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Level Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Award className="w-5 h-5 text-[#007185]" />
            <h3 className="font-serif font-bold text-lg">Client Level Distribution</h3>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {AWARD_LEVELS.map((level) => {
              const count = levelDistribution[level.name] || 0;
              const colorClass = BRAND_COLORS[level.name] || level.color;
              return (
                <div key={level.name} className="text-center">
                  <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-2`}>
                    <span className={`text-lg font-bold ${level.name === 'Gold' ? 'text-[#2D2A3E]' : 'text-white'}`}>
                      {count}
                    </span>
                  </div>
                  <p className="text-xs font-medium">{level.name}</p>
                  <p className="text-[10px] text-gray-400">{level.minPoints}+ pts</p>
                </div>
              );
            })}
          </div>
          
          {/* Level progress bar */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {AWARD_LEVELS.map((level, idx) => {
                const count = levelDistribution[level.name] || 0;
                const percentage = clients.length > 0 ? (count / clients.length) * 100 : 0;
                if (percentage === 0) return null;
                return (
                  <div
                    key={level.name}
                    className={`bg-gradient-to-r ${BRAND_COLORS[level.name]}`}
                    style={{ width: `${percentage}%` }}
                    title={`${level.name}: ${count} clients (${Math.round(percentage)}%)`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Streak Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="font-serif font-bold text-lg">Streak Distribution</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">{streakDistribution.noStreak}</p>
              <p className="text-xs text-gray-600 mt-1">No Streak</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-600">{streakDistribution.short}</p>
              <p className="text-xs text-gray-600 mt-1">1-6 Days</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{streakDistribution.medium}</p>
              <p className="text-xs text-gray-600 mt-1">7-29 Days</p>
            </div>
            <div className="text-center p-3 bg-[#007185]/10 rounded-xl">
              <p className="text-2xl font-bold text-[#007185]">{streakDistribution.long}</p>
              <p className="text-xs text-gray-600 mt-1">30+ Days</p>
            </div>
          </div>
          
          {/* Streak progress bar */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {clients.length > 0 && (
                <>
                  <div className="bg-red-400" style={{ width: `${(streakDistribution.noStreak / clients.length) * 100}%` }} />
                  <div className="bg-amber-400" style={{ width: `${(streakDistribution.short / clients.length) * 100}%` }} />
                  <div className="bg-green-400" style={{ width: `${(streakDistribution.medium / clients.length) * 100}%` }} />
                  <div className="bg-[#007185]" style={{ width: `${(streakDistribution.long / clients.length) * 100}%` }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers & Needs Attention */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <h3 className="font-serif font-bold text-lg">Top Performers</h3>
          </div>
          {sortedByPoints.length > 0 ? (
            <div className="space-y-3">
              {sortedByPoints.slice(0, 5).map((client, idx) => (
                <div key={client.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-[#e6d5b8] text-[#2D2A3E]' :
                    idx === 1 ? 'bg-[#cab0a5] text-white' :
                    idx === 2 ? 'bg-[#a57865] text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  {client.avatar_url ? (
                    <EncryptedImage 
                      src={client.avatar_url} 
                      alt={client.name} 
                      className="w-10 h-10 rounded-full object-cover" 
                      fallbackClassName="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#cab0a5] to-[#a57865] flex items-center justify-center text-white font-medium">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.points.toLocaleString()} points</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#007185]">{client.compliance}%</p>
                    <p className="text-xs text-gray-400">compliance</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No clients yet</p>
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-serif font-bold text-lg">Needs Attention</h3>
          </div>
          {clientsNeedingAttention.length > 0 ? (
            <div className="space-y-3">
              {clientsNeedingAttention.slice(0, 5).map((client) => (
                <div key={client.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                  {client.avatar_url ? (
                    <EncryptedImage 
                      src={client.avatar_url} 
                      alt={client.name} 
                      className="w-10 h-10 rounded-full object-cover" 
                      fallbackClassName="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-300 to-red-400 flex items-center justify-center text-white font-medium">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    <p className="text-xs text-red-600">
                      {client.currentStreak === 0 ? 'No active streak' : `${client.currentStreak} day streak`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{client.compliance}%</p>
                    <button 
                      onClick={() => onNavigateToView?.('clients')}
                      className="text-xs text-[#007185] hover:underline"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              <Check className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <p className="text-sm">All clients are performing well!</p>
            </div>
          )}
        </div>
      </div>

      {/* Product Analytics */}
      {productAnalytics.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-5 h-5 text-[#007185]" />
            <h3 className="font-serif font-bold text-lg">Product Library by Category</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {productAnalytics.map((cat, idx) => {
              const colors = [
                'bg-[#007185]', 'bg-[#a57865]', 'bg-[#cab0a5]', 
                'bg-[#e6d5b8]', 'bg-[#2D2A3E]', 'bg-gray-400'
              ];
              return (
                <div key={cat.category} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className={`w-12 h-12 mx-auto rounded-full ${colors[idx % colors.length]} flex items-center justify-center mb-2`}>
                    <span className="text-white font-bold">{cat.count}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">{cat.category}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Summary */}
      <div className="bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5" />
          <h3 className="font-serif font-bold text-lg">Activity Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">Avg. Response</span>
            </div>
            <p className="text-2xl font-bold">
              {clients.length > 0 ? '< 24h' : '--'}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">Goal Achievement</span>
            </div>
            <p className="text-2xl font-bold">
              {overviewMetrics.avgCompliance >= 70 ? 'On Track' : 'Needs Work'}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">Engagement Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {clients.length > 0 
                ? `${Math.round((overviewMetrics.completedToday / clients.length) * 100)}%`
                : '--'
              }
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-white/60" />
              <span className="text-sm text-white/60">Active Clients</span>
            </div>
            <p className="text-2xl font-bold">
              {clients.filter(c => c.compliance > 0).length}/{clients.length}
            </p>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {clients.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">No Analytics Data Yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Start by adding clients to your practice. Once they begin using their routines, 
            you'll see detailed analytics and insights here.
          </p>
          <button
            onClick={() => onNavigateToView?.('clients')}
            className="px-6 py-3 bg-[#007185] text-white rounded-xl hover:bg-[#005a6a] transition-colors font-medium"
          >
            Add Your First Client
          </button>
        </div>
      )}
    </div>
  );
};

export default AnalyticsSection;
