import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import BarcodeLabelModal, { BarcodeSvg } from '../../components/common/PrintableBarcodeLabel';
import {
  Scan,
  Search,
  Package,
  MapPin,
  ShieldAlert,
  ArrowDownToLine,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  ChevronRight,
  ArrowRight,
  Layers,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Boxes,
  ArrowUpRight,
  Play,
  CheckSquare,
  Truck
} from 'lucide-react';

// Web Audio API beep feedback
function playSound(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio errors if browser blocks autoplay
  }

  // Haptic feedback if supported on mobile
  if (navigator.vibrate) {
    try {
      if (type === 'success') navigator.vibrate(60);
      else navigator.vibrate([100, 50, 100]);
    } catch (e) {}
  }
}

export default function ScannerPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('lookup'); // 'lookup' | 'receiving' | 'cycle_count'

  // Global scan input state
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const scanInputRef = useRef(null);

  // Print Label Modal State
  const [labelModal, setLabelModal] = useState({
    isOpen: false,
    entityType: 'product',
    barcode: '',
    title: '',
    subtitle: '',
    details: []
  });

  // --- TAB 1: LOOKUP STATE ---
  const [lookupResult, setLookupResult] = useState(null);
  const [locationQuants, setLocationQuants] = useState([]);

  // --- TAB 2: RECEIVING FLOW STATE ---
  const [recvStep, setRecvStep] = useState(1); // 1: scan prod, 2: lot info, 3: scan loc, 4: qty & submit
  const [recvProduct, setRecvProduct] = useState(null);
  const [recvLotNumber, setRecvLotNumber] = useState('');
  const [recvExpiryDate, setRecvExpiryDate] = useState('');
  const [recvLocation, setRecvLocation] = useState(null);
  const [recvQuantity, setRecvQuantity] = useState('10');
  const [recvCostPrice, setRecvCostPrice] = useState('0.00');
  const [recvSubmitting, setRecvSubmitting] = useState(false);
  const [recvSuccessReceipt, setRecvSuccessReceipt] = useState(null);

  // --- TAB 3: CYCLE COUNT FLOW STATE ---
  const [ccStep, setCcStep] = useState(1); // 1: scan loc, 2: scan items & count
  const [ccLocation, setCcLocation] = useState(null);
  const [ccInventory, setCcInventory] = useState([]);
  const [ccCounts, setCcCounts] = useState({}); // { quantId: countedQty }
  const [ccSelectedProduct, setCcSelectedProduct] = useState(null);
  const [ccCountQty, setCcCountQty] = useState('');
  const [ccSubmitting, setCcSubmitting] = useState(false);

  // --- TAB 4: WAVE PICKING STATE ---
  const [wavesList, setWavesList] = useState([]);
  const [selectedWaveId, setSelectedWaveId] = useState('');
  const [activeWaveData, setActiveWaveData] = useState(null);
  const [waveActionLoading, setWaveActionLoading] = useState(false);
  const [highlightLocation, setHighlightLocation] = useState(null);

  // --- TAB 5: BIN REPLENISHMENT STATE ---
  const [replenishTasks, setReplenishTasks] = useState([]);
  const [selectedReplenishId, setSelectedReplenishId] = useState('');
  const [replenishTransferQty, setReplenishTransferQty] = useState('');
  const [replenishActionLoading, setReplenishActionLoading] = useState(false);
  const [replenishVerified, setReplenishVerified] = useState({ source: false, product: false, dest: false });

  // Focus scan input on tab change or mount
  useEffect(() => {
    scanInputRef.current?.focus();
  }, [activeTab, recvStep, ccStep, selectedWaveId, selectedReplenishId]);

  useEffect(() => {
    if (activeTab === 'wave_picking') {
      api.getWaves().then(data => setWavesList(data)).catch(() => {});
    } else if (activeTab === 'replenish') {
      api.getReplenishments().then(data => setReplenishTasks(data)).catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedWaveId) {
      api.getWaveById(selectedWaveId)
        .then(data => setActiveWaveData(data))
        .catch(err => setErrorMessage(err.message || 'Failed to load wave details.'));
    } else {
      setActiveWaveData(null);
    }
  }, [selectedWaveId]);

  useEffect(() => {
    if (selectedReplenishId) {
      const task = replenishTasks.find(t => t.id === selectedReplenishId);
      if (task) {
        setReplenishTransferQty(String(task.suggested_qty || ''));
        setReplenishVerified({ source: false, product: false, dest: false });
      }
    }
  }, [selectedReplenishId, replenishTasks]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Main Barcode Dispatcher
  const handleBarcodeSubmit = async (e) => {
    if (e) e.preventDefault();
    const code = scanInput.trim();
    if (!code) return;

    setScanning(true);
    clearMessages();
    setLastScannedCode(code);

    try {
      // Check if code is a Wave reference
      if (code.toUpperCase().startsWith('WAVE-')) {
        const waves = await api.getWaves();
        const found = waves.find(w => w.wave_number.toUpperCase() === code.toUpperCase());
        if (found) {
          playSound('success');
          setActiveTab('wave_picking');
          setSelectedWaveId(found.id);
          setScanInput('');
          setSuccessMessage(`Loaded Pick Wave ${found.wave_number} (${found.status})`);
          return;
        }
      }

      // Check if code is a Replenishment task number
      if (code.toUpperCase().startsWith('REP-')) {
        const tasks = await api.getReplenishments();
        const found = tasks.find(t => t.task_number.toUpperCase() === code.toUpperCase());
        if (found) {
          playSound('success');
          setActiveTab('replenish');
          setSelectedReplenishId(found.id);
          setScanInput('');
          setSuccessMessage(`Loaded Replenishment Task ${found.task_number}`);
          return;
        }
      }

      const data = await api.lookupBarcode(code);
      playSound('success');
      setScanInput('');

      if (activeTab === 'lookup') {
        setLookupResult(data);
        if (data.entity_type === 'location') {
          const inv = await api.getLocationInventory(data.entity_id);
          setLocationQuants(inv);
        } else {
          setLocationQuants([]);
        }
      } else if (activeTab === 'wave_picking') {
        handleWavePickingScan(data);
      } else if (activeTab === 'replenish') {
        handleReplenishScan(data);
      } else if (activeTab === 'receiving') {
        handleReceivingScan(data);
      } else if (activeTab === 'cycle_count') {
        handleCycleCountScan(data);
      }
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || `Barcode "${code}" not found.`);
      setScanInput('');
    } finally {
      setScanning(false);
      scanInputRef.current?.focus();
    }
  };

  // --- WAVE PICKING SCAN HANDLER ---
  const handleWavePickingScan = (entity) => {
    if (!activeWaveData) {
      setErrorMessage('Please select or scan an active Pick Wave first.');
      return;
    }
    if (entity.entity_type === 'location') {
      const locCode = entity.details?.code || entity.display_name;
      setHighlightLocation(locCode);
      setSuccessMessage(`Arrived at Bin Location: ${locCode}. Pick corresponding items.`);
    } else if (entity.entity_type === 'product' || entity.entity_type === 'lot') {
      setSuccessMessage(`Scanned item: ${entity.display_name}. Confirm pick quantity.`);
    }
  };

  // --- REPLENISH SCAN HANDLER ---
  const handleReplenishScan = (entity) => {
    const task = replenishTasks.find(t => t.id === selectedReplenishId);
    if (!task) {
      setErrorMessage('Please select a Replenishment Task first.');
      return;
    }
    if (entity.entity_type === 'location') {
      const locCode = (entity.details?.code || entity.display_name).toUpperCase();
      if (task.source_location_code && locCode === task.source_location_code.toUpperCase()) {
        setReplenishVerified(v => ({ ...v, source: true }));
        setSuccessMessage(`Verified Source Reserve Bin: ${locCode}`);
      } else if (task.destination_location_code && locCode === task.destination_location_code.toUpperCase()) {
        setReplenishVerified(v => ({ ...v, dest: true }));
        setSuccessMessage(`Verified Destination Forward-Pick Bin: ${locCode}`);
      } else {
        setErrorMessage(`Scanned location ${locCode} does not match task source (${task.source_location_code}) or destination (${task.destination_location_code}).`);
      }
    } else if (entity.entity_type === 'product') {
      if (entity.entity_id === task.product_id || (entity.details?.sku && entity.details.sku === task.product_sku)) {
        setReplenishVerified(v => ({ ...v, product: true }));
        setSuccessMessage(`Verified Product SKU: ${task.product_sku}`);
      } else {
        setErrorMessage(`Scanned product does not match task SKU ${task.product_sku}.`);
      }
    }
  };

  const handleStartWave = async () => {
    if (!selectedWaveId) return;
    setWaveActionLoading(true);
    clearMessages();
    try {
      await api.startWave(selectedWaveId);
      playSound('success');
      setSuccessMessage('Wave status updated to picking. Floor operators can execute pick stops.');
      const updated = await api.getWaveById(selectedWaveId);
      setActiveWaveData(updated);
      const list = await api.getWaves();
      setWavesList(list);
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || 'Failed to start wave.');
    } finally {
      setWaveActionLoading(false);
    }
  };

  const handleCompleteWave = async () => {
    if (!selectedWaveId) return;
    setWaveActionLoading(true);
    clearMessages();
    try {
      const res = await api.completeWave(selectedWaveId);
      playSound('success');
      setSuccessMessage(`Wave completed! ${res.processed_deliveries?.length || 0} deliveries committed with FEFO allocation.`);
      const updated = await api.getWaveById(selectedWaveId);
      setActiveWaveData(updated);
      const list = await api.getWaves();
      setWavesList(list);
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || 'Failed to complete wave.');
    } finally {
      setWaveActionLoading(false);
    }
  };

  const handleExecuteReplenish = async () => {
    const task = replenishTasks.find(t => t.id === selectedReplenishId);
    if (!task) return;
    const qty = parseFloat(replenishTransferQty || task.suggested_qty);
    if (!qty || qty <= 0) {
      setErrorMessage('Please specify a positive transfer quantity.');
      return;
    }
    setReplenishActionLoading(true);
    clearMessages();
    try {
      const res = await api.executeReplenishment(task.id, { transfer_quantity: qty });
      playSound('success');
      setSuccessMessage(`Replenishment executed! Transfer ${res.transfer_reference} created (${qty} units moved).`);
      const updatedTasks = await api.getReplenishments();
      setReplenishTasks(updatedTasks);
      setSelectedReplenishId('');
      setReplenishVerified({ source: false, product: false, dest: false });
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || 'Failed to execute replenishment.');
    } finally {
      setReplenishActionLoading(false);
    }
  };

  // --- RECEIVING SCAN HANDLER ---
  const handleReceivingScan = (entity) => {
    if (recvStep === 1) {
      if (entity.entity_type !== 'product') {
        playSound('error');
        setErrorMessage(`Expected a Product barcode, but scanned a ${entity.entity_type.toUpperCase()} ("${entity.display_name}").`);
        return;
      }
      setRecvProduct(entity);
      setRecvCostPrice(entity.details?.cost_price || '0.00');
      if (entity.details?.tracking_type === 'lot') {
        setRecvStep(2);
      } else {
        setRecvStep(3);
      }
      setSuccessMessage(`Product identified: ${entity.display_name} (${entity.details?.sku})`);
    } else if (recvStep === 3) {
      if (entity.entity_type !== 'location') {
        playSound('error');
        setErrorMessage(`Expected a Destination Location barcode, but scanned a ${entity.entity_type.toUpperCase()}.`);
        return;
      }
      setRecvLocation(entity);
      setRecvStep(4);
      setSuccessMessage(`Bin Location verified: ${entity.display_name}`);
    }
  };

  const submitReceipt = async () => {
    if (!recvProduct || !recvLocation) return;
    const qty = parseFloat(recvQuantity);
    if (!qty || qty <= 0) {
      setErrorMessage('Please enter a valid positive quantity.');
      return;
    }

    setRecvSubmitting(true);
    clearMessages();
    try {
      const payload = {
        supplier_name: 'FastScan Inbound Terminal',
        notes: `Mobile Barcode Inbound by ${user?.name || 'Operator'}`,
        lines: [
          {
            product_id: recvProduct.entity_id,
            location_id: recvLocation.entity_id,
            quantity: qty,
            cost_price: parseFloat(recvCostPrice) || 0,
            lot_number: recvProduct.details?.tracking_type === 'lot' ? recvLotNumber : null,
            expiry_date: recvProduct.details?.tracking_type === 'lot' && recvExpiryDate ? recvExpiryDate : null
          }
        ]
      };

      const res = await api.createReceipt(payload);
      playSound('success');
      setRecvSuccessReceipt(res);
      setSuccessMessage(`Receipt ${res.reference} committed successfully! ${qty} units received.`);
      // Reset form
      setRecvStep(1);
      setRecvProduct(null);
      setRecvLotNumber('');
      setRecvExpiryDate('');
      setRecvLocation(null);
      setRecvQuantity('10');
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || 'Failed to submit inbound receipt.');
    } finally {
      setRecvSubmitting(false);
      scanInputRef.current?.focus();
    }
  };

  // --- CYCLE COUNT SCAN HANDLER ---
  const handleCycleCountScan = async (entity) => {
    if (ccStep === 1) {
      if (entity.entity_type !== 'location') {
        playSound('error');
        setErrorMessage(`Expected a Location/Bin barcode, but scanned a ${entity.entity_type.toUpperCase()}.`);
        return;
      }
      setCcLocation(entity);
      const inv = await api.getLocationInventory(entity.entity_id);
      setCcInventory(inv);
      setCcStep(2);
      setSuccessMessage(`Auditing Location: ${entity.display_name}. ${inv.length} item records loaded.`);
    } else if (ccStep === 2) {
      if (entity.entity_type === 'location') {
        // Switch location
        setCcLocation(entity);
        const inv = await api.getLocationInventory(entity.entity_id);
        setCcInventory(inv);
        setCcSelectedProduct(null);
        setCcCountQty('');
        setSuccessMessage(`Switched to Location: ${entity.display_name}.`);
        return;
      }

      if (entity.entity_type === 'product' || entity.entity_type === 'lot') {
        setCcSelectedProduct(entity);
        // Find existing expected qty
        const match = ccInventory.find(q =>
          entity.entity_type === 'product'
            ? q.product_id === entity.entity_id
            : q.lot_id === entity.entity_id
        );
        if (match) {
          setCcCountQty(String(match.quantity));
        } else {
          setCcCountQty('0');
        }
        setSuccessMessage(`Scanned: ${entity.display_name}. Confirm counted quantity.`);
      }
    }
  };

  const submitCycleCountAdjustment = async (quant) => {
    const counted = parseFloat(ccCounts[quant.id] !== undefined ? ccCounts[quant.id] : quant.quantity);
    const system = parseFloat(quant.quantity);
    const variance = counted - system;

    if (variance === 0) {
      setSuccessMessage(`No discrepancy for ${quant.product_name}. Inventory matches system count.`);
      return;
    }

    setCcSubmitting(true);
    clearMessages();
    try {
      await api.createAdjustment({
        product_id: quant.product_id,
        location_id: ccLocation.entity_id,
        lot_id: quant.lot_id || null,
        delta_quantity: variance,
        reason: 'cycle_count',
        notes: `Mobile Barcode Cycle Count Reconcile (Counted: ${counted}, System: ${system})`
      });

      playSound('success');
      setSuccessMessage(`Adjustment recorded! Reconciled ${variance > 0 ? `+${variance}` : variance} units for ${quant.product_name}.`);
      // Reload inventory
      const updatedInv = await api.getLocationInventory(ccLocation.entity_id);
      setCcInventory(updatedInv);
      setCcSelectedProduct(null);
    } catch (err) {
      playSound('error');
      setErrorMessage(err.message || 'Failed to submit adjustment.');
    } finally {
      setCcSubmitting(false);
      scanInputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Title & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scan className="w-5 h-5 text-blue-600" />
            Warehouse Mobile Scanner
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Keyboard-wedge scanner terminal & mobile floor station. Instant lookup, receiving, and cycle counting.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap bg-slate-200/80 p-1 rounded-lg text-xs font-medium gap-1">
          <button
            onClick={() => { setActiveTab('lookup'); clearMessages(); }}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'lookup'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Quick Lookup
          </button>
          <button
            onClick={() => { setActiveTab('wave_picking'); clearMessages(); }}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'wave_picking'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Wave Picking
          </button>
          <button
            onClick={() => { setActiveTab('replenish'); clearMessages(); }}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'replenish'
                ? 'bg-white text-emerald-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Bin Replenishment
          </button>
          <button
            onClick={() => { setActiveTab('receiving'); clearMessages(); }}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'receiving'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Inbound Receiving
          </button>
          <button
            onClick={() => { setActiveTab('cycle_count'); clearMessages(); }}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'cycle_count'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Cycle Count
          </button>
        </div>
      </div>

      {/* Persistent Barcode Wedge Input Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md border border-slate-800">
        <form onSubmit={handleBarcodeSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Scan className="w-5 h-5 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan barcode or type and press Enter..."
              autoFocus
              className="w-full bg-slate-800 text-white text-sm sm:text-base font-mono pl-11 pr-4 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={scanning || !scanInput.trim()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Enter / Scan</span>
            </button>
          </div>
        </form>

        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Scanner Ready (Enter Key Wedge Active)
          </span>
          {lastScannedCode && (
            <span className="font-mono text-slate-300">
              Last Scanned: <strong>{lastScannedCode}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Notifications / Feedback Banners */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 1: QUICK BARCODE LOOKUP */}
      {/* ======================================================== */}
      {activeTab === 'lookup' && (
        <div className="space-y-4">
          {!lookupResult ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
              <Scan className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-medium text-slate-700 text-sm">Ready to scan warehouse assets</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Scan any Product, Storage Bin Location, or Lot/Batch barcode using your handheld scanner or enter the barcode value manually above.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Entity Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {lookupResult.entity_type === 'product' && <Package className="w-5 h-5" />}
                    {lookupResult.entity_type === 'location' && <MapPin className="w-5 h-5" />}
                    {lookupResult.entity_type === 'lot' && <ShieldAlert className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                        {lookupResult.entity_type}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        Barcode: {lookupResult.barcode}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-0.5">
                      {lookupResult.display_name}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setLabelModal({
                      isOpen: true,
                      entityType: lookupResult.entity_type,
                      barcode: lookupResult.barcode,
                      title: lookupResult.display_name,
                      subtitle:
                        lookupResult.details?.sku ||
                        lookupResult.details?.code ||
                        lookupResult.details?.product_name ||
                        '',
                      details: [
                        { label: 'Type', value: lookupResult.entity_type.toUpperCase() },
                        { label: 'Identifier', value: lookupResult.barcode },
                        ...(lookupResult.details?.sku ? [{ label: 'SKU', value: lookupResult.details.sku }] : []),
                        ...(lookupResult.details?.expiry_date
                          ? [{ label: 'Expiry', value: lookupResult.details.expiry_date.substring(0, 10) }]
                          : [])
                      ]
                    })
                  }
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors border border-slate-200 self-start sm:self-auto"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  Print Label
                </button>
              </div>

              {/* Entity Details Grid */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border-b border-slate-100">
                {lookupResult.entity_type === 'product' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">SKU</span>
                      <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{lookupResult.details?.sku}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Tracking Mode</span>
                      <span className="font-semibold text-slate-800 text-xs mt-0.5 block capitalize">{lookupResult.details?.tracking_type}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Cost Price</span>
                      <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">${parseFloat(lookupResult.details?.cost_price || 0).toFixed(2)}</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold block">Total On Hand</span>
                      <span className="font-mono font-bold text-blue-900 text-lg mt-0.5 block">{parseFloat(lookupResult.details?.on_hand_qty || 0)}</span>
                    </div>
                  </>
                )}

                {lookupResult.entity_type === 'location' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Bin Code</span>
                      <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{lookupResult.details?.code}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Facility / Warehouse</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5 block">{lookupResult.details?.warehouse_name}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Location Type</span>
                      <span className="font-mono font-semibold text-slate-800 text-xs mt-0.5 block capitalize">{lookupResult.details?.type}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold block">Active SKU Lines</span>
                      <span className="font-mono font-bold text-emerald-900 text-lg mt-0.5 block">{locationQuants.length}</span>
                    </div>
                  </>
                )}

                {lookupResult.entity_type === 'lot' && (
                  <>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Product</span>
                      <span className="font-semibold text-slate-900 text-xs mt-0.5 block truncate">{lookupResult.details?.product_name}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">SKU</span>
                      <span className="font-mono font-bold text-slate-900 text-xs mt-0.5 block">{lookupResult.details?.sku}</span>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold block">Expiry Date</span>
                      <span className="font-mono font-bold text-amber-900 text-xs mt-0.5 block">
                        {lookupResult.details?.expiry_date ? lookupResult.details.expiry_date.substring(0, 10) : 'None'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Lot On-Hand Qty</span>
                      <span className="font-mono font-bold text-slate-900 text-lg mt-0.5 block">{parseFloat(lookupResult.details?.on_hand_qty || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* If Location: Display current bin inventory */}
              {lookupResult.entity_type === 'location' && (
                <div className="p-6">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-slate-500" />
                    Current Storage Quantities in this Bin
                  </h4>
                  {locationQuants.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No products currently stored in this location.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3">SKU</th>
                            <th className="py-2.5 px-3">Lot Number</th>
                            <th className="py-2.5 px-3">Expiry Date</th>
                            <th className="py-2.5 px-3 text-right">On Hand Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {locationQuants.map((q) => (
                            <tr key={q.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{q.product_name}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{q.sku}</td>
                              <td className="py-2 px-3 font-mono text-amber-700">{q.lot_number || '—'}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">
                                {q.expiry_date ? q.expiry_date.substring(0, 10) : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{parseFloat(q.quantity)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE: WAVE PICKING */}
      {/* ======================================================== */}
      {activeTab === 'wave_picking' && (
        <div className="space-y-4">
          {/* Wave Selector & Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Layers className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 max-w-md">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Active Pick Wave
                </label>
                <select
                  value={selectedWaveId}
                  onChange={(e) => setSelectedWaveId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">-- Select Pick Wave or Scan Barcode --</option>
                  {wavesList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.wave_number} &bull; {w.warehouse_code} &bull; {w.status.toUpperCase()} ({w.delivery_count} orders)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => api.getWaves().then(data => setWavesList(data))}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Refresh Waves"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {(activeWaveData?.status === 'released' || activeWaveData?.wave?.status === 'released') && (
                <button
                  type="button"
                  disabled={waveActionLoading}
                  onClick={handleStartWave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {waveActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>Start Picking Wave</span>
                </button>
              )}

              {(activeWaveData?.status === 'picking' || activeWaveData?.wave?.status === 'picking') && (
                <button
                  type="button"
                  disabled={waveActionLoading}
                  onClick={handleCompleteWave}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {waveActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                  <span>Complete Wave (FEFO)</span>
                </button>
              )}
            </div>
          </div>

          {(() => {
            const waveObj = activeWaveData?.wave || activeWaveData;
            const waveLocations = activeWaveData?.location_picks || activeWaveData?.locations || [];

            if (!activeWaveData) {
              return (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                  <Layers className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <h3 className="font-medium text-slate-700 text-sm">Select or Scan a Pick Wave</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Scan a wave barcode (e.g. WAVE-2026-0001) or pick an active wave from the dropdown above to begin optimized floor picking.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Wave Summary Info */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">{waveObj?.wave_number}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        waveObj?.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : waveObj?.status === 'picking'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {waveObj?.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Warehouse: <strong className="text-slate-700">{waveObj?.warehouse_name} ({waveObj?.warehouse_code})</strong> &bull; {activeWaveData.deliveries?.length || 0} Delivery Orders Included
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <div>
                      <span className="text-slate-400 block uppercase text-[10px]">Pick Stops</span>
                      <strong className="text-slate-800 font-mono text-xs">{waveLocations.length} Bins</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase text-[10px]">Total Items</span>
                      <strong className="text-blue-700 font-mono text-xs">
                        {waveLocations.reduce((acc, loc) => acc + (loc.items?.length || 0), 0)} Lines
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Optimized Pick Path / Stop Sequence */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Optimized Warehouse Pick Path
                  </h3>

                  {waveLocations.length === 0 ? (
                    <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-400 italic">
                      No pending pick items found for the deliveries assigned to this wave.
                    </div>
                  ) : (
                    waveLocations.map((loc, idx) => {
                      const isHighlighted = highlightLocation && highlightLocation.toUpperCase() === loc.location_code.toUpperCase();
                      return (
                        <div
                          key={loc.location_id}
                          className={`bg-white rounded-xl border transition-all overflow-hidden ${
                            isHighlighted ? 'border-blue-500 ring-2 ring-blue-400/30 shadow-md' : 'border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                            isHighlighted ? 'bg-blue-50/80 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-200 font-mono text-slate-700 text-xs flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              <MapPin className="w-4 h-4 text-slate-500" />
                              <span className="font-mono font-bold text-sm">{loc.location_code}</span>
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                                {loc.location_role || 'general'}
                              </span>
                              {isHighlighted && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse">
                                  Current Bin
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                              {loc.items?.length || 0} items at this bin
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 text-xs">
                            {loc.items?.map((item, itemIdx) => (
                              <div key={itemIdx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.product_name}</div>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                                    <span>SKU: {item.sku}</span>
                                    {item.lot_number && (
                                      <span className="text-amber-700">&bull; Lot: {item.lot_number}</span>
                                    )}
                                    <span>&bull; Order: {item.delivery_reference}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-sm text-slate-900 block">
                                    {parseFloat(item.quantity_to_pick || item.requested_qty || 0)} {item.uom_code || item.uom_name || 'units'}
                                  </span>
                                  <span className="text-[10px] text-slate-400">Pick to cart</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE: FORWARD BIN REPLENISHMENT */}
      {/* ======================================================== */}
      {activeTab === 'replenish' && (
        <div className="space-y-4">
          {/* Task Selector & Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <Truck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 max-w-md">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Active Replenishment Task
                </label>
                <select
                  value={selectedReplenishId}
                  onChange={(e) => setSelectedReplenishId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="">-- Select Task or Scan Task/Bin Barcode --</option>
                  {replenishTasks
                    .filter((t) => ['ready', 'partially_fulfillable', 'suggested'].includes(t.status))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.task_number} &bull; {t.product_name} &rarr; {t.destination_location_code} ({t.suggested_qty} units)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => api.getReplenishments().then(data => setReplenishTasks(data))}
                className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs"
                title="Refresh Replenishment Tasks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(() => {
            const task = replenishTasks.find((t) => t.id === selectedReplenishId);
            if (!task) {
              return (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
                  <Truck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-medium text-slate-700 text-sm">Select or Scan a Replenishment Task</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Select a task above or scan a forward bin barcode needing replenishment. Perform scan-verified stock transfers directly from your terminal.
                  </p>
                </div>
              );
            }

            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
                {/* Task Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">{task.task_number}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-emerald-100 text-emerald-800">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Warehouse: <strong className="text-slate-700">{task.warehouse_name} ({task.warehouse_code})</strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Suggested Transfer</span>
                    <span className="font-mono text-xl font-bold text-emerald-700">+{task.suggested_qty} units</span>
                  </div>
                </div>

                {/* Transfer Path & Scan Verification Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Step A: Source Reserve Bin */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    replenishVerified.source ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">1. Source Reserve Bin</span>
                      {replenishVerified.source ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">Scan bin</span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{task.source_location_code || 'Unassigned'}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Available Reserve: <strong className="text-slate-800 font-mono">{task.available_reserve_qty || 0}</strong>
                    </div>
                  </div>

                  {/* Step B: Product SKU */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    replenishVerified.product ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">2. Item SKU</span>
                      {replenishVerified.product ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">Scan item</span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900 truncate">{task.product_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-1">
                      SKU: <strong className="text-slate-800">{task.product_sku}</strong>
                    </div>
                  </div>

                  {/* Step C: Destination Forward Bin */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    replenishVerified.dest ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase text-slate-400">3. Forward-Pick Bin</span>
                      {replenishVerified.dest ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">Scan bin</span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm">{task.destination_location_code}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Current: <strong className="text-rose-600 font-mono">{task.current_forward_qty}</strong> / Min: {task.threshold_qty}
                    </div>
                  </div>
                </div>

                {/* Transfer Quantity & Confirmation */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Transfer Quantity:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      max={task.available_reserve_qty}
                      value={replenishTransferQty}
                      onChange={(e) => setReplenishTransferQty(e.target.value)}
                      className="w-32 px-3 py-1.5 font-mono text-sm font-bold border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <span className="text-xs text-slate-400">units</span>
                  </div>

                  <button
                    type="button"
                    disabled={replenishActionLoading || !parseFloat(replenishTransferQty)}
                    onClick={handleExecuteReplenish}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    {replenishActionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    <span>Execute Replenishment Transfer</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: BARCODE-ASSISTED INBOUND RECEIVING */}
      {/* ======================================================== */}
      {activeTab === 'receiving' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Step Progress Tracker */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className={`p-2.5 rounded-lg border font-semibold ${recvStep === 1 ? 'bg-blue-50 border-blue-300 text-blue-700' : recvStep > 1 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              1. Scan Product
            </div>
            <div className={`p-2.5 rounded-lg border font-semibold ${recvStep === 2 ? 'bg-blue-50 border-blue-300 text-blue-700' : recvStep > 2 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              2. Lot / Expiry
            </div>
            <div className={`p-2.5 rounded-lg border font-semibold ${recvStep === 3 ? 'bg-blue-50 border-blue-300 text-blue-700' : recvStep > 3 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              3. Scan Bin
            </div>
            <div className={`p-2.5 rounded-lg border font-semibold ${recvStep === 4 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              4. Confirm & Post
            </div>
          </div>

          {/* Step 1: Scan Product */}
          {recvStep === 1 && (
            <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center space-y-3">
              <Package className="w-12 h-12 text-blue-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Step 1: Scan Product Barcode</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Scan the barcode on the incoming item or carton to identify the product catalog entry.
              </p>
            </div>
          )}

          {/* Step 2: Lot & Expiry Entry */}
          {recvStep === 2 && recvProduct && (
            <div className="p-6 bg-amber-50/50 border border-amber-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Step 2: Assign Lot Number & Expiry Date</h3>
              </div>
              <p className="text-xs text-slate-600">
                Item <strong className="font-semibold text-slate-900">{recvProduct.display_name}</strong> is lot-tracked. Scan or enter manufacturer batch details.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch / Lot Number *</label>
                  <input
                    type="text"
                    required
                    value={recvLotNumber}
                    onChange={(e) => setRecvLotNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. LOT-2026-088"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date (FEFO Engine)</label>
                  <input
                    type="date"
                    value={recvExpiryDate}
                    onChange={(e) => setRecvExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecvStep(1)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!recvLotNumber.trim()}
                  onClick={() => setRecvStep(3)}
                  className="px-4 py-1.5 bg-blue-600 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  Continue to Bin Location &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Scan Destination Bin */}
          {recvStep === 3 && (
            <div className="p-8 border border-dashed border-emerald-300 bg-emerald-50/30 rounded-xl text-center space-y-3">
              <MapPin className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Step 3: Scan Destination Bin / Location Barcode</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Scan the shelf or rack barcode (e.g. LOC-MAIN-STOCK) where this stock will be put away.
              </p>
              <button
                type="button"
                onClick={() => setRecvStep(recvProduct?.details?.tracking_type === 'lot' ? 2 : 1)}
                className="text-xs text-slate-500 underline"
              >
                &larr; Back to previous step
              </button>
            </div>
          )}

          {/* Step 4: Confirm & Record */}
          {recvStep === 4 && recvProduct && recvLocation && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Step 4: Confirm Quantities & Post Receipt</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Product</span>
                  <span className="font-semibold text-slate-900 truncate block mt-0.5">{recvProduct.display_name}</span>
                </div>
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Destination</span>
                  <span className="font-mono font-semibold text-slate-900 truncate block mt-0.5">{recvLocation.display_name}</span>
                </div>
                {recvLotNumber && (
                  <div className="p-2.5 bg-white rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Lot / Expiry</span>
                    <span className="font-mono font-semibold text-amber-700 truncate block mt-0.5">
                      {recvLotNumber} ({recvExpiryDate || 'No exp'})
                    </span>
                  </div>
                )}
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Unit Cost ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={recvCostPrice}
                    onChange={(e) => setRecvCostPrice(e.target.value)}
                    className="w-full px-1.5 py-0.5 mt-0.5 font-mono text-xs border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Received Quantity *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={recvQuantity}
                  onChange={(e) => setRecvQuantity(e.target.value)}
                  className="w-full sm:w-48 px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRecvStep(3)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
                >
                  &larr; Back to Location
                </button>
                <button
                  type="button"
                  disabled={recvSubmitting || !parseFloat(recvQuantity)}
                  onClick={submitReceipt}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {recvSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Post Inbound Receipt & Update Stock</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: BARCODE-ASSISTED CYCLE COUNT AUDIT */}
      {/* ======================================================== */}
      {activeTab === 'cycle_count' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Step 1: Scan Bin Location */}
          {ccStep === 1 && (
            <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center space-y-3">
              <MapPin className="w-12 h-12 text-blue-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Scan Bin Location to Audit</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Scan the bin barcode (e.g. LOC-MAIN-STOCK) to pull the authoritative expected stock records for that location.
              </p>
            </div>
          )}

          {/* Step 2: Audit items in that location */}
          {ccStep === 2 && ccLocation && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-900">{ccLocation.display_name}</span>
                    <span className="font-mono text-[11px] text-slate-500 ml-2">({ccLocation.details?.warehouse_name})</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setCcStep(1); setCcLocation(null); setCcInventory([]); }}
                  className="text-xs text-blue-600 hover:underline self-start sm:self-auto"
                >
                  Change Location
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Item / SKU</th>
                      <th className="py-2.5 px-3">Lot Number</th>
                      <th className="py-2.5 px-3 text-right">System Qty</th>
                      <th className="py-2.5 px-3 text-right">Counted Qty</th>
                      <th className="py-2.5 px-3 text-right">Variance</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ccInventory.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-4 text-center text-slate-400 italic">
                          No stock currently registered in this location. Scan an item barcode to record unlisted stock.
                        </td>
                      </tr>
                    ) : (
                      ccInventory.map((quant) => {
                        const counted = ccCounts[quant.id] !== undefined ? ccCounts[quant.id] : quant.quantity;
                        const variance = parseFloat(counted || 0) - parseFloat(quant.quantity);

                        return (
                          <tr key={quant.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{quant.product_name}</div>
                              <div className="font-mono text-[11px] text-slate-500">{quant.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-700">
                              {quant.lot_number || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                              {parseFloat(quant.quantity)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="any"
                                value={ccCounts[quant.id] !== undefined ? ccCounts[quant.id] : quant.quantity}
                                onChange={(e) =>
                                  setCcCounts({ ...ccCounts, [quant.id]: e.target.value })
                                }
                                className="w-20 px-2 py-1 text-right font-mono text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {variance === 0 ? (
                                <span className="text-emerald-600">0</span>
                              ) : variance > 0 ? (
                                <span className="text-blue-600">+{variance}</span>
                              ) : (
                                <span className="text-rose-600">{variance}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                disabled={ccSubmitting || variance === 0}
                                onClick={() => submitCycleCountAdjustment(quant)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white rounded text-[11px] font-medium transition-colors"
                              >
                                Reconcile
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barcode Label Modal */}
      <BarcodeLabelModal
        isOpen={labelModal.isOpen}
        onClose={() => setLabelModal({ ...labelModal, isOpen: false })}
        entityType={labelModal.entityType}
        barcode={labelModal.barcode}
        title={labelModal.title}
        subtitle={labelModal.subtitle}
        details={labelModal.details}
      />
    </div>
  );
}
