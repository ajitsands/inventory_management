import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import MovementVisualizer from '../components/MovementVisualizer';
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

        setMovements((movementData.movements || []).slice(0, 8));
        setExpiryAlerts((alertData.alerts || []).slice(0, 5));
      } catch (err) {
        console.error('Failed loading dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Visual Movement Pipeline */}
      <MovementVisualizer />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between glass-panel-hover">
          <div>
            <p className="text-xs font-semibold text-slate-400">Total System Master Items</p>
            <h3 className="text-2xl font-black text-slate-100 font-heading mt-1">
              {metrics?.itemsCount || 0}
            </h3>
            <p className="text-[10px] text-brand-blue font-semibold mt-1">Categorized Inventory</p>
          </div>
          <div className="p-3 rounded-xl bg-brand-blue/10 border border-brand-blue/30 text-brand-blue">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between glass-panel-hover">
          <div>
            <p className="text-xs font-semibold text-slate-400">Inventory Valuation (Cost)</p>
            <h3 className="text-2xl font-black text-slate-100 font-heading mt-1">
              ${(metrics?.totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[10px] text-emerald-400 font-semibold mt-1">FIFO Cost Valuation</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between glass-panel-hover">
          <div>
            <p className="text-xs font-semibold text-slate-400">Organization Locations</p>
            <h3 className="text-2xl font-black text-slate-100 font-heading mt-1">
              {metrics?.locationsCount || 0}
            </h3>
            <p className="text-[10px] text-cyan-400 font-semibold mt-1">Main Store, Sub-Branches & Clinics</p>
          </div>
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex items-center justify-between glass-panel-hover">
          <div>
            <p className="text-xs font-semibold text-slate-400">Registered Vendors</p>
            <h3 className="text-2xl font-black text-slate-100 font-heading mt-1">
              {metrics?.vendorsCount || 0}
            </h3>
            <p className="text-[10px] text-brand-orange font-semibold mt-1">Active Suppliers</p>
          </div>
          <div className="p-3 rounded-xl bg-brand-orange/10 border border-brand-orange/30 text-brand-orange">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Movements & Expiry Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Movement Feed */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-heading flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-blue" />
                Live Stock Movement Trail (Audit Logged)
              </h3>
              <p className="text-xs text-slate-400">Real-time inventory trajectory across location tiers</p>
            </div>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs font-semibold text-brand-blue hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading stock movement ledger...</div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">No stock movements recorded yet.</div>
          ) : (
            <div className="space-y-2.5">
              {movements.map((mov) => {
                const badge = MOVEMENT_BADGES[mov.transaction_type] || { label: mov.transaction_type, color: 'text-slate-400 bg-slate-800' };
                return (
                  <div key={mov.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition-all">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <div>
                        <p className="font-bold text-slate-200">{mov.item_name} <span className="text-slate-400 font-mono">({mov.batch_code})</span></p>
                        <p className="text-[11px] text-slate-400">
                          {mov.from_location_name || 'Vendor'} ➔ {mov.to_location_name || 'Customer'} • Ref: <span className="font-mono text-slate-300">{mov.reference_no}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-100">{mov.qty} units</p>
                      <p className="text-[10px] text-slate-400">{mov.timestamp}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Expiry Warnings */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 font-heading flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-orange" />
              Batch Expiry Alerts
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange font-bold">
              Within 90 Days
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Scanning batch expiries...</div>
          ) : expiryAlerts.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs text-center">
              ✓ All active stock batches are well within safe expiry limits.
            </div>
          ) : (
            <div className="space-y-2.5">
              {expiryAlerts.map((alert) => (
                <div key={alert.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-200">{alert.item_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Batch: {alert.batch_code}</p>
                    <p className="text-[10px] text-rose-400 font-semibold mt-0.5">
                      Exp: {alert.expiry_date} ({alert.days_to_expiry} days remaining)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-bold text-xs">
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
