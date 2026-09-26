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
  Barcode,
  Printer
} from 'lucide-react';
import BarcodeLabelModal from '../../components/common/PrintableBarcodeLabel';
import { PageHeader, FlatCard, Button, Badge, Modal, Input, Select, EmptyState } from '../../components/ui';

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
  const [labelModal, setLabelModal] = useState({ isOpen: false, location: null });
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
        return <Badge variant="neutral" size="sm">Internal Bin</Badge>;
      case 'supplier':
        return <Badge variant="success" size="sm">Supplier In</Badge>;
      case 'customer':
        return <Badge variant="amber" size="sm">Customer Out</Badge>;
      case 'inventory_loss':
        return <Badge variant="danger" size="sm">Loss / Scrap</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Storage Locations"
        description="Physical aisles, racks, bins, zones, and external partner boundary locations"
        badge={locations.length}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-44"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </Select>
            </div>

            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchData}
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
                New Location
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
            Loading warehouse locations...
          </div>
        ) : locations.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No storage locations found"
            description="Create storage bins, racks, or staging locations inside your warehouse facility."
            action={
              isManager && (
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setShowModal(true)}
                >
                  Create Location
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Warehouse</th>
                  <th className="py-3 px-5">Location Code</th>
                  <th className="py-3 px-5">Location Name</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5">Parent Location</th>
                  <th className="py-3 px-5">Barcode</th>
                  <th className="py-3 px-5 text-right">Status</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                      <span className="font-mono text-amber-600 dark:text-amber-500 font-semibold">{loc.warehouse_code}</span>
                      <span className="text-slate-400 ml-1.5 font-normal">({loc.warehouse_name})</span>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-medium text-slate-800 dark:text-slate-200">
                      {loc.code}
                    </td>
                    <td className="py-3.5 px-5 text-slate-900 dark:text-white font-medium">
                      {loc.name}
                    </td>
                    <td className="py-3.5 px-5">
                      {getTypeBadge(loc.type)}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400">
                      {loc.parent_location_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {loc.parent_location_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None (Root)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {loc.barcode ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Barcode className="w-3.5 h-3.5 text-slate-400" />
                          <span>{loc.barcode}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <Badge variant="success" size="sm" dot>
                        Active
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Printer}
                        onClick={() => setLabelModal({ isOpen: true, location: loc })}
                      >
                        Bin Label
                      </Button>
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
        title="New Storage Location"
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
              Warehouse Facility *
            </label>
            <Select
              required
              value={formData.warehouse_id}
              onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value, parent_location_id: '' })}
            >
              <option value="">Select Warehouse...</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.code} - {wh.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Parent Location (Optional - for Hierarchy)
            </label>
            <Select
              value={formData.parent_location_id}
              onChange={(e) => setFormData({ ...formData, parent_location_id: e.target.value })}
            >
              <option value="">— None (Top Level in Facility) —</option>
              {locations
                .filter((l) => !formData.warehouse_id || l.warehouse_id === parseInt(formData.warehouse_id, 10))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} - {l.name}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Location Name *
            </label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Zone A - Cold Storage, Rack 12-B"
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
                placeholder="ZONE-A, RACK-12B"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Type
              </label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="internal">Internal Storage</option>
                <option value="supplier">Supplier Location</option>
                <option value="customer">Customer Location</option>
                <option value="inventory_loss">Inventory Loss / Scrap</option>
                <option value="transit">Transit</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Barcode (Optional)
            </label>
            <Input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Scan or input location barcode..."
              className="font-mono"
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
              {modalLoading ? 'Saving...' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable Barcode Label Modal */}
      <BarcodeLabelModal
        isOpen={labelModal.isOpen}
        onClose={() => setLabelModal({ isOpen: false, location: null })}
        entityType="location"
        barcode={labelModal.location?.barcode || labelModal.location?.code}
        title={labelModal.location?.name}
        subtitle={`Location Code: ${labelModal.location?.code}`}
        details={[
          { label: 'Warehouse', value: labelModal.location?.warehouse_name || labelModal.location?.warehouse_code },
          { label: 'Type', value: labelModal.location?.type?.toUpperCase() },
          { label: 'Barcode', value: labelModal.location?.barcode || labelModal.location?.code }
        ]}
      />
    </div>
  );
}
