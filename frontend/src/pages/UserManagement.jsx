import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import SearchableSelect from '../components/common/SearchableSelect';
import { Users, Plus, CheckCircle2, AlertCircle, Edit3, UserX, UserCheck, X, Shield, Lock, Mail, User as UserIcon } from 'lucide-react';
import { ROLE_BADGES } from '../theme/colors';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State (New User)
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STORE_MANAGER');
  const [locationId, setLocationId] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('STORE_MANAGER');
  const [editLocationId, setEditLocationId] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

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
      if (masterData.locations && masterData.locations.length > 0 && !locationId) {
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

  const handleToggleStatus = async (userObj) => {
    const newStatus = userObj.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await apiFetch('/users/toggle-status', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userObj.id,
          raw_user_id: userObj.raw_id || userObj.id,
          status: newStatus
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: `User @${userObj.username} set to ${newStatus}!` });
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Status update failed' });
    }
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setEditFullName(u.full_name);
    setEditEmail(u.email);
    setEditPassword('');
    setEditRole(u.role);
    setEditLocationId(u.location_id || '');
    setShowEditModal(true);
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    try {
      const selectedLoc = locations.find(l => l.id === editLocationId || l.raw_id == editLocationId);
      const res = await apiFetch('/users/update', {
        method: 'POST',
        body: JSON.stringify({
          user_id: editingUser.id,
          raw_user_id: editingUser.raw_id || editingUser.id,
          full_name: editFullName,
          email: editEmail,
          password: editPassword,
          role: editRole,
          location_id: editLocationId,
          raw_location_id: selectedLoc ? (selectedLoc.raw_id || selectedLoc.id) : editLocationId
        })
      });

      if (res.success) {
        setMessage({ type: 'success', text: `User @${editingUser.username} permissions updated successfully!` });
        setShowEditModal(false);
        setEditingUser(null);
        loadData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update user' });
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
      header: 'Role & Permissions',
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
      header: 'Assigned Location Context',
      accessor: 'location_name',
      render: (u) => <span className="text-slate-700 dark:text-slate-300 font-medium">{u.location_name || 'Global System Access'}</span>
    },
    {
      header: 'Account Status',
      accessor: 'status',
      render: (u) => (
        <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold font-mono ${
          u.status === 'ACTIVE'
            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
        }`}>
          {u.status === 'ACTIVE' ? '🟢 ACTIVE' : '🔴 INACTIVE'}
        </span>
      )
    },
    {
      header: 'Actions & Permissions',
      accessor: 'id',
      className: 'text-center',
      render: (u) => (
        <div className="flex items-center justify-center gap-1.5">
          {/* Edit User & Role Button */}
          <button
            type="button"
            onClick={() => handleOpenEditModal(u)}
            className="px-2.5 py-1 rounded-lg bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white border border-brand-blue/30 text-xs font-bold transition-all flex items-center gap-1"
            title="Edit User Details, Role & Permissions"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Role
          </button>

          {/* Activate / Deactivate Toggle Button */}
          {u.status === 'ACTIVE' ? (
            u.role !== 'ADMIN' ? (
              <button
                type="button"
                onClick={() => handleToggleStatus(u)}
                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-300 text-xs font-bold transition-all flex items-center gap-1"
                title="Deactivate User Access"
              >
                <UserX className="w-3.5 h-3.5" />
                Deactivate
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-semibold italic border border-slate-200 dark:border-slate-800">
                System Admin Protected
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={() => handleToggleStatus(u)}
              className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1"
              title="Activate User Access"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Activate
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-blue" />
            System User Management & Role-Based Access Control (RBAC)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure organization users, edit role permissions (Admin, Store Manager, OPD Dispenser, Auditor), activate/deactivate accounts, and assign location context</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* User Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-brand-blue" />
          Create New System User
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Username *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. branch_north"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono"
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
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Role *</label>
            <SearchableSelect
              options={[
                { value: 'ADMIN', label: 'ADMIN (Full System Access)' },
                { value: 'STORE_MANAGER', label: 'STORE_MANAGER (Stock Operations)' },
                { value: 'OPD_USER', label: 'OPD_USER (Clinic Dispensing POS)' },
                { value: 'AUDITOR', label: 'AUDITOR (Read-Only Reports)' }
              ]}
              value={role}
              onChange={(val) => setRole(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Location Context</label>
            <SearchableSelect
              placeholder="Global System Access (No Location Constraint)"
              options={[
                { value: '', label: 'Global System Access (No Location Constraint)' },
                ...locations.map(l => ({ value: l.id, label: `${l.name} (${l.type})`, sublabel: `Code: ${l.code}` }))
              ]}
              value={locationId}
              onChange={(val) => setLocationId(val)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:bg-brand-blue/90 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Creating User...' : 'Create User'}
          </button>
        </div>
      </form>

      {/* Pure White DataTable */}
      <DataTable
        title="Organization Users & Permissions Directory"
        subtitle="Manage active/inactive accounts and edit user role permissions"
        columns={userColumns}
        data={users}
        searchable={true}
        defaultPageSize={10}
      />

      {/* Edit User & Permissions Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-brand-blue" />
                  Edit User Details & Role Permissions
                </h3>
                <p className="text-xs text-slate-500 font-mono">Editing Username: @{editingUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reset Password (Optional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep existing password"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Role & Permissions *</label>
                <SearchableSelect
                  options={[
                    { value: 'ADMIN', label: 'ADMIN (Full System Access)' },
                    { value: 'STORE_MANAGER', label: 'STORE_MANAGER (Stock Operations)' },
                    { value: 'OPD_USER', label: 'OPD_USER (Clinic Dispensing POS)' },
                    { value: 'AUDITOR', label: 'AUDITOR (Read-Only Reports)' }
                  ]}
                  value={editRole}
                  onChange={(val) => setEditRole(val)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Location Context</label>
                <SearchableSelect
                  placeholder="Global System Access (No Location Constraint)"
                  options={[
                    { value: '', label: 'Global System Access (No Location Constraint)' },
                    ...locations.map(l => ({ value: l.id, label: `${l.name} (${l.type})`, sublabel: `Code: ${l.code}` }))
                  ]}
                  value={editLocationId}
                  onChange={(val) => setEditLocationId(val)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:bg-brand-blue/90 disabled:opacity-50"
                >
                  {submitting ? 'Saving Changes...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
