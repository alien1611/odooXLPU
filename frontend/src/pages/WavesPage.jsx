import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Layers,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Play,
  CheckCheck,
  Ban,
  MapPin,
  ArrowRight,
  Building2
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

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
        return <Badge variant="neutral">Draft</Badge>;
      case 'released':
        return <Badge variant="neutral">Released</Badge>;
      case 'picking':
        return <Badge variant="amber">Picking</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Warehouse Multi-Location Pick Waves"
        subtitle="Group pending customer deliveries into executable picking waves organized by warehouse bin location and FEFO sequence."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              title="Refresh Waves"
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              icon={Plus}
            >
              Create Pick Wave
            </Button>
          </div>
        }
      />

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 text-rose-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <FlatCard className="p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              options={[
                { value: '', label: 'All Facilities' },
                ...warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.code})` }))
              ]}
            />
          </div>

          <div className="w-48">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'released', label: 'Released' },
                { value: 'picking', label: 'Picking' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
            />
          </div>
        </div>
      </FlatCard>

      {/* Main Content Layout: Wave List & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Wave List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Active & Recent Waves ({waves.length})
          </h2>

          {loading && waves.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 bg-white rounded-2xl border border-black/[0.06]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
              Loading waves...
            </div>
          ) : waves.length === 0 ? (
            <FlatCard className="p-8 text-center">
              <EmptyState
                icon={Layers}
                title="No pick waves"
                description="Click Create Pick Wave to group pending orders."
              />
            </FlatCard>
          ) : (
            <div className="space-y-2.5">
              {waves.map((w) => {
                const isSelected = activeWaveId === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => loadWaveDetail(w.id)}
                    className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-black/[0.06] hover:border-black/[0.12]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-xs text-neutral-900">{w.wave_number}</span>
                      {getStatusBadge(w.status)}
                    </div>
                    <div className="mt-1.5 text-xs text-neutral-600 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{w.warehouse_name}</span>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-black/[0.04] flex items-center justify-between text-[11px] text-neutral-500">
                      <span><strong>{w.delivery_count}</strong> orders &bull; <strong>{parseFloat(w.total_requested_qty)}</strong> units</span>
                      <span className="font-mono text-neutral-400">{new Date(w.created_at).toLocaleDateString()}</span>
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
            <FlatCard className="p-12 text-center text-neutral-400">
              <Layers className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
              <p className="text-xs">Select a pick wave from the list to inspect location pick path and progress.</p>
            </FlatCard>
          ) : detailLoading ? (
            <FlatCard className="p-12 text-center text-neutral-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
              Loading wave details...
            </FlatCard>
          ) : (
            <FlatCard className="p-6 space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-black/[0.06] gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold font-mono text-neutral-900">{activeWave.wave_number}</h2>
                    {getStatusBadge(activeWave.status)}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Facility: <strong className="text-neutral-800">{activeWave.warehouse_name}</strong> &bull; Created by {activeWave.created_by_name || 'Staff'}
                  </p>
                </div>

                {/* State Machine Action Controls */}
                <div className="flex items-center gap-2">
                  {activeWave.status === 'draft' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleWaveAction('release', activeWave.id)}
                      icon={ArrowRight}
                    >
                      Release Wave
                    </Button>
                  )}

                  {activeWave.status === 'released' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleWaveAction('start', activeWave.id)}
                      icon={Play}
                    >
                      Start Picking
                    </Button>
                  )}

                  {(activeWave.status === 'picking' || activeWave.status === 'released') && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleWaveAction('complete', activeWave.id)}
                      icon={CheckCheck}
                    >
                      Complete & Pick
                    </Button>
                  )}

                  {activeWave.status !== 'completed' && activeWave.status !== 'cancelled' && isManager && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleWaveAction('cancel', activeWave.id)}
                      icon={Ban}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-neutral-50/70 p-4 rounded-xl border border-black/[0.04] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-700">Wave Picking Progress:</span>
                  <span className="font-mono font-semibold text-amber-600">
                    {activeWave.progress?.done_qty} / {activeWave.progress?.total_qty} units ({activeWave.progress?.percent}%)
                  </span>
                </div>
                <div className="w-full bg-black/[0.06] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${activeWave.progress?.percent || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Assigned Orders List */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2.5">
                  Assigned Deliveries ({activeWave.deliveries?.length || 0})
                </h3>
                <div className="border border-black/[0.06] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50/80 border-b border-black/[0.04] text-neutral-500 text-[10px] font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">Items / Qty</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {activeWave.deliveries?.map(d => (
                        <tr key={d.id} className="hover:bg-neutral-50/50">
                          <td className="py-2.5 px-3 font-mono font-semibold text-amber-600">{d.reference}</td>
                          <td className="py-2.5 px-3 font-medium text-neutral-900">{d.customer_name}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-700">{d.line_count} lines &bull; {parseFloat(d.total_qty)} units</td>
                          <td className="py-2.5 px-3 text-center">{getStatusBadge(d.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Location-Grouped Pick List (Operator Path Optimization) */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  Optimized Warehouse Pick Sequence (By Bin Location)
                </h3>
                <div className="space-y-3">
                  {activeWave.location_picks?.map((locGroup, idx) => (
                    <div key={idx} className="border border-black/[0.06] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 bg-neutral-50 border-b border-black/[0.04] flex items-center justify-between text-xs font-semibold text-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-amber-600">{locGroup.location_code}</span>
                          <span className="text-neutral-500 font-normal">({locGroup.location_name})</span>
                        </div>
                        {locGroup.location_barcode && (
                          <span className="font-mono text-[10px] text-neutral-400">Barcode: {locGroup.location_barcode}</span>
                        )}
                      </div>

                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50/40 border-b border-black/[0.04] text-neutral-400 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-3">Order</th>
                            <th className="py-2 px-3 text-right">Pick Qty</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04]">
                          {locGroup.items.map(item => (
                            <tr key={item.line_id} className="hover:bg-neutral-50/50">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-neutral-900">{item.product_name}</div>
                                <div className="font-mono text-[10px] text-neutral-400 mt-0.5">{item.sku}</div>
                                {item.lot_allocations && item.lot_allocations.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.lot_allocations.map((lot, lIdx) => (
                                      <span key={lIdx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                                        Lot {lot.lot_number} {lot.expiry_date ? `(Exp: ${new Date(lot.expiry_date).toISOString().slice(0, 10)})` : ''}: {lot.quantity !== undefined ? lot.quantity : lot.available_qty} units
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-neutral-600">{item.delivery_reference}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900">{parseFloat(item.requested_qty)} {item.uom_name}</td>
                              <td className="py-2.5 px-3 text-center">{getStatusBadge(item.delivery_status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </FlatCard>
          )}
        </div>
      </div>

      {/* Create Wave Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Pick Wave"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateWave} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}

          <Select
            label="Warehouse Facility *"
            required
            value={createFormData.warehouse_id}
            onChange={(e) => handleWarehouseChangeInModal(e.target.value)}
            options={warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.code})` }))}
          />

          <Input
            label="Notes / Operational Instructions"
            type="text"
            value={createFormData.notes}
            onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
            placeholder="e.g. Zone A Priority Deliveries"
          />

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Select Eligible Pending Deliveries ({eligibleDeliveries.length} available)
            </label>
            {eligibleDeliveries.length === 0 ? (
              <p className="text-xs text-neutral-400 italic p-4 bg-neutral-50 border border-black/[0.06] rounded-xl text-center">
                No draft/pending delivery orders found in this warehouse. Create a delivery order first.
              </p>
            ) : (
              <div className="border border-black/[0.06] rounded-xl max-h-48 overflow-y-auto divide-y divide-black/[0.04] text-xs">
                {eligibleDeliveries.map(d => {
                  const isChecked = createFormData.selected_delivery_ids.includes(d.id);
                  return (
                    <label key={d.id} className="flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer">
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
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <span className="font-mono font-semibold text-amber-600">{d.reference}</span>
                        <span className="text-neutral-700 ml-2 font-medium">{d.customer_name}</span>
                      </div>
                      <span className="font-mono text-neutral-400 text-[11px]">{d.line_count} lines &bull; {parseFloat(d.total_requested_qty)} units</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={modalLoading}
            >
              {modalLoading ? 'Creating...' : 'Create Pick Wave'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
