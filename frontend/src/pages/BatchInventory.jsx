import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Boxes, Building2, Search, Filter, Calendar, Tag, AlertTriangle } from 'lucide-react';

export default function BatchInventory() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(1); // Default to Central Main Store
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredBatches = batches.filter(b => 
    b.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.batch_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.item_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100 font-heading flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-blue" />
            Location Batch Stock Inspector
          </h2>
          <p className="text-xs text-slate-400">Inspect real-time batch stock balances, cost price, selling price, and expiry timelines across any location</p>
        </div>

        {/* Location Selector */}
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-brand-blue" />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:border-brand-blue"
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>[{l.type}] {l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by item name, item code, or batch code..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-blue"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="font-bold text-slate-200">{filteredBatches.length}</span> active batch records
        </div>
      </div>

      {/* Batch Data Grid */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading batch stock records...</div>
        ) : filteredBatches.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No stock batches found for selected location.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Item Details</th>
                  <th className="p-3">Batch Code</th>
                  <th className="p-3">Supplier Vendor</th>
                  <th className="p-3">Cost Price ($)</th>
                  <th className="p-3">Sales Price ($)</th>
                  <th className="p-3">MRP ($)</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3 text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/50">
                {filteredBatches.map(b => {
                  const isExpiringSoon = new Date(b.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                  return (
                    <tr key={b.stock_id} className="hover:bg-slate-900/60 transition-all">
                      <td className="p-3">
                        <p className="font-bold text-slate-100">{b.item_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{b.item_code} • {b.unit_of_measure}</p>
                      </td>
                      <td className="p-3 font-mono font-bold text-brand-blue">{b.batch_code}</td>
                      <td className="p-3 text-slate-300">{b.vendor_name}</td>
                      <td className="p-3 text-slate-300">${parseFloat(b.purchase_price).toFixed(2)}</td>
                      <td className="p-3 font-semibold text-emerald-400">${parseFloat(b.selling_price).toFixed(2)}</td>
                      <td className="p-3 text-slate-400">${parseFloat(b.mrp).toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isExpiringSoon ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-300'
                        }`}>
                          {b.expiry_date}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-bold text-slate-100">
                          {b.quantity_available}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
