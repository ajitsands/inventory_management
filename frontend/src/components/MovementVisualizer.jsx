import React from 'react';
import { Truck, Warehouse, GitBranch, Stethoscope, UserCheck, ArrowRight, ShieldCheck, Tag } from 'lucide-react';

export default function MovementVisualizer() {
  const steps = [
    {
      title: "1. Vendor / Supplier",
      subtitle: "External Source",
      desc: "Suppliers issue goods via Purchase Invoices & Purchase Orders (PO).",
      icon: Truck,
      color: "border-purple-200 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
      badge: "PO & Vendor Invoice"
    },
    {
      title: "2. Main Branch",
      subtitle: "Central Receiving Hub",
      desc: "Admin logs purchase invoice with Purchase Price, Sales Price, Exp Date & assigns unique Batch Code.",
      icon: Warehouse,
      color: "border-brand-blue/30 dark:border-brand-blue/50 bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-blue",
      badge: "Batch Code Created"
    },
    {
      title: "3. Sub Branch",
      subtitle: "Regional Hubs",
      desc: "Main Branch issues stock to Sub Branch with internal billing & invoiced transfer.",
      icon: GitBranch,
      color: "border-cyan-200 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400",
      badge: "Invoiced Stock Transfer"
    },
    {
      title: "4. Clinic Outlet",
      subtitle: "Local Dispensing",
      desc: "Sub Branch transfers stock to Clinics. Stock Transfer ONLY (No Invoicing).",
      icon: Stethoscope,
      color: "border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
      badge: "Pure Stock Transfer"
    },
    {
      title: "5. Customer / Patient",
      subtitle: "End Consumption",
      desc: "OPD User dispenses items to patient with automated FIFO batch deduction.",
      icon: UserCheck,
      color: "border-brand-orange/30 dark:border-brand-orange/50 bg-brand-orange/5 dark:bg-brand-orange/10 text-brand-orange",
      badge: "FIFO Auto Sale"
    }
  ];

  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl mb-6 bg-white dark:bg-slate-900/90 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-blue" />
            Item Movement & Batch Trajectory Architecture
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Strict FIFO stock movement pipeline with audit logging</p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          Batch Price Control Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className="relative group">
              <div className={`p-4 rounded-2xl border ${step.color} glass-panel-hover h-full flex flex-col justify-between shadow-xs`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      Step {idx + 1}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading">{step.title}</h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">{step.subtitle}</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {step.badge}
                  </span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 rounded-full p-1 shadow-md">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
