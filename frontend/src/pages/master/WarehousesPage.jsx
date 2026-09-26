import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { 
  Warehouse, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  MapPin
} from 'lucide-react';
import { PageHeader, FlatCard, Button, Badge, Modal, Input, EmptyState } from '../../components/ui';

export default function WarehousesPage() {
  const { isManager } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
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
    address: ''
  });

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWarehouses();
      setWarehouses(data);
    } catch (err) {
      setError(err.message || 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        address: formData.address || null
      };

      await api.createWarehouse(payload);
      setSuccessMsg(`Warehouse "${formData.name}" established successfully.`);
      setShowModal(false);
      setFormData({ name: '', code: '', address: '' });
      fetchWarehouses();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create warehouse.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Warehouse Facilities"
        description="Physical logistic centers, distribution hubs, and storage facilities"
        badge={warehouses.length}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchWarehouses}
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
                New Warehouse
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
            Loading warehouse facilities...
          </div>
        ) : warehouses.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="No warehouses registered"
            description="Register a warehouse facility to start tracking inventory across zones and storage bins."
            action={
              isManager && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowModal(true)}
                >
                  Register Facility
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Warehouse Code</th>
                  <th className="py-3 px-5">Facility Name</th>
                  <th className="py-3 px-5">Address</th>
                  <th className="py-3 px-5 text-center">Locations</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-medium text-amber-600 dark:text-amber-500">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40 text-[11px]">
                        {w.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                      {w.name}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400">
                      {w.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{w.address}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <Badge variant="neutral" size="sm">
                        {w.location_count}
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
        title="Register Warehouse Facility"
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
              Warehouse Name *
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Central Logistics Hub, East Coast Depot"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Code *
            </label>
            <Input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="WH-MAIN, WH-EAST"
              className="font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Physical Address
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street, City, State, Postal Code..."
              className="w-full px-4 py-2.5 text-xs bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
            />
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
              {modalLoading ? 'Saving...' : 'Establish Facility'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
