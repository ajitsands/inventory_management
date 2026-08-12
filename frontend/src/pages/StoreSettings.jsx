import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import SearchableSelect from '../components/common/SearchableSelect';
import { formatDate } from '../utils/date';
import { Settings, Save, CheckCircle2, AlertCircle, Globe, Percent, Hash, Calculator } from 'lucide-react';

export default function StoreSettings() {
  const [settings, setSettings] = useState({
    store_name: '',
    timezone: 'Asia/Bahrain',
    currency_code: 'BHD',
    vat_percent: '10.00',
    vat_calculation_mode: 'ITEM_WISE',
    price_tax_type: 'EXCLUSIVE',
    decimal_places: '3',
    date_format: 'DD/MM/YYYY',
    company_address: '',
    company_phone: '',
    company_email: ''
  });

  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [submittingSequences, setSubmittingSequences] = useState(false);
  const [message, setMessage] = useState(null);

  const loadData = async () => {
    try {
      const res = await apiFetch('/settings');
      if (res.success) {
        setSettings(prev => ({ ...prev, ...res.settings }));
        setSequences(res.sequences || []);
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

  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmittingSettings(true);
    try {
      const res = await apiFetch('/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setSettings(prev => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setSubmittingSettings(false);
    }
  };

  const handleSequencesSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmittingSequences(true);
    try {
      const res = await apiFetch('/settings/sequences', {
        method: 'POST',
        body: JSON.stringify({ sequences })
      });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setSequences(res.sequences || []);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update sequence formats' });
    } finally {
      setSubmittingSequences(false);
    }
  };

  const handleSeqChange = (index, field, value) => {
    const updated = [...sequences];
    updated[index][field] = value;
    setSequences(updated);
  };

  const renderPreview = (seq) => {
    const year = new Date().getFullYear();
    const nextVal = (parseInt(seq.current_val || 0) + 1);
    const padLen = parseInt(seq.padding_length || 4);
    const padded = String(nextVal).padStart(padLen, '0');
    let template = seq.format_template || '{PREFIX}{SEQ}';
    template = template.replace('{PREFIX}', seq.prefix || '');
    template = template.replace('{YEAR}', year);
    template = template.replace('{SEQ}', padded);
    return template;
  };

  const isThreeDecimals = ['BHD', 'KWD', 'OMR'].includes(settings.currency_code);
  const sampleToday = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-blue" />
            Store Settings & Auto-Increment Numbering System
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure regional GCC currency rules, Item-Wise vs Total Bill VAT Calculation, custom Date Formats, and auto-incremental 4-digit prefixes</p>
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

      {/* 1. Regional Store Settings Form */}
      <form onSubmit={handleSettingsSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-blue" /> Regional Currency, Timezone & Tax Configuration
          </h3>
          <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue border border-brand-blue/30">
            {isThreeDecimals ? '3 Decimals Enforced (GCC)' : '2 Decimals Enforced'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Organization / Store Name *</label>
            <input
              type="text"
              required
              value={settings.store_name}
              onChange={(e) => setSettings({ ...settings, store_name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:border-brand-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Store Timezone *</label>
            <SearchableSelect
              options={[
                { value: 'Asia/Bahrain', label: 'Asia/Bahrain (Kingdom of Bahrain GMT+3)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE GMT+4)' },
                { value: 'Asia/Riyadh', label: 'Asia/Riyadh (Saudi Arabia GMT+3)' },
                { value: 'Asia/Kuwait', label: 'Asia/Kuwait (Kuwait GMT+3)' },
                { value: 'Asia/Muscat', label: 'Asia/Muscat (Oman GMT+4)' },
                { value: 'Asia/Qatar', label: 'Asia/Qatar (Qatar GMT+3)' },
                { value: 'Asia/Kolkata', label: 'Asia/Kolkata (India IST GMT+5:30)' },
                { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
              ]}
              value={settings.timezone}
              onChange={(val) => setSettings({ ...settings, timezone: val })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date Display Format *</label>
            <SearchableSelect
              options={[
                { value: 'DD/MM/YYYY', label: `DD/MM/YYYY (e.g. ${formatDate(sampleToday, 'DD/MM/YYYY')})` },
                { value: 'MM/DD/YYYY', label: `MM/DD/YYYY (e.g. ${formatDate(sampleToday, 'MM/DD/YYYY')})` },
                { value: 'YYYY-MM-DD', label: `YYYY-MM-DD (e.g. ${formatDate(sampleToday, 'YYYY-MM-DD')})` },
                { value: 'YYYY/MM/DD', label: `YYYY/MM/DD (e.g. ${formatDate(sampleToday, 'YYYY/MM/DD')})` },
                { value: 'DD-MMM-YYYY', label: `DD-MMM-YYYY (e.g. ${formatDate(sampleToday, 'DD-MMM-YYYY')})` }
              ]}
              value={settings.date_format}
              onChange={(val) => setSettings({ ...settings, date_format: val })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Base Currency *</label>
            <SearchableSelect
              options={[
                { value: 'BHD', label: 'BHD - Bahraini Dinar (3 Decimals Default)', sublabel: 'Kingdom of Bahrain' },
                { value: 'KWD', label: 'KWD - Kuwaiti Dinar (3 Decimals)', sublabel: 'State of Kuwait' },
                { value: 'OMR', label: 'OMR - Omani Rial (3 Decimals)', sublabel: 'Sultanate of Oman' },
                { value: 'AED', label: 'AED - UAE Dirham (2 Decimals)', sublabel: 'United Arab Emirates' },
                { value: 'SAR', label: 'SAR - Saudi Riyal (2 Decimals)', sublabel: 'Kingdom of Saudi Arabia' },
                { value: 'QAR', label: 'QAR - Qatari Riyal (2 Decimals)', sublabel: 'State of Qatar' },
                { value: 'INR', label: 'INR - Indian Rupee (2 Decimals)', sublabel: 'Republic of India' },
                { value: 'USD', label: 'USD - US Dollar (2 Decimals)', sublabel: 'United States' }
              ]}
              value={settings.currency_code}
              onChange={(val) => setSettings({
                ...settings,
                currency_code: val,
                decimal_places: ['BHD', 'KWD', 'OMR'].includes(val) ? '3' : '2'
              })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Default Standard VAT Rate (%) *</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                required
                value={settings.vat_percent}
                onChange={(e) => setSettings({ ...settings, vat_percent: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue"
              />
              <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">VAT Calculation Method *</label>
            <SearchableSelect
              options={[
                {
                  value: 'ITEM_WISE',
                  label: 'Line Item Tax (Pre-fill VAT % per item, editable per line)',
                  sublabel: 'Default VAT % pre-filled for each line item; user can override per item'
                },
                {
                  value: 'TOTAL_BILL',
                  label: 'Total Bill Tax (Calculate VAT on Net Subtotal After Discount)',
                  sublabel: 'Calculates VAT on total bill sum after applying any bill discount'
                },
                {
                  value: 'NO_VAT',
                  label: 'No VAT / Tax Exempt (0% VAT everywhere)',
                  sublabel: 'Completely disables VAT calculation. 0% VAT rate applied on all bills and invoices'
                }
              ]}
              value={settings.vat_calculation_mode}
              onChange={(val) => setSettings({ ...settings, vat_calculation_mode: val })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Cost / Unit Price Tax Policy *</label>
            <SearchableSelect
              options={[
                {
                  value: 'EXCLUSIVE',
                  label: 'Tax Exclusive (Tax Added On Top of Unit Price)',
                  sublabel: 'Unit price excludes VAT. VAT is calculated and added on top (Net Subtotal + VAT = Total)'
                },
                {
                  value: 'INCLUSIVE',
                  label: 'Tax Inclusive (Tax Included in Unit Price)',
                  sublabel: 'Unit price includes VAT. Net subtotal and VAT portion are extracted backwards from entered price'
                }
              ]}
              value={settings.price_tax_type || 'EXCLUSIVE'}
              onChange={(val) => setSettings({ ...settings, price_tax_type: val })}
            />
          </div>

          <div className="md:col-span-3">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold block">VAT & Pricing Calculation Policy Notice:</strong>
                {settings.vat_calculation_mode === 'NO_VAT' ? (
                  <p className="mt-0.5">Currently set to <strong>No VAT / Tax Exempt (NO_VAT)</strong>. VAT calculation is <strong>disabled (0.00%)</strong> across all sales and invoices. Tax Inclusive / Exclusive pricing policy has <em>no effect</em> as VAT rate is 0%.</p>
                ) : settings.vat_calculation_mode === 'ITEM_WISE' ? (
                  <p className="mt-0.5">Currently set to <strong>Line Item Tax (ITEM_WISE)</strong> with default rate <strong>{settings.vat_percent}%</strong>. Pricing is set to <strong>{settings.price_tax_type === 'INCLUSIVE' ? 'Tax Inclusive (Tax included in unit price)' : 'Tax Exclusive (Tax added on top of unit price)'}</strong>.</p>
                ) : (
                  <p className="mt-0.5">Currently set to <strong>Total Bill Tax (TOTAL_BILL)</strong> with rate <strong>{settings.vat_percent}%</strong>. VAT will be calculated on the total bill net subtotal. Pricing policy: <strong>{settings.price_tax_type === 'INCLUSIVE' ? 'Tax Inclusive (Tax included in unit price)' : 'Tax Exclusive (Tax added on top of unit price)'}</strong>.</p>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company Physical Address</label>
            <input
              type="text"
              value={settings.company_address}
              onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-brand-blue"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submittingSettings}
            className="px-6 py-2.5 rounded-xl bg-brand-blue text-white font-bold text-xs shadow-md glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Store Settings
          </button>
        </div>
      </form>

      {/* 2. Auto-Increment Prefix & Numbering Templates Form */}
      <form onSubmit={handleSequencesSubmit} className="bg-white dark:bg-slate-900 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Auto-Increment Prefix & Sequence Numbering Engine
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Define 4-digit auto-incremental prefixes for Masters (Vendors, Branches, Clinics, Customers) and year-padded Invoice & Quotation formats</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs bg-white dark:bg-slate-900">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Master / Invoice Module</th>
                <th className="p-3.5 w-36">Prefix Code</th>
                <th className="p-3.5 w-28">Padding (Digits)</th>
                <th className="p-3.5 w-64">Format Template</th>
                <th className="p-3.5 w-24">Current Seq</th>
                <th className="p-3.5 text-right font-bold">Next Generated Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {sequences.map((seq, idx) => (
                <tr key={seq.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all bg-white dark:bg-slate-900">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    {seq.sequence_key.replace(/_/g, ' ')}
                  </td>

                  <td className="p-2.5">
                    <input
                      type="text"
                      required
                      value={seq.prefix}
                      onChange={(e) => handleSeqChange(idx, 'prefix', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:border-brand-blue"
                    />
                  </td>

                  <td className="p-2.5">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={seq.padding_length}
                      onChange={(e) => handleSeqChange(idx, 'padding_length', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:border-brand-blue text-center"
                    />
                  </td>

                  <td className="p-2.5">
                    <input
                      type="text"
                      required
                      value={seq.format_template}
                      onChange={(e) => handleSeqChange(idx, 'format_template', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-brand-blue"
                    />
                  </td>

                  <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400 font-semibold">
                    #{seq.current_val}
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold text-brand-blue">
                    {renderPreview(seq)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submittingSequences}
            className="px-6 py-2.5 rounded-xl bg-purple-600 dark:bg-purple-700 text-white font-bold text-xs shadow-md glow-purple hover:brightness-110 active:scale-[0.99] transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Numbering Templates
          </button>
        </div>
      </form>
    </div>
  );
}
