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
  Calendar,
  Building2,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
  Scan
} from 'lucide-react';

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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-blue-600" />
            Inbound Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Receive goods from suppliers, record batches/lots, calculate weighted-average costing, and post immutable stock moves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/warehouse/scanner"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Scan className="w-4 h-4 text-blue-400" />
            Scanner Inbound
          </Link>
          <button
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Receipt
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center justify-between text-xs animate-in fade-in">
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
            placeholder="Search by receipt reference, supplier, or warehouse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 border border-slate-200 rounded hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Receipts"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Receipts Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-2.5 px-4 w-8"></th>
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Supplier</th>
                <th className="py-2.5 px-4">Destination Warehouse</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Items / Lines</th>
                <th className="py-2.5 px-4 text-right">Received Qty</th>
                <th className="py-2.5 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && receipts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading receipts...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No inbound receipts found.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => {
                  const isExpanded = expandedId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr 
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      >
                        <td className="py-2.5 px-4 text-slate-400 text-center">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-blue-600">
                          {r.reference}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {r.supplier_name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {r.warehouse_name} ({r.warehouse_code})
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            r.status === 'done' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : r.status === 'draft' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                          {r.line_count || 1}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                          {parseFloat(r.total_received_qty || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan="8" className="py-3 px-8">
                            <div className="p-3 bg-white border border-slate-200 rounded text-xs space-y-2">
                              <div className="font-semibold text-slate-800 flex items-center justify-between">
                                <span>Receipt Information & Stock Moves:</span>
                                <span className="text-[11px] text-slate-500 font-mono">Ref: {r.reference}</span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Inbound receipt processed into destination warehouse with perpetual cost layer generation. View immutable stock move records in the <strong className="text-slate-700">Stock Moves Ledger</strong>.
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

      {/* Modal: New Inbound Receipt */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Create Inbound Stock Receipt</h3>
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
                    Supplier / Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Industrial Supplies"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Destination Warehouse *
                  </label>
                  <select
                    required
                    value={formData.destination_warehouse_id}
                    onChange={(e) => setFormData({ ...formData, destination_warehouse_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
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
                    Receipt Item Lines
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.lines.map((line, idx) => {
                    const selectedProd = products.find(p => String(p.id) === String(line.product_id));
                    const isLot = selectedProd?.tracking_type === 'lot';
                    const availableLocs = locations.filter(l => String(l.warehouse_id) === String(formData.destination_warehouse_id));

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
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Product *</label>
                            <select
                              required
                              value={line.product_id}
                              onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku}) [{p.tracking_type === 'lot' ? 'LOT' : 'NON-LOT'}]
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Destination Loc *</label>
                            <select
                              required
                              value={line.dest_location_id}
                              onChange={(e) => handleLineChange(idx, 'dest_location_id', e.target.value)}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              {(availableLocs.length > 0 ? availableLocs : locations).map(loc => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              step="any"
                              required
                              min="0.0001"
                              value={line.expected_qty}
                              onChange={(e) => handleLineChange(idx, 'expected_qty', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                              Unit Cost ($) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => handleLineChange(idx, 'unit_price', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                              Lot / Batch No. {isLot && '*'}
                            </label>
                            <input
                              type="text"
                              required={isLot}
                              placeholder={isLot ? "Required" : "Optional"}
                              value={line.lot_number}
                              onChange={(e) => handleLineChange(idx, 'lot_number', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                              Expiry Date
                            </label>
                            <input
                              type="date"
                              value={line.expiry_date}
                              onChange={(e) => handleLineChange(idx, 'expiry_date', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
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
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Receive Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
