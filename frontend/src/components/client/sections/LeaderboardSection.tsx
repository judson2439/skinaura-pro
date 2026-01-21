import React, { useState, useEffect } from 'react';
import { Crown, Flame, Loader2, Users, Trophy, Medal } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { EncryptedImage } from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  points: number;
  level: string;
  streak: number;
  totalRoutines: number;
  isCurrentUser: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_COLORS: Record<string, string> = {
  Bronze: 'bg-amber-600',
  Silver: 'bg-gray-400',
  Gold: 'bg-amber-400',
  Platinum: 'bg-slate-400',
  Diamond: 'bg-cyan-400',
};

const LEVEL_BORDER_COLORS: Record<string, string> = {
  Bronze: 'border-amber-600',
  Silver: 'border-gray-400',
  Gold: 'border-amber-400',
  Platinum: 'border-slate-400',
  Diamond: 'border-cyan-400',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initials from a name (first letter of first name + first letter of last name)
 */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '';
  return (parts[0][0]?.toUpperCase() || '') + (parts[parts.length - 1][0]?.toUpperCase() || '');
};

// ============================================================================
// COMPONENT
// ============================================================================

const LeaderboardSection: React.FC = () => {
  const authToken = getAuthToken();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        apiClient.setAuthToken(token);
        
        const response = await apiClient.get<{
          success: boolean;
          data?: {
            leaderboard: LeaderboardEntry[];
            currentUserRank: number | null;
          };
          error?: string;
        }>('/api/client/leaderboard');

        if (!response.data.success) {
          console.error('Error fetching leaderboard:', response.data.error);
          setError('Failed to load leaderboard data');
          setLeaderboardData([]);
          setCurrentUserRank(null);
        } else if (response.data.data) {
          setLeaderboardData(response.data.data.leaderboard || []);
          setCurrentUserRank(response.data.data.currentUserRank);
        }
      } catch (err) {
        console.error('Unexpected error fetching leaderboard:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [authToken]);

  // Get top 3 for podium
  const top3 = leaderboardData.slice(0, 3);
  const hasTop3 = top3.length >= 3;

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
            <span className="ml-3 text-white">Loading leaderboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Leaderboard</h3>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (leaderboardData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-[#CFAFA3]" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Rankings Yet</h3>
            <p className="text-gray-500 max-w-md">
              Complete your skincare routines to earn points and appear on the leaderboard!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current User Rank Banner (if not in top 10) */}
      {currentUserRank && currentUserRank > 10 && (
        <div className="bg-gradient-to-r from-[#CFAFA3] to-[#E5D4CF] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center">
                <Medal className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Your Current Rank</p>
                <p className="text-white/80 text-sm">Keep completing routines to climb higher!</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">#{currentUserRank}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 Podium */}
      {hasTop3 && (
        <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6">
          <h3 className="text-white font-serif font-bold text-lg text-center mb-6">Top Performers</h3>
          <div className="flex items-end justify-center gap-4">
            {/* 2nd Place */}
            <div className="text-center">
              <div className="relative">
                {top3[1].isCurrentUser ? (
                  <EncryptedImage 
                    src={top3[1].avatar} 
                    alt={top3[1].name} 
                    className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 ${LEVEL_BORDER_COLORS[top3[1].level] || 'border-gray-400'} object-cover`}
                    fallbackIcon="user"
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 ${LEVEL_BORDER_COLORS[top3[1].level] || 'border-gray-400'} bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center`}>
                    <span className="text-white text-lg font-bold">{getInitials(top3[1].name)}</span>
                  </div>
                )}
                {top3[1].isCurrentUser && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#CFAFA3] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">You</span>
                  </div>
                )}
              </div>
              <p className="text-white text-sm font-medium truncate max-w-[80px]">
                {top3[1].isCurrentUser ? 'You' : top3[1].name.split(' ')[0]}
              </p>
              <p className="text-white/60 text-xs">{top3[1].points.toLocaleString()} pts</p>
              <div className="w-20 h-16 bg-gray-400 rounded-t-lg mt-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
            </div>
            
            {/* 1st Place */}
            <div className="text-center">
              <div className="relative">
                {top3[0].isCurrentUser ? (
                  <EncryptedImage 
                    src={top3[0].avatar} 
                    alt={top3[0].name} 
                    className={`w-20 h-20 rounded-full mx-auto mb-2 border-4 border-yellow-400 object-cover`}
                    fallbackIcon="user"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-2 border-4 border-yellow-400 bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                    <span className="text-white text-xl font-bold">{getInitials(top3[0].name)}</span>
                  </div>
                )}
                <Crown className="w-6 h-6 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />
                {top3[0].isCurrentUser && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#CFAFA3] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">You</span>
                  </div>
                )}
              </div>
              <p className="text-white font-medium truncate max-w-[80px]">
                {top3[0].isCurrentUser ? 'You' : top3[0].name.split(' ')[0]}
              </p>
              <p className="text-white/60 text-xs">{top3[0].points.toLocaleString()} pts</p>
              <div className="w-20 h-24 bg-yellow-400 rounded-t-lg mt-2 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
            </div>
            
            {/* 3rd Place */}
            <div className="text-center">
              <div className="relative">
                {top3[2].isCurrentUser ? (
                  <EncryptedImage 
                    src={top3[2].avatar} 
                    alt={top3[2].name} 
                    className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 border-amber-600 object-cover`}
                    fallbackIcon="user"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full mx-auto mb-2 border-4 border-amber-600 bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">{getInitials(top3[2].name)}</span>
                  </div>
                )}
                {top3[2].isCurrentUser && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#CFAFA3] rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">You</span>
                  </div>
                )}
              </div>
              <p className="text-white text-sm font-medium truncate max-w-[80px]">
                {top3[2].isCurrentUser ? 'You' : top3[2].name.split(' ')[0]}
              </p>
              <p className="text-white/60 text-xs">{top3[2].points.toLocaleString()} pts</p>
              <div className="w-20 h-12 bg-amber-600 rounded-t-lg mt-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partial Podium for less than 3 users */}
      {!hasTop3 && leaderboardData.length > 0 && (
        <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6">
          <h3 className="text-white font-serif font-bold text-lg text-center mb-6">Top Performers</h3>
          <div className="flex items-end justify-center gap-6">
            {leaderboardData.map((entry, index) => {
              const borderColor = index === 0 ? 'border-yellow-400' : index === 1 ? 'border-gray-400' : 'border-amber-600';
              const bgGradient = index === 0 ? 'from-yellow-400 to-yellow-500' : index === 1 ? 'from-gray-400 to-gray-500' : 'from-amber-600 to-amber-700';
              return (
              <div key={entry.userId} className="text-center">
                <div className="relative">
                  {entry.isCurrentUser ? (
                    <EncryptedImage 
                      src={entry.avatar} 
                      alt={entry.name} 
                      className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 ${borderColor} object-cover`}
                      fallbackIcon="user"
                    />
                  ) : (
                    <div className={`w-16 h-16 rounded-full mx-auto mb-2 border-4 ${borderColor} bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
                      <span className="text-white text-lg font-bold">{getInitials(entry.name)}</span>
                    </div>
                  )}
                  {index === 0 && <Crown className="w-6 h-6 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />}
                  {entry.isCurrentUser && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#CFAFA3] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">You</span>
                    </div>
                  )}
                </div>
                <p className="text-white text-sm font-medium truncate max-w-[80px]">
                  {entry.isCurrentUser ? 'You' : entry.name.split(' ')[0]}
                </p>
                <p className="text-white/60 text-xs">{entry.points.toLocaleString()} pts</p>
                <div className={`w-20 mt-2 rounded-t-lg flex items-center justify-center ${
                  index === 0 ? 'h-24 bg-yellow-400' : index === 1 ? 'h-16 bg-gray-400' : 'h-12 bg-amber-600'
                }`}>
                  <span className={`font-bold text-white ${index === 0 ? 'text-3xl' : 'text-2xl'}`}>{index + 1}</span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-lg">Full Rankings</h3>
            <span className="text-sm text-gray-500">{leaderboardData.length} participants</span>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {leaderboardData.map((entry) => (
            <div 
              key={entry.userId} 
              className={`flex items-center gap-4 p-4 ${
                entry.isCurrentUser 
                  ? 'bg-[#CFAFA3]/10 border-l-4 border-l-[#CFAFA3]' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                entry.rank === 1 ? 'bg-yellow-400 text-white' :
                entry.rank === 2 ? 'bg-gray-400 text-white' :
                entry.rank === 3 ? 'bg-amber-600 text-white' :
                'bg-gray-100 text-gray-600'
              }`}>
                {entry.rank}
              </div>
              {entry.isCurrentUser ? (
                <EncryptedImage 
                  src={entry.avatar} 
                  alt={entry.name} 
                  className={`w-10 h-10 rounded-full object-cover border-2 ${LEVEL_BORDER_COLORS[entry.level] || 'border-gray-200'}`}
                  fallbackIcon="user"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full border-2 ${LEVEL_BORDER_COLORS[entry.level] || 'border-gray-200'} bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">{getInitials(entry.name)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {entry.name.split(' ')[0]}
                  {entry.isCurrentUser && (
                    <span className="text-[#CFAFA3] ml-1">(You)</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_COLORS[entry.level] || 'bg-gray-400'} text-white`}>
                    {entry.level}
                  </span>
                  <span className="text-xs text-gray-500">{entry.totalRoutines} routines</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-orange-500">
                <Flame className="w-4 h-4" />
                <span className="font-medium">{entry.streak}</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#CFAFA3]">{entry.points.toLocaleString()}</p>
                <p className="text-xs text-gray-500">points</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      {currentUserRank && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-[#CFAFA3]">#{currentUserRank}</p>
            <p className="text-sm text-gray-500">Your Rank</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{leaderboardData.length}</p>
            <p className="text-sm text-gray-500">Total Players</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-amber-500">
              {leaderboardData[0]?.points.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500">Top Score</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-orange-500">
              {leaderboardData[0]?.streak || 0}
            </p>
            <p className="text-sm text-gray-500">Best Streak</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardSection;
