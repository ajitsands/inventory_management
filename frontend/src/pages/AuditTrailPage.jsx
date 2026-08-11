import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { formatDate } from '../utils/date';
import { ShieldAlert } from 'lucide-react';
import { MODULE_BADGES } from '../theme/colors';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await apiFetch('/audit/logs');
        setLogs(data.logs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

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
      render: (l) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{l.action}</span>
    },
    {
      header: 'User & Role',
      accessor: 'username',
      render: (l) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{l.username}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">Role: {l.role}</span>
        </div>
      )
    },
    {
      header: 'IP Address',
      accessor: 'ip_address',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono">{l.ip_address || '127.0.0.1'}</span>
    },
    {
      header: 'New Payload Values',
      accessor: 'new_values',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate max-w-xs block">{l.new_values || '-'}</span>
    }
  ];

  return (
    <div className="space-y-6">
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

      {/* Pure White DataTable */}
      <DataTable
        title="System Event Audit Trail Grid"
        columns={auditColumns}
        data={logs}
        searchable={true}
        defaultPageSize={10}
      />
    </div>
  );
}
