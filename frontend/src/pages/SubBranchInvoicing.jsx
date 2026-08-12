import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { GitPullRequest, Plus, Trash2, CheckCircle2, AlertCircle, Building2, HelpCircle, X, DollarSign, FileText, Calendar, Wallet, Receipt, Filter, History, ArrowRight, BookOpen, Landmark, CreditCard } from 'lucide-react';

function getFirstDayOfCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function getLastDayOfCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export default function SubBranchInvoicing() {
  const [subBranches, setSubBranches] = useState([]);
  const [availableStock, setAvailableStock] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [settings, setSettings] = useState({ vat_percent: '10.00', vat_calculation_mode: 'ITEM_WISE', currency_code: 'BHD', decimal_places: '3', date_format: 'DD/MM/YYYY' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Filter State
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');

  // Date Filter State (Defaults to Current Month)
  const [startDateFilter, setStartDateFilter] = useState(getFirstDayOfCurrentMonth());
  const [endDateFilter, setEndDateFilter] = useState(getLastDayOfCurrentMonth());

  // Form State
  const [toLocationId, setToLocationId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState([createEmptyLine()]);

  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedTransferDetail, setSelectedTransferDetail] = useState(null);
  const [paymentModalTransfer, setPaymentModalTransfer] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // Payment Method & Reference Inputs
  const [paymentMethodInput, setPaymentMethodInput] = useState('CASH');
  const [bankNameInput, setBankNameInput] = useState('');
  const [bankRefInput, setBankRefInput] = useState('');
  const [chequeNoInput, setChequeNoInput] = useState('');
  const [chequeDateInput, setChequeDateInput] = useState('');
  const [paymentRemarksInput, setPaymentRemarksInput] = useState('');

  // Branch Ledger Trajectory Modal State
  const [showBranchLedgerModal, setShowBranchLedgerModal] = useState(false);
  const [branchLedgerTab, setBranchLedgerTab] = useState('invoices'); // 'invoices' | 'movements'

  const handlePresetThisMonth = () => {
    setStartDateFilter(getFirstDayOfCurrentMonth());
    setEndDateFilter(getLastDayOfCurrentMonth());
  };

  const handlePresetLastMonth = () => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, prevMonthDate.getMonth() + 1, 0).getDate();
    setStartDateFilter(`${year}-${month}-01`);
    setEndDateFilter(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
  };

  const handlePresetAllTime = () => {
    setStartDateFilter('');
    setEndDateFilter('');
  };

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
  const isNoVat = settings.vat_calculation_mode === 'NO_VAT' || parseFloat(settings.vat_percent || 0) === 0;
  const isTaxInclusive = !isNoVat && settings.price_tax_type === 'INCLUSIVE';
  const vatRate = isNoVat ? 0 : parseFloat(settings.vat_percent || 10.00);

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

  // Calculations for current transfer draft form according to NO_VAT & INCLUSIVE/EXCLUSIVE policies
  let grossSubtotal = 0;
  let vatAmount = 0;
  let grandTotalVal = 0;

  lineItems.forEach(item => {
    const price = parseFloat(item.unit_price || 0);
    const qty = parseInt(item.qty) || 0;
    const lineTotal = price * qty;

    if (isNoVat) {
      grossSubtotal += lineTotal;
      grandTotalVal += lineTotal;
    } else if (isTaxInclusive) {
      const lineSub = lineTotal / (1 + (vatRate / 100));
      const lineVat = lineTotal - lineSub;
      grossSubtotal += lineSub;
      vatAmount += lineVat;
      grandTotalVal += lineTotal;
    } else {
      // Tax Exclusive
      const lineVat = lineTotal * (vatRate / 100);
      grossSubtotal += lineTotal;
      vatAmount += lineVat;
      grandTotalVal += (lineTotal + lineVat);
    }
  });

  const validateTransfer = () => {
    setMessage(null);
    if (!toLocationId) {
      setMessage({ type: 'error', text: 'Please select a destination sub-branch location.' });
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
        setMessage({ type: 'error', text: `Line #${i + 1} requires a valid batch selection and transfer quantity > 0.` });
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
          text: `Stock transfer blocked: Cumulative requested quantity (${cumulativeQty}) for batch '${batchCode}' exceeds available stock (${availStock} units).`
        });
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
          amount_paid: paymentAmountInput,
          payment_method: paymentMethodInput,
          bank_name: bankNameInput,
          bank_reference: bankRefInput,
          cheque_no: chequeNoInput,
          cheque_date: chequeDateInput,
          remarks: paymentRemarksInput
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setPaymentModalTransfer(null);
        setPaymentAmountInput('');
        setPaymentMethodInput('CASH');
        setBankNameInput('');
        setBankRefInput('');
        setChequeNoInput('');
        setChequeDateInput('');
        setPaymentRemarksInput('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to record payment' });
    } finally {
      setSubmitting(false);
    }
  };

  const dateFormat = settings.date_format || 'DD/MM/YYYY';

  // Helper to extract YYYY-MM-DD string from transfer date
  const getTransferDateStr = (t) => {
    const raw = t.dispatched_at || t.created_at;
    if (!raw) return '';
    return String(raw).substring(0, 10);
  };

  // 1. Filter transfers list by Branch Filter first
  const branchInvoicedTransfers = transfers.filter(t => t.transfer_type === 'BRANCH_INVOICED');

  const branchFilteredTransfers = branchInvoicedTransfers.filter(t => {
    if (selectedBranchFilter === 'ALL') return true;
    return (
      String(t.to_location_id) === String(selectedBranchFilter) ||
      String(t.raw_to_location_id) === String(selectedBranchFilter)
    );
  });

  // 2. Prior Period Transfers (Before startDateFilter) -> Carry Forward Balance
  const priorPeriodTransfers = branchFilteredTransfers.filter(t => {
    if (!startDateFilter) return false;
    const tDate = getTransferDateStr(t);
    return tDate < startDateFilter;
  });

  // 3. Current Selected Period Transfers (Between startDateFilter and endDateFilter)
  const filteredTransfers = branchFilteredTransfers.filter(t => {
    const tDate = getTransferDateStr(t);
    if (startDateFilter && tDate < startDateFilter) return false;
    if (endDateFilter && tDate > endDateFilter) return false;
    return true;
  });

  // Carry Forward Metrics from Prior Periods
  const carryForwardMetrics = priorPeriodTransfers.reduce((acc, tr) => {
    const grand = parseFloat(tr.total_val || 0);
    const sub = parseFloat(tr.subtotal || (grand / 1.10));
    const vat = parseFloat(tr.vat_amount || (grand - sub));
    const paid = parseFloat(tr.paid_amount || 0);
    const pending = parseFloat(tr.pending_balance || Math.max(0, grand - paid));

    acc.totalGrand += grand;
    acc.totalPaid += paid;
    acc.totalPending += pending;
    return acc;
  }, { totalGrand: 0, totalPaid: 0, totalPending: 0 });

  // Current Selected Period Metrics
  const summaryMetrics = filteredTransfers.reduce((acc, tr) => {
    const grand = parseFloat(tr.total_val || 0);
    const sub = parseFloat(tr.subtotal || (grand / 1.10));
    const vat = parseFloat(tr.vat_amount || (grand - sub));
    const paid = parseFloat(tr.paid_amount || 0);
    const pending = parseFloat(tr.pending_balance || Math.max(0, grand - paid));

    acc.totalGrand += grand;
    acc.totalSubtotal += sub;
    acc.totalVat += vat;
    acc.totalPaid += paid;
    acc.totalPending += pending;
    return acc;
  }, { totalGrand: 0, totalSubtotal: 0, totalVat: 0, totalPaid: 0, totalPending: 0 });

  // Net Total Outstanding Balance = Carry Forward Pending + Current Period Pending
  const netTotalOutstanding = carryForwardMetrics.totalPending + summaryMetrics.totalPending;

  const destinationBranchObj = subBranches.find(b => b.id === toLocationId || b.raw_id == toLocationId);
  const selectedBranchObj = subBranches.find(b => b.id === selectedBranchFilter || b.raw_id == selectedBranchFilter);

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
      render: (t) => <span className="text-slate-500 font-mono">{formatDate(t.dispatched_at, dateFormat)}</span>
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
              type="button"
              onClick={() => setSelectedTransferDetail(t)}
              className="px-2.5 py-1 text-slate-700 dark:text-slate-200 hover:text-brand-blue bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-xl transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="View Complete Invoice Breakdown & Ledger"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
              View Ledger
            </button>

            {pending > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setPaymentModalTransfer(t);
                  setPaymentAmountInput(pending.toFixed(decimalPlaces));
                  setPaymentMethodInput('CASH');
                  setBankNameInput('');
                  setBankRefInput('');
                  setChequeNoInput('');
                  setChequeDateInput('');
                  setPaymentRemarksInput('');
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

        {/* Branch Filter Dropdown & View Branch Ledger Option */}
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

          <button
            type="button"
            onClick={() => setShowBranchLedgerModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-brand-blue to-blue-600 hover:brightness-110 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="See All Ledger Transactions of Selected Branch"
          >
            <BookOpen className="w-3.5 h-3.5" /> View Branch Ledger
          </button>
        </div>
      </div>

      {/* Date Between Filter & Presets Toolbar */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 text-xs w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-brand-blue" />
            <span>Filter Period (Date Between):</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePresetThisMonth}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                startDateFilter === getFirstDayOfCurrentMonth() && endDateFilter === getLastDayOfCurrentMonth()
                  ? 'bg-brand-blue text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              This Month (Default)
            </button>
            <button
              type="button"
              onClick={handlePresetLastMonth}
              className="px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={handlePresetAllTime}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                !startDateFilter && !endDateFilter
                  ? 'bg-brand-blue text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Date Display Format Indicator */}
        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 self-end md:self-auto">
          <span>Admin Display Format:</span>
          <span className="font-bold text-brand-blue bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
            {dateFormat}
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

      {/* ADMIN FINANCIAL METRICS DASHBOARD CARDS WITH CARRY FORWARD OPENING BALANCE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Carry Forward (Opening) Balance */}
        <div className="bg-amber-50/50 dark:bg-amber-950/30 glass-panel p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Carry Forward Opening</span>
            <History className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-black text-amber-700 dark:text-amber-300 font-heading">
            {formatCurrency(carryForwardMetrics.totalPending, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-amber-600/80 font-semibold truncate">
            {startDateFilter ? `Unpaid prior to ${formatDate(startDateFilter, dateFormat)}` : 'No date filter limit'}
          </p>
        </div>

        {/* Card 2: Selected Period Invoiced */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Period Invoiced</span>
            <Receipt className="w-4 h-4 text-brand-blue" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-heading">
            {formatCurrency(summaryMetrics.totalGrand, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-slate-500 font-medium">Invoiced in selected range</p>
        </div>

        {/* Card 3: Period Payment Received */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Period Payments</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-heading">
            {formatCurrency(summaryMetrics.totalPaid, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-emerald-600/80 font-semibold">Collected in selected range</p>
        </div>

        {/* Card 4: Period Pending Balance */}
        <div className="bg-white dark:bg-slate-900 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Period Pending</span>
            <DollarSign className="w-4 h-4 text-rose-500" />
          </div>
          <p className={`text-lg font-black font-heading ${summaryMetrics.totalPending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
            {formatCurrency(summaryMetrics.totalPending, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-rose-500/80 font-semibold">Unpaid in selected range</p>
        </div>

        {/* Card 5: Net Total Outstanding Balance (Carry Forward + Period Pending) */}
        <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 glass-panel p-4 rounded-2xl border border-rose-200 dark:border-rose-800/80 space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[11px] font-extrabold uppercase tracking-wider">Net Total Outstanding</span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-lg font-black text-rose-700 dark:text-rose-300 font-heading">
            {formatCurrency(netTotalOutstanding, currencyCode, decimalPlaces)}
          </p>
          <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-extrabold">
            Carry Forward + Period Pending
          </p>
        </div>
      </div>

      {/* Main Grid: Create Transfer Form */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <form onSubmit={handleOpenConfirm} className="space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-blue" /> Dispatch New Sub-Branch Stock Transfer & Invoice
            </h3>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              isNoVat
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                : 'bg-blue-50 dark:bg-blue-950 text-brand-blue border-blue-200'
            }`}>
              {isNoVat ? '🚫 NO VAT (0% Tax Exempt)' : `VAT Rate: ${vatRate}% (${isTaxInclusive ? 'Tax Inclusive' : 'Tax Exclusive'})`}
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
                    const rawTotal = price * qty;
                    const lineSubtotal = isNoVat
                      ? rawTotal
                      : isTaxInclusive
                      ? rawTotal / (1 + (vatRate / 100))
                      : rawTotal;

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
                            placeholder="Select Main Branch Item Batch..."
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
                            onKeyDown={(e) => handleKeyDownOnQty(e, index)}
                            onChange={(e) => handleLineChange(index, 'qty', parseInt(e.target.value) || 1)}
                            className={`w-20 bg-slate-50 dark:bg-slate-900 border rounded-lg p-1.5 text-xs text-center font-bold ${
                              isRowWarning ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50/50' : 'border-slate-300 dark:border-slate-800'
                            }`}
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
                });
                })()}
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

      {/* Receive Payment Modal with Payment Method Marking & References */}
      {paymentModalTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
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
              <button onClick={() => setPaymentModalTransfer(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
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

              {/* Payment Method Selector Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Select Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('CASH')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethodInput === 'CASH'
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-emerald-600" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('BANK_TRANSFER')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethodInput === 'BANK_TRANSFER'
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <Landmark className="w-4 h-4 text-blue-600" /> Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodInput('CHEQUE')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethodInput === 'CHEQUE'
                        ? 'bg-purple-50 dark:bg-purple-950 border-purple-500 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-purple-600" /> Cheque
                  </button>
                </div>
              </div>

              {/* Payment Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Received Payment Amount ({currencyCode}) *</label>
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

              {/* Dynamic Reference Section: Bank Transfer */}
              {paymentMethodInput === 'BANK_TRANSFER' && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800/80 space-y-3 animate-in fade-in duration-150">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" /> Bank Transfer Reference Details
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. National Bank of Bahrain / BBK / HSBC"
                      value={bankNameInput}
                      onChange={(e) => setBankNameInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank Reference / Transaction Ref # *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TRX-9920194827"
                      value={bankRefInput}
                      onChange={(e) => setBankRefInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Reference Section: Cheque */}
              {paymentMethodInput === 'CHEQUE' && (
                <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/80 space-y-3 animate-in fade-in duration-150">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> Cheque Reference Details
                  </p>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Cheque Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CHQ-445892"
                      value={chequeNoInput}
                      onChange={(e) => setChequeNoInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Issuing Bank Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BBK Bank"
                        value={bankNameInput}
                        onChange={(e) => setBankNameInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Cheque Date *</label>
                      <input
                        type="date"
                        required
                        value={chequeDateInput}
                        onChange={(e) => setChequeDateInput(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional payment notes or deposit account details..."
                  value={paymentRemarksInput}
                  onChange={(e) => setPaymentRemarksInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Breakdown & Stock / Financial Payment Ledger Detail Modal */}
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Complete items breakdown, separated VAT, payment receipt history & stock movement ledger entries</p>
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

            {/* Financial Payment Receipts Ledger History Table */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Financial Payment Receipts Ledger ({selectedTransferDetail.payment_records?.length || 0})
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/60 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Payment Method</th>
                      <th className="p-2.5 text-right">Amount Paid</th>
                      <th className="p-2.5">Bank / Cheque Details & References</th>
                      <th className="p-2.5">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(selectedTransferDetail.payment_records || []).map((pay, pIdx) => (
                      <tr key={pIdx} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                        <td className="p-2.5 font-mono text-slate-500 text-[11px]">{formatDate(pay.created_at)}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            pay.payment_method === 'BANK_TRANSFER'
                              ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                              : pay.payment_method === 'CHEQUE'
                              ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {pay.payment_method === 'BANK_TRANSFER' ? '🏦 BANK TRANSFER' : pay.payment_method === 'CHEQUE' ? '📜 CHEQUE' : '💵 CASH'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(pay.amount_paid, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-2.5 text-[11px]">
                          {pay.payment_method === 'BANK_TRANSFER' && (
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">Bank: {pay.bank_name || 'N/A'}</p>
                              <p className="font-mono text-slate-500 text-[10px]">Ref #: {pay.bank_reference || 'N/A'}</p>
                            </div>
                          )}
                          {pay.payment_method === 'CHEQUE' && (
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">Cheque #: {pay.cheque_no || 'N/A'}</p>
                              <p className="text-slate-600 dark:text-slate-400 text-[10px]">Bank: {pay.bank_name || 'N/A'} | Date: {pay.cheque_date ? formatDate(pay.cheque_date) : 'N/A'}</p>
                            </div>
                          )}
                          {pay.payment_method === 'CASH' && (
                            <span className="text-slate-500 font-mono text-[11px]">Cash Counter Receipt</span>
                          )}
                          {pay.remarks && <p className="text-[10px] text-slate-400 italic mt-0.5">"{pay.remarks}"</p>}
                        </td>
                        <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">{pay.created_by_name || 'Store Manager'}</td>
                      </tr>
                    ))}
                    {(!selectedTransferDetail.payment_records || selectedTransferDetail.payment_records.length === 0) && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 text-xs">
                          No separate payment entries recorded yet. (Initial invoice value: {formatCurrency(selectedTransferDetail.paid_amount || 0, currencyCode, decimalPlaces)})
                        </td>
                      </tr>
                    )}
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
                className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANCH LEDGER TRAJECTORY MODAL (All Transactions for Particular Selected Branch) */}
      {showBranchLedgerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-6xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue rounded-2xl border border-brand-blue/30">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                      Branch Ledger Trajectory: {selectedBranchObj ? `${selectedBranchObj.name} (${selectedBranchObj.code})` : 'All Sub-Branches'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Complete audit of financial invoices, payment collections (Cash/Bank/Cheque) & stock ledger movements with Carry Forward Balance</p>
                </div>
              </div>

              <button
                onClick={() => setShowBranchLedgerModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Date Range Filter Toolbar */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4 text-brand-blue" />
                  <span>Ledger Date Range:</span>
                </div>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
                <span className="text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePresetThisMonth}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    startDateFilter === getFirstDayOfCurrentMonth() && endDateFilter === getLastDayOfCurrentMonth()
                      ? 'bg-brand-blue text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  This Month (Default)
                </button>
                <button
                  type="button"
                  onClick={handlePresetLastMonth}
                  className="px-3 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={handlePresetAllTime}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    !startDateFilter && !endDateFilter
                      ? 'bg-brand-blue text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            {/* Branch Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/70 space-y-0.5">
                <span className="text-amber-700 dark:text-amber-400 block text-[11px] font-bold uppercase tracking-wider">Carry Forward Opening</span>
                <span className="font-bold text-amber-800 dark:text-amber-300 text-sm font-mono block font-heading">
                  {formatCurrency(carryForwardMetrics.totalPending, currencyCode, decimalPlaces)}
                </span>
                <span className="text-[10px] text-amber-600/80 font-semibold truncate block">Prior to {startDateFilter ? formatDate(startDateFilter, dateFormat) : 'Beginning'}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider">Period Invoiced</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono block">
                  {formatCurrency(summaryMetrics.totalGrand, currencyCode, decimalPlaces)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium block">{filteredTransfers.length} invoice(s)</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider">Period Payments</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono block">
                  {formatCurrency(summaryMetrics.totalPaid, currencyCode, decimalPlaces)}
                </span>
                <span className="text-[10px] text-emerald-600/80 font-semibold block">Collected in range</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider">Period Pending</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm font-mono block">
                  {formatCurrency(summaryMetrics.totalPending, currencyCode, decimalPlaces)}
                </span>
                <span className="text-[10px] text-rose-500/80 font-semibold block">Unpaid in range</span>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-800/80 space-y-0.5">
                <span className="text-rose-700 dark:text-rose-400 block text-[11px] font-extrabold uppercase tracking-wider">Net Total Outstanding</span>
                <span className="font-black text-rose-700 dark:text-rose-300 text-sm font-mono block font-heading">
                  {formatCurrency(netTotalOutstanding, currencyCode, decimalPlaces)}
                </span>
                <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-bold block">Carry Forward + Period</span>
              </div>
            </div>

            {/* Modal Subtabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setBranchLedgerTab('invoices')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  branchLedgerTab === 'invoices'
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <Receipt className="w-4 h-4" /> Financial Invoices & Payment Ledger ({filteredTransfers.length})
              </button>
              <button
                type="button"
                onClick={() => setBranchLedgerTab('movements')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  branchLedgerTab === 'movements'
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                <History className="w-4 h-4" /> Stock Movement Trajectory Ledger
              </button>
            </div>

            {/* Tab 1: Financial Invoices & Payment Ledger */}
            {branchLedgerTab === 'invoices' && (
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-y-auto max-h-[520px] bg-white dark:bg-slate-900 shadow-inner">
                  <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Sub-Branch</th>
                        <th className="p-3">Dispatch Date</th>
                        <th className="p-3 text-right">Grand Total ({currencyCode})</th>
                        <th className="p-3 text-right">Paid Amount ({currencyCode})</th>
                        <th className="p-3 text-right">Pending Balance ({currencyCode})</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Payment Method & References</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {/* Carry Forward Opening Balance Row */}
                      {startDateFilter && carryForwardMetrics.totalPending > 0 && (
                        <tr className="bg-amber-50/80 dark:bg-amber-950/40 font-bold border-b-2 border-amber-300 dark:border-amber-700">
                          <td colSpan={3} className="p-3 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5">
                            📌 CARRY FORWARD OPENING BALANCE (Prior to {formatDate(startDateFilter, dateFormat)})
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatCurrency(carryForwardMetrics.totalGrand, currencyCode, decimalPlaces)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(carryForwardMetrics.totalPaid, currencyCode, decimalPlaces)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                            {formatCurrency(carryForwardMetrics.totalPending, currencyCode, decimalPlaces)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-300">
                              CARRY FORWARD
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-amber-700 dark:text-amber-300 italic">
                            Opening balance brought forward
                          </td>
                        </tr>
                      )}

                      {filteredTransfers.map((tr, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50">
                          <td className="p-3 font-mono font-bold text-brand-blue">{tr.invoice_no || tr.transfer_no}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{tr.to_location_name}</td>
                          <td className="p-3 font-mono text-slate-500">{formatDate(tr.dispatched_at, dateFormat)}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tr.total_val, currencyCode, decimalPlaces)}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(tr.paid_amount, currencyCode, decimalPlaces)}</td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(tr.pending_balance, currencyCode, decimalPlaces)}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              tr.payment_status === 'PAID'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 border-emerald-300'
                                : tr.payment_status === 'PARTIAL'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 border-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-700 border-rose-300'
                            }`}>
                              {tr.payment_status || 'UNPAID'}
                            </span>
                          </td>
                          <td className="p-3 text-[11px]">
                            {tr.payment_records && tr.payment_records.length > 0 ? (
                              <div className="space-y-1">
                                {tr.payment_records.map((p, pIdx) => (
                                  <div key={pIdx} className="flex items-center gap-1 font-mono text-[10px]">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{p.payment_method}:</span>
                                    <span>{formatCurrency(p.amount_paid, currencyCode, decimalPlaces)}</span>
                                    {p.bank_name && <span className="text-slate-400">({p.bank_name})</span>}
                                    {p.bank_reference && <span className="text-blue-500">[{p.bank_reference}]</span>}
                                    {p.cheque_no && <span className="text-purple-500">[Chq: {p.cheque_no}]</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">
                                {tr.payment_method ? `${tr.payment_method} ${tr.bank_name ? `(${tr.bank_name})` : ''}` : 'CASH'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredTransfers.length === 0 && (!startDateFilter || carryForwardMetrics.totalPending === 0) && (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-400 text-xs">
                            No branch invoices or ledger transactions found for this location in selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Stock Movement Trajectory Ledger */}
            {branchLedgerTab === 'movements' && (
              <div className="space-y-3">
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-y-auto max-h-[520px] bg-white dark:bg-slate-900 shadow-inner">
                  <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
                    <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">Ref #</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Item & Batch Code</th>
                        <th className="p-3">From Branch ➔ Destination Branch</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Unit Price ({currencyCode})</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredTransfers.flatMap(tr => tr.ledger_movements || []).map((mov, mIdx) => (
                        <tr key={mIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50">
                          <td className="p-3 font-mono font-bold text-brand-blue">{mov.reference_no}</td>
                          <td className="p-3 font-bold text-emerald-600 text-[10px]">{mov.transaction_type}</td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{mov.item_name}</p>
                            <p className="text-[10px] font-mono text-slate-400">Batch: {mov.batch_code}</p>
                          </td>
                          <td className="p-3 text-[11px]">
                            <span className="text-slate-600 dark:text-slate-400">{mov.from_location_name}</span>
                            <ArrowRight className="w-3 h-3 inline mx-1 text-slate-400" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">{mov.to_location_name}</span>
                          </td>
                          <td className="p-3 text-center font-extrabold font-mono text-slate-900 dark:text-slate-100">{mov.qty}</td>
                          <td className="p-3 text-right font-mono font-bold">{formatCurrency(mov.unit_price, currencyCode, decimalPlaces)}</td>
                          <td className="p-3 font-mono text-slate-400 text-[10px]">{formatDate(mov.timestamp, dateFormat)}</td>
                        </tr>
                      ))}
                      {filteredTransfers.flatMap(tr => tr.ledger_movements || []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                            No stock movement trajectory logs found for this branch in selected period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBranchLedgerModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Close Branch Ledger
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
