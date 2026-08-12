import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { ShoppingCart, Plus, Trash2, CheckCircle2, AlertCircle, Calculator, Tag, Sparkles, FileText, Eye, X, Paperclip, UploadCloud, FileCheck, ExternalLink, Download } from 'lucide-react';

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

  // Selected Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Form State
  const [vendorId, setVendorId] = useState('');
  const [poNo, setPoNo] = useState('');
  const [poDate, setPoDate] = useState(todayDate());
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState(`VINV-${rand4()}`);
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(todayDate());
  const [remarks, setRemarks] = useState('');
  const [billDiscount, setBillDiscount] = useState('0.00');

  // File Upload State
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

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

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

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
          raw_item_id: matchedMasterItem?.raw_id || item.raw_item_id,
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
        updated[index].raw_item_id = selectedItem.raw_id;
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
  const isNoVat = settings.vat_calculation_mode === 'NO_VAT' || parseFloat(settings.vat_percent || 0) === 0;
  const isItemWiseVat = !isNoVat && settings.vat_calculation_mode === 'ITEM_WISE';
  const defaultVatRate = isNoVat ? 0 : parseFloat(settings.vat_percent || 10.00);

  const calculateGrossSubtotal = () => lineItems.reduce((acc, line) => {
    const lineGross = parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0);
    return acc + lineGross;
  }, 0);

  const calculateItemWiseTotalVat = () => isNoVat ? 0 : lineItems.reduce((acc, line) => {
    const lineGross = parseFloat(line.purchase_price || 0) * parseInt(line.qty || 0);
    const vatRate = parseFloat(line.vat_percent || 0);
    return acc + (lineGross * (vatRate / 100));
  }, 0);

  const grossSubtotal = calculateGrossSubtotal();
  const discountVal = parseFloat(billDiscount || 0);
  const netSubtotalAfterDiscount = Math.max(0, grossSubtotal - discountVal);

  const totalVat = isNoVat
    ? 0
    : isItemWiseVat
    ? calculateItemWiseTotalVat()
    : (netSubtotalAfterDiscount * (defaultVatRate / 100));

  const grandTotal = isNoVat || isItemWiseVat
    ? (grossSubtotal - discountVal + totalVat)
    : (netSubtotalAfterDiscount + totalVat);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
      setMessage({
        type: 'error',
        text: 'Invalid file format. Allowed types: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (JPG, PNG, GIF, WEBP).'
      });
      return;
    }

    setAttachedFile(file);
    setFilePreview({
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      ext: ext.toUpperCase(),
      isImage: ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext),
      url: ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? URL.createObjectURL(file) : null
    });
    setMessage(null);
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!vendorId) {
      setMessage({ type: 'error', text: 'Please select a vendor supplier.' });
      return;
    }
    if (!vendorInvoiceNo) {
      setMessage({ type: 'error', text: 'Please enter the vendor invoice number.' });
      return;
    }

    if (lineItems.length === 0) {
      setMessage({ type: 'error', text: 'Add at least 1 item line to post the purchase.' });
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
      const selectedVendor = vendors.find(v => v.id === vendorId || v.raw_id == vendorId);
      const selectedQuotation = openQuotations.find(q => q.id === selectedQuotationId || q.raw_id == selectedQuotationId);

      const payload = {
        vendor_id: vendorId,
        raw_vendor_id: selectedVendor?.raw_id,
        quotation_id: selectedQuotationId || null,
        raw_quotation_id: selectedQuotation?.raw_id,
        po_no: poNo,
        po_date: poDate,
        vendor_invoice_no: vendorInvoiceNo,
        vendor_invoice_date: vendorInvoiceDate,
        remarks: remarks,
        bill_discount: billDiscount,
        vat_calculation_mode: settings.vat_calculation_mode,
        total_vat_amount: totalVat.toFixed(3),
        grand_total: grandTotal.toFixed(3),
        items: formattedItems
      };

      let reqOptions = {};

      if (attachedFile) {
        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));
        formData.append('document_file', attachedFile);

        reqOptions = {
          method: 'POST',
          body: formData
        };
      } else {
        reqOptions = {
          method: 'POST',
          body: JSON.stringify(payload)
        };
      }

      const res = await apiFetch('/purchase/create', reqOptions);

      if (res.success) {
        setMessage({ type: 'success', text: `Purchase Invoice ${res.invoice_no} posted successfully to Main Store!` });
        setPoNo(`PO-${dateString()}-${rand4()}`);
        setVendorInvoiceNo(`VINV-${rand4()}`);
        setBillDiscount('0.00');
        setRemarks('');
        setAttachedFile(null);
        setFilePreview(null);
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
      header: 'Internal Purchase Reference Number',
      accessor: 'invoice_no',
      render: (p) => (
        <button
          type="button"
          onClick={() => setSelectedInvoice(p)}
          className="font-mono font-bold text-brand-blue hover:underline focus:outline-none flex items-center gap-1 text-left"
          title="Click to view purchased line items detail popup"
        >
          <FileText className="w-3.5 h-3.5 text-brand-blue" />
          {p.invoice_no}
        </button>
      )
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
      header: 'Attached Document',
      accessor: 'document_url',
      render: (p) => p.document_url ? (
        <a
          href={p.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[11px] font-bold hover:bg-emerald-100 transition-all shadow-2xs"
          title="Click to view or download uploaded purchase document"
        >
          <Paperclip className="w-3.5 h-3.5" /> View File
        </a>
      ) : (
        <span className="text-slate-400 text-[11px] italic">No document</span>
      )
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
    <div className="space-y-6 pb-12">
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

          {/* Document Attachment Upload Dropzone */}
          <div className="md:col-span-3 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-brand-blue font-bold">
                <Paperclip className="w-4 h-4 text-brand-blue" />
                Upload Invoice Document / Bill Attachment (Word, PDF, Excel, Images)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Allowed: .pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png, .gif, .webp
              </span>
            </label>

            {!filePreview ? (
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-brand-blue dark:hover:border-brand-blue rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-950/40 transition-all group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden"
                />
                <div className="p-2.5 rounded-xl bg-brand-blue/10 text-brand-blue group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-brand-blue">
                    Click to browse or drop supplier document file here
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Upload original vendor bill, PO receipt, PDF invoice, Word document, Excel spreadsheet or scanned image
                  </span>
                </div>
              </label>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1">
                    <FileCheck className="w-4 h-4" />
                    <span>{filePreview.ext}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">{filePreview.name}</span>
                    <span className="text-[10px] text-slate-500 block">Size: {filePreview.size} • Ready for upload</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                  title="Remove attached file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
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

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 min-h-[380px] pb-48">
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
                          step="any"
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
                          step="any"
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

              {!isNoVat ? (
                <span>
                  Calculated VAT ({isItemWiseVat ? 'Item-Wise' : `${defaultVatRate}% Total`}): <strong className="text-purple-600 dark:text-purple-400">{formatCurrency(totalVat, currencyCode, decimalPlaces)}</strong>
                </span>
              ) : (
                <span className="font-bold text-slate-500">
                  Tax Policy: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">NO VAT (0%)</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isNoVat
                ? 'NO VAT Tax Mode: Tax is deactivated (0.00% VAT applied across all purchases).'
                : isItemWiseVat
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
        subtitle={`Click any Internal Purchase Reference Number to view purchased items details`}
        columns={historyColumns}
        data={purchases}
        searchable={true}
        defaultPageSize={5}
      />

      {/* Purchased Items Detail Popup Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-5xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-blue" />
                  Purchase Invoice Breakdown: <span className="font-mono text-brand-blue">{selectedInvoice.invoice_no}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Detailed list of stock items purchased under this reference number</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Vendor / Supplier</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedInvoice.vendor_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Vendor Invoice #</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedInvoice.vendor_invoice_no}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Linked PO #</span>
                <span className="font-mono font-bold text-brand-blue">{selectedInvoice.po_no}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">PO Date</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{formatDate(selectedInvoice.po_date)}</span>
              </div>

              {selectedInvoice.document_url && (
                <div className="col-span-2 md:col-span-4 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs">Original Supplier Document / Receipt Attached</span>
                  </div>
                  <a
                    href={selectedInvoice.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open / Download Attachment
                  </a>
                </div>
              )}
            </div>

            {/* Items Breakdown Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Item Name & Code</th>
                    <th className="p-3 w-32">Batch Code</th>
                    <th className="p-3 w-20 text-center">Qty</th>
                    <th className="p-3 w-28 text-right">Cost Price ({currencyCode})</th>
                    <th className="p-3 w-28 text-right">Sales Price ({currencyCode})</th>
                    <th className="p-3 w-28">Expiry Date</th>
                    <th className="p-3 w-28 text-right">Subtotal ({currencyCode})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                    selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.item_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Code: {item.item_code} • UOM: {item.unit_of_measure}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {item.batch_code}
                        </td>
                        <td className="p-3 text-center font-bold text-brand-blue">
                          {item.qty}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(item.purchase_price, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.selling_price, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                          {formatDate(item.expiry_date)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.subtotal, currencyCode, decimalPlaces)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-4 text-center text-slate-400">No items found for this invoice.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-500">
                Posted by: <strong>{selectedInvoice.created_by_name}</strong> on {formatDate(selectedInvoice.created_at)}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Invoice Value</span>
                <span className="text-xl font-black text-brand-blue font-heading">
                  {formatCurrency(selectedInvoice.total_amount, currencyCode, decimalPlaces)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
