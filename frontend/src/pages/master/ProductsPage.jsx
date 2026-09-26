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
import PageHeader from '../../components/ui/PageHeader';
import FlatCard from '../../components/ui/FlatCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import EmptyState from '../../components/ui/EmptyState';

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

  const columns = [
    {
      header: 'SKU / Item',
      accessor: (p) => (
        <div>
          <div className="font-semibold text-neutral-900">{p.name}</div>
          <div className="font-mono text-xs text-amber-600 font-medium">{p.sku}</div>
          {p.barcode && <div className="text-[11px] text-neutral-400 font-mono mt-0.5">Barcode: {p.barcode}</div>}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: (p) => p.category_name ? (
        <Badge variant="neutral">{p.category_name}</Badge>
      ) : (
        <span className="text-neutral-300">—</span>
      )
    },
    {
      header: 'UoM',
      accessor: (p) => <span className="font-mono font-medium text-neutral-700">{p.uom_code || p.uom_name}</span>
    },
    {
      header: 'Tracking Mode',
      className: 'text-center',
      accessor: (p) => p.tracking_type === 'lot' ? (
        <Badge variant="amber" icon={ShieldAlert}>Lot / FEFO</Badge>
      ) : (
        <Badge variant="neutral">Standard</Badge>
      )
    },
    {
      header: 'Cost Price',
      className: 'text-right font-mono text-neutral-800',
      accessor: (p) => `$${parseFloat(p.cost_price || 0).toFixed(2)}`
    },
    {
      header: 'Sale Price',
      className: 'text-right font-mono text-neutral-800 font-medium',
      accessor: (p) => `$${parseFloat(p.sale_price || 0).toFixed(2)}`
    },
    {
      header: 'Reorder Point',
      className: 'text-center font-mono',
      accessor: (p) => <Badge variant="neutral">{parseFloat(p.reorder_point || 0)}</Badge>
    },
    {
      header: 'Lead Time',
      className: 'text-center font-mono text-neutral-600',
      accessor: (p) => `${p.lead_time_days || 0}d`
    },
    {
      header: 'On Hand',
      className: 'text-right font-mono font-semibold text-neutral-900',
      accessor: (p) => parseFloat(p.on_hand_qty || 0)
    },
    {
      header: 'Action',
      className: 'text-center',
      accessor: (p) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLabelModal({ isOpen: true, product: p })}
          icon={Printer}
        >
          Label
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Products Catalog"
        subtitle="Master item registry with FEFO tracking rules, weighted costing, and reorder metrics"
        badge={
          <span className="px-2.5 py-0.5 rounded-full bg-neutral-100 border border-black/[0.06] text-xs font-mono text-neutral-600">
            {products.length}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              title="Refresh List"
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
            />
            {isManager && (
              <Button
                variant="primary"
                size="sm"
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
      <FlatCard className="p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full sm:w-auto">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, or barcode..."
              icon={Search}
            />
          </form>

          <div className="w-full sm:w-64">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name }))
              ]}
            />
          </div>
        </div>
      </FlatCard>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 rounded-2xl text-xs text-rose-800 flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Table Card */}
      <FlatCard className="p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          keyExtractor={(p) => p.id}
          emptyState={
            <EmptyState
              icon={Package}
              title="No products found"
              description="Add your first inventory item with tracking policies, cost points, and safety reorder levels."
              action={
                isManager && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowModal(true)}
                    icon={Plus}
                  >
                    Register Product
                  </Button>
                )
              }
            />
          }
        />
      </FlatCard>

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Register New Catalog Product"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{modalError}</span>
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
                className="font-mono uppercase"
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
                options={[
                  { value: '', label: '— Select Category —' },
                  ...categories.map((c) => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>

            <div>
              <Select
                label="Unit of Measure *"
                required
                value={formData.uom_id}
                onChange={(e) => setFormData({ ...formData, uom_id: e.target.value })}
                options={[
                  { value: '', label: 'Select UoM...' },
                  ...units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))
                ]}
              />
            </div>

            <div>
              <Select
                label="Tracking Policy *"
                value={formData.tracking_type}
                onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value })}
                options={[
                  { value: 'lot', label: 'By Lots / Batches (Enforces FEFO)' },
                  { value: 'none', label: 'Standard Non-Tracked' }
                ]}
              />
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
