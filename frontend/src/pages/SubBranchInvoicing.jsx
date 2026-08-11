import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { GitPullRequest, Plus, Trash2, CheckCircle2, AlertCircle, Receipt } from 'lucide-react';

export default function SubBranchInvoicing() {
  const [subBranches, setSubBranches] = useState([]);
  const [mainBatches, setMainBatches] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLine()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  function createEmptyLine() {
    return { batch_id: '', item_id: '', qty: 1, unit_price: 0, available: 0, batch_code: '' };
  }

  const loadData = async () => {
    try {
      const [masterData, batchData, transferData] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/stock/location?location_id=1'), // Main Store
        apiFetch('/transfer/list')
      ]);

      const subs = (masterData.locations || []).filter(l => l.type === 'SUB_BRANCH');
      setSubBranches(subs);
      if (subs.length > 0) setToLocationId(subs[0].id);

      setMainBatches(batchData.batches || []);
      setTransfers((transferData.transfers || []).filter(t => t.transfer_type === 'BRANCH_INVOICED'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBatchSelect = (index, batchId) => {
    const selected = mainBatches.find(b => b.batch_id == batchId);
    const updated = [...lineItems];
    if (selected) {
      updated[index] = {
        batch_id: selected.batch_id,
        item_id: selected.item_id,
        batch_code: selected.batch_code,
        unit_price: selected.selling_price,
        available: selected.quantity_available,
        qty: 1
      };
    } else {
      updated[index] = createEmptyLine();
    }
    setLineItems(updated);
  };

  const handleQtyChange = (index, qty) => {
    const updated = [...lineItems];
    updated[index].qty = parseInt(qty || 1);
    setLineItems(updated);
  };

  const addLine = () => setLineItems([...lineItems, createEmptyLine()]);
  const removeLine = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => lineItems.reduce((acc, l) => acc + (parseFloat(l.unit_price || 0) * parseInt(l.qty || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!toLocationId) {
      setMessage({ type: 'error', text: 'Select a destination Sub Branch.' });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const l = lineItems[i];
      if (!l.batch_id || !l.qty || l.qty <= 0) {
        setMessage({ type: 'error', text: `Please select a batch and valid quantity for line item #${i + 1}.` });
        return;
      }
      if (l.qty > l.available) {
        setMessage({ type: 'error', text: `Line #${i + 1}: Qty (${l.qty}) exceeds available stock (${l.available}) in Main Store!` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        from_location_id: 1, // Main Branch
        to_location_id: toLocationId,
        remarks: remarks,
        items: lineItems
      };

      const res = await apiFetch('/transfer/branch', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Invoiced Stock Transfer ${res.transfer_no} (Invoice #${res.invoice_no}) issued to Sub Branch successfully!` });
        setLineItems([createEmptyLine()]);
        setRemarks('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      header: 'Transfer Ref #',
      accessor: 'transfer_no',
      render: (t) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{t.transfer_no}</span>
    },
    {
      header: 'Internal Invoice #',
      accessor: 'invoice_no',
      render: (t) => <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{t.invoice_no || 'N/A'}</span>
    },
    {
      header: 'From Location',
      accessor: 'from_location_name',
      render: (t) => <span className="text-slate-700 dark:text-slate-300 font-medium">{t.from_location_name}</span>
    },
    {
      header: 'To Sub-Branch',
      accessor: 'to_location_name',
      render: (t) => <span className="font-bold text-slate-900 dark:text-slate-100">{t.to_location_name}</span>
    },
    {
      header: 'Total Invoice Val',
      accessor: 'total_val',
      render: (t) => <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(t.total_val || 0).toFixed(2)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (t) => (
        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold">
          {t.status}
        </span>
      )
    },
    {
      header: 'Dispatched At',
      accessor: 'dispatched_at',
      render: (t) => <span className="text-slate-500 dark:text-slate-400 font-mono">{t.dispatched_at}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Main Branch ➔ Sub-Branch Invoiced Stock Transfer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Issue official internal invoices and dispatch inventory from Central Main Store to Regional Sub-Branches</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 text-xs font-bold flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Invoicing Required
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

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Source Location</label>
            <input
              type="text"
              disabled
              value="Central Main Warehouse & Branch (Hub)"
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-brand-blue font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Sub-Branch *</label>
            <select
              required
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            >
              {subBranches.map(sb => (
                <option key={sb.id} value={sb.id}>{sb.name} ({sb.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Stock Transfer Items (Main Store Available Batches)</h3>
            <button
              type="button"
              onClick={addLine}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 text-xs font-semibold hover:bg-cyan-200 dark:hover:bg-cyan-900/40 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Batch Item
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Select Main Store Batch *</th>
                  <th className="p-3.5">Batch Code</th>
                  <th className="p-3.5">Main Store Avail Qty</th>
                  <th className="p-3.5 w-32">Unit Invoice Price ($)</th>
                  <th className="p-3.5 w-28">Transfer Qty *</th>
                  <th className="p-3.5 w-32 text-right">Subtotal ($)</th>
                  <th className="p-3.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, idx) => {
                  const lineSubtotal = (parseFloat(line.unit_price || 0) * parseInt(line.qty || 0)).toFixed(2);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                      <td className="p-2.5">
                        <select
                          required
                          value={line.batch_id}
                          onChange={(e) => handleBatchSelect(idx, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:border-brand-blue"
                        >
                          <option value="">-- Select Available Batch --</option>
                          {mainBatches.map(b => (
                            <option key={b.batch_id} value={b.batch_id}>
                              {b.item_name} | Batch: {b.batch_code} (Exp: {b.expiry_date}) [Avail: {b.quantity_available}]
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-300">{line.batch_code || '-'}</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-200">{line.available || 0} units</td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-200">${line.unit_price || '0.00'}</td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min="1"
                          max={line.available || 9999}
                          required
                          value={line.qty}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">${lineSubtotal}</td>

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
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Internal Invoice Valuation:</p>
            <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-heading">${calculateTotal().toFixed(2)}</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Issue Branch Invoice & Transfer Stock
              </>
            )}
          </button>
        </div>
      </form>

      {/* Branch Transfer History DataTable */}
      <DataTable
        title="Branch Invoiced Stock Transfer History"
        subtitle="Search and sort issued branch stock invoices and dispatches"
        columns={historyColumns}
        data={transfers}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
