import React from 'react';
import { 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  Lock, 
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Stockyard Operations Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Core Warehouse Engine &bull; Immutable Stock Ledger Architecture
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            System Architecture Initialized
          </span>
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Differentiator 1 */}
        <div className="p-4 bg-white rounded border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 1</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Batch / Lot Tracking + FEFO</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Every tracked product movement is tagged with a lot and expiry date. Dispatch algorithms enforce First-Expiry-First-Out to minimize scrap and spoilage.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">TABLE: lots</span>
            <Link to="/lots" className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
              View Lots <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Differentiator 2 */}
        <div className="p-4 bg-white rounded border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 mb-2">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 2</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Weighted-Average Costing</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Inventory valuation is calculated using perpetual cost layers updated upon inbound receipt validation, providing accurate inventory balance valuation.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">TABLE: cost_layers</span>
            <Link to="/inventory" className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              Valuation Layer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Differentiator 3 */}
        <div className="p-4 bg-white rounded border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 3</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Consumption-Based Reorders</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Automated reorder triggers calculate historical consumption rates against min/max thresholds to suggest replenishment purchase orders.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">TABLE: reorder_suggestions</span>
            <Link to="/reorders" className="text-xs font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1">
              Reorder Engine <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Architectural Invariant Box */}
      <div className="p-4 bg-slate-900 text-slate-100 rounded border border-slate-800 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white tracking-wide">
              Architectural Invariant: Immutable Single Source of Truth
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              <code className="text-blue-300 font-mono">stock_moves</code> is the sole authority for inventory modifications. 
              Quantities are never directly mutated in tables without a formal stock movement transaction. 
              <code className="text-slate-300 font-mono"> stock_quants</code> represents a materialized cache of on-hand inventory across locations and lots.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono text-slate-400">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Source: stock_moves</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">State: stock_quants</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Valuation: cost_layers</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">Traceability: audit_log</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Schema Status */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Core Data Model & Database Migration Status
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Migration: 001_initial_schema.sql</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
          {[
            { label: 'Users & Auth', table: 'users' },
            { label: 'Master Data', table: 'products' },
            { label: 'Batch Lots', table: 'lots' },
            { label: 'Stock Moves', table: 'stock_moves' },
            { label: 'Stock Quants', table: 'stock_quants' },
            { label: 'Cost Layers', table: 'cost_layers' },
          ].map((item, idx) => (
            <div key={idx} className="p-2.5 rounded border border-slate-100 bg-slate-50/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mx-auto mb-1" />
              <div className="font-medium text-slate-800">{item.label}</div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.table}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
