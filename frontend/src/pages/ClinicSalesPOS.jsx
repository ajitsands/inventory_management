import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { Stethoscope, ShoppingBag, Trash2, CheckCircle2, AlertCircle, UserCheck, Calculator, Tag, Percent } from 'lucide-react';

export default function ClinicSalesPOS() {
  const [customers, setCustomers] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [doctorName, setDoctorName] = useState('Dr. Smith (OPD)');

  const loadData = async () => {
    try {
      const [custRes, stockRes, salesRes, settingsRes] = await Promise.all([
        apiFetch('/customers'),
        apiFetch('/stock/location?location_id=4'), // Clinic OPD #1
        apiFetch('/sales/list'),
        apiFetch('/settings')
      ]);
      setCustomers(custRes.customers || []);
      setAvailableStock(stockRes.batches || []);
      setSalesInvoices(salesRes.invoices || []);

      const setts = settingsRes.settings || { vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE' };
      setSettings(setts);

      if (custRes.customers && custRes.customers.length > 0) {
        setSelectedCustomerId(custRes.customers[0].id);
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

  const addToCart = (batch) => {
    const existing = cart.find(item => item.batch_id === batch.id);
    if (existing) {
      if (existing.qty < batch.quantity_available) {
        setCart(cart.map(item => item.batch_id === batch.id ? { ...item, qty: item.qty + 1 } : item));
      } else {
        alert(`Cannot exceed available batch stock of ${batch.quantity_available} units.`);
      }
    } else {
      setCart([...cart, {
        batch_id: batch.id,
        item_id: batch.item_id,
        item_name: batch.item_name,
        batch_code: batch.batch_code,
        expiry_date: batch.expiry_date,
        selling_price: parseFloat(batch.selling_price || 0),
        max_qty: batch.quantity_available,
        vat_percent: settings.vat_percent || '10.00',
        qty: 1
      }]);
    }
  };

  const updateCartItem = (index, field, value) => {
    const updated = [...cart];
    updated[index][field] = value;
    setCart(updated);
  };

  const removeFromCart = (index) => setCart(cart.filter((_, i) => i !== index));

  // Calculations
  const isItemWiseVat = settings.vat_calculation_mode === 'ITEM_WISE';
  const defaultVatRate = parseFloat(settings.vat_percent || 10.00);

  const grossTotal = cart.reduce((acc, item) => acc + (item.selling_price * item.qty), 0);
  const discountVal = parseFloat(discountAmount || 0);
  const netSubtotalAfterDiscount = Math.max(0, grossTotal - discountVal);

  const calculateItemWiseTotalVat = () => cart.reduce((acc, item) => {
    const itemGross = item.selling_price * item.qty;
    const vatRate = parseFloat(item.vat_percent || 0);
    return acc + (itemGross * (vatRate / 100));
  }, 0);

  const totalVat = isItemWiseVat
    ? calculateItemWiseTotalVat()
    : (netSubtotalAfterDiscount * (defaultVatRate / 100));

  const grandTotal = isItemWiseVat
    ? (grossTotal + totalVat)
    : (netSubtotalAfterDiscount + totalVat);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedCustomerId) {
      setMessage({ type: 'error', text: 'Please select a patient / customer.' });
      return;
    }
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Cart is empty. Select items to dispense.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        doctor_name: doctorName,
        discount_amount: discountAmount,
        vat_calculation_mode: settings.vat_calculation_mode,
        total_vat_amount: totalVat.toFixed(2),
        total_amount: grandTotal.toFixed(2),
        items: cart.map(item => ({
          batch_id: item.batch_id,
          qty: item.qty,
          unit_price: item.selling_price,
          vat_percent: item.vat_percent
        }))
      };

      const res = await apiFetch('/sales/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Sales Invoice ${res.invoice_no} generated and stock deducted via FIFO!` });
        setCart([]);
        setDiscountAmount('0.00');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to complete POS sale' });
    } finally {
      setSubmitting(false);
    }
  };

  const invoiceColumns = [
    {
      header: 'Sales Invoice #',
      accessor: 'invoice_no',
      render: (s) => <span className="font-mono font-bold text-brand-orange">{s.invoice_no}</span>
    },
    {
      header: 'Patient / Customer',
      accessor: 'customer_name',
      render: (s) => <span className="font-semibold text-slate-900 dark:text-slate-100">{s.customer_name}</span>
    },
    {
      header: 'Clinic Location',
      accessor: 'location_name',
      render: (s) => <span className="text-slate-600 dark:text-slate-400">{s.location_name}</span>
    },
    {
      header: 'Doctor',
      accessor: 'doctor_name',
      render: (s) => <span className="text-slate-600 dark:text-slate-400 text-xs font-mono">{s.doctor_name || 'OPD Doctor'}</span>
    },
    {
      header: 'Grand Total',
      accessor: 'total_amount',
      render: (s) => <span className="font-bold text-emerald-600 dark:text-emerald-400">${parseFloat(s.total_amount).toFixed(2)}</span>
    },
    {
      header: 'Dispensed At',
      accessor: 'created_at',
      render: (s) => <span className="text-slate-500 dark:text-slate-400 font-mono">{formatDate(s.created_at)}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-brand-orange" />
            Clinic OPD Patient Sales POS & Dispensing
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Direct patient sales dispensing from clinic stock with FIFO automated deduction and Tax controls</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-xs font-bold flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" />
            VAT Mode: {isItemWiseVat ? 'Line Item Tax' : 'Total Bill Tax'}
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 text-xs font-bold">
            Clinic Outlet #1
          </span>
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

      {/* POS Grid: Left Stock Selection, Right Cart & Invoice Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Available Clinic Stock Selection */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Available Clinic OPD Stock Batches</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{availableStock.length} Batches Available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
            {availableStock.map(batch => (
              <div
                key={batch.id}
                onClick={() => addToCart(batch)}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-brand-orange dark:hover:border-brand-orange cursor-pointer transition-all space-y-2 group shadow-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-brand-orange transition-colors">
                      {batch.item_name}
                    </h4>
                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {batch.item_code}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/30">
                    {batch.batch_code}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">${parseFloat(batch.selling_price || 0).toFixed(2)}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Stock: <strong className="text-slate-800 dark:text-slate-200">{batch.quantity_available}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Checkout Cart Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs flex flex-col justify-between">
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-orange" /> Patient Sales Order Cart
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Patient / Customer *</label>
              <SearchableSelect
                placeholder="Search Patient / Customer..."
                options={customers.map(c => ({ value: c.id, label: c.name, sublabel: `Phone: ${c.phone || 'N/A'}` }))}
                value={selectedCustomerId}
                onChange={(val) => setSelectedCustomerId(val)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Attending Doctor / Physician</label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-orange"
              />
            </div>

            {/* Cart Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Item & Batch</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    {isItemWiseVat && <th className="p-2.5 w-16 text-center">VAT %</th>}
                    <th className="p-2.5 w-20 text-right">Price</th>
                    <th className="p-2.5 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {cart.map((item, index) => {
                    const itemGross = item.selling_price * item.qty;
                    const itemTax = isItemWiseVat ? (itemGross * (parseFloat(item.vat_percent || 0) / 100)) : 0;
                    const itemTotal = itemGross + itemTax;

                    return (
                      <tr key={index} className="bg-white dark:bg-slate-900">
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{item.item_name}</p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{item.batch_code}</p>
                        </td>

                        <td className="p-1 text-center">
                          <input
                            type="number"
                            min="1"
                            max={item.max_qty}
                            value={item.qty}
                            onChange={(e) => updateCartItem(index, 'qty', parseInt(e.target.value) || 1)}
                            className="w-12 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1 text-xs text-center font-bold"
                          />
                        </td>

                        {isItemWiseVat && (
                          <td className="p-1 text-center">
                            <input
                              type="number"
                              step="0.01"
                              value={item.vat_percent}
                              onChange={(e) => updateCartItem(index, 'vat_percent', e.target.value)}
                              className="w-12 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1 text-xs text-center font-bold text-brand-blue"
                            />
                          </td>
                        )}

                        <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                          ${itemTotal.toFixed(2)}
                        </td>

                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(index)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={isItemWiseVat ? 5 : 4} className="p-6 text-center text-slate-400 text-xs">
                        No items added to cart yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Summary */}
            <div className="space-y-1.5 pt-2 text-xs border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Subtotal:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">${grossTotal.toFixed(2)}</span>
              </div>

              {!isItemWiseVat && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-bold"><Tag className="w-3 h-3 text-brand-orange" /> Discount ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-0.5 text-xs text-right font-bold"
                  />
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>VAT Tax ({isItemWiseVat ? 'Item-Wise' : `${defaultVatRate}% Total`}):</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">${totalVat.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs">Grand Total Payable:</span>
                <span className="text-2xl font-black text-brand-orange font-heading">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-xs shadow-md glow-orange hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Generate Invoice & Dispense Stock
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Sales Invoices History */}
      <DataTable
        title="Recent OPD Patient Sales Invoices History"
        columns={invoiceColumns}
        data={salesInvoices}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
