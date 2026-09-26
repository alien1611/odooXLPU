import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import { 
  ArrowDownToLine, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ChevronDown,
  ChevronRight,
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

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // New Receipt Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const [formData, setFormData] = useState({
    supplier_name: '',
    destination_warehouse_id: '',
    lines: [
      {
        product_id: '',
        lot_number: '',
        expiry_date: '',
        expected_qty: '',
        unit_price: '',
        dest_location_id: ''
      }
    ]
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, whs, prods, locs] = await Promise.all([
        api.getReceipts(),
        api.getWarehouses(),
        api.getProducts(),
        api.getLocations()
      ]);
      setReceipts(recs);
      setWarehouses(whs);
      setProducts(prods);
      setLocations(locs);

      if (whs.length > 0 && !formData.destination_warehouse_id) {
        setFormData(prev => ({
          ...prev,
          destination_warehouse_id: whs[0].id
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load receipts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLine = () => {
    const defaultLoc = locations.find(l => String(l.warehouse_id) === String(formData.destination_warehouse_id)) || locations[0];
    setFormData(prev => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_id: products[0]?.id || '',
          lot_number: '',
          expiry_date: '',
          expected_qty: '10',
          unit_price: '0.00',
          dest_location_id: defaultLoc?.id || ''
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
    
    // Default expiry 90 days in future
    const d = new Date();
    d.setDate(d.getDate() + 90);
    const defaultExp = d.toISOString().slice(0, 10);

    setFormData({
      supplier_name: '',
      destination_warehouse_id: defaultWh,
      lines: [
        {
          product_id: defaultProd,
          lot_number: `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          expiry_date: defaultExp,
          expected_qty: '50',
          unit_price: '10.00',
          dest_location_id: defaultLoc?.id || ''
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
      if (!formData.supplier_name.trim()) {
        throw new Error('Supplier name is required.');
      }
      if (!formData.destination_warehouse_id) {
        throw new Error('Destination warehouse is required.');
      }

      const payload = {
        supplier_name: formData.supplier_name.trim(),
        destination_warehouse_id: parseInt(formData.destination_warehouse_id, 10),
        lines: formData.lines.map((l, idx) => {
          if (!l.product_id) throw new Error(`Line ${idx + 1}: Product is required.`);
          if (!l.dest_location_id) throw new Error(`Line ${idx + 1}: Destination location is required.`);
          const qty = parseFloat(l.expected_qty);
          if (isNaN(qty) || qty <= 0) throw new Error(`Line ${idx + 1}: Quantity must be greater than 0.`);
          const price = parseFloat(l.unit_price);
          if (isNaN(price) || price < 0) throw new Error(`Line ${idx + 1}: Unit price must be >= 0.`);

          const selectedProd = products.find(p => String(p.id) === String(l.product_id));
          if (selectedProd?.tracking_type === 'lot' && !l.lot_number.trim()) {
            throw new Error(`Line ${idx + 1}: Lot number is required for lot-tracked product "${selectedProd.name}".`);
          }

          return {
            product_id: parseInt(l.product_id, 10),
            lot_number: l.lot_number ? l.lot_number.trim() : null,
            expiry_date: l.expiry_date || null,
            expected_qty: qty,
            unit_price: price,
            dest_location_id: parseInt(l.dest_location_id, 10)
          };
        }),
        auto_process: true
      };

      const result = await api.createReceipt(payload);
      setSuccessMsg(`Receipt ${result.reference} created and processed successfully into stock.`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      setModalError(err.message || 'Failed to create receipt.');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    r.reference?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.warehouse_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title="Inbound Receipts"
        subtitle="Receive goods from suppliers, record batches/lots, calculate weighted-average costing, and post immutable stock moves."
        actions={
          <div className="flex items-center gap-2.5">
            <Link to="/warehouse/scanner">
              <Button variant="secondary" size="sm" icon={Scan}>
                Scanner Inbound
              </Button>
            </Link>
            <Button variant="primary" size="sm" onClick={openModal} icon={Plus}>
              New Receipt
            </Button>
          </div>
        }
      />

      {/* Success Alert */}
      {successMsg && (
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
              placeholder="Search by receipt reference, supplier, or warehouse..."
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
            title="Refresh Receipts"
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          />
        </div>
      </FlatCard>

      {/* Receipts Table */}
      <FlatCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-600">
            <thead className="bg-neutral-50/80 text-neutral-500 font-semibold uppercase tracking-wider text-[11px] border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4 w-10 text-center"></th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Items / Lines</th>
                <th className="py-3 px-4 text-right">Received Qty</th>
                <th className="py-3 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Loading receipts...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <EmptyState
                      icon={Package}
                      title="No inbound receipts found"
                      description="Create an inbound stock receipt or scan goods with the scanner terminal."
                      action={
                        <Button variant="primary" size="sm" onClick={openModal} icon={Plus}>
                          New Receipt
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => {
                  const isExpanded = expandedId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr 
                        className={`hover:bg-neutral-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-amber-50/20' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        <td className="py-3 px-4 text-neutral-400 text-center">
                          {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-amber-600">
                          {r.reference}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-900">
                          {r.supplier_name}
                        </td>
                        <td className="py-3 px-4 text-neutral-600">
                          {r.warehouse_name} ({r.warehouse_code})
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={r.status === 'done' ? 'success' : r.status === 'draft' ? 'amber' : 'neutral'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-neutral-700">
                          {r.line_count || 1}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-neutral-900">
                          {parseFloat(r.total_received_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-neutral-500">
                          {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-neutral-50/50">
                          <td colSpan="8" className="py-4 px-8">
                            <div className="p-4 bg-white border border-black/[0.06] rounded-xl text-xs space-y-2 shadow-2xs">
                              <div className="font-semibold text-neutral-800 flex items-center justify-between">
                                <span>Receipt Information & Stock Moves:</span>
                                <span className="text-[11px] text-neutral-400 font-mono">Ref: {r.reference}</span>
                              </div>
                              <p className="text-[11px] text-neutral-500">
                                Inbound receipt processed into destination warehouse with perpetual cost layer generation. View immutable stock move records in the <strong className="text-neutral-700">Stock Moves Ledger</strong>.
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

      {/* Modal: New Inbound Receipt */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create Inbound Stock Receipt"
        maxWidth="max-w-2xl"
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
              label="Supplier / Vendor Name *"
              required
              placeholder="e.g. Apex Industrial Supplies"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
            />
            <Select
              label="Destination Warehouse *"
              required
              value={formData.destination_warehouse_id}
              onChange={(e) => setFormData({ ...formData, destination_warehouse_id: e.target.value })}
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
                Receipt Item Lines
              </label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddLine}
                icon={Plus}
              >
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {formData.lines.map((line, idx) => {
                const selectedProd = products.find(p => String(p.id) === String(line.product_id));
                const isLot = selectedProd?.tracking_type === 'lot';
                const availableLocs = locations.filter(l => String(l.warehouse_id) === String(formData.destination_warehouse_id));

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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Select
                          label="Product *"
                          required
                          value={line.product_id}
                          onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                          options={products.map(p => ({
                            value: p.id,
                            label: `${p.name} (${p.sku}) [${p.tracking_type === 'lot' ? 'LOT' : 'NON-LOT'}]`
                          }))}
                        />
                      </div>
                      <div>
                        <Select
                          label="Destination Loc *"
                          required
                          value={line.dest_location_id}
                          onChange={(e) => handleLineChange(idx, 'dest_location_id', e.target.value)}
                          options={(availableLocs.length > 0 ? availableLocs : locations).map(loc => ({
                            value: loc.id,
                            label: `${loc.name} (${loc.code})`
                          }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <Input
                          label="Quantity *"
                          type="number"
                          step="any"
                          required
                          min="0.0001"
                          value={line.expected_qty}
                          onChange={(e) => handleLineChange(idx, 'expected_qty', e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Input
                          label="Unit Cost ($) *"
                          type="number"
                          step="0.01"
                          required
                          min="0"
                          value={line.unit_price}
                          onChange={(e) => handleLineChange(idx, 'unit_price', e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Input
                          label={`Lot / Batch No. ${isLot ? '*' : ''}`}
                          type="text"
                          required={isLot}
                          placeholder={isLot ? "Required" : "Optional"}
                          value={line.lot_number}
                          onChange={(e) => handleLineChange(idx, 'lot_number', e.target.value)}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Input
                          label="Expiry Date"
                          type="date"
                          value={line.expiry_date}
                          onChange={(e) => handleLineChange(idx, 'expiry_date', e.target.value)}
                        />
                      </div>
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
              icon={modalLoading ? RefreshCw : ArrowDownToLine}
              className={modalLoading ? 'animate-spin' : ''}
            >
              {modalLoading ? 'Processing...' : 'Confirm & Receive Stock'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
