import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { FileText, Plus, Trash2, CheckCircle2, AlertCircle, Lock, ShieldAlert } from 'lucide-react';

export default function VendorQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });
  const [activeTab, setActiveTab] = useState('create'); // create | open | closed
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form state
  const [vendorId, setVendorId] = useState('');
  const [quotationDate, setQuotationDate] = useState(todayDate());
  const [expectedDate, setExpectedDate] = useState(futureDate(7));
  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  // Force close modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [closeReason, setCloseReason] = useState('Order cancelled / Partial shipment accepted');

  function todayDate() {
    return new Date().toISOString().split('T')[0];
  }
  function futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  function createEmptyLine() {
    return { item_id: '', ordered_qty: 50, unit_price: '' };
  }

  const loadData = async () => {
    try {
      const [qRes, masterRes, settingsRes] = await Promise.all([
        apiFetch('/quotations'),
        apiFetch('/master-data'),
        apiFetch('/settings')
      ]);
      setQuotations(qRes.quotations || []);
      setVendors(masterRes.vendors || []);
      setItems(masterRes.items || []);
      if (settingsRes.settings) setSettings(settingsRes.settings);
      if (masterRes.vendors && masterRes.vendors.length > 0) {
        setVendorId(masterRes.vendors[0].id);
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
    setLineItems(updated);
  };

  const addLine = () => setLineItems([...lineItems, createEmptyLine()]);
  const removeLine = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = () => lineItems.reduce((acc, l) => acc + (parseFloat(l.unit_price || 0) * parseInt(l.ordered_qty || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!vendorId) {
      setMessage({ type: 'error', text: 'Please select a vendor.' });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.item_id || !line.unit_price || !line.ordered_qty) {
        setMessage({ type: 'error', text: `Please fill all required fields for line #${i + 1}.` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor_id: vendorId,
        quotation_date: quotationDate,
        expected_delivery_date: expectedDate,
        items: lineItems
      };

      const res = await apiFetch('/quotations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Quotation / PO ${res.quotation_no} generated successfully!` });
        setLineItems([createEmptyLine()]);
        setActiveTab('open');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate quotation' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceClose = async () => {
    if (!selectedQuotationId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/quotations/force-close', {
        method: 'POST',
        body: JSON.stringify({ quotation_id: selectedQuotationId, reason: closeReason })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setShowCloseModal(false);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to force-close PO' });
    } finally {
      setSubmitting(false);
    }
  };

  const openQuotations = quotations.filter(q => q.status === 'OPEN' || q.status === 'PARTIALLY_RECEIVED');
  const closedQuotations = quotations.filter(q => q.status === 'CLOSED');

  const quotationColumns = [
    {
      header: 'Quotation / PO #',
      accessor: 'quotation_no',
      render: (q) => <span className="font-mono font-bold text-brand-blue">{q.quotation_no}</span>
    },
    {
      header: 'Vendor Supplier',
      accessor: 'vendor_name',
      render: (q) => <span className="font-bold text-slate-900 dark:text-slate-100">{q.vendor_name}</span>
    },
    {
      header: 'Quotation Date',
      accessor: 'quotation_date',
      render: (q) => <span className="text-slate-600 dark:text-slate-400 text-xs font-mono">{formatDate(q.quotation_date)}</span>
    },
    {
      header: 'Total Value',
      accessor: 'total_amount',
      render: (q) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(q.total_amount, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (q) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          q.status === 'OPEN' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300' :
          q.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300' :
          'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300'
        }`}>
          {q.status}
        </span>
      )
    },
    {
      header: 'Items Progress',
      accessor: 'items',
      render: (q) => (
        <div className="space-y-1">
          {q.items.map((item, idx) => (
            <div key={idx} className="text-[11px] flex items-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-200">{item.item_name}:</span>
              <span className="font-mono font-bold text-brand-blue">{item.received_qty} / {item.ordered_qty} rec'd</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (q) => (
        q.status !== 'CLOSED' && (
          <button
            onClick={() => { setSelectedQuotationId(q.raw_id || q.id); setShowCloseModal(true); }}
            className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1"
            title="Force Close Purchase Order"
          >
            <Lock className="w-3.5 h-3.5" /> Force Close PO
          </button>
        )
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-blue" />
            Vendor Quotations & Purchase Orders Module
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Generate Vendor Quotations, auto-populate line items into Main Store Purchase entry, track partial receipts, and archive closed POs</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'create' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" /> Create Vendor Quotation / PO
        </button>

        <button
          onClick={() => setActiveTab('open')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'open' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" /> Active & Open POs ({openQuotations.length})
        </button>

        <button
          onClick={() => setActiveTab('closed')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'closed' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" /> Closed POs Archive ({closedQuotations.length})
        </button>
      </div>

      {/* Tab 1: Create Form */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-2">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Generate Vendor Quotation / Purchase Order</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Vendor / Supplier *</label>
              <SearchableSelect
                placeholder="Search Vendor..."
                options={vendors.map(v => ({ value: v.id, label: v.name, sublabel: `Code: ${v.code}` }))}
                value={vendorId}
                onChange={(val) => setVendorId(val)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quotation Date *</label>
              <input
                type="date"
                required
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Quotation Items & Quantities</h3>
              <button
                type="button"
                onClick={addLine}
                className="px-3.5 py-1.5 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 text-xs font-semibold hover:bg-brand-blue/20 transition-all flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item Line
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 w-96">Item Master (Select2 Search) *</th>
                    <th className="p-3.5 w-36">Ordered Qty *</th>
                    <th className="p-3.5 w-36">Unit Price ({currencyCode}) *</th>
                    <th className="p-3.5 w-36 text-right">Subtotal ({currencyCode})</th>
                    <th className="p-3.5 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {lineItems.map((line, index) => {
                    const subtotal = (parseFloat(line.unit_price || 0) * parseInt(line.ordered_qty || 0));
                    return (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                        <td className="p-2.5">
                          <SearchableSelect
                            placeholder="Search Item..."
                            options={items.map(i => ({ value: i.id, label: i.name, sublabel: `Code: ${i.item_code} • UOM: ${i.unit_of_measure}` }))}
                            value={line.item_id}
                            onChange={(val) => handleLineChange(index, 'item_id', val)}
                          />
                        </td>

                        <td className="p-2.5">
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.ordered_qty}
                            onChange={(e) => handleLineChange(index, 'ordered_qty', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                          />
                        </td>

                        <td className="p-2.5">
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                            placeholder="0.000"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                          />
                        </td>

                        <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(subtotal, currencyCode, decimalPlaces)}
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

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Quotation Value:</p>
              <p className="text-2xl font-black text-brand-blue font-heading">{formatCurrency(calculateTotal(), currencyCode, decimalPlaces)}</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Generate Quotation / PO
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Open POs */}
      {activeTab === 'open' && (
        <DataTable
          title="Active & Open Vendor Purchase Orders"
          subtitle="Open and partially-received quotations available to auto-populate into Main Store Purchase Entry"
          columns={quotationColumns}
          data={openQuotations}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* Tab 3: Closed POs Archive */}
      {activeTab === 'closed' && (
        <DataTable
          title="Closed Vendor Purchase Orders Archive"
          subtitle="Completely received or force-closed purchase order archive"
          columns={quotationColumns}
          data={closedQuotations}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* Force Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-600" />
                Force Close Purchase Order
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to force-close this Purchase Order? It will be archived to <strong>Closed POs</strong> and won't accept further receipts.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Closure Reason *</label>
              <input
                type="text"
                required
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-rose-600"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForceClose}
                disabled={submitting}
                className="px-6 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:brightness-110 flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Confirm Force Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
