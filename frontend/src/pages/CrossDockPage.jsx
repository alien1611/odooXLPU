import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import {
  Truck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  Building2,
  Calendar,
  Package,
  Layers,
  ShieldCheck,
  ArrowRight,
  Boxes
} from 'lucide-react';

export default function CrossDockPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, whsData] = await Promise.all([
        api.getCrossDockAlerts({
          warehouse_id: selectedWarehouse || null,
          status: selectedStatus || null
        }),
        api.getWarehouses()
      ]);
      setAlerts(alertsData);
      setWarehouses(whsData);
    } catch (err) {
      setError(err.message || 'Failed to load cross-dock alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, selectedStatus]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await api.scanCrossDock({
        warehouse_id: selectedWarehouse || null
      });
      setSuccessMsg(res.message || 'Cross-dock opportunity scan completed.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to scan cross-dock opportunities.');
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async (id) => {
    setError(null);
    try {
      const res = await api.acknowledgeCrossDock(id);
      setSuccessMsg(res.message || 'Cross-dock alert acknowledged.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to acknowledge alert.');
    }
  };

  const handleDismiss = async (id) => {
    setError(null);
    try {
      const res = await api.dismissCrossDock(id);
      setSuccessMsg(res.message || 'Cross-dock alert dismissed.');
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to dismiss alert.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold uppercase animate-pulse">Active Opportunity</span>;
      case 'acknowledged':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase">Acknowledged</span>;
      case 'dismissed':
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">Dismissed</span>;
      default:
        return null;
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const totalSuggestedQty = activeAlerts.reduce((sum, a) => sum + parseFloat(a.suggested_cross_dock_qty || 0), 0);
  const totalPendingDemand = activeAlerts.reduce((sum, a) => sum + parseFloat(a.pending_demand_qty || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Cross-Docking Intelligence & Demand Routing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify incoming stock that can immediately fulfill outstanding customer delivery backorders without intermediate putaway delay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            Scan Opportunities
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
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">Active Alerts</span>
          <span className="text-2xl font-bold font-mono text-indigo-900 mt-1 block">{activeAlerts.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Direct dispatch matches</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Suggested Cross-Dock Qty</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">{totalSuggestedQty}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Units ready to stage</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Total Pending Demand</span>
          <span className="text-2xl font-bold font-mono text-amber-700 mt-1 block">{totalPendingDemand}</span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Requested by open deliveries</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Monitored Alerts</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{alerts.length}</span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Historical & active alerts</span>
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
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Alert Ref</th>
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3">Inbound Receipt & Lot</th>
                <th className="py-2.5 px-3 text-right">Received Qty</th>
                <th className="py-2.5 px-3">Pending Customer Order</th>
                <th className="py-2.5 px-3 text-right">Cross-Dock Match</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && alerts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading cross-docking alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400 italic">
                    No active cross-docking opportunities found. Inbound inventory has no pending customer order conflicts.
                  </td>
                </tr>
              ) : (
                alerts.map(a => {
                  const isActive = a.status === 'active';
                  const isAck = a.status === 'acknowledged';

                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">
                        {a.alert_number}
                        <div className="text-[10px] text-slate-400 font-normal">{new Date(a.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{a.product_name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{a.product_sku}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-xs font-semibold text-blue-700">{a.receipt_reference}</div>
                        {a.lot_number && (
                          <div className="text-[10px] text-amber-700 font-mono">Lot: {a.lot_number} ({a.expiry_date ? a.expiry_date.substring(0, 10) : 'No Exp'})</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {parseFloat(a.received_qty)} {a.uom_name}
                      </td>
                      <td className="py-2.5 px-3">
                        {a.pending_delivery_reference ? (
                          <div>
                            <span className="font-mono font-bold text-indigo-700">{a.pending_delivery_reference}</span>
                            <span className="text-[10px] text-slate-500 block truncate">{a.pending_delivery_customer} (Req: {parseFloat(a.pending_demand_qty)})</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">General Demand: {parseFloat(a.pending_demand_qty)} units</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        {parseFloat(a.suggested_cross_dock_qty)} {a.uom_name}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(a.status)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isActive && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(a.id)}
                              title="Acknowledge match"
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              <span>Acknowledge</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(a.id)}
                              title="Dismiss alert"
                              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {isAck && (
                          <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                            Acknowledged
                          </span>
                        )}
                        {a.status === 'dismissed' && (
                          <span className="font-mono text-[10px] text-slate-400">
                            Dismissed
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
