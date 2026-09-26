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
  Package
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';

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
        return <Badge variant="amber">Active Opportunity</Badge>;
      case 'acknowledged':
        return <Badge variant="success">Acknowledged</Badge>;
      case 'dismissed':
        return <Badge variant="neutral">Dismissed</Badge>;
      default:
        return null;
    }
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const totalSuggestedQty = activeAlerts.reduce((sum, a) => sum + parseFloat(a.suggested_cross_dock_qty || 0), 0);
  const totalPendingDemand = activeAlerts.reduce((sum, a) => sum + parseFloat(a.pending_demand_qty || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Cross-Docking Intelligence & Demand Routing"
        subtitle="Identify incoming stock that can immediately fulfill outstanding customer delivery backorders without intermediate putaway delay."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              title="Refresh Alerts"
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleScan}
              disabled={scanning}
              icon={RefreshCw}
              className={scanning ? 'animate-spin' : ''}
            >
              Scan Opportunities
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
          <span className="text-xs font-medium text-amber-600 uppercase tracking-wider block">Active Alerts</span>
          <span className="text-2xl font-semibold tracking-tight text-neutral-900 font-mono mt-1 block">{activeAlerts.length}</span>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Direct dispatch matches</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider block">Suggested Cross-Dock Qty</span>
          <span className="text-2xl font-semibold tracking-tight text-emerald-700 font-mono mt-1 block">{totalSuggestedQty}</span>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Units ready to stage</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wider block">Total Pending Demand</span>
          <span className="text-2xl font-semibold tracking-tight text-amber-700 font-mono mt-1 block">{totalPendingDemand}</span>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Requested by open deliveries</span>
        </FlatCard>

        <FlatCard className="p-4">
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">Total Monitored Alerts</span>
          <span className="text-2xl font-semibold tracking-tight text-neutral-900 font-mono mt-1 block">{alerts.length}</span>
          <span className="text-[11px] text-neutral-400 mt-0.5 block">Historical & active alerts</span>
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
                { value: 'active', label: 'Active' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'dismissed', label: 'Dismissed' }
              ]}
            />
          </div>
        </div>
      </FlatCard>

      {/* Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-3">Alert Ref</th>
                <th className="py-3 px-3">Product / SKU</th>
                <th className="py-3 px-3">Inbound Receipt & Lot</th>
                <th className="py-3 px-3 text-right">Received Qty</th>
                <th className="py-3 px-3">Pending Customer Order</th>
                <th className="py-3 px-3 text-right">Cross-Dock Match</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && alerts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading cross-docking alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <EmptyState
                      icon={Truck}
                      title="No cross-dock opportunities"
                      description="Inbound inventory has no pending customer order conflicts."
                    />
                  </td>
                </tr>
              ) : (
                alerts.map(a => {
                  const isActive = a.status === 'active';
                  const isAck = a.status === 'acknowledged';

                  return (
                    <tr key={a.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-neutral-900">
                        {a.alert_number}
                        <div className="text-[11px] text-neutral-400 font-normal mt-0.5">{new Date(a.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-neutral-900">{a.product_name}</div>
                        <div className="font-mono text-[11px] text-neutral-400 mt-0.5">{a.product_sku}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs font-semibold text-amber-600">{a.receipt_reference}</div>
                        {a.lot_number && (
                          <div className="text-[11px] text-neutral-500 font-mono mt-0.5">Lot: {a.lot_number} ({a.expiry_date ? a.expiry_date.substring(0, 10) : 'No Exp'})</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-900">
                        {parseFloat(a.received_qty)} {a.uom_name}
                      </td>
                      <td className="py-3 px-3">
                        {a.pending_delivery_reference ? (
                          <div>
                            <span className="font-mono font-semibold text-neutral-900">{a.pending_delivery_reference}</span>
                            <span className="text-[11px] text-neutral-400 block truncate mt-0.5">{a.pending_delivery_customer} (Req: {parseFloat(a.pending_demand_qty)})</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">General Demand: {parseFloat(a.pending_demand_qty)} units</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-neutral-900 text-sm">
                        {parseFloat(a.suggested_cross_dock_qty)} {a.uom_name}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {getStatusBadge(a.status)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isActive && (
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleAcknowledge(a.id)}
                              icon={Check}
                            >
                              Acknowledge
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(a.id)}
                              icon={X}
                            />
                          </div>
                        )}
                        {isAck && (
                          <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                            Acknowledged
                          </span>
                        )}
                        {a.status === 'dismissed' && (
                          <span className="font-mono text-[11px] text-neutral-400">
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
      </FlatCard>
    </div>
  );
}
