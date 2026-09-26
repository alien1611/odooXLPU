import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Boxes,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowRight,
  MapPin,
  Package,
  Layers,
  SlidersHorizontal,
  Check,
  Ban,
  Clock,
  Settings,
  ArrowDownToLine
} from 'lucide-react';

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
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase">Ready to Transfer</span>;
      case 'suggested':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold uppercase">Suggested</span>;
      case 'partially_fulfillable':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase">Partial Reserve</span>;
      case 'executed':
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">Executed</span>;
      case 'dismissed':
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase">Dismissed</span>;
      default:
        return null;
    }
  };

  const readyCount = tasks.filter(t => t.status === 'ready').length;
  const partialCount = tasks.filter(t => t.status === 'partially_fulfillable').length;
  const activeCount = tasks.filter(t => ['ready', 'suggested', 'partially_fulfillable'].includes(t.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            Forward Pick Bin Replenishment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated reserve-to-forward storage replenishment. Detect bins below configured safety thresholds and execute transfers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              Configure Forward Bin
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            Scan & Generate Tasks
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Active Tasks</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{activeCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Bins needing stock</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Ready for Transfer</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">{readyCount}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Reserve stock available</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Partial / Low Reserve</span>
          <span className="text-2xl font-bold font-mono text-amber-700 mt-1 block">{partialCount}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Limited reserve quantity</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Configured Bins</span>
          <span className="text-2xl font-bold font-mono text-blue-700 mt-1 block">{configs.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Forward pick thresholds</span>
        </div>
      </div>

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
            <option value="ready">Ready to Transfer</option>
            <option value="suggested">Suggested</option>
            <option value="partially_fulfillable">Partial Reserve</option>
            <option value="executed">Executed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Replenishment Tasks Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Task Number</th>
                <th className="py-2.5 px-3">Forward Bin (Dest)</th>
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-right">Current Stock</th>
                <th className="py-2.5 px-3 text-center">Min / Max</th>
                <th className="py-2.5 px-3 text-right">Transfer Qty</th>
                <th className="py-2.5 px-3">Reserve Source</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading replenishment tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400 italic">
                    No replenishment requirements found. Forward bins are currently above their configured minimum thresholds.
                  </td>
                </tr>
              ) : (
                tasks.map(t => {
                  const isReady = t.status === 'ready';
                  const isPartial = t.status === 'partially_fulfillable';
                  const isExecuted = t.status === 'executed';
                  const isDismissed = t.status === 'dismissed';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {t.task_number}
                        {t.transfer_reference && (
                          <div className="text-[10px] text-blue-600 font-normal">Trf: {t.transfer_reference}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-emerald-700">{t.destination_location_code}</div>
                        <div className="text-[10px] text-slate-400">{t.destination_location_name}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{t.product_name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{t.product_sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                        {parseFloat(t.current_forward_qty)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                        {parseFloat(t.threshold_qty)} &rarr; {parseFloat(t.target_qty)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 text-sm">
                        +{parseFloat(t.suggested_qty)} {t.uom_name}
                      </td>
                      <td className="py-2.5 px-3">
                        {t.source_location_code ? (
                          <div>
                            <span className="font-mono text-xs font-semibold text-slate-800">{t.source_location_code}</span>
                            <span className="text-[10px] text-slate-400 block">Avail: {parseFloat(t.available_reserve_qty)} {t.uom_name}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-rose-600 italic">No reserve stock found</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(t.status)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!isExecuted && !isDismissed && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={executingId === t.id || (!isReady && !isPartial)}
                              onClick={() => handleExecute(t)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              {executingId === t.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Execute</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(t.id)}
                              title="Dismiss suggestion"
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {isExecuted && (
                          <span className="font-mono text-[10px] text-slate-400">
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
      </div>

      {/* Configure Forward Bin Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Configure Forward Pick Bin Threshold</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              {configError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{configError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse *</label>
                <select
                  required
                  value={configFormData.warehouse_id}
                  onChange={(e) => setConfigFormData({ ...configFormData, warehouse_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Forward Pick Location *</label>
                <select
                  required
                  value={configFormData.location_id}
                  onChange={(e) => setConfigFormData({ ...configFormData, location_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono"
                >
                  {locations
                    .filter(l => !configFormData.warehouse_id || l.warehouse_id === parseInt(configFormData.warehouse_id, 10))
                    .map(l => (
                      <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.location_role || 'general'})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
                <select
                  required
                  value={configFormData.product_id}
                  onChange={(e) => setConfigFormData({ ...configFormData, product_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Threshold (Trigger) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={configFormData.min_qty}
                    onChange={(e) => setConfigFormData({ ...configFormData, min_qty: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Target Level *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={configFormData.max_qty}
                    onChange={(e) => setConfigFormData({ ...configFormData, max_qty: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={configLoading}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {configLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
