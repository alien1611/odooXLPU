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
  ArrowRight
} from 'lucide-react';

export default function InventoryPage() {
  const [quants, setQuants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedWh, setSelectedWh] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [quantData, whData] = await Promise.all([
        api.getQuants({ warehouse_id: selectedWh || null }),
        api.getWarehouses()
      ]);
      setQuants(quantData);
      setWarehouses(whData);
    } catch (err) {
      setError(err.message || 'Failed to load stock quants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWh]);

  const filteredQuants = quants.filter(q => 
    q.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    q.location_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.location_code?.toLowerCase().includes(search.toLowerCase()) ||
    (q.lot_number && q.lot_number.toLowerCase().includes(search.toLowerCase()))
  );

  // Computed Summary Metrics
  const totalUnits = filteredQuants.reduce((sum, q) => sum + parseFloat(q.quantity || 0), 0);
  const totalValuation = filteredQuants.reduce((sum, q) => sum + (parseFloat(q.quantity || 0) * parseFloat(q.unit_cost || 0)), 0);
  const uniqueLots = new Set(filteredQuants.map(q => q.lot_id).filter(Boolean)).size;
  const uniqueLocations = new Set(filteredQuants.map(q => q.location_id)).size;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Inventory Quants (Real-Time Stock)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Atomic live snapshot of physical stock levels grouped by product, warehouse location, and lot batch.
          </p>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Units On-Hand</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Across active warehouse bins</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Weighted-average costing</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Batches / Lots</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {uniqueLots}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Tracked with FEFO expiry</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Occupied Storage Bins</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {uniqueLocations}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Active storage locations</div>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product, SKU, location, or lot number..."
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
          title="Refresh Quants"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Quants Table */}
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
                <th className="py-2.5 px-4 text-right">Reserved</th>
                <th className="py-2.5 px-4 text-right">Available Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Cost</th>
                <th className="py-2.5 px-4 text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && quants.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading current inventory quants...
                  </td>
                </tr>
              ) : filteredQuants.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
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

                  let isExpiringSoon = false;
                  let isExpired = false;
                  if (q.expiry_date) {
                    const daysUntil = Math.ceil((new Date(q.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysUntil <= 0) isExpired = true;
                    else if (daysUntil <= 30) isExpiringSoon = true;
                  }

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
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            isExpired 
                              ? 'bg-rose-100 text-rose-800 font-semibold' 
                              : isExpiringSoon 
                              ? 'bg-amber-100 text-amber-800 font-semibold' 
                              : 'text-slate-600'
                          }`}>
                            {new Date(q.expiry_date).toLocaleDateString()}
                            {isExpired && ' (Expired)'}
                            {isExpiringSoon && !isExpired && ' (≤30d)'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">N/A</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-800">
                        {onHand.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                        {reserved > 0 ? reserved.toLocaleString() : '-'}
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
    </div>
  );
}
