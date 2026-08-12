import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { GitPullRequest, Plus, Trash2, CheckCircle2, AlertCircle, Building2, HelpCircle, X, DollarSign, FileText, Calendar, Wallet, Receipt, Filter, History, ArrowRight } from 'lucide-react';

export default function SubBranchInvoicing() {
  const [subBranches, setSubBranches] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Filter State
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');

  // Form State
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTransferDetail, setSelectedTransferDetail] = useState(null);
  const [paymentModalTransfer, setPaymentModalTransfer] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

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

      if (branches.length > 0 && !toLocationId) {
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
  const vatRate = parseFloat(settings.vat_percent || 10.00);

  const handleLineChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    if (field === 'batch_id') {
      const selectedBatch = availableStock.find(b => b.batch_id == value || b.id == value);
      if (selectedBatch) {
        updated[index].item_id = selectedBatch.item_id;
        updated[index].raw_item_id = selectedBatch.raw_item_id || selectedBatch.item_id;
        updated[index].raw_batch_id = selectedBatch.raw_batch_id || selectedBatch.raw_id || selectedBatch.batch_id || selectedBatch.id;
        updated[index].unit_price = selectedBatch.selling_price || selectedBatch.purchase_price;
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

  const handleKeyDownOnQty = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === lineItems.length - 1) {
        addLine();
      }
    }
  };

  // Calculations for current transfer draft form
  const grossSubtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.unit_price || 0) * (parseInt(item.qty) || 0)), 0);
  const vatAmount = grossSubtotal * (vatRate / 100);
  const grandTotalVal = grossSubtotal + vatAmount;

  const validateTransfer = () => {
    setMessage(null);
    if (!toLocationId) {
      setMessage({ type: 'error', text: 'Please select a destination sub-branch location.' });
      return false;
    }
    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      if (!line.batch_id || line.qty <= 0) {
        setMessage({ type: 'error', text: `Line #${i + 1} requires a valid batch selection and transfer quantity > 0.` });
        return false;
      }
      if (line.qty > line.max_qty) {
        setMessage({ type: 'error', text: `Line #${i + 1} quantity (${line.qty}) exceeds available stock (${line.max_qty}).` });
        return false;
      }
    }
    return true;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    if (validateTransfer()) {
      setShowConfirmModal(true);
    }
  };

  const executeCreateTransfer = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const destBranch = subBranches.find(b => b.id === toLocationId || b.raw_id == toLocationId);

      const payload = {
        from_location_id: 1, // Main Branch
        to_location_id: toLocationId,
        raw_to_location_id: destBranch?.raw_id,
        vat_percent: vatRate,
        remarks: remarks,
        items: lineItems.map(item => ({
          item_id: item.item_id,
          raw_item_id: item.raw_item_id,
          batch_id: item.batch_id,
          raw_batch_id: item.raw_batch_id,
          qty: item.qty,
          unit_price: item.unit_price
        }))
      };

      const res = await apiFetch('/transfer/branch', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Branch Transfer ${res.invoice_no} posted successfully with separated VAT and stock debited!` });
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

  // Payment Recording
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalTransfer || !paymentAmountInput || parseFloat(paymentAmountInput) <= 0) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/transfer/record-payment', {
        method: 'POST',
        body: JSON.stringify({
          transfer_id: paymentModalTransfer.id,
          raw_transfer_id: paymentModalTransfer.raw_id,
          amount_paid: paymentAmountInput
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setPaymentModalTransfer(null);
        setPaymentAmountInput('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to record payment' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter transfers list by Branch Filter
  const branchInvoicedTransfers = transfers.filter(t => t.transfer_type === 'BRANCH_INVOICED');

  const filteredTransfers = branchInvoicedTransfers.filter(t => {
    if (selectedBranchFilter === 'ALL') return true;
    return (
      String(t.to_location_id) === String(selectedBranchFilter) ||
      String(t.raw_to_location_id) === String(selectedBranchFilter)
    );
  });

  // Calculate Metrics Across Filtered / All Sub-Branches
  const summaryMetrics = filteredTransfers.reduce((acc, tr) => {
    const grand = parseFloat(tr.total_val || 0);
    const sub = parseFloat(tr.subtotal || (grand / 1.10));
    const vat = parseFloat(tr.vat_amount || (grand - sub));
    const paid = parseFloat(tr.paid_amount || grand);
    const pending = parseFloat(tr.pending_balance || Math.max(0, grand - paid));

    acc.totalGrand += grand;
    acc.totalSubtotal += sub;
    acc.totalVat += vat;
    acc.totalPaid += paid;
    acc.totalPending += pending;
    return acc;
  }, { totalGrand: 0, totalSubtotal: 0, totalVat: 0, totalPaid: 0, totalPending: 0 });

  const destinationBranchObj = subBranches.find(b => b.id === toLocationId || b.raw_id == toLocationId);

  const transferColumns = [
    {
      header: 'Invoice # / Transfer #',
      accessor: 'invoice_no',
      render: (t) => (
        <button
          type="button"
          onClick={() => setSelectedTransferDetail(t)}
          className="text-left font-mono font-bold text-brand-blue hover:underline cursor-pointer flex items-center gap-1 group"
          title="Click to view full line items, VAT breakdown & stock movement ledger"
        >
          <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          {t.invoice_no || t.transfer_no}
        </button>
      )
    },
    {
      header: 'Sub-Branch Location',
      accessor: 'to_location_name',
      render: (t) => <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-brand-blue" /> {t.to_location_name}</span>
    },
    {
      header: 'Dispatch Date',
      accessor: 'dispatched_at',
      render: (t) => <span className="text-slate-500 font-mono">{formatDate(t.dispatched_at)}</span>
    },
    {
      header: `Net Subtotal (${currencyCode})`,
      accessor: 'subtotal',
      render: (t) => {
        const grand = parseFloat(t.total_val || 0);
        const sub = parseFloat(t.subtotal || (grand / 1.10));
        return <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(sub, currencyCode, decimalPlaces)}</span>;
      }
    },
    {
      header: `VAT Tax (${currencyCode})`,
      accessor: 'vat_amount',
      render: (t) => {
        const grand = parseFloat(t.total_val || 0);
        const sub = parseFloat(t.subtotal || (grand / 1.10));
        const vat = parseFloat(t.vat_amount || (grand - sub));
        return <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{formatCurrency(vat, currencyCode, decimalPlaces)}</span>;
      }
    },
    {
      header: `Grand Total (${currencyCode})`,
      accessor: 'total_val',
      render: (t) => <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">{formatCurrency(t.total_val, currencyCode, decimalPlaces)}</span>
    },
    {
      header: `Payment Received (${currencyCode})`,
      accessor: 'paid_amount',
      render: (t) => <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(t.paid_amount ?? t.total_val, currencyCode, decimalPlaces)}</span>
    },
    {
      header: `Pending Balance (${currencyCode})`,
      accessor: 'pending_balance',
      render: (t) => {
        const pending = parseFloat(t.pending_balance || 0);
        return (
          <span className={`font-mono font-black ${pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {formatCurrency(pending, currencyCode, decimalPlaces)}
          </span>
        );
      }
    },
    {
      header: 'Payment Status',
      accessor: 'payment_status',
      render: (t) => {
        const status = t.payment_status || (t.pending_balance > 0 ? 'PARTIAL' : 'PAID');
        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            status === 'PAID'
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
              : status === 'PARTIAL'
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300'
              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
          }`}>
            {status}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (t) => {
        const pending = parseFloat(t.pending_balance || 0);
        return (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setSelectedTransferDetail(t)}
              className="p-1.5 text-slate-600 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-semibold flex items-center gap-1"
              title="View Invoice Breakdown & Ledger"
            >
              <FileText className="w-4 h-4 text-brand-blue" />
            </button>

            {pending > 0 ? (
              <button
                onClick={() => {
                  setPaymentModalTransfer(t);
                  setPaymentAmountInput(pending.toFixed(3));
                }}
                className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold rounded-xl text-[11px] shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="Record Payment Received Against Invoice"
              >
                <DollarSign className="w-3.5 h-3.5" /> Receive Payment
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                ✓ Fully Paid
              </span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-brand-blue" />
            Sub-Branch Invoicing, Tax Breakdown & Balance Ledger
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Generate sub-branch stock transfer invoices with separated VAT and track payments & total pending balance across all branches in {currencyCode}</p>
        </div>

        {/* Branch Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-blue" />
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
          >
            <option value="ALL">All Sub-Branches ({subBranches.length})</option>
            {subBranches.map(b => (
              <option key={b.id} value={b.raw_id || b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
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

      {/* ADMIN FINANCIAL METRICS DASHBOARD CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Grand Invoiced */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Invoiced</span>
            <Receipt className="w-4 h-4 text-brand-blue" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-heading">
            {formatCurrency(summaryMetrics.totalGrand, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-slate-500">Grand Total across all invoices</p>
        </div>

        {/* Total Net Subtotal */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net (Excl. VAT)</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-black text-slate-800 dark:text-slate-200 font-heading">
            {formatCurrency(summaryMetrics.totalSubtotal, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-slate-500">Net goods subtotal value</p>
        </div>

        {/* Separated Total VAT */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total VAT ({vatRate}%)</span>
            <Receipt className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400 font-heading">
            {formatCurrency(summaryMetrics.totalVat, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-purple-500/80 font-semibold">Separated VAT tax portion</p>
        </div>

        {/* Total Payment Received */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Payment Received</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading">
            {formatCurrency(summaryMetrics.totalPaid, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-emerald-600/80 font-semibold">Collected branch payments</p>
        </div>

        {/* Total Pending Balance */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Balance</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <p className={`text-lg font-black font-heading ${summaryMetrics.totalPending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {formatCurrency(summaryMetrics.totalPending, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-rose-500/80 font-semibold">Outstanding balance due</p>
        </div>
      </div>

      {/* Main Grid: Create Transfer Form */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <form onSubmit={handleOpenConfirm} className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-blue" /> Dispatch New Sub-Branch Stock Transfer & Invoice
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-brand-blue border border-blue-200">
              VAT Rate: {vatRate}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Sub-Branch Location *</label>
              <SearchableSelect
                placeholder="Select Destination Sub-Branch..."
                options={subBranches.map(b => ({ value: b.id, label: `${b.name} (${b.code})`, sublabel: `Location Code: ${b.code}` }))}
                value={toLocationId}
                onChange={(val) => setToLocationId(val)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transfer Remarks / Notes</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional transfer remarks or dispatch note..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-semibold"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 min-h-[380px] pb-48">
            <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-12 text-center">#</th>
                  <th className="p-2.5 min-w-[420px]">Main Store Batch Code & Item *</th>
                  <th className="p-2.5 w-28 text-center">Qty Available</th>
                  <th className="p-2.5 w-24 text-center">Transfer Qty *</th>
                  <th className="p-2.5 w-32 text-right">Selling Price ({currencyCode})</th>
                  <th className="p-2.5 w-32 text-right">Subtotal ({currencyCode})</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {lineItems.map((line, index) => {
                  const lineSubtotal = (parseFloat(line.unit_price || 0) * (parseInt(line.qty) || 0));

                  return (
                    <tr key={index} className="bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-950/50">
                      <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">{index + 1}</td>

                      <td className="p-1 min-w-[420px]">
                        <SearchableSelect
                          placeholder="Select Main Branch Item Batch..."
                          options={availableStock.map(b => ({
                            value: b.batch_id || b.id,
                            label: `${b.item_name} [${b.batch_code}]`,
                            sublabel: `Code: ${b.item_code} | Exp: ${b.expiry_date} | Avail: ${b.quantity_available}`
                          }))}
                          value={line.batch_id}
                          onChange={(val) => handleLineChange(index, 'batch_id', val)}
                        />
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
                          onKeyDown={(e) => handleKeyDownOnQty(e, index)}
                          onChange={(e) => handleLineChange(index, 'qty', parseInt(e.target.value) || 1)}
                          className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1.5 text-xs text-center font-bold"
                        />
                      </td>

                      <td className="p-1 text-right">
                        <input
                          type="number"
                          step="0.001"
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
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={addLine}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Batch Line Item
            </button>

            {/* Total Summary Footer */}
            <div className="flex items-center gap-6 text-xs font-bold">
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Net Subtotal (Excl. VAT):</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono text-sm">
                  {formatCurrency(grossSubtotal, currencyCode, decimalPlaces)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-purple-500 block text-[10px]">VAT Tax ({vatRate}%):</span>
                <span className="text-purple-600 dark:text-purple-400 font-mono text-sm">
                  {formatCurrency(vatAmount, currencyCode, decimalPlaces)}
                </span>
              </div>

              <div className="text-right pl-4 border-l border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[10px]">Grand Total (Incl. VAT):</span>
                <span className="text-lg font-black text-brand-blue font-heading font-mono">
                  {formatCurrency(grandTotalVal, currencyCode, decimalPlaces)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 font-heading"
            >
              {submitting ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Dispatch Sub-Branch Transfer & Issue Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-brand-blue">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/80 rounded-2xl border border-blue-200 dark:border-blue-800">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">Confirm Sub-Branch Transfer</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Do you want to dispatch this Sub-Branch Stock Transfer?</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Destination Sub-Branch:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{destinationBranchObj?.name || 'Selected Sub-Branch'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Line Items:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{lineItems.length} Batch Line(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Net Goods Subtotal:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(grossSubtotal, currencyCode, decimalPlaces)}</span>
              </div>
              <div className="flex justify-between text-purple-600 dark:text-purple-400">
                <span className="font-semibold">Separated VAT ({vatRate}%):</span>
                <span className="font-bold">{formatCurrency(vatAmount, currencyCode, decimalPlaces)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-semibold">Grand Total Payable:</span>
                <span className="font-black text-brand-blue text-sm">
                  {formatCurrency(grandTotalVal, currencyCode, decimalPlaces)}
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
                onClick={executeCreateTransfer}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Dispatch & Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {paymentModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">Record Sub-Branch Payment Received</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {paymentModalTransfer.invoice_no || paymentModalTransfer.transfer_no}</p>
                </div>
              </div>
              <button onClick={() => setPaymentModalTransfer(null)} className="p-2 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sub-Branch Location:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{paymentModalTransfer.to_location_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Invoice Grand Total:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(paymentModalTransfer.total_val, currencyCode, decimalPlaces)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Already Paid:</span>
                  <span>{formatCurrency(paymentModalTransfer.paid_amount || 0, currencyCode, decimalPlaces)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold border-t border-slate-200 dark:border-slate-800 pt-1">
                  <span>Outstanding Pending Balance:</span>
                  <span>{formatCurrency(paymentModalTransfer.pending_balance, currencyCode, decimalPlaces)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Enter Received Payment Amount ({currencyCode}) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max={paymentModalTransfer.pending_balance}
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-bold font-mono focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalTransfer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Breakdown & Stock Movement Ledger Detail Modal */}
      {selectedTransferDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-5xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 text-brand-blue rounded-2xl border border-blue-200 dark:border-blue-800">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                      Sub-Branch Invoice: {selectedTransferDetail.invoice_no || selectedTransferDetail.transfer_no}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-brand-blue text-[10px] font-bold border border-blue-300">
                      BRANCH INVOICED
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Complete items breakdown, separated VAT & stock movement ledger entries</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTransferDetail(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Destination Sub-Branch</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-blue" />
                  {selectedTransferDetail.to_location_name}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Dispatch Date</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 mt-0.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  {formatDate(selectedTransferDetail.dispatched_at)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Issued By</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {selectedTransferDetail.created_by_name || 'Store Manager'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">Payment Status</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {selectedTransferDetail.payment_status || 'PAID'} (Paid: {formatCurrency(selectedTransferDetail.paid_amount ?? selectedTransferDetail.total_val, currencyCode, decimalPlaces)})
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Invoiced Batch Line Items ({selectedTransferDetail.items?.length || 0})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Item Name & Code</th>
                      <th className="p-3">Batch Code</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3 text-center">Transfer Qty</th>
                      <th className="p-3 text-right">Unit Price ({currencyCode})</th>
                      <th className="p-3 text-right">Subtotal ({currencyCode})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {(selectedTransferDetail.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50">
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.item_name}</p>
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {item.item_code}</p>
                        </td>
                        <td className="p-3 font-mono font-bold text-brand-blue">{item.batch_code}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{formatDate(item.expiry_date)}</td>
                        <td className="p-3 text-center font-extrabold text-slate-900 dark:text-slate-100">{item.qty}</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(item.unit_price, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.subtotal, currencyCode, decimalPlaces)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stock Movements Ledger Logs Section */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-brand-blue" />
                Immutable Stock Movement Ledger Entries ({selectedTransferDetail.ledger_movements?.length || 0})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/60 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Ref #</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Item & Batch</th>
                      <th className="p-2.5">From Branch ➔ To Branch</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(selectedTransferDetail.ledger_movements || []).map((mov, mIdx) => (
                      <tr key={mIdx} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-mono font-bold text-brand-blue text-[11px]">{mov.reference_no}</td>
                        <td className="p-2.5 font-bold text-emerald-600 text-[10px]">{mov.transaction_type}</td>
                        <td className="p-2.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{mov.item_name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{mov.batch_code}</p>
                        </td>
                        <td className="p-2.5 text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">{mov.from_location_name}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                          <span className="font-bold text-slate-900 dark:text-slate-100">{mov.to_location_name}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold font-mono">{mov.qty}</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(mov.unit_price, currencyCode, decimalPlaces)}</td>
                        <td className="p-2.5 font-mono text-slate-400 text-[10px]">{formatDate(mov.timestamp)}</td>
                      </tr>
                    ))}
                    {(!selectedTransferDetail.ledger_movements || selectedTransferDetail.ledger_movements.length === 0) && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                          No ledger movement logs found for reference {selectedTransferDetail.transfer_no}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Footer Summary */}
            <div className="flex justify-between items-center p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
              <div className="space-y-1">
                <p className="text-slate-500">Net Goods Subtotal: <strong className="text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(selectedTransferDetail.subtotal || (selectedTransferDetail.total_val / 1.10), currencyCode, decimalPlaces)}</strong></p>
                <p className="text-purple-600 dark:text-purple-400 font-semibold">Separated VAT ({vatRate}%): <strong className="font-mono">{formatCurrency(selectedTransferDetail.vat_amount || (selectedTransferDetail.total_val - (selectedTransferDetail.total_val / 1.10)), currencyCode, decimalPlaces)}</strong></p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] font-bold">GRAND TOTAL INVOICED AMOUNT</span>
                <span className="text-xl font-black text-brand-blue font-heading">
                  {formatCurrency(selectedTransferDetail.total_val, currencyCode, decimalPlaces)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTransferDetail(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <DataTable
        title={`Sub-Branch Invoices & Transfers History (${selectedBranchFilter === 'ALL' ? 'All Sub-Branches' : destinationBranchObj?.name || 'Selected Sub-Branch'})`}
        subtitle={`Audit and review all branch transfers, separated VAT tax, payment received & pending balance in ${currencyCode}`}
        columns={transferColumns}
        data={filteredTransfers}
        searchable={true}
        defaultPageSize={10}
      />
    </div>
  );
}
