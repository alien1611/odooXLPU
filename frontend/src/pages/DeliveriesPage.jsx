import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import { 
  ArrowUpFromLine, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Scan,
  Package
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import FlatCard from '../components/ui/FlatCard';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';

export default function DeliveriesPage() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [fefoResult, setFefoResult] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // New Delivery Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [formData, setFormData] = useState({
    customer_name: '',
    source_warehouse_id: '',
    lines: [
      {
        product_id: '',
        requested_qty: '',
        src_location_id: ''
      }
    ]
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dels, whs, prods, locs] = await Promise.all([
        api.getDeliveries(),
        api.getWarehouses(),
        api.getProducts(),
        api.getLocations()
      ]);
      setDeliveries(dels);
      setWarehouses(whs);
      setProducts(prods);
      setLocations(locs);

      if (whs.length > 0 && !formData.source_warehouse_id) {
        setFormData(prev => ({
          ...prev,
          source_warehouse_id: whs[0].id
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLine = () => {
    const defaultLoc = locations.find(l => String(l.warehouse_id) === String(formData.source_warehouse_id)) || locations[0];
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_id: products[0]?.id || '',
          requested_qty: '10',
          src_location_id: defaultLoc?.id || ''
        }
      ]
    }));
  };

  const handleRemoveLine = (index) => {
    if (formData.lines.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData(prev => {
      const nextLines = [...prev.lines];
      nextLines[index] = { ...nextLines[index], [field]: value };
      return { ...prev, lines: nextLines };
    });
  };

  const openModal = () => {
    const defaultWh = warehouses[0]?.id || '';
    const defaultLoc = locations.find(l => String(l.warehouse_id) === String(defaultWh)) || locations[0];
    const defaultProd = products[0]?.id || '';

    setFormData({
      customer_name: '',
      source_warehouse_id: defaultWh,
      lines: [
        {
          product_id: defaultProd,
          requested_qty: '20',
          src_location_id: defaultLoc?.id || ''
        }
      ]
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      if (!formData.customer_name.trim()) {
        throw new Error('Customer name is required.');
      }
      if (!formData.source_warehouse_id) {
        throw new Error('Source warehouse is required.');
      }

      const payload = {
        customer_name: formData.customer_name.trim(),
        source_warehouse_id: parseInt(formData.source_warehouse_id, 10),
        lines: formData.lines.map((l, idx) => {
          if (!l.product_id) throw new Error(`Line ${idx + 1}: Product is required.`);
          if (!l.src_location_id) throw new Error(`Line ${idx + 1}: Source location is required.`);
          const qty = parseFloat(l.requested_qty);
          if (isNaN(qty) || qty <= 0) throw new Error(`Line ${idx + 1}: Requested quantity must be > 0.`);

          return {
            product_id: parseInt(l.product_id, 10),
            src_location_id: parseInt(l.src_location_id, 10),
            requested_qty: qty
          };
        }),
        auto_process: true
      };

      const result = await api.createDelivery(payload);
      setSuccessMsg(`Delivery ${result.reference} validated successfully via automated FEFO engine.`);
      setFefoResult({
        reference: result.reference,
        customer: result.customer_name,
        allocations: result.allocations || []
      });
      setShowModal(false);
      fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to dispatch delivery order.');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredDeliveries = deliveries.filter(d => 
    d.reference?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Outbound Deliveries"
        subtitle="Dispatch customer shipments with strict First-Expiry-First-Out (FEFO) batch consumption and automated cost layer relief."
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/warehouse/scanner">
              <Button variant="secondary" size="sm" icon={Scan}>
                Scanner Mode
              </Button>
            </Link>
            <Button variant="primary" size="sm" onClick={openModal} icon={Plus}>
              New Delivery Order
            </Button>
          </div>
        }
      />

      {/* FEFO Allocation Notification Banner */}
      {fefoResult && (
        <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>FEFO Consumption Breakdown — {fefoResult.reference} ({fefoResult.customer})</span>
            </div>
            <button 
              onClick={() => setFefoResult(null)}
              className="text-amber-500 hover:text-amber-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {fefoResult.allocations.map((a, i) => (
              <div key={i} className="bg-white p-3.5 rounded-xl border border-black/[0.06] text-xs shadow-2xs">
                <div className="font-semibold text-neutral-900">{a.productName || a.sku}</div>
                <div className="text-amber-600 font-mono mt-0.5">Lot: {a.lotNumber}</div>
                <div className="text-neutral-500 flex justify-between mt-2 pt-2 border-t border-black/[0.04]">
                  <span>Consumed: <strong className="text-neutral-900">{a.quantity}</strong></span>
                  <span>Exp: {a.expiryDate ? new Date(a.expiryDate).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && !fefoResult && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
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
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <FlatCard className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by delivery reference, customer, or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh Deliveries"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* Deliveries Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4 w-10 text-center"></th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Source Warehouse</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Requested Qty</th>
                <th className="py-3 px-4 text-right">Fulfilled Qty</th>
                <th className="py-3 px-4">Dispatched Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && deliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading deliveries...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No outbound deliveries found"
                      description="Create a delivery order to dispatch items with automatic FEFO lot allocations."
                      action={
                        <Button variant="primary" size="sm" onClick={openModal} icon={Plus}>
                          New Delivery Order
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => {
                  const isExpanded = expandedId === d.id;
                  return (
                    <React.Fragment key={d.id}>
                      <tr 
                        className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-amber-50/20' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      >
                        <td className="py-3 px-4 text-neutral-400 text-center">
                          {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-amber-600">
                          {d.reference}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-900">
                          {d.customer_name}
                        </td>
                        <td className="py-3 px-4 text-neutral-600">
                          {d.warehouse_name} ({d.warehouse_code})
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={d.status === 'done' ? 'success' : d.status === 'draft' ? 'amber' : 'neutral'}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-neutral-700">
                          {parseFloat(d.total_requested_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                          {parseFloat(d.total_done_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-neutral-500">
                          {new Date(d.created_at).toLocaleDateString()} {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-neutral-50/50">
                          <td colSpan="8" className="py-4 px-8">
                            <div className="p-4 bg-white border border-black/[0.06] rounded-xl text-xs space-y-2 shadow-2xs">
                              <div className="font-semibold text-neutral-800 flex items-center justify-between">
                                <span>Outbound Order Audit:</span>
                                <span className="text-[11px] text-neutral-400 font-mono">Ref: {d.reference}</span>
                              </div>
                              <p className="text-[11px] text-neutral-500">
                                This order automatically consumed available lots based on earliest expiration dates (<strong className="text-neutral-700">FEFO priority</strong>) and relieved historical cost layers in FIFO sequence.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>

      {/* Modal: New Outbound Delivery */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Outbound Delivery Order"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Customer Name *"
              required
              placeholder="e.g. Acme Construction Corp"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            />
            <Select
              label="Source Warehouse *"
              required
              value={formData.source_warehouse_id}
              onChange={(e) => setFormData({ ...formData, source_warehouse_id: e.target.value })}
              options={warehouses.map((wh) => ({
                value: wh.id,
                label: `${wh.name} (${wh.code})`
              }))}
            />
          </div>

          {/* Line Items */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-800">
                Delivery Lines (FEFO Auto-Allocation)
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddLine}
                icon={Plus}
              >
                Add Product
              </Button>
            </div>

            <div className="space-y-3">
              {formData.lines.map((line, idx) => {
                const availableLocs = locations.filter(l => String(l.warehouse_id) === String(formData.source_warehouse_id));

                return (
                  <div key={idx} className="p-3.5 bg-neutral-50/70 border border-black/[0.06] rounded-xl relative space-y-3">
                    {formData.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="absolute top-3 right-3 text-neutral-400 hover:text-rose-600 transition-colors"
                        title="Remove line"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select
                        label="Product *"
                        required
                        value={line.product_id}
                        onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                        options={products.map(p => ({
                          value: p.id,
                          label: `${p.name} (${p.sku}) [On-hand: ${p.on_hand_qty || 0}]`
                        }))}
                      />
                      <Select
                        label="Source Loc *"
                        required
                        value={line.src_location_id}
                        onChange={(e) => handleLineChange(idx, 'src_location_id', e.target.value)}
                        options={(availableLocs.length > 0 ? availableLocs : locations).map(loc => ({
                          value: loc.id,
                          label: `${loc.name} (${loc.code})`
                        }))}
                      />
                    </div>

                    <div>
                      <Input
                        label="Requested Dispatch Quantity *"
                        type="number"
                        step="any"
                        required
                        min="0.0001"
                        placeholder="e.g. 50"
                        value={line.requested_qty}
                        onChange={(e) => handleLineChange(idx, 'requested_qty', e.target.value)}
                        className="font-mono"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Stockyard will automatically consume available stock starting with earliest expiring lots (FEFO).
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-black/[0.06] flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={modalLoading}
              icon={modalLoading ? RefreshCw : ArrowUpFromLine}
              className={modalLoading ? 'animate-spin' : ''}
            >
              {modalLoading ? 'Allocating...' : 'Allocate & Dispatch Stock'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
