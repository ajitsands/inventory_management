import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_BADGES } from '../theme/colors';
import { LogOut, Building2, ShieldCheck, Sun, Moon } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const roleBadge = ROLE_BADGES[user?.role] || { label: user?.role, bg: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200' };

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

      {/* Location Context, Theme Toggle & User Profile */}
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

        {/* User Info & Logout */}
        <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-800 pl-3">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.full_name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">@{user?.username}</p>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-transparent transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
