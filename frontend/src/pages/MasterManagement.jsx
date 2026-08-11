import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import {
  Building2,
  Truck,
  Building,
  Users,
  Plus,
  Edit2,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function MasterManagement() {
  const [activeTab, setActiveTab] = useState('vendors'); // vendors | branches | clinics | customers

  // Data states
  const [vendors, setVendors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Edit / Form state
  const [editingId, setEditingId] = useState(null);

  // Vendor form
  const [vName, setVName] = useState('');
  const [vCode, setVCode] = useState('');
  const [vContact, setVContact] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vTaxId, setVTaxId] = useState('');

  // Location (Branch / Clinic) form
  const [lName, setLName] = useState('');
  const [lCode, setLCode] = useState('');
  const [lType, setLType] = useState('SUB_BRANCH'); // SUB_BRANCH or CLINIC
  const [lPhone, setLPhone] = useState('');
  const [lAddress, setLAddress] = useState('');

  // Customer form
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cAddress, setCAddress] = useState('');

  const loadAllMasters = async () => {
    try {
      const [vRes, lRes, cRes, settingsRes] = await Promise.all([
        apiFetch('/vendors'),
        apiFetch('/locations'),
        apiFetch('/customers'),
        apiFetch('/settings')
      ]);
      setVendors(vRes.vendors || []);
      setLocations(lRes.locations || []);
      setCustomers(cRes.customers || []);
      setSequences(settingsRes.sequences || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasters();
  }, []);

  const getSeqPreview = (key) => {
    const seq = sequences.find(s => s.sequence_key === key);
    if (!seq) return 'Auto-generated';
    const year = new Date().getFullYear();
    const nextVal = (parseInt(seq.current_val || 0) + 1);
    const padLen = parseInt(seq.padding_length || 4);
    const padded = String(nextVal).padStart(padLen, '0');
    let template = seq.format_template || '{PREFIX}{SEQ}';
    template = template.replace('{PREFIX}', seq.prefix || '');
    template = template.replace('{YEAR}', year);
    template = template.replace('{SEQ}', padded);
    return `Auto: ${template}`;
  };

  const resetForms = () => {
    setEditingId(null);
    setVName(''); setVCode(''); setVContact(''); setVPhone(''); setVEmail(''); setVAddress(''); setVTaxId('');
    setLName(''); setLCode(''); setLPhone(''); setLAddress('');
    setCName(''); setCCode(''); setCPhone(''); setCEmail(''); setCAddress('');
  };

  // Vendor Submit (Add / Edit)
  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const endpoint = editingId ? '/vendors/update' : '/vendors';
      const payload = editingId
        ? { id: editingId, name: vName, contact_person: vContact, phone: vPhone, email: vEmail, address: vAddress, tax_id: vTaxId }
        : { name: vName, code: vCode, contact_person: vContact, phone: vPhone, email: vEmail, address: vAddress, tax_id: vTaxId };

      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForms();
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Vendor operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Location Submit (Add / Edit)
  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const endpoint = editingId ? '/locations/update' : '/locations';
      const payload = editingId
        ? { id: editingId, name: lName, phone: lPhone, address: lAddress }
        : { name: lName, code: lCode, type: lType, phone: lPhone, address: lAddress };

      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForms();
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Location operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Customer Submit (Add / Edit)
  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const endpoint = editingId ? '/customers/update' : '/customers';
      const payload = editingId
        ? { id: editingId, name: cName, phone: cPhone, email: cEmail, address: cAddress }
        : { name: cName, code: cCode, phone: cPhone, email: cEmail, address: cAddress };

      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForms();
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Customer operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  // Generic Toggle Status
  const handleToggleStatus = async (type, id) => {
    setMessage(null);
    try {
      const res = await apiFetch(`/${type}/toggle-status`, { method: 'POST', body: JSON.stringify({ id }) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle status' });
    }
  };

  // Generic Delete (Protected by transaction check)
  const handleDelete = async (type, id, name, hasTx) => {
    if (hasTx) {
      alert(`Cannot delete '${name}'. Transactions exist for this entity.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete '${name}'? This action cannot be undone.`)) return;

    setMessage(null);
    try {
      const res = await apiFetch(`/${type}/delete`, { method: 'POST', body: JSON.stringify({ id }) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Delete operation failed' });
    }
  };

  // Edit triggers
  const startEditVendor = (v) => {
    setEditingId(v.id);
    setVName(v.name);
    setVCode(v.code);
    setVContact(v.contact_person || '');
    setVPhone(v.phone || '');
    setVEmail(v.email || '');
    setVAddress(v.address || '');
    setVTaxId(v.tax_id || '');
  };

  const startEditLocation = (l) => {
    setEditingId(l.id);
    setLName(l.name);
    setLCode(l.code);
    setLType(l.type);
    setLPhone(l.phone || '');
    setLAddress(l.address || '');
  };

  const startEditCustomer = (c) => {
    setEditingId(c.id);
    setCName(c.name);
    setCCode(c.code);
    setCPhone(c.phone || '');
    setCEmail(c.email || '');
    setCAddress(c.address || '');
  };

  // Filtered Locations
  const branchesList = locations.filter(l => l.type === 'SUB_BRANCH' || l.type === 'MAIN_BRANCH');
  const clinicsList = locations.filter(l => l.type === 'CLINIC');

  // Vendor Columns
  const vendorColumns = [
    {
      header: 'Vendor Name & Code',
      accessor: 'name',
      render: (v) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{v.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {v.code} {v.tax_id ? `• Tax ID: ${v.tax_id}` : ''}</p>
        </div>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'phone',
      render: (v) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{v.contact_person || 'N/A'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{v.phone} {v.email ? `| ${v.email}` : ''}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (v) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          v.status === 'ACTIVE'
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
        }`}>
          {v.status}
        </span>
      )
    },
    {
      header: 'Linked Transactions',
      accessor: 'tx_count',
      render: (v) => (
        <span className={`text-xs font-bold ${v.has_transactions ? 'text-brand-blue' : 'text-slate-400'}`}>
          {v.tx_count} {v.tx_count === 1 ? 'transaction' : 'transactions'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (v) => (
        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => startEditVendor(v)}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit Vendor"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToggleStatus('vendors', v.id)}
            className={`p-1.5 rounded-lg transition-all ${
              v.status === 'ACTIVE'
                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            title={v.status === 'ACTIVE' ? 'Deactivate Vendor' : 'Activate Vendor'}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={!v.delete_allowed}
            onClick={() => handleDelete('vendors', v.id, v.name, v.has_transactions)}
            className={`p-1.5 rounded-lg transition-all ${
              v.delete_allowed
                ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }`}
            title={v.delete_allowed ? 'Delete Vendor' : `Delete disabled: ${v.tx_count} transaction(s) linked to this vendor`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  // Location Columns (Branches & Clinics)
  const locationColumns = [
    {
      header: 'Location Name & Code',
      accessor: 'name',
      render: (l) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{l.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {l.code} • Type: {l.type}</p>
        </div>
      )
    },
    {
      header: 'Address & Phone',
      accessor: 'address',
      render: (l) => (
        <div className="text-xs">
          <p className="text-slate-700 dark:text-slate-300">{l.address || 'N/A'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{l.phone}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (l) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          l.status === 'ACTIVE'
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
        }`}>
          {l.status}
        </span>
      )
    },
    {
      header: 'Linked Transactions',
      accessor: 'tx_count',
      render: (l) => (
        <span className={`text-xs font-bold ${l.has_transactions ? 'text-brand-blue' : 'text-slate-400'}`}>
          {l.tx_count} {l.tx_count === 1 ? 'transaction' : 'transactions'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (l) => (
        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => startEditLocation(l)}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit Location"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={l.type === 'MAIN_BRANCH'}
            onClick={() => handleToggleStatus('locations', l.id)}
            className={`p-1.5 rounded-lg transition-all ${
              l.type === 'MAIN_BRANCH'
                ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                : l.status === 'ACTIVE'
                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            title={l.type === 'MAIN_BRANCH' ? 'Main Store status cannot be toggled' : l.status === 'ACTIVE' ? 'Deactivate Location' : 'Activate Location'}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={!l.delete_allowed || l.type === 'MAIN_BRANCH'}
            onClick={() => handleDelete('locations', l.id, l.name, l.has_transactions)}
            className={`p-1.5 rounded-lg transition-all ${
              l.delete_allowed && l.type !== 'MAIN_BRANCH'
                ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }`}
            title={!l.delete_allowed ? `Delete disabled: ${l.tx_count} transaction(s) linked to this location` : 'Delete Location'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  // Customer Columns
  const customerColumns = [
    {
      header: 'Customer Name & Code',
      accessor: 'name',
      render: (c) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{c.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {c.code}</p>
        </div>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'phone',
      render: (c) => (
        <div className="text-xs">
          <p className="text-slate-700 dark:text-slate-300">{c.phone || 'N/A'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{c.email}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (c) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          c.status === 'ACTIVE'
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
        }`}>
          {c.status}
        </span>
      )
    },
    {
      header: 'Linked Transactions',
      accessor: 'tx_count',
      render: (c) => (
        <span className={`text-xs font-bold ${c.has_transactions ? 'text-brand-blue' : 'text-slate-400'}`}>
          {c.tx_count} {c.tx_count === 1 ? 'sale' : 'sales'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (c) => (
        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => startEditCustomer(c)}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit Customer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleToggleStatus('customers', c.id)}
            className={`p-1.5 rounded-lg transition-all ${
              c.status === 'ACTIVE'
                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            title={c.status === 'ACTIVE' ? 'Deactivate Customer' : 'Activate Customer'}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={!c.delete_allowed}
            onClick={() => handleDelete('customers', c.id, c.name, c.has_transactions)}
            className={`p-1.5 rounded-lg transition-all ${
              c.delete_allowed
                ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
            }`}
            title={!c.delete_allowed ? `Delete disabled: ${c.tx_count} sale(s) linked to this customer` : 'Delete Customer'}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-blue" />
            Master Organization Entity Management (Vendors, Branches, Clinics & Customers)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add, Edit, Deactivate or Delete organization master entities with automated sequence generation</p>
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

      {/* Sub Tabs Bar */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => { setActiveTab('vendors'); resetForms(); }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'vendors' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" /> Vendors & Suppliers ({vendors.length})
        </button>

        <button
          onClick={() => { setActiveTab('branches'); resetForms(); }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'branches' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" /> Regional Sub-Branches ({branchesList.length})
        </button>

        <button
          onClick={() => { setActiveTab('clinics'); resetForms(); }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'clinics' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building className="w-4 h-4" /> Clinic Outlets ({clinicsList.length})
        </button>

        <button
          onClick={() => { setActiveTab('customers'); resetForms(); }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'customers' ? 'bg-brand-blue text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Customers & Patients ({customers.length})
        </button>
      </div>

      {/* 1. VENDORS TAB */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <form onSubmit={handleVendorSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editingId ? 'Edit Vendor Details' : 'Add New Supplier / Vendor'}
              </h3>
              {editingId && (
                <button type="button" onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Apex Pharma Corp"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Vendor Code</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Auto-Generated
                  </span>
                </label>
                <input
                  type="text"
                  disabled={!!editingId}
                  value={vCode}
                  onChange={(e) => setVCode(e.target.value)}
                  placeholder={getSeqPreview('vendor')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={vPhone}
                  onChange={(e) => setVPhone(e.target.value)}
                  placeholder="+1 800-555-0199"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  placeholder="sales@apexpharma.com"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tax ID / GSTIN</label>
                <input
                  type="text"
                  value={vTaxId}
                  onChange={(e) => setVTaxId(e.target.value)}
                  placeholder="TAX-994820"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {editingId ? 'Update Vendor' : 'Add Vendor'}
              </button>
            </div>
          </form>

          <DataTable
            title="Vendors Directory"
            subtitle="Search, edit, activate/deactivate, or delete suppliers (delete is protected if purchase invoices exist)"
            columns={vendorColumns}
            data={vendors}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}

      {/* 2. SUB-BRANCHES TAB */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <form onSubmit={handleLocationSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editingId ? 'Edit Sub-Branch Details' : 'Add New Regional Sub-Branch'}
              </h3>
              {editingId && (
                <button type="button" onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sub-Branch Name *</label>
                <input
                  type="text"
                  required
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  placeholder="e.g. East Regional Sub-Branch"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Location Code</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Auto-Generated
                  </span>
                </label>
                <input
                  type="text"
                  disabled={!!editingId}
                  value={lCode}
                  onChange={(e) => setLCode(e.target.value)}
                  placeholder={getSeqPreview('branch')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={lPhone}
                  onChange={(e) => setLPhone(e.target.value)}
                  placeholder="+1 800-555-0399"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={lAddress}
                  onChange={(e) => setLAddress(e.target.value)}
                  placeholder="101 Commercial Highway, Sector 4"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {editingId ? 'Update Sub-Branch' : 'Add Sub-Branch'}
              </button>
            </div>
          </form>

          <DataTable
            title="Regional Sub-Branches Directory"
            subtitle="Search, edit, activate/deactivate, or delete sub-branches (delete is protected if stock transfers exist)"
            columns={locationColumns}
            data={branchesList}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}

      {/* 3. CLINICS TAB */}
      {activeTab === 'clinics' && (
        <div className="space-y-6">
          <form onSubmit={handleLocationSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editingId ? 'Edit Clinic Outlet Details' : 'Add New Clinic Outlet'}
              </h3>
              {editingId && (
                <button type="button" onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clinic Name *</label>
                <input
                  type="text"
                  required
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  placeholder="e.g. Westside Family Clinic"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Clinic Code</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Auto-Generated
                  </span>
                </label>
                <input
                  type="text"
                  disabled={!!editingId}
                  value={lCode}
                  onChange={(e) => setLCode(e.target.value)}
                  placeholder={getSeqPreview('clinic')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={lPhone}
                  onChange={(e) => setLPhone(e.target.value)}
                  placeholder="+1 800-555-0403"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={lAddress}
                  onChange={(e) => setLAddress(e.target.value)}
                  placeholder="45 Health Plaza Boulevard"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                onClick={() => setLType('CLINIC')}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {editingId ? 'Update Clinic' : 'Add Clinic Outlet'}
              </button>
            </div>
          </form>

          <DataTable
            title="Clinic Outlets Directory"
            subtitle="Search, edit, activate/deactivate, or delete clinics (delete is protected if OPD dispensing sales exist)"
            columns={locationColumns}
            data={clinicsList}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}

      {/* 4. CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <form onSubmit={handleCustomerSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {editingId ? 'Edit Customer Details' : 'Add New Customer / Patient'}
              </h3>
              {editingId && (
                <button type="button" onClick={resetForms} className="text-xs text-slate-500 hover:text-slate-800 underline">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Customer Code</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Auto-Generated
                  </span>
                </label>
                <input
                  type="text"
                  disabled={!!editingId}
                  value={cCode}
                  onChange={(e) => setCCode(e.target.value)}
                  placeholder={getSeqPreview('customer')}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={cPhone}
                  onChange={(e) => setCPhone(e.target.value)}
                  placeholder="+1 555-0188"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="sarah@email.com"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  placeholder="55 Sunset Strip, Suite 10"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {editingId ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </form>

          <DataTable
            title="Customers & Patients Directory"
            subtitle="Search, edit, activate/deactivate, or delete customer profiles (delete is protected if OPD sales invoices exist)"
            columns={customerColumns}
            data={customers}
            searchable={true}
            defaultPageSize={10}
          />
        </div>
      )}
    </div>
  );
}
