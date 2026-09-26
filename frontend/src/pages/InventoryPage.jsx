import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  Boxes, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Package, 
  ShieldAlert, 
  DollarSign,
  Layers,
  ArrowRight
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Inventory & Perpetual Valuation"
        subtitle="Real-time physical stock quants and authoritative cost-layer inventory balance (SUM(remaining_qty × unit_cost))."
        actions={
          <div className="flex items-center gap-1.5 p-1 bg-black/[0.04] rounded-full border border-black/[0.04]">
            <button
              onClick={() => setViewMode('quants')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                viewMode === 'quants'
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Stock Quants
            </button>
            <button
              onClick={() => setViewMode('valuation')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                viewMode === 'valuation'
                  ? 'bg-white text-amber-600 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              Cost Layer Valuation
            </button>
          </div>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Total Inventory Valuation</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">SUM(cost_layers.remaining_qty × unit_cost)</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Total On-Hand Units</span>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            {totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Total volume across warehouse bins</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Active Cost Layers</span>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            {activeLayersCount}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Perpetual FIFO/WAC cost tiers</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Active FEFO Batches</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            {uniqueLots}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Tracked with expiry dates</div>
        </FlatCard>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 text-rose-800 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Search and Warehouse Filter */}
      <FlatCard className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={viewMode === 'quants' ? "Search product, SKU, location, or lot..." : "Search product, SKU, or category..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={selectedWh}
              onChange={(e) => setSelectedWh(e.target.value)}
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map((wh) => ({ value: wh.id, label: `${wh.name} (${wh.code})` }))
              ]}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* VIEW 1: Cost Layer Valuation Breakdown */}
      {viewMode === 'valuation' && (
        <FlatCard className="p-0 overflow-hidden">
          <div className="px-5 py-3.5 bg-neutral-50/80 border-b border-black/[0.04] flex items-center justify-between">
            <span className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">
              Product-Level Perpetual Inventory Valuation Ledger
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              Formula: Σ(cost_layers.remaining_qty × cost_layers.unit_cost)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50/40 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">On-Hand Qty</th>
                  <th className="py-3 px-4 text-right">Current Weighted Avg Cost</th>
                  <th className="py-3 px-4 text-right">Cost Layer Valuation</th>
                  <th className="py-3 px-4 text-center">Active Layers</th>
                  <th className="py-3 px-4 text-center">Audit Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loading && productValuations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                      Loading perpetual valuation ledger...
                    </td>
                  </tr>
                ) : filteredValuations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center">
                      <EmptyState
                        icon={Boxes}
                        title="No products found"
                        description="No inventory valuation records matching the selected filter."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredValuations.map((p) => {
                    const totalQty = parseFloat(p.total_quantity || 0);
                    const wac = parseFloat(p.weighted_average_cost || 0);
                    const val = parseFloat(p.total_inventory_value || 0);

                    return (
                      <tr key={p.product_id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{p.product_name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{p.sku} &bull; {p.uom_code}</div>
                        </td>

                        <td className="py-3 px-4 text-neutral-700">
                          {p.category_name ? <Badge variant="neutral">{p.category_name}</Badge> : <span className="text-neutral-400 italic">Uncategorized</span>}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-medium text-neutral-900">
                          {totalQty.toLocaleString()}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-neutral-700">
                          ${wac.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900 text-sm">
                          ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Badge variant="neutral">
                            {p.active_layers_count} {p.active_layers_count === 1 ? 'layer' : 'layers'}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleInspectLayers(p)}
                            icon={ArrowRight}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </FlatCard>
      )}

      {/* VIEW 2: Physical Stock Quants */}
      {viewMode === 'quants' && (
        <FlatCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Warehouse & Location</th>
                  <th className="py-3 px-4">Lot / Batch</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">On-Hand Qty</th>
                  <th className="py-3 px-4 text-right">Available Qty</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loading && quants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                      Loading current inventory quants...
                    </td>
                  </tr>
                ) : filteredQuants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center">
                      <EmptyState
                        icon={Boxes}
                        title="No inventory quants found"
                        description="No inventory records in stock matching your current query."
                      />
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
                      <tr key={q.id} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{q.product_name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{q.product_sku} &bull; {q.uom_name || q.uom_code}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-neutral-800">{q.location_name}</div>
                          <div className="text-[11px] text-neutral-400 mt-0.5">{q.warehouse_name || q.warehouse_code} &bull; {q.location_code}</div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {q.lot_number ? (
                            <Badge variant="amber">{q.lot_number}</Badge>
                          ) : (
                            <span className="text-neutral-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {q.expiry_date ? (
                            <span className="text-neutral-700 font-mono text-[11px]">
                              {new Date(q.expiry_date).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-neutral-400 italic">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-neutral-800">
                          {onHand.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                          {available.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-neutral-600">
                          ${cost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                          ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </FlatCard>
      )}

      {/* Layer Drilldown Modal */}
      {selectedProductLayers && (
        <Modal
          isOpen={!!selectedProductLayers}
          onClose={() => setSelectedProductLayers(null)}
          title={`Cost Layers: ${selectedProductLayers.product.product_name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="text-xs text-neutral-500 font-mono">
              SKU: {selectedProductLayers.product.sku} &bull; Weighted Avg Cost: ${parseFloat(selectedProductLayers.product.weighted_average_cost).toFixed(2)}
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Active cost layers currently contributing to perpetual inventory balance. Outbound deliveries deplete layers in First-In sequence.
            </p>

            {selectedProductLayers.layers.length === 0 ? (
              <div className="py-8 text-center text-neutral-400 text-xs">
                No active cost layers found for this product.
              </div>
            ) : (
              <div className="border border-black/[0.06] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider text-[10px] border-b border-black/[0.04]">
                    <tr>
                      <th className="py-2.5 px-3">Layer ID</th>
                      <th className="py-2.5 px-3">Origin Document</th>
                      <th className="py-2.5 px-3 text-right">Initial Qty</th>
                      <th className="py-2.5 px-3 text-right">Remaining Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Layer Valuation</th>
                      <th className="py-2.5 px-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] font-mono">
                    {selectedProductLayers.layers.map(layer => (
                      <tr key={layer.layer_id} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 text-neutral-400">#{layer.layer_id}</td>
                        <td className="py-2.5 px-3 text-neutral-800">{layer.origin_document || '-'}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-500">{layer.initial_qty}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-neutral-900">{layer.remaining_qty}</td>
                        <td className="py-2.5 px-3 text-right text-neutral-700">${layer.unit_cost.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-neutral-900">
                          ${layer.layer_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                          {new Date(layer.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-black/[0.06]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedProductLayers(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
