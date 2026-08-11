import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { ShieldAlert, Terminal, Filter } from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

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

  const filteredLogs = logs.filter(l => selectedModule === 'ALL' || l.module === selectedModule);

  const auditColumns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{l.timestamp}</span>
    },
    {
      header: 'User & Role',
      accessor: 'username',
      render: (l) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{l.username}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{l.role}</span>
        </div>
      )
    },
    {
      header: 'Module',
      accessor: 'module',
      render: (l) => (
        <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-slate-900 border border-purple-200 dark:border-slate-800 font-bold text-purple-700 dark:text-purple-300 text-[10px]">
          {l.module}
        </span>
      )
    },
    {
      header: 'Action Event',
      accessor: 'action',
      render: (l) => <span className="font-semibold text-slate-800 dark:text-slate-200">{l.action}</span>
    },
    {
      header: 'IP Address',
      accessor: 'ip_address',
      render: (l) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{l.ip_address}</span>
    },
    {
      header: 'Payload Details',
      accessor: 'id',
      sortable: false,
      className: 'text-center',
      render: (l) => (
        <button
          onClick={() => setSelectedLog(l)}
          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 text-[10px] font-bold transition-all"
        >
          Inspect Payload
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            System Immutable Audit Trail
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Complete, tamper-evident audit logging for all user transactions, batch changes, and stock operations</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-xs font-bold">
          Immutable Audit Engine
        </span>
      </div>

      {/* Pure White DataTable */}
      <DataTable
        title="Immutable Audit Events Directory"
        subtitle="Search by user, module, or event action"
        columns={auditColumns}
        data={filteredLogs}
        searchable={true}
        defaultPageSize={10}
        actions={
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-brand-blue"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication</option>
              <option value="PURCHASE">Vendor Purchase</option>
              <option value="BRANCH_TRANSFER">Sub-Branch Invoicing</option>
              <option value="CLINIC_TRANSFER">Clinic Transfer</option>
              <option value="OPD_DISPENSING">OPD Patient Sale</option>
              <option value="USER_MGMT">User Management</option>
            </select>
          </div>
        }
      />

      {/* Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Audit Trail Event Payload Inspector
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p><span className="text-slate-500 dark:text-slate-400">Action:</span> <strong className="text-slate-900 dark:text-slate-200">{selectedLog.action}</strong></p>
              <p><span className="text-slate-500 dark:text-slate-400">User:</span> <strong className="text-slate-900 dark:text-slate-200">{selectedLog.username} ({selectedLog.role})</strong></p>
              <p><span className="text-slate-500 dark:text-slate-400">Time:</span> <strong className="text-slate-900 dark:text-slate-200">{selectedLog.timestamp}</strong></p>
            </div>

            {selectedLog.new_values && (
              <div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">Event Data Payload (JSON):</p>
                <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-60">
                  {JSON.stringify(JSON.parse(selectedLog.new_values || '{}'), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
