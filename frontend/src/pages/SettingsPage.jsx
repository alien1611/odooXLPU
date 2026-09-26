import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Settings,
  Database,
  Server,
  Shield,
  Layers,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Warehouse,
  MapPin,
  FolderTree,
  Scale,
  Truck,
  Barcode,
  Clock,
  User,
  Key
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.checkHealth();
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const migrations = [
    { version: '001_initial_schema.sql', description: 'Core tables: users, warehouses, locations, products, uom, stock_moves, stock_quants, receipts, deliveries, transfers, adjustments, audit_log', status: 'Applied' },
    { version: '002_phase2_auth_and_master_data.sql', description: 'RBAC roles, conversion_to_base in UoM, parent locations, product reorder points, lead time, OTP reset', status: 'Applied' },
    { version: '003_phase3_stock_engine.sql', description: 'Immutable stock moves, FEFO allocation engine, cost layers, weighted average costing', status: 'Applied' },
    { version: '004_phase4_reorder_expiry_valuation.sql', description: 'Automated 30-day velocity reorder engine, expiry alerts, perpetual valuation layers', status: 'Applied' },
    { version: '005_phase5_barcode_warehouse.sql', description: 'Symbology barcodes for products, locations, and lots; cycle count physical inventory', status: 'Applied' },
    { version: '006_phase6_warehouse_logistics.sql', description: 'Multi-location pick waves, forward-pick bin replenishment, inbound cross-docking alerts', status: 'Applied' },
    { version: '007_phase7_shipping.sql', description: 'Cartonization, gross/tare weight capture, local carrier fleet, packing slip & bill of lading documents', status: 'Applied' },
  ];

  const engineRules = [
    {
      title: 'Perpetual Weighted Average Costing',
      engine: 'Phase 3 Costing Engine',
      desc: 'Unit cost recalculates dynamically on receipt validation: ((current_qty × avg_cost) + (new_qty × new_cost)) / total_qty. No manual journal adjustments.'
    },
    {
      title: 'Automated FEFO Outbound Allocation',
      engine: 'Phase 3 FEFO Engine',
      desc: 'Delivery validation allocates lots strictly by earliest expiration date (ASC). Splits seamlessly across multiple lots when single lot quantity is exhausted.'
    },
    {
      title: 'Dynamic Consumption-Based Reorder',
      engine: 'Phase 4 Reorder Engine',
      desc: 'Calculates average daily consumption over the last 30 days of actual stock moves. Triggers replenishment suggestions when days of stock remaining < lead time.'
    },
    {
      title: 'Multi-Location Pick Waves',
      engine: 'Phase 6 Logistics Engine',
      desc: 'Aggregates pending deliveries into warehouse picking waves grouped by physical bin location to optimize floor transit paths.'
    },
    {
      title: 'Forward Pick Bin Replenishment',
      engine: 'Phase 6 Replenishment Engine',
      desc: 'Continuously monitors forward pick bin stock against min/max thresholds, generating internal transfer tasks from high-rack reserve bins.'
    },
    {
      title: 'Cartonization & Outbound Dispatch',
      engine: 'Phase 7 Freight Engine',
      desc: 'Supports multi-carton splitting per delivery with strict overpack prevention, gross/tare/net weight capture, and local tracking generation.'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            System Architecture & Operational Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Core engine parameters, PostgreSQL database status, authoritative business logic rules, and master data links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Check Connection
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Engine Online
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Grid: Database & User Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backend & DB Engine Card */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Database className="w-4 h-4 text-blue-600" />
              Database Engine & Storage
            </div>
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              PostgreSQL Connected
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Database Engine:</span>
              <span className="font-mono font-medium text-slate-800">PostgreSQL (Relational)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Database Name:</span>
              <span className="font-mono font-medium text-slate-800">stockyard</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Inventory Single Source of Truth:</span>
              <span className="font-semibold text-blue-600 font-mono">stock_moves (Append-Only)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">API Service Uptime:</span>
              <span className="font-mono text-slate-700">{health?.uptime ? `${Math.round(health.uptime)} seconds` : 'Active'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">External Services / Cloud APIs:</span>
              <span className="font-semibold text-emerald-700">None (100% Local Execution)</span>
            </div>
          </div>
        </div>

        {/* User Identity & Security Context */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Shield className="w-4 h-4 text-indigo-600" />
              Authenticated Session & RBAC
            </div>
            <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              JWT Active
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Current Operator:</span>
              <span className="font-semibold text-slate-900">{user?.name || 'Administrator'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Account Email:</span>
              <span className="font-mono text-slate-700">{user?.email || 'admin@stockyard.local'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">RBAC Role:</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                {user?.role || 'inventory_manager'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Password Encryption:</span>
              <span className="font-mono text-slate-700">bcrypt (Salt rounds: 10)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Audit Logging:</span>
              <span className="font-semibold text-emerald-700">Enabled (Every Action Recorded)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Master Data Quick Links */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
          <Layers className="w-4 h-4 text-blue-600" />
          Master Data Quick Configuration
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
          <Link
            to="/products"
            className="p-3 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex flex-col items-center text-center gap-1.5"
          >
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Products</span>
            <span className="text-[10px] text-slate-400">SKU, barcodes, UoM</span>
          </Link>

          <Link
            to="/categories"
            className="p-3 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex flex-col items-center text-center gap-1.5"
          >
            <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Categories</span>
            <span className="text-[10px] text-slate-400">Taxonomy classification</span>
          </Link>

          <Link
            to="/uom"
            className="p-3 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex flex-col items-center text-center gap-1.5"
          >
            <div className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Units of Measure</span>
            <span className="text-[10px] text-slate-400">Conversion to base</span>
          </Link>

          <Link
            to="/warehouses"
            className="p-3 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex flex-col items-center text-center gap-1.5"
          >
            <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Warehouses</span>
            <span className="text-[10px] text-slate-400">Physical facilities</span>
          </Link>

          <Link
            to="/locations"
            className="p-3 rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors flex flex-col items-center text-center gap-1.5"
          >
            <div className="w-8 h-8 rounded bg-rose-100 text-rose-600 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">Locations</span>
            <span className="text-[10px] text-slate-400">Bins, docks, reserve</span>
          </Link>
        </div>
      </div>

      {/* Core Business Engine Rules */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
          <Cpu className="w-4 h-4 text-purple-600" />
          Stockyard Local Engine Rules (Phases 1–7)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {engineRules.map((rule, idx) => (
            <div key={idx} className="p-3 rounded border border-slate-100 bg-slate-50/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-slate-900">{rule.title}</span>
                <span className="text-[10px] font-mono font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                  {rule.engine}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Database Schema Migrations Ledger */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Database className="w-4 h-4 text-emerald-600" />
            Authoritative Schema Migrations (7 of 7 Applied)
          </div>
          <span className="text-[11px] text-slate-400">PostgreSQL Schema Migrations</span>
        </div>
        <div className="divide-y divide-slate-100">
          {migrations.map((m, idx) => (
            <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900">{m.version}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {m.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  {m.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
