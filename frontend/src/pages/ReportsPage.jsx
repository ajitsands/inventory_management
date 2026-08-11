import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { formatDate } from '../utils/date';
import { FileSpreadsheet, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
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

  const movementColumns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (m) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{formatDate(m.timestamp)}</span>
    },
    {
      header: 'Movement Type',
      accessor: 'transaction_type',
      render: (m) => {
        const badge = MOVEMENT_BADGES[m.transaction_type] || { label: m.transaction_type, color: 'text-slate-600 bg-slate-100' };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
            {badge.label}
          </span>
        );
      }
    },
    {
      header: 'Reference #',
      accessor: 'reference_no',
      render: (m) => <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{m.reference_no}</span>
    },
    {
      header: 'Item & Batch Code',
      accessor: 'item_name',
      render: (m) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {m.item_name} <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">({m.batch_code})</span>
        </span>
      )
    },
    {
      header: 'From Location',
      accessor: 'from_location_name',
      render: (m) => <span className="text-slate-600 dark:text-slate-300">{m.from_location_name || 'Vendor / External'}</span>
    },
    {
      header: 'To Location',
      accessor: 'to_location_name',
      render: (m) => <span className="text-slate-600 dark:text-slate-300">{m.to_location_name || 'Customer / Patient'}</span>
    },
    {
      header: 'Qty',
      accessor: 'qty',
      className: 'text-right',
      render: (m) => <span className="font-bold text-slate-900 dark:text-slate-100">{m.qty}</span>
    },
    {
      header: 'Unit Price ($)',
      accessor: 'unit_price',
      className: 'text-right',
      render: (m) => <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(m.unit_price).toFixed(2)}</span>
    }
  ];

  const expiryColumns = [
    {
      header: 'Item Name & Code',
      accessor: 'item_name',
      render: (a) => <span className="font-bold text-slate-900 dark:text-slate-100">{a.item_name} ({a.item_code})</span>
    },
    {
      header: 'Batch Code',
      accessor: 'batch_code',
      render: (a) => <span className="font-mono font-bold text-brand-blue">{a.batch_code}</span>
    },
    {
      header: 'Vendor',
      accessor: 'vendor_name',
      render: (a) => <span className="text-slate-700 dark:text-slate-300">{a.vendor_name}</span>
    },
    {
      header: 'Expiry Date',
      accessor: 'expiry_date',
      render: (a) => <span className="font-bold text-rose-600 dark:text-rose-400">{formatDate(a.expiry_date)}</span>
    },
    {
      header: 'Days Remaining',
      accessor: 'days_to_expiry',
      render: (a) => <span className="font-bold text-amber-600 dark:text-amber-400">{a.days_to_expiry} days</span>
    },
    {
      header: 'Available Qty',
      accessor: 'total_available_qty',
      className: 'text-right',
      render: (a) => <span className="font-bold text-slate-900 dark:text-slate-100">{a.total_available_qty} units</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-blue" />
            Stock Movements, Expiry & Valuation Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Auditor and Manager report hub tracking item trajectory, FIFO cost valuation, and expiry risks</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('ledger')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'ledger' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" /> Movement Ledger Trajectory
        </button>

        <button
          onClick={() => setActiveSubTab('valuation')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'valuation' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Location Stock Valuation
        </button>

        <button
          onClick={() => setActiveSubTab('expiry')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeSubTab === 'expiry' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Batch Expiry Risk
        </button>
      </div>

      {/* Subtab 1: Movement Ledger */}
      {activeSubTab === 'ledger' && (
        <DataTable
          title="Item Trajectory Movement Ledger (Vendor ➔ Main Branch ➔ Sub Branch ➔ Clinic ➔ Customer)"
          columns={movementColumns}
          data={movements}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* Subtab 2: Valuation */}
      {activeSubTab === 'valuation' && (
        <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading">
            FIFO Inventory Valuation Summary by Location Tier
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {valuation.map(v => (
              <div key={v.location_id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 glass-panel-hover space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{v.location_name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-brand-blue border border-brand-blue/30">
                    {v.location_type}
                  </span>
                </div>
                <div className="text-xs space-y-1 pt-1">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Active Stock Batches:</span>
                    <strong className="text-slate-900 dark:text-slate-200">{v.total_batches || 0} Batches</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Total Physical Units:</span>
                    <strong className="text-slate-900 dark:text-slate-200">{v.total_units || 0} Units</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-2 mt-1">
                    <span>FIFO Cost Valuation:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">${parseFloat(v.total_cost_valuation || 0).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
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
        <DataTable
          title="Near-Expiry Batch Risk Tracker (< 90 Days)"
          columns={expiryColumns}
          data={alerts}
          searchable={true}
          defaultPageSize={10}
        />
      )}
    </div>
  );
}
