import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { 
  MapPin, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Warehouse,
  Barcode
} from 'lucide-react';

export default function LocationsPage() {
  const { isManager } = useAuth();
  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [formData, setFormData] = useState({
    warehouse_id: '',
    parent_location_id: '',
    name: '',
    code: '',
    type: 'internal',
    barcode: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [whData, locData] = await Promise.all([
        api.getWarehouses(),
        api.getLocations(selectedWarehouse || null)
      ]);
      setWarehouses(whData);
      setLocations(locData);
      if (!formData.warehouse_id && whData.length > 0) {
        setFormData(prev => ({ ...prev, warehouse_id: whData[0].id }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load location data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const payload = {
        warehouse_id: parseInt(formData.warehouse_id, 10),
        parent_location_id: formData.parent_location_id ? parseInt(formData.parent_location_id, 10) : null,
        name: formData.name,
        code: formData.code,
        type: formData.type,
        barcode: formData.barcode || null
      };

      await api.createLocation(payload);
      setSuccessMsg(`Storage location "${formData.name}" added successfully.`);
      setShowModal(false);
      setFormData({
        warehouse_id: warehouses[0]?.id || '',
        parent_location_id: '',
        name: '',
        code: '',
        type: 'internal',
        barcode: ''
      });
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create location.');
    } finally {
      setModalLoading(false);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'internal':
        return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase">Internal Bin</span>;
      case 'supplier':
        return <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase">Supplier In</span>;
      case 'customer':
        return <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold uppercase">Customer Out</span>;
      case 'inventory_loss':
        return <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold uppercase">Loss / Scrap</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Storage Locations</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
              {locations.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Physical aisles, racks, bins, zones, and external partner boundary locations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Warehouse Filter */}
          <div className="flex items-center gap-2">
            <Warehouse className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </select>
          </div>

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
              New Location
            </button>
          )}
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
            Loading warehouse locations...
          </div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No storage locations found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Create storage bins, racks, or staging locations inside your warehouse facility.
            </p>
            {isManager && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Location
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Warehouse</th>
                  <th className="py-2.5 px-4">Location Code</th>
                  <th className="py-2.5 px-4">Location Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Parent Location</th>
                  <th className="py-2.5 px-4">Barcode</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span className="font-mono text-blue-700 font-bold">{loc.warehouse_code}</span>
                      <span className="text-slate-500 ml-1.5 font-normal">({loc.warehouse_name})</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {loc.code}
                    </td>
                    <td className="py-3 px-4 text-slate-900 font-medium">
                      {loc.name}
                    </td>
                    <td className="py-3 px-4">
                      {getTypeBadge(loc.type)}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {loc.parent_location_name ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px]">
                          {loc.parent_location_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None (Root)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {loc.barcode ? (
                        <div className="flex items-center gap-1 text-slate-700">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span>{loc.barcode}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
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
          <div className="bg-white rounded border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">New Storage Location</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse Facility *
                </label>
                <select
                  required
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value, parent_location_id: '' })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent Location (Optional - for Hierarchy)
                </label>
                <select
                  value={formData.parent_location_id}
                  onChange={(e) => setFormData({ ...formData, parent_location_id: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  <option value="">— None (Top Level in Facility) —</option>
                  {locations
                    .filter((l) => !formData.warehouse_id || l.warehouse_id === parseInt(formData.warehouse_id, 10))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} - {l.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Zone A - Cold Storage, Rack 12-B"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="ZONE-A, RACK-12B"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    <option value="internal">Internal Storage</option>
                    <option value="supplier">Supplier Location</option>
                    <option value="customer">Customer Location</option>
                    <option value="inventory_loss">Inventory Loss / Scrap</option>
                    <option value="transit">Transit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Barcode (Optional)
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="Scan or input location barcode..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
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
                  {modalLoading ? 'Saving...' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
