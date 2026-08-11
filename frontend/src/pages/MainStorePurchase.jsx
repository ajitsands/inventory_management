import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { ShoppingCart, Plus, Trash2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export default function MainStorePurchase() {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [vendorId, setVendorId] = useState('');
  const [poNo, setPoNo] = useState(`PO-${dateString()}-${rand4()}`);
  const [poDate, setPoDate] = useState(todayDate());
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState(`VINV-${rand4()}`);
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(todayDate());
  const [remarks, setRemarks] = useState('');

  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  function todayDate() {
    return new Date().toISOString().split('T')[0];
  }
  function dateString() {
    return new Date().toISOString().split('T')[0].replace(/-/g, '');
  }
  function rand4() {
    return Math.floor(1000 + Math.random() * 9000);
  }
  function createEmptyLine() {
    return {
      item_id: '',
      batch_code: `BTC-${dateString()}-${rand4()}`,
      purchase_price: '',
      selling_price: '',
      mrp: '',
      expiry_date: '',
      qty: 10
    };
  }

  const loadData = async () => {
    try {
      const [masterData, purchaseData] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/purchase/list')
      ]);
      setVendors(masterData.vendors || []);
      setItems(masterData.items || []);
      setPurchases(purchaseData.invoices || []);
      if (masterData.vendors && masterData.vendors.length > 0) {
        setVendorId(masterData.vendors[0].id);
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

  const handleLineChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const selectedItem = items.find(i => i.id == value);
      if (selectedItem) {
        updated[index].batch_code = `BTC-${selectedItem.item_code}-${rand4()}`;
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

  const calculateTotal = () => lineItems.reduce((acc, line) => acc + (parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!vendorId) {
      setMessage({ type: 'error', text: 'Please select a vendor/supplier.' });
      return;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.item_id || !line.purchase_price || !line.selling_price || !line.expiry_date || !line.qty) {
        setMessage({ type: 'error', text: `Please fill all required fields for line item #${i + 1}.` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        vendor_id: vendorId,
        po_no: poNo,
        po_date: poDate,
        vendor_invoice_no: vendorInvoiceNo,
        vendor_invoice_date: vendorInvoiceDate,
        remarks: remarks,
        items: lineItems
      };

      const res = await apiFetch('/purchase/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Purchase Invoice ${res.invoice_no} posted successfully to Main Store!` });
        setPoNo(`PO-${dateString()}-${rand4()}`);
        setVendorInvoiceNo(`VINV-${rand4()}`);
        setLineItems([createEmptyLine()]);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to post purchase invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      header: 'Internal Invoice #',
      accessor: 'invoice_no',
      render: (p) => <span className="font-mono font-bold text-brand-blue">{p.invoice_no}</span>
    },
    {
      header: 'PO Number & Date',
      accessor: 'po_no',
      render: (p) => (
        <div>
          <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{p.po_no}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{p.po_date}</span>
        </div>
      )
    },
    {
      header: 'Vendor Invoice #',
      accessor: 'vendor_invoice_no',
      render: (p) => <span className="font-mono text-slate-700 dark:text-slate-300">{p.vendor_invoice_no}</span>
    },
    {
      header: 'Vendor Name',
      accessor: 'vendor_name',
      render: (p) => <span className="font-semibold text-slate-900 dark:text-slate-100">{p.vendor_name}</span>
    },
    {
      header: 'Total Amount',
      accessor: 'total_amount',
      render: (p) => <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(p.total_amount).toFixed(2)}</span>
    },
    {
      header: 'Posted By',
      accessor: 'created_by_name',
      render: (p) => <span className="text-slate-600 dark:text-slate-400">{p.created_by_name}</span>
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (p) => <span className="text-slate-500 dark:text-slate-400 font-mono">{p.created_at}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-blue" />
            Main Store Vendor Purchase Invoice Entry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Receive stock from vendors, generate batch codes, and record purchase/sales price controls</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 text-xs font-bold">
          Central Main Store (Location #1)
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

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-2">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Purchase Bill Header Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Supplier / Vendor *</label>
            <select
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            >
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Purchase Order (PO) Number *</label>
            <input
              type="text"
              required
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">PO Date *</label>
            <input
              type="date"
              required
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vendor Invoice Number *</label>
            <input
              type="text"
              required
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vendor Invoice Date *</label>
            <input
              type="date"
              required
              value={vendorInvoiceDate}
              onChange={(e) => setVendorInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Remarks / Note</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Received via Express Delivery"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        {/* Pure White Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Line Items & Batch Control</h3>
            <button
              type="button"
              onClick={addLine}
              className="px-3 py-1.5 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 text-xs font-semibold hover:bg-brand-blue/20 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item Line
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Item Master *</th>
                  <th className="p-3">Batch Code *</th>
                  <th className="p-3 w-28">Purchase Price ($) *</th>
                  <th className="p-3 w-28">Sales Price ($) *</th>
                  <th className="p-3 w-28">MRP ($)</th>
                  <th className="p-3 w-36">Expiry Date *</th>
                  <th className="p-3 w-24">Qty *</th>
                  <th className="p-3 w-28 text-right">Subtotal ($)</th>
                  <th className="p-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, index) => {
                  const lineSubtotal = (parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0)).toFixed(2);
                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                      <td className="p-2">
                        <select
                          required
                          value={line.item_id}
                          onChange={(e) => handleLineChange(index, 'item_id', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        >
                          <option value="">-- Select Item --</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={line.batch_code}
                          onChange={(e) => handleLineChange(index, 'batch_code', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={line.purchase_price}
                          onChange={(e) => handleLineChange(index, 'purchase_price', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={line.selling_price}
                          onChange={(e) => handleLineChange(index, 'selling_price', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.mrp}
                          onChange={(e) => handleLineChange(index, 'mrp', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="date"
                          required
                          value={line.expiry_date}
                          onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.qty}
                          onChange={(e) => handleLineChange(index, 'qty', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                        />
                      </td>

                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        ${lineSubtotal}
                      </td>

                      <td className="p-2 text-center">
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

        {/* Total & Submit Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Bill Cost (Main Store Credit):</p>
            <p className="text-2xl font-black text-brand-blue font-heading">${calculateTotal().toFixed(2)}</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Post Purchase Bill & Create Batches
              </>
            )}
          </button>
        </div>
      </form>

      {/* Purchase Invoices History DataTable */}
      <DataTable
        title="Recent Vendor Purchase Bills Entry History"
        subtitle="Search and sort recorded vendor invoices"
        columns={historyColumns}
        data={purchases}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
