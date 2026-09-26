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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Inventory Adjustments"
        subtitle="Record physical cycle counts, write off damaged/lost materials, and reconcile stock discrepancies with an immutable audit trail."
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/warehouse/scanner">
              <Button variant="secondary" size="sm" icon={Scan}>
                Barcode Cycle Count
              </Button>
            </Link>
            {isManager && (
              <Button variant="primary" size="sm" onClick={openModal} icon={Plus}>
                New Physical Adjustment
              </Button>
            )}
          </div>
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
              placeholder="Search adjustments by reference, product, SKU, location, or reason..."
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
            title="Refresh Adjustments"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* Adjustments Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Lot / Batch</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Theoretical Qty</th>
                <th className="py-3 px-4 text-right">Counted Qty</th>
                <th className="py-3 px-4 text-right">Difference</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Applied Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && adjustments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading adjustments...
                  </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No adjustments recorded"
                      description="Create an inventory adjustment to reconcile stock discrepancies."
                    />
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((a) => {
                  const diff = parseFloat(a.difference_qty);
                  return (
                    <tr key={a.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                        {a.reference}
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        {a.product_name} <span className="text-[11px] text-neutral-400 font-mono">({a.product_sku})</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-neutral-700">
                        {a.lot_number ? <Badge variant="amber">{a.lot_number}</Badge> : <span className="text-neutral-400 font-sans italic">None</span>}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">
                        {a.location_name}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-500">
                        {parseFloat(a.theoretical_qty || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                        {parseFloat(a.counted_qty || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        <span className={`inline-flex items-center gap-1 ${
                          diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-neutral-500'
                        }`}>
                          {diff > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : diff < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-neutral-600 max-w-[200px] truncate" title={a.reason}>
                        {a.reason || 'Inventory cycle count'}
                      </td>
                      <td className="py-3 px-4 text-neutral-500">
                        {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </FlatCard>

      {/* Modal: New Adjustment */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Physical Inventory Adjustment"
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
            label="Product to Adjust *"
            required
            value={formData.product_id}
            onChange={(e) => setFormData({ ...formData, product_id: e.target.value, lot_id: '' })}
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} (${p.sku})`
            }))}
          />

          {/* Location Selection */}
          <Select
            label="Storage Location *"
            required
            value={formData.location_id}
            onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
            options={locations.map(loc => ({
              value: loc.id,
              label: `${loc.name} (${loc.code})`
            }))}
          />

          {/* Lot Selection (if tracked) */}
          {lots.filter(l => String(l.product_id) === String(formData.product_id)).length > 0 && (
            <Select
              label="Lot / Batch (Optional)"
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

          {/* Stock comparison indicator */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-black/[0.06] flex items-center justify-between text-xs">
            <div>
              <span className="text-neutral-400 block">System Expected Stock:</span>
              <span className="font-mono font-semibold text-neutral-900 text-sm">
                {theoreticalQty !== null ? theoreticalQty : '--'} units
              </span>
            </div>
            {formData.counted_qty && (
              <div className="text-right">
                <span className="text-neutral-400 block">Calculated Difference:</span>
                <span className={`font-mono font-semibold text-sm ${
                  calculatedDifference > 0 ? 'text-emerald-600' : calculatedDifference < 0 ? 'text-rose-600' : 'text-neutral-600'
                }`}>
                  {calculatedDifference > 0 ? `+${calculatedDifference}` : calculatedDifference} units
                </span>
              </div>
            )}
          </div>

          <Input
            label="Actual Physical Counted Quantity *"
            type="number"
            step="any"
            required
            min="0"
            value={formData.counted_qty}
            onChange={(e) => setFormData({ ...formData, counted_qty: e.target.value })}
            className="font-mono"
          />

          <Input
            label="Adjustment Reason / Audit Note *"
            type="text"
            required
            placeholder="e.g. End of month physical inventory reconciliation"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
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
              icon={modalLoading ? RefreshCw : SlidersHorizontal}
              className={modalLoading ? 'animate-spin' : ''}
            >
              {modalLoading ? 'Applying...' : 'Apply Physical Adjustment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
