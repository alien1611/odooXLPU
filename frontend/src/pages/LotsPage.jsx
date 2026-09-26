import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Printer,
  Barcode,
  Package
} from 'lucide-react';
import BarcodeLabelModal from '../components/common/PrintableBarcodeLabel';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [summary, setSummary] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [labelModal, setLabelModal] = useState({ isOpen: false, lot: null });

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="FEFO Lot Expiry Risk Analytics"
        subtitle="Active batch tracking and First-Expiry-First-Out management. Real-time surveillance of products nearing shelf-life expiration."
        actions={
          <Badge variant="amber" icon={Clock}>
            FEFO Priority Dispatch Enabled
          </Badge>
        }
      />

      {/* KPI Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FlatCard className="p-4">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Expired Batches (Immediate Action)</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-rose-600 font-mono">
              {summary.expired_count} <span className="text-xs text-neutral-400 font-normal">lots ({summary.expired_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">Past shelf life &bull; Quarantined / scrap</div>
          </FlatCard>

          <FlatCard className="p-4">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Expiring Within 7 Days</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-amber-600 font-mono">
              {summary.within_7_days_count} <span className="text-xs text-neutral-400 font-normal">lots ({summary.within_7_days_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">Critical FEFO dispatch priority</div>
          </FlatCard>

          <FlatCard className="p-4">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Expiring Within 30 Days</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
              {summary.within_30_days_count} <span className="text-xs text-neutral-400 font-normal">lots ({summary.within_30_days_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">Near-term dispatch queue</div>
          </FlatCard>

          <FlatCard className="p-4">
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-medium">Safe Stock (&gt;90 Days)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900 font-mono">
              {summary.safe_count} <span className="text-xs text-neutral-400 font-normal">lots ({summary.safe_qty} units)</span>
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">Stable inventory balance</div>
          </FlatCard>
        </div>
      )}

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

      {/* Risk Filter Tabs and Search Bar */}
      <FlatCard className="p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Risk Window Tabs */}
          <div className="flex items-center gap-1 bg-black/[0.04] p-1 rounded-full overflow-x-auto">
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
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                  riskWindow === tab.id
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
                placeholder="Search lot, product, or bin..."
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
              title="Refresh Lots"
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
            />
          </div>
        </div>
      </FlatCard>

      {/* Lots Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Lot / Batch Number</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Product Name & SKU</th>
                <th className="py-3 px-4">Storage Location</th>
                <th className="py-3 px-4 text-right">Available Qty</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Days Remaining</th>
                <th className="py-3 px-4">FEFO Risk Classification</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && lots.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading active batch expiry records...
                  </td>
                </tr>
              ) : filteredLots.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No active batches found"
                      description="No lots matching the selected expiry risk criteria."
                    />
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
                    <tr key={`${l.lot_id}-${l.location_id}`} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                        {l.lot_number}
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-neutral-500">
                        {l.barcode ? (
                          <div className="flex items-center gap-1.5 text-neutral-700">
                            <Barcode className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{l.barcode}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-mono text-[11px]">{l.lot_number}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-900">{l.product_name}</div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{l.sku} &bull; {l.uom_code}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-800">{l.location_name}</div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">{l.warehouse_name} &bull; {l.location_code}</div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                        {parseFloat(l.quantity).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 font-mono text-neutral-700">
                        {new Date(l.expiry_date).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge variant={isExpired ? 'danger' : is7Days ? 'danger' : is30Days ? 'amber' : 'neutral'}>
                          {isExpired ? `${Math.abs(days)}d ago` : `${days}d`}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        {isExpired && (
                          <Badge variant="danger" icon={AlertCircle}>EXPIRED</Badge>
                        )}
                        {is7Days && (
                          <Badge variant="danger" icon={AlertTriangle}>URGENT (≤7d)</Badge>
                        )}
                        {is30Days && (
                          <Badge variant="amber" icon={Clock}>High Risk (≤30d)</Badge>
                        )}
                        {is60Days && (
                          <Badge variant="amber">Medium Risk (≤60d)</Badge>
                        )}
                        {is90Days && (
                          <Badge variant="neutral">Low Risk (≤90d)</Badge>
                        )}
                        {isSafe && (
                          <Badge variant="success" icon={CheckCircle2}>Safe (&gt;90d)</Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLabelModal({ isOpen: true, lot: l })}
                          icon={Printer}
                        >
                          Lot Label
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>

      {/* Printable Barcode Label Modal */}
      <BarcodeLabelModal
        isOpen={labelModal.isOpen}
        onClose={() => setLabelModal({ isOpen: false, lot: null })}
        entityType="lot"
        barcode={labelModal.lot?.barcode || labelModal.lot?.lot_number}
        title={`Lot: ${labelModal.lot?.lot_number}`}
        subtitle={`${labelModal.lot?.product_name} (${labelModal.lot?.sku})`}
        details={[
          { label: 'Expiry Date', value: labelModal.lot?.expiry_date ? labelModal.lot.expiry_date.substring(0, 10) : 'None' },
          { label: 'Location', value: labelModal.lot?.location_name || labelModal.lot?.location_code },
          { label: 'Quantity', value: `${parseFloat(labelModal.lot?.quantity || 0)}` }
        ]}
      />
    </div>
  );
}
