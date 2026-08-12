import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/common/SearchableSelect';
import { Building, Plus, Trash2, CheckCircle2, AlertCircle, HelpCircle, X } from 'lucide-react';

export default function ClinicStockTransfer() {
  const { user } = useAuth();
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

      const userLocId = user?.location_id || user?.raw_location_id;
      const mySubBranch = subs.find(s => s.id == userLocId || s.raw_id == userLocId);

      if (mySubBranch) {
        setFromLocationId(mySubBranch.id);
        fetchSubBatches(mySubBranch.id, mySubBranch);
      } else if (subs.length > 0) {
        setFromLocationId(subs[0].id);
        fetchSubBatches(subs[0].id, subs[0]);
      }
      if (clns.length > 0) setToLocationId(clns[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubBatches = async (locId, locObj = null) => {
    const currentLoc = locObj || subBranches.find(s => s.id === locId);
    const queryParam = currentLoc?.raw_id || locId;
    try {
      const data = await apiFetch(`/stock/location?location_id=${encodeURIComponent(queryParam)}`);
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
    const selected = subBatches.find(b => b.batch_id == batchId || b.id == batchId);
    const updated = [...lineItems];
    if (selected) {
      updated[idx] = {
        batch_id: selected.batch_id || selected.id,
        raw_batch_id: selected.raw_batch_id || selected.raw_id || selected.batch_id || selected.id,
        item_id: selected.item_id,
        raw_item_id: selected.raw_item_id || selected.item_id,
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

  const handleKeyDownOnQty = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === lineItems.length - 1) {
        addLine();
      }
    }
  };

  const validateForm = () => {
    setMessage(null);
    if (!fromLocationId || !toLocationId) {
      setMessage({ type: 'error', text: 'Select source Sub Branch and destination Clinic Outlet.' });
      return false;
    }

    const batchTotals = {};
    const batchDuplicateCounts = {};

    lineItems.forEach(l => {
      if (l.batch_id) {
        const bId = String(l.batch_id);
        const q = parseInt(l.qty) || 0;
        batchTotals[bId] = (batchTotals[bId] || 0) + q;
        batchDuplicateCounts[bId] = (batchDuplicateCounts[bId] || 0) + 1;
      }
    });

    for (let i = 0; i < lineItems.length; i++) {
      const l = lineItems[i];
      if (!l.batch_id || !l.qty || l.qty <= 0) {
        setMessage({ type: 'error', text: `Please select a batch and valid quantity for line #${i + 1}.` });
        return false;
      }

      const bId = String(l.batch_id);
      const cumulativeQty = batchTotals[bId] || 0;
      const batchCode = l.batch_code || `Line #${i + 1}`;
      const availStock = l.available || 0;

      if (batchDuplicateCounts[bId] > 1) {
        setMessage({
          type: 'error',
          text: `Duplicate batch entry blocked: Batch '${batchCode}' is selected on multiple lines! Cumulative requested quantity (${cumulativeQty}) exceeds available stock (${availStock} units). Please combine into a single line item.`
        });
        return false;
      }

      if (cumulativeQty > availStock) {
        setMessage({
          type: 'error',
          text: `Clinic transfer blocked: Cumulative requested quantity (${cumulativeQty}) for batch '${batchCode}' exceeds available stock (${availStock} units).`
        });
        return false;
      }
    }
    return true;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const executeSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const selectedFrom = subBranches.find(s => s.id === fromLocationId || s.raw_id == fromLocationId);
      const selectedTo = clinics.find(c => c.id === toLocationId || c.raw_id == toLocationId);

      const payload = {
        from_location_id: fromLocationId,
        raw_from_location_id: selectedFrom?.raw_id,
        to_location_id: toLocationId,
        raw_to_location_id: selectedTo?.raw_id,
        remarks: remarks,
        items: lineItems.map(l => {
          const selected = subBatches.find(b => (b.batch_id || b.id) == l.batch_id);
          return {
            ...l,
            raw_item_id: selected?.raw_item_id || selected?.item_id || l.raw_item_id,
            raw_batch_id: selected?.raw_batch_id || selected?.raw_id || selected?.batch_id || selected?.id || l.raw_batch_id
          };
        })
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

  const selectedFromObj = subBranches.find(s => s.id === fromLocationId || s.raw_id == fromLocationId);
  const selectedToObj = clinics.find(c => c.id === toLocationId || c.raw_id == toLocationId);

  return (
    <div className="space-y-6 pb-12">
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

      <form onSubmit={handleOpenConfirm} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Source Sub-Branch *</label>
            <SearchableSelect
              placeholder="Search Sub-Branch..."
              options={subBranches.map(sb => ({ value: sb.id, label: `${sb.name} (${sb.code})`, sublabel: sb.type }))}
              value={fromLocationId}
              onChange={(val) => handleFromLocationChange(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Clinic Outlet *</label>
            <SearchableSelect
              placeholder="Search Clinic..."
              options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.code})`, sublabel: c.type }))}
              value={toLocationId}
              onChange={(val) => setToLocationId(val)}
            />
          </div>
        </div>

        {/* Line Items Table with SearchableSelect */}
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

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 min-h-[380px] pb-48">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 min-w-[420px]">Search & Select Sub-Branch Batch *</th>
                  <th className="p-3.5 w-36">Batch Code</th>
                  <th className="p-3.5 w-36">Sub-Branch Stock Avail</th>
                  <th className="p-3.5 w-36">Transfer Qty (Press Enter for New Row) *</th>
                  <th className="p-3.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {(() => {
                  const batchTotals = {};
                  const batchDuplicateCounts = {};

                  lineItems.forEach(l => {
                    if (l.batch_id) {
                      const bId = String(l.batch_id);
                      const q = parseInt(l.qty) || 0;
                      batchTotals[bId] = (batchTotals[bId] || 0) + q;
                      batchDuplicateCounts[bId] = (batchDuplicateCounts[bId] || 0) + 1;
                    }
                  });

                  return lineItems.map((line, idx) => {
                    const bId = String(line.batch_id || '');
                    const cumulativeQty = batchTotals[bId] || 0;
                    const maxStock = line.available || 0;
                    const isDuplicateEntry = line.batch_id && (batchDuplicateCounts[bId] > 1);
                    const isCumulativeOverStock = line.batch_id && (cumulativeQty > maxStock);
                    const isRowWarning = isDuplicateEntry || isCumulativeOverStock;

                    return (
                      <tr
                        key={idx}
                        className={`transition-all ${
                          isRowWarning
                            ? 'bg-rose-50/90 dark:bg-rose-950/60 border-2 border-rose-500'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <td className="p-2.5 min-w-[420px]">
                          <SearchableSelect
                            placeholder="Search batch or item..."
                            options={subBatches.map(b => ({
                              value: b.batch_id,
                              label: b.item_name,
                              sublabel: `Batch: ${b.batch_code} (Exp: ${b.expiry_date}) [Avail: ${b.quantity_available}]`
                            }))}
                            value={line.batch_id}
                            onChange={(val) => handleBatchSelect(idx, val)}
                          />
                          {isRowWarning && (
                            <div className="mt-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/60 p-2 rounded-lg border border-rose-300 dark:border-rose-800 animate-in fade-in duration-150">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                              <span>
                                {isDuplicateEntry && isCumulativeOverStock
                                  ? `⚠️ DUPLICATE ENTRY BLOCKED! Total requested across lines (${cumulativeQty}) EXCEEDS available stock (${maxStock} units).`
                                  : isDuplicateEntry
                                  ? `⚠️ DUPLICATE ENTRY BLOCKED! Selected multiple times (Cumulative requested: ${cumulativeQty} / Available stock: ${maxStock} units).`
                                  : `⚠️ STOCK EXCEEDED! Requested (${cumulativeQty}) exceeds available stock (${maxStock} units).`}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="p-2.5">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                            {line.batch_code || '-'}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-slate-200">{line.available || 0} units</td>

                        <td className="p-2.5">
                          <input
                            type="number"
                            min="1"
                            max={line.available || 9999}
                            required
                            value={line.qty}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            onKeyDown={(e) => handleKeyDownOnQty(e, idx)}
                            className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold ${
                              isRowWarning ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50' : 'border-slate-300 dark:border-slate-800 focus:border-brand-blue'
                            }`}
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
                    );
                  });
                })()}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">Confirm Clinic Stock Transfer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to transfer stock to clinic outlet?</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Source Sub-Branch:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedFromObj?.name || 'Source Sub-Branch'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination Clinic Outlet:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedToObj?.name || 'Destination Clinic'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold">Total Stock Line Items:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {lineItems.length} Batch Line(s)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Dispatch Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
