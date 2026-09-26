import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { 
  Scale, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X
} from 'lucide-react';

export default function UomPage() {
  const { isManager } = useAuth();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'unit',
    conversion_to_base: '1.0'
  });

  const fetchUom = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUom();
      setUnits(data);
    } catch (err) {
      setError(err.message || 'Failed to load units of measure.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUom();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        category: formData.category,
        conversion_to_base: parseFloat(formData.conversion_to_base)
      };

      await api.createUom(payload);
      setSuccessMsg(`Unit of Measure "${formData.name}" created successfully.`);
      setShowModal(false);
      setFormData({ name: '', code: '', category: 'unit', conversion_to_base: '1.0' });
      fetchUom();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create Unit of Measure.');
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
            <Scale className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Units of Measure (UoM)</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
              {units.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quantification standards, base reference ratios, and packaging conversion rates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchUom}
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
              New Unit
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
            Loading measurement units...
          </div>
        ) : units.length === 0 ? (
          <div className="p-12 text-center">
            <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No units of measure found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Add measurement units (e.g., PCS, KG, LTR, BOX) to quantify physical products.
            </p>
            {isManager && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Unit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Unit Name</th>
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Conversion to Base</th>
                  <th className="py-2.5 px-4 text-center">Products</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                        {u.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">
                      {u.category}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-700">
                      {parseFloat(u.conversion_to_base || 1).toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {u.product_count}
                      </span>
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
              <h3 className="text-sm font-semibold text-slate-900">New Unit of Measure</h3>
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
                  Unit Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Kilogram, Box of 10, Liter"
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
                    placeholder="KG, BX10, LTR"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    <option value="unit">Unit / Count</option>
                    <option value="weight">Weight</option>
                    <option value="volume">Volume</option>
                    <option value="length">Length</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conversion to Base Ratio * (&gt; 0)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={formData.conversion_to_base}
                  onChange={(e) => setFormData({ ...formData, conversion_to_base: e.target.value })}
                  placeholder="1.0"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  e.g., If 1 BOX = 10 units, set conversion ratio to 10.0
                </span>
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
                  {modalLoading ? 'Saving...' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
