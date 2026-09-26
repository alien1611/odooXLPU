import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Layers,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Play,
  CheckCheck,
  Ban,
  Clock,
  MapPin,
  Package,
  ArrowRight,
  Boxes,
  Truck,
  Building2,
  Calendar,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

export default function WavesPage() {
  const { user, isManager } = useAuth();
  const [waves, setWaves] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selected Wave Detail
  const [activeWaveId, setActiveWaveId] = useState(null);
  const [activeWave, setActiveWave] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [eligibleDeliveries, setEligibleDeliveries] = useState([]);
  const [createFormData, setCreateFormData] = useState({
    warehouse_id: '',
    notes: '',
    selected_delivery_ids: []
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wavesData, whsData] = await Promise.all([
        api.getWaves({
          warehouse_id: selectedWarehouse || null,
          status: selectedStatus || null
        }),
        api.getWarehouses()
      ]);
      setWaves(wavesData);
      setWarehouses(whsData);
      if (!createFormData.warehouse_id && whsData.length > 0) {
        setCreateFormData(prev => ({ ...prev, warehouse_id: whsData[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load pick waves.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, selectedStatus]);

  const loadWaveDetail = async (id) => {
    setActiveWaveId(id);
    setDetailLoading(true);
    try {
      const data = await api.getWaveById(id);
      setActiveWave(data);
    } catch (err) {
      setError(err.message || 'Failed to load wave details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setModalError(null);
    try {
      const whId = createFormData.warehouse_id || warehouses[0]?.id;
      const delivs = await api.getDeliveries({ status: 'draft' });
      const filtered = delivs.filter(d => !whId || d.source_warehouse_id === parseInt(whId, 10));
      setEligibleDeliveries(filtered);
    } catch (err) {
      setModalError('Failed to load eligible pending deliveries.');
    }
  };

  const handleWarehouseChangeInModal = async (whId) => {
    setCreateFormData(prev => ({ ...prev, warehouse_id: whId, selected_delivery_ids: [] }));
    try {
      const delivs = await api.getDeliveries({ status: 'draft' });
      const filtered = delivs.filter(d => d.source_warehouse_id === parseInt(whId, 10));
      setEligibleDeliveries(filtered);
    } catch (err) {
      setModalError('Failed to load eligible deliveries for selected warehouse.');
    }
  };

  const handleCreateWave = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    try {
      const payload = {
        warehouse_id: parseInt(createFormData.warehouse_id, 10),
        notes: createFormData.notes || null,
        delivery_ids: createFormData.selected_delivery_ids
      };
      const res = await api.createWave(payload);
      setSuccessMsg(`Pick wave ${res.wave_number} created successfully.`);
      setShowCreateModal(false);
      setCreateFormData(prev => ({ ...prev, notes: '', selected_delivery_ids: [] }));
      fetchData();
      loadWaveDetail(res.id);
    } catch (err) {
      setModalError(err.message || 'Failed to create wave.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleWaveAction = async (action, waveId) => {
    setError(null);
    try {
      let res;
      if (action === 'release') res = await api.releaseWave(waveId);
      if (action === 'start') res = await api.startWave(waveId);
      if (action === 'complete') res = await api.completeWave(waveId);
      if (action === 'cancel') res = await api.cancelWave(waveId);

      setSuccessMsg(res.message || `Wave ${action}d successfully.`);
      fetchData();
      loadWaveDetail(waveId);
    } catch (err) {
      setError(err.message || `Failed to ${action} wave.`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">Draft</span>;
      case 'released':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold uppercase">Released</span>;
      case 'picking':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase animate-pulse">Picking</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Warehouse Multi-Location Pick Waves
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Group pending customer deliveries into executable picking waves organized by warehouse bin location and FEFO sequence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Waves"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Pick Wave
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Warehouse:</span>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600"
          >
            <option value="">All Facilities</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-slate-300 rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-600"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="released">Released</option>
            <option value="picking">Picking</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Content Layout: Wave List & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Wave List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Active & Recent Waves ({waves.length})
          </h2>

          {loading && waves.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              Loading waves...
            </div>
          ) : waves.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
              No pick waves found. Click <strong>Create Pick Wave</strong> to group pending orders.
            </div>
          ) : (
            <div className="space-y-2">
              {waves.map((w) => {
                const isSelected = activeWaveId === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => loadWaveDetail(w.id)}
                    className={`p-3.5 bg-white rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 ring-1 ring-blue-600 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-blue-900">{w.wave_number}</span>
                      {getStatusBadge(w.status)}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{w.warehouse_name}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span><strong>{w.delivery_count}</strong> orders &bull; <strong>{parseFloat(w.total_requested_qty)}</strong> units</span>
                      <span className="font-mono text-[10px] text-slate-400">{new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Wave Detail & Location-Grouped Pick Path */}
        <div className="lg:col-span-2">
          {!activeWave ? (
            <div className="bg-white rounded-lg border border-dashed border-slate-300 p-12 text-center text-slate-400">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs">Select a pick wave from the list to inspect location pick path and progress.</p>
            </div>
          ) : detailLoading ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading wave details...
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden space-y-6 p-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono text-slate-900">{activeWave.wave_number}</h2>
                    {getStatusBadge(activeWave.status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Facility: <strong className="text-slate-800">{activeWave.warehouse_name}</strong> &bull; Created by {activeWave.created_by_name || 'Staff'}
                  </p>
                </div>

                {/* State Machine Action Controls */}
                <div className="flex items-center gap-2">
                  {activeWave.status === 'draft' && (
                    <button
                      onClick={() => handleWaveAction('release', activeWave.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Release Wave
                    </button>
                  )}

                  {activeWave.status === 'released' && (
                    <button
                      onClick={() => handleWaveAction('start', activeWave.id)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Picking
                    </button>
                  )}

                  {(activeWave.status === 'picking' || activeWave.status === 'released') && (
                    <button
                      onClick={() => handleWaveAction('complete', activeWave.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Complete & Pick
                    </button>
                  )}

                  {activeWave.status !== 'completed' && activeWave.status !== 'cancelled' && isManager && (
                    <button
                      onClick={() => handleWaveAction('cancel', activeWave.id)}
                      className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-rose-600 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <Ban className="w-3 h-3" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Wave Picking Progress:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {activeWave.progress?.done_qty} / {activeWave.progress?.total_qty} units ({activeWave.progress?.percent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${activeWave.progress?.percent || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Assigned Orders List */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned Deliveries ({activeWave.deliveries?.length || 0})
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                      <tr>
                        <th className="py-2 px-3">Order Ref</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3 text-right">Items / Qty</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeWave.deliveries?.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-blue-700">{d.reference}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{d.customer_name}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">{d.line_count} lines &bull; {parseFloat(d.total_qty)} units</td>
                          <td className="py-2 px-3 text-center">{getStatusBadge(d.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Location-Grouped Pick List (Operator Path Optimization) */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Optimized Warehouse Pick Sequence (By Bin Location)
                </h3>
                <div className="space-y-3">
                  {activeWave.location_picks?.map((locGroup, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-emerald-700">{locGroup.location_code}</span>
                          <span className="text-slate-500 font-normal">({locGroup.location_name})</span>
                        </div>
                        {locGroup.location_barcode && (
                          <span className="font-mono text-[10px] text-slate-400">Barcode: {locGroup.location_barcode}</span>
                        )}
                      </div>

                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] uppercase">
                          <tr>
                            <th className="py-1.5 px-3">Product</th>
                            <th className="py-1.5 px-3">Order</th>
                            <th className="py-1.5 px-3 text-right">Pick Qty</th>
                            <th className="py-1.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {locGroup.items.map(item => (
                            <tr key={item.line_id} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900">{item.product_name}</div>
                                <div className="font-mono text-[10px] text-slate-400">{item.sku}</div>
                                {item.lot_allocations && item.lot_allocations.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.lot_allocations.map((lot, lIdx) => (
                                      <span key={lIdx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200">
                                        Lot {lot.lot_number} {lot.expiry_date ? `(Exp: ${new Date(lot.expiry_date).toISOString().slice(0, 10)})` : ''}: {lot.quantity !== undefined ? lot.quantity : lot.available_qty} units
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600">{item.delivery_reference}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{parseFloat(item.requested_qty)} {item.uom_name}</td>
                              <td className="py-2 px-3 text-center">{getStatusBadge(item.delivery_status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Wave Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Create New Pick Wave</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Facility *</label>
                <select
                  required
                  value={createFormData.warehouse_id}
                  onChange={(e) => handleWarehouseChangeInModal(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Operational Instructions</label>
                <input
                  type="text"
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  placeholder="e.g. Zone A Priority Deliveries"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Eligible Pending Deliveries ({eligibleDeliveries.length} available)
                </label>
                {eligibleDeliveries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-4 bg-slate-50 border rounded text-center">
                    No draft/pending delivery orders found in this warehouse. Create a delivery order first.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {eligibleDeliveries.map(d => {
                      const isChecked = createFormData.selected_delivery_ids.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCreateFormData(prev => ({
                                ...prev,
                                selected_delivery_ids: checked
                                  ? [...prev.selected_delivery_ids, d.id]
                                  : prev.selected_delivery_ids.filter(id => id !== d.id)
                              }));
                            }}
                            className="rounded text-blue-600"
                          />
                          <div className="flex-1">
                            <span className="font-mono font-bold text-blue-700">{d.reference}</span>
                            <span className="text-slate-600 ml-2 font-medium">{d.customer_name}</span>
                          </div>
                          <span className="font-mono text-slate-500 text-[11px]">{d.line_count} lines &bull; {parseFloat(d.total_requested_qty)} units</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Creating...' : 'Create Pick Wave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
