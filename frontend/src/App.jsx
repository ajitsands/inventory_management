import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MainStorePurchase from './pages/MainStorePurchase';
import SubBranchInvoicing from './pages/SubBranchInvoicing';
import ClinicStockTransfer from './pages/ClinicStockTransfer';
import ClinicSalesPOS from './pages/ClinicSalesPOS';
import BatchInventory from './pages/BatchInventory';
import AuditTrailPage from './pages/AuditTrailPage';
import ReportsPage from './pages/ReportsPage';
import UserManagement from './pages/UserManagement';

function MainApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <Header />
      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'purchase' && <MainStorePurchase />}
          {activeTab === 'branch-transfer' && <SubBranchInvoicing />}
          {activeTab === 'clinic-transfer' && <ClinicStockTransfer />}
          {activeTab === 'opd-sales' && <ClinicSalesPOS />}
          {activeTab === 'batches' && <BatchInventory />}
          {activeTab === 'audit-trail' && <AuditTrailPage />}
          {activeTab === 'reports' && <ReportsPage />}
          {activeTab === 'user-mgmt' && <UserManagement />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
