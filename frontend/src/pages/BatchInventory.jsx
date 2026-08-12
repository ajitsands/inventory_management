import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { MOVEMENT_BADGES } from '../theme/colors';
import {
  Boxes,
  Building2,
  Activity,
  History,
  GitCommit,
  Search,
  ShoppingCart,
  GitPullRequest,
  Building,
  Stethoscope,
  RotateCcw,
  SlidersHorizontal,
  X,
  User,
  ArrowRight,
  Tag,
  Calendar,
  Layers,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';

export default function BatchInventory() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [batches, setBatches] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);

  // Batch Timeline Tracker State
  const [searchBatchInput, setSearchBatchInput] = useState('');
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState(null);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [trackerError, setTrackerError] = useState(null);

  const fetchStock = async (locId) => {
    const ALL_BRANCHES = (locId === 0 || locId === '0');
    setLoading(true);
    try {
      const url = ALL_BRANCHES
        ? '/stock/location?raw_location_id=0'
        : `/stock/location?location_id=${encodeURIComponent(locId)}`;
      const data = await apiFetch(url);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processed = (data.batches || []).map(b => {
        if (b.expiry_date) {
          const exp = new Date(b.expiry_date);
          exp.setHours(0, 0, 0, 0);
          b.days_to_expire = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
        } else {
          b.days_to_expire = 99999;
        }
        return b;
      });

      setBatches(processed);
    } catch (err) {
      console.error(err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const [master, settingsRes] = await Promise.all([
          apiFetch('/master-data'),
          apiFetch('/settings')
        ]);
        const locs = master.locations || [];
        setLocations(locs);
        if (settingsRes.settings) {
          setSettings(settingsRes.settings);
        }
        // Default to All Branches Combined (location 0)
        setSelectedLocation(0);
        fetchStock(0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;
  const dateFormat = settings.date_format || 'DD/MM/YYYY';

  const handleLocationChange = (locId) => {
    setSelectedLocation(locId);
    fetchStock(locId);
  };

  const trackBatchByCode = async (batchCodeOrId) => {
    const q = (batchCodeOrId || searchBatchInput).trim();
    if (!q) {
      setTrackerError('Please enter or select a Batch Code to track.');
      return;
    }
    setTrackerError(null);
    setTimelineLoading(true);
    setShowTimelineModal(true);

    try {
      const res = await apiFetch(`/batches/track-timeline?batch_code=${encodeURIComponent(q)}`);
      if (res.success) {
        setTimelineData(res);
      } else {
        setTrackerError(res.message || 'No batch record found matching code.');
        setTimelineData(null);
      }
    } catch (err) {
      setTrackerError(err.message || 'Failed to fetch batch movement timeline.');
      setTimelineData(null);
    } finally {
      setTimelineLoading(false);
    }
  };

  const batchColumns = [
    {
      header: 'Item Details',
      accessor: 'item_name',
      render: (b) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{b.item_name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{b.item_code} • {b.unit_of_measure}</p>
        </div>
      )
    },
    {
      header: 'Batch Code',
      accessor: 'batch_code',
      render: (b) => (
        <button
          type="button"
          onClick={() => trackBatchByCode(b.batch_code)}
          className="font-mono font-bold text-brand-blue hover:underline focus:outline-none flex items-center gap-1 text-left"
          title="Click to view full visual movement timeline"
        >
          <GitCommit className="w-3.5 h-3.5 text-brand-blue" />
          {b.batch_code}
        </button>
      )
    },
    {
      header: 'Supplier Vendor',
      accessor: 'vendor_name',
      render: (b) => <span className="text-slate-700 dark:text-slate-300 font-medium">{b.vendor_name || 'N/A'}</span>
    },
    {
      header: `Cost Price (${currencyCode})`,
      accessor: 'purchase_price',
      render: (b) => <span className="text-slate-700 dark:text-slate-300 font-mono">{formatCurrency(b.purchase_price, currencyCode, decimalPlaces)}</span>
    },
    {
      header: `Sales Price (${currencyCode})`,
      accessor: 'selling_price',
      render: (b) => <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(b.selling_price, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Expiry Date',
      accessor: 'expiry_date',
      render: (b) => {
        const isExpiringSoon = (b.days_to_expire !== undefined ? b.days_to_expire <= 90 : false);
        return (
          <span className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold ${
            isExpiringSoon ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}>
            {formatDate(b.expiry_date, dateFormat)}
          </span>
        );
      }
    },
    {
      header: 'Days to Expire (Age)',
      accessor: 'days_to_expire',
      render: (b) => {
        const diffDays = b.days_to_expire;
        if (diffDays === undefined || diffDays === 99999) return <span className="text-slate-400 font-mono text-[11px]">-</span>;

        if (diffDays < 0) {
          const pastDays = Math.abs(diffDays);
          return (
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
              ⚠️ Expired ({pastDays}d ago)
            </span>
          );
        } else if (diffDays === 0) {
          return (
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 animate-pulse">
              🚨 Expires Today
            </span>
          );
        } else if (diffDays <= 90) {
          return (
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-extrabold font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              ⏳ {diffDays} Days Left
            </span>
          );
        } else {
          return (
            <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              🟢 {diffDays} Days Left
            </span>
          );
        }
      }
    },
    {
      header: 'Available Qty',
      accessor: 'quantity_available',
      className: 'text-right',
      render: (b) => (
        <div className="flex flex-col items-end gap-0.5">
          <span className="px-3 py-1 rounded-xl bg-brand-blue/10 border border-brand-blue/30 font-bold font-mono text-brand-blue text-sm">
            {b.quantity_available}
          </span>
          {b.location_breakdown && (
            <span className="text-[9px] text-slate-400 font-mono max-w-[180px] text-right leading-tight">
              {b.location_breakdown}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (b) => (
        <button
          type="button"
          onClick={() => trackBatchByCode(b.batch_code)}
          className="px-3 py-1.5 rounded-xl bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white border border-brand-blue/30 text-xs font-bold transition-all flex items-center gap-1 mx-auto"
        >
          <Activity className="w-3.5 h-3.5" />
          Track Timeline
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-blue" />
            Location Batch Stock Inspector & Item Timeline Tracker
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inspect real-time batch stock balances and track full item movement lifecycle timelines across all location nodes</p>
        </div>

        {/* Searchable Location Selector */}
        <div className="flex items-center space-x-2 w-80">
          <Building2 className="w-4 h-4 text-brand-blue shrink-0" />
          <SearchableSelect
            placeholder="Search Location..."
            options={[
              { value: 0, label: '🌐 All Branches Combined', sublabel: 'Sum of stock across every location' },
              ...locations.map(l => ({ value: l.raw_id || l.id, label: `${l.name} (${l.type})`, sublabel: `Location Code: ${l.code}` }))
            ]}
            value={selectedLocation}
            onChange={(val) => handleLocationChange(val)}
          />
        </div>
      </div>

      {/* Batch Code Timeline Search Bar Card */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-blue/90 to-slate-900 p-6 rounded-3xl text-white space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="text-sm font-bold font-heading uppercase tracking-wider">Track Item Movement Timeline by Batch Code</h3>
          </div>
          <span className="text-[11px] text-slate-300 font-medium">Trace complete trajectory: Purchase ➔ Sub-Branch ➔ Clinic ➔ POS Sale / Returns</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={searchBatchInput}
              onChange={(e) => setSearchBatchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && trackBatchByCode()}
              placeholder="Enter or paste Batch Code (e.g. BTC-MED-AMO-500-9468 or 1001)..."
              className="w-full bg-white/10 dark:bg-slate-950/80 border border-white/20 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold"
            />
            {searchBatchInput && (
              <button
                onClick={() => setSearchBatchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => trackBatchByCode()}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98]"
          >
            <Search className="w-4 h-4" />
            Track Item with Batch Code
          </button>
        </div>

        {/* Quick Batch Suggestions */}
        {batches.length > 0 && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
            <span className="text-[10px] text-slate-300 font-semibold uppercase">Quick Samples in Location:</span>
            {batches.slice(0, 5).map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSearchBatchInput(b.batch_code);
                  trackBatchByCode(b.batch_code);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-mono transition-all border border-white/10 whitespace-nowrap"
              >
                {b.batch_code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pure White DataTable */}
      <DataTable
        title="Batch Stock Inventory Grid (DataTable Powered)"
        subtitle={`Search, filter, and sort stock batches dynamically with ${currencyCode} prices`}
        columns={batchColumns}
        data={batches}
        searchable={true}
        defaultPageSize={10}
        minHeight="min-h-[450px]"
      />

      {/* Visual Batch Trajectory Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-5xl w-full shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-blue" />
                  Item Batch Lifecycle Timeline & Trajectory History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Complete audit log of every quantity movement, transfer, OPD sale, and return for this batch code</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowTimelineModal(false); setTimelineData(null); }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {timelineLoading ? (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-blue border-t-transparent" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Tracing batch trajectory from vendor receipt to location nodes...</p>
              </div>
            ) : trackerError ? (
              <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-300 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold block text-sm">Batch Tracking Notice</span>
                  <span>{trackerError}</span>
                </div>
              </div>
            ) : timelineData && timelineData.batch_info ? (
              <div className="space-y-6">

                {/* Batch Information Header Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Item Name & Code</span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{timelineData.batch_info.item_name}</h4>
                      <span className="text-xs font-mono text-slate-500">Item Code: {timelineData.batch_info.item_code} • UOM: {timelineData.batch_info.unit_of_measure}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-brand-blue/10 text-brand-blue border border-brand-blue/30 font-mono font-bold text-sm">
                        Batch: {timelineData.batch_info.batch_code}
                      </span>
                    </div>
                  </div>

                  {/* Financial & Expiry Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Vendor Supplier</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{timelineData.batch_info.vendor_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Cost Price / Sales Price</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(timelineData.batch_info.purchase_price, currencyCode, decimalPlaces)} / <span className="text-emerald-600">{formatCurrency(timelineData.batch_info.selling_price, currencyCode, decimalPlaces)}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Expiry Date</span>
                      <span className="font-mono font-bold text-amber-600">{formatDate(timelineData.batch_info.expiry_date, dateFormat)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Initial Stock Received</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100">{timelineData.batch_info.initial_qty || 'N/A'} units</span>
                    </div>
                  </div>
                </div>

                {/* Location Stock Nodes Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-brand-blue" />
                    Current Stock Balances Across Location Nodes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {timelineData.location_stocks && timelineData.location_stocks.length > 0 ? (
                      timelineData.location_stocks.map((loc, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{loc.location_type}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">{loc.location_name}</span>
                          <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400">Available Stock:</span>
                            <span className="font-mono font-extrabold text-brand-blue text-xs">{loc.quantity_available} units</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-4 p-3 text-center text-slate-400 text-xs">No active stock balances remaining for this batch.</div>
                    )}
                  </div>

                  {/* Sold Items Summary Box */}
                  {timelineData.sold_qty > 0 && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-brand-orange/5 border border-brand-orange/30 dark:border-brand-orange/20 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-brand-orange/20 shadow-xs">
                          <ShoppingBag className="w-4 h-4 text-brand-orange" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-brand-orange block">Sold / Dispensed to Patients</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">OPD Customer Sales (All Clinics)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-brand-orange text-base">{timelineData.sold_qty} units</span>
                        <span className="text-[10px] text-slate-400 block">
                          {Math.round((timelineData.sold_qty / (timelineData.batch_info.initial_qty || 1)) * 100)}% of initial stock
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vertical Chronological Movement Timeline */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-brand-orange" />
                      Chronological Movement Lifecycle Timeline ({timelineData.timeline?.length || 0} Events)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">Ordered from Initial Receipt to Current (Oldest ➔ Newest)</span>
                  </div>

                  <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6 py-2">
                    {timelineData.timeline && timelineData.timeline.length > 0 ? (
                      timelineData.timeline.map((step, index) => {
                        const badge = MOVEMENT_BADGES[step.transaction_type] || { label: step.transaction_type, color: 'text-slate-700 bg-slate-100' };
                        const StepIcon = step.transaction_type === 'PURCHASE' ? ShoppingCart :
                                         step.transaction_type === 'BRANCH_TRANSFER' ? GitPullRequest :
                                         step.transaction_type === 'CLINIC_TRANSFER' ? Building :
                                         step.transaction_type === 'CUSTOMER_SALE' ? Stethoscope :
                                         step.transaction_type === 'STOCK_RETURN' ? RotateCcw : Activity;

                        return (
                          <div key={index} className="relative pl-6 group">
                            {/* Timeline Node Point */}
                            <div className="absolute -left-[17px] top-1.5 p-1.5 rounded-full bg-white dark:bg-slate-900 border-2 border-brand-blue text-brand-blue group-hover:scale-110 transition-transform">
                              <StepIcon className="w-4 h-4" />
                            </div>

                            {/* Timeline Event Card */}
                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2 hover:border-brand-blue/50 transition-all">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                                    {step.reference_no}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-mono text-slate-400 text-[11px]">{formatDate(step.timestamp)}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                                <div>
                                  <span className="text-[10px] text-slate-400 block font-semibold">Location Trajectory</span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                    {step.from_location_name || 'Vendor Supplier'}
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    {step.to_location_name || 'Customer / Patient'}
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400 block font-semibold">Quantity Moved</span>
                                  <span className="font-mono font-black text-brand-blue">
                                    {step.qty} units
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400 block font-semibold">Processed By</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {step.created_by_name}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400 text-xs italic">No movement events logged for this batch yet.</div>
                    )}
                  </div>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}
    </div>
  );
}
