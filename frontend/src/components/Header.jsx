import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_BADGES } from '../theme/colors';
import { LogOut, Building2, ShieldCheck, Sun, Moon, Users, ShieldAlert, Settings, ChevronDown } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const roleBadge = ROLE_BADGES[user?.role] || { label: user?.role, bg: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200' };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (tabId) => {
    if (setActiveTab) setActiveTab(tabId);
    setDropdownOpen(false);
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between transition-colors duration-200">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center">
          <img src="/logo.png" alt="Organization Logo" className="h-8 w-auto object-contain" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading leading-tight flex items-center gap-2">
            Multi-Tier Inventory System
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
              FIFO Enabled
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Main Store • Sub-Branches • Clinics</p>
        </div>
      </div>

      {/* Right Controls: Location Badge, Theme Toggle & Top-Right Corner User Profile Menu */}
      <div className="flex items-center space-x-3">
        {/* Active Location Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
          <Building2 className="w-4 h-4 text-brand-blue" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {user?.location_name || 'Central Organization Network'}
          </span>
        </div>

        {/* User Role Badge */}
        <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${roleBadge.bg}`}>
          <ShieldCheck className="w-4 h-4" />
          <span>{roleBadge.label}</span>
        </div>

        {/* Light / Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-semibold"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline text-slate-700">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-amber-300">Light Mode</span>
            </>
          )}
        </button>

        {/* Top-Right Corner User Profile Menu Dropdown Container */}
        <div ref={dropdownRef} className="relative border-l border-slate-200 dark:border-slate-800 pl-3">
          {/* User Profile Pill Trigger */}
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center space-x-2.5 p-1.5 rounded-2xl border transition-all select-none ${
              dropdownOpen
                ? 'bg-slate-100 dark:bg-slate-800 border-brand-blue shadow-md'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1C8DCD] to-[#146ca1] text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">@{user?.username}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-brand-blue' : ''}`} />
          </button>

          {/* Floating User Profile Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute z-50 right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel divide-y divide-slate-100 dark:divide-slate-800">
              {/* Header Info */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-950/80">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{user?.full_name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">@{user?.username} • {user?.email}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleBadge.bg}`}>
                    {roleBadge.label}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    {user?.location_name || 'Central Store'}
                  </span>
                </div>
              </div>

              {/* Menu Nav Links: Store Settings, User Management & System Audit Trail */}
              <div className="p-1.5 space-y-0.5">
                {(user?.role === 'ADMIN') && (
                  <button
                    onClick={() => handleNavClick('store-settings')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'store-settings'
                        ? 'bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-brand-blue" />
                    <span>Store Settings & Prefixes</span>
                  </button>
                )}

                {(user?.role === 'ADMIN') && (
                  <button
                    onClick={() => handleNavClick('user-mgmt')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'user-mgmt'
                        ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>User Management (RBAC)</span>
                  </button>
                )}

                {(user?.role === 'ADMIN' || user?.role === 'AUDITOR') && (
                  <button
                    onClick={() => handleNavClick('audit-trail')}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'audit-trail'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>System Audit Trail</span>
                  </button>
                )}
              </div>

              {/* Logout Option */}
              <div className="p-1.5">
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-all"
                >
                  <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
