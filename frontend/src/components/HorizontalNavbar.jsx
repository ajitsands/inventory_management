import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Database,
  Boxes,
  Building2,
  FileText,
  ShoppingCart,
  GitPullRequest,
  Building,
  Stethoscope,
  FileSpreadsheet,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

export default function HorizontalNavbar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  const role = user?.role || 'AUDITOR';
  const [mastersOpen, setMastersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const mastersRef = useRef(null);
  const reportsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (mastersRef.current && !mastersRef.current.contains(e.target)) {
        setMastersOpen(false);
      }
      if (reportsRef.current && !reportsRef.current.contains(e.target)) {
        setReportsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userLocId = user?.location_id || user?.raw_location_id;
  const isGlobalOrMainAdmin = (role === 'ADMIN') || (!userLocId || userLocId == 1);

  const isMastersActive = activeTab === 'items' || activeTab === 'master-data';
  const isReportsActive = activeTab === 'batches' || activeTab === 'reports';
  const canSeeMasters = isGlobalOrMainAdmin && ['ADMIN', 'STORE_MANAGER'].includes(role);
  const canSeeMainStorePurchase = isGlobalOrMainAdmin && ['ADMIN', 'STORE_MANAGER'].includes(role);
  const canSeeSubBranchInvoicing = isGlobalOrMainAdmin && ['ADMIN', 'STORE_MANAGER'].includes(role);
  const canSeeClinicTransfer = ['ADMIN', 'STORE_MANAGER'].includes(role);
  const canSeeStockReturns = ['ADMIN', 'STORE_MANAGER'].includes(role);
  const canSeeReports = ['ADMIN', 'STORE_MANAGER', 'OPD_USER', 'AUDITOR'].includes(role);

  return (
    <nav className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-20 z-30 shadow-md shadow-slate-200/60 dark:shadow-slate-950/60 transition-colors duration-200 overflow-visible">
      <div className="w-full px-6 flex items-center space-x-1 py-2 overflow-visible relative">
        
        {/* 1. Dashboard */}
        <button
          onClick={() => { setActiveTab('dashboard'); setMastersOpen(false); setReportsOpen(false); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Dashboard</span>
        </button>

        {/* 2. Masters Dropdown Menu */}
        {canSeeMasters && (
          <div className="relative inline-block text-left" ref={mastersRef}>
            <button
              type="button"
              onClick={() => { setMastersOpen(!mastersOpen); setReportsOpen(false); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isMastersActive
                  ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Database className={`w-4 h-4 ${isMastersActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>Masters</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${mastersOpen ? 'rotate-180' : ''}`} />
            </button>

            {mastersOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">System Master Catalogs</span>
                </div>

                <button
                  type="button"
                  onClick={() => { setActiveTab('items'); setMastersOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs text-left font-medium transition-all ${
                    activeTab === 'items'
                      ? 'bg-brand-blue/10 text-brand-blue font-bold dark:bg-brand-blue/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Item Master & Excel Import</span>
                    <span className="text-[10px] text-slate-400">Item catalog, Min order qty & Excel upload</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab('master-data'); setMastersOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs text-left font-medium transition-all ${
                    activeTab === 'master-data'
                      ? 'bg-brand-blue/10 text-brand-blue font-bold dark:bg-brand-blue/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-brand-blue">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Master Entities</span>
                    <span className="text-[10px] text-slate-400">Vendors, Sub-Branches, Clinics & Customers</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Vendor Quotations / POs */}
        {canSeeMainStorePurchase && (
          <button
            onClick={() => { setActiveTab('quotations'); setMastersOpen(false); setReportsOpen(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'quotations'
                ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'quotations' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Vendor Quotations / POs</span>
          </button>
        )}

        {/* 4. Vendor Purchase (Main Store) */}
        {canSeeMainStorePurchase && (
          <button
            onClick={() => { setActiveTab('purchase'); setMastersOpen(false); setReportsOpen(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'purchase'
                ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <ShoppingCart className={`w-4 h-4 ${activeTab === 'purchase' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Vendor Purchase (Main Store)</span>
          </button>
        )}

        {/* 5. Sub-Branch Invoicing */}
        {canSeeSubBranchInvoicing && (
          <button
            onClick={() => { setActiveTab('branch-transfer'); setMastersOpen(false); setReportsOpen(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'branch-transfer'
                ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <GitPullRequest className={`w-4 h-4 ${activeTab === 'branch-transfer' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Sub-Branch Invoicing</span>
          </button>
        )}

        {/* 6. Clinic Stock Transfer */}
        {canSeeClinicTransfer && (
          <button
            onClick={() => { setActiveTab('clinic-transfer'); setMastersOpen(false); setReportsOpen(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'clinic-transfer'
                ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Building className={`w-4 h-4 ${activeTab === 'clinic-transfer' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Clinic Stock Transfer</span>
          </button>
        )}

        {/* 7. OPD Dispensing (FIFO) */}
        <button
          onClick={() => { setActiveTab('opd-sales'); setMastersOpen(false); setReportsOpen(false); }}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'opd-sales'
              ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
          }`}
        >
          <Stethoscope className={`w-4 h-4 ${activeTab === 'opd-sales' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>OPD Dispensing (FIFO)</span>
        </button>

        {/* 8. Stock Returns */}
        {canSeeStockReturns && (
          <button
            onClick={() => { setActiveTab('returns'); setMastersOpen(false); setReportsOpen(false); }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'returns'
                ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <RotateCcw className={`w-4 h-4 ${activeTab === 'returns' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
            <span>Stock Returns</span>
          </button>
        )}

        {/* 9. Reports Dropdown Menu */}
        {canSeeReports && (
          <div className="relative inline-block text-left" ref={reportsRef}>
            <button
              type="button"
              onClick={() => { setReportsOpen(!reportsOpen); setMastersOpen(false); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isReportsActive
                  ? 'bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white shadow-md glow-blue font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${isReportsActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>Reports</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`} />
            </button>

            {reportsOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reports & Inventory Analytics</span>
                </div>

                <button
                  type="button"
                  onClick={() => { setActiveTab('batches'); setReportsOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs text-left font-medium transition-all ${
                    activeTab === 'batches'
                      ? 'bg-brand-blue/10 text-brand-blue font-bold dark:bg-brand-blue/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Batch Stock Inspector</span>
                    <span className="text-[10px] text-slate-400">Batch balances & timeline tracker</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab('reports'); setReportsOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs text-left font-medium transition-all ${
                    activeTab === 'reports'
                      ? 'bg-brand-blue/10 text-brand-blue font-bold dark:bg-brand-blue/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold">Movement Reports & Valuation</span>
                    <span className="text-[10px] text-slate-400">Stock trajectory ledger & location valuation</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
