import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { FileSpreadsheet, Activity, AlertTriangle, TrendingUp, Download, Tag } from 'lucide-react';
import { MOVEMENT_BADGES } from '../theme/colors';

export default function ReportsPage() {
  const [activeSubTab, setActiveSubTab] = useState('ledger');
  const [movements, setMovements] = useState([]);
  const [valuation, setValuation] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const [movRes, valRes, alertRes] = await Promise.all([
          apiFetch('/reports/movement-ledger'),
          apiFetch('/reports/valuation'),
          apiFetch('/reports/expiry-alerts')
        ]);
        setMovements(movRes.movements || []);
        setValuation(valRes.valuation || []);
        setAlerts(alertRes.alerts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-blue" />
            Stock Movements, Expiry & Valuation Analytics
          </h2>
          <p className="text-xs text-slate-400">Auditor and Manager report hub tracking item trajectory, FIFO cost valuation, and expiry risks</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('ledger')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'ledger' ? 'bg-brand-blue text-white font-bold' : 'text-slate-400 hover:text-slate-200 bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" /> Movement Ledger Trajectory
        </button>

        <button
          onClick={() => setActiveSubTab('valuation')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'valuation' ? 'bg-brand-blue text-white font-bold' : 'text-slate-400 hover:text-slate-200 bg-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Location Stock Valuation
        </button>

        <button
          onClick={() => setActiveSubTab('expiry')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'expiry' ? 'bg-brand-blue text-white font-bold' : 'text-slate-400 hover:text-slate-200 bg-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Batch Expiry Risk
        </button>
      </div>

      {/* Subtab 1: Movement Ledger */}
      {activeSubTab === 'ledger' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 font-heading">
            Item Trajectory Movement Ledger (Vendor ➔ Main Branch ➔ Sub Branch ➔ Clinic ➔ Customer)
          </h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Item & Batch Code</th>
                  <th className="p-3">From Location</th>
                  <th className="p-3">To Location</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit Price ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                {movements.map(m => {
                  const badge = MOVEMENT_BADGES[m.transaction_type] || { label: m.transaction_type, color: 'text-slate-400 bg-slate-800' };
                  return (
                    <tr key={m.id} className="hover:bg-slate-900/60 transition-all">
                      <td className="p-3 text-slate-400 font-mono">{m.timestamp}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-200">{m.reference_no}</td>
                      <td className="p-3 font-medium text-slate-200">
                        {m.item_name} <span className="text-slate-400 font-mono text-[10px]">({m.batch_code})</span>
                      </td>
                      <td className="p-3 text-slate-300">{m.from_location_name || 'Vendor / External'}</td>
                      <td className="p-3 text-slate-300">{m.to_location_name || 'Customer / Patient'}</td>
                      <td className="p-3 text-right font-bold text-slate-100">{m.qty}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">${parseFloat(m.unit_price).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Valuation */}
      {activeSubTab === 'valuation' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 font-heading">
            FIFO Inventory Valuation Summary by Location Tier
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {valuation.map(v => (
              <div key={v.location_id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 glass-panel-hover space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-100 text-xs">{v.location_name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-brand-blue border border-brand-blue/30">
                    {v.location_type}
                  </span>
                </div>
                <div className="text-xs space-y-1 pt-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Active Stock Batches:</span>
                    <strong className="text-slate-200">{v.total_batches || 0} Batches</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Total Physical Units:</span>
                    <strong className="text-slate-200">{v.total_units || 0} Units</strong>
                  </div>
                  <div className="flex justify-between text-slate-400 border-t border-slate-800/60 pt-2 mt-1">
                    <span>FIFO Cost Valuation:</span>
                    <strong className="text-emerald-400 font-bold">${parseFloat(v.total_cost_valuation || 0).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Retail Sales Value (MRP):</span>
                    <strong className="text-brand-orange font-bold">${parseFloat(v.total_sales_valuation || 0).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab 3: Expiry Risk */}
      {activeSubTab === 'expiry' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 font-heading">
            Near-Expiry Batch Risk Tracker (&lt; 90 Days)
          </h3>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Item Name & Code</th>
                  <th className="p-3">Batch Code</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Days Remaining</th>
                  <th className="p-3 text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                {alerts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-900/60 transition-all">
                    <td className="p-3 font-bold text-slate-100">{a.item_name} ({a.item_code})</td>
                    <td className="p-3 font-mono font-bold text-brand-blue">{a.batch_code}</td>
                    <td className="p-3 text-slate-300">{a.vendor_name}</td>
                    <td className="p-3 font-bold text-rose-400">{a.expiry_date}</td>
                    <td className="p-3 font-bold text-amber-400">{a.days_to_expiry} days</td>
                    <td className="p-3 text-right font-bold text-slate-100">{a.total_available_qty} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
