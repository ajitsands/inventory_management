import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { Stethoscope, Plus, Trash2, CheckCircle2, AlertCircle, ShoppingBag, Sparkles } from 'lucide-react';

export default function ClinicSalesPOS() {
  const [clinics, setClinics] = useState([]);
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);

  const [clinicLocationId, setClinicLocationId] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discount, setDiscount] = useState(0);

  const [cartItems, setCartItems] = useState([createEmptyCartItem()]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [fifoResult, setFifoResult] = useState(null);

  function createEmptyCartItem() {
    return { item_id: '', qty: 1, unit_price: '' };
  }

  const loadData = async () => {
    try {
      const [masterData, salesData] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/sales/list')
      ]);

      const clns = (masterData.locations || []).filter(l => l.type === 'CLINIC');
      setClinics(clns);
      if (clns.length > 0) setClinicLocationId(clns[0].id);

      setItems(masterData.items || []);
      setSales(salesData.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemSelect = (idx, itemId) => {
    const selected = items.find(i => i.id == itemId);
    const updated = [...cartItems];
    updated[idx].item_id = itemId;
    if (selected) {
      updated[idx].unit_price = selected.selling_price || 20.00;
    }
    setCartItems(updated);
  };

  const handleCartChange = (idx, field, val) => {
    const updated = [...cartItems];
    updated[idx][field] = val;
    setCartItems(updated);
  };

  const addCartLine = () => setCartItems([...cartItems, createEmptyCartItem()]);
  const removeCartLine = (idx) => {
    if (cartItems.length > 1) {
      setCartItems(cartItems.filter((_, i) => i !== idx));
    }
  };

  const calculateGrossTotal = () => cartItems.reduce((acc, c) => acc + (parseFloat(c.unit_price || 0) * parseInt(c.qty || 0)), 0);
  const calculateNetTotal = () => Math.max(0, calculateGrossTotal() - parseFloat(discount || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setFifoResult(null);

    if (!clinicLocationId) {
      setMessage({ type: 'error', text: 'Select a clinic outlet.' });
      return;
    }

    for (let i = 0; i < cartItems.length; i++) {
      const c = cartItems[i];
      if (!c.item_id || !c.qty || c.qty <= 0) {
        setMessage({ type: 'error', text: `Select item and valid quantity for line #${i + 1}.` });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        clinic_location_id: clinicLocationId,
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: paymentMethod,
        discount: parseFloat(discount || 0),
        items: cartItems
      };

      const res = await apiFetch('/sales/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `OPD Dispensing Invoice ${res.sales_invoice_no} completed successfully!` });
        setFifoResult(res.fifo_batches || []);
        setCartItems([createEmptyCartItem()]);
        setCustomerName('Walk-in Customer');
        setCustomerPhone('');
        setDiscount(0);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Dispensing sale failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const salesHistoryColumns = [
    {
      header: 'Sales Invoice #',
      accessor: 'sales_invoice_no',
      render: (s) => <span className="font-mono font-bold text-brand-orange">{s.sales_invoice_no}</span>
    },
    {
      header: 'Clinic Location',
      accessor: 'clinic_name',
      render: (s) => <span className="font-semibold text-slate-800 dark:text-slate-200">{s.clinic_name}</span>
    },
    {
      header: 'Customer Name',
      accessor: 'customer_name',
      render: (s) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100">{s.customer_name}</span>
          {s.customer_phone && <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{s.customer_phone}</span>}
        </div>
      )
    },
    {
      header: 'Payment Method',
      accessor: 'payment_method',
      render: (s) => <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-[10px]">{s.payment_method}</span>
    },
    {
      header: 'Net Amount',
      accessor: 'net_amount',
      render: (s) => <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(s.net_amount).toFixed(2)}</span>
    },
    {
      header: 'Dispensed By',
      accessor: 'created_by_name',
      render: (s) => <span className="text-slate-600 dark:text-slate-400">{s.created_by_name}</span>
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (s) => <span className="text-slate-500 dark:text-slate-400 font-mono">{s.created_at}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-brand-orange" />
            Clinic OPD Customer / Patient Dispensing POS (Automatic FIFO Engine)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dispense items to patients. The system automatically selects non-expired batches in order of earliest expiry & purchase date (FIFO)</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange border border-brand-orange/30 text-xs font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> FIFO Auto Allocation
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

      {/* FIFO Allocation Result Visual Box */}
      {fifoResult && fifoResult.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-brand-orange/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-brand-orange font-heading flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Automated FIFO Batch Deduction Breakdown:
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Earliest Expiry Sold First</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fifoResult.map((fb, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-900 dark:text-slate-200">
                  <span>Batch: {fb.batch_code}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{fb.qty} units</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>Exp: {fb.expiry_date}</span>
                  <span>Price: ${fb.unit_price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clinic Outlet *</label>
            <select
              required
              value={clinicLocationId}
              onChange={(e) => setClinicLocationId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            >
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Patient / Customer Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+1 555-000-0000"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="INSURANCE">Medical Insurance Claim</option>
              <option value="UPI">Digital Wallet / UPI</option>
            </select>
          </div>
        </div>

        {/* Cart Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Dispensing Items Cart</h3>
            <button
              type="button"
              onClick={addCartLine}
              className="px-3.5 py-1.5 rounded-xl bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange border border-brand-orange/30 text-xs font-semibold hover:bg-brand-orange/20 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item Line
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Select Item *</th>
                  <th className="p-3.5 w-36">Unit Price ($)</th>
                  <th className="p-3.5 w-32">Quantity *</th>
                  <th className="p-3.5 w-36 text-right">Subtotal ($)</th>
                  <th className="p-3.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {cartItems.map((c, idx) => {
                  const lineSubtotal = (parseFloat(c.unit_price || 0) * parseInt(c.qty || 0)).toFixed(2);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                      <td className="p-2.5">
                        <select
                          required
                          value={c.item_id}
                          onChange={(e) => handleItemSelect(idx, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-medium focus:border-brand-blue"
                        >
                          <option value="">-- Select Item to Dispense --</option>
                          {items.map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={c.unit_price}
                          onChange={(e) => handleCartChange(idx, 'unit_price', e.target.value)}
                          placeholder="20.00"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min="1"
                          required
                          value={c.qty}
                          onChange={(e) => handleCartChange(idx, 'qty', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100">${lineSubtotal}</td>

                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeCartLine(idx)}
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

        {/* Calculation & Submit Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center space-x-6">
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Discount Amount ($):</p>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Net Payable Amount:</p>
              <p className="text-2xl font-black text-brand-orange font-heading">${calculateNetTotal().toFixed(2)}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-xs shadow-lg glow-orange hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                Generate Sales Invoice (FIFO Deduct)
              </>
            )}
          </button>
        </div>
      </form>

      {/* OPD Sales History DataTable */}
      <DataTable
        title="Recent Clinic OPD Dispensing Invoices"
        subtitle="Search and sort customer dispensing history"
        columns={salesHistoryColumns}
        data={sales}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
