import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, User, LogIn, AlertCircle, Sun, Moon } from 'lucide-react';

export default function Login() {
  const { login, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    }
  };

  const fillQuickLogin = (usr) => {
    setUsername(usr);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Theme Toggle in top right */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-amber-400 shadow-sm transition-all flex items-center gap-2 text-xs font-semibold"
      >
        {theme === 'light' ? (
          <>
            <Moon className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-700">Dark Mode</span>
          </>
        ) : (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300">Light Mode</span>
          </>
        )}
      </button>

      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-blue/10 dark:bg-brand-blue/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-orange/10 dark:bg-brand-orange/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-white dark:bg-slate-900/90 glass-panel p-8 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-2xl relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="inline-block p-4 sm:p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner mb-4">
            <img src="/logo.png" alt="Organization Logo" className="h-24 sm:h-28 md:h-32 w-auto object-contain mx-auto max-w-full drop-shadow-sm" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading tracking-tight">
            Inventory Management System
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Multi-Branch • Multi-Clinic • FIFO Control</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-blue transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-blue transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1C8DCD] to-[#146ca1] text-white font-bold text-xs shadow-lg glow-blue hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In to System
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Credentials Selector */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5 text-center">Quick Role Login (Demo Credentials):</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => fillQuickLogin('admin')}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 text-left transition-all"
            >
              <div className="font-bold text-purple-600 dark:text-purple-300">Admin</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">admin / password123</div>
            </button>
            <button
              onClick={() => fillQuickLogin('store_mgr')}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-left transition-all"
            >
              <div className="font-bold text-blue-600 dark:text-blue-300">Store Manager</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">store_mgr / password123</div>
            </button>
            <button
              onClick={() => fillQuickLogin('clinic_user1')}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-left transition-all"
            >
              <div className="font-bold text-emerald-600 dark:text-emerald-300">OPD / Clinic User</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">clinic_user1 / password123</div>
            </button>
            <button
              onClick={() => fillQuickLogin('auditor')}
              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 text-left transition-all"
            >
              <div className="font-bold text-amber-600 dark:text-amber-300">Auditor</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">auditor / password123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
