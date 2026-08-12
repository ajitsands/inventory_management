import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import {
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calculator,
  FileText,
  Paperclip,
  UploadCloud,
  FileCheck,
  ExternalLink,
  Building,
  Building2,
  ShoppingCart,
  Layers,
  X,
  HelpCircle
} from 'lucide-react';

export default function StockReturns() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [returnType, setReturnType] = useState('BRANCH_TO_MAIN'); // CLINIC_TO_BRANCH, BRANCH_TO_MAIN, MAIN_TO_VENDOR
  const [returnReason, setReturnReason] = useState('EXCESS_STOCK');
  const [subBranches, setSubBranches] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Selected Return Detail Modal
  const [selectedReturn, setSelectedReturn] = useState(null);

  // Form State
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [remarks, setRemarks] = useState('');

  // File Upload State
  const [attachedFile, setAttachedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const [lineItems, setLineItems] = useState([]);

  function createEmptyLine() {
    return {
      batch_id: '',
      item_id: '',
      raw_item_id: '',
      raw_batch_id: '',
      unit_price: '0.000',
      max_qty: 0,
      qty: 1
    };
  }

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;
  const isNoVat = settings.vat_calculation_mode === 'NO_VAT' || parseFloat(settings.vat_percent || 0) === 0;
  const vatRate = isNoVat ? 0 : parseFloat(settings.vat_percent || 10.00);

  const loadMasterData = async () => {
    try {
      const [masterData, settingsRes, returnsRes] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/settings'),
        apiFetch('/returns')
      ]);

      const locs = masterData.locations || [];
      const vList = masterData.vendors || [];
      const itemList = masterData.items || [];

      const sbList = locs.filter(l => l.type === 'SUB_BRANCH');
      const cList = locs.filter(l => l.type === 'CLINIC');

      setSubBranches(sbList);
      setClinics(cList);
      setVendors(vList);
      setItems(itemList);
      setReturnsList(returnsRes.returns || []);

      const setts = settingsRes.settings || { vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' };
      setSettings(setts);

      // Default location setup for BRANCH_TO_MAIN
      if (sbList.length > 0) {
        const firstSub = sbList[0].id;
        setFromLocationId(firstSub);
        fetchStockBySourceLocation(firstSub);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const handleReturnTypeChange = (type) => {
    if (type === 'MAIN_TO_VENDOR' && !isAdmin) {
      setMessage({ type: 'error', text: 'Main Store to Vendor Supplier returns can only be processed by System Administrator.' });
      return;
    }

    setReturnType(type);
    setMessage(null);
    setLineItems([createEmptyLine()]);

    if (type === 'CLINIC_TO_BRANCH') {
      const sourceClinicObj = clinics[0];
      const sourceClinic = sourceClinicObj?.id || '';
      const destBranch = subBranches[0]?.id || '';
      setFromLocationId(sourceClinic);
      setToLocationId(destBranch);
      setVendorId('');
      if (sourceClinic) fetchStockBySourceLocation(sourceClinic, sourceClinicObj?.raw_id);
    } else if (type === 'BRANCH_TO_MAIN') {
      const sourceBranchObj = subBranches[0];
      const sourceBranch = sourceBranchObj?.id || '';
      setFromLocationId(sourceBranch);
      setToLocationId(1); // Main Warehouse ID
      setVendorId('');
      if (sourceBranch) fetchStockBySourceLocation(sourceBranch, sourceBranchObj?.raw_id);
    } else if (type === 'MAIN_TO_VENDOR') {
      setFromLocationId(1); // Main Warehouse ID
      setToLocationId('');
      setVendorId(vendors[0]?.id || '');
      fetchStockBySourceLocation(1, 1);
    }
  };

  const fetchStockBySourceLocation = async (locId, rawLocId) => {
    if (!locId && !rawLocId) {
      setAvailableStock([]);
      setLineItems([createEmptyLine()]);
      return;
    }
    try {
      const allLocs = [...subBranches, ...clinics, { id: 1, raw_id: 1 }];
      const matched = allLocs.find(l => l.id === locId || l.raw_id == locId || l.id === rawLocId);
      const rId = rawLocId || matched?.raw_id || locId;
      const encodedId = encodeURIComponent(locId || rId);
      const res = await apiFetch(`/stock/location?location_id=${encodedId}&raw_location_id=${rId}`);
      const stock = res.batches || [];
      setAvailableStock(stock);
      setLineItems([createEmptyLine()]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSourceLocationChange = (val) => {
    setFromLocationId(val);
    const allLocs = [...subBranches, ...clinics, { id: 1, raw_id: 1 }];
    const matched = allLocs.find(l => l.id === val || l.raw_id == val);
    fetchStockBySourceLocation(val, matched?.raw_id);
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    if (field === 'batch_id') {
      const selectedBatch = availableStock.find(b => b.batch_id == value || b.id == value);
      if (selectedBatch) {
        updated[index].item_id = selectedBatch.item_id;
        updated[index].raw_item_id = selectedBatch.raw_item_id || selectedBatch.item_id;
        updated[index].raw_batch_id = selectedBatch.raw_batch_id || selectedBatch.raw_id || selectedBatch.batch_id || selectedBatch.id;
        updated[index].unit_price = selectedBatch.purchase_price || selectedBatch.selling_price || '0.000';
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
      ext: ext.toUpperCase()
    });
    setMessage(null);
  };

  const removeFile = () => {
    setAttachedFile(null);
    setFilePreview(null);
  };

  // Calculations for current return draft
  let grossSubtotal = 0;
  lineItems.forEach(item => {
    const price = parseFloat(item.unit_price || 0);
    const qty = parseInt(item.qty) || 0;
    grossSubtotal += price * qty;
  });

  const vatAmount = isNoVat ? 0 : (grossSubtotal * (vatRate / 100));
  const grandTotalVal = grossSubtotal + vatAmount;

  const validateReturnForm = () => {
    setMessage(null);
    if (!fromLocationId) {
      setMessage({ type: 'error', text: 'Please select a valid source location for the return.' });
      return false;
    }

    if (returnType === 'MAIN_TO_VENDOR' && !vendorId) {
      setMessage({ type: 'error', text: 'Please select a destination vendor supplier for Main Store return.' });
      return false;
    }

    if (returnType !== 'MAIN_TO_VENDOR' && !toLocationId) {
      setMessage({ type: 'error', text: 'Please select a destination location for the return.' });
      return false;
    }

    const batchQtyTotals = {};
    const batchDuplicateCounts = {};

    lineItems.forEach(l => {
      if (l.batch_id) {
        const bId = String(l.batch_id);
        const qty = parseInt(l.qty) || 0;
        batchQtyTotals[bId] = (batchQtyTotals[bId] || 0) + qty;
        batchDuplicateCounts[bId] = (batchDuplicateCounts[bId] || 0) + 1;
      }
    });

    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.batch_id || line.qty <= 0) {
        setMessage({ type: 'error', text: `Line #${i + 1} requires a valid batch selection and return quantity > 0.` });
        return false;
      }

      const bId = String(line.batch_id);
      const cumulativeQty = batchQtyTotals[bId] || 0;
      const selectedBatch = availableStock.find(b => (b.batch_id || b.id) == line.batch_id);
      const batchCode = selectedBatch?.batch_code || `Batch #${bId}`;
      const availStock = line.max_qty || selectedBatch?.quantity_available || 0;

      if (batchDuplicateCounts[bId] > 1) {
        setMessage({
          type: 'error',
          text: `Duplicate batch entry blocked: Batch '${batchCode}' is selected on multiple lines! Cumulative requested quantity (${cumulativeQty}) exceeds available stock (${availStock} units). Please combine into a single line item.`
        });
        return false;
      }

      if (cumulativeQty > availStock) {
        setMessage({
          type: 'error',
          text: `Stock return blocked: Cumulative requested quantity (${cumulativeQty}) for batch '${batchCode}' exceeds available stock (${availStock} units) at source location.`
        });
        return false;
      }
    }
    return true;
  };

  const handlePostReturn = async (e) => {
    e.preventDefault();
    if (!validateReturnForm()) return;

    setSubmitting(true);
    try {
      const selectedFrom = [...subBranches, ...clinics, { id: 1, raw_id: 1 }].find(l => l.id === fromLocationId || l.raw_id == fromLocationId);
      const selectedTo = [...subBranches, { id: 1, raw_id: 1 }].find(l => l.id === toLocationId || l.raw_id == toLocationId);
      const selectedVendor = vendors.find(v => v.id === vendorId || v.raw_id == vendorId);

      const payload = {
        return_type: returnType,
        from_location_id: fromLocationId,
        raw_from_location_id: selectedFrom?.raw_id || fromLocationId,
        to_location_id: toLocationId,
        raw_to_location_id: selectedTo?.raw_id || toLocationId,
        vendor_id: vendorId,
        raw_vendor_id: selectedVendor?.raw_id || vendorId,
        return_reason: returnReason,
        remarks: remarks,
        vat_percent: vatRate,
        items: lineItems.map(item => ({
          item_id: item.item_id,
          raw_item_id: item.raw_item_id,
          batch_id: item.batch_id,
          raw_batch_id: item.raw_batch_id,
          qty: item.qty,
          unit_price: item.unit_price
        }))
      };

      let reqOptions = {};
      if (attachedFile) {
        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));
        formData.append('document_file', attachedFile);
        reqOptions = { method: 'POST', body: formData };
      } else {
        reqOptions = { method: 'POST', body: JSON.stringify(payload) };
      }

      const res = await apiFetch('/returns', reqOptions);

      if (res.success) {
        setMessage({ type: 'success', text: `Stock Return ${res.return_no} posted successfully! Inventory updated across locations.` });
        setLineItems([createEmptyLine()]);
        setRemarks('');
        setAttachedFile(null);
        setFilePreview(null);
        loadMasterData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to post stock return' });
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      header: 'Return Reference #',
      accessor: 'return_no',
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedReturn(r)}
          className="font-mono font-bold text-brand-blue hover:underline focus:outline-none flex items-center gap-1 text-left"
          title="Click to view full return items breakdown & document"
        >
          <RotateCcw className="w-3.5 h-3.5 text-brand-blue" />
          {r.return_no}
        </button>
      )
    },
    {
      header: 'Return Workflow Type',
      accessor: 'return_type',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          r.return_type === 'CLINIC_TO_BRANCH' ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 border-amber-300' :
          r.return_type === 'BRANCH_TO_MAIN' ? 'bg-blue-50 dark:bg-blue-950 text-brand-blue border-blue-200' :
          'bg-purple-50 dark:bg-purple-950 text-purple-700 border-purple-300'
        }`}>
          {r.return_type === 'CLINIC_TO_BRANCH' ? 'Clinic ➔ Sub-Branch' :
           r.return_type === 'BRANCH_TO_MAIN' ? 'Sub-Branch ➔ Main Store' :
           'Main Store ➔ Vendor'}
        </span>
      )
    },
    {
      header: 'Source Location',
      accessor: 'from_location_name',
      render: (r) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.from_location_name || 'Main Warehouse'}</span>
    },
    {
      header: 'Destination (Branch / Vendor)',
      accessor: 'to_location_name',
      render: (r) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {r.return_type === 'MAIN_TO_VENDOR' ? (r.vendor_name || 'Vendor Supplier') : (r.to_location_name || 'Main Store')}
        </span>
      )
    },
    {
      header: 'Return Reason',
      accessor: 'return_reason',
      render: (r) => (
        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
          r.return_reason === 'EXPIRED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
          r.return_reason === 'DAMAGED' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
          'bg-slate-100 text-slate-700 border border-slate-300'
        }`}>
          {r.return_reason}
        </span>
      )
    },
    {
      header: `Total Value (${currencyCode})`,
      accessor: 'total_val',
      render: (r) => <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(r.total_val, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Attached Document',
      accessor: 'document_url',
      render: (r) => r.document_url ? (
        <a
          href={r.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-[11px] font-bold hover:bg-emerald-100 transition-all shadow-2xs"
          title="Click to view attached document proof"
        >
          <Paperclip className="w-3.5 h-3.5" /> View File
        </a>
      ) : (
        <span className="text-slate-400 text-[11px] italic">No document</span>
      )
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (r) => <span className="font-mono text-slate-500 text-xs">{formatDate(r.created_at)}</span>
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-brand-orange" />
            Stock Returns & Defective Item Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">3-Way Stock Return Workflows: Clinic ➔ Sub-Branch, Sub-Branch ➔ Main Store, and Main Store ➔ Vendor Supplier</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 border border-purple-300 dark:border-purple-500/40 text-xs font-bold flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" />
            VAT Policy: {isNoVat ? 'NO VAT (0%)' : `${vatRate}% Tax`}
          </span>
          <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 text-xs font-bold">
            Stock Reversal & Deductions ({currencyCode})
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

      {/* Return Creation Form */}
      <form onSubmit={handlePostReturn} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        
        {/* Workflow Selector Tabs */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Select Stock Return Trajectory *</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            <button
              type="button"
              onClick={() => handleReturnTypeChange('CLINIC_TO_BRANCH')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                returnType === 'CLINIC_TO_BRANCH'
                  ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-200 shadow-sm font-bold ring-2 ring-amber-400/50'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900 text-amber-700">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">Clinic ➔ Sub-Branch Return</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Return stock from Clinic Outlet to Sub-Branch Hub</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleReturnTypeChange('BRANCH_TO_MAIN')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                returnType === 'BRANCH_TO_MAIN'
                  ? 'bg-blue-50 dark:bg-blue-950/80 border-brand-blue text-brand-blue dark:text-blue-200 shadow-sm font-bold ring-2 ring-brand-blue/50'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900 text-brand-blue">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block">Sub-Branch ➔ Main Store Return</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Return stock from Sub-Branch Hub to Main Warehouse</span>
              </div>
            </button>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => handleReturnTypeChange('MAIN_TO_VENDOR')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                !isAdmin
                  ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                  : returnType === 'MAIN_TO_VENDOR'
                  ? 'bg-purple-50 dark:bg-purple-950/80 border-purple-400 text-purple-900 dark:text-purple-200 shadow-sm font-bold ring-2 ring-purple-400/50'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
              title={!isAdmin ? 'Restricted to System Administrator Only' : 'Return stock back to Supplier'}
            >
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900 text-purple-700">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold block">Main Store ➔ Vendor Supplier</span>
                  {!isAdmin && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                      ADMIN ONLY
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Return defective/expired stock back to Supplier</span>
              </div>
            </button>

          </div>
        </div>

        {/* Source & Destination Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Source Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Source Location (Debited Stock) *</label>
            {returnType === 'CLINIC_TO_BRANCH' ? (
              <SearchableSelect
                placeholder="Select Source Clinic Outlet..."
                options={clinics.map(c => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                value={fromLocationId}
                onChange={handleSourceLocationChange}
              />
            ) : returnType === 'BRANCH_TO_MAIN' ? (
              isAdmin ? (
                <SearchableSelect
                  placeholder="Select Source Sub-Branch..."
                  options={subBranches.map(sb => ({ value: sb.id, label: `${sb.name} (${sb.code})` }))}
                  value={fromLocationId}
                  onChange={handleSourceLocationChange}
                />
              ) : (
                <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-xs h-10">
                  <span>{subBranches.find(s => s.id === fromLocationId || s.raw_id == fromLocationId)?.name || 'Assigned Sub-Branch'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-brand-blue/10 text-brand-blue border border-brand-blue/30 uppercase">
                    Locked to Logged-in Branch
                  </span>
                </div>
              )
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                Central Main Warehouse (LOC-MAIN-01)
              </div>
            )}
          </div>

          {/* Destination Location / Vendor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination (Credited Location / Vendor) *</label>
            {returnType === 'CLINIC_TO_BRANCH' ? (
              <SearchableSelect
                placeholder="Select Destination Sub-Branch..."
                options={subBranches.map(sb => ({ value: sb.id, label: `${sb.name} (${sb.code})` }))}
                value={toLocationId}
                onChange={(val) => setToLocationId(val)}
              />
            ) : returnType === 'BRANCH_TO_MAIN' ? (
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
                Central Main Warehouse (LOC-MAIN-01)
              </div>
            ) : (
              <SearchableSelect
                placeholder="Select Vendor Supplier..."
                options={vendors.map(v => ({ value: v.id, label: v.name, sublabel: `Code: ${v.code}` }))}
                value={vendorId}
                onChange={(val) => setVendorId(val)}
              />
            )}
          </div>

          {/* Return Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Stock Return Reason *</label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
            >
              <option value="EXCESS_STOCK">Excess Stock / Slow Moving Items</option>
              <option value="EXPIRED">Expired Stock Batch</option>
              <option value="DAMAGED">Damaged / Defective Goods</option>
              <option value="WRONG_ITEM">Wrong Item Delivered</option>
              <option value="OTHER">Other Reason (Specify in Remarks)</option>
            </select>
          </div>

        </div>

        {/* Remarks / Dispatch Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Return Remarks / Dispatch Note</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Returning 5 damaged boxes to vendor as per RMA agreement..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Line Items Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Select Batches to Return</h3>
            <button
              type="button"
              onClick={addLine}
              className="px-3.5 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 text-xs font-semibold hover:bg-rose-200 dark:hover:bg-rose-900/40 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Return Line
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 min-h-[380px] pb-48">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-12 text-center">#</th>
                  <th className="p-2.5 min-w-[420px]">Source Batch Code & Item *</th>
                  <th className="p-2.5 w-28 text-center">Stock Avail</th>
                  <th className="p-2.5 w-24 text-center">Return Qty *</th>
                  <th className="p-2.5 w-32 text-right">Unit Price ({currencyCode})</th>
                  <th className="p-2.5 w-32 text-right">Subtotal ({currencyCode})</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {(() => {
                  const batchQtyTotals = {};
                  const batchDuplicateCounts = {};

                  lineItems.forEach(l => {
                    if (l.batch_id) {
                      const bId = String(l.batch_id);
                      const qty = parseInt(l.qty) || 0;
                      batchQtyTotals[bId] = (batchQtyTotals[bId] || 0) + qty;
                      batchDuplicateCounts[bId] = (batchDuplicateCounts[bId] || 0) + 1;
                    }
                  });

                  return lineItems.map((line, index) => {
                    const price = parseFloat(line.unit_price || 0);
                    const qty = parseInt(line.qty) || 0;
                    const lineSubtotal = price * qty;

                    const bId = String(line.batch_id || '');
                    const cumulativeQty = batchQtyTotals[bId] || 0;
                    const maxStock = line.max_qty || 0;
                    const isDuplicateEntry = line.batch_id && (batchDuplicateCounts[bId] > 1);
                    const isCumulativeOverStock = line.batch_id && (cumulativeQty > maxStock);
                    const isRowWarning = isDuplicateEntry || isCumulativeOverStock;

                    return (
                      <tr
                        key={index}
                        className={`transition-all ${
                          isRowWarning
                            ? 'bg-rose-50/90 dark:bg-rose-950/60 border-2 border-rose-500'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50'
                        }`}
                      >
                        <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">{index + 1}</td>

                        <td className="p-1 min-w-[420px]">
                          <SearchableSelect
                            placeholder="Select Source Item Batch..."
                            options={availableStock.map(b => ({
                              value: b.batch_id || b.id,
                              label: `${b.item_name} [${b.batch_code}]`,
                              sublabel: `Code: ${b.item_code} | Exp: ${b.expiry_date} | Avail: ${b.quantity_available}`
                            }))}
                            value={line.batch_id}
                            onChange={(val) => handleLineChange(index, 'batch_id', val)}
                          />
                          {isRowWarning && (
                            <div className="mt-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/60 p-2 rounded-lg border border-rose-300 dark:border-rose-800 animate-in fade-in duration-150">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                              <span>
                                {isDuplicateEntry && isCumulativeOverStock
                                  ? `⚠️ DUPLICATE ENTRY BLOCKED! Total requested across lines (${cumulativeQty}) EXCEEDS available stock (${maxStock} units).`
                                  : isDuplicateEntry
                                  ? `⚠️ DUPLICATE ENTRY BLOCKED! Selected multiple times (Cumulative requested: ${cumulativeQty} / Available stock: ${maxStock} units).`
                                  : `⚠️ STOCK EXCEEDED! Requested (${cumulativeQty}) exceeds available stock (${maxStock} units).`}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="p-2.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                          {line.max_qty || 0}
                        </td>

                        <td className="p-1 text-center">
                          <input
                            type="number"
                            min="1"
                            max={line.max_qty || 9999}
                            value={line.qty}
                            onChange={(e) => handleLineChange(index, 'qty', parseInt(e.target.value) || 1)}
                            className={`w-20 bg-slate-50 dark:bg-slate-900 border rounded-lg p-1.5 text-xs text-center font-bold ${
                              isRowWarning ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50' : 'border-slate-300 dark:border-slate-800'
                            }`}
                          />
                        </td>

                        <td className="p-1 text-right">
                          <input
                            type="number"
                            step="any"
                            value={line.unit_price}
                            onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                            className="w-28 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1.5 text-xs text-right font-bold"
                          />
                        </td>

                        <td className="p-2.5 text-right font-bold font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(lineSubtotal, currencyCode, decimalPlaces)}
                        </td>

                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            disabled={lineItems.length === 1}
                            className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Document Attachment Upload Dropzone */}
          <div className="pt-4">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                <Paperclip className="w-4 h-4 text-rose-600" />
                Upload Return Proof / Photos / Document Attachment (Optional)
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Allowed: .pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png, .gif, .webp
              </span>
            </label>

            {!filePreview ? (
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-rose-500 dark:hover:border-rose-500 rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-950/40 transition-all group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden"
                />
                <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block group-hover:text-rose-600">
                    Click to browse or drop return proof document here
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Upload defective item photos, credit memo, RMA note, PDF or scanned return proof
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
                    <span className="text-[10px] text-slate-500 block">Size: {filePreview.size} • Attached</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Form Totals & Submit */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800 mt-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Gross Subtotal:</span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{formatCurrency(grossSubtotal, currencyCode, decimalPlaces)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-bold">VAT Amount ({vatRate}%):</span>
                <span className="text-sm font-bold font-mono text-purple-600 dark:text-purple-400">{formatCurrency(vatAmount, currencyCode, decimalPlaces)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-bold">Grand Total Value:</span>
                <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{formatCurrency(grandTotalVal, currencyCode, decimalPlaces)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-800 text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
            >
              {submitting ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Dispatch Stock Return Invoice
                </>
              )}
            </button>
          </div>

        </div>
      </form>

      {/* Return History Table */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-orange" />
          Stock Returns History & Audit Log ({returnsList.length} Transactions)
        </h3>
        <DataTable
          columns={historyColumns}
          data={returnsList}
          searchPlaceholder="Search return #, location, vendor, or reason..."
          defaultPageSize={10}
        />
      </div>

      {/* Selected Return Details Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-4xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                  Stock Return Details: <span className="font-mono text-rose-600">{selectedReturn.return_no}</span>
                </h3>
                <p className="text-xs text-slate-500">Breakdown of returned items, batch numbers, stock reversal and attached proof</p>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Grid Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Workflow Trajectory</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  {selectedReturn.return_type === 'CLINIC_TO_BRANCH' ? 'Clinic ➔ Sub-Branch' :
                   selectedReturn.return_type === 'BRANCH_TO_MAIN' ? 'Sub-Branch ➔ Main Store' :
                   'Main Store ➔ Vendor'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Source Location</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedReturn.from_location_name || 'Main Warehouse'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Destination</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedReturn.return_type === 'MAIN_TO_VENDOR' ? selectedReturn.vendor_name : selectedReturn.to_location_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Return Reason</span>
                <span className="font-bold text-rose-600">{selectedReturn.return_reason}</span>
              </div>

              {selectedReturn.document_url && (
                <div className="col-span-2 md:col-span-4 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs">Return Proof / Attachment Document Available</span>
                  </div>
                  <a
                    href={selectedReturn.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Document Attachment
                  </a>
                </div>
              )}
            </div>

            {/* Item Line Items Breakdown */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Item Name & Code</th>
                    <th className="p-3 w-32">Batch Code</th>
                    <th className="p-3 w-20 text-center">Return Qty</th>
                    <th className="p-3 w-28 text-right">Unit Cost ({currencyCode})</th>
                    <th className="p-3 w-28 text-right">Subtotal ({currencyCode})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {selectedReturn.items && selectedReturn.items.length > 0 ? (
                    selectedReturn.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">{item.item_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Code: {item.item_code} • UOM: {item.unit_of_measure}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {item.batch_code}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600">
                          {item.qty}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(item.unit_price, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.subtotal, currencyCode, decimalPlaces)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-slate-400">No item lines found for this return record.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-500">
                Created by: <strong>{selectedReturn.created_by_name}</strong> on {formatDate(selectedReturn.created_at)}
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Return Value</span>
                <span className="text-xl font-black text-rose-600 font-heading">
                  {formatCurrency(selectedReturn.total_val, currencyCode, decimalPlaces)}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
