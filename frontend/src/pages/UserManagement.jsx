import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { Users, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { ROLE_BADGES } from '../theme/colors';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STORE_MANAGER');
  const [locationId, setLocationId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const loadData = async () => {
    try {
      const [userData, masterData] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/master-data')
      ]);
      setUsers(userData.users || []);
      setLocations(masterData.locations || []);
      if (masterData.locations && masterData.locations.length > 0) {
        setLocationId(masterData.locations[0].id);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    setSubmitting(true);
    try {
      const selectedLoc = locations.find(l => l.id === locationId || l.raw_id == locationId);
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          password,
          role,
          location_id: locationId,
          raw_location_id: selectedLoc ? (selectedLoc.raw_id || selectedLoc.id) : locationId
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: `User @${username} created successfully!` });
        setUsername('');
        setFullName('');
        setEmail('');
        setPassword('');
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'User creation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const userColumns = [
    {
      header: 'User & Username',
      accessor: 'full_name',
      render: (u) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{u.full_name} <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">(@{u.username})</span></p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{u.email}</p>
        </div>
      )
    },
    {
      header: 'Role Badge',
      accessor: 'role',
      render: (u) => {
        const badge = ROLE_BADGES[u.role] || { label: u.role, bg: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${badge.bg}`}>
            {badge.label}
          </span>
        );
      }
    },
    {
      header: 'Assigned Location',
      accessor: 'location_name',
      render: (u) => <span className="text-slate-700 dark:text-slate-300 font-medium">{u.location_name || 'Global System Access'}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (u) => (
        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-[10px] font-bold">
          {u.status}
        </span>
      )
    },
    {
      header: 'Created At',
      accessor: 'created_at',
      render: (u) => <span className="text-slate-500 dark:text-slate-400 font-mono">{u.created_at}</span>
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            System User Management & Role-Based Access (RBAC)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure organization users, role permissions (Admin, Store Manager, OPD Dispenser, Auditor) and location scoping</p>
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

      {/* User Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Create New System User</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Username *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. store_mgr_south"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Robert Smith"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="robert@organization.org"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Role *</label>
            <SearchableSelect
              options={[
                { value: 'ADMIN', label: 'ADMIN (Full Access)' },
                { value: 'STORE_MANAGER', label: 'STORE_MANAGER (Stock Operations)' },
                { value: 'OPD_USER', label: 'OPD_USER (Clinic Dispensing Entry)' },
                { value: 'AUDITOR', label: 'AUDITOR (Read-Only Reports)' }
              ]}
              value={role}
              onChange={(val) => setRole(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Location Context</label>
            <SearchableSelect
              placeholder="Global System Access"
              options={locations.map(l => ({ value: l.id, label: l.name, sublabel: l.type }))}
              value={locationId}
              onChange={(val) => setLocationId(val)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            {submitting ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create User
              </>
            )}
          </button>
        </div>
      </form>

      {/* Pure White DataTable */}
      <DataTable
        title="Existing Organization Users Directory"
        subtitle="Search and sort user accounts, roles, and assigned location scopes"
        columns={userColumns}
        data={users}
        searchable={true}
        defaultPageSize={10}
      />
    </div>
  );
}
