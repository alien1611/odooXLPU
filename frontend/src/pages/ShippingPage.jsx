import React, { useState, useEffect } from 'react';
import api from '../api/client';
import useAuth from '../hooks/useAuth';
import ShippingDocumentModal from '../components/shipping/ShippingDocumentModal';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import {
  Truck,
  Package,
  Layers,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Printer,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Scale,
  Check,
  Boxes,
  Ban,
  Clock,
  Send,
  SlidersHorizontal,
  Info
} from 'lucide-react';


export default function ShippingPage() {
  const { user, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('packing_station'); // 'packing_station' | 'packages' | 'dispatch' | 'carriers'
  
  // Master lists
  const [readyDeliveries, setReadyDeliveries] = useState([]);
  const [packages, setPackages] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Packing Station active delivery & packages
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [deliveryPackages, setDeliveryPackages] = useState([]);
  const [activePackage, setActivePackage] = useState(null);
  const [deliveryLines, setDeliveryLines] = useState([]);

  // Create Package Form Modal
  const [showCreatePkgModal, setShowCreatePkgModal] = useState(false);
  const [pkgFormData, setPkgFormData] = useState({
    package_type: 'box',
    length: '30',
    width: '20',
    height: '15',
    dimension_unit: 'cm',
    gross_weight: '5.000',
    tare_weight: '0.500',
    weight_unit: 'kg',
    notes: ''
  });

  // Pack Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedLineForPacking, setSelectedLineForPacking] = useState(null);
  const [packQtyInput, setPackQtyInput] = useState('1');

  // Carrier Assignment & Dispatch Modal
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchPackageTarget, setDispatchPackageTarget] = useState(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [manualTrackingNumber, setManualTrackingNumber] = useState('');

  // Create Carrier Modal
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [carrierFormData, setCarrierFormData] = useState({
    carrier_code: '',
    carrier_name: '',
    service_level: 'Standard Ground',
    tracking_prefix: 'GND'
  });

  // Document Print Modal
  const [docModal, setDocModal] = useState({
    isOpen: false,
    type: 'PACKING_SLIP',
    data: null
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [delivs, pkgs, crrs, whs] = await Promise.all([
        api.getReadyDeliveries({
          warehouse_id: selectedWarehouse || null,
          search: deliverySearch || null
        }),
        api.getPackages({
          warehouse_id: selectedWarehouse || null,
          status: statusFilter || null
        }),
        api.getCarriers(),
        api.getWarehouses()
      ]);

      setReadyDeliveries(delivs);
      setPackages(pkgs);
      setCarriers(crrs);
      setWarehouses(whs);

      // If a delivery is currently selected in packing station, reload its packages
      if (selectedDelivery) {
        const updatedDeliveryPkgs = pkgs.filter(p => p.delivery_id === selectedDelivery.id);
        setDeliveryPackages(updatedDeliveryPkgs);
        if (activePackage) {
          const updatedActive = await api.getPackageById(activePackage.id);
          setActivePackage(updatedActive);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load shipping data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouse, statusFilter]);

  // Select delivery for packing station
  const selectDeliveryForPacking = async (deliv) => {
    setSelectedDelivery(deliv);
    setError(null);
    try {
      const fullDelivery = await api.getDeliveryById(deliv.id);
      setDeliveryLines(fullDelivery.lines || []);
      const pkgs = await api.getPackages({ delivery_id: deliv.id });
      setDeliveryPackages(pkgs);
      if (pkgs.length > 0) {
        const fullPkg = await api.getPackageById(pkgs[0].id);
        setActivePackage(fullPkg);
      } else {
        setActivePackage(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load delivery details.');
    }
  };

  // Select package in packing station
  const selectActivePackage = async (pkg) => {
    try {
      const fullPkg = await api.getPackageById(pkg.id);
      setActivePackage(fullPkg);
    } catch (err) {
      setError(err.message || 'Failed to load package details.');
    }
  };

  // Handle Create Package
  const handleCreatePackage = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;
    setActionLoading(true);
    setError(null);
    try {
      const payload = {
        delivery_id: selectedDelivery.id,
        warehouse_id: selectedDelivery.source_warehouse_id,
        ...pkgFormData,
        length: parseFloat(pkgFormData.length),
        width: parseFloat(pkgFormData.width),
        height: parseFloat(pkgFormData.height),
        gross_weight: parseFloat(pkgFormData.gross_weight),
        tare_weight: parseFloat(pkgFormData.tare_weight)
      };
      const newPkg = await api.createPackage(payload);
      setSuccessMsg(`Package ${newPkg.package_number} created.`);
      setShowCreatePkgModal(false);
      await fetchData();
      await selectDeliveryForPacking(selectedDelivery);
      const full = await api.getPackageById(newPkg.id);
      setActivePackage(full);
    } catch (err) {
      setError(err.message || 'Failed to create package.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pack Line
  const handleAddLineToPackage = async (e) => {
    e.preventDefault();
    if (!activePackage || !selectedLineForPacking) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.addPackageLine(activePackage.id, {
        delivery_line_id: selectedLineForPacking.id,
        product_id: selectedLineForPacking.product_id,
        lot_id: selectedLineForPacking.lot_id || null,
        packed_qty: parseFloat(packQtyInput)
      });
      setSuccessMsg(`Added ${packQtyInput} units of ${selectedLineForPacking.product_name} into package.`);
      setShowAddItemModal(false);
      await fetchData();
      await selectDeliveryForPacking(selectedDelivery);
      const full = await api.getPackageById(activePackage.id);
      setActivePackage(full);
    } catch (err) {
      setError(err.message || 'Failed to add item to package.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Remove Line
  const handleRemoveLine = async (lineId) => {
    if (!activePackage) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.removePackageLine(activePackage.id, lineId);
      setSuccessMsg('Item removed from package.');
      await fetchData();
      await selectDeliveryForPacking(selectedDelivery);
      const full = await api.getPackageById(activePackage.id);
      setActivePackage(full);
    } catch (err) {
      setError(err.message || 'Failed to remove line.');
    } finally {
      setActionLoading(false);
    }
  };

  // Mark Package as Packed
  const handleMarkPacked = async (pkgId) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.packPackage(pkgId, {});
      setSuccessMsg(`Package ${res.package_number} marked as packed and ready for dispatch!`);
      await fetchData();
      if (selectedDelivery) await selectDeliveryForPacking(selectedDelivery);
    } catch (err) {
      setError(err.message || 'Failed to mark package as packed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Dispatch Modal
  const openDispatchModal = (pkg) => {
    setDispatchPackageTarget(pkg);
    setSelectedCarrierId(pkg.carrier_id ? String(pkg.carrier_id) : (carriers[0]?.id ? String(carriers[0].id) : ''));
    setManualTrackingNumber(pkg.tracking_number || '');
    setShowDispatchModal(true);
  };

  // Execute Dispatch
  const handleExecuteDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchPackageTarget || !selectedCarrierId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.dispatchPackage(dispatchPackageTarget.id, {
        carrier_id: parseInt(selectedCarrierId, 10),
        tracking_number: manualTrackingNumber || null
      });
      setSuccessMsg(`Package ${res.package_number} dispatched via ${res.carrier_name} (Ref: ${res.tracking_number}).`);
      setShowDispatchModal(false);
      await fetchData();
      if (selectedDelivery) await selectDeliveryForPacking(selectedDelivery);
    } catch (err) {
      setError(err.message || 'Failed to dispatch package.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Document Modals
  const openDocument = async (pkgId, type) => {
    setError(null);
    try {
      const docData = type === 'BILL_OF_LADING'
        ? await api.getBillOfLading(pkgId)
        : await api.getPackingSlip(pkgId);
      setDocModal({
        isOpen: true,
        type,
        data: docData
      });
    } catch (err) {
      setError(err.message || `Failed to generate ${type}.`);
    }
  };

  // Handle Create Carrier
  const handleCreateCarrier = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      await api.createCarrier(carrierFormData);
      setSuccessMsg(`Carrier ${carrierFormData.carrier_name} created successfully.`);
      setShowCarrierModal(false);
      setCarrierFormData({ carrier_code: '', carrier_name: '', service_level: 'Standard Ground', tracking_prefix: 'GND' });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to create carrier.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'packing':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold uppercase animate-pulse">Packing</span>;
      case 'packed':
        return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase">Packed</span>;
      case 'dispatched':
        return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase">Dispatched</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold uppercase">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Shipping & Freight Carrier Dispatch"
        subtitle="Cartonization, manual weight capture, packing slips, bills of lading, and local outbound carrier dispatch."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              title="Refresh Data"
              icon={RefreshCw}
              className={loading ? 'animate-spin' : ''}
            />
            {isManager && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCarrierModal(true)}
                icon={Plus}
              >
                Add Local Carrier
              </Button>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50/80 backdrop-blur-md border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-600 hover:text-emerald-800" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50/80 backdrop-blur-md border border-rose-200/80 text-rose-800 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-600 hover:text-rose-800" />
          </button>
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="flex flex-wrap bg-black/[0.04] p-1 rounded-full text-xs font-medium gap-1 border border-black/[0.04] w-fit">
        <button
          onClick={() => setActiveTab('packing_station')}
          className={`px-4 py-1.5 rounded-full flex items-center gap-2 transition-all ${
            activeTab === 'packing_station'
              ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Packing Station
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-1.5 rounded-full flex items-center gap-2 transition-all ${
            activeTab === 'packages'
              ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          Cartons & Packages ({packages.length})
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`px-4 py-1.5 rounded-full flex items-center gap-2 transition-all ${
            activeTab === 'dispatch'
              ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Outbound Dispatch ({packages.filter(p => p.status === 'packed').length} Ready)
        </button>

        <button
          onClick={() => setActiveTab('carriers')}
          className={`px-4 py-1.5 rounded-full flex items-center gap-2 transition-all ${
            activeTab === 'carriers'
              ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Carrier Network ({carriers.length})
        </button>
      </div>

      {/* TAB 1: PACKING STATION */}
      {activeTab === 'packing_station' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Delivery Orders Ready for Packing */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pick Deliveries ({readyDeliveries.length})
                </span>
                <span className="text-[10px] text-slate-400">Ready to pack</span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter order ref or customer..."
                  value={deliverySearch}
                  onChange={(e) => setDeliverySearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchData(); }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Deliveries List */}
              <div className="space-y-2 max-h-[550px] overflow-y-auto">
                {readyDeliveries.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No picked orders waiting to be packed.
                  </div>
                ) : (
                  readyDeliveries.map(d => {
                    const isSelected = selectedDelivery?.id === d.id;
                    return (
                      <div
                        key={d.id}
                        onClick={() => selectDeliveryForPacking(d)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-400'
                            : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-blue-700">{d.reference}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                            d.packing_complete
                              ? 'bg-emerald-100 text-emerald-800'
                              : d.already_packed_qty > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {d.packing_complete ? 'Fully Packed' : d.already_packed_qty > 0 ? 'Partial' : 'Unpacked'}
                          </span>
                        </div>
                        <div className="font-medium text-xs text-slate-800 mt-1 truncate">{d.customer_name}</div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                          <span>{d.warehouse_name}</span>
                          <span className="font-mono font-semibold">
                            {parseFloat(d.already_packed_qty)} / {parseFloat(d.deliverable_qty)} units
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Packing Desk & Cartonization Workspace */}
          <div className="lg:col-span-8 space-y-4">
            {!selectedDelivery ? (
              <div className="bg-white p-12 rounded-lg border border-slate-200 shadow-2xs text-center space-y-2">
                <Package className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-700">Select a Delivery to Begin Packing</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click any delivery from the left queue to open the packing station, create cartons, and record weights.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Station Delivery Banner */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-blue-700">{selectedDelivery.reference}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="font-semibold text-slate-900 text-sm">{selectedDelivery.customer_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Warehouse: <span className="font-medium text-slate-700">{selectedDelivery.warehouse_name}</span> &bull; Status: <span className="uppercase font-semibold text-emerald-700">{selectedDelivery.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreatePkgModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Carton / Box
                    </button>
                  </div>
                </div>

                {/* Carton Selector Chips */}
                {deliveryPackages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Cartons ({deliveryPackages.length}):</span>
                    {deliveryPackages.map((p, idx) => {
                      const isActive = activePackage?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => selectActivePackage(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-2 border transition-all ${
                            isActive
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span>Box #{idx + 1} ({p.package_number})</span>
                          {getStatusBadge(p.status)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Active Carton Detail Workspace */}
                {activePackage ? (
                  <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                    {/* Carton Specs Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Active Carton: {activePackage.package_number}
                          </h3>
                          {getStatusBadge(activePackage.status)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Dim: {activePackage.length}×{activePackage.width}×{activePackage.height} {activePackage.dimension_unit} &bull; Gross: {activePackage.gross_weight} {activePackage.weight_unit} &bull; Net: <strong className="text-slate-800">{activePackage.net_weight} {activePackage.weight_unit}</strong>
                        </div>
                      </div>

                      {/* Package Operations Buttons */}
                      <div className="flex items-center gap-1.5">
                        {activePackage.status === 'packing' && (
                          <button
                            onClick={() => handleMarkPacked(activePackage.id)}
                            disabled={actionLoading || activePackage.lines.length === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Finish & Mark Packed
                          </button>
                        )}

                        <button
                          onClick={() => openDocument(activePackage.id, 'PACKING_SLIP')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-medium transition-colors"
                          title="Print Packing Slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          Slip
                        </button>

                        <button
                          onClick={() => openDocument(activePackage.id, 'BILL_OF_LADING')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded text-xs font-medium transition-colors"
                          title="Print Bill of Lading"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          BOL
                        </button>

                        {activePackage.status === 'packed' && (
                          <button
                            onClick={() => openDispatchModal(activePackage)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-2xs transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Dispatch
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Items inside this carton */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 uppercase tracking-wider">
                          Packed Carton Items ({activePackage.lines.length})
                        </span>
                        <span className="text-slate-500 font-mono">
                          Total: {activePackage.lines.reduce((s, l) => s + parseFloat(l.packed_qty), 0)} units
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                            <tr>
                              <th className="py-2 px-3">Product</th>
                              <th className="py-2 px-3">Lot / Batch</th>
                              <th className="py-2 px-3 text-right">Packed Qty</th>
                              <th className="py-2 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activePackage.lines.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-4 text-center text-slate-400">
                                  No items packed in this carton yet. Choose items below to pack.
                                </td>
                              </tr>
                            ) : (
                              activePackage.lines.map(l => (
                                <tr key={l.id} className="hover:bg-slate-50">
                                  <td className="py-2 px-3">
                                    <div className="font-semibold text-slate-900">{l.product_name}</div>
                                    <div className="font-mono text-[10px] text-slate-400">{l.product_sku}</div>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-blue-700">
                                    {l.lot_number || 'Standard (No Lot)'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                    {parseFloat(l.packed_qty)} {l.uom_name}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {activePackage.status === 'packing' && (
                                      <button
                                        onClick={() => handleRemoveLine(l.id)}
                                        className="text-rose-600 hover:text-rose-800 text-xs font-medium"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-6 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No active carton selected. Click "+ Add Carton / Box" above to create carton #1 for this delivery.
                  </div>
                )}

                {/* Delivery Lines Remaining to Pack */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Available Delivery Items (Ready to Pack)
                  </h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                        <tr>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 text-right">Deliverable</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveryLines.map(line => {
                          const deliverable = parseFloat(line.done_qty > 0 ? line.done_qty : line.requested_qty);
                          return (
                            <tr key={line.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900">{line.product_name}</div>
                                <div className="font-mono text-[10px] text-slate-400">{line.product_sku}</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {deliverable} units
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedLineForPacking(line);
                                    setPackQtyInput(String(deliverable));
                                    setShowAddItemModal(true);
                                  }}
                                  disabled={!activePackage || activePackage.status !== 'packing'}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded text-[11px] font-semibold transition-colors"
                                >
                                  Pack into Carton
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PACKAGES & CARTONS */}
      {activeTab === 'packages' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Cartonization Inventory ({packages.length} Cartons)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Filter Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">All Statuses</option>
                <option value="packing">Packing</option>
                <option value="packed">Packed</option>
                <option value="dispatched">Dispatched</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Package #</th>
                  <th className="py-2.5 px-3">Delivery Order</th>
                  <th className="py-2.5 px-3">Dimensions</th>
                  <th className="py-2.5 px-3 text-right">Gross Wt</th>
                  <th className="py-2.5 px-3 text-right">Net Wt</th>
                  <th className="py-2.5 px-3">Carrier / Tracking</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">{p.package_number}</td>
                    <td className="py-2 px-3 font-mono text-slate-800">{p.delivery_reference}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">
                      {p.length}×{p.width}×{p.height} {p.dimension_unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{p.gross_weight} {p.weight_unit}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">{p.net_weight} {p.weight_unit}</td>
                    <td className="py-2 px-3">
                      {p.carrier_name ? (
                        <div>
                          <div className="font-semibold text-slate-900">{p.carrier_name}</div>
                          <div className="font-mono text-[10px] text-blue-700">{p.tracking_number}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">{getStatusBadge(p.status)}</td>
                    <td className="py-2 px-3 text-center space-x-1">
                      <button
                        onClick={() => openDocument(p.id, 'PACKING_SLIP')}
                        className="px-2 py-0.5 border border-slate-200 rounded hover:bg-slate-100 text-[10px] font-semibold text-slate-700"
                      >
                        Slip
                      </button>
                      <button
                        onClick={() => openDocument(p.id, 'BILL_OF_LADING')}
                        className="px-2 py-0.5 border border-slate-200 rounded hover:bg-slate-100 text-[10px] font-semibold text-indigo-700"
                      >
                        BOL
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OUTBOUND DISPATCH */}
      {activeTab === 'dispatch' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Outbound Freight Dispatch Station
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Packages that have completed packing and are staged on the shipping dock awaiting carrier assignment and manifest dispatch.
              </p>
            </div>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 font-bold font-mono text-xs rounded">
              {packages.filter(p => p.status === 'packed').length} Awaiting Dispatch
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Carton #</th>
                  <th className="py-2.5 px-3">Delivery Ref</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Net Weight</th>
                  <th className="py-2.5 px-3">Carrier Assignment</th>
                  <th className="py-2.5 px-3 text-center">Dispatch Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.filter(p => p.status === 'packed').length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      All packed cartons have been dispatched. No cartons waiting for carrier pickup.
                    </td>
                  </tr>
                ) : (
                  packages.filter(p => p.status === 'packed').map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{p.package_number}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-800">{p.delivery_reference}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{p.customer_name}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {p.net_weight} {p.weight_unit}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.carrier_name ? (
                          <span className="font-semibold text-slate-800">{p.carrier_name}</span>
                        ) : (
                          <span className="text-amber-700 text-[11px] font-medium">Pending Assignment</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => openDispatchModal(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Assign & Dispatch
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CARRIERS */}
      {activeTab === 'carriers' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Local Carrier Network ({carriers.length})
            </span>
            {isManager && (
              <button
                onClick={() => setShowCarrierModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Carrier
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {carriers.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs font-mono">
                    {c.carrier_code}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900">{c.carrier_name}</div>
                    <div className="text-xs text-slate-500">
                      Service: <span className="font-medium text-slate-700">{c.service_level}</span> &bull; Prefix: <span className="font-mono text-blue-700">{c.tracking_prefix}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded uppercase">
                    Active Local
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Package Modal */}
      {showCreatePkgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Create Carton / Package</h3>
              <button onClick={() => setShowCreatePkgModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Package Type</label>
                <select
                  value={pkgFormData.package_type}
                  onChange={(e) => setPkgFormData(prev => ({ ...prev, package_type: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                >
                  <option value="box">Standard Corrugated Box</option>
                  <option value="carton">Master Carton</option>
                  <option value="pallet">Pallet Container</option>
                  <option value="crate">Wooden Crate</option>
                  <option value="envelope">Padded Freight Mailer</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Length (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={pkgFormData.length}
                    onChange={(e) => setPkgFormData(prev => ({ ...prev, length: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Width (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={pkgFormData.width}
                    onChange={(e) => setPkgFormData(prev => ({ ...prev, width: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={pkgFormData.height}
                    onChange={(e) => setPkgFormData(prev => ({ ...prev, height: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gross Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={pkgFormData.gross_weight}
                    onChange={(e) => setPkgFormData(prev => ({ ...prev, gross_weight: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tare Weight (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={pkgFormData.tare_weight}
                    onChange={(e) => setPkgFormData(prev => ({ ...prev, tare_weight: e.target.value }))}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                <span>Calculated Net Weight:</span>
                <span className="font-mono font-bold">
                  {Math.max(0, (parseFloat(pkgFormData.gross_weight || 0) - parseFloat(pkgFormData.tare_weight || 0)).toFixed(3))} kg
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePkgModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Create Carton
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Line to Package Modal */}
      {showAddItemModal && selectedLineForPacking && activePackage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Pack Item into {activePackage.package_number}</h3>
              <button onClick={() => setShowAddItemModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLineToPackage} className="p-5 space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase block">Product</span>
                <div className="font-semibold text-sm text-slate-800">{selectedLineForPacking.product_name}</div>
                <div className="font-mono text-xs text-slate-400">{selectedLineForPacking.product_sku}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity to Pack</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={packQtyInput}
                  onChange={(e) => setPackQtyInput(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Confirm Packing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && dispatchPackageTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Outbound Carrier Dispatch: {dispatchPackageTarget.package_number}
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteDispatch} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Freight Carrier</label>
                <select
                  value={selectedCarrierId}
                  onChange={(e) => setSelectedCarrierId(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                  required
                >
                  <option value="">-- Choose Carrier --</option>
                  {carriers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.carrier_name} ({c.service_level}) &bull; Prefix: {c.tracking_prefix}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Local Tracking / Pro Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate local tracking"
                  value={manualTrackingNumber}
                  onChange={(e) => setManualTrackingNumber(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Stockyard auto-generates internal tracking with carrier prefix if blank.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !selectedCarrierId}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Confirm Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Carrier Modal */}
      {showCarrierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Freight / Parcel Carrier</h3>
              <button onClick={() => setShowCarrierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCarrier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier Code</label>
                <input
                  type="text"
                  placeholder="e.g. FEDEX, UPS, LOCAL"
                  value={carrierFormData.carrier_code}
                  onChange={(e) => setCarrierFormData(prev => ({ ...prev, carrier_code: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded uppercase font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier Name</label>
                <input
                  type="text"
                  placeholder="e.g. National Express Air Cargo"
                  value={carrierFormData.carrier_name}
                  onChange={(e) => setCarrierFormData(prev => ({ ...prev, carrier_name: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Level</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Freight, Next Day Air"
                  value={carrierFormData.service_level}
                  onChange={(e) => setCarrierFormData(prev => ({ ...prev, service_level: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tracking Number Prefix</label>
                <input
                  type="text"
                  placeholder="e.g. TRK, EXP, GND"
                  value={carrierFormData.tracking_prefix}
                  onChange={(e) => setCarrierFormData(prev => ({ ...prev, tracking_prefix: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded uppercase font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCarrierModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Save Carrier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Document Modal */}
      <ShippingDocumentModal
        isOpen={docModal.isOpen}
        onClose={() => setDocModal(prev => ({ ...prev, isOpen: false }))}
        documentType={docModal.type}
        documentData={docModal.data}
      />
    </div>
  );
}
