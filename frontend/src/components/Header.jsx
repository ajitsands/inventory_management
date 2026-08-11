import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_BADGES } from '../theme/colors';
import { LogOut, Building2, UserCheck, ShieldCheck } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const roleBadge = ROLE_BADGES[user?.role] || { label: user?.role, bg: 'bg-slate-800 text-slate-200' };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 shadow-inner flex items-center justify-center">
          <img src="/logo.png" alt="Organization Logo" className="h-8 w-auto object-contain" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-100 font-heading leading-tight flex items-center gap-2">
            Multi-Tier Inventory System
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
              FIFO Enabled
            </span>
          </h1>
          <p className="text-xs text-slate-400">Main Store • Sub-Branches • Clinics</p>
        </div>
      </div>

      {/* Location Context & User Profile */}
      <div className="flex items-center space-x-4">
        {/* Active Location Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
          <Building2 className="w-4 h-4 text-brand-blue" />
          <span className="font-medium text-slate-200">
            {user?.location_name || 'Central Organization Network'}
          </span>
        </div>

        {/* User Role Badge */}
        <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${roleBadge.bg}`}>
          <ShieldCheck className="w-4 h-4" />
          <span>{roleBadge.label}</span>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-3 border-l border-slate-800 pl-4">
          <div className="text-right hidden lg:block">
            <p className="text-xs font-semibold text-slate-200">{user?.full_name}</p>
            <p className="text-[11px] text-slate-400">@{user?.username}</p>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-500/40 border border-transparent transition-all flex items-center gap-1.5 text-xs font-medium"
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
