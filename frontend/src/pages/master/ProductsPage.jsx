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
  Boxes, 
  Printer
} from 'lucide-react';
import BarcodeLabelModal from '../../components/common/PrintableBarcodeLabel';
import { PageHeader, FlatCard, Button, Badge, Input, Select, Modal, EmptyState } from '../../components/ui';

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
  const [labelModal, setLabelModal] = useState({ isOpen: false, product: null });
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
        api.getProducts({ 
          search: search.trim() || null, 
          category_id: selectedCategory || null 
        }),
        api.getCategories(),
        api.getUom()
      ]);
      setProducts(prodData || []);
      setCategories(catData || []);
      setUnits(uomData || []);
      
      if (!formData.uom_id && uomData && uomData.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          uom_id: uomData[0].id,
          category_id: catData && catData.length > 0 ? catData[0].id : ''
        }));
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
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode?.trim() || null,
        category_id: formData.category_id ? parseInt(formData.category_id, 10) : null,
        uom_id: parseInt(formData.uom_id, 10),
        tracking_type: formData.tracking_type,
        cost_price: parseFloat(formData.cost_price) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        reorder_point: parseFloat(formData.reorder_point) || 0,
        lead_time_days: parseInt(formData.lead_time_days, 10) || 0
      };

      const newProd = await api.createProduct(payload);
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
      // Refresh catalog immediately
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setModalError(err.message || 'Failed to create product.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Products Catalog"
        description="Master item registry with FEFO tracking rules, weighted costing, and reorder metrics"
        badge={products.length}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={fetchData}
              disabled={loading}
              icon={RefreshCw}
              className={loading ? '[&>svg]:animate-spin text-amber-600' : ''}
            >
              Refresh
            </Button>
            {isManager && (
              <Button
                variant="primary"
                onClick={() => setShowModal(true)}
                icon={Plus}
              >
                New Product
              </Button>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <FlatCard className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, or barcode (press Enter)..."
              icon={Search}
            />
          </form>

          <div className="w-full sm:w-64">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </FlatCard>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Table Card */}
      <FlatCard className="overflow-hidden p-0">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-600">
            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto mb-3" />
            <span className="font-medium">Loading catalog products...</span>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description="Add your first inventory item with tracking policies, cost points, and safety reorder levels."
            action={
              isManager && (
                <Button
                  variant="primary"
                  onClick={() => setShowModal(true)}
                  icon={Plus}
                >
                  Register First Product
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-5">SKU / Item</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">UoM</th>
                  <th className="py-3.5 px-5 text-center">Tracking Mode</th>
                  <th className="py-3.5 px-5 text-right">Cost Price</th>
                  <th className="py-3.5 px-5 text-right">Sale Price</th>
                  <th className="py-3.5 px-5 text-center">Reorder Pt</th>
                  <th className="py-3.5 px-5 text-center">Lead Time</th>
                  <th className="py-3.5 px-5 text-right">On Hand</th>
                  <th className="py-3.5 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 text-sm">{p.name}</div>
                      <div className="font-mono text-xs font-semibold text-amber-700 mt-0.5">{p.sku}</div>
                      {p.barcode && (
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          Barcode: {p.barcode}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      {p.category_name ? (
                        <Badge variant="neutral" size="sm">
                          {p.category_name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono font-medium text-slate-800">
                      {p.uom_code || p.uom_name}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      {p.tracking_type === 'lot' ? (
                        <Badge variant="warning" size="sm" dot>
                          Lot / FEFO
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm" dot={false}>
                          Standard
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-medium text-slate-800">
                      ${parseFloat(p.cost_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-medium text-slate-800">
                      ${parseFloat(p.sale_price || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px]">
                        {parseFloat(p.reorder_point || 0)}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono text-slate-700 font-medium">
                      {p.lead_time_days || 0}d
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-sm font-bold text-slate-900">
                      {parseFloat(p.on_hand_qty || 0)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Printer}
                        onClick={() => setLabelModal({ isOpen: true, product: p })}
                      >
                        Label
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FlatCard>

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Register New Catalog Product"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <Input
                label="Product Name *"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Industrial Digital Thermometer"
              />
            </div>

            <div>
              <Input
                label="SKU Identifier * (Unique)"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="SKU-THRM-001"
                className="font-mono uppercase font-bold"
              />
            </div>

            <div>
              <Input
                label="Barcode (EAN/UPC)"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="890123456789"
                className="font-mono"
              />
            </div>

            <div>
              <Select
                label="Category (Optional)"
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">— Select Category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Select
                label="Unit of Measure *"
                required
                value={formData.uom_id}
                onChange={(e) => setFormData({ ...formData, uom_id: e.target.value })}
              >
                <option value="">Select UoM...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Select
                label="Tracking Policy *"
                value={formData.tracking_type}
                onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value })}
              >
                <option value="lot">By Lots / Batches (Enforces FEFO)</option>
                <option value="none">Standard Non-Tracked</option>
              </Select>
            </div>

            <div>
              <Input
                label="Standard Cost Price ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label="Sale / Retail Price ($)"
                type="number"
                step="0.01"
                min="0"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label="Reorder Point * (Min Stock ≥ 0)"
                type="number"
                step="1"
                min="0"
                required
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
                placeholder="10"
                className="font-mono"
              />
            </div>

            <div>
              <Input
                label="Replenishment Lead Time (Days ≥ 0)"
                type="number"
                step="1"
                min="0"
                required
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                placeholder="5"
                className="font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={modalLoading}
            >
              {modalLoading ? 'Saving...' : 'Register Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable Barcode Label Modal */}
      <BarcodeLabelModal
        isOpen={labelModal.isOpen}
        onClose={() => setLabelModal({ isOpen: false, product: null })}
        entityType="product"
        barcode={labelModal.product?.barcode || labelModal.product?.sku}
        title={labelModal.product?.name}
        subtitle={`SKU: ${labelModal.product?.sku}`}
        details={[
          { label: 'Category', value: labelModal.product?.category_name || 'Standard' },
          { label: 'UoM', value: labelModal.product?.uom_code || labelModal.product?.uom_name },
          { label: 'Tracking', value: labelModal.product?.tracking_type?.toUpperCase() },
          { label: 'On Hand', value: `${parseFloat(labelModal.product?.on_hand_qty || 0)}` }
        ]}
      />
    </div>
  );
}
