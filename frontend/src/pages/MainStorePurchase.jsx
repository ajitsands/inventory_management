import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { ShoppingCart, Plus, Trash2, CheckCircle2, AlertCircle, Calculator, Tag, Sparkles } from 'lucide-react';

export default function MainStorePurchase() {
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [openQuotations, setOpenQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [vendorId, setVendorId] = useState('');
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(todayDate());
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState(`VINV-${rand4()}`);
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(todayDate());
  const [remarks, setRemarks] = useState('');
  const [billDiscount, setBillDiscount] = useState('0.00');

  const [lineItems, setLineItems] = useState([]);

  function todayDate() {
    return new Date().toISOString().split('T')[0];
  }
  function futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
  function dateString() {
    return new Date().toISOString().split('T')[0].replace(/-/g, '');
  }
  function rand4() {
    return Math.floor(1000 + Math.random() * 9000);
  }

  function createEmptyLine(defaultVat = '10.00') {
    return {
      item_id: '',
      batch_code: `BTC-${dateString()}-${rand4()}`,
      purchase_price: '',
      selling_price: '',
      mrp: '',
      vat_percent: defaultVat,
      expiry_date: futureDate(365),
      qty: 10
    };
  }

  const loadData = async () => {
    try {
      const [masterData, purchaseData, settingsRes] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/purchase/list'),
        apiFetch('/settings')
      ]);
      const vendorList = masterData.vendors || [];
      const itemList = masterData.items || [];
      setVendors(vendorList);
      setItems(itemList);
      setPurchases(purchaseData.invoices || []);
      
      const setts = settingsRes.settings || { vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' };
      setSettings(setts);

      if (vendorList.length > 0) {
        const firstVendor = vendorList[0];
        setVendorId(firstVendor.id);
        fetchOpenQuotations(firstVendor.id, firstVendor, itemList, setts);
      } else {
        setLineItems([createEmptyLine(setts.vat_percent || '10.00')]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenQuotations = async (vId, vendorObj = null, masterItems = items, setts = settings) => {
    if (!vId) {
      setOpenQuotations([]);
      setSelectedQuotationId('');
      setPoNo(`PO-${dateString()}-${rand4()}`);
      return;
    }

    const currentVendor = vendorObj || vendors.find(v => v.id === vId);
    const queryParam = currentVendor?.raw_id || vId;

    try {
      const res = await apiFetch(`/quotations/open-by-vendor?vendor_id=${encodeURIComponent(queryParam)}`);
      const quots = res.quotations || [];
      setOpenQuotations(quots);

      if (quots.length > 0) {
        // Automatically select and populate the first active PO
        handleQuotationSelect(quots[0].id, quots, masterItems, setts);
      } else {
        setSelectedQuotationId('');
        setPoNo(`PO-${dateString()}-${rand4()}`);
        setLineItems([createEmptyLine(setts.vat_percent || '10.00')]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;

  const handleVendorChange = (vId) => {
    setVendorId(vId);
    setSelectedQuotationId('');
    fetchOpenQuotations(vId);
  };

  // Select PO Number and auto-populate PO Date & all line items belonging to that PO
  const handleQuotationSelect = (qId, sourceQuotations = openQuotations, masterItems = items, setts = settings) => {
    setSelectedQuotationId(qId);
    if (!qId || qId === 'DIRECT') {
      setPoNo(`PO-${dateString()}-${rand4()}`);
      setPoDate(todayDate());
      setLineItems([createEmptyLine(setts.vat_percent || '10.00')]);
      return;
    }

    const quotation = sourceQuotations.find(q => (q.id === qId || q.raw_id == qId || q.quotation_no === qId));
    if (!quotation) return;

    // Automatically set PO Number & PO Date
    setPoNo(quotation.quotation_no);
    if (quotation.quotation_date) {
      setPoDate(quotation.quotation_date);
    }

    if (quotation.items && quotation.items.length > 0) {
      const populatedLines = quotation.items.map(item => {
        const remainingQty = Math.max(1, item.ordered_qty - item.received_qty);
        const purchasePrice = parseFloat(item.unit_price || 0);
        const sellingPrice = (purchasePrice * 1.25).toFixed(3);

        // Robust matching with Master Items list by raw_id, raw_item_id, id or code
        const matchedMasterItem = masterItems.find(i => (
          (i.raw_id && item.raw_item_id && String(i.raw_id) === String(item.raw_item_id)) ||
          String(i.id) === String(item.item_id) ||
          (i.item_code && item.item_code && i.item_code === item.item_code)
        ));

        const itemIdToUse = matchedMasterItem ? matchedMasterItem.id : item.item_id;

        return {
          item_id: itemIdToUse,
          batch_code: `BTC-${matchedMasterItem ? matchedMasterItem.item_code : dateString()}-${rand4()}`,
          purchase_price: purchasePrice.toFixed(3),
          selling_price: sellingPrice,
          mrp: sellingPrice,
          vat_percent: setts.vat_percent || '10.00',
          expiry_date: futureDate(365),
          qty: remainingQty
        };
      });

      setLineItems(populatedLines);
      setMessage({
        type: 'success',
        text: `Automated PO Import: Loaded ${populatedLines.length} line item(s) & PO Date (${quotation.quotation_date}) from Purchase Order ${quotation.quotation_no}!`
      });
    }
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const selectedItem = items.find(i => i.id == value || i.raw_id == value);
      if (selectedItem) {
        updated[index].batch_code = `BTC-${selectedItem.item_code}-${rand4()}`;
      }
    }
    setLineItems(updated);
  };

  const addLine = () => setLineItems([...lineItems, createEmptyLine(settings.vat_percent || '10.00')]);
  const removeLine = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Calculations
  const isItemWiseVat = settings.vat_calculation_mode === 'ITEM_WISE';
  const defaultVatRate = parseFloat(settings.vat_percent || 10.00);

  const calculateGrossSubtotal = () => lineItems.reduce((acc, line) => {
    const lineGross = parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0);
    return acc + lineGross;
  }, 0);

  const calculateItemWiseTotalVat = () => lineItems.reduce((acc, line) => {
    const lineGross = parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0);
    const vatRate = parseFloat(line.vat_percent || 0);
    return acc + (lineGross * (vatRate / 100));
  }, 0);

  const grossSubtotal = calculateGrossSubtotal();
  const discountVal = parseFloat(billDiscount || 0);
  const netSubtotalAfterDiscount = Math.max(0, grossSubtotal - discountVal);

  const totalVat = isItemWiseVat
    ? calculateItemWiseTotalVat()
    : (netSubtotalAfterDiscount * (defaultVatRate / 100));

  const grandTotal = isItemWiseVat
    ? (grossSubtotal + totalVat)
    : (netSubtotalAfterDiscount + totalVat);

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
        quotation_id: selectedQuotationId || null,
        po_no: poNo,
        po_date: poDate,
        vendor_invoice_no: vendorInvoiceNo,
        vendor_invoice_date: vendorInvoiceDate,
        remarks: remarks,
        bill_discount: billDiscount,
        vat_calculation_mode: settings.vat_calculation_mode,
        total_vat_amount: totalVat.toFixed(3),
        grand_total: grandTotal.toFixed(3),
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
        setBillDiscount('0.00');
        setSelectedQuotationId('');
        setLineItems([createEmptyLine(settings.vat_percent || '10.00')]);
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
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{formatDate(p.po_date)}</span>
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
      header: `Total Amount (${currencyCode})`,
      accessor: 'total_amount',
      render: (p) => <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.total_amount, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Posted By',
      accessor: 'created_by_name',
      render: (p) => <span className="text-slate-600 dark:text-slate-400">{p.created_by_name}</span>
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (p) => <span className="text-slate-500 dark:text-slate-400 font-mono">{formatDate(p.created_at)}</span>
    }
  ];

  // Options for PO Number Dropdown: active open POs + direct purchase fallback
  const poDropdownOptions = [
    ...openQuotations.map(q => ({
      value: q.id,
      label: q.quotation_no,
      sublabel: `Active PO • ${q.items.length} items • ${formatCurrency(q.total_amount, currencyCode, decimalPlaces)}`
    })),
    { value: 'DIRECT', label: poNo || 'Direct Purchase (No PO)', sublabel: 'Create purchase without linked quotation' }
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Select vendor, pick active PO number to auto-populate items, and post vendor invoice in {currencyCode}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-xs font-bold flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" />
            VAT Mode: {isItemWiseVat ? 'Line Item Tax' : 'Total Bill Tax'}
          </span>
          <span className="px-3 py-1 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30 text-xs font-bold">
            Central Main Store ({currencyCode})
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

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Purchase Bill Header Information</h3>
          {openQuotations.length > 0 ? (
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/80 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-500/40 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {openQuotations.length} Active PO(s) Found for Vendor
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-400">Direct Purchase Mode</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Vendor *</label>
            <SearchableSelect
              placeholder="Search Vendor..."
              options={vendors.map(v => ({ value: v.id, label: v.name, sublabel: `Code: ${v.code}` }))}
              value={vendorId}
              onChange={(val) => handleVendorChange(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Purchase Order (PO) Number *</span>
              {openQuotations.length > 0 && <span className="text-[10px] text-purple-600 font-bold">Auto-Populates PO Items</span>}
            </label>
            <SearchableSelect
              placeholder="Select Active Vendor PO..."
              options={poDropdownOptions}
              value={selectedQuotationId || 'DIRECT'}
              onChange={(val) => handleQuotationSelect(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">PO Date *</label>
            <input
              type="date"
              required
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor Invoice Number *</label>
            <input
              type="text"
              required
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor Invoice Date *</label>
            <input
              type="date"
              required
              value={vendorInvoiceDate}
              onChange={(e) => setVendorInvoiceDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Remarks / Note</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Received via Express Delivery"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Line Items & Tax Control</h3>
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
                  <th className="p-3.5 min-w-[320px]">Item Master *</th>
                  <th className="p-3.5 w-36">Batch Code *</th>
                  <th className="p-3.5 w-28">Cost Price ({currencyCode}) *</th>
                  <th className="p-3.5 w-28">Sales Price ({currencyCode}) *</th>

                  {/* Dynamic VAT % Column if ITEM_WISE */}
                  {isItemWiseVat && (
                    <th className="p-3.5 w-24">VAT % (Editable)</th>
                  )}

                  <th className="p-3.5 w-32">Expiry Date *</th>
                  <th className="p-3.5 w-20">Qty *</th>
                  <th className="p-3.5 w-28 text-right">Subtotal ({currencyCode})</th>
                  <th className="p-3.5 w-10 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, index) => {
                  const gross = (parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0));
                  const tax = isItemWiseVat ? (gross * (parseFloat(line.vat_percent || 0) / 100)) : 0;
                  const lineSubtotal = (gross + tax);

                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                      <td className="p-2.5 min-w-[320px]">
                        <SearchableSelect
                          placeholder="Search Item Master..."
                          options={items.map(i => ({ value: i.id, label: i.name, sublabel: `Code: ${i.item_code}` }))}
                          value={line.item_id}
                          onChange={(val) => handleLineChange(index, 'item_id', val)}
                        />
                      </td>

                      <td className="p-2.5 w-36">
                        <input
                          type="text"
                          required
                          value={line.batch_code}
                          onChange={(e) => handleLineChange(index, 'batch_code', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue font-bold text-center"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.001"
                          required
                          value={line.purchase_price}
                          onChange={(e) => handleLineChange(index, 'purchase_price', e.target.value)}
                          placeholder="0.000"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.001"
                          required
                          value={line.selling_price}
                          onChange={(e) => handleLineChange(index, 'selling_price', e.target.value)}
                          placeholder="0.000"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold"
                        />
                      </td>

                      {/* Editable VAT % Input for ITEM_WISE mode */}
                      {isItemWiseVat && (
                        <td className="p-2.5">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={line.vat_percent}
                              onChange={(e) => handleLineChange(index, 'vat_percent', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-brand-blue font-bold focus:border-brand-blue text-center"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                        </td>
                      )}

                      <td className="p-2.5">
                        <input
                          type="date"
                          required
                          value={line.expiry_date}
                          onChange={(e) => handleLineChange(index, 'expiry_date', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-semibold"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.qty}
                          onChange={(e) => handleLineChange(index, 'qty', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-bold text-center"
                        />
                      </td>

                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {formatCurrency(lineSubtotal, currencyCode, decimalPlaces)}
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

        {/* Total & Summary Breakdown Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
              <span>Gross Subtotal: <strong>{formatCurrency(grossSubtotal, currencyCode, decimalPlaces)}</strong></span>

              {!isItemWiseVat && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Tag className="w-3.5 h-3.5 text-brand-orange" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">Discount ({currencyCode}):</span>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={billDiscount}
                    onChange={(e) => setBillDiscount(e.target.value)}
                    className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                  />
                </div>
              )}

              <span>
                Calculated VAT ({isItemWiseVat ? 'Item-Wise' : `${defaultVatRate}% Total`}): <strong className="text-purple-600 dark:text-purple-400">{formatCurrency(totalVat, currencyCode, decimalPlaces)}</strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isItemWiseVat
                ? 'Item-Wise Tax Mode: Individual VAT % pre-filled and calculated for each item.'
                : `Total Bill Tax Mode: ${defaultVatRate}% VAT calculated on Net Subtotal (${formatCurrency(netSubtotalAfterDiscount, currencyCode, decimalPlaces)}) after Discount.`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Final Payable Grand Total</p>
              <p className="text-2xl font-black text-brand-blue font-heading">{formatCurrency(grandTotal, currencyCode, decimalPlaces)}</p>
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
                  Post Purchase Bill
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Purchase Invoices History DataTable */}
      <DataTable
        title="Recent Vendor Purchase Bills Entry History"
        subtitle={`Search and sort recorded vendor invoices in ${currencyCode}`}
        columns={historyColumns}
        data={purchases}
        searchable={true}
        defaultPageSize={5}
      />
    </div>
  );
}
