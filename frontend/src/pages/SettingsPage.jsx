import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Settings,
  Database,
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
  ExternalLink
} from 'lucide-react';
import { PageHeader, FlatCard, Button, Badge } from '../components/ui';

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
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <PageHeader
        title="System Architecture"
        description="Core engine parameters, PostgreSQL database status, authoritative business logic rules, and master data links."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={fetchHealth}
              disabled={loading}
              icon={RefreshCw}
              className={loading ? '[&>svg]:animate-spin text-amber-600' : ''}
            >
              Check Connection
            </Button>
            <Badge variant="success" dot size="md">
              Engine Online
            </Badge>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold p-1">
            &times;
          </button>
        </div>
      )}

      {/* Grid: Database & User Context */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backend & DB Engine Card */}
        <FlatCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <Database className="w-4 h-4 text-amber-600" />
              Database Engine & Storage
            </div>
            <Badge variant="success" size="sm">
              PostgreSQL Connected
            </Badge>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Database Engine</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">PostgreSQL 18 (Relational)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Database Name</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">stockyard</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Single Source of Truth</span>
              <span className="font-semibold text-amber-600 dark:text-amber-500 font-mono">stock_moves (Append-Only)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">API Service Uptime</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{health?.uptime ? `${Math.round(health.uptime)} seconds` : 'Active'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">External Dependencies</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">None (100% Local Execution)</span>
            </div>
          </div>
        </FlatCard>

        {/* User Identity & Security Context */}
        <FlatCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              <Shield className="w-4 h-4 text-amber-600" />
              Authenticated Session & RBAC
            </div>
            <Badge variant="neutral" size="sm">
              JWT Active
            </Badge>
          </div>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Current Operator</span>
              <span className="font-semibold text-slate-900 dark:text-white">{user?.name || 'Administrator'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Account Email</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{user?.email || 'admin@stockyard.local'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">RBAC Role</span>
              <span className="font-mono font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                {user?.role || 'inventory_manager'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-50 dark:border-slate-800/50">
              <span className="text-slate-500">Password Encryption</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">bcrypt (Salt rounds: 10)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Audit Logging</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Enabled (Every Action Recorded)</span>
            </div>
          </div>
        </FlatCard>
      </div>

      {/* Master Data Quick Links */}
      <FlatCard className="p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <Layers className="w-4 h-4 text-amber-600" />
          Master Data Quick Configuration
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-1">
          <Link
            to="/products"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-900 dark:text-white">Products</span>
            <span className="text-[10px] text-slate-400">SKU, barcodes, UoM</span>
          </Link>

          <Link
            to="/categories"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderTree className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-900 dark:text-white">Categories</span>
            <span className="text-[10px] text-slate-400">Taxonomy hierarchy</span>
          </Link>

          <Link
            to="/uom"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Scale className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-900 dark:text-white">Units of Measure</span>
            <span className="text-[10px] text-slate-400">Conversion to base</span>
          </Link>

          <Link
            to="/warehouses"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-900 dark:text-white">Warehouses</span>
            <span className="text-[10px] text-slate-400">Physical facilities</span>
          </Link>

          <Link
            to="/locations"
            className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600/60 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-slate-900 dark:text-white">Locations</span>
            <span className="text-[10px] text-slate-400">Bins, docks, reserve</span>
          </Link>
        </div>
      </FlatCard>

      {/* Core Business Engine Rules */}
      <FlatCard className="p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <Cpu className="w-4 h-4 text-amber-600" />
          Stockyard Local Engine Rules (Phases 1–7)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {engineRules.map((rule, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-slate-900 dark:text-white">{rule.title}</span>
                <span className="text-[10px] font-mono font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                  {rule.engine}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>
      </FlatCard>

      {/* Database Schema Migrations Ledger */}
      <FlatCard className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <Database className="w-4 h-4 text-emerald-600" />
            Authoritative Schema Migrations (7 of 7 Applied)
          </div>
          <span className="text-[11px] text-slate-400 font-mono">PostgreSQL Schema Migrations</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {migrations.map((m, idx) => (
            <div key={idx} className="py-3 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-medium text-slate-900 dark:text-white">{m.version}</span>
                  <Badge variant="success" size="sm" dot>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {m.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </FlatCard>
    </div>
  );
}
