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
  Package, 
  Sparkles,
  FileText
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Consumption-Based Reorder Intelligence"
        subtitle="Automated replenishment triggers calculated from 30-day outbound stock moves, lead times, and safety thresholds."
        actions={
          isManager && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || loading}
              icon={Sparkles}
              className={generating ? 'animate-spin' : ''}
            >
              {generating ? 'Calculating 30-Day Ledger...' : 'Run Reorder Engine'}
            </Button>
          )
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Pending Suggestions</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            {pendingCount}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Awaiting manager approval</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Urgent Stock-Out Risks</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-rose-600 font-mono">
            {urgentCount}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Days left &lt; supplier lead time</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Replenishment Units Needed</span>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
            {totalSuggestedQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Total pending recommended volume</div>
        </FlatCard>

        <FlatCard className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">Draft Receipts Created</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-emerald-600 font-mono">
            {approvedCount}
          </div>
          <div className="mt-1 text-[11px] text-neutral-400">Approved into draft inbound orders</div>
        </FlatCard>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 text-rose-800 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <FlatCard className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-black/[0.04] p-1 rounded-full overflow-x-auto">
            {[
              { id: 'pending', label: 'Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'dismissed', label: 'Dismissed' },
              { id: 'all', label: 'All' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  statusFilter === tab.id
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Warehouse filter */}
          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Input
                type="text"
                placeholder="Search product or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="w-48">
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
        </div>
      </FlatCard>

      {/* Suggestions Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Warehouse</th>
                <th className="py-3 px-4 text-right">Current Stock</th>
                <th className="py-3 px-4 text-right">30d Avg Outflow</th>
                <th className="py-3 px-4 text-center">Days Left</th>
                <th className="py-3 px-4 text-right">Lead Time</th>
                <th className="py-3 px-4 text-right">Reorder Point</th>
                <th className="py-3 px-4 text-right">Suggested Qty</th>
                <th className="py-3 px-4">Status & Traceability</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && suggestions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Calculating replenishment suggestions...
                  </td>
                </tr>
              ) : filteredSuggestions.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No reorder suggestions found"
                      description="No replenishment triggers match the selected filter."
                    />
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
                    <tr key={s.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedItem(s)}
                          className="font-semibold text-neutral-900 hover:text-amber-600 text-left"
                        >
                          {s.product_name}
                        </button>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{s.sku} &bull; {s.uom_code}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-800">{s.warehouse_name}</div>
                        <div className="text-[11px] text-neutral-400">{s.warehouse_code}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium text-neutral-900">
                        {currentStock.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-700">
                        {avgConsumption > 0 ? `${avgConsumption.toFixed(2)}/d` : <span className="text-neutral-400 italic">0.00/d</span>}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {daysRemaining !== null ? (
                          <Badge variant={isUrgent ? 'danger' : daysRemaining <= 30 ? 'amber' : 'success'}>
                            {daysRemaining.toFixed(1)}d
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-neutral-400 italic">No consumption</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-600">
                        {leadTime}d
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-neutral-600">
                        {parseFloat(s.reorder_point || s.min_stock || 0).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-600 text-sm">
                        +{suggestedQty.toLocaleString()}
                      </td>

                      <td className="py-3 px-4">
                        {s.status === 'pending' && (
                          <Badge variant="amber" icon={Clock}>Pending Review</Badge>
                        )}
                        {s.status === 'approved' && (
                          <div>
                            <Badge variant="success" icon={CheckCircle2}>Approved</Badge>
                            {s.receipt_reference && (
                              <div className="mt-1 text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                                Draft: <span className="font-semibold text-neutral-800">{s.receipt_reference}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {s.status === 'dismissed' && (
                          <Badge variant="neutral" icon={XCircle}>Dismissed</Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {s.status === 'pending' ? (
                          isManager ? (
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApprove(s.id)}
                                disabled={actionLoading[s.id]}
                              >
                                {actionLoading[s.id] === 'approve' ? '...' : 'Approve'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDismiss(s.id)}
                                disabled={actionLoading[s.id]}
                              >
                                {actionLoading[s.id] === 'dismiss' ? '...' : 'Dismiss'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-400 italic">Manager only</span>
                          )
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedItem(s)}
                          >
                            Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>

      {/* Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.product_name}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="text-neutral-500 font-mono">SKU: {selectedItem.sku} &bull; Warehouse: {selectedItem.warehouse_name}</div>

            <div className="p-3.5 bg-neutral-50 border border-black/[0.06] rounded-xl text-neutral-800">
              <span className="font-semibold block mb-1">Replenishment Rationale:</span>
              {selectedItem.reason}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-neutral-50/50 p-3.5 rounded-xl border border-black/[0.06]">
              <div>
                <span className="text-neutral-400">Current On-Hand Stock:</span>
                <div className="font-semibold text-neutral-900 font-mono mt-0.5">{selectedItem.current_stock}</div>
              </div>
              <div>
                <span className="text-neutral-400">Avg Daily Outflow:</span>
                <div className="font-semibold text-neutral-900 font-mono mt-0.5">{parseFloat(selectedItem.avg_daily_consumption).toFixed(2)} / day</div>
              </div>
              <div>
                <span className="text-neutral-400">Projected Run-out:</span>
                <div className="font-semibold text-neutral-900 font-mono mt-0.5">{selectedItem.days_remaining ? `${selectedItem.days_remaining} days` : 'No recent outflow'}</div>
              </div>
              <div>
                <span className="text-neutral-400">Supplier Lead Time:</span>
                <div className="font-semibold text-neutral-900 font-mono mt-0.5">{selectedItem.lead_time_days} days</div>
              </div>
              <div>
                <span className="text-neutral-400">Reorder Threshold:</span>
                <div className="font-semibold text-neutral-900 font-mono mt-0.5">{selectedItem.reorder_point} units</div>
              </div>
              <div>
                <span className="text-neutral-400">Recommended Order:</span>
                <div className="font-semibold text-amber-600 font-mono text-sm mt-0.5">+{selectedItem.suggested_qty} units</div>
              </div>
            </div>

            {selectedItem.receipt_reference && (
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-900">
                <span className="font-semibold block mb-0.5">Linked Inbound Order:</span>
                Draft Receipt Reference: <span className="font-mono font-semibold">{selectedItem.receipt_reference}</span>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Approval created a draft purchasing receipt. Stock quantities will update only when physical inventory is formally validated in Receipts.
                </p>
              </div>
            )}

            <div className="text-[11px] text-neutral-400 pt-1">
              Generated at: {new Date(selectedItem.generated_at).toLocaleString()}
              {selectedItem.reviewed_at && ` • Reviewed at: ${new Date(selectedItem.reviewed_at).toLocaleString()}`}
            </div>

            <div className="flex justify-end pt-3 border-t border-black/[0.06]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedItem(null)}
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
