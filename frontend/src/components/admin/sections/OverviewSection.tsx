/**
 * @fileoverview Admin Overview Section Component
 * Displays platform metrics, user statistics, products, photos, routines, and gamification data.
 */

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Star,
  Zap,
  MessageSquare,
  Camera,
  Gauge,
  CreditCard,
  Target,
  Award,
  Flame,
  Trophy,
  Image,
  Calendar,
  Activity,
  BarChart3,
  PieChart,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';

interface OverviewSectionProps {
  onRefresh?: () => Promise<void>;
}

interface UserStats {
  total: number;
  professionals: number;
  clients: number;
  admins: number;
  newThisMonth: number;
  newThisWeek: number;
}

interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  global: number;
  byCategory: { category: string; count: number }[];
}

interface PhotoStats {
  total: number;
  before: number;
  after: number;
  progress: number;
  withComments: number;
  withAnnotations: number;
  thisMonth: number;
}

interface RoutineStats {
  total: number;
  active: number;
  inactive: number;
  thisMonth: number;
}

interface GamificationStats {
  totalPoints: number;
  totalBadges: number;
  totalRoutinesCompleted: number;
  avgStreak: number;
  maxStreak: number;
  activeUsers: number;
  topLevels: { level: number; count: number }[];
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ onRefresh }) => {
  const { authToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [userStats, setUserStats] = useState<UserStats>({
    total: 0,
    professionals: 0,
    clients: 0,
    admins: 0,
    newThisMonth: 0,
    newThisWeek: 0,
  });
  
  const [productStats, setProductStats] = useState<ProductStats>({
    total: 0,
    active: 0,
    inactive: 0,
    global: 0,
    byCategory: [],
  });
  
  const [photoStats, setPhotoStats] = useState<PhotoStats>({
    total: 0,
    before: 0,
    after: 0,
    progress: 0,
    withComments: 0,
    withAnnotations: 0,
    thisMonth: 0,
  });
  
  const [routineStats, setRoutineStats] = useState<RoutineStats>({
    total: 0,
    active: 0,
    inactive: 0,
    thisMonth: 0,
  });
  
  const [gamificationStats, setGamificationStats] = useState<GamificationStats>({
    totalPoints: 0,
    totalBadges: 0,
    totalRoutinesCompleted: 0,
    avgStreak: 0,
    maxStreak: 0,
    activeUsers: 0,
    topLevels: [],
  });

  const fetchAllData = async () => {
    if (!authToken) return;

    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: {
          userStats: UserStats;
          productStats: ProductStats;
          photoStats: PhotoStats;
          routineStats: RoutineStats;
          gamificationStats: GamificationStats;
        };
      }>('/api/admin/overview');

      if (response.data.success && response.data.data) {
        const { userStats: users, productStats: products, photoStats: photos, routineStats: routines, gamificationStats: gamification } = response.data.data;

        if (users) {
          setUserStats(users);
        }
        if (products) {
          setProductStats(products);
        }
        if (photos) {
          setPhotoStats(photos);
        }
        if (routines) {
          setRoutineStats(routines);
        }
        if (gamification) {
          setGamificationStats(gamification);
        }
      }
    } catch (error) {
      console.error('Error fetching overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [authToken]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setLastUpdated(new Date());
    setIsRefreshing(false);
    if (onRefresh) {
      await onRefresh();
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPercentage = (part: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-gray-500">Loading overview data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Platform Overview</h2>
          <p className="text-sm text-gray-500 mt-1">
            Real-time overview of your platform's health and performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
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

      {/* Key Metrics - The Pulse */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Gauge className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Key Metrics</h3>
            <p className="text-sm text-white/60">Platform activity at a glance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Users */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-center gap-1 text-green-400 text-sm">
                <ArrowUpRight className="w-4 h-4" />
                <span>+{userStats.newThisWeek} this week</span>
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{formatNumber(userStats.total)}</p>
            <p className="text-sm text-white/60">Total Users</p>
          </div>

          {/* Total Products */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{productStats.active} active</span>
            </div>
            <p className="text-3xl font-bold mb-1">{formatNumber(productStats.total)}</p>
            <p className="text-sm text-white/60">Products in Library</p>
          </div>

          {/* Total Photos */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">+{photoStats.thisMonth} this month</span>
            </div>
            <p className="text-3xl font-bold mb-1">{formatNumber(photoStats.total)}</p>
            <p className="text-sm text-white/60">Progress Photos</p>
          </div>

          {/* Total Routines Completed */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">All-Time</span>
            </div>
            <p className="text-3xl font-bold mb-1">{formatNumber(gamificationStats.totalRoutinesCompleted)}</p>
            <p className="text-sm text-white/60">Routines Completed</p>
          </div>
        </div>
      </div>

      {/* User Statistics & Product Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Statistics</h3>
                <p className="text-sm text-gray-500">Breakdown by role</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(userStats.professionals)}</p>
                <p className="text-xs text-gray-500">Professionals</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(userStats.clients)}</p>
                <p className="text-xs text-gray-500">Clients</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star className="w-5 h-5 text-gray-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(userStats.admins)}</p>
                <p className="text-xs text-gray-500">Admins</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">New this month</span>
                </div>
                <span className="text-sm font-semibold text-green-600">+{userStats.newThisMonth}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">New this week</span>
                </div>
                <span className="text-sm font-semibold text-green-600">+{userStats.newThisWeek}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Product Statistics</h3>
                <p className="text-sm text-gray-500">Library overview</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(productStats.active)}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(productStats.inactive)}</p>
                <p className="text-xs text-gray-500">Inactive</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(productStats.global)}</p>
                <p className="text-xs text-gray-500">Global</p>
              </div>
            </div>
            
            {productStats.byCategory.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Top Categories</p>
                <div className="space-y-2">
                  {productStats.byCategory.map((cat, index) => (
                    <div key={cat.category} className="flex items-center gap-3">
                      <div className="w-6 text-xs text-gray-400 text-right">{index + 1}.</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{cat.category}</span>
                          <span className="text-sm font-medium text-gray-900">{cat.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${getPercentage(cat.count, productStats.total)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Photos & Routine Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Photos Statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Image className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Progress Photos</h3>
                <p className="text-sm text-gray-500">Photo uploads and engagement</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(photoStats.before)}</p>
                <p className="text-xs text-gray-500">Before</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(photoStats.after)}</p>
                <p className="text-xs text-gray-500">After</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{formatNumber(photoStats.progress)}</p>
                <p className="text-xs text-gray-500">Progress</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Photos with comments</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatNumber(photoStats.withComments)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Photos with annotations</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatNumber(photoStats.withAnnotations)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">Uploaded this month</span>
                </div>
                <span className="text-sm font-semibold text-green-600">+{formatNumber(photoStats.thisMonth)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Routine Templates Statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Routine Templates</h3>
                <p className="text-sm text-gray-500">Created by professionals</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="12"
                    strokeDasharray={`${getPercentage(routineStats.active, routineStats.total) * 4.4} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-gray-900">{formatNumber(routineStats.total)}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(routineStats.active)}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(routineStats.inactive)}</p>
                  <p className="text-xs text-gray-500">Inactive</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-600">Created this month</span>
              </div>
              <span className="text-sm font-semibold text-orange-600">+{formatNumber(routineStats.thisMonth)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gamification Statistics */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Gamification & Engagement</h3>
              <p className="text-sm text-gray-500">User achievements and activity</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{formatNumber(gamificationStats.totalPoints)}</p>
              <p className="text-xs text-gray-500">Total Points</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{formatNumber(gamificationStats.totalBadges)}</p>
              <p className="text-xs text-gray-500">Badges Earned</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{formatNumber(gamificationStats.totalRoutinesCompleted)}</p>
              <p className="text-xs text-gray-500">Routines Done</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{gamificationStats.avgStreak}</p>
              <p className="text-xs text-gray-500">Avg Streak</p>
            </div>
            
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{gamificationStats.maxStreak}</p>
              <p className="text-xs text-gray-500">Max Streak</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-2">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-xl font-bold text-gray-900">{formatNumber(gamificationStats.activeUsers)}</p>
              <p className="text-xs text-gray-500">Active Streaks</p>
            </div>
          </div>
          
          {gamificationStats.topLevels.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-4">User Levels Distribution</p>
              <div className="flex items-end gap-2 h-24">
                {gamificationStats.topLevels.map((levelData) => {
                  const maxCount = Math.max(...gamificationStats.topLevels.map(l => l.count));
                  const height = (levelData.count / maxCount) * 100;
                  return (
                    <div key={levelData.level} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{levelData.count}</span>
                      <div 
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all"
                        style={{ height: `${height}%`, minHeight: '8px' }}
                      />
                      <span className="text-xs font-medium text-gray-700">Lv.{levelData.level}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-8 h-8 text-white/80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Platform</span>
          </div>
          <p className="text-3xl font-bold mb-1">{formatNumber(userStats.total + productStats.total)}</p>
          <p className="text-white/70 text-sm">Total Records</p>
        </div>
        <div className="bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <PieChart className="w-8 h-8 text-white/80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Ratio</span>
          </div>
          <p className="text-3xl font-bold mb-1">
            {userStats.professionals > 0 ? Math.round(userStats.clients / userStats.professionals) : 0}:1
          </p>
          <p className="text-white/70 text-sm">Client to Professional Ratio</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-8 h-8 text-white/80" />
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Engagement</span>
          </div>
          <p className="text-3xl font-bold mb-1">
            {userStats.total > 0 ? Math.round((gamificationStats.activeUsers / userStats.clients) * 100) : 0}%
          </p>
          <p className="text-white/70 text-sm">Client Engagement Rate</p>
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
