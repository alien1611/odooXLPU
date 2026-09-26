import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  Boxes, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Building2, 
  Package, 
  ShieldAlert, 
  DollarSign,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function InventoryPage() {
  const [viewMode, setViewMode] = useState('quants'); // 'quants' or 'valuation'
  const [quants, setQuants] = useState([]);
  const [valuationSummary, setValuationSummary] = useState(null);
  const [productValuations, setProductValuations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedProductLayers, setSelectedProductLayers] = useState(null);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedWh, setSelectedWh] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [quantData, valSummary, valProds, whData] = await Promise.all([
        api.getQuants({ warehouse_id: selectedWh || null }),
        api.getValuationSummary({ warehouse_id: selectedWh || null }),
        api.getProductValuation({ search: search || null }),
        api.getWarehouses()
      ]);
      setQuants(quantData);
      setValuationSummary(valSummary);
      setProductValuations(valProds);
      setWarehouses(whData);
    } catch (err) {
      setError(err.message || 'Failed to load inventory valuation and stock levels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWh]);

  const handleInspectLayers = async (product) => {
    setLoadingLayers(true);
    try {
      const layers = await api.getValuationLayers(product.product_id);
      setSelectedProductLayers({ product, layers });
    } catch (err) {
      setError(err.message || 'Failed to load cost layers.');
    } finally {
      setLoadingLayers(false);
    }
  };

  const filteredQuants = quants.filter(q => 
    q.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    q.location_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.location_code?.toLowerCase().includes(search.toLowerCase()) ||
    (q.lot_number && q.lot_number.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredValuations = productValuations.filter(p =>
    p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalUnits = valuationSummary?.total_quantity ?? quants.reduce((sum, q) => sum + parseFloat(q.quantity || 0), 0);
  const totalValuation = valuationSummary?.total_inventory_value ?? 0;
  const uniqueLots = new Set(quants.map(q => q.lot_id).filter(Boolean)).size;
  const activeLayersCount = valuationSummary?.active_layers_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Inventory & Perpetual Valuation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical stock quants and authoritative cost-layer inventory balance (SUM(remaining_qty &times; unit_cost)).
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
          <button
            onClick={() => setViewMode('quants')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              viewMode === 'quants'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Physical Stock Quants
          </button>
          <button
            onClick={() => setViewMode('valuation')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
              viewMode === 'valuation'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            Cost Layer Valuation
          </button>
        </div>
      </div>

      {/* KPI Stat Cards — Driven strictly by backend valuationService */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Inventory Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">SUM(cost_layers.remaining_qty &times; unit_cost)</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total On-Hand Units</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Total volume across warehouse bins</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Cost Layers</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {activeLayersCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Perpetual FIFO/WAC cost tiers</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active FEFO Batches</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {uniqueLots}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Tracked with expiry dates</div>
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

      {/* Search and Warehouse Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={viewMode === 'quants' ? "Search product, SKU, location, or lot..." : "Search product, SKU, or category..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        <div className="w-full sm:w-56">
          <select
            value={selectedWh}
            onChange={(e) => setSelectedWh(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* VIEW 1: Cost Layer Valuation Breakdown */}
      {viewMode === 'valuation' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
              Product-Level Perpetual Inventory Valuation Ledger
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Formula: &Sigma;(cost_layers.remaining_qty &times; cost_layers.unit_cost)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-4">Product / SKU</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">On-Hand Qty</th>
                  <th className="py-2.5 px-4 text-right">Current Weighted Avg Cost</th>
                  <th className="py-2.5 px-4 text-right">Cost Layer Valuation</th>
                  <th className="py-2.5 px-4 text-center">Active Layers</th>
                  <th className="py-2.5 px-4 text-center">Audit Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && productValuations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading perpetual valuation ledger...
                    </td>
                  </tr>
                ) : filteredValuations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400">
                      No products found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredValuations.map((p) => {
                    const totalQty = parseFloat(p.total_quantity || 0);
                    const wac = parseFloat(p.weighted_average_cost || 0);
                    const val = parseFloat(p.total_inventory_value || 0);

                    return (
                      <tr key={p.product_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{p.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.sku} &bull; {p.uom_code}</div>
                        </td>

                        <td className="py-2.5 px-4 text-slate-700">
                          {p.category_name || <span className="text-slate-400 italic">Uncategorized</span>}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                          {totalQty.toLocaleString()}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                          ${wac.toFixed(2)}
                        </td>

                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                          ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            {p.active_layers_count} {p.active_layers_count === 1 ? 'layer' : 'layers'}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleInspectLayers(p)}
                            className="px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          >
                            Inspect Layers &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Physical Stock Quants */}
      {viewMode === 'quants' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                <tr>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Warehouse & Location</th>
                  <th className="py-2.5 px-4">Lot / Batch</th>
                  <th className="py-2.5 px-4">Expiry Date</th>
                  <th className="py-2.5 px-4 text-right">On-Hand Qty</th>
                  <th className="py-2.5 px-4 text-right">Available Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Cost</th>
                  <th className="py-2.5 px-4 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && quants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading current inventory quants...
                    </td>
                  </tr>
                ) : filteredQuants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No matching inventory quants found in stock.
                    </td>
                  </tr>
                ) : (
                  filteredQuants.map((q) => {
                    const onHand = parseFloat(q.quantity || 0);
                    const reserved = parseFloat(q.reserved_quantity || 0);
                    const available = parseFloat(q.available_quantity || onHand - reserved);
                    const cost = parseFloat(q.unit_cost || 0);
                    const value = onHand * cost;

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{q.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{q.product_sku} &bull; {q.uom_name || q.uom_code}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-800">{q.location_name}</div>
                          <div className="text-[10px] text-slate-400">{q.warehouse_name || q.warehouse_code} &bull; {q.location_code}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {q.lot_number ? (
                            <span className="text-slate-800 font-medium">{q.lot_number}</span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {q.expiry_date ? (
                            <span className="text-slate-700 font-mono text-[11px]">
                              {new Date(q.expiry_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-800">
                          {onHand.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {available.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                          ${cost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Layer Drilldown Modal */}
      {selectedProductLayers && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cost Layers: {selectedProductLayers.product.product_name}
                </h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  SKU: {selectedProductLayers.product.sku} &bull; Weighted Avg Cost: ${parseFloat(selectedProductLayers.product.weighted_average_cost).toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => setSelectedProductLayers(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600 leading-relaxed">
                Active cost layers currently contributing to perpetual inventory balance. Outbound deliveries deplete layers in First-In sequence.
              </div>

              {selectedProductLayers.layers.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No active cost layers found for this product.
                </div>
              ) : (
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Layer ID</th>
                        <th className="py-2 px-3">Origin Document</th>
                        <th className="py-2 px-3 text-right">Initial Qty</th>
                        <th className="py-2 px-3 text-right">Remaining Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">Layer Valuation</th>
                        <th className="py-2 px-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {selectedProductLayers.layers.map(layer => (
                        <tr key={layer.layer_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-500">#{layer.layer_id}</td>
                          <td className="py-2 px-3 text-slate-800">{layer.origin_document || '-'}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{layer.initial_qty}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{layer.remaining_qty}</td>
                          <td className="py-2 px-3 text-right text-slate-700">${layer.unit_cost.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                            ${layer.layer_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[10px]">
                            {new Date(layer.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedProductLayers(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
