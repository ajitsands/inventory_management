export const BRAND_COLORS = {
  primary: '#1C8DCD',        // Ocean Blue
  primaryDark: '#146ca1',
  primaryLight: '#3ab2f6',
  accent: '#F68D20',         // Vibrant Amber
  accentDark: '#d47311',
  accentLight: '#ffa84d',
  slateDark: '#0F172A',
  slateLight: '#F8FAFC',
};

export const ROLE_BADGES = {
  ADMIN: { label: 'Admin (Full System)', bg: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300' },
  STORE_MANAGER: { label: 'Store Manager', bg: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300' },
  OPD_USER: { label: 'Clinic OPD Dispenser', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' },
  AUDITOR: { label: 'Auditor (Read-Only)', bg: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300' },
};

export const MOVEMENT_BADGES = {
  PURCHASE: { label: 'Vendor Invoice Entry', color: 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/60' },
  BRANCH_TRANSFER: { label: 'Sub-Branch Invoiced Transfer', color: 'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-950/60' },
  CLINIC_TRANSFER: { label: 'Clinic Stock Transfer', color: 'text-cyan-700 bg-cyan-100 border-cyan-300 dark:text-cyan-300 dark:bg-cyan-950/60' },
  CUSTOMER_SALE: { label: 'OPD Patient Sale (FIFO)', color: 'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-950/60' },
  STOCK_RETURN: { label: 'Stock Return', color: 'text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-300 dark:bg-rose-950/60 font-bold' },
  ADJUSTMENT: { label: 'Stock Adjustment', color: 'text-purple-700 bg-purple-100 border-purple-300 dark:text-purple-300 dark:bg-purple-950/60' },
};

export const MODULE_BADGES = {
  PURCHASE: { label: 'Vendor Purchase', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' },
  BRANCH_TRANSFER: { label: 'Branch Transfer', bg: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300' },
  CLINIC_TRANSFER: { label: 'Clinic Transfer', bg: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300' },
  STOCK_RETURN: { label: 'Stock Return', bg: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300' },
  OPD_DISPENSING: { label: 'OPD Dispensing POS', bg: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300' },
  STORE_SETTINGS: { label: 'Store Settings', bg: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300' },
  MASTER_VENDOR: { label: 'Master Vendor', bg: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300' },
  MASTER_CUSTOMER: { label: 'Master Customer', bg: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300' },
  MASTER_LOCATION: { label: 'Master Location', bg: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300' },
};
