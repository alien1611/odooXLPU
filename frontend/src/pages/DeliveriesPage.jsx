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
  Building2,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Scan
} from 'lucide-react';

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-indigo-600" />
            Outbound Deliveries (FEFO Engine)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dispatch customer shipments with strict First-Expiry-First-Out (FEFO) batch consumption and automated cost layer relief.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/warehouse/scanner"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Scan className="w-4 h-4 text-indigo-400" />
            Scanner Mode
          </Link>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Delivery Order
          </button>
        </div>
      </div>

      {/* FEFO Allocation Notification Banner */}
      {fefoResult && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg shadow-xs space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>FEFO Consumption Breakdown — {fefoResult.reference} ({fefoResult.customer})</span>
            </div>
            <button 
              onClick={() => setFefoResult(null)}
              className="text-indigo-400 hover:text-indigo-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
            {fefoResult.allocations.map((a, i) => (
              <div key={i} className="bg-white p-2.5 rounded border border-indigo-100 text-[11px] shadow-2xs">
                <div className="font-semibold text-slate-800">{a.productName || a.sku}</div>
                <div className="text-indigo-700 font-mono mt-0.5">Lot: {a.lotNumber}</div>
                <div className="text-slate-500 flex justify-between mt-1 pt-1 border-t border-slate-100">
                  <span>Consumed: <strong className="text-slate-800">{a.quantity}</strong></span>
                  <span>Exp: {a.expiryDate ? new Date(a.expiryDate).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && !fefoResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by delivery reference, customer, or warehouse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Deliveries"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4 w-8"></th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Source Warehouse</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Requested Qty</th>
                <th className="py-2.5 px-4 text-right">Fulfilled Qty</th>
                <th className="py-2.5 px-4">Dispatched Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && deliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading deliveries...
                  </td>
                </tr>
              ) : filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No outbound deliveries found.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => {
                  const isExpanded = expandedId === d.id;
                  return (
                    <React.Fragment key={d.id}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      >
                        <td className="py-2.5 px-4 text-slate-400 text-center">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-indigo-600">
                          {d.reference}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {d.customer_name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {d.warehouse_name} ({d.warehouse_code})
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            d.status === 'done' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : d.status === 'draft' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                          {parseFloat(d.total_requested_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                          {parseFloat(d.total_done_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {new Date(d.created_at).toLocaleDateString()} {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan="8" className="py-3 px-8">
                            <div className="p-3 bg-white border border-slate-200 rounded text-xs space-y-2">
                              <div className="font-semibold text-slate-800 flex items-center justify-between">
                                <span>Outbound Order Audit:</span>
                                <span className="text-[11px] text-slate-500 font-mono">Ref: {d.reference}</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                This order automatically consumed available lots based on earliest expiration dates (<strong className="text-slate-700">FEFO priority</strong>) and relieved historical cost layers in FIFO sequence.
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
      </div>

      {/* Modal: New Outbound Delivery */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Create Outbound Delivery Order</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Construction Corp"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Source Warehouse *
                  </label>
                  <select
                    required
                    value={formData.source_warehouse_id}
                    onChange={(e) => setFormData({ ...formData, source_warehouse_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Delivery Lines (FEFO Auto-Allocation)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.lines.map((line, idx) => {
                    const availableLocs = locations.filter(l => String(l.warehouse_id) === String(formData.source_warehouse_id));

                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-md relative space-y-2">
                        {formData.lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-rose-600"
                            title="Remove line"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Product *</label>
                            <select
                              required
                              value={line.product_id}
                              onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku}) [On-hand: {p.on_hand_qty || 0}]
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Source Loc *</label>
                            <select
                              required
                              value={line.src_location_id}
                              onChange={(e) => handleLineChange(idx, 'src_location_id', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                              {(availableLocs.length > 0 ? availableLocs : locations).map(loc => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                            Requested Dispatch Quantity *
                          </label>
                          <input
                            type="number"
                            step="any"
                            required
                            min="0.0001"
                            placeholder="e.g. 50"
                            value={line.requested_qty}
                            onChange={(e) => handleLineChange(idx, 'requested_qty', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Stockyard will automatically consume available stock starting with earliest expiring lots (FEFO).
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Allocate & Dispatch Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
