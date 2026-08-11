import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import MovementVisualizer from '../components/MovementVisualizer';
import DataTable from '../components/common/DataTable';
import { MOVEMENT_BADGES } from '../theme/colors';
import { Package, Boxes, Building2, TrendingUp, AlertTriangle, ArrowUpRight, Activity } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const [metrics, setMetrics] = useState(null);
  const [movements, setMovements] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [masterData, valuationData, movementData, alertData] = await Promise.all([
          apiFetch('/master-data'),
          apiFetch('/reports/valuation'),
          apiFetch('/reports/movement-ledger'),
          apiFetch('/reports/expiry-alerts')
        ]);

        const itemsCount = masterData.items?.length || 0;
        const locationsCount = masterData.locations?.length || 0;

        let totalValuation = 0;
        if (valuationData.valuation) {
          totalValuation = valuationData.valuation.reduce((acc, row) => acc + parseFloat(row.total_cost_valuation || 0), 0);
        }

        setMetrics({
          itemsCount,
          locationsCount,
          totalValuation,
          vendorsCount: masterData.vendors?.length || 0
        });

        setMovements(movementData.movements || []);
        setExpiryAlerts((alertData.alerts || []).slice(0, 5));
      } catch (err) {
        console.error('Failed loading dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const movementColumns = [
    {
      header: 'Movement Type',
      accessor: 'transaction_type',
      render: (row) => {
        const badge = MOVEMENT_BADGES[row.transaction_type] || { label: row.transaction_type, color: 'text-slate-600 bg-slate-100' };
        return (
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.color}`}>
            {badge.label}
          </span>
        );
      }
    },
    {
      header: 'Item & Batch',
      accessor: 'item_name',
      render: (row) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{row.item_name}</p>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Batch: {row.batch_code}</p>
        </div>
      )
    },
    {
      header: 'Ref Number',
      accessor: 'reference_no',
      render: (row) => <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{row.reference_no}</span>
    },
    {
      header: 'Route Trajectory',
      accessor: 'from_location_name',
      render: (row) => (
        <span className="text-slate-600 dark:text-slate-300 text-[11px]">
          {row.from_location_name || 'Vendor'} ➔ {row.to_location_name || 'Customer'}
        </span>
      )
    },
    {
      header: 'Qty',
      accessor: 'qty',
      className: 'text-right',
      render: (row) => <span className="font-bold text-slate-900 dark:text-slate-100">{row.qty}</span>
    },
    {
      header: 'Timestamp',
      accessor: 'timestamp',
      render: (row) => <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{row.timestamp}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Visual Movement Pipeline */}
      <MovementVisualizer />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total System Master Items</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading mt-1">
              {metrics?.itemsCount || 0}
            </h3>
            <p className="text-[10px] text-brand-blue font-semibold mt-1">Categorized Inventory</p>
          </div>
          <div className="p-3 rounded-2xl bg-brand-blue/10 border border-brand-blue/30 text-brand-blue">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inventory Valuation (Cost)</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading mt-1">
              ${(metrics?.totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">FIFO Cost Valuation</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Organization Locations</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading mt-1">
              {metrics?.locationsCount || 0}
            </h3>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1">Main Store, Sub-Branches & Clinics</p>
          </div>
          <div className="p-3 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Registered Vendors</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-heading mt-1">
              {metrics?.vendorsCount || 0}
            </h3>
            <p className="text-[10px] text-brand-orange font-semibold mt-1">Active Suppliers</p>
          </div>
          <div className="p-3 rounded-2xl bg-brand-orange/10 border border-brand-orange/30 text-brand-orange">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: High-Performance White DataTable & Expiry Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <DataTable
            title="Live Stock Movement Trail (DataTable Powered)"
            subtitle="Real-time inventory trajectory with instant search & pagination"
            columns={movementColumns}
            data={movements}
            defaultPageSize={5}
            actions={
              <button
                onClick={() => setActiveTab('reports')}
                className="text-xs font-semibold text-brand-blue hover:underline flex items-center gap-1"
              >
                View All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />
        </div>

        {/* Right Column: Expiry Warnings */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-orange" />
              Batch Expiry Alerts
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange font-bold">
              Within 90 Days
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Scanning batch expiries...</div>
          ) : expiryAlerts.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs text-center font-semibold">
              ✓ All active stock batches are well within safe expiry limits.
            </div>
          ) : (
            <div className="space-y-2.5">
              {expiryAlerts.map((alert) => (
                <div key={alert.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-200">{alert.item_name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Batch: {alert.batch_code}</p>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                      Exp: {alert.expiry_date} ({alert.days_to_expiry} days left)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
                      {alert.total_available_qty} Qty
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
