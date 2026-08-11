import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  GitPullRequest,
  Building,
  Stethoscope,
  Boxes,
  FileSpreadsheet
} from 'lucide-react';

export default function HorizontalNavbar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  const role = user?.role || 'AUDITOR';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR'] },
    { id: 'master-data', label: 'Master Entities', icon: Building2, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'purchase', label: 'Vendor Purchase (Main Store)', icon: ShoppingCart, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'branch-transfer', label: 'Sub-Branch Invoicing', icon: GitPullRequest, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'clinic-transfer', label: 'Clinic Stock Transfer', icon: Building, roles: ['ADMIN', 'STORE_MANAGER'] },
    { id: 'opd-sales', label: 'OPD Dispensing (FIFO)', icon: Stethoscope, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER'] },
    { id: 'batches', label: 'Batch Stock Inspector', icon: Boxes, roles: ['ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR'] },
    { id: 'reports', label: 'Movement Reports & Valuation', icon: FileSpreadsheet, roles: ['ADMIN', 'STORE_MANAGER', 'AUDITOR'] }
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-16 z-30 shadow-xs transition-colors duration-200">
      <div className="w-full px-6 flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
