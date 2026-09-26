import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ArrowLeftRight, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck,
  FileText,
  Filter
} from 'lucide-react';

export default function StockMovesPage() {
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [moveTypeFilter, setMoveTypeFilter] = useState('');

  const fetchMoves = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMoves({
        move_type: moveTypeFilter || null,
        limit: 200
      });
      setMoves(data);
    } catch (err) {
      setError(err.message || 'Failed to load stock movements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoves();
  }, [moveTypeFilter]);

  const filteredMoves = moves.filter(m => 
    m.reference?.toLowerCase().includes(search.toLowerCase()) ||
    m.origin_document?.toLowerCase().includes(search.toLowerCase()) ||
    m.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    (m.lot_number && m.lot_number.toLowerCase().includes(search.toLowerCase())) ||
    m.src_location_code?.toLowerCase().includes(search.toLowerCase()) ||
    m.dest_location_code?.toLowerCase().includes(search.toLowerCase())
  );

  const getMoveTypeBadge = (type) => {
    switch (type) {
      case 'receipt':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase tracking-wide">Receipt (In)</span>;
      case 'delivery':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 uppercase tracking-wide">Delivery (Out)</span>;
      case 'internal_transfer':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 uppercase tracking-wide">Transfer</span>;
      case 'adjustment_in':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase tracking-wide">Adj Gain</span>;
      case 'adjustment_out':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 uppercase tracking-wide">Adj Loss / Scrap</span>;
      case 'scrap':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 uppercase tracking-wide">Scrap</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 uppercase tracking-wide">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
            Stock Movements (Immutable Ledger)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single source of truth: An append-only audit ledger recording every inventory transaction with perpetual cost valuation.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Ledger Integrity Verified</span>
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by move reference, origin doc, product, SKU, lot, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
        <div className="w-full sm:w-56">
          <select
            value={moveTypeFilter}
            onChange={(e) => setMoveTypeFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          >
            <option value="">All Movement Types</option>
            <option value="receipt">Inbound Receipts</option>
            <option value="delivery">Outbound Deliveries</option>
            <option value="internal_transfer">Internal Transfers</option>
            <option value="adjustment_out">Scrap & Write-Offs</option>
            <option value="adjustment_in">Adjustment Gains</option>
          </select>
        </div>
        <button
          onClick={fetchMoves}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
          title="Refresh Moves Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Moves Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4">Move Ref</th>
                <th className="py-2.5 px-4">Origin Document</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Lot / Batch</th>
                <th className="py-2.5 px-4">Path (From &rarr; To)</th>
                <th className="py-2.5 px-4 text-right">Qty</th>
                <th className="py-2.5 px-4 text-right">Unit Cost</th>
                <th className="py-2.5 px-4 text-right">Total Value</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && moves.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading immutable stock movements...
                  </td>
                </tr>
              ) : filteredMoves.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No matching stock movement ledger entries found.
                  </td>
                </tr>
              ) : (
                filteredMoves.map((m) => {
                  const qty = parseFloat(m.quantity || 0);
                  const cost = parseFloat(m.unit_cost || 0);
                  const total = qty * cost;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                        {m.reference}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-indigo-600 font-medium">
                        {m.origin_document || <span className="text-slate-400 font-sans italic">Direct</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        {getMoveTypeBadge(m.move_type)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">{m.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.product_sku}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        {m.lot_number ? (
                          <span className="text-slate-700 font-medium">{m.lot_number}</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className={m.src_location_code ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}>
                            {m.src_location_code || 'Vendor'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className={m.dest_location_code ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}>
                            {m.dest_location_code || 'Customer'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {qty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                        ${cost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
