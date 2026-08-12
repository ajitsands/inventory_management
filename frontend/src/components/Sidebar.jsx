import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  GitPullRequest,
  Building,
  Stethoscope,
  Boxes,
  FileSpreadsheet,
  ShieldAlert,
  Users,
  Layers
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  const role = user?.role || 'AUDITOR';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR'] },
    { id: 'purchase', label: 'Vendor Purchase (Main Store)', icon: ShoppingCart, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'branch-transfer', label: 'Sub-Branch Invoicing', icon: GitPullRequest, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'clinic-transfer', label: 'Clinic Stock Transfer', icon: Building, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'opd-sales', label: 'OPD Dispensing (FIFO)', icon: Stethoscope, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER'] },
    { id: 'batches', label: 'Batch Stock Inspector', icon: Boxes, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR'] },
    { id: 'audit-trail', label: 'System Audit Trail', icon: ShieldAlert, roles: ['ADMIN', 'AUDITOR'] },
    { id: 'reports', label: 'Movement Reports & Valuation', icon: FileSpreadsheet, roles: ['ADMIN', 'STORE_MANAGER', 'AUDITOR'] },
    { id: 'user-mgmt', label: 'User Management', icon: Users, roles: ['ADMIN'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 bg-white dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-4 min-h-[calc(100vh-5rem)] transition-colors duration-200">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 font-heading">
          Navigation Menu
        </div>
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Brand Watermark / Footer */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800/60 text-center">
        <div className="flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-medium">
          <Layers className="w-3.5 h-3.5 text-brand-orange" />
          <span>Pure PHP MVC + React</span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1">AES-256 Encrypted Route Security</p>
      </div>
    </aside>
  );
}
