import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ShieldCheck, 
  Layers, 
  TrendingUp, 
  Lock, 
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  AlertCircle,
  Package,
  RefreshCw,
  Boxes,
  ArrowUpRight,
  Zap,
  Truck,
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader, GlassCard, FlatCard, Button, Badge } from '../components/ui';

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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Operations Center"
        subtitle="Real-time operational KPIs &bull; Immutable single source of truth stock engine"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={fetchDashboardData}
              disabled={loading}
              icon={RefreshCw}
              className={loading ? '[&>svg]:animate-spin text-amber-600' : ''}
            >
              Refresh
            </Button>
            <Badge variant="success" dot={true}>
              Operational Engine Active
            </Badge>
          </div>
        }
      />

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-2xl flex items-center justify-between text-sm shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 text-lg leading-none font-bold">
            &times;
          </button>
        </div>
      )}

      {/* Executive KPI Grid — Frosted Glass Treatment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Inventory Valuation */}
        <GlassCard className="p-5 flex flex-col justify-between" glow="amber">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Inventory Valuation</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {loading && !valuation ? (
                <span className="text-slate-400">...</span>
              ) : (
                `$${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{valuation?.total_quantity?.toLocaleString() || 0} units on-hand</span>
              <Link to="/inventory" className="text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center gap-1 group">
                View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </GlassCard>

        {/* KPI 2: Reorder Alerts */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Reorder Alerts</span>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${urgentReordersCount > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 text-slate-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-3xl font-bold tracking-tight font-mono ${urgentReordersCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {loading && reorders.length === 0 ? (
                <span className="text-slate-400">...</span>
              ) : (
                `${pendingReordersCount} SKUs`
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className={urgentReordersCount > 0 ? 'text-rose-600 font-semibold' : 'font-medium'}>
                {urgentReordersCount > 0 ? `${urgentReordersCount} urgent (< lead time)` : 'Stable replenishment'}
              </span>
              <Link to="/reorders" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1 group">
                Review <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </GlassCard>

        {/* KPI 3: FEFO Expiry Risk */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider">FEFO Expiry Risk</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {loading && !expiry ? (
                <span className="text-slate-400">...</span>
              ) : (
                `${expire7dCount + expiredCount} lots`
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                {expiredCount > 0 ? `${expiredCount} expired, ` : ''}{expire7dCount} within 7 days
              </span>
              <Link to="/lots" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1 group">
                Lots <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </GlassCard>

        {/* KPI 4: Active Cost Layers */}
        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Cost Layers</span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-slate-900 font-mono">
              {loading && !valuation ? (
                <span className="text-slate-400">...</span>
              ) : (
                `${valuation?.active_layers_count || 0} active`
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{valuation?.total_products_count || 0} valued products</span>
              <Link to="/inventory" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1 group">
                Inspect <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Warehouse Logistics & Wave Operations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Warehouse Logistics & Wave Operations
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Phase 6 Operational Control Room</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Logistics KPI 1 */}
          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Active Pick Waves</span>
              <Layers className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : activeWavesCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">{waves.length} total waves</span>
              <Link to="/waves" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1">
                Dispatch <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </FlatCard>

          {/* Logistics KPI 2 */}
          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Replenishment Tasks</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500" />
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight font-mono ${pendingReplenishmentsCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {loading ? '...' : pendingReplenishmentsCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Forward bin tasks</span>
              <Link to="/replenishment" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1">
                Replenish <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </FlatCard>

          {/* Logistics KPI 3 */}
          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Cross-Dock Alerts</span>
              <Zap className={`w-4 h-4 ${activeCrossDockCount > 0 ? 'text-rose-500' : 'text-slate-500'}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight font-mono ${activeCrossDockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {loading ? '...' : activeCrossDockCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className={activeCrossDockCount > 0 ? 'text-rose-600 font-semibold' : 'font-medium'}>
                {activeCrossDockCount > 0 ? 'Urgent stage demand' : 'No active alerts'}
              </span>
              <Link to="/cross-dock" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1">
                Stage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </FlatCard>

          {/* Logistics KPI 4 */}
          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Forward Bins Below Min</span>
              <AlertTriangle className={`w-4 h-4 ${binsBelowThresholdCount > 0 ? 'text-amber-600' : 'text-slate-500'}`} />
            </div>
            <div className={`mt-2 text-2xl font-bold tracking-tight font-mono ${binsBelowThresholdCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {loading ? '...' : binsBelowThresholdCount}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Needs pick face refill</span>
              <Link to="/replenishment" className="text-slate-800 hover:text-slate-950 font-semibold inline-flex items-center gap-1">
                Configure <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Shipping, Cartonization & Carrier Dispatch */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Shipping & Freight Carrier Operations
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Phase 7 Packing & Dispatch</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Ready to Pack</span>
              <Package className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : (shippingStats.deliveries_ready_to_pack || 0)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-medium">Picked</span>
              <Link to="/shipping" className="text-slate-900 hover:text-amber-700 font-semibold">Pack &rarr;</Link>
            </div>
          </FlatCard>

          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Being Packed</span>
              <Boxes className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : (shippingStats.packages_being_packed || 0)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-medium">Open cartons</span>
              <Link to="/shipping" className="text-slate-900 hover:text-amber-700 font-semibold">Station &rarr;</Link>
            </div>
          </FlatCard>

          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Packed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : (shippingStats.packed_deliveries || 0)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-medium">Sealed</span>
              <Link to="/shipping" className="text-slate-900 hover:text-amber-700 font-semibold">Review &rarr;</Link>
            </div>
          </FlatCard>

          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Ready to Dispatch</span>
              <Send className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : (shippingStats.ready_to_dispatch || 0)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-medium">Carrier assigned</span>
              <Link to="/shipping" className="text-slate-900 hover:text-amber-700 font-semibold">Ship &rarr;</Link>
            </div>
          </FlatCard>

          <FlatCard className="p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-semibold">Dispatched Today</span>
              <Truck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight text-slate-900 font-mono">
              {loading ? '...' : (shippingStats.dispatched_today || 0)}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-medium">Outbound</span>
              <Link to="/shipping" className="text-slate-900 hover:text-amber-700 font-semibold">Manifest &rarr;</Link>
            </div>
          </FlatCard>
        </div>
      </div>

      {/* Two Column Layout: Action Items & Recent Ledger Moves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Reorder Action Queue */}
        <FlatCard className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Replenishment Action Queue
              </h3>
            </div>
            <Link to="/reorders" className="text-xs font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 group">
              View All ({reorders.length}) <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {reorders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-600">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              All inventory levels are within safe replenishment parameters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {reorders.slice(0, 4).map(r => (
                <div key={r.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{r.product_name}</div>
                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                      Stock: {r.current_stock} &bull; Outflow: {parseFloat(r.avg_daily_consumption).toFixed(1)}/d &bull; Lead: {r.lead_time_days}d
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 font-mono block">+{parseFloat(r.suggested_qty).toFixed(0)} units</span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      {r.days_remaining !== null ? `${r.days_remaining}d left` : 'Below threshold'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FlatCard>

        {/* Right: Recent Immutable Stock Movements */}
        <FlatCard className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Live Immutable Stock Ledger
              </h3>
            </div>
            <Link to="/stock-moves" className="text-xs font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 group">
              Full Ledger <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {recentMoves.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-600">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {recentMoves.slice(0, 4).map(m => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span className="font-mono text-slate-500 text-[11px] font-normal">{m.reference}</span>
                      <span>&bull;</span>
                      <span>{m.product_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Type: <span className="font-medium text-slate-800 capitalize">{m.move_type.replace('_', ' ')}</span> &bull; {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-right">
                    {parseFloat(m.quantity).toLocaleString()} {m.uom_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FlatCard>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Differentiator 1 */}
        <FlatCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-700 mb-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 1</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Batch / Lot Tracking + FEFO</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
              Every tracked product movement is tagged with a lot and expiry date. Dispatch algorithms enforce First-Expiry-First-Out to minimize scrap and spoilage.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">TABLE: lots</span>
            <Link to="/lots" className="text-xs font-semibold text-slate-800 hover:text-slate-950 flex items-center gap-1 group">
              View Lots <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </FlatCard>

        {/* Differentiator 2 */}
        <FlatCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-700 mb-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 2</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Weighted-Average Costing</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
              Inventory valuation is calculated using perpetual cost layers updated upon inbound receipt validation, providing accurate inventory balance valuation.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">TABLE: cost_layers</span>
            <Link to="/inventory" className="text-xs font-semibold text-slate-800 hover:text-slate-950 flex items-center gap-1 group">
              Valuation Layer <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </FlatCard>

        {/* Differentiator 3 */}
        <FlatCard className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-700 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Differentiator 3</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Consumption-Based Reorders</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-normal">
              Automated reorder triggers calculate historical consumption rates against min/max thresholds to suggest replenishment purchase orders.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-500">TABLE: reorder_suggestions</span>
            <Link to="/reorders" className="text-xs font-semibold text-slate-800 hover:text-slate-950 flex items-center gap-1 group">
              Reorder Engine <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </FlatCard>
      </div>

      {/* Architectural Invariant Box */}
      <div className="p-6 bg-slate-900 text-slate-100 rounded-3xl shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-full bg-white/10 text-white border border-white/10">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white tracking-tight">
              Architectural Invariant: Immutable Single Source of Truth
            </h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              <code className="text-amber-400 font-mono">stock_moves</code> is the sole authority for inventory modifications. 
              Quantities are never directly mutated in tables without a formal stock movement transaction. 
              <code className="text-slate-200 font-mono"> stock_quants</code> represents a materialized cache of on-hand inventory across locations and lots.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-mono text-slate-300">
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">Source: stock_moves</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">State: stock_quants</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">Valuation: cost_layers</span>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15">Traceability: audit_log</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
