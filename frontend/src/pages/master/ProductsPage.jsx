import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { 
  Package, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ShieldAlert,
  Boxes
} from 'lucide-react';

export default function ProductsPage() {
  const { isManager } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    uom_id: '',
    tracking_type: 'lot',
    cost_price: '0.00',
    sale_price: '0.00',
    reorder_point: '10',
    lead_time_days: '5'
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodData, catData, uomData] = await Promise.all([
        api.getProducts({ search, category_id: selectedCategory || null }),
        api.getCategories(),
        api.getUom()
      ]);
      setProducts(prodData);
      setCategories(catData);
      setUnits(uomData);
      if (!formData.uom_id && uomData.length > 0) {
        setFormData(prev => ({ ...prev, uom_id: uomData[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const payload = {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode || null,
        category_id: formData.category_id ? parseInt(formData.category_id, 10) : null,
        uom_id: parseInt(formData.uom_id, 10),
        tracking_type: formData.tracking_type,
        cost_price: parseFloat(formData.cost_price) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        lead_time_days: parseInt(formData.lead_time_days, 10) || 0
      };

      await api.createProduct(payload);
      setSuccessMsg(`Product "${formData.name}" (SKU: ${formData.sku}) created successfully.`);
      setShowModal(false);
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        category_id: categories[0]?.id || '',
        uom_id: units[0]?.id || '',
        tracking_type: 'lot',
        cost_price: '0.00',
        sale_price: '0.00',
        reorder_point: '10',
        lead_time_days: '5'
      });
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create product.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Products Catalog</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
              {products.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Master item registry with FEFO tracking rules, weighted costing, and reorder metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh List"
            className="p-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isManager && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full sm:w-auto"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-3.5 h-3.5 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin mx-auto mb-2" />
            Loading catalog products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Add your first inventory item with tracking policies, cost points, and safety reorder levels.
            </p>
            {isManager && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">SKU / Item</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">UoM</th>
                  <th className="py-2.5 px-4 text-center">Tracking Mode</th>
                  <th className="py-2.5 px-4 text-right">Cost Price</th>
                  <th className="py-2.5 px-4 text-right">Sale Price</th>
                  <th className="py-2.5 px-4 text-center">Reorder Point</th>
                  <th className="py-2.5 px-4 text-center">Lead Time</th>
                  <th className="py-2.5 px-4 text-right">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-blue-700 font-medium">{p.sku}</div>
                      {p.barcode && <div className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.category_name ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px]">
                          {p.category_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {p.uom_code || p.uom_name}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.tracking_type === 'lot' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          Lot / FEFO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">
                      ${parseFloat(p.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800 font-medium">
                      ${parseFloat(p.sale_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {parseFloat(p.reorder_point || 0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {p.lead_time_days || 0}d
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {parseFloat(p.on_hand_qty || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Register New Catalog Product</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Industrial Digital Thermometer"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Identifier * (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="SKU-THRM-001"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode (EAN/UPC)
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="890123456789"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category (Optional)
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    <option value="">— Select Category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    required
                    value={formData.uom_id}
                    onChange={(e) => setFormData({ ...formData, uom_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    <option value="">Select UoM...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tracking Policy *
                  </label>
                  <select
                    value={formData.tracking_type}
                    onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white font-medium"
                  >
                    <option value="lot">By Lots / Batches (Enforces FEFO)</option>
                    <option value="none">Standard Non-Tracked</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Standard Cost Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sale / Retail Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reorder Point * (Min Stock &ge; 0)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formData.reorder_point}
                    onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Replenishment Lead Time (Days &ge; 0)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={formData.lead_time_days}
                    onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                    placeholder="5"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : 'Register Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
