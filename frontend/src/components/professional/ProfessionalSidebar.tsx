import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Camera,
  Clock,
  ClipboardList,
  BarChart3,
  Package,
  HelpCircle,
  Bell,
  LucideIcon,
} from 'lucide-react';
import EncryptedImage from '../ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface ProfessionalSidebarProps {
  sidebarOpen: boolean;
  activeView: string;
  onNavigateToView: (viewId: string) => void;
  userDisplayName: string;
  userAvatar?: string;
  totalClients?: number;
  unreadNotifications?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROFESSIONAL_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'clients', label: 'My Clients', icon: Users },
  { id: 'photos', label: 'Client Photos', icon: Camera },
  { id: 'routines', label: 'Manage Routines', icon: Clock },
  { id: 'treatments', label: 'Treatment Plans', icon: ClipboardList },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'products', label: 'Product Library', icon: Package },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'help', label: 'Help & FAQ', icon: HelpCircle },
];


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate initials from a display name
 * @param name - The full name to generate initials from
 * @returns Up to 2 character initials
 */
const getInitials = (name: string): string => {
  if (!name) return 'U';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    // Single name - take first two characters
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  // Multiple names - take first character of first and last name
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ============================================================================
// COMPONENT
// ============================================================================

const ProfessionalSidebar: React.FC<ProfessionalSidebarProps> = ({
  sidebarOpen,
  activeView,
  onNavigateToView,
  userDisplayName,
  userAvatar,
  totalClients = 0,
  unreadNotifications = 0,
}) => {
  const initials = getInitials(userDisplayName);

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
          {PROFESSIONAL_NAV_ITEMS.map(item => (
            <Link
              key={item.id}
              to={`/professional/${item.id}`}
              onClick={() => onNavigateToView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeView === item.id
                  ? 'bg-gradient-to-r from-[#CFAFA3]/20 to-transparent text-[#CFAFA3] border-l-2 border-[#CFAFA3]'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {item.id === 'notifications' && unreadNotifications > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
          ))}
        </nav>


        {/* Stats Card - Always show */}
        <div className="p-4 m-4 rounded-xl bg-gradient-to-br from-[#CFAFA3]/20 to-transparent border border-[#CFAFA3]/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-[#CFAFA3]" />
            <span className="text-sm font-medium">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-white">{totalClients}</p>
          <p className="text-xs text-white/50">Manage your client base</p>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            {userAvatar ? (
              <EncryptedImage
                src={userAvatar}
                alt={userDisplayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#CFAFA3]/30" 
                fallbackClassName="w-9 h-9 rounded-full border-2 border-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#CFAFA3] flex items-center justify-center text-[#2D2A3E] font-semibold text-sm">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userDisplayName}</p>
              <p className="text-xs text-[#CFAFA3] capitalize">Professional</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ProfessionalSidebar;
