import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { Stethoscope, ShoppingBag, Trash2, CheckCircle2, AlertCircle, Calculator, Tag, Search, Plus, HelpCircle, X } from 'lucide-react';

export default function ClinicSalesPOS() {
  const [customers, setCustomers] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Search Filter State for Available Clinic Stock
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [doctorName, setDoctorName] = useState('');

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadData = async () => {
    try {
      const [custRes, stockRes, salesRes, docRes, settingsRes] = await Promise.all([
        apiFetch('/customers'),
        apiFetch('/stock/location?location_id=4'), // Clinic OPD #1
        apiFetch('/sales/list'),
        apiFetch('/doctors/by-location?location_id=4'), // Doctors for Clinic #1
        apiFetch('/settings')
      ]);
      setCustomers(custRes.customers || []);
      setAvailableStock(stockRes.batches || []);
      setSalesInvoices(salesRes.invoices || []);
      
      const docs = docRes.doctors || [];
      setClinicDoctors(docs);

      if (docs.length > 0) {
        setDoctorName(docs[0].name);
      } else {
        setDoctorName('Dr. Alexander Smith');
      }

      const setts = settingsRes.settings || { vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' };
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

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;

  // Add Item to Consumption List / Cart
  const addToCart = (batch) => {
    const batchId = batch.batch_id || batch.id;
    const existing = cart.find(item => item.batch_id === batchId);
    if (existing) {
      if (existing.qty < batch.quantity_available) {
        setCart(cart.map(item => item.batch_id === batchId ? { ...item, qty: item.qty + 1 } : item));
      } else {
        alert(`Cannot exceed available batch stock of ${batch.quantity_available} units.`);
      }
    } else {
      setCart([...cart, {
        batch_id: batchId,
        raw_batch_id: batch.raw_batch_id || batch.raw_id || batchId,
        item_id: batch.item_id,
        raw_item_id: batch.raw_item_id || batch.item_id,
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

  // Filter available stock by search query
  const filteredStock = availableStock.filter(b => {
    if (!stockSearchTerm.trim()) return true;
    const query = stockSearchTerm.toLowerCase();
    return (
      (b.item_name && b.item_name.toLowerCase().includes(query)) ||
      (b.item_code && b.item_code.toLowerCase().includes(query)) ||
      (b.batch_code && b.batch_code.toLowerCase().includes(query))
    );
  });

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

  const validateCheckout = () => {
    setMessage(null);
    if (!selectedCustomerId) {
      setMessage({ type: 'error', text: 'Please select a patient / customer.' });
      return false;
    }
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Consumption list is empty. Click available stock items to add.' });
      return false;
    }
    return true;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (validateCheckout()) {
      setShowConfirmModal(true);
    }
  };

  const executeCheckout = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const selectedCust = customers.find(c => c.id === selectedCustomerId || c.raw_id == selectedCustomerId);

      const payload = {
        clinic_location_id: 4, // Clinic OPD #1
        customer_id: selectedCustomerId,
        raw_customer_id: selectedCust?.raw_id,
        customer_name: selectedCust?.name || 'Walk-in Patient',
        doctor_name: doctorName,
        discount: discountAmount,
        vat_calculation_mode: settings.vat_calculation_mode,
        total_vat_amount: totalVat.toFixed(3),
        total_amount: grandTotal.toFixed(3),
        items: cart.map(item => ({
          item_id: item.item_id,
          raw_item_id: item.raw_item_id,
          batch_id: item.batch_id,
          raw_batch_id: item.raw_batch_id,
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
        setMessage({ type: 'success', text: `Sales Invoice ${res.sales_invoice_no || res.invoice_no} generated and stock deducted via FIFO!` });
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
      accessor: 'sales_invoice_no',
      render: (s) => <span className="font-mono font-bold text-brand-orange">{s.sales_invoice_no || s.invoice_no}</span>
    },
    {
      header: 'Patient / Customer',
      accessor: 'customer_name',
      render: (s) => <span className="font-semibold text-slate-900 dark:text-slate-100">{s.customer_name}</span>
    },
    {
      header: 'Clinic Location',
      accessor: 'clinic_name',
      render: (s) => <span className="text-slate-600 dark:text-slate-400">{s.clinic_name || s.location_name}</span>
    },
    {
      header: 'Attending Doctor',
      accessor: 'doctor_name',
      render: (s) => <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5 text-brand-orange" /> {s.doctor_name || 'OPD Doctor'}</span>
    },
    {
      header: `Grand Total (${currencyCode})`,
      accessor: 'net_amount',
      render: (s) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(s.net_amount || s.total_amount, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Dispensed At',
      accessor: 'created_at',
      render: (s) => <span className="text-slate-500 dark:text-slate-400 font-mono">{formatDate(s.created_at)}</span>
    }
  ];

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId || c.raw_id == selectedCustomerId);

  const doctorOptions = clinicDoctors.length > 0 ? clinicDoctors.map(d => ({
    value: d.name,
    label: `${d.name} (${d.speciality})`,
    sublabel: `Code: ${d.doctor_code} • Clinic Assigned`
  })) : [
    { value: 'Dr. Alexander Smith', label: 'Dr. Alexander Smith (General Physician)', sublabel: 'Code: DOC-001' },
    { value: 'Dr. Sarah Johnson', label: 'Dr. Sarah Johnson (Pediatric Specialist)', sublabel: 'Code: DOC-002' }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-brand-orange" />
            Clinic OPD Patient Sales POS & Dispensing
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Direct patient sales dispensing from clinic stock with assigned doctors and FIFO automated deduction in {currencyCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-xs font-bold flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" />
            VAT Mode: {isItemWiseVat ? 'Line Item Tax' : 'Total Bill Tax'}
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 text-xs font-bold">
            Clinic Outlet ({currencyCode})
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

      {/* POS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Available Clinic Stock Selection & Live Search */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Available Clinic OPD Stock Batches</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Click any item below to add directly into the Consumption List</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
              {filteredStock.length} Batches
            </span>
          </div>

          {/* Search Option Filter */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={stockSearchTerm}
              onChange={(e) => setStockSearchTerm(e.target.value)}
              placeholder="Search Clinic Available Stock by item name, code, or batch code..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-orange font-semibold"
            />
            {stockSearchTerm && (
              <button
                onClick={() => setStockSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stock Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
            {filteredStock.map(batch => {
              const bId = batch.batch_id || batch.id;
              const cartMatch = cart.find(c => c.batch_id === bId);
              const inCartQty = cartMatch ? cartMatch.qty : 0;

              return (
                <div
                  key={bId}
                  onClick={() => addToCart(batch)}
                  className={`p-4 rounded-2xl border transition-all space-y-2 group shadow-xs relative cursor-pointer ${
                    inCartQty > 0
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-brand-orange/60'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-brand-orange dark:hover:border-brand-orange'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs group-hover:text-brand-orange transition-colors">
                        {batch.item_name}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {batch.item_code}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/30">
                        {batch.batch_code}
                      </span>
                      {inCartQty > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                          In List ({inCartQty})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(batch.selling_price, currencyCode, decimalPlaces)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px] flex items-center gap-1">
                      Stock: <strong className="text-slate-800 dark:text-slate-200">{batch.quantity_available}</strong>
                      <span className="text-brand-orange font-bold group-hover:underline flex items-center gap-0.5">
                        <Plus className="w-3 h-3" /> Add
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredStock.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                No clinic stock batches found matching "{stockSearchTerm}".
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Consumption List & Checkout Cart Form */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs flex flex-col justify-between">
          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-orange" /> OPD Dispensing Consumption List
              </h3>
              <span className="text-xs font-bold text-brand-orange bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                {cart.length} Item(s)
              </span>
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Attending Doctor / Physician *</span>
                <span className="text-[10px] text-brand-orange font-semibold">Assigned to Clinic</span>
              </label>
              <SearchableSelect
                placeholder="Select Attending Doctor..."
                options={doctorOptions}
                value={doctorName}
                onChange={(val) => setDoctorName(val)}
              />
            </div>

            {/* Consumption Cart Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Item & Batch</th>
                    <th className="p-2.5 w-16 text-center">Qty</th>
                    {isItemWiseVat && <th className="p-2.5 w-16 text-center">VAT %</th>}
                    <th className="p-2.5 w-24 text-right">Price ({currencyCode})</th>
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
                          {formatCurrency(itemTotal, currencyCode, decimalPlaces)}
                        </td>

                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(index)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Remove from list"
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
                        Consumption list is empty. Click available stock items on the left to add items.
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
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(grossTotal, currencyCode, decimalPlaces)}</span>
              </div>

              {!isItemWiseVat && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-bold"><Tag className="w-3 h-3 text-brand-orange" /> Discount ({currencyCode}):</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-0.5 text-xs text-right font-bold"
                  />
                </div>
              )}

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>VAT Tax ({isItemWiseVat ? 'Item-Wise' : `${defaultVatRate}% Total`}):</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalVat, currencyCode, decimalPlaces)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-xs">Grand Total Payable:</span>
                <span className="text-xl font-black text-brand-orange font-heading">{formatCurrency(grandTotal, currencyCode, decimalPlaces)}</span>
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-brand-orange">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/80 rounded-2xl border border-amber-200 dark:border-amber-800">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">Confirm OPD Dispensing & Sale</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Are you sure you want to generate this sales invoice?</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Patient / Customer:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCustomerObj?.name || 'Walk-in Patient'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attending Doctor:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Consumption Line Items:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{cart.length} Item(s)</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold">Grand Total Amount:</span>
                <span className="font-black text-brand-orange text-sm">
                  {formatCurrency(grandTotal, currencyCode, decimalPlaces)}
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
                onClick={executeCheckout}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Generate & Dispense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Invoices History */}
      <DataTable
        title="Recent OPD Patient Sales Invoices History"
        subtitle={`Search and sort recorded OPD sales invoices in ${currencyCode}`}
        columns={invoiceColumns}
        data={salesInvoices}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
