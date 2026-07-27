/**
 * @fileoverview Admin Header Component
 * Top navigation header for the admin dashboard.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Search,
  Bell,
  LogOut,
  BarChart3,
  Users,
  Package,
  Camera,
  ClipboardList,
  FileText,
  LayoutTemplate,
  HeartHandshake,
} from 'lucide-react';
import { AdminTabType } from './types';

interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface AdminHeaderProps {
  activeTab: AdminTabType;
  setActiveTab: (tab: AdminTabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  adminProfile?: AdminProfile | null;
  onLogout?: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  adminProfile,
  onLogout,
}) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback: clear localStorage and navigate
      localStorage.removeItem('glowplan_admin_session');
      navigate('/');
    }
  };

  const tabs = [
    { id: 'overview' as AdminTabType, label: 'Overview', icon: BarChart3 },
    { id: 'users' as AdminTabType, label: 'Users', icon: Users },
    { id: 'relationship' as AdminTabType, label: 'Relationship', icon: HeartHandshake },
    { id: 'products' as AdminTabType, label: 'Products', icon: Package },
    { id: 'routines' as AdminTabType, label: 'Routines', icon: ClipboardList },
    { id: 'routine-templates' as AdminTabType, label: 'Routine Templates', icon: LayoutTemplate },
    { id: 'progress-photos' as AdminTabType, label: 'Progress Photos', icon: Camera },
    { id: 'audit-logs' as AdminTabType, label: 'Audit Logs', icon: FileText },
  ];


  // Get initials from admin name
  const getInitials = (name: string | undefined) => {
    if (!name) return 'A';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SkinAura PRO</h1>
            <p className="text-xs text-gray-500">Admin Dashboard</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users, products, or settings..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {getInitials(adminProfile?.full_name)}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">
                {adminProfile?.full_name || 'Admin User'}
              </p>
              <p className="text-xs text-gray-500">
                {adminProfile?.email || 'Super Admin'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-xl transition-colors group"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 px-6 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-gray-900 border-gray-900'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};

export default AdminHeader;
