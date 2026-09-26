/**
 * Phase 6 Automated Verification Suite
 * Tests:
 * 1. Migration 006 cleanly applies on top of 001-005.
 * 2. Pick wave creation, order assignment, invalid/ineligible order rejection.
 * 3. Wave status lifecycle (draft -> released -> picking -> completed).
 * 4. Wave completion executes picking with authoritative backend FEFO lot allocation.
 * 5. Ineligible order rejection (completed delivery, wrong warehouse, already waved).
 * 6. Forward pick bin threshold detection and automated replenishment task generation.
 * 7. Reserve source selection, reserve availability, and suggested quantity calculation.
 * 8. Replenishment execution using transferService (conserving quantity, creating immutable stock moves).
 * 9. Cross-dock alert generation from inbound receipt vs pending delivery demand.
 * 10. Audit log entries for WAVE_CREATE, WAVE_RELEASE, WAVE_COMPLETE, REPLENISHMENT_EXECUTE, CROSS_DOCK_ACKNOWLEDGE.
 */

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('  STARTING PHASE 6 WAREHOUSE LOGISTICS & WAVE TEST');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL with migrations 001 through 006
  const memDb = newDb();

  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 18.0 (pg-mem)'
  });

  const sql1 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/001_initial_schema.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/002_phase2_auth_and_master_data.sql'), 'utf8');
  const sql3 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/003_phase3_stock_engine.sql'), 'utf8');
  const sql4 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/004_phase4_reorder_expiry_valuation.sql'), 'utf8');
  const sql5 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/005_phase5_barcode_warehouse.sql'), 'utf8');
  const sql6 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/006_phase6_warehouse_logistics.sql'), 'utf8');

  memDb.public.none(sql1);
  memDb.public.none(sql2);
  memDb.public.none(sql3);
  memDb.public.none(sql4);
  memDb.public.none(sql5);
  memDb.public.none(sql6);
  console.log('✔ Migrations 001, 002, 003, 004, 005, and 006 applied cleanly into database.');

  // Mock pool adapter with transaction support
  const pgAdapter = memDb.adapters.createPg();
  const dbPool = require('../src/db/pool');
  const mockPool = new pgAdapter.Pool();

  const originalConnect = mockPool.connect.bind(mockPool);
  mockPool.connect = async () => {
    const client = await originalConnect();
    const origQuery = client.query.bind(client);
    let txBackup = null;
    client.query = async (text, params) => {
      const q = typeof text === 'string' ? text.trim().toUpperCase() : (text?.text || '').trim().toUpperCase();
      if (q === 'BEGIN') {
        txBackup = memDb.backup();
      } else if (q === 'ROLLBACK') {
        if (txBackup) {
          txBackup.restore();
          txBackup = null;
        }
      } else if (q === 'COMMIT') {
        txBackup = null;
      }
      return origQuery(text, params);
    };
    return client;
  };

  dbPool.pool.query = (text, params) => mockPool.query(text, params);
  dbPool.pool.connect = () => mockPool.connect();
  dbPool.query = (text, params) => mockPool.query(text, params);

  // Setup Express App
  const express = require('express');
  const cors = require('cors');
  const apiRoutes = require('../src/routes');
  const { errorHandler, notFoundHandler } = require('../src/middleware/errorHandler');

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  testApp.use('/api', apiRoutes);
  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  const server = http.createServer(testApp);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;
  console.log(`✔ Express test server running on port ${port}.\n`);

  let managerToken = '';
  let staffToken = '';
  let whMainId = null;
  let whSecId = null;
  let locReserveId = null;
  let locForwardId = null;
  let locDockId = null;
  let locSecId = null;
  let categoryId = null;
  let uomId = null;
  let productMedId = null;
  let productStdId = null;

  async function api(endpoint, options = {}) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  }

  try {
    // ----------------------------------------------------
    // SETUP: Users, Warehouses, Locations, Products
    // ----------------------------------------------------
    console.log('--- 0. Setup: Master Data & Facilities ---');

    const mgrRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Logistics Manager', email: 'mgr.logistics@stockyard.test', password: 'Password123!', role: 'inventory_manager' }
    });
    managerToken = mgrRes.data.data.token;

    const staffRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Wave Picker', email: 'picker@stockyard.test', password: 'Password123!', role: 'warehouse_staff' }
    });
    staffToken = staffRes.data.data.token;

    // Warehouse 1 (Main facility)
    const wh1 = await api('/warehouses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { code: 'WH-MAIN', name: 'Main Fulfillment Hub' }
    });
    whMainId = wh1.data.data.id;

    // Warehouse 2 (Secondary facility for isolation testing)
    const wh2 = await api('/warehouses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { code: 'WH-SEC', name: 'Secondary Hub' }
    });
    whSecId = wh2.data.data.id;

    // Reserve location (high-bay pallet storage)
    const locRes = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        code: 'LOC-RES-01',
        name: 'Reserve Rack Bay 01',
        type: 'internal',
        barcode: 'LOC-RES-01',
        location_role: 'reserve'
      }
    });
    locReserveId = locRes.data.data.id;

    // Forward-pick location (fast-pick bin)
    const locFwd = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        code: 'LOC-FWD-01',
        name: 'Forward Pick Bin 01',
        type: 'internal',
        barcode: 'LOC-FWD-01',
        location_role: 'forward_pick'
      }
    });
    locForwardId = locFwd.data.data.id;

    // Inbound Staging / Dock location
    const locDock = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        code: 'LOC-DOCK-01',
        name: 'Inbound Receiving Staging Dock',
        type: 'internal',
        barcode: 'LOC-DOCK-01',
        location_role: 'general'
      }
    });
    locDockId = locDock.data.data.id;

    // Secondary warehouse location
    const locSec = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whSecId,
        code: 'LOC-SEC-01',
        name: 'Secondary Bin 01',
        type: 'internal',
        barcode: 'LOC-SEC-01',
        location_role: 'general'
      }
    });
    locSecId = locSec.data.data.id;

    console.log(`✔ Facilities configured (Main WH: ${whMainId}, Reserve: ${locReserveId}, Forward: ${locForwardId})`);

    const cat = await api('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Pharmaceuticals', code: 'PHARMA' }
    });
    categoryId = cat.data.data.id;

    const uom = await api('/uom', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Box', code: 'BOX', category: 'unit', conversion_to_base: 1.0 }
    });
    uomId = uom.data.data.id;

    // Lot-tracked Product (Medicine A)
    const prod1 = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'MED-A-100MG',
        name: 'Antibiotic Capsules 100mg',
        barcode: '8901111111111',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'lot',
        cost_price: 15.00,
        sale_price: 30.00
      }
    });
    productMedId = prod1.data.data.id;

    // Standard Product (Supplies B)
    const prod2 = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'SUP-B-GAUZE',
        name: 'Sterile Gauze Pads Pack',
        barcode: '8902222222222',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'none',
        cost_price: 5.00,
        sale_price: 10.00
      }
    });
    productStdId = prod2.data.data.id;
    console.log(`✔ Products created (Lot-tracked: ${productMedId}, Standard: ${productStdId})`);

    // ----------------------------------------------------
    // 1. INVENTORY SEEDING & COST LAYERS
    // ----------------------------------------------------
    console.log('\n--- 1. Seeding Stock with Multi-Lot FEFO Lots ---');

    // Receive Lot 1: 25 units, Expiry 2026-10-01 (Earlier expiry) into Forward-Pick bin
    const receipt1 = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Pharma Supply Co',
        destination_warehouse_id: whMainId,
        notes: 'Inbound Lot 1',
        lines: [
          {
            product_id: productMedId,
            dest_location_id: locForwardId,
            expected_qty: 25,
            unit_price: 15.00,
            lot_number: 'LOT-PHARMA-001',
            expiry_date: '2026-10-01'
          }
        ]
      }
    });
    if (!receipt1.ok) throw new Error(`Receipt 1 failed: ${JSON.stringify(receipt1)}`);

    // Receive Lot 2: 50 units, Expiry 2026-12-01 (Later expiry) into Forward-Pick bin
    const receipt2 = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Pharma Supply Co',
        destination_warehouse_id: whMainId,
        notes: 'Inbound Lot 2',
        lines: [
          {
            product_id: productMedId,
            dest_location_id: locForwardId,
            expected_qty: 50,
            unit_price: 16.00,
            lot_number: 'LOT-PHARMA-002',
            expiry_date: '2026-12-01'
          }
        ]
      }
    });
    if (!receipt2.ok) throw new Error(`Receipt 2 failed: ${JSON.stringify(receipt2)}`);
    console.log('✔ Stock seeded: Lot 1 (25 units @ Oct 2026) and Lot 2 (50 units @ Dec 2026). Total on-hand = 75.');

    // ----------------------------------------------------
    // 2. CREATE PICK WAVE & ORDER ASSIGNMENT
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Pick Wave Creation & Order Assignment ---');

    // Create 2 draft deliveries for Main warehouse
    const deliv1 = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'City General Hospital',
        source_warehouse_id: whMainId,
        auto_process: false,
        lines: [{ product_id: productMedId, requested_qty: 30, src_location_id: locForwardId }]
      }
    });
    const delivery1Id = deliv1.data.data.id;

    const deliv2 = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Downtown Clinic',
        source_warehouse_id: whMainId,
        auto_process: false,
        lines: [{ product_id: productMedId, requested_qty: 20, src_location_id: locForwardId }]
      }
    });
    const delivery2Id = deliv2.data.data.id;

    // Create 1 draft delivery for Secondary warehouse (to test warehouse isolation rejection)
    const delivSec = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Remote Branch',
        source_warehouse_id: whSecId,
        auto_process: false,
        lines: [{ product_id: productMedId, requested_qty: 10, src_location_id: locSecId }]
      }
    });
    const deliverySecId = delivSec.data.data.id;

    // Create Pick Wave for Main WH
    const waveRes = await api('/waves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        name: 'Morning Outbound Wave #1',
        delivery_ids: [delivery1Id, delivery2Id]
      }
    });
    if (!waveRes.ok) throw new Error(`Wave creation failed: ${JSON.stringify(waveRes)}`);
    const waveId = waveRes.data.data.id;
    const waveNumber = waveRes.data.data.wave_number;
    console.log(`✔ Wave created: ${waveNumber} with ${waveRes.data.data.delivery_count} orders in status "${waveRes.data.data.status}"`);

    // Verify wave pick path query
    const waveDetails = await api(`/waves/${waveId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!waveDetails.ok) throw new Error(`Get wave by id failed: ${JSON.stringify(waveDetails)}`);
    if (waveDetails.data.data.deliveries.length !== 2) {
      throw new Error(`Expected 2 deliveries in wave, got ${waveDetails.data.data.deliveries.length}`);
    }
    const locPicks = waveDetails.data.data.location_picks || [];
    if (locPicks.length === 0) {
      throw new Error(`Expected location_picks in wave details, got: ${JSON.stringify(waveDetails.data.data)}`);
    }
    const firstItem = locPicks[0]?.items?.[0];
    if (!firstItem || !firstItem.lot_allocations || firstItem.lot_allocations.length === 0) {
      throw new Error('Expected candidate FEFO lot allocations on wave line');
    }
    console.log(`✔ Wave pick path retrieved: ${locPicks.length} location(s) with ${firstItem.lot_allocations.length} candidate FEFO lot allocation(s).`);

    // ----------------------------------------------------
    // 3. INELIGIBLE ORDER REJECTION TESTS
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Ineligible Order Rejections ---');

    // Reject adding order from different warehouse
    const rejectDiffWh = await api(`/waves/${waveId}/deliveries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { delivery_ids: [deliverySecId] }
    });
    if (rejectDiffWh.ok) {
      throw new Error(`Expected rejection when adding cross-warehouse delivery, but succeeded!`);
    }
    console.log(`✔ Cross-warehouse delivery correctly rejected (Status ${rejectDiffWh.status})`);

    // Reject adding order already in another active wave
    const wave2Res = await api('/waves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        name: 'Conflicting Wave #2'
      }
    });
    const wave2Id = wave2Res.data.data.id;

    const rejectAlreadyWaved = await api(`/waves/${wave2Id}/deliveries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { delivery_ids: [delivery1Id] }
    });
    if (rejectAlreadyWaved.ok) {
      throw new Error(`Expected rejection when adding delivery already in wave, but succeeded!`);
    }
    console.log(`✔ Already-waved delivery correctly rejected (Status ${rejectAlreadyWaved.status})`);

    // Test removing a delivery from wave and adding it back
    const removeRes = await api(`/waves/${waveId}/deliveries/${delivery2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    if (!removeRes.ok) throw new Error(`Failed to remove delivery from wave: ${JSON.stringify(removeRes)}`);

    const afterRemove = await api(`/waves/${waveId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (afterRemove.data.data.deliveries.length !== 1) {
      throw new Error(`Expected 1 delivery after removal, got ${afterRemove.data.data.deliveries.length}`);
    }

    // Add it back
    await api(`/waves/${waveId}/deliveries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { delivery_ids: [delivery2Id] }
    });
    console.log('✔ Dynamic order assignment and removal verified cleanly.');

    // ----------------------------------------------------
    // 4. WAVE LIFECYCLE & FEFO EXECUTION
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Wave Lifecycle: Release -> Start -> Complete (FEFO) ---');

    // Step A: Release
    const relRes = await api(`/waves/${waveId}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    if (!relRes.ok || relRes.data.data.status !== 'released') {
      throw new Error(`Release failed: ${JSON.stringify(relRes)}`);
    }
    console.log('✔ Wave state transitioned to "released".');

    // Step B: Start Picking
    const startRes = await api(`/waves/${waveId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!startRes.ok || startRes.data.data.status !== 'picking') {
      throw new Error(`Start wave failed: ${JSON.stringify(startRes)}`);
    }
    console.log('✔ Wave state transitioned to "picking". Floor operators actively picking.');

    // Step C: Complete Wave (executes picking for Deliveries 1 & 2 via backend FEFO engine)
    const completeRes = await api(`/waves/${waveId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const completedWave = completeRes.data?.data?.wave || completeRes.data?.data;
    if (!completeRes.ok || completedWave?.status !== 'completed') {
      throw new Error(`Complete wave failed: ${JSON.stringify(completeRes)}`);
    }
    console.log('✔ Wave state transitioned to "completed". Deliveries committed.');

    // Verify FEFO Lot Consumption:
    // Delivery 1 = 30 units, Delivery 2 = 20 units -> Total 50 units dispatched.
    // Lot 1 had 25 units (Oct 2026 expiry) -> MUST BE 100% DEPLETED to 0 units.
    // Lot 2 had 50 units (Dec 2026 expiry) -> MUST BE CONSUMED by 25 units -> 25 units remaining.
    const quantsRes = await api(`/quants?product_id=${productMedId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const quants = quantsRes.data.data;
    const lot1Quant = quants.find(q => q.lot_number === 'LOT-PHARMA-001');
    const lot2Quant = quants.find(q => q.lot_number === 'LOT-PHARMA-002');

    if (parseFloat(lot1Quant?.quantity || 0) !== 0) {
      throw new Error(`FEFO violation! Lot 1 was not fully depleted first: ${lot1Quant?.quantity}`);
    }
    if (parseFloat(lot2Quant?.quantity || 0) !== 25) {
      throw new Error(`FEFO violation! Lot 2 expected 25 units remaining, got: ${lot2Quant?.quantity}`);
    }
    console.log(`✔ FEFO Allocation strictly enforced: Lot 1 (earlier expiry) was fully consumed (0 remaining), Lot 2 remaining = 25.`);

    // Ineligible order rejection: Attempting to add completed delivery to a wave
    const rejectCompleted = await api(`/waves/${wave2Id}/deliveries`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { delivery_ids: [delivery1Id] }
    });
    if (rejectCompleted.ok) {
      throw new Error('Expected rejection when adding already completed delivery, but succeeded!');
    }
    console.log('✔ Completed delivery order rejected from new waves.');

    // ----------------------------------------------------
    // 5. FORWARD PICK BIN REPLENISHMENT
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Forward-Pick Bin Replenishment Engine ---');

    // Seed 100 units of Standard Product (productStdId) into Reserve Bin (LOC-RES-01)
    const seedReceipt = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Medical Supplies Inc',
        destination_warehouse_id: whMainId,
        notes: 'Reserve stock intake',
        lines: [
          {
            product_id: productStdId,
            dest_location_id: locReserveId,
            expected_qty: 100,
            unit_price: 5.00
          }
        ]
      }
    });
    if (!seedReceipt.ok) throw new Error(`Seed receipt failed: ${JSON.stringify(seedReceipt)}`);

    // Configure forward bin threshold for productStdId at LOC-FWD-01:
    // min_qty = 20, max_qty = 80
    const configRes = await api('/replenishment/configs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: whMainId,
        location_id: locForwardId,
        product_id: productStdId,
        min_qty: 20,
        max_qty: 80
      }
    });
    if (!configRes.ok) throw new Error(`Replenishment config failed: ${JSON.stringify(configRes)}`);
    console.log('✔ Replenishment threshold configured: Forward Bin LOC-FWD-01 min=20, max=80.');

    // Trigger automated replenishment scan
    const scanRes = await api('/replenishment/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: whMainId }
    });
    if (!scanRes.ok) throw new Error(`Generate replenishment failed: ${JSON.stringify(scanRes)}`);
    console.log(`✔ Replenishment scanner generated ${scanRes.data?.data?.count ?? 0} tasks.`);

    // Retrieve generated task
    const tasksRes = await api(`/replenishment?warehouse_id=${whMainId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const tasks = tasksRes.data.data;
    const task = tasks.find(t => t.product_id === productStdId && t.destination_location_id === locForwardId);

    if (!task) throw new Error('Expected replenishment task was not generated!');
    if (task.status !== 'ready') throw new Error(`Expected task status 'ready', got: ${task.status}`);
    if (parseFloat(task.suggested_qty) !== 80) {
      throw new Error(`Expected suggested quantity 80, got ${task.suggested_qty}`);
    }
    if (task.source_location_id !== locReserveId) {
      throw new Error(`Expected source location ${locReserveId}, got ${task.source_location_id}`);
    }
    console.log(`✔ Replenishment Task ${task.task_number}: Current Forward = 0 (< 20), Target = 80, Suggested Transfer = 80 from Reserve.`);

    // ----------------------------------------------------
    // 6. EXECUTE REPLENISHMENT TRANSFER
    // ----------------------------------------------------
    console.log('\n--- 6. Executing Replenishment Stock Transfer ---');

    // Execute transfer of 80 units
    const execRes = await api(`/replenishment/${task.id}/execute`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { transfer_quantity: 80 }
    });
    if (!execRes.ok) throw new Error(`Execute replenishment failed: ${JSON.stringify(execRes)}`);
    console.log(`✔ Replenishment executed! Transfer reference: ${execRes.data.data.transfer_reference}`);

    // Verify stock balance invariant:
    // Reserve was 100 -> now 20. Forward was 0 -> now 80. Total stock = 100.
    const fwdQuant = await dbPool.query(
      'SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2',
      [productStdId, locForwardId]
    );
    const resQuant = await dbPool.query(
      'SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2',
      [productStdId, locReserveId]
    );

    const fwdQty = parseFloat(fwdQuant.rows[0]?.quantity || 0);
    const resQty = parseFloat(resQuant.rows[0]?.quantity || 0);

    if (fwdQty !== 80 || resQty !== 20) {
      throw new Error(`Stock quantities incorrect after replenishment: Fwd=${fwdQty}, Res=${resQty}`);
    }
    if (fwdQty + resQty !== 100) {
      throw new Error(`Inventory Invariant Violated! Total stock changed from 100 to ${fwdQty + resQty}`);
    }
    console.log(`✔ Inventory Conservation Invariant Verified: Reserve (20) + Forward (80) = Total (100).`);

    // Verify task is now executed
    const completedTaskRes = await api(`/replenishment?status=executed`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const completedTask = completedTaskRes.data.data.find(t => t.id === task.id);
    if (!completedTask || completedTask.status !== 'executed') {
      throw new Error('Task did not transition to executed status.');
    }
    console.log('✔ Replenishment task status verified as "executed".');

    // ----------------------------------------------------
    // 6b. BARCODE REPLENISHMENT RESOLUTION FLOW
    // ----------------------------------------------------
    console.log('\n--- 6b. Testing Barcode Replenishment Lookup Resolution ---');

    // 1. Scan source reserve bin barcode
    const bcSourceRes = await api(`/barcodes/lookup?code=LOC-RES-01`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!bcSourceRes.ok || bcSourceRes.data.data.entity_type !== 'location' || bcSourceRes.data.data.entity_id !== locReserveId) {
      throw new Error(`Barcode lookup for source bin failed: ${JSON.stringify(bcSourceRes)}`);
    }
    console.log(`✔ Barcode scanned source reserve bin: "${bcSourceRes.data.data.display_name}" resolved to location ID ${locReserveId}`);

    // 2. Scan product barcode
    const bcProdRes = await api(`/barcodes/lookup?code=8902222222222`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!bcProdRes.ok || bcProdRes.data.data.entity_type !== 'product' || bcProdRes.data.data.entity_id !== productStdId) {
      throw new Error(`Barcode lookup for product failed: ${JSON.stringify(bcProdRes)}`);
    }
    console.log(`✔ Barcode scanned product: "${bcProdRes.data.data.display_name}" resolved to product ID ${productStdId}`);

    // 3. Scan destination forward bin barcode
    const bcDestRes = await api(`/barcodes/lookup?code=LOC-FWD-01`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!bcDestRes.ok || bcDestRes.data.data.entity_type !== 'location' || bcDestRes.data.data.entity_id !== locForwardId) {
      throw new Error(`Barcode lookup for destination bin failed: ${JSON.stringify(bcDestRes)}`);
    }
    console.log(`✔ Barcode scanned destination forward bin: "${bcDestRes.data.data.display_name}" resolved to location ID ${locForwardId}`);

    // Test Replenishment Dismissal
    // Generate a temporary task to dismiss
    await dbPool.query(
      `INSERT INTO replenishment_tasks (
        task_number, warehouse_id, product_id, destination_location_id,
        current_forward_qty, threshold_qty, target_qty, suggested_qty, status, created_at, updated_at
      ) VALUES ('REP-TEST-DISMISS', $1, $2, $3, 0, 10, 50, 50, 'suggested', NOW(), NOW())`,
      [whMainId, productStdId, locForwardId]
    );
    const dismissTaskRes = await dbPool.query("SELECT id FROM replenishment_tasks WHERE task_number = 'REP-TEST-DISMISS'");
    const dismissTaskId = dismissTaskRes.rows[0].id;

    const repDismissRes = await api(`/replenishment/${dismissTaskId}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!repDismissRes.ok) throw new Error(`Dismiss replenishment failed: ${JSON.stringify(repDismissRes)}`);
    console.log('✔ Replenishment task dismissed successfully.');

    // ----------------------------------------------------
    // 7. INBOUND CROSS-DOCKING ALERTS
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Inbound Cross-Docking Engine ---');

    // Create a pending delivery for Product 2 (15 units)
    const pendingDeliv = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Metro Urgent Care',
        source_warehouse_id: whMainId,
        auto_process: false,
        lines: [{ product_id: productStdId, requested_qty: 15, src_location_id: locDockId }]
      }
    });
    const pendingDeliveryId = pendingDeliv.data.data.id;

    // Receive 20 units of Product 2 at Dock location LOC-DOCK-01
    // The receipt service hook should automatically generate an active cross-dock alert!
    const dockReceipt = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Direct Urgent Air Cargo',
        destination_warehouse_id: whMainId,
        notes: 'Urgent medical shipment',
        lines: [
          {
            product_id: productStdId,
            dest_location_id: locDockId,
            expected_qty: 20,
            unit_price: 5.00
          }
        ]
      }
    });
    if (!dockReceipt.ok) throw new Error(`Dock receipt failed: ${JSON.stringify(dockReceipt)}`);

    // Check active cross-dock alerts
    const alertsRes = await api('/cross-dock?status=active', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const activeAlerts = alertsRes.data.data;
    const xdockAlert = activeAlerts.find(a => a.product_id === productStdId && a.pending_delivery_id === pendingDeliveryId);

    if (!xdockAlert) {
      throw new Error('Cross-dock alert was not automatically triggered upon receipt!');
    }
    if (parseFloat(xdockAlert.suggested_cross_dock_qty) !== 15) {
      throw new Error(`Expected suggested cross-dock qty 15, got: ${xdockAlert.suggested_cross_dock_qty}`);
    }
    console.log(`✔ Cross-Dock Alert ${xdockAlert.alert_number} detected: Received 20 units, matched 15 units of pending demand for Delivery.`);

    // Acknowledge alert
    const ackRes = await api(`/cross-dock/${xdockAlert.id}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!ackRes.ok || ackRes.data.data.status !== 'acknowledged') {
      throw new Error(`Acknowledge cross dock failed: ${JSON.stringify(ackRes)}`);
    }
    console.log('✔ Cross-dock alert acknowledged by operator.');

    // Dismiss alert test
    const dismissAlertRes = await api(`/cross-dock/${xdockAlert.id}/dismiss`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!dismissAlertRes.ok || dismissAlertRes.data.data.status !== 'dismissed') {
      throw new Error(`Dismiss cross dock failed: ${JSON.stringify(dismissAlertRes)}`);
    }
    console.log('✔ Cross-dock alert dismissed successfully.');

    // Verify non-mutating nature: Dock location still has all 20 units, no hidden moves created
    const dockQuant = await dbPool.query(
      'SELECT quantity FROM stock_quants WHERE product_id = $1 AND location_id = $2',
      [productStdId, locDockId]
    );
    if (parseFloat(dockQuant.rows[0]?.quantity || 0) !== 20) {
      throw new Error(`Cross-dock unexpectedly mutated stock! Dock qty: ${dockQuant.rows[0]?.quantity}`);
    }
    console.log('✔ Non-mutating invariant verified: Cross-dock alert created no unapproved stock mutations.');

    // Test Wave Cancellation
    const wave3Res = await api('/waves', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: whMainId, name: 'Wave to Cancel' }
    });
    const wave3Id = wave3Res.data.data.id;
    const cancelRes = await api(`/waves/${wave3Id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    if (!cancelRes.ok || cancelRes.data.data.status !== 'cancelled') {
      throw new Error(`Cancel wave failed: ${JSON.stringify(cancelRes)}`);
    }
    console.log('✔ Wave cancelled successfully.');

    // ----------------------------------------------------
    // 8. AUDIT LOG INTEGRITY VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 8. Verifying Phase 6 Audit Log Entries ---');

    const auditRes = await dbPool.query(
      `SELECT action, user_id, entity_type, new_values FROM audit_log ORDER BY id ASC`
    );
    const actions = auditRes.rows.map(r => r.action);

    const requiredActions = [
      'WAVE_CREATE',
      'WAVE_RELEASE',
      'WAVE_START',
      'WAVE_COMPLETE',
      'WAVE_CANCEL',
      'REPLENISHMENT_GENERATE',
      'REPLENISHMENT_EXECUTE',
      'REPLENISHMENT_DISMISS',
      'CROSS_DOCK_ACKNOWLEDGE',
      'CROSS_DOCK_DISMISS'
    ];

    for (const reqAct of requiredActions) {
      if (!actions.includes(reqAct)) {
        throw new Error(`Audit log missing required action: ${reqAct}`);
      }
      console.log(`✔ Audit log confirmed action: ${reqAct}`);
    }

    console.log('\n====================================================');
    console.log('  ALL PHASE 6 VERIFICATION CHECKS PASSED PERFECTLY!');
    console.log('====================================================\n');
    server.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ PHASE 6 TEST FAILED:', err);
    server.close();
    process.exit(1);
  }
}

runPhase6Tests();
