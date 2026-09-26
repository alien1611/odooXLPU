import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Building2, 
  Layers, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [riskWindow, setRiskWindow] = useState('all');
  const [selectedWh, setSelectedWh] = useState('');
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lotsData, sumData, whData] = await Promise.all([
        api.getExpiryRisk({
          risk_window: riskWindow === 'all' ? null : riskWindow,
          warehouse_id: selectedWh || null
        }),
        api.getExpirySummary({
          warehouse_id: selectedWh || null
        }),
        api.getWarehouses()
      ]);
      setLots(lotsData);
      setSummary(sumData);
      setWarehouses(whData);
    } catch (err) {
      setError(err.message || 'Failed to load lot expiry risk data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [riskWindow, selectedWh]);

  const filteredLots = lots.filter(l =>
    l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.sku?.toLowerCase().includes(search.toLowerCase()) ||
    l.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    l.location_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            FEFO Lot Expiry Risk Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active batch tracking and First-Expiry-First-Out management. Real-time surveillance of products nearing shelf-life expiration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            FEFO Priority Dispatch Enabled
          </span>
        </div>
      </div>

      {/* KPI Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Expired Batches (Immediate Action)</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600 font-mono">
              {summary.expired_count} <span className="text-xs text-slate-400 font-normal">lots ({summary.expired_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Past shelf life &bull; Quarantined / scrap</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Expiring Within 7 Days</span>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-orange-600 font-mono">
              {summary.within_7_days_count} <span className="text-xs text-slate-400 font-normal">lots ({summary.within_7_days_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Critical FEFO dispatch priority</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Expiring Within 30 Days</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600 font-mono">
              {summary.within_30_days_count} <span className="text-xs text-slate-400 font-normal">lots ({summary.within_30_days_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Near-term dispatch queue</div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Safe Stock (&gt;90 Days)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
              {summary.safe_count} <span className="text-xs text-slate-400 font-normal">lots ({summary.safe_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Stable inventory balance</div>
          </div>
        </div>
      )}

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

      {/* Risk Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        {/* Risk Window Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded overflow-x-auto">
          {[
            { id: 'all', label: 'All Lots' },
            { id: 'expired', label: 'Expired' },
            { id: '7', label: '≤7 Days' },
            { id: '30', label: '≤30 Days' },
            { id: '60', label: '≤60 Days' },
            { id: '90', label: '≤90 Days' },
            { id: 'safe', label: 'Safe (>90d)' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setRiskWindow(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                riskWindow === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Warehouse filter */}
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search lot, product, or bin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={selectedWh}
            onChange={(e) => setSelectedWh(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors shrink-0"
            title="Refresh Lots"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Lots Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4">Lot / Batch Number</th>
                <th className="py-2.5 px-4">Product Name & SKU</th>
                <th className="py-2.5 px-4">Storage Location</th>
                <th className="py-2.5 px-4 text-right">Available Qty</th>
                <th className="py-2.5 px-4">Expiry Date</th>
                <th className="py-2.5 px-4 text-center">Days Remaining</th>
                <th className="py-2.5 px-4">FEFO Risk Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && lots.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading active batch expiry records...
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No active batches found matching the selected expiry criteria.
                  </td>
                </tr>
              ) : (
                filteredLots.map((l) => {
                  const days = l.days_remaining;
                  const isExpired = days < 0;
                  const is7Days = days >= 0 && days <= 7;
                  const is30Days = days > 7 && days <= 30;
                  const is60Days = days > 30 && days <= 60;
                  const is90Days = days > 60 && days <= 90;
                  const isSafe = days > 90;

                  return (
                    <tr key={`${l.lot_id}-${l.location_id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                        {l.lot_number}
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{l.product_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{l.sku} &bull; {l.uom_code}</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">{l.location_name}</div>
                        <div className="text-[10px] text-slate-400">{l.warehouse_name} &bull; {l.location_code}</div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {parseFloat(l.quantity).toLocaleString()}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {new Date(l.expiry_date).toLocaleDateString()}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          isExpired 
                            ? 'bg-rose-100 text-rose-800' 
                            : is7Days
                            ? 'bg-orange-100 text-orange-800 animate-pulse'
                            : is30Days
                            ? 'bg-amber-100 text-amber-800'
                            : is60Days
                            ? 'bg-yellow-100 text-yellow-800'
                            : is90Days
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isExpired ? `${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3" /> EXPIRED
                          </span>
                        )}
                        {is7Days && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" /> URGENT (≤7d)
                          </span>
                        )}
                        {is30Days && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            <Clock className="w-3 h-3" /> High Risk (≤30d)
                          </span>
                        )}
                        {is60Days && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-medium">
                            Medium Risk (≤60d)
                          </span>
                        )}
                        {is90Days && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                            Low Risk (≤90d)
                          </span>
                        )}
                        {isSafe && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Safe (&gt;90d)
                          </span>
                        )}
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
