import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Crown,
  Medal,
  Trophy,
  Star,
  Gem,
  Lock,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';

// ============================================================================
// TYPES
// ============================================================================

interface GamificationStats {
  total_routines_completed: number;
  current_streak: number;
  longest_streak: number;
  total_points: number;
}

interface UserGamification {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string | null;
  earned_at: string;
}

interface BadgeDefinition {
  name: string;
  description: string;
  condition: (stats: GamificationStats) => boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  image: string;
  earned: boolean;
  earnedDate?: string;
}

interface AwardLevel {
  name: string;
  minPoints: number;
  color: string;
  icon: React.FC<{ className?: string }>;
}

interface ClientStats {
  points: number;
  level: string;
  currentStreak: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { 
    name: 'First Step', 
    description: 'Complete your first routine', 
    condition: (stats: GamificationStats) => stats.total_routines_completed >= 1 
  },
  { 
    name: 'Week Warrior', 
    description: 'Maintain a 7-day streak', 
    condition: (stats: GamificationStats) => stats.current_streak >= 7 || stats.longest_streak >= 7 
  },
  { 
    name: 'Consistency Queen', 
    description: 'Maintain a 14-day streak', 
    condition: (stats: GamificationStats) => stats.current_streak >= 14 || stats.longest_streak >= 14 
  },
  { 
    name: 'Skincare Devotee', 
    description: 'Maintain a 30-day streak', 
    condition: (stats: GamificationStats) => stats.current_streak >= 30 || stats.longest_streak >= 30 
  },
  { 
    name: 'Glow Getter', 
    description: 'Complete 50 routines', 
    condition: (stats: GamificationStats) => stats.total_routines_completed >= 50 
  },
  { 
    name: 'Radiance Master', 
    description: 'Complete 100 routines', 
    condition: (stats: GamificationStats) => stats.total_routines_completed >= 100 
  },
];

const BADGE_IMAGES = [
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033498073_cb9c4bf4.jpg",
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033498972_258a64f0.jpg",
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033499876_b417affa.png",
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033500485_210ff0ba.png",
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033498073_cb9c4bf4.jpg",
  "https://d64gsuwffb70l.cloudfront.net/69343bc0dba891717b31545c_1765033498972_258a64f0.jpg",
];

const AWARD_LEVELS: AwardLevel[] = [
  { name: 'Bronze', minPoints: 0, color: 'from-amber-700 to-orange-800', icon: Medal },
  { name: 'Silver', minPoints: 500, color: 'from-gray-400 to-gray-500', icon: Star },
  { name: 'Gold', minPoints: 1500, color: 'from-yellow-400 to-amber-500', icon: Crown },
  { name: 'Platinum', minPoints: 3500, color: 'from-blue-400 to-indigo-500', icon: Trophy },
  { name: 'Diamond', minPoints: 7000, color: 'from-purple-500 to-pink-600', icon: Gem },
];

// Default stats when no data exists
const DEFAULT_GAMIFICATION_STATS: GamificationStats = {
  total_routines_completed: 0,
  current_streak: 0,
  longest_streak: 0,
  total_points: 0,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getLevelFromPoints = (points: number): string => {
  let level = 'Bronze';
  for (const awardLevel of AWARD_LEVELS) {
    if (points >= awardLevel.minPoints) {
      level = awardLevel.name;
    }
  }
  return level;
};

const getLevelInfo = (level: string) => {
  const currentIndex = AWARD_LEVELS.findIndex(l => l.name === level);
  const current = AWARD_LEVELS[currentIndex] || AWARD_LEVELS[0];
  const next = AWARD_LEVELS[currentIndex + 1] || null;
  
  return { current, next };
};

// ============================================================================
// COMPONENT
// ============================================================================

const AchievementsSection: React.FC = () => {
  // Get auth token for API calls
  const authToken = getAuthToken();
  
  const [gamificationData, setGamificationData] = useState<UserGamification | null>(null);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBadges, setSavingBadges] = useState(false);
  
  // Track which badges we've already attempted to save to prevent duplicate attempts
  const savedBadgeAttemptsRef = useRef<Set<string>>(new Set());

  // Fetch gamification data from database
  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        apiClient.setAuthToken(token);
        
        const response = await apiClient.get<{
          success: boolean;
          data?: {
            gamification: UserGamification | null;
            badges: UserBadge[];
          };
          error?: string;
        }>('/api/client/achievements');

        if (!response.data.success) {
          console.error('Error fetching achievements:', response.data.error);
          setGamificationData(null);
          setUserBadges([]);
        } else if (response.data.data) {
          setGamificationData(response.data.data.gamification);
          setUserBadges(response.data.data.badges || []);
          
          // Mark already saved badges as attempted
          (response.data.data.badges || []).forEach(badge => {
            savedBadgeAttemptsRef.current.add(badge.badge_name);
          });
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setGamificationData(null);
        setUserBadges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authToken]);

  // Convert database data to stats format
  const gamificationStats: GamificationStats = gamificationData 
    ? {
        total_routines_completed: gamificationData.total_routines_completed || 0,
        current_streak: gamificationData.current_streak || 0,
        longest_streak: gamificationData.longest_streak || 0,
        total_points: gamificationData.points || 0,
      }
    : DEFAULT_GAMIFICATION_STATS;

  // Save newly earned badges to database
  const saveNewBadges = useCallback(async (newBadges: { name: string; description: string; image: string }[]) => {
    const token = getAuthToken();
    if (!token || newBadges.length === 0) return;

    // Filter out badges we've already attempted to save
    const badgesToSave = newBadges.filter(badge => !savedBadgeAttemptsRef.current.has(badge.name));
    
    if (badgesToSave.length === 0) return;

    // Mark these badges as attempted immediately to prevent race conditions
    badgesToSave.forEach(badge => {
      savedBadgeAttemptsRef.current.add(badge.name);
    });

    setSavingBadges(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { badges: UserBadge[] };
        error?: string;
      }>('/api/client/achievements/badges', {
        badges: badgesToSave,
      });

      if (!response.data.success) {
        console.error('Error saving badges:', response.data.error);
      } else if (response.data.data?.badges && response.data.data.badges.length > 0) {
        // Update local state with newly saved badges
        setUserBadges(prev => {
          const existingNames = new Set(prev.map(b => b.badge_name));
          const newData = response.data.data!.badges.filter(b => !existingNames.has(b.badge_name));
          return [...newData, ...prev];
        });
      }
    } catch (err) {
      console.error('Error saving badges:', err);
    } finally {
      setSavingBadges(false);
    }
  }, []);

  // Check and save new badges when stats change
  useEffect(() => {
    if (loading || !authToken) return;

    // Get names of badges already saved in database
    const savedBadgeNames = new Set(userBadges.map(b => b.badge_name));

    // Find newly earned badges that haven't been saved yet
    const newlyEarnedBadges: { name: string; description: string; image: string }[] = [];
    
    BADGE_DEFINITIONS.forEach((definition, index) => {
      const isEarned = definition.condition(gamificationStats);
      const isSaved = savedBadgeNames.has(definition.name);
      const isAttempted = savedBadgeAttemptsRef.current.has(definition.name);
      
      if (isEarned && !isSaved && !isAttempted) {
        newlyEarnedBadges.push({
          name: definition.name,
          description: definition.description,
          image: BADGE_IMAGES[index],
        });
      }
    });

    // Save new badges if any
    if (newlyEarnedBadges.length > 0) {
      saveNewBadges(newlyEarnedBadges);
    }
  }, [gamificationStats.total_routines_completed, gamificationStats.current_streak, gamificationStats.longest_streak, userBadges, loading, authToken, saveNewBadges]);


  // Build badges array combining definitions with saved data
  const badges: Badge[] = BADGE_DEFINITIONS.map((definition, index) => {
    const savedBadge = userBadges.find(b => b.badge_name === definition.name);
    const isEarned = savedBadge !== undefined || definition.condition(gamificationStats);
    
    return {
      id: savedBadge?.id || `badge-${index + 1}`,
      name: definition.name,
      description: definition.description,
      image: savedBadge?.badge_icon || BADGE_IMAGES[index],
      earned: isEarned,
      earnedDate: savedBadge?.earned_at,
    };
  });
  
  // Compute client stats for level display
  const clientStats: ClientStats = {
    points: gamificationStats.total_points,
    level: gamificationData?.level || getLevelFromPoints(gamificationStats.total_points),
    currentStreak: gamificationStats.current_streak,
  };
  
  const levelInfo = getLevelInfo(clientStats.level);
  const pointsToNextLevel = levelInfo.next 
    ? levelInfo.next.minPoints - clientStats.points 
    : 0;

  const earnedBadgesCount = badges.filter(b => b.earned).length;
  const totalBadgesCount = badges.length;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
        <span className="ml-3 text-gray-600">Loading achievements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Level Progress */}
      <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${levelInfo.current.color} flex items-center justify-center`}>
            <Crown className="w-10 h-10 text-white" />
          </div>
          <div>
            <p className="text-white/60 text-sm">Current Level</p>
            <h2 className="text-3xl font-bold">{clientStats.level}</h2>
            <p className="text-white/80">{clientStats.points.toLocaleString()} points</p>
          </div>
        </div>
        {levelInfo.next && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Progress to {levelInfo.next.name}</span>
              <span className="text-white">{pointsToNextLevel.toLocaleString()} pts to go</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full transition-all"
                style={{ 
                  width: `${Math.min(100, ((clientStats.points - levelInfo.current.minPoints) / (levelInfo.next.minPoints - levelInfo.current.minPoints)) * 100)}%` 
                }}
              />
            </div>
          </div>
        )}
        {!levelInfo.next && (
          <div className="text-center py-2">
            <p className="text-white/80">You've reached the highest level!</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm">Routines Completed</p>
          <p className="text-2xl font-bold text-gray-900">{gamificationStats.total_routines_completed}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm">Current Streak</p>
          <p className="text-2xl font-bold text-gray-900">{gamificationStats.current_streak} days</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm">Longest Streak</p>
          <p className="text-2xl font-bold text-gray-900">{gamificationStats.longest_streak} days</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm">Badges Earned</p>
          <p className="text-2xl font-bold text-gray-900">{earnedBadgesCount}/{totalBadgesCount}</p>
        </div>
      </div>

      {/* All Levels */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-serif font-bold text-lg mb-4">Award Levels</h3>
        <div className="grid grid-cols-5 gap-4">
          {AWARD_LEVELS.map((level) => {
            const isUnlocked = clientStats.points >= level.minPoints;
            const LevelIcon = level.icon;
            return (
              <div key={level.name} className={`text-center ${!isUnlocked && 'opacity-40'}`}>
                <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center mb-2`}>
                  <LevelIcon className="w-7 h-7 text-white" />
                </div>
                <p className="text-sm font-medium">{level.name}</p>
                <p className="text-xs text-gray-500">{level.minPoints}+ pts</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-lg">Badges</h3>
          <span className="text-sm text-gray-500">
            {savingBadges ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : (
              `${earnedBadgesCount} of ${totalBadgesCount} earned`
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div 
              key={badge.id} 
              className={`p-4 rounded-xl border transition-all ${
                badge.earned 
                  ? 'border-[#CFAFA3] bg-[#CFAFA3]/5 hover:shadow-md' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  <img 
                    src={badge.image} 
                    alt={badge.name} 
                    className={`w-full h-full object-cover ${!badge.earned && 'grayscale opacity-50'}`} 
                  />
                  {!badge.earned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`font-medium truncate ${badge.earned ? 'text-gray-900' : 'text-gray-500'}`}>
                    {badge.name}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">{badge.description}</p>
                  {badge.earned && badge.earnedDate && (
                    <p className="text-xs text-[#CFAFA3] mt-1">
                      Earned {new Date(badge.earnedDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Tips - Only show if there are unearned badges */}
      {earnedBadgesCount < totalBadgesCount && (
        <div className="bg-gradient-to-r from-[#CFAFA3]/10 to-[#E8D5D0]/10 rounded-2xl p-6 border border-[#CFAFA3]/20">
          <h3 className="font-serif font-bold text-lg mb-3">Tips to Earn More Badges</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {!badges.find(b => b.name === 'First Step')?.earned && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                Complete your first routine to earn the "First Step" badge
              </li>
            )}
            {!badges.find(b => b.name === 'Week Warrior')?.earned && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                Keep your streak going for 7 days to earn "Week Warrior"
              </li>
            )}
            {!badges.find(b => b.name === 'Consistency Queen')?.earned && gamificationStats.current_streak >= 7 && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                You're {14 - gamificationStats.current_streak} days away from "Consistency Queen"!
              </li>
            )}
            {!badges.find(b => b.name === 'Skincare Devotee')?.earned && gamificationStats.current_streak >= 14 && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                You're {30 - gamificationStats.current_streak} days away from "Skincare Devotee"!
              </li>
            )}
            {!badges.find(b => b.name === 'Glow Getter')?.earned && gamificationStats.total_routines_completed > 0 && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                Complete {50 - gamificationStats.total_routines_completed} more routines for "Glow Getter"
              </li>
            )}
            {!badges.find(b => b.name === 'Radiance Master')?.earned && gamificationStats.total_routines_completed >= 50 && (
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CFAFA3]" />
                Complete {100 - gamificationStats.total_routines_completed} more routines for "Radiance Master"
              </li>
            )}
          </ul>
        </div>
      )}

      {/* All badges earned message */}
      {earnedBadgesCount === totalBadgesCount && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-green-800">Congratulations!</h3>
              <p className="text-green-700">You've earned all badges! Keep up the amazing skincare journey!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementsSection;
