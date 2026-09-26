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
import { PageHeader, FlatCard, Button, Badge, Modal, Input, Select, EmptyState } from '../../components/ui';

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
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Units of Measure (UoM)"
        description="Quantification standards, base reference ratios, and packaging conversion rates"
        badge={units.length}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchUom}
              disabled={loading}
              className={loading ? '[&>svg]:animate-spin text-amber-600' : ''}
            >
              Refresh
            </Button>

            {isManager && (
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setShowModal(true)}
              >
                New Unit
              </Button>
            )}
          </div>
        }
      />

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Card */}
      <FlatCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto mb-3" />
            Loading measurement units...
          </div>
        ) : units.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No units of measure found"
            description="Add measurement units (e.g., PCS, KG, LTR, BOX) to quantify physical products."
            action={
              isManager && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowModal(true)}
                >
                  Create First Unit
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Unit Name</th>
                  <th className="py-3 px-5">Code</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5 text-right">Conversion to Base</th>
                  <th className="py-3 px-5 text-center">Products</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                      {u.name}
                    </td>
                    <td className="py-3.5 px-5 font-mono font-medium text-amber-600 dark:text-amber-500">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40 text-[11px]">
                        {u.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300 capitalize">
                      {u.category}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {parseFloat(u.conversion_to_base || 1).toFixed(4)}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <Badge variant="neutral" size="sm">
                        {u.product_count}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Badge variant="success" size="sm" dot>
                        Active
                      </Badge>
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
        title="New Unit of Measure"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Unit Name *
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Kilogram, Box of 10, Liter"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Code *
              </label>
              <Input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="KG, BX10, LTR"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="unit">Unit / Count</option>
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
                <option value="length">Length</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Conversion to Base Ratio * (&gt; 0)
            </label>
            <Input
              type="number"
              step="0.0001"
              min="0.0001"
              required
              value={formData.conversion_to_base}
              onChange={(e) => setFormData({ ...formData, conversion_to_base: e.target.value })}
              placeholder="1.0"
              className="font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              e.g., If 1 BOX = 10 units, set conversion ratio to 10.0
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2.5">
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
              {modalLoading ? 'Saving...' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
