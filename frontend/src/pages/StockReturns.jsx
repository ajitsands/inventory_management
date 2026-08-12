import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import {
  RotateCcw,
  Wallet,
  AlertTriangle,
  Archive,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Eye,
  Building2,
  ShieldCheck,
  ArrowRightLeft,
  X,
  FileCheck,
  ArrowUpRight,
  ArrowRight
} from 'lucide-react';

const RETURN_REASON_OPTIONS = [
  { value: 'Damaged Item', label: 'Damaged Item' },
  { value: 'Expired Item', label: 'Expired Item' },
  { value: 'Near Expiry', label: 'Near Expiry' },
  { value: 'Wrong Item Supplied', label: 'Wrong Item Supplied' },
  { value: 'Wrong Quantity Supplied', label: 'Wrong Quantity Supplied' },
  { value: 'Excess Quantity', label: 'Excess Quantity' },
  { value: 'Item Not Required', label: 'Item Not Required' },
  { value: 'Customer Return', label: 'Customer Return' },
  { value: 'Clinic Return', label: 'Clinic Return' },
  { value: 'Batch Issue', label: 'Batch Issue' },
  { value: 'Quality Issue', label: 'Quality Issue' },
  { value: 'Packaging Damage', label: 'Packaging Damage' },
  { value: 'Product Defective', label: 'Product Defective' },
  { value: 'Incorrect Batch', label: 'Incorrect Batch' },
  { value: 'Incorrect Product', label: 'Incorrect Product' },
  { value: 'Stock Transfer Error', label: 'Stock Transfer Error' },
  { value: 'Duplicate Transfer', label: 'Duplicate Transfer' },
  { value: 'Other', label: 'Other' }
];

export default function StockReturns() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isBranchManager = user?.role === 'STORE_MANAGER';
  const isClinicUser = user?.role === 'OPD_USER';

  // Role Default Tab Selection
  const defaultTab = isClinicUser ? 'create_return' : (isBranchManager || isAdmin ? 'inbound_wallet' : 'system_audit');
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Master Data & Lists
  const [subBranches, setSubBranches] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [walletReturns, setWalletReturns] = useState([]);
  const [clinicRejectWallet, setClinicRejectWallet] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [damagedStock, setDamagedStock] = useState([]);
  const [systemReturns, setSystemReturns] = useState([]);
  const [settings, setSettings] = useState({ currency_code: 'BHD', decimal_places: '3' });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State for Creating Return Request
  const [returnType, setReturnType] = useState(isClinicUser ? 'CLINIC_TO_BRANCH' : 'BRANCH_TO_MAIN');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged Item');
  const [notes, setNotes] = useState('');

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [returnQty, setReturnQty] = useState(1);
  const [lineItems, setLineItems] = useState([]);

  // Modal States
  const [selectedWalletReturn, setSelectedWalletReturn] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [selectedReturnDetail, setSelectedReturnDetail] = useState(null);
  const [selectedCreditNoteDetail, setSelectedCreditNoteDetail] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, icon: null, confirmText: 'Confirm', confirmStyle: 'bg-brand-blue hover:bg-brand-blue/90' });

  const currencyCode = settings.currency_code || 'BHD';
  const decimalPlaces = settings.decimal_places;

  const loadData = async () => {
    setLoading(true);
    try {
      const [masterData, settingsRes, walletRes, historyRes] = await Promise.all([
        apiFetch('/master-data'),
        apiFetch('/settings'),
        apiFetch('/returns/wallet'),
        apiFetch('/returns')
      ]);

      const locs = masterData.locations || [];
      const subBranchesOnly = locs.filter(l => l.type === 'SUB_BRANCH');
      const sbList = locs.filter(l => l.type === 'SUB_BRANCH' || l.type === 'MAIN_BRANCH' || l.type === 'BRANCH');
      const cList = locs.filter(l => l.type === 'CLINIC');

      // Store with raw_id integers so we can easily match user.location_id
      setSubBranches(sbList.length > 0 ? sbList : locs);
      setClinics(cList);
      setWalletReturns(walletRes.wallet_returns || []);
      setSystemReturns(historyRes.returns || []);

      const setts = settingsRes.settings || { currency_code: 'BHD', decimal_places: '3' };
      setSettings(setts);

      // Use RAW integer IDs (raw_id) throughout form state — backend always accepts raw_location_id
      const userLocId = parseInt(user?.location_id || user?.raw_location_id || 0);
      let initialFromRawId = 0;
      let initialToRawId = 0;

      if (isClinicUser) {
        setReturnType('CLINIC_TO_BRANCH');
        const userClinic = cList.find(c => c.raw_id == userLocId);
        initialFromRawId = userClinic ? userClinic.raw_id : (cList.length > 0 ? cList[0].raw_id : 0);
        const prefBranch = subBranchesOnly.length > 0 ? subBranchesOnly[0] : (sbList.length > 0 ? sbList[0] : null);
        initialToRawId = prefBranch ? prefBranch.raw_id : 0;
      } else if (isBranchManager) {
        setReturnType('BRANCH_TO_MAIN');
        const userBranch = sbList.find(s => s.raw_id == userLocId);
        initialFromRawId = userBranch ? userBranch.raw_id : (sbList.length > 0 ? sbList[0].raw_id : 0);
        initialToRawId = 1; // Main Store raw ID
      } else {
        setReturnType('BRANCH_TO_MAIN');
        initialFromRawId = sbList.length > 0 ? sbList[0].raw_id : 0;
        initialToRawId = 1;
      }

      setFromLocationId(initialFromRawId || '');
      setToLocationId(initialToRawId || '');

      if (initialFromRawId) {
        fetchEligibleItems(initialFromRawId);
      }

      // Load Reject Wallet for Clinic
      if (isClinicUser && initialFromRawId) {
        const rejRes = await apiFetch(`/returns/reject-wallet?raw_location_id=${initialFromRawId}`);
        setClinicRejectWallet(rejRes.reject_wallet || []);
      }

      if (isAdmin || isBranchManager) {
        const [cnRes, dmgRes] = await Promise.all([
          apiFetch('/returns/credit-notes'),
          apiFetch('/returns/damaged-stock')
        ]);
        setCreditNotes(cnRes.credit_notes || []);
        setDamagedStock(dmgRes.damaged_stock || []);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Always pass raw integer location ID — backend reads raw_location_id directly
  const fetchEligibleItems = async (rawLocId) => {
    if (!rawLocId) return;
    try {
      const res = await apiFetch(`/returns/eligible-items?raw_location_id=${rawLocId}`);
      setEligibleItems(res.items || []);
    } catch (err) {
      console.error('fetchEligibleItems error:', err);
      setEligibleItems([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // newLocId is always a raw integer here
  const handleFromLocationChange = (newLocId) => {
    setFromLocationId(newLocId);
    setLineItems([]);
    setSelectedBatchId('');
    setToLocationId('');
    fetchEligibleItems(newLocId);
  };

  // When a batch is selected, auto-detect which Sub-Branch supplied it
  const handleBatchSelect = (batchEncId) => {
    setSelectedBatchId(batchEncId);
    // If batch has a transfer_from_location_id (tracked from backend), auto-set Destination
    const batchObj = eligibleItems.find(b => b.id === batchEncId || String(b.raw_id) === String(batchEncId) || String(b.batch_id) === String(batchEncId));
    if (batchObj && batchObj.transfer_from_location_id) {
      setToLocationId(batchObj.transfer_from_location_id);
    }
  };

  const handleAddLineItem = () => {
    if (!selectedBatchId) {
      setMessage({ type: 'error', text: 'Please select a stock item batch to return.' });
      return;
    }

    // Match using raw integer batch_id since selectedBatchId is now a raw int
    const batchObj = eligibleItems.find(b =>
      String(b.raw_id) === String(selectedBatchId) ||
      String(b.raw_batch_id) === String(selectedBatchId) ||
      String(b.batch_id) === String(selectedBatchId)
    );
    if (!batchObj) return;

    const qtyVal = parseInt(returnQty || 1);
    if (qtyVal <= 0) {
      setMessage({ type: 'error', text: 'Return quantity must be greater than zero.' });
      return;
    }

    if (qtyVal > batchObj.max_returnable_qty) {
      setMessage({ type: 'error', text: `Return quantity (${qtyVal}) cannot exceed max returnable limit of ${batchObj.max_returnable_qty} units.` });
      return;
    }

    // Check if item batch already added to line items
    const existingIdx = lineItems.findIndex(l => l.batch_id === batchObj.id);
    if (existingIdx >= 0) {
      const updated = [...lineItems];
      const newTotalQty = updated[existingIdx].quantity + qtyVal;
      if (newTotalQty > batchObj.max_returnable_qty) {
        setMessage({ type: 'error', text: `Total batch return quantity (${newTotalQty}) cannot exceed max returnable limit of ${batchObj.max_returnable_qty} units.` });
        return;
      }
      updated[existingIdx].quantity = newTotalQty;
      updated[existingIdx].total_amount = newTotalQty * parseFloat(batchObj.unit_cost || 0);
      setLineItems(updated);
    } else {
      setLineItems([...lineItems, {
        batch_id: batchObj.id,
        raw_batch_id: batchObj.raw_id || batchObj.batch_id,
        item_id: batchObj.item_id,
        raw_item_id: batchObj.raw_item_id,
        item_name: batchObj.item_name,
        item_code: batchObj.item_code,
        batch_code: batchObj.batch_code,
        expiry_date: batchObj.expiry_date,
        unit_rate: parseFloat(batchObj.unit_cost || 0),
        quantity: qtyVal,
        max_returnable_qty: batchObj.max_returnable_qty,
        total_amount: qtyVal * parseFloat(batchObj.unit_cost || 0)
      }]);
    }

    setSelectedBatchId('');
    setReturnQty(1);
  };

  const removeLineItem = (idx) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleCreateReturnSubmit = async (e) => {
    e.preventDefault();
    if (!fromLocationId || !toLocationId) {
      setMessage({ type: 'error', text: 'Please select valid source and destination locations.' });
      return;
    }
    if (lineItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one item batch to the return request list.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        return_type: returnType,
        // Use raw integer IDs — backend reads raw_from/to_location_id directly
        raw_from_location_id: parseInt(fromLocationId),
        raw_to_location_id: parseInt(toLocationId),
        from_location_id: parseInt(fromLocationId),
        to_location_id: parseInt(toLocationId),
        reason: returnReason,
        notes: notes,
        items: lineItems.map(item => ({
          raw_item_id: item.raw_item_id,
          item_id: item.raw_item_id,
          raw_batch_id: item.raw_batch_id,
          batch_id: item.raw_batch_id,
          quantity: item.quantity,
          unit_rate: item.unit_rate
        }))
      };

      const res = await apiFetch('/returns/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setLineItems([]);
        setNotes('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to submit stock return request' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptReturn = async (ret) => {
    setConfirmModal({ ...confirmModal, isOpen: false });

    setSubmitting(true);
    try {
      const res = await apiFetch('/returns/accept', {
        method: 'POST',
        body: JSON.stringify({ return_id: ret.id, raw_return_id: ret.raw_id })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setSelectedWalletReturn(null);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to accept return' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWalletReturn) return;
    if (!rejectionReasonInput.trim()) {
      setMessage({ type: 'error', text: 'Rejection reason is required.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/returns/reject', {
        method: 'POST',
        body: JSON.stringify({
          return_id: selectedWalletReturn.id,
          raw_return_id: selectedWalletReturn.raw_id,
          rejection_reason: rejectionReasonInput.trim()
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setShowRejectModal(false);
        setSelectedWalletReturn(null);
        setRejectionReasonInput('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to reject return' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreRejectStock = async (rej) => {
    setConfirmModal({ ...confirmModal, isOpen: false });

    setSubmitting(true);
    try {
      const res = await apiFetch('/returns/restore-reject', {
        method: 'POST',
        body: JSON.stringify({ rejection_id: rej.id, raw_rejection_id: rej.raw_id })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to restore stock' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAndForwardReturn = async (ret) => {
    setConfirmModal({ ...confirmModal, isOpen: false });
    setSubmitting(true);
    try {
      const res = await apiFetch('/returns/accept-and-forward', {
        method: 'POST',
        body: JSON.stringify({ return_id: ret.id, raw_return_id: ret.raw_id })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setSelectedWalletReturn(null);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to accept and forward return' });
    } finally {
      setSubmitting(false);
    }
  };

  const requestAcceptReturn = (ret) => {
    setConfirmModal({
      isOpen: true,
      title: `Accept Stock Return (${ret.return_reference})`,
      message: `Are you sure you want to accept this return? Items will be credited into your Available Stock.`,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      confirmText: 'Accept Return',
      confirmStyle: 'bg-emerald-600 hover:bg-emerald-700',
      onConfirm: () => handleAcceptReturn(ret)
    });
  };

  const requestAcceptAndForward = (ret) => {
    setConfirmModal({
      isOpen: true,
      title: `Accept & Forward (${ret.return_reference})`,
      message: `This will instantly accept the stock into Branch inventory and immediately forward it to the Main Store's Return Wallet. Proceed?`,
      icon: <ArrowRight className="w-5 h-5 text-indigo-600" />,
      confirmText: 'Accept & Forward',
      confirmStyle: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: () => handleAcceptAndForwardReturn(ret)
    });
  };

  const requestRestoreRejectStock = (rej) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Rejected Stock`,
      message: `Restore ${rej.quantity} units of ${rej.item_name} (Batch: ${rej.batch_code}) back into Clinic Available Stock?`,
      icon: <RefreshCw className="w-5 h-5 text-brand-blue" />,
      confirmText: 'Restore Stock',
      confirmStyle: 'bg-brand-blue hover:bg-brand-blue/90',
      onConfirm: () => handleRestoreRejectStock(rej)
    });
  };

  // Selected Batch Information
  const selectedBatchObj = eligibleItems.find(b => b.id === selectedBatchId || b.raw_id == selectedBatchId);

  // Column definitions for DataTables
  const walletColumns = [
    {
      header: 'Return Ref #',
      accessor: 'return_reference',
      render: (r) => <span className="font-mono font-bold text-brand-blue">{r.return_reference}</span>
    },
    {
      header: 'Returning Location',
      accessor: 'from_location_name',
      render: (r) => <span className="font-semibold text-slate-900 dark:text-slate-100">{r.from_location_name}</span>
    },
    {
      header: 'Reason',
      accessor: 'reason',
      render: (r) => <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">{r.reason}</span>
    },
    {
      header: 'Items & Qty',
      accessor: 'items',
      render: (r) => (
        <div className="space-y-1 text-xs">
          {(r.items || []).map((i, idx) => (
            <div key={idx} className="font-mono">
              <span className="font-bold text-slate-800 dark:text-slate-200">{i.item_name}</span> (Batch: {i.batch_code}) - <span className="font-extrabold text-brand-orange">{i.quantity} units</span>
            </div>
          ))}
        </div>
      )
    },
    {
      header: 'Date Created',
      accessor: 'created_at',
      render: (r) => <span className="font-mono text-slate-500">{formatDate(r.created_at)}</span>
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => requestAcceptReturn(r)}
            disabled={submitting}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Accept Return
          </button>
          {r.to_location_name !== 'Central Main Warehouse & Branch' && isBranchManager && (
            <button
              type="button"
              onClick={() => requestAcceptAndForward(r)}
              disabled={submitting}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Accept & Forward to Main Store
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedWalletReturn(r);
              setShowRejectModal(true);
            }}
            disabled={submitting}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-all flex items-center gap-1 shadow-2xs"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject Return
          </button>
        </div>
      )
    }
  ];

  const rejectWalletColumns = [
    {
      header: 'Return Ref #',
      accessor: 'return_reference',
      render: (r) => <span className="font-mono font-bold text-brand-blue">{r.return_reference}</span>
    },
    {
      header: 'Item & Batch',
      accessor: 'item_name',
      render: (r) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{r.item_name}</p>
          <p className="text-[10px] font-mono text-slate-500">Code: {r.item_code} • Batch: {r.batch_code}</p>
        </div>
      )
    },
    {
      header: 'Rejected Quantity',
      accessor: 'quantity',
      render: (r) => <span className="font-mono font-extrabold text-rose-600 text-sm">{r.quantity} units</span>
    },
    {
      header: 'Branch Rejection Reason',
      accessor: 'rejection_reason',
      render: (r) => <span className="text-slate-600 dark:text-slate-400 italic text-xs">{r.rejection_reason || 'Rejected by Branch'}</span>
    },
    {
      header: 'Action',
      accessor: 'id',
      className: 'text-center',
      render: (r) => (
        <button
          type="button"
          onClick={() => requestRestoreRejectStock(r)}
          disabled={submitting}
          className="px-3 py-1 rounded-xl bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-bold transition-all flex items-center gap-1 mx-auto shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Restore to Clinic Stock
        </button>
      )
    }
  ];

  const creditNotesColumns = [
    {
      header: 'Credit Note #',
      accessor: 'credit_note_no',
      render: (c) => <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{c.credit_note_no}</span>
    },
    {
      header: 'Sub-Branch Location',
      accessor: 'branch_name',
      render: (c) => <span className="font-semibold text-slate-900 dark:text-slate-100">{c.branch_name} ({c.branch_code})</span>
    },
    {
      header: 'Original Transfer Ref',
      accessor: 'original_transfer_no',
      render: (c) => <span className="font-mono text-slate-500">{c.original_transfer_no || '-'}</span>
    },
    {
      header: `Credit Amount (${currencyCode})`,
      accessor: 'total_amount',
      render: (c) => <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(c.total_amount, currencyCode, decimalPlaces)}</span>
    },
    {
      header: 'Reason',
      accessor: 'reason',
      render: (c) => <span className="text-slate-600 dark:text-slate-400 text-xs italic">{c.reason || 'Branch return rejected by Main Store'}</span>
    },
    {
      header: 'Issued Date',
      accessor: 'created_at',
      render: (c) => <span className="font-mono text-slate-500">{formatDate(c.created_at)}</span>
    },
    {
      header: 'Details',
      accessor: 'id',
      className: 'text-center',
      render: (c) => (
        <button
          type="button"
          onClick={() => setSelectedCreditNoteDetail(c)}
          className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 border border-purple-300 text-xs font-bold hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1 mx-auto"
        >
          <FileText className="w-3.5 h-3.5" />
          View Note
        </button>
      )
    }
  ];

  const damagedStockColumns = [
    {
      header: 'Return Ref #',
      accessor: 'return_reference',
      render: (d) => <span className="font-mono font-bold text-brand-blue">{d.return_reference}</span>
    },
    {
      header: 'Item & Batch',
      accessor: 'item_name',
      render: (d) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{d.item_name}</p>
          <p className="text-[10px] font-mono text-slate-500">Code: {d.item_code} • Batch: {d.batch_code}</p>
        </div>
      )
    },
    {
      header: 'Damaged Quantity',
      accessor: 'quantity',
      render: (d) => <span className="font-mono font-extrabold text-rose-600 text-sm">{d.quantity} units</span>
    },
    {
      header: 'Location Stored',
      accessor: 'location_name',
      render: (d) => <span className="font-semibold text-slate-700 dark:text-slate-300">{d.location_name}</span>
    },
    {
      header: 'Reason',
      accessor: 'reason',
      render: (d) => <span className="text-slate-500 italic text-xs">{d.reason}</span>
    },
    {
      header: 'Logged Date',
      accessor: 'created_at',
      render: (d) => <span className="font-mono text-slate-500">{formatDate(d.created_at)}</span>
    }
  ];

  const systemAuditColumns = [
    {
      header: 'Return Ref #',
      accessor: 'return_reference',
      render: (r) => <span className="font-mono font-bold text-brand-blue">{r.return_reference}</span>
    },
    {
      header: 'Workflow Type',
      accessor: 'return_type',
      render: (r) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 uppercase">
          {r.return_type === 'CLINIC_TO_BRANCH' ? 'Clinic → Branch' : 'Branch → Main Store'}
        </span>
      )
    },
    {
      header: 'From Location',
      accessor: 'from_location_name',
      render: (r) => <span className="font-semibold text-slate-900 dark:text-slate-100">{r.from_location_name}</span>
    },
    {
      header: 'To Location',
      accessor: 'to_location_name',
      render: (r) => <span className="font-semibold text-slate-700 dark:text-slate-300">{r.to_location_name}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => {
        const isAcc = r.status === 'ACCEPTED';
        const isRej = r.status === 'REJECTED';
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 w-fit ${
            isAcc ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300' :
            isRej ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300' :
            'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300'
          }`}>
            {isAcc ? <CheckCircle2 className="w-3.5 h-3.5" /> : isRej ? <XCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {r.status === 'PENDING_ACCEPTANCE' ? 'In Return Wallet' : r.status}
          </span>
        );
      }
    },
    {
      header: 'Date Created',
      accessor: 'created_at',
      render: (r) => <span className="font-mono text-slate-500">{formatDate(r.created_at)}</span>
    },
    {
      header: 'Action',
      accessor: 'id',
      className: 'text-center',
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedReturnDetail(r)}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-blue hover:text-white border border-slate-300 text-xs font-bold transition-all flex items-center gap-1 mx-auto"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-brand-orange" />
            Stock Return Management (Controlled Return Wallet)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-stage stock return workflow: Clinic → Sub-Branch → Main Store with Return Wallet acceptance controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 text-xs font-bold flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-brand-orange" />
            Pending Wallet Returns: {walletReturns.length}
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

      {/* Role-Scoped Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {(isAdmin || isBranchManager) && (
          <button
            onClick={() => setActiveTab('inbound_wallet')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'inbound_wallet'
                ? 'bg-brand-blue text-white shadow-md glow-blue'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {isAdmin ? 'Main Store Return Wallet' : 'Branch Return Wallet'} ({walletReturns.length})
          </button>
        )}

        {(isClinicUser || isBranchManager) && (
          <button
            onClick={() => setActiveTab('create_return')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'create_return'
                ? 'bg-brand-blue text-white shadow-md glow-blue'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            {isClinicUser ? 'Create Return to Branch' : 'Create Return to Main Store'}
          </button>
        )}

        {isClinicUser && (
          <button
            onClick={() => setActiveTab('reject_wallet')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'reject_wallet'
                ? 'bg-rose-600 text-white shadow-md glow-rose'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Clinic Return Reject Wallet ({clinicRejectWallet.length})
          </button>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('credit_notes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'credit_notes'
                  ? 'bg-purple-600 text-white shadow-md glow-purple'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Branch Credit Notes Directory ({creditNotes.length})
            </button>

            <button
              onClick={() => setActiveTab('damaged_stock')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'damaged_stock'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <Archive className="w-4 h-4" />
              Damaged / Rejected Stock ({damagedStock.length})
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('system_audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'system_audit'
              ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Returns Audit Ledger ({systemReturns.length})
        </button>
      </div>

      {/* TAB 1: INBOUND RETURN WALLET (Branch Manager or Admin) */}
      {activeTab === 'inbound_wallet' && (isAdmin || isBranchManager) && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <Wallet className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Pending Return Wallet Authorization</p>
              <p className="mt-0.5">
                Returned items in the Return Wallet do <strong>NOT</strong> count as available stock until explicitly accepted.
                Click <strong>Accept Return</strong> to credit the items to your available stock, or <strong>Reject Return</strong> to isolate the items.
              </p>
            </div>
          </div>

          <DataTable
            title={isAdmin ? "Main Store Pending Return Wallet" : "Branch Pending Return Wallet"}
            subtitle="Review pending stock return requests submitted by lower locations"
            columns={walletColumns}
            data={walletReturns}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}

      {/* TAB 2: CREATE STOCK RETURN REQUEST */}
      {activeTab === 'create_return' && (isClinicUser || isBranchManager) && (
        <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-brand-orange" />
              {isClinicUser ? 'Initiate Clinic Stock Return to Sub-Branch' : 'Initiate Sub-Branch Stock Return to Main Store'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Returned items will be validated against original received transfer limits and placed into the destination's Return Wallet
            </p>
          </div>

          <form onSubmit={handleCreateReturnSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Return Workflow Type</label>
                <input
                  type="text"
                  disabled
                  value={returnType === 'CLINIC_TO_BRANCH' ? 'Clinic Return to Sub-Branch' : 'Sub-Branch Return to Main Store'}
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Source Location *</label>
                {isClinicUser || isBranchManager ? (
                  <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    {user?.location_name || 'Assigned Location'}
                  </div>
                ) : (
                  <SearchableSelect
                    options={isClinicUser ? clinics.map(c => ({ value: c.id, label: `${c.name} (${c.code})` })) : subBranches.map(s => ({ value: s.id, label: `${s.name} (${s.code})` }))}
                    value={fromLocationId}
                    onChange={(val) => handleFromLocationChange(val)}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Destination Location *</label>
                {returnType === 'CLINIC_TO_BRANCH' ? (
                  <SearchableSelect
                    placeholder="Select Receiving Sub-Branch..."
                    options={subBranches.filter(s => s.raw_id != fromLocationId).map(s => ({
                      value: s.raw_id,
                      label: `${s.name} (${s.code})`,
                      sublabel: s.type
                    }))}
                    value={toLocationId}
                    onChange={(val) => setToLocationId(parseInt(val))}
                  />
                ) : (
                  <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    Central Main Store
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Return Reason *</label>
                <SearchableSelect
                  options={RETURN_REASON_OPTIONS}
                  value={returnReason}
                  onChange={(val) => setReturnReason(val)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Near expiry items returned as per policy"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>
            </div>

            {/* Line Item Batch Selection Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Select Stock Batch to Return</h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Stock Item Batch *</label>
                  <SearchableSelect
                    placeholder="Search Batch by item name, code, or batch code..."
                    options={eligibleItems.map(b => ({
                      value: b.raw_id || b.raw_batch_id || b.batch_id,
                      label: `${b.item_name} (Batch: ${b.batch_code})`,
                      sublabel: `Avail: ${b.quantity_available} | Max Returnable: ${b.max_returnable_qty} | Exp: ${formatDate(b.expiry_date)}`
                    }))}
                    value={selectedBatchId}
                    onChange={handleBatchSelect}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Return Qty {selectedBatchObj ? `(Max: ${selectedBatchObj.max_returnable_qty})` : ''}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedBatchObj ? selectedBatchObj.max_returnable_qty : 9999}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div className="md:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="w-full py-2 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:bg-brand-blue/90 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Return List
                  </button>
                </div>
              </div>

              {selectedBatchObj && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between font-mono">
                  <span>Batch: <strong>{selectedBatchObj.batch_code}</strong> | Exp: {formatDate(selectedBatchObj.expiry_date)}</span>
                  <span>Received: {selectedBatchObj.total_received} | Already Returned: {selectedBatchObj.total_returned} | Max Eligible: <strong className="text-brand-orange">{selectedBatchObj.max_returnable_qty} units</strong></span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Item & Code</th>
                    <th className="p-3">Batch Code & Expiry</th>
                    <th className="p-3 text-center">Return Qty</th>
                    <th className="p-3 text-right">Unit Rate ({currencyCode})</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-xs text-slate-400">
                        No items added to return list. Select a batch above and click "Add to Return List".
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{item.item_name}</p>
                          <p className="text-[10px] font-mono text-slate-500">Code: {item.item_code}</p>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-brand-blue block">{item.batch_code}</span>
                          <span className="text-[10px] font-mono text-slate-400">Exp: {formatDate(item.expiry_date)}</span>
                        </td>
                        <td className="p-3 text-center font-extrabold text-brand-orange text-sm">{item.quantity}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatCurrency(item.unit_rate, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.total_amount, currencyCode, decimalPlaces)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={submitting || lineItems.length === 0}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-xs shadow-lg glow-orange hover:opacity-95 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {submitting ? 'Submitting Return Request...' : 'Submit Stock Return Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CLINIC RETURN REJECT WALLET (Clinic User) */}
      {activeTab === 'reject_wallet' && isClinicUser && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Clinic Return Reject Wallet Isolation</p>
              <p className="mt-0.5">
                Items in this reject wallet were returned by your clinic but rejected by the Sub-Branch.
                They are <strong>isolated from your available OPD dispensing stock</strong>. You may click <strong>Restore to Clinic Stock</strong> to add them back into active stock.
              </p>
            </div>
          </div>

          <DataTable
            title="Clinic Return Reject Wallet Items"
            subtitle="Rejected return items currently isolated from normal inventory"
            columns={rejectWalletColumns}
            data={clinicRejectWallet}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}

      {/* TAB 4: CREDIT NOTES DIRECTORY (Admin) */}
      {activeTab === 'credit_notes' && isAdmin && (
        <DataTable
          title="Generated Branch Credit Notes Directory"
          subtitle="Audit log of credit notes issued to Sub-Branches for rejected stock returns"
          columns={creditNotesColumns}
          data={creditNotes}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* TAB 5: DAMAGED / REJECTED STOCK (Admin) */}
      {activeTab === 'damaged_stock' && isAdmin && (
        <DataTable
          title="Main Store Damaged & Rejected Stock Ledger"
          subtitle="Record of rejected branch returns logged as damaged stock"
          columns={damagedStockColumns}
          data={damagedStock}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* TAB 6: SYSTEM RETURNS AUDIT LEDGER */}
      {activeTab === 'system_audit' && (
        <DataTable
          title="Master System Stock Returns Audit Trail"
          subtitle="Complete chronological audit history of all internal stock returns across the organization"
          columns={systemAuditColumns}
          data={systemReturns}
          searchable={true}
          defaultPageSize={10}
        />
      )}

      {/* Rejection Modal Dialog */}
      {showRejectModal && selectedWalletReturn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  Reject Stock Return ({selectedWalletReturn.return_reference})
                </h3>
                <p className="text-xs text-slate-500">Provide a mandatory rejection reason for this return request</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedWalletReturn(null);
                }}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectReturnSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <p><strong>From:</strong> {selectedWalletReturn.from_location_name}</p>
                <p><strong>Return Reason:</strong> {selectedWalletReturn.reason}</p>
                <p><strong>Total Items:</strong> {(selectedWalletReturn.items || []).length} Line Items</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows="3"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. Items damaged upon physical inspection / Incorrect batch returned"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-rose-600"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedWalletReturn(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md glow-rose disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  {submitting ? 'Rejecting Return...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Detail Breakdown Modal */}
      {selectedReturnDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                  Stock Return Breakdown ({selectedReturnDetail.return_reference})
                </h3>
                <p className="text-xs text-slate-500 font-mono">Created on {formatDate(selectedReturnDetail.created_at)} by {selectedReturnDetail.created_by_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReturnDetail(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 text-xs border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">From Location</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedReturnDetail.from_location_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">To Location</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedReturnDetail.to_location_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Reason</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedReturnDetail.reason}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">{selectedReturnDetail.status}</span>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-950 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Item & Code</th>
                    <th className="p-3">Batch Code</th>
                    <th className="p-3 text-center">Returned Qty</th>
                    <th className="p-3 text-right">Unit Rate ({currencyCode})</th>
                    <th className="p-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(selectedReturnDetail.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold">{item.item_name}</td>
                      <td className="p-3 font-mono text-brand-blue">{item.batch_code}</td>
                      <td className="p-3 text-center font-extrabold">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(item.unit_rate, currencyCode, decimalPlaces)}</td>
                      <td className="p-3 text-right font-mono font-bold">{formatCurrency(item.total_amount, currencyCode, decimalPlaces)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedReturnDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Detail Breakdown Modal */}
      {selectedCreditNoteDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Credit Note ({selectedCreditNoteDetail.credit_note_no})
                </h3>
                <p className="text-xs text-slate-500 font-mono">Issued to {selectedCreditNoteDetail.branch_name} on {formatDate(selectedCreditNoteDetail.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCreditNoteDetail(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-xs space-y-1.5">
              <p><strong>Sub-Branch:</strong> {selectedCreditNoteDetail.branch_name} ({selectedCreditNoteDetail.branch_code})</p>
              <p><strong>Rejection Reason:</strong> {selectedCreditNoteDetail.reason}</p>
              <p><strong>Original Transfer Ref:</strong> {selectedCreditNoteDetail.original_transfer_no || '-'}</p>
              <p><strong>Issued By:</strong> {selectedCreditNoteDetail.created_by_name}</p>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-950 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Item & Code</th>
                    <th className="p-3">Batch Code</th>
                    <th className="p-3 text-center">Credited Qty</th>
                    <th className="p-3 text-right">Unit Rate ({currencyCode})</th>
                    <th className="p-3 text-right">Credit Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(selectedCreditNoteDetail.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold">{item.item_name}</td>
                      <td className="p-3 font-mono text-brand-blue">{item.batch_code}</td>
                      <td className="p-3 text-center font-extrabold">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(item.unit_rate, currencyCode, decimalPlaces)}</td>
                      <td className="p-3 text-right font-mono font-bold text-purple-600">{formatCurrency(item.total_amount, currencyCode, decimalPlaces)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm font-extrabold">
              <span>Total Credit Note Amount:</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 text-lg">
                {formatCurrency(selectedCreditNoteDetail.total_amount, currencyCode, decimalPlaces)}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedCreditNoteDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 text-xs font-bold"
              >
                Close Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                {confirmModal.icon}
                {confirmModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="py-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
              {confirmModal.message}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                }}
                disabled={submitting}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md flex items-center justify-center min-w-[120px] ${confirmModal.confirmStyle}`}
              >
                {submitting ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></span>
                ) : (
                  confirmModal.confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
