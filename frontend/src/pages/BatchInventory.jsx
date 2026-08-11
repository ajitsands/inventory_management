import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { Boxes, Building2 } from 'lucide-react';

export default function BatchInventory() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(1);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const master = await apiFetch('/master-data');
        setLocations(master.locations || []);
        if (master.locations && master.locations.length > 0) {
          setSelectedLocation(master.locations[0].id);
          fetchStock(master.locations[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const fetchStock = async (locId) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/stock/location?location_id=${locId}`);
      setBatches(data.batches || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      render: (b) => <span className="text-slate-700 dark:text-slate-300 font-medium">{b.vendor_name}</span>
    },
    {
      header: 'Cost Price ($)',
      accessor: 'purchase_price',
      render: (b) => <span className="text-slate-700 dark:text-slate-300">${parseFloat(b.purchase_price).toFixed(2)}</span>
    },
    {
      header: 'Sales Price ($)',
      accessor: 'selling_price',
      render: (b) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">${parseFloat(b.selling_price).toFixed(2)}</span>
    },
    {
      header: 'MRP ($)',
      accessor: 'mrp',
      render: (b) => <span className="text-slate-500 dark:text-slate-400">${parseFloat(b.mrp).toFixed(2)}</span>
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
            {b.expiry_date}
          </span>
        );
      }
    },
    {
      header: 'Available Qty',
      accessor: 'quantity_available',
      className: 'text-right',
      render: (b) => (
        <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-slate-100">
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Inspect real-time batch stock balances, cost price, selling price, and expiry timelines across any location</p>
        </div>

        {/* Location Selector */}
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-brand-blue" />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-brand-blue"
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>[{l.type}] {l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pure White DataTable */}
      <DataTable
        title="Batch Stock Inventory Grid (DataTable Powered)"
        subtitle="Search, filter, and sort stock batches dynamically"
        columns={batchColumns}
        data={batches}
        searchable={true}
        defaultPageSize={10}
      />
    </div>
  );
}
