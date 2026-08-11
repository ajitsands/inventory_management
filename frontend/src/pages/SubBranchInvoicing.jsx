import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { GitPullRequest, Plus, Trash2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

export default function SubBranchInvoicing() {
  const [subBranches, setSubBranches] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  function createEmptyLine() {
    return {
      item_id: '',
      batch_id: '',
      unit_price: '0.00',
      max_qty: 0,
      qty: 1
    };
  }

  const loadData = async () => {
    try {
      const [locationsRes, stockRes, transferRes, settingsRes] = await Promise.all([
        apiFetch('/locations'),
        apiFetch('/stock/location?location_id=1'), // Main Branch stock
        apiFetch('/transfer/list'),
        apiFetch('/settings')
      ]);
      const branches = (locationsRes.locations || []).filter(l => l.type === 'SUB_BRANCH');
      setSubBranches(branches);
      setAvailableStock(stockRes.batches || []);
      setTransfers(transferRes.transfers || []);
      if (settingsRes.settings) {
        setSettings(settingsRes.settings);
      }

      if (branches.length > 0) {
        setToLocationId(branches[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;

  const handleLineChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    if (field === 'batch_id') {
      const selectedBatch = availableStock.find(b => b.batch_id == value || b.id == value);
      if (selectedBatch) {
        updated[index].item_id = selectedBatch.item_id;
        updated[index].unit_price = selectedBatch.purchase_price || selectedBatch.selling_price;
        updated[index].max_qty = selectedBatch.quantity_available;
      }
    }
    setLineItems(updated);
  };

  const addLine = () => setLineItems([...lineItems, createEmptyLine()]);
  const removeLine = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => lineItems.reduce((acc, line) => acc + (parseFloat(line.unit_price || 0) * parseInt(line.qty || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!toLocationId) {
      setMessage({ type: 'error', text: 'Please select a destination Sub-Branch.' });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.batch_id || !line.qty) {
        setMessage({ type: 'error', text: `Please select a batch and quantity for line item #${i + 1}.` });
        return;
      }
      if (line.qty > line.max_qty) {
        setMessage({ type: 'error', text: `Line #${i + 1} quantity (${line.qty}) exceeds available stock (${line.max_qty}).` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        from_location_id: 1, // Central Main Store
        to_location_id: toLocationId,
        remarks: remarks,
        items: lineItems
      };

      const res = await apiFetch('/transfer/branch', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Branch Invoice ${res.invoice_no} (${res.transfer_no}) generated successfully!` });
        setLineItems([createEmptyLine()]);
        setRemarks('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Branch transfer failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      header: 'Branch Transfer Invoice #',
      accessor: 'invoice_no',
      render: (t) => <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{t.invoice_no || t.transfer_no}</span>
    },
    {
      header: 'Source ➔ Destination',
      accessor: 'from_location_name',
      render: (t) => (
        <span className="text-slate-800 dark:text-slate-200 text-xs font-semibold">
          {t.from_location_name} ➔ <strong className="text-brand-blue">{t.to_location_name}</strong>
        </span>
      )
    },
    {
      header: `Invoiced Value (${currencyCode})`,
      accessor: 'total_val',
      render: (t) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(t.total_val, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Dispatched By',
      accessor: 'created_by_name',
      render: (t) => <span className="text-slate-600 dark:text-slate-400">{t.created_by_name}</span>
    },
    {
      header: 'Dispatched Date',
      accessor: 'dispatched_at',
      render: (t) => <span className="text-slate-500 dark:text-slate-400 font-mono">{formatDate(t.dispatched_at)}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            Main Store ➔ Regional Sub-Branch Invoiced Stock Transfer
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dispatch stock batches from Central Warehouse to Regional Sub-Branches with internal transfer invoicing in {currencyCode}</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 text-xs font-bold">
          Central Warehouse Dispatch
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-2">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Transfer Invoice Header Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Sub-Branch (Select2 Search) *</label>
            <SearchableSelect
              placeholder="Search Sub-Branch..."
              options={subBranches.map(b => ({ value: b.id, label: b.name, sublabel: `Code: ${b.code}` }))}
              value={toLocationId}
              onChange={(val) => setToLocationId(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transfer Remarks / Dispatch Note</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Weekly Regional Branch Replenishment"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Dispatch Stock Batches</h3>
            <button
              type="button"
              onClick={addLine}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-100 text-cyan-700 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 text-xs font-semibold hover:brightness-110 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Batch Line
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 w-96">Available Main Store Stock Batch (Select2 Search) *</th>
                  <th className="p-3.5 w-32">Unit Cost ({currencyCode})</th>
                  <th className="p-3.5 w-28">Available Stock</th>
                  <th className="p-3.5 w-28">Transfer Qty *</th>
                  <th className="p-3.5 w-36 text-right">Line Total ({currencyCode})</th>
                  <th className="p-3.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, index) => {
                  const lineTotal = (parseFloat(line.unit_price || 0) * parseInt(line.qty || 0));
                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                      <td className="p-2.5">
                        <SearchableSelect
                          placeholder="Search Stock Batch..."
                          options={availableStock.map(b => ({
                            value: b.batch_id || b.id,
                            label: `${b.item_name} (${b.batch_code})`,
                            sublabel: `Avail: ${b.quantity_available} units • Expiry: ${b.expiry_date}`
                          }))}
                          value={line.batch_id}
                          onChange={(val) => handleLineChange(index, 'batch_id', val)}
                        />
                      </td>

                      <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrency(line.unit_price, currencyCode, decimalPlaces)}
                      </td>

                      <td className="p-3.5 font-bold text-slate-600 dark:text-slate-400">
                        {line.max_qty} units
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min="1"
                          max={line.max_qty}
                          required
                          value={line.qty}
                          onChange={(e) => handleLineChange(index, 'qty', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(lineTotal, currencyCode, decimalPlaces)}
                      </td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                          title="Remove Line"
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Invoiced Transfer Value:</p>
            <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 font-heading">{formatCurrency(calculateTotal(), currencyCode, decimalPlaces)}</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-xs shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Dispatch Transfer & Issue Branch Invoice
              </>
            )}
          </button>
        </div>
      </form>

      {/* History */}
      <DataTable
        title="Sub-Branch Transfer Invoices History"
        columns={historyColumns}
        data={transfers}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
