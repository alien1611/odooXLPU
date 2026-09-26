import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { 
  FolderTree, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Layers
} from 'lucide-react';
import { PageHeader, FlatCard, Button, Badge, Modal, Input, Select, EmptyState } from '../../components/ui';

export default function CategoriesPage() {
  const { isManager } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '',
    description: ''
  });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const payload = {
        name: formData.name,
        parent_id: formData.parent_id ? parseInt(formData.parent_id, 10) : null,
        description: formData.description || null
      };

      await api.createCategory(payload);
      setSuccessMsg(`Category "${formData.name}" created successfully.`);
      setShowModal(false);
      setFormData({ name: '', parent_id: '', description: '' });
      fetchCategories();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create category.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Product Categories"
        description="Hierarchical taxonomy for organizing warehouse catalog and inventory lines"
        badge={categories.length}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchCategories}
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
                New Category
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
            Loading category taxonomy...
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No categories found"
            description="Get started by establishing product categories to group inventory items and manage taxonomy."
            action={
              isManager && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowModal(true)}
                >
                  Create First Category
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Category Name</th>
                  <th className="py-3 px-5">Parent Category</th>
                  <th className="py-3 px-5">Description</th>
                  <th className="py-3 px-5 text-center">Product Count</th>
                  <th className="py-3 px-5 text-right">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">
                      {c.parent_name ? (
                        <Badge variant="neutral" size="sm">
                          {c.parent_name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 italic">None (Root)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {c.description || '—'}
                    </td>
                    <td className="py-3.5 px-5 text-center font-mono">
                      <Badge variant="amber" size="sm">
                        {c.product_count}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-[11px] text-slate-400">
                      {new Date(c.created_at).toLocaleDateString()}
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
        title="New Product Category"
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
              Category Name *
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Raw Materials, Electronics, Perishables"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Parent Category (Optional)
            </label>
            <Select
              value={formData.parent_id}
              onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
            >
              <option value="">— None (Top Level) —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Catalog scope and handling notes..."
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
              {modalLoading ? 'Saving...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
