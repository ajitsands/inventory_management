import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
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
  Sparkles,
  Stethoscope
} from 'lucide-react';

export default function MasterManagement() {
  const [activeTab, setActiveTab] = useState('vendors'); // vendors | branches | clinics | customers | doctors

  // Data states
  const [vendors, setVendors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [doctors, setDoctors] = useState([]);
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

  // Doctor form
  const [docName, setDocName] = useState('');
  const [docCode, setDocCode] = useState('');
  const [docSpeciality, setDocSpeciality] = useState('General Physician');
  const [docPhone, setDocPhone] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docLocationId, setDocLocationId] = useState('');

  const loadAllMasters = async () => {
    try {
      const [vRes, lRes, cRes, dRes, settingsRes] = await Promise.all([
        apiFetch('/vendors'),
        apiFetch('/locations'),
        apiFetch('/customers'),
        apiFetch('/doctors'),
        apiFetch('/settings')
      ]);
      setVendors(vRes.vendors || []);
      setLocations(lRes.locations || []);
      setCustomers(cRes.customers || []);
      setDoctors(dRes.doctors || []);
      setSequences(settingsRes.sequences || []);

      const clinicLocs = (lRes.locations || []).filter(l => l.type === 'CLINIC' || l.type === 'SUB_BRANCH');
      if (clinicLocs.length > 0 && !docLocationId) {
        setDocLocationId(clinicLocs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasters();
  }, []);

  const resetForms = () => {
    setEditingId(null);
    setVName(''); setVCode(''); setVContact(''); setVPhone(''); setVEmail(''); setVAddress(''); setVTaxId('');
    setLName(''); setLCode(''); setLPhone(''); setLAddress('');
    setCName(''); setCCode(''); setCPhone(''); setCEmail(''); setCAddress('');
    setDocName(''); setDocCode(''); setDocSpeciality('General Physician'); setDocPhone(''); setDocEmail('');
  };

  // Doctor Submit (Add / Edit)
  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!docName || !docLocationId) {
      setMessage({ type: 'error', text: 'Doctor Name and Assigned Clinic / Location are required.' });
      return;
    }

    setSubmitting(true);
    try {
      const selectedLoc = locations.find(l => l.id === docLocationId || l.raw_id == docLocationId);
      const endpoint = editingId ? '/doctors/update' : '/doctors';
      const payload = editingId
        ? { id: editingId, name: docName, speciality: docSpeciality, phone: docPhone, email: docEmail, location_id: docLocationId, raw_location_id: selectedLoc?.raw_id }
        : { name: docName, doctor_code: docCode, speciality: docSpeciality, phone: docPhone, email: docEmail, location_id: docLocationId, raw_location_id: selectedLoc?.raw_id };

      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForms();
        loadAllMasters();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Doctor operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEditDoctor = (d) => {
    setEditingId(d.id);
    setDocName(d.name);
    setDocCode(d.doctor_code);
    setDocSpeciality(d.speciality || 'General Physician');
    setDocPhone(d.phone || '');
    setDocEmail(d.email || '');
    setDocLocationId(d.location_id || d.raw_location_id);
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

  // Location Submit (Add / Edit)
  const handleLocationSubmit = async (e, type) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const endpoint = editingId ? '/locations/update' : '/locations';
      const payload = editingId
        ? { id: editingId, name: lName, phone: lPhone, address: lAddress }
        : { name: lName, code: lCode, type: type, phone: lPhone, address: lAddress };

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

  const startEditLocation = (l) => {
    setEditingId(l.id);
    setLName(l.name);
    setLCode(l.code);
    setLType(l.type);
    setLPhone(l.phone || '');
    setLAddress(l.address || '');
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

  const startEditCustomer = (c) => {
    setEditingId(c.id);
    setCName(c.name);
    setCCode(c.code);
    setCPhone(c.phone || '');
    setCEmail(c.email || '');
    setCAddress(c.address || '');
  };

  const branchesList = locations.filter(l => l.type === 'SUB_BRANCH');
  const clinicsList = locations.filter(l => l.type === 'CLINIC');

  // Doctor Columns
  const doctorColumns = [
    {
      header: 'Doctor Name & Code',
      accessor: 'name',
      render: (d) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-brand-orange" />
            {d.name}
          </p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {d.doctor_code} • {d.speciality}</p>
        </div>
      )
    },
    {
      header: 'Assigned Clinic / Location',
      accessor: 'location_name',
      render: (d) => (
        <div>
          <span className="font-bold text-brand-blue block text-xs">{d.location_name}</span>
          <span className="text-[10px] text-slate-400 font-mono">Code: {d.location_code}</span>
        </div>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'phone',
      render: (d) => (
        <div className="text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{d.phone || 'N/A'}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{d.email}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (d) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          d.status === 'ACTIVE'
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
        }`}>
          {d.status}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (d) => (
        <div className="flex items-center justify-center space-x-1">
          <button
            onClick={() => startEditDoctor(d)}
            className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit Doctor"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  // Vendor Columns
  const vendorColumns = [
    {
      header: 'Vendor Name & Code',
      accessor: 'name',
      render: (v) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{v.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {v.code}</p>
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
        </div>
      )
    }
  ];

  // Location Columns
  const locationColumns = [
    {
      header: 'Location Name & Code',
      accessor: 'name',
      render: (l) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{l.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {l.code}</p>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (l) => (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
          {l.type}
        </span>
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
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-blue" />
            Master Organization Entity Management (Doctors, Vendors, Branches, Clinics & Customers)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage doctors, vendors, branches, clinics, and customer records with automated sequence generation</p>
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
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => { setActiveTab('doctors'); resetForms(); }}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'doctors' ? 'bg-brand-orange text-white font-bold' : 'text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Stethoscope className="w-4 h-4" /> Doctors & Physicians ({doctors.length})
        </button>

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

      {/* DOCTORS MASTER TAB */}
      {activeTab === 'doctors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-brand-orange" />
              {editingId ? 'Edit Doctor Master Record' : 'Create New Doctor Master'}
            </h3>

            <form onSubmit={handleDoctorSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Doctor Full Name *</label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Dr. Alexander Smith"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-orange"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Doctor Code / License # (Auto-Generated if empty)</label>
                  <input
                    type="text"
                    value={docCode}
                    onChange={(e) => setDocCode(e.target.value)}
                    placeholder="e.g. DOC-004"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-brand-orange"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Clinic / Outlet *</label>
                <SearchableSelect
                  placeholder="Select Assigned Clinic Outlet..."
                  options={locations.filter(l => l.type === 'CLINIC' || l.type === 'SUB_BRANCH').map(l => ({
                    value: l.id,
                    label: `${l.name} (${l.code})`,
                    sublabel: `Type: ${l.type}`
                  }))}
                  value={docLocationId}
                  onChange={(val) => setDocLocationId(val)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Speciality / Designation</label>
                <input
                  type="text"
                  value={docSpeciality}
                  onChange={(e) => setDocSpeciality(e.target.value)}
                  placeholder="e.g. Consultant Cardiologist"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-orange font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={docPhone}
                    onChange={(e) => setDocPhone(e.target.value)}
                    placeholder="+973 1700-0000"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={docEmail}
                    onChange={(e) => setDocEmail(e.target.value)}
                    placeholder="doctor@clinic.org"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-orange"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-orange to-amber-600 text-white font-bold text-xs shadow-md glow-orange hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Update Doctor' : 'Save Doctor Master'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForms}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-7">
            <DataTable
              title="Registered Doctors & Physicians List"
              subtitle="Search and view doctors assigned across clinics"
              columns={doctorColumns}
              data={doctors}
              searchable={true}
              defaultPageSize={5}
            />
          </div>
        </div>
      )}

      {/* VENDORS MASTER TAB */}
      {activeTab === 'vendors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-blue" />
              {editingId ? 'Edit Vendor Master Record' : 'Create New Vendor Master'}
            </h3>

            <form onSubmit={handleVendorSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. MediTech Pharma Supplies"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor Code (Auto-Generated if empty)</label>
                  <input
                    type="text"
                    value={vCode}
                    onChange={(e) => setVCode(e.target.value)}
                    placeholder="e.g. VND-0001"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={vContact}
                  onChange={(e) => setVContact(e.target.value)}
                  placeholder="e.g. John Stevenson"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={vPhone}
                    onChange={(e) => setVPhone(e.target.value)}
                    placeholder="+973 1700-0000"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={vEmail}
                    onChange={(e) => setVEmail(e.target.value)}
                    placeholder="sales@vendor.com"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Update Vendor' : 'Save Vendor Master'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForms}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-7">
            <DataTable
              title="Registered Vendors & Suppliers List"
              columns={vendorColumns}
              data={vendors}
              searchable={true}
              defaultPageSize={5}
            />
          </div>
        </div>
      )}

      {/* BRANCHES MASTER TAB */}
      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-blue" />
              {editingId ? 'Edit Sub-Branch Master' : 'Create New Sub-Branch Master'}
            </h3>

            <form onSubmit={(e) => handleLocationSubmit(e, 'SUB_BRANCH')} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sub-Branch Name *</label>
                <input
                  type="text"
                  required
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  placeholder="e.g. East Regional Sub-Branch"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Branch Code (Auto-Generated if empty)</label>
                  <input
                    type="text"
                    value={lCode}
                    onChange={(e) => setLCode(e.target.value)}
                    placeholder="e.g. LOC-SUB-03"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={lPhone}
                  onChange={(e) => setLPhone(e.target.value)}
                  placeholder="+973 1700-0000"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Update Sub-Branch' : 'Save Sub-Branch Master'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForms}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-7">
            <DataTable
              title="Regional Sub-Branches List"
              columns={locationColumns}
              data={branchesList}
              searchable={true}
              defaultPageSize={5}
            />
          </div>
        </div>
      )}

      {/* CLINICS MASTER TAB */}
      {activeTab === 'clinics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-blue" />
              {editingId ? 'Edit Clinic Outlet Master' : 'Create New Clinic Outlet Master'}
            </h3>

            <form onSubmit={(e) => handleLocationSubmit(e, 'CLINIC')} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clinic Outlet Name *</label>
                <input
                  type="text"
                  required
                  value={lName}
                  onChange={(e) => setLName(e.target.value)}
                  placeholder="e.g. City Health Clinic Outlet #3"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Clinic Code (Auto-Generated if empty)</label>
                  <input
                    type="text"
                    value={lCode}
                    onChange={(e) => setLCode(e.target.value)}
                    placeholder="e.g. LOC-CLN-03"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={lPhone}
                  onChange={(e) => setLPhone(e.target.value)}
                  placeholder="+973 1700-0000"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Update Clinic Outlet' : 'Save Clinic Master'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForms}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-7">
            <DataTable
              title="Clinic Outlets List"
              columns={locationColumns}
              data={clinicsList}
              searchable={true}
              defaultPageSize={5}
            />
          </div>
        </div>
      )}

      {/* CUSTOMERS MASTER TAB */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-blue" />
              {editingId ? 'Edit Customer Master' : 'Create New Customer Master'}
            </h3>

            <form onSubmit={handleCustomerSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Patient Name *</label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="e.g. Ahmed Hassan"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Code (Auto-Generated if empty)</label>
                  <input
                    type="text"
                    value={cCode}
                    onChange={(e) => setCCode(e.target.value)}
                    placeholder="e.g. CUST-0001"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    placeholder="+973 3300-0000"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingId ? 'Update Customer' : 'Save Customer Master'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForms}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-7">
            <DataTable
              title="Registered Customers & Patients List"
              columns={customerColumns}
              data={customers}
              searchable={true}
              defaultPageSize={5}
            />
          </div>
        </div>
      )}
    </div>
  );
}
