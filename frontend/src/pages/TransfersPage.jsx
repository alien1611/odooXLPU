import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Building2,
  Package,
  Layers,
  MapPin
} from 'lucide-react';

export default function TransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [formData, setFormData] = useState({
    product_id: '',
    lot_id: '',
    src_location_id: '',
    dest_location_id: '',
    quantity: '10',
    remarks: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transData, prods, locs, lotData] = await Promise.all([
        api.getTransfers(),
        api.getProducts(),
        api.getLocations(),
        api.getLots()
      ]);
      setTransfers(transData);
      setProducts(prods);
      setLocations(locs);
      setLots(lotData);
    } catch (err) {
      setError(err.message || 'Failed to load transfers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = () => {
    const defaultProd = products[0]?.id || '';
    const relevantLots = lots.filter(l => String(l.product_id) === String(defaultProd));
    const loc1 = locations[0]?.id || '';
    const loc2 = locations[1]?.id || locations[0]?.id || '';

    setFormData({
      product_id: defaultProd,
      lot_id: relevantLots[0]?.id || '',
      src_location_id: loc1,
      dest_location_id: loc2,
      quantity: '10',
      remarks: 'Internal picking replenishment'
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleProductChange = (productId) => {
    const relevantLots = lots.filter(l => String(l.product_id) === String(productId));
    setFormData(prev => ({
      ...prev,
      product_id: productId,
      lot_id: relevantLots[0]?.id || ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      if (!formData.product_id) throw new Error('Product is required.');
      if (!formData.src_location_id) throw new Error('Source location is required.');
      if (!formData.dest_location_id) throw new Error('Destination location is required.');
      if (formData.src_location_id === formData.dest_location_id) {
        throw new Error('Source and destination locations must be different.');
      }
      const qty = parseFloat(formData.quantity);
      if (isNaN(qty) || qty <= 0) throw new Error('Transfer quantity must be > 0.');

      const payload = {
        product_id: parseInt(formData.product_id, 10),
        src_location_id: parseInt(formData.src_location_id, 10),
        dest_location_id: parseInt(formData.dest_location_id, 10),
        lot_id: formData.lot_id ? parseInt(formData.lot_id, 10) : null,
        quantity: qty,
        remarks: formData.remarks.trim() || null
      };

      const result = await api.createTransfer(payload);
      setSuccessMsg(`Transfer ${result.reference} completed successfully. Quantities updated.`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to complete internal transfer.');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredTransfers = transfers.filter(t => 
    t.reference?.toLowerCase().includes(search.toLowerCase()) ||
    t.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    t.from_location?.toLowerCase().includes(search.toLowerCase()) ||
    t.to_location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-teal-600" />
            Internal Location Transfers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Relocate inventory between warehouse zones or bins while strictly preserving lot identity and valuation integrity.
          </p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Success Alert */}
      {successMsg && (
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
            placeholder="Search by transfer reference, product, SKU, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Transfers"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
        </button>
      </div>

      {/* Transfers Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Lot / Batch</th>
                <th className="py-2.5 px-4">From Location</th>
                <th className="py-2.5 px-4">To Location</th>
                <th className="py-2.5 px-4 text-right">Quantity</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4">Executed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && transfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-500" />
                    Loading transfers...
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No internal transfers recorded.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-teal-600">
                      {t.reference}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      {t.product_name} <span className="text-[10px] text-slate-400">({t.product_sku})</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {t.lot_number || <span className="text-slate-400 font-sans italic">None</span>}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {t.from_location}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 font-medium">
                      {t.to_location}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {parseFloat(t.quantity || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Transfer */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-teal-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Transfer Inventory Between Locations</h3>
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

              {/* Product Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product to Move *
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) [On-hand: {p.on_hand_qty || 0}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Lot Selection (if applicable) */}
              {lots.filter(l => String(l.product_id) === String(formData.product_id)).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lot / Batch Number
                  </label>
                  <select
                    value={formData.lot_id}
                    onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    <option value="">-- No specific lot --</option>
                    {lots
                      .filter(l => String(l.product_id) === String(formData.product_id))
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number} (Exp: {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : 'N/A'}, Qty: {l.current_quantity || 0})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Locations Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Source Location *
                  </label>
                  <select
                    required
                    value={formData.src_location_id}
                    onChange={(e) => setFormData({ ...formData, src_location_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Destination Location *
                  </label>
                  <select
                    required
                    value={formData.dest_location_id}
                    onChange={(e) => setFormData({ ...formData, dest_location_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 bg-white"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transfer Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0.0001"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rack reorganization, staging replenishment"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500"
                />
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
                  className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
