import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { Building, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ClinicStockTransfer() {
  const [subBranches, setSubBranches] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [subBatches, setSubBatches] = useState([]);

  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  function createEmptyLine() {
    return { batch_id: '', item_id: '', qty: 1, available: 0, batch_code: '', item_name: '' };
  }

  const loadMaster = async () => {
    try {
      const masterData = await apiFetch('/master-data');
      const subs = (masterData.locations || []).filter(l => l.type === 'SUB_BRANCH');
      const clns = (masterData.locations || []).filter(l => l.type === 'CLINIC');

      setSubBranches(subs);
      setClinics(clns);

      if (subs.length > 0) {
        setFromLocationId(subs[0].id);
        fetchSubBatches(subs[0].id);
      }
      if (clns.length > 0) setToLocationId(clns[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubBatches = async (locId) => {
    try {
      const data = await apiFetch(`/stock/location?location_id=${locId}`);
      setSubBatches(data.batches || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMaster();
  }, []);

  const handleFromLocationChange = (locId) => {
    setFromLocationId(locId);
    setLineItems([createEmptyLine()]);
    fetchSubBatches(locId);
  };

  const handleBatchSelect = (idx, batchId) => {
    const selected = subBatches.find(b => b.batch_id == batchId);
    const updated = [...lineItems];
    if (selected) {
      updated[idx] = {
        batch_id: selected.batch_id,
        item_id: selected.item_id,
        batch_code: selected.batch_code,
        item_name: selected.item_name,
        available: selected.quantity_available,
        qty: 1
      };
    } else {
      updated[idx] = createEmptyLine();
    }
    setLineItems(updated);
  };

  const handleQtyChange = (idx, qty) => {
    const updated = [...lineItems];
    updated[idx].qty = parseInt(qty || 1);
    setLineItems(updated);
  };

  const addLine = () => setLineItems([...lineItems, createEmptyLine()]);
  const removeLine = (idx) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!fromLocationId || !toLocationId) {
      setMessage({ type: 'error', text: 'Select source Sub Branch and destination Clinic Outlet.' });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const l = lineItems[i];
      if (!l.batch_id || !l.qty || l.qty <= 0) {
        setMessage({ type: 'error', text: `Please select a batch and valid quantity for line #${i + 1}.` });
        return;
      }
      if (l.qty > l.available) {
        setMessage({ type: 'error', text: `Line #${i + 1}: Qty (${l.qty}) exceeds available stock (${l.available}) at Sub Branch!` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        remarks: remarks,
        items: lineItems
      };

      const res = await apiFetch('/transfer/clinic', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Clinic Stock Transfer ${res.transfer_no} completed successfully! Stock transferred with NO invoicing.` });
        setLineItems([createEmptyLine()]);
        setRemarks('');
        fetchSubBatches(fromLocationId);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Clinic transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Sub-Branch ➔ Clinic Outlet Stock Transfer (No Invoicing)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pure stock transfer between Sub-Branch regional hubs and Clinic outlets. No internal invoices generated.</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold">
          Non-Invoiced Stock Movement
        </span>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Source Sub-Branch *</label>
            <select
              required
              value={fromLocationId}
              onChange={(e) => handleFromLocationChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            >
              {subBranches.map(sb => (
                <option key={sb.id} value={sb.id}>{sb.name} ({sb.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Clinic Outlet *</label>
            <select
              required
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            >
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Select Stock Batches to Transfer</h3>
            <button
              type="button"
              onClick={addLine}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Batch Item
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Select Sub-Branch Batch *</th>
                  <th className="p-3.5">Batch Code</th>
                  <th className="p-3.5">Sub-Branch Stock Avail</th>
                  <th className="p-3.5 w-32">Transfer Qty *</th>
                  <th className="p-3.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                    <td className="p-2.5">
                      <select
                        required
                        value={line.batch_id}
                        onChange={(e) => handleBatchSelect(idx, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:border-brand-blue"
                      >
                        <option value="">-- Select Sub-Branch Batch --</option>
                        {subBatches.map(b => (
                          <option key={b.batch_id} value={b.batch_id}>
                            {b.item_name} | Batch: {b.batch_code} (Exp: {b.expiry_date}) [Avail: {b.quantity_available}]
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-300">{line.batch_code || '-'}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-slate-200">{line.available || 0} units</td>

                    <td className="p-2.5">
                      <input
                        type="number"
                        min="1"
                        max={line.available || 9999}
                        required
                        value={line.qty}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                      />
                    </td>

                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pure Inventory Transfer • No Invoicing Generated</p>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Dispatch Stock Transfer to Clinic
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
