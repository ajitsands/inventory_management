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
  ADMIN: { label: 'Admin (Full System)', bg: 'bg-purple-900/60 text-purple-200 border-purple-500/40' },
  STORE_MANAGER: { label: 'Store Manager', bg: 'bg-blue-900/60 text-blue-200 border-blue-500/40' },
  OPD_USER: { label: 'Clinic OPD Dispenser', bg: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/40' },
  AUDITOR: { label: 'Auditor (Read-Only)', bg: 'bg-amber-900/60 text-amber-200 border-amber-500/40' },
};

export const MOVEMENT_BADGES = {
  PURCHASE: { label: 'Vendor Invoice Entry', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' },
  BRANCH_TRANSFER: { label: 'Sub-Branch Invoiced Transfer', color: 'text-blue-400 bg-blue-950/60 border-blue-500/30' },
  CLINIC_TRANSFER: { label: 'Clinic Stock Transfer', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30' },
  CUSTOMER_SALE: { label: 'OPD Patient Sale (FIFO)', color: 'text-amber-400 bg-amber-950/60 border-amber-500/30' },
  ADJUSTMENT: { label: 'Stock Adjustment', color: 'text-purple-400 bg-purple-950/60 border-purple-500/30' },
};
