import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { Stethoscope, ShoppingBag, Trash2, CheckCircle2, AlertCircle, Calculator, Tag, Search, Plus, HelpCircle, X, FileText, Calendar, User, Building2, UserPlus, Phone, Mail, MapPin } from 'lucide-react';

export default function ClinicSalesPOS() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  
  const [customers, setCustomers] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Search Filter State for Available Clinic Stock
  const [stockSearchTerm, setStockSearchTerm] = useState('');

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [doctorName, setDoctorName] = useState('');

  // Quick New Patient Modal State
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newPatientEmail, setNewPatientEmail] = useState('');
  const [newPatientAddress, setNewPatientAddress] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Detail Modal State for Sales Invoice Breakdown
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);

  const fetchClinicStockAndDoctors = async (clinicLocId, allClinicsList = clinics) => {
    if (!clinicLocId) return;
    setStockLoading(true);
    try {
      const selectedObj = allClinicsList.find(c => c.id === clinicLocId || c.raw_id == clinicLocId);
      const locParam = selectedObj?.raw_id || clinicLocId;

      const [stockRes, docRes] = await Promise.all([
        apiFetch(`/stock/location?location_id=${encodeURIComponent(locParam)}`),
        apiFetch(`/doctors/by-location?location_id=${encodeURIComponent(locParam)}`)
      ]);

      setAvailableStock(stockRes.batches || []);
      const docs = docRes.doctors || [];
      setClinicDoctors(docs);

      if (docs.length > 0) {
        setDoctorName(docs[0].name);
      } else {
        setDoctorName('Dr. Alexander Smith');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStockLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [masterRes, custRes, salesRes, settingsRes] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/customers'),
        apiFetch('/sales/list'),
        apiFetch('/settings')
      ]);

      const clns = (masterRes.locations || []).filter(l => l.type === 'CLINIC');
      setClinics(clns);

      const custs = custRes.customers || [];
      setCustomers(custs);
      setSalesInvoices(salesRes.invoices || []);

      const setts = settingsRes.settings || { vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' };
      setSettings(setts);

      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }

      // Clinic Location Context Selection
      const userLocId = user?.location_id || user?.raw_location_id;
      const userClinic = clns.find(c => c.id == userLocId || c.raw_id == userLocId);

      let initialClinicId = '';
      if (userClinic) {
        initialClinicId = userClinic.id;
      } else if (clns.length > 0) {
        initialClinicId = clns[0].id;
      } else {
        initialClinicId = 4; // Fallback Clinic ID
      }

      setSelectedClinicId(initialClinicId);
      await fetchClinicStockAndDoctors(initialClinicId, clns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClinicChange = (newClinicId) => {
    setSelectedClinicId(newClinicId);
    setCart([]);
    setMessage({ type: 'success', text: 'Switched clinic context. Available OPD stock batches updated.' });
    fetchClinicStockAndDoctors(newClinicId);
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleCreateQuickPatient = async (e) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      setMessage({ type: 'error', text: 'Patient name is required.' });
      return;
    }

    setSavingPatient(true);
    try {
      const res = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newPatientName.trim(),
          phone: newPatientPhone.trim(),
          email: newPatientEmail.trim(),
          address: newPatientAddress.trim()
        })
      });

      if (res.success || res.id) {
        setMessage({ type: 'success', text: `Patient '${newPatientName}' registered successfully!` });
        setShowNewPatientModal(false);
        setNewPatientName('');
        setNewPatientPhone('');
        setNewPatientEmail('');
        setNewPatientAddress('');

        // Refresh customer list and auto-select newly added patient
        const custRes = await apiFetch('/customers');
        const updatedCusts = custRes.customers || [];
        setCustomers(updatedCusts);

        const createdId = res.customer_id || res.id;
        const matched = updatedCusts.find(c => c.id === createdId || c.raw_id == createdId || c.name === newPatientName.trim());
        if (matched) {
          setSelectedCustomerId(matched.id);
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to register new patient' });
    } finally {
      setSavingPatient(false);
    }
  };

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
        setMessage({ type: 'error', text: `Cannot exceed available batch stock of ${batch.quantity_available} units.` });
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
  const filteredStock = availableStock.filter(batch => {
    if (!stockSearchTerm.trim()) return true;
    const q = stockSearchTerm.toLowerCase();
    return (
      (batch.item_name && batch.item_name.toLowerCase().includes(q)) ||
      (batch.batch_code && batch.batch_code.toLowerCase().includes(q)) ||
      (batch.item_code && batch.item_code.toLowerCase().includes(q))
    );
  });

  // Financial Computations for Cart & Checkout
  const isNoVat = settings.vat_calculation_mode === 'NO_VAT' || parseFloat(settings.vat_percent || 0) === 0;
  const isItemWiseVat = settings.vat_calculation_mode === 'ITEM_WISE';
  const defaultVatRate = isNoVat ? 0 : parseFloat(settings.vat_percent || 10.00);

  const grossTotal = cart.reduce((acc, item) => acc + (parseFloat(item.selling_price || 0) * parseInt(item.qty || 0)), 0);
  const discountVal = parseFloat(discountAmount || 0);
  const netSubtotalAfterDiscount = Math.max(0, grossTotal - discountVal);

  const totalVat = isNoVat
    ? 0
    : isItemWiseVat
    ? cart.reduce((acc, item) => {
        const itemGross = parseFloat(item.selling_price || 0) * parseInt(item.qty || 0);
        const itemVatRate = parseFloat(item.vat_percent || defaultVatRate);
        return acc + (itemGross * (itemVatRate / 100));
      }, 0)
    : (netSubtotalAfterDiscount * (defaultVatRate / 100));

  const grandTotal = isNoVat || isItemWiseVat
    ? (grossTotal - discountVal + totalVat)
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
      const selectedClinicObj = clinics.find(c => c.id === selectedClinicId || c.raw_id == selectedClinicId);

      const payload = {
        clinic_location_id: selectedClinicId,
        raw_clinic_location_id: selectedClinicObj?.raw_id || selectedClinicId,
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

      const res = await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Patient Sales Invoice ${res.invoice_no} posted successfully! Stock debited with FIFO automated allocation.` });
        setCart([]);
        setDiscountAmount('0.00');
        fetchClinicStockAndDoctors(selectedClinicId);

        const salesRes = await apiFetch('/sales/list');
        setSalesInvoices(salesRes.invoices || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Dispensing sales invoice posting failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const salesColumns = [
    {
      header: 'Invoice #',
      accessor: 'invoice_no',
      render: (s) => <span className="font-mono font-bold text-brand-blue">{s.invoice_no}</span>
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
  const selectedClinicObj = clinics.find(c => c.id === selectedClinicId || c.raw_id == selectedClinicId);

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
            VAT Mode: {isNoVat ? 'NO VAT (0%)' : isItemWiseVat ? 'Line Item Tax' : 'Total Bill Tax'}
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 text-xs font-bold">
            {selectedClinicObj ? selectedClinicObj.name : 'Clinic Outlet'} ({currencyCode})
          </span>
        </div>
      </div>

      {/* Active OPD Clinic Outlet Context Selector Card */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Active OPD Clinic Outlet Context</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Select a clinic outlet to load its available OPD stock batches and dispense patient sales' : 'Locked to your assigned clinic outlet context'}
            </p>
          </div>
        </div>

        <div className="w-full md:w-80">
          {isAdmin ? (
            <SearchableSelect
              placeholder="Select Clinic Outlet..."
              options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.code})`, sublabel: c.type }))}
              value={selectedClinicId}
              onChange={(val) => handleClinicChange(val)}
            />
          ) : (
            <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-xs">
              <span>{selectedClinicObj ? `${selectedClinicObj.name} (${selectedClinicObj.code})` : 'Assigned Clinic Outlet'}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                Clinic Context
              </span>
            </div>
          )}
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
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Available Clinic OPD Stock Batches ({selectedClinicObj?.name || 'Clinic Outlet'})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Click any item below to add directly into the Consumption List</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
              {stockLoading ? 'Loading...' : `${filteredStock.length} Batches`}
            </span>
          </div>

          {/* Search Option Filter */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={stockSearchTerm}
              onChange={(e) => setStockSearchTerm(e.target.value)}
              placeholder={`Search ${selectedClinicObj?.name || 'Clinic'} Stock by item name, code, or batch code...`}
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
          {stockLoading ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 animate-pulse">
              Fetching OPD Stock Batches for {selectedClinicObj?.name || 'Selected Clinic'}...
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              No active stock batches found at {selectedClinicObj?.name || 'Selected Clinic'}. Transfer stock from Sub-Branch first.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
              {filteredStock.map(batch => {
                const bId = batch.batch_id || batch.id;
                const cartMatch = cart.find(c => c.batch_id === bId);
                const inCartQty = cartMatch ? cartMatch.qty : 0;

                return (
                  <div
                    key={bId}
                    onClick={() => addToCart(batch)}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 hover:border-brand-orange hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all cursor-pointer space-y-2 group shadow-2xs relative"
                  >
                    {inCartQty > 0 && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-brand-orange text-white text-[10px] font-extrabold shadow-sm">
                        {inCartQty} in cart
                      </span>
                    )}

                    <div className="flex items-start justify-between gap-2 pr-12">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug group-hover:text-brand-orange transition-colors">
                        {batch.item_name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-500 dark:text-slate-400">Batch: {batch.batch_code}</span>
                      <span className="font-mono text-slate-400 text-[10px]">Exp: {formatDate(batch.expiry_date)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(batch.selling_price || 0, currencyCode, decimalPlaces)}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        Avail: {batch.quantity_available} units
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: POS Consumption List Cart & Patient Checkout Form */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleOpenConfirm} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-brand-orange" />
                Patient OPD Consumption List ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-600 hover:underline font-bold"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Patient & Doctor Selection */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Select Patient / Customer *</label>
                  <button
                    type="button"
                    onClick={() => setShowNewPatientModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white border border-brand-blue/30 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    title="Register a new patient directly from POS for all logins"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    + Quick Add Patient
                  </button>
                </div>
                <SearchableSelect
                  placeholder="Search Patient..."
                  options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.phone || 'Walk-in'})`, sublabel: `Code: ${c.code || c.id}` }))}
                  value={selectedCustomerId}
                  onChange={(val) => setSelectedCustomerId(val)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Attending Clinic Doctor *</label>
                <SearchableSelect
                  options={doctorOptions}
                  value={doctorName}
                  onChange={(val) => setDoctorName(val)}
                />
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[260px] overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  Consumption list is empty. Click items from the available stock grid on the left.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Item & Batch</th>
                      <th className="p-2.5 w-20">Qty</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {cart.map((item, idx) => {
                      const itemSubtotal = parseFloat(item.selling_price || 0) * parseInt(item.qty || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5">
                            <p className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{item.item_name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Batch: {item.batch_code}</p>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="1"
                              max={item.max_qty}
                              value={item.qty}
                              onChange={(e) => updateCartItem(idx, 'qty', parseInt(e.target.value || 1))}
                              className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-center"
                            />
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.selling_price, currencyCode, decimalPlaces)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(itemSubtotal, currencyCode, decimalPlaces)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeFromCart(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gross Items Total:</span>
                <span className="font-mono font-semibold">{formatCurrency(grossTotal, currencyCode, decimalPlaces)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Discount Deduction:</span>
                <div className="flex items-center gap-1 w-28">
                  <span className="font-mono text-[11px] text-slate-400">{currencyCode}</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs text-right font-mono font-bold"
                  />
                </div>
              </div>

              {!isNoVat && (
                <div className="flex justify-between text-purple-700 dark:text-purple-300 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>VAT ({isItemWiseVat ? 'Item-wise' : `${defaultVatRate}%`}):</span>
                  <span className="font-mono font-bold">+{formatCurrency(totalVat, currencyCode, decimalPlaces)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-base font-extrabold text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-300 dark:border-slate-700">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                  {formatCurrency(grandTotal, currencyCode, decimalPlaces)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              type="submit"
              disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg glow-green hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              {submitting ? 'Posting OPD Invoice...' : `Dispense Patient Sales (${formatCurrency(grandTotal, currencyCode, decimalPlaces)})`}
            </button>
          </form>
        </div>
      </div>

      {/* Sales History Directory */}
      <DataTable
        title="Dispensed Patient OPD Invoices Ledger"
        subtitle={`Audit log of all OPD sales invoices dispensed at ${selectedClinicObj?.name || 'Clinic Outlet'}`}
        columns={salesColumns}
        data={salesInvoices}
        searchable={true}
        defaultPageSize={10}
      />

      {/* Quick Add New Patient Modal (Available for All Logins) */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-blue" />
                  Quick Patient / Customer Registration
                </h3>
                <p className="text-xs text-slate-500">Register a new patient directly into OPD POS database</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickPatient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Patient Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="e.g. Abdullah Ahmed"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    placeholder="e.g. +973 39123456"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address (Optional)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={newPatientEmail}
                    onChange={(e) => setNewPatientEmail(e.target.value)}
                    placeholder="abdullah@example.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Residential Address (Optional)</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={newPatientAddress}
                    onChange={(e) => setNewPatientAddress(e.target.value)}
                    placeholder="Block 338, Manama, Bahrain"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPatient}
                  className="px-5 py-2 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:bg-brand-blue/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  {savingPatient ? 'Registering Patient...' : 'Register Patient & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
