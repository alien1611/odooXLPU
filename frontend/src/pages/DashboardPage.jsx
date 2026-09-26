import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  Lock, 
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  AlertCircle,
  Package,
  RefreshCw,
  Clock,
  Boxes,
  ArrowUpRight,
  Zap,
  Truck,
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [valuation, setValuation] = useState(null);
  const [reorders, setReorders] = useState([]);
  const [expiry, setExpiry] = useState(null);
  const [recentMoves, setRecentMoves] = useState([]);
  const [waves, setWaves] = useState([]);
  const [replenishments, setReplenishments] = useState([]);
  const [crossDockAlerts, setCrossDockAlerts] = useState([]);
  const [shippingStats, setShippingStats] = useState({
    deliveries_ready_to_pack: 0,
    packages_being_packed: 0,
    packed_deliveries: 0,
    ready_to_dispatch: 0,
    dispatched_today: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [valData, reorderData, expiryData, movesData, wavesData, replenData, xdockData, shipData] = await Promise.all([
        api.getValuationSummary(),
        api.getReorderSuggestions({ status: 'pending' }),
        api.getExpirySummary(),
        api.getMoves({ limit: 6 }),
        api.getWaves().catch(() => []),
        api.getReplenishments().catch(() => []),
        api.getCrossDockAlerts().catch(() => []),
        api.getShippingStats().catch(() => ({}))
      ]);
      setValuation(valData);
      setReorders(reorderData);
      setExpiry(expiryData);
      setRecentMoves(movesData);
      setWaves(wavesData);
      setReplenishments(replenData);
      setCrossDockAlerts(xdockData);
      setShippingStats(shipData || {});
    } catch (err) {
      setError(err.message || 'Failed to load live operational KPIs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const totalValuation = valuation?.total_inventory_value ?? 0;
  const pendingReordersCount = reorders.length;
  const urgentReordersCount = reorders.filter(r => 
    r.days_remaining !== null && r.days_remaining < (r.lead_time_days || 0)
  ).length;
  const expire7dCount = expiry?.within_7_days_count ?? 0;
  const expiredCount = expiry?.expired_count ?? 0;

  // Phase 6 Operational KPIs
  const activeWavesCount = waves.filter(w => ['released', 'picking'].includes(w.status)).length;
  const pendingReplenishmentsCount = replenishments.filter(r => ['ready', 'suggested', 'partially_fulfillable'].includes(r.status)).length;
  const activeCrossDockCount = crossDockAlerts.filter(a => a.status === 'active').length;
  const binsBelowThresholdCount = replenishments.filter(r => ['ready', 'partially_fulfillable'].includes(r.status)).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Stockyard Operations Center</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-Time Operational KPIs &bull; Immutable Single Source of Truth Stock Engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh KPIs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational Intelligence Active
          </span>
        </div>
      </div>

      {/* Error Alert */}
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

      {/* Operational KPI Grid — 100% Backend-Driven */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Inventory Valuation */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Inventory Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {loading && !valuation ? (
              <span className="text-slate-300">Loading...</span>
            ) : (
              `$${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{valuation?.total_quantity?.toLocaleString() || 0} units on-hand</span>
            <Link to="/inventory" className="text-emerald-600 hover:text-emerald-800 font-medium">
              View &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 2: Reorder Alerts */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Reorder Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${urgentReordersCount > 0 ? 'text-rose-600' : 'text-amber-500'}`} />
          </div>
          <div className={`mt-2 text-2xl font-bold font-mono ${urgentReordersCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {loading && reorders.length === 0 ? (
              <span className="text-slate-300">Loading...</span>
            ) : (
              `${pendingReordersCount} products`
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className={urgentReordersCount > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}>
              {urgentReordersCount > 0 ? `${urgentReordersCount} urgent (< lead time)` : 'Need replenishment'}
            </span>
            <Link to="/reorders" className="text-blue-600 hover:text-blue-800 font-medium">
              Review &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 3: FEFO Expiry Risk */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">FEFO Expiry Risk</span>
            <ShieldCheck className={`w-4 h-4 ${expire7dCount > 0 || expiredCount > 0 ? 'text-orange-500' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {loading && !expiry ? (
              <span className="text-slate-300">Loading...</span>
            ) : (
              `${expire7dCount + expiredCount} lots`
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              {expiredCount > 0 ? `${expiredCount} expired, ` : ''}{expire7dCount} within 7 days
            </span>
            <Link to="/lots" className="text-amber-600 hover:text-amber-800 font-medium">
              Dispatch &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 4: Active Cost Layers */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Perpetual Cost Layers</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {loading && !valuation ? (
              <span className="text-slate-300">Loading...</span>
            ) : (
              `${valuation?.active_layers_count || 0} active`
            )}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">{valuation?.total_products_count || 0} valued products</span>
            <Link to="/inventory" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Inspect &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Warehouse Logistics & Wave Operations (Phase 6) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Warehouse Logistics & Wave Operations
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Phase 6 Operational Control Room</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Logistics KPI 1: Active Pick Waves */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Active Pick Waves</span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
              {loading ? <span className="text-slate-300">...</span> : activeWavesCount}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{waves.length} total waves</span>
              <Link to="/waves" className="text-blue-600 hover:text-blue-800 font-medium">
                Dispatch &rarr;
              </Link>
            </div>
          </div>

          {/* Logistics KPI 2: Replenishment Tasks */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Replenishment Tasks</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className={`mt-2 text-2xl font-bold font-mono ${pendingReplenishmentsCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {loading ? <span className="text-slate-300">...</span> : pendingReplenishmentsCount}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Forward bin tasks</span>
              <Link to="/replenishment" className="text-emerald-600 hover:text-emerald-800 font-medium">
                Replenish &rarr;
              </Link>
            </div>
          </div>

          {/* Logistics KPI 3: Cross-Dock Alerts */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-rose-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Cross-Dock Alerts</span>
              <Zap className={`w-4 h-4 ${activeCrossDockCount > 0 ? 'text-rose-600' : 'text-indigo-500'}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold font-mono ${activeCrossDockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {loading ? <span className="text-slate-300">...</span> : activeCrossDockCount}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className={activeCrossDockCount > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}>
                {activeCrossDockCount > 0 ? 'Urgent stage demand' : 'No active alerts'}
              </span>
              <Link to="/cross-dock" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Stage &rarr;
              </Link>
            </div>
          </div>

          {/* Logistics KPI 4: Forward Bins Below Threshold */}
          <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Forward Bins Below Min</span>
              <AlertTriangle className={`w-4 h-4 ${binsBelowThresholdCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold font-mono ${binsBelowThresholdCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {loading ? <span className="text-slate-300">...</span> : binsBelowThresholdCount}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Needs pick face refill</span>
              <Link to="/replenishment" className="text-amber-600 hover:text-amber-800 font-medium">
                Configure &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Shipping, Cartonization & Carrier Dispatch (Phase 7) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Shipping & Freight Carrier Operations
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Phase 7 Packing & Dispatch</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Shipping KPI 1: Deliveries Ready to Pack */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Ready to Pack</span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-1.5 text-xl font-bold text-slate-900 font-mono">
              {loading ? <span className="text-slate-300">...</span> : (shippingStats.deliveries_ready_to_pack || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Picked deliveries</span>
              <Link to="/shipping" className="text-blue-600 hover:text-blue-800 font-medium">
                Pack &rarr;
              </Link>
            </div>
          </div>

          {/* Shipping KPI 2: Packages Being Packed */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Being Packed</span>
              <Boxes className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-1.5 text-xl font-bold font-mono text-slate-900">
              {loading ? <span className="text-slate-300">...</span> : (shippingStats.packages_being_packed || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Open cartons</span>
              <Link to="/shipping" className="text-amber-600 hover:text-amber-800 font-medium">
                Station &rarr;
              </Link>
            </div>
          </div>

          {/* Shipping KPI 3: Packed Deliveries */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Packed Deliveries</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-1.5 text-xl font-bold font-mono text-emerald-700">
              {loading ? <span className="text-slate-300">...</span> : (shippingStats.packed_deliveries || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Cartons sealed</span>
              <Link to="/shipping" className="text-emerald-600 hover:text-emerald-800 font-medium">
                Review &rarr;
              </Link>
            </div>
          </div>

          {/* Shipping KPI 4: Ready to Dispatch */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Ready to Dispatch</span>
              <Send className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-1.5 text-xl font-bold font-mono text-indigo-700">
              {loading ? <span className="text-slate-300">...</span> : (shippingStats.ready_to_dispatch || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Carrier assigned</span>
              <Link to="/shipping" className="text-indigo-600 hover:text-indigo-800 font-medium">
                Ship &rarr;
              </Link>
            </div>
          </div>

          {/* Shipping KPI 5: Dispatched Today */}
          <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Dispatched Today</span>
              <Truck className="w-4 h-4 text-slate-700" />
            </div>
            <div className="mt-1.5 text-xl font-bold font-mono text-slate-900">
              {loading ? <span className="text-slate-300">...</span> : (shippingStats.dispatched_today || 0)}
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Outbound freight</span>
              <Link to="/shipping" className="text-slate-600 hover:text-slate-800 font-medium">
                Manifest &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Action Items & Recent Ledger Moves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Reorder Action Queue */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Replenishment Action Queue
              </h3>
            </div>
            <Link to="/reorders" className="text-[11px] font-medium text-blue-600 hover:text-blue-800">
              View All ({reorders.length}) &rarr;
            </Link>
          </div>

          {reorders.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
              All inventory levels are within safe replenishment parameters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {reorders.slice(0, 4).map(r => (
                <div key={r.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{r.product_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Stock: {r.current_stock} &bull; Outflow: {parseFloat(r.avg_daily_consumption).toFixed(1)}/d &bull; Lead: {r.lead_time_days}d
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-blue-700 font-mono block">+{parseFloat(r.suggested_qty).toFixed(0)} units</span>
                    <span className="text-[10px] text-amber-700 font-medium">
                      {r.days_remaining !== null ? `${r.days_remaining}d left` : 'Below threshold'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Immutable Stock Movements */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Live Immutable Stock Ledger
              </h3>
            </div>
            <Link to="/stock-moves" className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">
              Full Ledger &rarr;
            </Link>
          </div>

          {recentMoves.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentMoves.slice(0, 4).map(m => (
                <div key={m.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span className="font-mono text-slate-500 text-[10px]">{m.reference}</span>
                      <span>&bull;</span>
                      <span>{m.product_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Type: <span className="font-medium text-slate-600 capitalize">{m.move_type.replace('_', ' ')}</span> &bull; {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-right">
                    {parseFloat(m.quantity).toLocaleString()} {m.uom_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Differentiator 1 */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
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
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
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
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
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
    </div>
  );
}
