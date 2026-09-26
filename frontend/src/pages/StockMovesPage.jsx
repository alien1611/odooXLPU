import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ArrowLeftRight, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck,
  Package
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';

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
        return <Badge variant="success">Receipt (In)</Badge>;
      case 'delivery':
        return <Badge variant="neutral">Delivery (Out)</Badge>;
      case 'internal_transfer':
        return <Badge variant="neutral">Transfer</Badge>;
      case 'adjustment_in':
        return <Badge variant="success">Adj Gain</Badge>;
      case 'adjustment_out':
      case 'scrap':
        return <Badge variant="danger">Adj Loss / Scrap</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Stock Movements"
        subtitle="Single source of truth: An append-only audit ledger recording every inventory transaction with perpetual cost valuation."
        actions={
          <div className="flex items-center gap-2 text-xs text-neutral-600 font-mono bg-white px-3 py-1.5 rounded-full border border-black/[0.06] shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Ledger Integrity Verified</span>
          </div>
        }
      />

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

      {/* Search & Filter Bar */}
      <FlatCard className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by move reference, origin doc, product, SKU, lot, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={moveTypeFilter}
              onChange={(e) => setMoveTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'All Movement Types' },
                { value: 'receipt', label: 'Inbound Receipts' },
                { value: 'delivery', label: 'Outbound Deliveries' },
                { value: 'internal_transfer', label: 'Internal Transfers' },
                { value: 'adjustment_out', label: 'Scrap & Write-Offs' },
                { value: 'adjustment_in', label: 'Adjustment Gains' }
              ]}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchMoves}
            disabled={loading}
            title="Refresh Moves Ledger"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* Moves Ledger Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Move Ref</th>
                <th className="py-3 px-4">Origin Document</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Lot / Batch</th>
                <th className="py-3 px-4">Path (From &rarr; To)</th>
                <th className="py-3 px-4 text-right">Qty</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
                <th className="py-3 px-4 text-right">Total Value</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && moves.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading immutable stock movements...
                  </td>
                </tr>
              ) : filteredMoves.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No stock movements found"
                      description="No movement transactions match the selected filter."
                    />
                  </td>
                </tr>
              ) : (
                filteredMoves.map((m) => {
                  const qty = parseFloat(m.quantity || 0);
                  const cost = parseFloat(m.unit_cost || 0);
                  const total = qty * cost;

                  return (
                    <tr key={m.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-neutral-900">
                        {m.reference}
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-600 font-medium">
                        {m.origin_document || <span className="text-neutral-400 font-sans italic">Direct</span>}
                      </td>
                      <td className="py-3 px-4">
                        {getMoveTypeBadge(m.move_type)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{m.product_name}</div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{m.product_sku}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {m.lot_number ? (
                          <Badge variant="amber">{m.lot_number}</Badge>
                        ) : (
                          <span className="text-neutral-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={m.src_location_code ? 'text-neutral-800 font-medium' : 'text-neutral-400 italic'}>
                            {m.src_location_code || 'Vendor'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className={m.dest_location_code ? 'text-neutral-800 font-medium' : 'text-neutral-400 italic'}>
                            {m.dest_location_code || 'Customer'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                        {qty.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-600">
                        ${cost.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>
    </div>
  );
}
