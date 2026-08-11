import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { ShieldAlert, Search, Terminal, User, Clock, Filter } from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.module?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = selectedModule === 'ALL' || l.module === selectedModule;
    return matchesSearch && matchesModule;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-400" />
            System Immutable Audit Trail
          </h2>
          <p className="text-xs text-slate-400">Complete, tamper-evident audit logging for all user transactions, batch changes, and stock operations</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 text-xs font-bold">
          Immutable Audit Engine
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail by user, action, or module..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-purple-400" />
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:border-brand-blue"
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
      </div>

      {/* Audit Logs Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading audit trail records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No audit log records found.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Action Event</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3 text-center">Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-900/60 transition-all">
                    <td className="p-3 text-slate-400 font-mono">{l.timestamp}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-200">{l.username}</span>
                      <span className="text-[10px] text-slate-400 block">{l.role}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-bold text-purple-300 text-[10px]">
                        {l.module}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{l.action}</td>
                    <td className="p-3 text-slate-400 font-mono">{l.ip_address}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-purple-400 hover:bg-purple-950/40 text-[10px] font-bold transition-all"
                      >
                        Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 w-full max-w-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 font-heading flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                Audit Trail Event Payload Inspector
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-100 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p><span className="text-slate-400">Action:</span> <strong className="text-slate-200">{selectedLog.action}</strong></p>
              <p><span className="text-slate-400">User:</span> <strong className="text-slate-200">{selectedLog.username} ({selectedLog.role})</strong></p>
              <p><span className="text-slate-400">Time:</span> <strong className="text-slate-200">{selectedLog.timestamp}</strong></p>
            </div>

            {selectedLog.new_values && (
              <div>
                <p className="text-xs font-semibold text-purple-300 mb-1">Event Data Payload (JSON):</p>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
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
