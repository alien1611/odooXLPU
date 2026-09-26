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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Internal Location Transfers"
        subtitle="Relocate inventory between warehouse zones or bins while strictly preserving lot identity and valuation integrity."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={openModal}
            icon={Plus}
          >
            New Transfer
          </Button>
        }
      />

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
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
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 text-rose-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
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
              placeholder="Search by transfer reference, product, SKU, or location..."
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
            title="Refresh Transfers"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* Transfers Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Lot / Batch</th>
                <th className="py-3 px-4">From Location</th>
                <th className="py-3 px-4">To Location</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Executed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && transfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading transfers...
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No internal transfers"
                      description="Create an internal transfer to move stock between bin locations."
                    />
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                      {t.reference}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-900">
                      {t.product_name} <span className="text-[11px] text-neutral-400 font-mono">({t.product_sku})</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-700">
                      {t.lot_number ? <Badge variant="amber">{t.lot_number}</Badge> : <span className="text-neutral-400 font-sans italic">None</span>}
                    </td>
                    <td className="py-3 px-4 text-neutral-600">
                      {t.from_location}
                    </td>
                    <td className="py-3 px-4 text-neutral-800 font-medium">
                      {t.to_location}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                      {parseFloat(t.quantity || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="success">{t.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-neutral-500">
                      {new Date(t.created_at).toLocaleDateString()} {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>

      {/* Modal: New Transfer */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Transfer Inventory Between Locations"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Product Selection */}
          <Select
            label="Product to Move *"
            required
            value={formData.product_id}
            onChange={(e) => handleProductChange(e.target.value)}
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} (${p.sku}) [On-hand: ${p.on_hand_qty || 0}]`
            }))}
          />

          {/* Lot Selection (if applicable) */}
          {lots.filter(l => String(l.product_id) === String(formData.product_id)).length > 0 && (
            <Select
              label="Lot / Batch Number"
              value={formData.lot_id}
              onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
              options={[
                { value: '', label: '-- No specific lot --' },
                ...lots
                  .filter(l => String(l.product_id) === String(formData.product_id))
                  .map(l => ({
                    value: l.id,
                    label: `${l.lot_number} (Exp: ${l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : 'N/A'}, Qty: ${l.current_quantity || 0})`
                  }))
              ]}
            />
          )}

          {/* Locations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Source Location *"
              required
              value={formData.src_location_id}
              onChange={(e) => setFormData({ ...formData, src_location_id: e.target.value })}
              options={locations.map(loc => ({
                value: loc.id,
                label: `${loc.name} (${loc.code})`
              }))}
            />

            <Select
              label="Destination Location *"
              required
              value={formData.dest_location_id}
              onChange={(e) => setFormData({ ...formData, dest_location_id: e.target.value })}
              options={locations.map(loc => ({
                value: loc.id,
                label: `${loc.name} (${loc.code})`
              }))}
            />
          </div>

          <Input
            label="Transfer Quantity *"
            type="number"
            step="any"
            required
            min="0.0001"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="font-mono"
          />

          <Input
            label="Internal Remarks (Optional)"
            type="text"
            placeholder="e.g. Relocating to forward pick face"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />

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
              icon={modalLoading ? RefreshCw : ArrowLeftRight}
              className={modalLoading ? 'animate-spin' : ''}
            >
              {modalLoading ? 'Transferring...' : 'Execute Stock Transfer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
