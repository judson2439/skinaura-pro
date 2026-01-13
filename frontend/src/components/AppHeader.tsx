import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Bell,
  Flame,
  ShoppingCart,
  AlertCircle,
  TrendingUp,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { EncryptedImage } from './ui/encrypted-image';

export interface NavItem {
  id: string;
  label: string;
}

export interface ClientStats {
  currentStreak: number;
}

export interface AppHeaderProps {
  sidebarOpen?: boolean;
  toggleSidebar?: () => void;
  activeView?: string;
  navItems?: NavItem[];
  userRole: 'client' | 'professional';
  clientStats?: ClientStats;
  userDisplayName: string;
  userEmail: string;
  userAvatar?: string;
  onLogout?: () => void;
  title?: string;
  subtitle?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  sidebarOpen = false,
  toggleSidebar,
  activeView = 'dashboard',
  navItems = [],
  userRole,
  clientStats = { currentStreak: 0 },
  userDisplayName,
  userEmail,
  userAvatar,
  onLogout,
  title,
  subtitle,
}) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const displayTitle = title || navItems.find(n => n.id === activeView)?.label || 'Dashboard';
  const displaySubtitle = subtitle || (
    userRole === 'client'
      ? `${clientStats.currentStreak} day streak`
      : `Welcome back, ${userDisplayName.split(' ')[0]}`
  );

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=CFAFA3&color=2D2A3E`;

  const handleLogout = () => {
    setShowUserMenu(false);
    if (onLogout) {
      onLogout();
    } else {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="flex items-center justify-between px-4 lg:px-8 py-3">
        <div className="flex items-center gap-4">
          {toggleSidebar && (
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
              <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                SkinAura
              </h2>
              <p className="text-xs text-[#CFAFA3] font-medium uppercase tracking-wider">
                {userRole === 'professional' ? 'PRO' : 'CLIENT'}
              </p>
            </div>
          </Link>
          {/* Page Title - shown on larger screens */}
          <div className="hidden lg:block border-l border-gray-200 pl-4 ml-2">
            <h3 className="text-sm font-medium text-gray-900">
              {displayTitle}
            </h3>
            <p className="text-xs text-gray-500">{displaySubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Streak Badge (Client) */}
          {userRole === 'client' && clientStats.currentStreak > 0 && (
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-orange-600">{clientStats.currentStreak}</span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#CFAFA3] rounded-full"></span>
            </button>
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50">
                  <h3 className="font-medium mb-3">Notifications</h3>
                  <div className="space-y-3">
                    {userRole === 'client' ? (
                      <>
                        <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <Flame className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-sm">Keep it up! You're on a {clientStats.currentStreak}-day streak</p>
                            <p className="text-xs text-gray-400">Just now</p>
                          </div>
                        </div>
                        <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-[#CFAFA3]" />
                          </div>
                          <div>
                            <p className="text-sm">Time to reorder Gentle Foaming Cleanser</p>
                            <p className="text-xs text-gray-400">2 hours ago</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm">Ariel Thompson missed 4 days</p>
                            <p className="text-xs text-gray-400">Send a reminder?</p>
                          </div>
                        </div>
                        <div className="flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm">Tracy Davis reached Platinum level!</p>
                            <p className="text-xs text-gray-400">Yesterday</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <EncryptedImage
                src={userAvatar || defaultAvatar}
                alt={userDisplayName}
                className="w-8 h-8 rounded-full object-cover"
                fallbackClassName="w-8 h-8 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center"
              />
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="font-medium text-sm">{userDisplayName}</p>
                    <p className="text-xs text-gray-500">{userEmail}</p>
                  </div>
                  <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm">
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-sm text-red-600"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;

