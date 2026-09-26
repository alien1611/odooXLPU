import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Boxes,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  Settings
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

export default function ReplenishmentPage() {
  const { user, isManager } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [executingId, setExecutingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [configFormData, setConfigFormData] = useState({
    warehouse_id: '',
    location_id: '',
    product_id: '',
    min_qty: '10',
    max_qty: '50'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, configsData, whsData, locsData, prodsData] = await Promise.all([
        api.getReplenishments({
          warehouse_id: selectedWarehouse || null,
          status: selectedStatus || null
        }),
        api.getReplenishmentConfigs({ warehouse_id: selectedWarehouse || null }),
        api.getWarehouses(),
        api.getLocations(),
        api.getProducts()
      ]);
      setTasks(tasksData);
      setConfigs(configsData);
      setWarehouses(whsData);
      setLocations(locsData);
      setProducts(prodsData);

      if (!configFormData.warehouse_id && whsData.length > 0) {
        setConfigFormData(prev => ({
          ...prev,
          warehouse_id: whsData[0].id,
          location_id: locsData[0]?.id || '',
          product_id: prodsData[0]?.id || ''
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load replenishment tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, selectedStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateReplenishments({
        warehouse_id: selectedWarehouse || null
      });
      setSuccessMsg(res.message || 'Replenishment scan completed.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to scan and generate replenishments.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExecute = async (task) => {
    setExecutingId(task.id);
    setError(null);
    try {
      const res = await api.executeReplenishment(task.id, {});
      setSuccessMsg(res.message || `Replenishment ${task.task_number} executed successfully.`);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to execute replenishment transfer.');
    } finally {
      setExecutingId(null);
    }
  };

  const handleDismiss = async (taskId) => {
    setError(null);
    try {
      const res = await api.dismissReplenishment(taskId);
      setSuccessMsg(res.message || 'Replenishment task dismissed.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to dismiss task.');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setConfigLoading(true);
    setConfigError(null);
    try {
      await api.setReplenishmentConfig({
        warehouse_id: parseInt(configFormData.warehouse_id, 10),
        location_id: parseInt(configFormData.location_id, 10),
        product_id: parseInt(configFormData.product_id, 10),
        min_qty: parseFloat(configFormData.min_qty),
        max_qty: parseFloat(configFormData.max_qty)
      });
      setSuccessMsg('Forward pick bin threshold configured successfully.');
      setShowConfigModal(false);
      fetchData();
    } catch (err) {
      setConfigError(err.message || 'Failed to save configuration.');
    } finally {
      setConfigLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ready':
        return <Badge variant="success">Ready to Transfer</Badge>;
      case 'suggested':
        return <Badge variant="neutral">Suggested</Badge>;
      case 'partially_fulfillable':
        return <Badge variant="amber">Partial Reserve</Badge>;
      case 'executed':
        return <Badge variant="neutral">Executed</Badge>;
      case 'dismissed':
        return <Badge variant="danger">Dismissed</Badge>;
      default:
        return null;
    }
  };

  const readyCount = tasks.filter(t => t.status === 'ready').length;
  const partialCount = tasks.filter(t => t.status === 'partially_fulfillable').length;
  const activeCount = tasks.filter(t => ['ready', 'suggested', 'partially_fulfillable'].includes(t.status)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Forward Pick Bin Replenishment"
        subtitle="Automated reserve-to-forward storage replenishment. Detect bins below configured safety thresholds and execute transfers."
        actions={
          <div className="flex items-center gap-2.5">
            {isManager && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConfigModal(true)}
                icon={Settings}
              >
                Configure Forward Bin
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              icon={RefreshCw}
              className={generating ? 'animate-spin' : ''}
            >
              Scan & Generate Tasks
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <FlatCard className="p-4">
          <span className="text-xs font-medium text-neutral-500 block">Active Tasks</span>
          <span className="text-2xl font-semibold tracking-tight text-neutral-900 font-mono mt-1 block">{activeCount}</span>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Bins needing stock</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-emerald-700 block">Ready for Transfer</span>
          <span className="text-2xl font-semibold tracking-tight text-emerald-700 font-mono mt-1 block">{readyCount}</span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Reserve stock available</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-amber-600 block">Partial / Low Reserve</span>
          <span className="text-2xl font-semibold tracking-tight text-amber-600 font-mono mt-1 block">{partialCount}</span>
          <span className="text-[11px] text-amber-500 mt-0.5 block">Limited reserve quantity</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-neutral-500 block">Configured Bins</span>
          <span className="text-2xl font-semibold tracking-tight text-neutral-900 font-mono mt-1 block">{configs.length}</span>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Forward pick thresholds</span>
        </FlatCard>
      </div>

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
                { value: 'ready', label: 'Ready to Transfer' },
                { value: 'suggested', label: 'Suggested' },
                { value: 'partially_fulfillable', label: 'Partial Reserve' },
                { value: 'executed', label: 'Executed' },
                { value: 'dismissed', label: 'Dismissed' }
              ]}
            />
          </div>
        </div>
      </FlatCard>

      {/* Replenishment Tasks Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-3">Task Number</th>
                <th className="py-3 px-3">Forward Bin (Dest)</th>
                <th className="py-3 px-3">Product / SKU</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-center">Min / Max</th>
                <th className="py-3 px-3 text-right">Transfer Qty</th>
                <th className="py-3 px-3">Reserve Source</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading replenishment tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <EmptyState
                      icon={Boxes}
                      title="No replenishment tasks"
                      description="Forward bins are currently above their configured minimum thresholds."
                    />
                  </td>
                </tr>
              ) : (
                tasks.map(t => {
                  const isReady = t.status === 'ready';
                  const isPartial = t.status === 'partially_fulfillable';
                  const isExecuted = t.status === 'executed';
                  const isDismissed = t.status === 'dismissed';

                  return (
                    <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-neutral-900">
                        {t.task_number}
                        {t.transfer_reference && (
                          <div className="text-[11px] text-amber-600 font-normal">Trf: {t.transfer_reference}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-semibold text-amber-600">{t.destination_location_code}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{t.destination_location_name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-neutral-900">{t.product_name}</div>
                        <div className="font-mono text-[11px] text-neutral-400 mt-0.5">{t.product_sku}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600">
                        {parseFloat(t.current_forward_qty)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-neutral-500 text-xs">
                        {parseFloat(t.threshold_qty)} &rarr; {parseFloat(t.target_qty)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-900 text-sm">
                        +{parseFloat(t.suggested_qty)} {t.uom_name}
                      </td>
                      <td className="py-3 px-3">
                        {t.source_location_code ? (
                          <div>
                            <span className="font-mono text-xs font-semibold text-neutral-800">{t.source_location_code}</span>
                            <span className="text-[11px] text-neutral-400 block mt-0.5">Avail: {parseFloat(t.available_reserve_qty)} {t.uom_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-600 italic">No reserve stock</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {!isExecuted && !isDismissed && (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={executingId === t.id || (!isReady && !isPartial)}
                              onClick={() => handleExecute(t)}
                              icon={executingId === t.id ? RefreshCw : Check}
                              className={executingId === t.id ? 'animate-spin' : ''}
                            >
                              Execute
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(t.id)}
                              title="Dismiss suggestion"
                              icon={X}
                            />
                          </div>
                        )}
                        {isExecuted && (
                          <span className="font-mono text-[11px] text-neutral-400">
                            Executed {new Date(t.executed_at).toLocaleDateString()}
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
      </FlatCard>

      {/* Configure Forward Bin Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configure Forward Pick Bin Threshold"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          {configError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{configError}</span>
            </div>
          )}

          <Select
            label="Warehouse *"
            required
            value={configFormData.warehouse_id}
            onChange={(e) => setConfigFormData({ ...configFormData, warehouse_id: e.target.value })}
            options={warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.code})` }))}
          />

          <Select
            label="Forward Pick Location *"
            required
            value={configFormData.location_id}
            onChange={(e) => setConfigFormData({ ...configFormData, location_id: e.target.value })}
            options={locations
              .filter(l => !configFormData.warehouse_id || l.warehouse_id === parseInt(configFormData.warehouse_id, 10))
              .map(l => ({ value: l.id, label: `${l.code} - ${l.name} (${l.location_role || 'general'})` }))}
          />

          <Select
            label="Product *"
            required
            value={configFormData.product_id}
            onChange={(e) => setConfigFormData({ ...configFormData, product_id: e.target.value })}
            options={products.map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min Threshold (Trigger) *"
              type="number"
              step="any"
              min="0"
              required
              value={configFormData.min_qty}
              onChange={(e) => setConfigFormData({ ...configFormData, min_qty: e.target.value })}
              className="font-mono"
            />
            <Input
              label="Max Target Level *"
              type="number"
              step="any"
              min="0.1"
              required
              value={configFormData.max_qty}
              onChange={(e) => setConfigFormData({ ...configFormData, max_qty: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="pt-4 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowConfigModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={configLoading}
            >
              {configLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
