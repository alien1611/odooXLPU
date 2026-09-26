import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import { 
  SlidersHorizontal, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Package,
  MapPin,
  Scan
} from 'lucide-react';

export default function AdjustmentsPage() {
  const { isManager } = useAuth();
  const [adjustments, setAdjustments] = useState([]);
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
    location_id: '',
    lot_id: '',
    counted_qty: '',
    reason: ''
  });

  const [theoreticalQty, setTheoreticalQty] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [adjs, prods, locs, lotData] = await Promise.all([
        api.getAdjustments(),
        api.getProducts(),
        api.getLocations(),
        api.getLots()
      ]);
      setAdjustments(adjs);
      setProducts(prods);
      setLocations(locs);
      setLots(lotData);
    } catch (err) {
      setError(err.message || 'Failed to load adjustments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = () => {
    const defaultProd = products[0]?.id || '';
    const defaultLoc = locations[0]?.id || '';
    const relevantLots = lots.filter(l => String(l.product_id) === String(defaultProd));

    setFormData({
      product_id: defaultProd,
      location_id: defaultLoc,
      lot_id: relevantLots[0]?.id || '',
      counted_qty: '10',
      reason: 'Physical inventory cycle count'
    });
    setModalError(null);
    setShowModal(true);
  };

  // Whenever product/location/lot changes, find current quant
  useEffect(() => {
    if (!formData.product_id || !formData.location_id) return;

    const findCurrentStock = async () => {
      try {
        const quants = await api.getQuants({
          product_id: formData.product_id,
          location_id: formData.location_id
        });
        if (formData.lot_id) {
          const match = quants.find(q => String(q.lot_id) === String(formData.lot_id));
          setTheoreticalQty(match ? parseFloat(match.quantity) : 0);
        } else {
          const total = quants.reduce((sum, q) => sum + parseFloat(q.quantity), 0);
          setTheoreticalQty(total);
        }
      } catch (err) {
        setTheoreticalQty(0);
      }
    };

    findCurrentStock();
  }, [formData.product_id, formData.location_id, formData.lot_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      if (!formData.product_id) throw new Error('Product is required.');
      if (!formData.location_id) throw new Error('Location is required.');
      const counted = parseFloat(formData.counted_qty);
      if (isNaN(counted) || counted < 0) throw new Error('Counted physical quantity must be >= 0.');

      const payload = {
        product_id: parseInt(formData.product_id, 10),
        location_id: parseInt(formData.location_id, 10),
        lot_id: formData.lot_id ? parseInt(formData.lot_id, 10) : null,
        counted_qty: counted,
        reason: formData.reason.trim() || 'Inventory reconciliation'
      };

      const result = await api.createAdjustment(payload);
      setSuccessMsg(`Adjustment ${result.reference} applied. Difference: ${result.difference_qty >= 0 ? `+${result.difference_qty}` : result.difference_qty} units.`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to apply adjustment.');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredAdjustments = adjustments.filter(a => 
    a.reference?.toLowerCase().includes(search.toLowerCase()) ||
    a.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.product_sku?.toLowerCase().includes(search.toLowerCase()) ||
    a.location_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const calculatedDifference = (parseFloat(formData.counted_qty) || 0) - (theoreticalQty !== null ? theoreticalQty : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-600" />
            Inventory Adjustments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record physical cycle counts, write off damaged/lost materials, and reconcile stock discrepancies with an immutable audit trail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/warehouse/scanner"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Scan className="w-4 h-4 text-amber-400" />
            Barcode Cycle Count
          </Link>
          {isManager && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Physical Adjustment
            </button>
          )}
        </div>
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
            placeholder="Search adjustments by reference, product, SKU, location, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Adjustments"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
        </button>
      </div>

      {/* Adjustments Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Lot / Batch</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4 text-right">Theoretical Qty</th>
                <th className="py-2.5 px-4 text-right">Counted Qty</th>
                <th className="py-2.5 px-4 text-right">Difference</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4">Applied Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && adjustments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading adjustments...
                  </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No inventory adjustments recorded.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((a) => {
                  const diff = parseFloat(a.difference_qty);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-amber-600">
                        {a.reference}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {a.product_name} <span className="text-[10px] text-slate-400">({a.product_sku})</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {a.lot_number || <span className="text-slate-400 font-sans italic">None</span>}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {a.location_name}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                        {parseFloat(a.theoretical_qty || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {parseFloat(a.counted_qty || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        <span className={`inline-flex items-center gap-1 ${
                          diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}>
                          {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate" title={a.reason}>
                        {a.reason || 'Inventory cycle count'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Adjustment */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Physical Inventory Adjustment</h3>
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
                  Product to Adjust *
                </label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value, lot_id: '' })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Location *
                </label>
                <select
                  required
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lot (if product has lots) */}
              {lots.filter(l => String(l.product_id) === String(formData.product_id)).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lot / Batch Number
                  </label>
                  <select
                    value={formData.lot_id}
                    onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 bg-white"
                  >
                    <option value="">-- No specific lot --</option>
                    {lots
                      .filter(l => String(l.product_id) === String(formData.product_id))
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.lot_number} (Exp: {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : 'N/A'})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Theoretical & Counted Comparison */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                    System Theoretical Qty
                  </label>
                  <div className="text-base font-bold text-slate-700 font-mono mt-0.5">
                    {theoreticalQty !== null ? theoreticalQty.toLocaleString() : '...'}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">
                    Net Discrepancy
                  </label>
                  <div className={`text-base font-bold font-mono mt-0.5 ${
                    calculatedDifference > 0 ? 'text-emerald-600' : calculatedDifference < 0 ? 'text-rose-600' : 'text-slate-500'
                  }`}>
                    {calculatedDifference > 0 ? `+${calculatedDifference}` : calculatedDifference}
                  </div>
                </div>
              </div>

              {/* Counted Quantity */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Actual Counted Physical Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="0"
                  value={formData.counted_qty}
                  onChange={(e) => setFormData({ ...formData, counted_qty: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adjustment Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scrapped damaged units, physical inventory audit"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
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
                  className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
