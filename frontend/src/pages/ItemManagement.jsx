import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import DataTable from '../components/common/DataTable';
import { Boxes, Plus, Upload, FileSpreadsheet, Edit2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function ItemManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [uom, setUom] = useState('Box (100s)');
  const [minReorderLevel, setMinReorderLevel] = useState(10);

  // Excel / CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');

  const loadItems = async () => {
    try {
      const res = await apiFetch('/items');
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setItemCode('');
    setUom('Box (100s)');
    setMinReorderLevel(10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const endpoint = editingId ? '/items/update' : '/items';
      const payload = editingId
        ? { id: editingId, name, unit_of_measure: uom, min_reorder_level: minReorderLevel }
        : { name, item_code: itemCode, unit_of_measure: uom, min_reorder_level: minReorderLevel };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        resetForm();
        loadItems();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Item operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setItemCode(item.item_code);
    setUom(item.unit_of_measure || 'Unit');
    setMinReorderLevel(item.min_reorder_level || 10);
  };

  // Excel / CSV Bulk Import Handler
  const handleExcelImport = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!csvText.trim()) {
      alert('Please paste CSV / Excel item rows.');
      return;
    }

    // Parse CSV lines: Name, UnitOfMeasure, MinReorderLevel
    const lines = csvText.trim().split('\n');
    const parsedItems = [];

    for (let line of lines) {
      const parts = line.split(/,|\t/).map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts.length > 0 && parts[0] && parts[0].toLowerCase() !== 'name' && parts[0].toLowerCase() !== 'item_name') {
        parsedItems.push({
          name: parts[0],
          unit_of_measure: parts[1] || 'Unit',
          min_reorder_level: parseInt(parts[2] || 10)
        });
      }
    }

    if (parsedItems.length === 0) {
      alert('No valid item rows found in CSV text.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/items/import-excel', {
        method: 'POST',
        body: JSON.stringify({ items: parsedItems })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setShowImportModal(false);
        setCsvText('');
        loadItems();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Import failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const itemColumns = [
    {
      header: 'Item Details',
      accessor: 'name',
      render: (i) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">{i.name}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Code: {i.item_code} • Unit: {i.unit_of_measure}</p>
        </div>
      )
    },
    {
      header: 'Min Reorder Qty',
      accessor: 'min_reorder_level',
      render: (i) => (
        <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-500/30">
          {i.min_reorder_level || 10} units
        </span>
      )
    },
    {
      header: 'Category',
      accessor: 'category_name',
      render: (i) => <span className="text-slate-600 dark:text-slate-400 font-medium">{i.category_name || 'General Inventory'}</span>
    },
    {
      header: 'Total System Stock',
      accessor: 'total_system_stock',
      render: (i) => {
        const stock = parseInt(i.total_system_stock || 0);
        const minVal = parseInt(i.min_reorder_level || 10);
        const isLow = stock <= minVal;
        return (
          <span className={`font-bold px-2.5 py-1 rounded-xl text-xs border ${
            isLow ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
          }`}>
            {stock} units {isLow ? '(Low Stock Alert)' : ''}
          </span>
        );
      }
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'text-center',
      render: (i) => (
        <button
          onClick={() => startEdit(i)}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-brand-blue rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          title="Edit Item"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Boxes className="w-5 h-5 text-brand-blue" />
            Item Master Management & Bulk Excel Import
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add individual item masters with Minimum Order Qty / Reorder Levels, or import hundreds of items via Excel/CSV</p>
        </div>

        <button
          onClick={() => setShowImportModal(true)}
          className="px-4 py-2 rounded-xl bg-purple-600 dark:bg-purple-700 text-white text-xs font-bold shadow-md glow-purple hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-4 h-4" /> Import Excel / CSV
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Manual Item Creation Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {editingId ? 'Edit Item Master' : 'Add New Item Master'}
          </h3>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-800 underline">
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paracetamol 500mg Tablets"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Item Code</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal flex items-center gap-0.5">
                <Sparkles className="w-3 h-3" /> Auto-Generated
              </span>
            </label>
            <input
              type="text"
              disabled={!!editingId}
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              placeholder="Auto: e.g. ITM-0006"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unit of Measure (UOM) *</label>
            <input
              type="text"
              required
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="e.g. Box (100s), Bottle, Vial"
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Minimum Order Qty / Reorder Level *</label>
            <input
              type="number"
              min="1"
              required
              value={minReorderLevel}
              onChange={(e) => setMinReorderLevel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {editingId ? 'Update Item Master' : 'Add Item Master'}
          </button>
        </div>
      </form>

      {/* Item Master DataTable */}
      <DataTable
        title="Item Masters Directory"
        subtitle="List of all items, reorder thresholds, and total stock"
        columns={itemColumns}
        data={items}
        searchable={true}
        defaultPageSize={10}
      />

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Bulk Import Items from Excel / CSV
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paste item rows copied directly from Excel or CSV. Format: <strong>Item Name, Unit of Measure, Minimum Order Qty</strong>
            </p>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Amoxicillin 500mg, Box (100s), 15\nIbuprofen 400mg, Strip (10s), 20\nVitamin C 1000mg, Bottle, 10`}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-purple-600"
            />

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExcelImport}
                disabled={submitting}
                className="px-6 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md glow-purple flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Import Items to Master
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
