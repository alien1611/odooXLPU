import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Clock, 
  Layers, 
  Package, 
  TrendingDown, 
  Sparkles,
  ArrowRight,
  FileText
} from 'lucide-react';

export default function ReordersPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'inventory_manager' || user?.role === 'admin';

  const [suggestions, setSuggestions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedWh, setSelectedWh] = useState('');
  const [search, setSearch] = useState('');

  // Selected item for details modal
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sugData, whData] = await Promise.all([
        api.getReorderSuggestions({
          status: statusFilter === 'all' ? null : statusFilter,
          warehouse_id: selectedWh || null
        }),
        api.getWarehouses()
      ]);
      setSuggestions(sugData);
      setWarehouses(whData);
    } catch (err) {
      setError(err.message || 'Failed to load reorder suggestions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, selectedWh]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.generateReorderSuggestions({
        warehouse_id: selectedWh ? parseInt(selectedWh, 10) : null
      });
      setSuccessMsg(res.message || 'Automated reorder suggestions generated successfully from 30-day stock moves.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to generate reorder suggestions.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'approve' }));
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.approveReorderSuggestion(id);
      const receiptRef = res.data?.receipt?.reference;
      setSuccessMsg(`Suggestion approved! Draft Inbound Receipt "${receiptRef}" generated. No inventory stock moves created.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to approve reorder suggestion.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleDismiss = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'dismiss' }));
    setError(null);
    try {
      await api.dismissReorderSuggestion(id);
      setSuccessMsg('Reorder suggestion dismissed.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to dismiss suggestion.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const filteredSuggestions = suggestions.filter(s =>
    s.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.sku?.toLowerCase().includes(search.toLowerCase()) ||
    s.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Summary Metrics
  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const approvedCount = suggestions.filter(s => s.status === 'approved').length;
  const totalSuggestedQty = suggestions
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + parseFloat(s.suggested_qty || 0), 0);
  const urgentCount = suggestions.filter(s => 
    s.status === 'pending' && 
    s.days_remaining !== null && 
    s.days_remaining < (s.lead_time_days || 0)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Consumption-Based Reorder Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated replenishment triggers calculated from 30-day outbound stock moves, lead times, and safety thresholds.
          </p>
        </div>

        {isManager && (
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 shrink-0"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Calculating 30-Day Ledger...' : 'Run Reorder Engine'}
          </button>
        )}
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Suggestions</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {pendingCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Awaiting manager approval</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Urgent Stock-Out Risks</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 font-mono">
            {urgentCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Days left &lt; supplier lead time</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Replenishment Units Needed</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            {totalSuggestedQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Total pending recommended volume</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Draft Receipts Created</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
            {approvedCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Approved into draft inbound orders</div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded">
          {[
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'dismissed', label: 'Dismissed' },
            { id: 'all', label: 'All' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === tab.id
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
              placeholder="Search product or SKU..."
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
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Suggestions Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4">Product / SKU</th>
                <th className="py-2.5 px-4">Warehouse</th>
                <th className="py-2.5 px-4 text-right">Current Stock</th>
                <th className="py-2.5 px-4 text-right">30d Avg Outflow</th>
                <th className="py-2.5 px-4 text-center">Days Left</th>
                <th className="py-2.5 px-4 text-right">Lead Time</th>
                <th className="py-2.5 px-4 text-right">Reorder Point</th>
                <th className="py-2.5 px-4 text-right">Suggested Qty</th>
                <th className="py-2.5 px-4">Status & Traceability</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && suggestions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Calculating replenishment suggestions...
                  </td>
                </tr>
              ) : filteredSuggestions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400">
                    No reorder suggestions found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredSuggestions.map((s) => {
                  const currentStock = parseFloat(s.current_stock || 0);
                  const avgConsumption = parseFloat(s.avg_daily_consumption || 0);
                  const suggestedQty = parseFloat(s.suggested_qty || 0);
                  const daysRemaining = s.days_remaining !== null ? parseFloat(s.days_remaining) : null;
                  const leadTime = parseInt(s.lead_time_days || 0, 10);
                  const isUrgent = daysRemaining !== null && daysRemaining < leadTime;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => setSelectedItem(s)}
                          className="font-medium text-slate-900 hover:text-blue-600 text-left"
                        >
                          {s.product_name}
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono">{s.sku} &bull; {s.uom_code}</div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">{s.warehouse_name}</div>
                        <div className="text-[10px] text-slate-400">{s.warehouse_code}</div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900">
                        {currentStock.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {avgConsumption > 0 ? `${avgConsumption.toFixed(2)}/d` : <span className="text-slate-400 italic">0.00/d</span>}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {daysRemaining !== null ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                            isUrgent 
                              ? 'bg-rose-100 text-rose-800 animate-pulse' 
                              : daysRemaining <= 30
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {daysRemaining.toFixed(1)}d
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No consumption</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                        {leadTime}d
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                        {parseFloat(s.reorder_point || s.min_stock || 0).toLocaleString()}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700 text-sm">
                        +{suggestedQty.toLocaleString()}
                      </td>

                      <td className="py-2.5 px-4">
                        {s.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                            <Clock className="w-3 h-3" /> Pending Review
                          </span>
                        )}
                        {s.status === 'approved' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Approved
                            </span>
                            {s.receipt_reference && (
                              <div className="mt-1 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <FileText className="w-3 h-3 text-slate-400" />
                                Draft: <span className="font-semibold text-slate-700">{s.receipt_reference}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {s.status === 'dismissed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-medium">
                            <XCircle className="w-3 h-3" /> Dismissed
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center">
                        {s.status === 'pending' ? (
                          isManager ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleApprove(s.id)}
                                disabled={actionLoading[s.id]}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                                title="Approve & Generate Draft Receipt"
                              >
                                {actionLoading[s.id] === 'approve' ? '...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleDismiss(s.id)}
                                disabled={actionLoading[s.id]}
                                className="px-2 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                                title="Dismiss Suggestion"
                              >
                                {actionLoading[s.id] === 'dismiss' ? '...' : 'Dismiss'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Manager only</span>
                          )
                        ) : (
                          <button
                            onClick={() => setSelectedItem(s)}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Details
                          </button>
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

      {/* Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedItem.product_name}</h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">SKU: {selectedItem.sku} &bull; Warehouse: {selectedItem.warehouse_name}</div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded text-blue-900">
                <span className="font-semibold block mb-0.5">Replenishment Rationale:</span>
                {selectedItem.reason}
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">Current On-Hand Stock:</span>
                  <div className="font-bold text-slate-900 font-mono">{selectedItem.current_stock}</div>
                </div>
                <div>
                  <span className="text-slate-500">Avg Daily Outflow:</span>
                  <div className="font-bold text-slate-900 font-mono">{parseFloat(selectedItem.avg_daily_consumption).toFixed(2)} / day</div>
                </div>
                <div>
                  <span className="text-slate-500">Projected Run-out:</span>
                  <div className="font-bold text-slate-900 font-mono">{selectedItem.days_remaining ? `${selectedItem.days_remaining} days` : 'No recent outflow'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Supplier Lead Time:</span>
                  <div className="font-bold text-slate-900 font-mono">{selectedItem.lead_time_days} days</div>
                </div>
                <div>
                  <span className="text-slate-500">Reorder Threshold:</span>
                  <div className="font-bold text-slate-900 font-mono">{selectedItem.reorder_point} units</div>
                </div>
                <div>
                  <span className="text-slate-500">Recommended Order:</span>
                  <div className="font-bold text-blue-700 font-mono text-sm">+{selectedItem.suggested_qty} units</div>
                </div>
              </div>

              {selectedItem.receipt_reference && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-emerald-900">
                  <span className="font-semibold block mb-0.5">Linked Inbound Order:</span>
                  Draft Receipt Reference: <span className="font-mono font-bold">{selectedItem.receipt_reference}</span>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Approval created a draft purchasing receipt. Stock quantities will update only when physical inventory is formally validated in Receipts.
                  </p>
                </div>
              )}

              <div className="text-[11px] text-slate-400 pt-1">
                Generated at: {new Date(selectedItem.generated_at).toLocaleString()}
                {selectedItem.reviewed_at && ` • Reviewed at: ${new Date(selectedItem.reviewed_at).toLocaleString()}`}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedItem(null)}
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
