import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import {
  Boxes,
  ShoppingCart,
  GitPullRequest,
  Stethoscope,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { MOVEMENT_BADGES } from '../theme/colors';

export default function Dashboard({ setActiveTab }) {
  const [valuation, setValuation] = useState([]);
  const [recentMovements, setRecentMovements] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [valRes, movRes, expRes, settingsRes] = await Promise.all([
          apiFetch('/reports/valuation'),
          apiFetch('/reports/movement-ledger'),
          apiFetch('/reports/expiry-alerts'),
          apiFetch('/settings')
        ]);

        setValuation(valRes.valuation || []);
        setRecentMovements(movRes.movements || []);
        setExpiryAlerts(expRes.alerts || []);
        if (settingsRes.settings) {
          setSettings(settingsRes.settings);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;

  const totalOrgCostValuation = valuation.reduce((acc, v) => acc + parseFloat(v.total_cost_valuation || 0), 0);
  const totalOrgSalesValuation = valuation.reduce((acc, v) => acc + parseFloat(v.total_sales_valuation || 0), 0);
  const totalBatches = valuation.reduce((acc, v) => acc + parseInt(v.total_batches || 0), 0);

  const movementColumns = [
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (m) => <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{formatDate(m.timestamp)}</span>
    },
    {
      header: 'Type',
      accessor: 'transaction_type',
      render: (m) => {
        const type = (!m.transaction_type && m.reference_no?.startsWith('RET-')) ? 'STOCK_RETURN' : m.transaction_type;
        const badge = MOVEMENT_BADGES[type] || { label: type || 'Unknown', color: 'text-slate-600 bg-slate-100' };
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
      header: 'Item & Batch',
      accessor: 'item_name',
      render: (m) => (
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {m.item_name} <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">({m.batch_code})</span>
        </span>
      )
    },
    {
      header: 'From ➔ To Location',
      accessor: 'from_location_name',
      render: (m) => (
        <span className="text-slate-600 dark:text-slate-300 text-xs">
          {m.from_location_name || 'Vendor'} ➔ {m.to_location_name || 'Customer'}
        </span>
      )
    },
    {
      header: 'Qty',
      accessor: 'qty',
      className: 'text-right',
      render: (m) => <span className="font-bold text-slate-900 dark:text-slate-100">{m.qty}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-heading">
            Organization Inventory Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Central Main Store • Regional Sub-Branches • Clinic OPD Dispensing Outlets
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('purchase')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white text-xs font-bold shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Receive Vendor PO
          </button>
          <button
            onClick={() => setActiveTab('opd-sales')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-orange to-amber-600 text-white text-xs font-bold shadow-md glow-orange hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-1.5"
          >
            <Stethoscope className="w-3.5 h-3.5" /> Patient POS
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Stock Valuation</span>
            <div className="p-2 rounded-xl bg-brand-blue/10 text-brand-blue">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Getting Price (Cost Valuation)</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatCurrency(totalOrgCostValuation, currencyCode, decimalPlaces)}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Selling Price Valuation</span>
              <p className="text-base font-black text-brand-blue dark:text-blue-400 font-mono">
                {formatCurrency(totalOrgSalesValuation, currencyCode, decimalPlaces)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Batches</span>
            <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading">
              {totalBatches}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Batch Code Price Control Active</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Expiry Risk (&lt;90 Days)</span>
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-heading">
              {expiryAlerts.length} Batches
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Requires Priority FIFO Clearance</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Location Nodes</span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading">
              {valuation.length} Locations
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">1 Main, 2 Sub, 2 Clinics</p>
          </div>
        </div>
      </div>

      {/* Main Store ➔ Sub-Branch ➔ Clinic Trajectory Grid */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Location Tier Stock Balances & Valuation Breakdown
          </h3>
          <button
            onClick={() => setActiveTab('reports')}
            className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
          >
            Full Report <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {valuation.map((loc) => (
            <div
              key={loc.location_id}
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{loc.location_name}</h4>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{loc.location_code}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  loc.location_type === 'MAIN_BRANCH' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30' :
                  loc.location_type === 'SUB_BRANCH' ? 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300' :
                  'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {loc.location_type}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Total Units</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{loc.total_units || 0} units</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Getting Price (Cost)</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                    {formatCurrency(loc.total_cost_valuation, currencyCode, decimalPlaces)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Total Selling Price</p>
                  <p className="font-bold text-brand-blue dark:text-blue-400 font-mono text-[11px]">
                    {formatCurrency(loc.total_sales_valuation, currencyCode, decimalPlaces)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pure White DataTable */}
      <DataTable
        title="Live Stock Trajectory & Movement Feed"
        columns={movementColumns}
        data={recentMovements}
        searchable={true}
        defaultPageSize={10}
      />
    </div>
  );
}
