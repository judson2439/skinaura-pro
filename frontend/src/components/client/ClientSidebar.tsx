import React from 'react';
import { Link } from 'react-router-dom';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import {
  Sparkles,
  LayoutDashboard,
  Clock,
  Package,
  Camera,
  ClipboardList,
  Trophy,
  Medal,
  HelpCircle,
  Crown,
  LucideIcon,
  Bell,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ClientStats {
  level: string;
  points: number;
  currentStreak: number;
}

interface LevelInfo {
  current: { name: string; minPoints: number };
  next: { name: string; minPoints: number } | null;
}

interface ClientSidebarProps {
  sidebarOpen: boolean;
  activeView: string;
  onNavigateToView: (viewId: string) => void;
  userDisplayName: string;
  userAvatar?: string;
  clientStats: ClientStats;
  unreadNotifications?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CLIENT_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'routine', label: 'My Routine', icon: Clock },
  { id: 'products', label: 'My Products', icon: Package },
  { id: 'photos', label: 'Progress Photos', icon: Camera },
  { id: 'face-analysis', label: 'Face Analysis', icon: Sparkles },
  { id: 'treatments', label: 'Treatment Plans', icon: ClipboardList },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'leaderboard', label: 'Leaderboard', icon: Medal },
  { id: 'help', label: 'Help & FAQ', icon: HelpCircle },
];

const LEVELS = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Silver', minPoints: 500 },
  { name: 'Gold', minPoints: 1500 },
  { name: 'Platinum', minPoints: 3500 },
  { name: 'Diamond', minPoints: 7000 },
];


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLevelInfo(points: number): LevelInfo {
  let currentLevel = LEVELS[0];
  let nextLevel: typeof LEVELS[0] | null = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
      break;
    }
  }

  return { current: currentLevel, next: nextLevel };
}

// ============================================================================
// COMPONENT
// ============================================================================

const ClientSidebar: React.FC<ClientSidebarProps> = ({
  sidebarOpen,
  activeView,
  onNavigateToView,
  userDisplayName,
  userAvatar,
  clientStats,
  unreadNotifications = 0,
}) => {
  const levelInfo = getLevelInfo(clientStats.points);
  const pointsToNextLevel = levelInfo.next 
    ? levelInfo.next.minPoints - clientStats.points 
    : 0;

  // Calculate progress percentage
  const progressPercentage = levelInfo.next 
    ? Math.min(100, Math.max(0, ((clientStats.points - levelInfo.current.minPoints) / (levelInfo.next.minPoints - levelInfo.current.minPoints)) * 100))
    : 100;

  return (
    <aside 
      className={`fixed lg:static inset-y-0 left-0 z-50 w-64 lg:h-full bg-gradient-to-b from-[#2D2A3E] to-[#1E1B2E] text-white transform transition-transform duration-300 lg:flex-shrink-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
              <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={24} height={24}/>
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">SkinAura</h1>
              <p className="text-xs text-[#CFAFA3]">PRO</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {CLIENT_NAV_ITEMS.map(item => (
            <Link
              key={item.id}
              to={`/client/${item.id}`}
              onClick={() => onNavigateToView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeView === item.id
                  ? 'bg-gradient-to-r from-[#CFAFA3]/20 to-transparent text-[#CFAFA3] border-l-2 border-[#CFAFA3]'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium flex-1">{item.label}</span>
              {item.id === 'notifications' && unreadNotifications > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Level Progress */}
        <div className="p-4 m-4 rounded-xl bg-gradient-to-br from-[#CFAFA3]/20 to-transparent border border-[#CFAFA3]/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-[#CFAFA3]" />
            <span className="text-sm font-medium">{clientStats.level} Level</span>
          </div>
          <p className="text-xs text-white/60 mb-2">{clientStats.points.toLocaleString()} points</p>
          {levelInfo.next ? (
            <>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-xs text-white/50">{pointsToNextLevel.toLocaleString()} pts to {levelInfo.next.name}</p>
            </>
          ) : (
            <>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] rounded-full"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-xs text-white/50">Max level reached!</p>
            </>
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <EncryptedImage
              src={userAvatar}
              alt={userDisplayName}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#CFAFA3]/50"
              fallbackClassName="w-10 h-10 rounded-full border-2 border-[#CFAFA3]/50"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userDisplayName}</p>
              <p className="text-xs text-[#CFAFA3]">Client</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ClientSidebar;

