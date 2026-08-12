import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { Boxes, Building2 } from 'lucide-react';

export default function BatchInventory() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [batches, setBatches] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);

  const fetchStock = async (locId) => {
    if (!locId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/stock/location?location_id=${encodeURIComponent(locId)}`);
      setBatches(data.batches || []);
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
        if (locs.length > 0) {
          const initialLocVal = locs[0].raw_id || locs[0].id;
          setSelectedLocation(initialLocVal);
          fetchStock(initialLocVal);
        }
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

  const handleLocationChange = (locId) => {
    setSelectedLocation(locId);
    fetchStock(locId);
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
      render: (b) => <span className="font-mono font-bold text-brand-blue">{b.batch_code}</span>
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
      header: `MRP (${currencyCode})`,
      accessor: 'mrp',
      render: (b) => <span className="text-slate-500 dark:text-slate-400 font-mono">{formatCurrency(b.mrp, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Expiry Date',
      accessor: 'expiry_date',
      render: (b) => {
        const isExpiringSoon = new Date(b.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isExpiringSoon ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40' : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}>
            {formatDate(b.expiry_date)}
          </span>
        );
      }
    },
    {
      header: 'Available Qty',
      accessor: 'quantity_available',
      className: 'text-right',
      render: (b) => (
        <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold font-mono text-slate-900 dark:text-slate-100">
          {b.quantity_available}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-blue" />
            Location Batch Stock Inspector
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Inspect real-time batch stock balances, cost price, selling price, and expiry timelines in {currencyCode}</p>
        </div>

        {/* Searchable Location Selector */}
        <div className="flex items-center space-x-2 w-80">
          <Building2 className="w-4 h-4 text-brand-blue shrink-0" />
          <SearchableSelect
            placeholder="Search Location..."
            options={locations.map(l => ({ value: l.raw_id || l.id, label: `${l.name} (${l.type})`, sublabel: `Location Code: ${l.code}` }))}
            value={selectedLocation}
            onChange={(val) => handleLocationChange(val)}
          />
        </div>
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
    </div>
  );
}
