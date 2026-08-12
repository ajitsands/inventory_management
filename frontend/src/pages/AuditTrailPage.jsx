import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { ShieldAlert, Calendar, Filter, RefreshCw, Search, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { MODULE_BADGES } from '../theme/colors';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper for formatting YYYY-MM-DD
  const formatDateForInput = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Default to 1 week date range (7 days ago to today)
  const getInitialDates = () => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    return {
      start: formatDateForInput(sevenDaysAgo),
      end: formatDateForInput(today)
    };
  };

  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const fetchAuditLogs = async (start = startDate, end = endDate, status = statusFilter, module = moduleFilter) => {
    setLoading(true);
    try {
      let query = `/audit/logs?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`;
      if (status && status !== 'ALL') query += `&status=${encodeURIComponent(status)}`;
      if (module && module !== 'ALL') query += `&module=${encodeURIComponent(module)}`;

      const data = await apiFetch(query);
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(startDate, endDate, statusFilter, moduleFilter);
  }, []);

  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    fetchAuditLogs(startDate, endDate, statusFilter, moduleFilter);
  };

  const handlePresetChange = (preset) => {
    const today = new Date();
    let start = new Date();

    if (preset === '7DAYS') {
      start.setDate(today.getDate() - 7);
    } else if (preset === '30DAYS') {
      start.setDate(today.getDate() - 30);
    } else if (preset === 'MONTH') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'ALL') {
      start = new Date(2020, 0, 1);
    }

    const startStr = formatDateForInput(start);
    const endStr = formatDateForInput(today);

    setStartDate(startStr);
    setEndDate(endStr);
    fetchAuditLogs(startStr, endStr, statusFilter, moduleFilter);
  };

  const auditColumns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{formatDate(l.timestamp)}</span>
    },
    {
      header: 'Module Badge',
      accessor: 'module',
      render: (l) => {
        const badge = MODULE_BADGES[l.module] || { label: l.module, bg: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg}`}>
            {badge.label}
          </span>
        );
      }
    },
    {
      header: 'Action Name',
      accessor: 'action',
      render: (l) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{l.action}</span>
    },
    {
      header: 'User & Role',
      accessor: 'username',
      render: (l) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{l.username || 'System'}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Role: {l.role || 'SYSTEM'}</span>
        </div>
      )
    },
    {
      header: 'IP Address',
      accessor: 'ip_address',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">{l.ip_address || '127.0.0.1'}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (l) => {
        const isSuccess = !l.status || l.status === 'SUCCESS' || l.status === 'SUCCESSFUL';
        return (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono inline-flex items-center gap-1 ${
            isSuccess
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30'
          }`}>
            {isSuccess ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
            {isSuccess ? 'SUCCESS' : 'FAILED'}
          </span>
        );
      }
    },
    {
      header: 'New Payload Values',
      accessor: 'new_values',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate max-w-xs block">{l.new_values || '-'}</span>
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Immutable Organization System Audit Trail
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Complete, unalterable log of all user logins, vendor purchases, stock transfers, and patient dispensing sales events</p>
        </div>
      </div>

      {/* Date Range & Status Filter Card (Default 1-Week Load) */}
      <form onSubmit={handleApplyFilter} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-blue" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Date Range & Event Status Filter</h3>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => handlePresetChange('7DAYS')}
              className="px-2.5 py-1 rounded-xl bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white border border-brand-blue/30 font-bold text-[11px] transition-all"
            >
              🗓️ Last 7 Days (Default)
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('30DAYS')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-all"
            >
              📅 Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('MONTH')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-all"
            >
              📆 This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('ALL')}
              className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-all"
            >
              ♾️ All Time
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Filter</label>
            <SearchableSelect
              options={[
                { value: 'ALL', label: 'All Statuses (Success & Failed)' },
                { value: 'SUCCESS', label: '🟢 SUCCESS (Completed Operations)' },
                { value: 'FAILED', label: '🔴 FAILED (Blocked/Error Operations)' }
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Module Category</label>
            <SearchableSelect
              options={[
                { value: 'ALL', label: 'All System Modules' },
                { value: 'AUTH', label: 'User Authentication & Login' },
                { value: 'PURCHASE', label: 'Vendor Purchase' },
                { value: 'BRANCH_TRANSFER', label: 'Sub-Branch Invoicing' },
                { value: 'CLINIC_TRANSFER', label: 'Clinic Stock Transfer' },
                { value: 'OPD_DISPENSING', label: 'OPD Dispensing Sales' },
                { value: 'STOCK_RETURN', label: 'Stock Returns' },
                { value: 'USER_MGMT', label: 'User Management (RBAC)' }
              ]}
              value={moduleFilter}
              onChange={(val) => setModuleFilter(val)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:bg-brand-blue/90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Fetching Audit Trail...' : 'Apply Date & Status Filter'}
          </button>
        </div>
      </form>

      {/* Pure White DataTable with Increased Height */}
      <DataTable
        title={`System Event Audit Log Grid (${logs.length} Events Loaded)`}
        subtitle={`Showing audit trajectory events from ${startDate} to ${endDate}`}
        columns={auditColumns}
        data={logs}
        searchable={true}
        defaultPageSize={25}
        minHeight="min-h-[550px]"
      />
    </div>
  );
}
