/**
 * Phase 3 Automated Verification Suite
 * Tests Core Stock Engine:
 * 1. Receipt creation, Lot creation, Quant increment, Cost Layer & Weighted-Average Costing
 * 2. Second Receipt, Quant accumulation, Weighted-Average Recalculation
 * 3. FEFO Outbound Delivery, Greedy Lot Consumption, Quant decrements, Cost Layer Depletion
 * 4. Insufficient Stock Delivery Rejection & Transaction Rollback
 * 5. Internal Transfer: Source decrement, Dest increment, Lot preservation, Total qty invariant
 * 6. Inventory Adjustment: Negative variance / Scrap write-off, Stock move recording
 * 7. Transaction Rollback on mid-operation failure
 * 8. Operational Query Endpoints (Quants, Moves, Lots, Receipts, Deliveries, Transfers, Adjustments)
 */

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING PHASE 3 CORE STOCK ENGINE TEST SUITE');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL instance with migrations 001, 002, 003
  const memDb = newDb();
  
  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 18.0 (pg-mem)'
  });

  const sql1 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/001_initial_schema.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/002_phase2_auth_and_master_data.sql'), 'utf8');
  const sql3 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/003_phase3_stock_engine.sql'), 'utf8');

  memDb.public.none(sql1);
  memDb.public.none(sql2);
  memDb.public.none(sql3);
  console.log('✔ Migrations 001, 002, and 003 applied cleanly into database.');

  // Bind the pg adapter from pg-mem to our pool
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
  let warehouseId = null;
  let locStockId = null;
  let locShelfBId = null;
  let categoryId = null;
  let uomId = null;
  let productId = null;

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
    // SETUP: Users & Master Data
    // ----------------------------------------------------
    console.log('--- 0. Setup: Users & Master Data ---');

    // Sign up manager
    const mgrSignup = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Manager Mary', email: 'manager@stockyard.test', password: 'Password123!', role: 'inventory_manager' }
    });
    if (!mgrSignup.ok) throw new Error(`Manager signup failed: ${JSON.stringify(mgrSignup)}`);
    managerToken = mgrSignup.data.data.token;
    console.log('✔ Manager created');

    // Sign up staff
    const staffSignup = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Staff Steve', email: 'staff@stockyard.test', password: 'Password123!', role: 'warehouse_staff' }
    });
    if (!staffSignup.ok) throw new Error(`Staff signup failed: ${JSON.stringify(staffSignup)}`);
    staffToken = staffSignup.data.data.token;
    console.log('✔ Warehouse staff created');

    // Create Warehouse
    const whRes = await api('/warehouses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Main Distribution Center', code: 'WH-MAIN', address: '100 Industrial Road' }
    });
    if (!whRes.ok) throw new Error(`Warehouse creation failed: ${JSON.stringify(whRes)}`);
    warehouseId = whRes.data.data.id;
    console.log(`✔ Warehouse created (ID: ${warehouseId}, Code: WH-MAIN)`);

    // Create Locations
    const loc1 = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId, name: 'Stock Zone A', code: 'LOC-STOCK-A', type: 'internal' }
    });
    if (!loc1.ok) throw new Error(`Location 1 creation failed: ${JSON.stringify(loc1)}`);
    locStockId = loc1.data.data.id;

    const loc2 = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId, name: 'Shelf B-02', code: 'LOC-SHELF-B', type: 'internal' }
    });
    if (!loc2.ok) throw new Error(`Location 2 creation failed: ${JSON.stringify(loc2)}`);
    locShelfBId = loc2.data.data.id;

    console.log(`✔ Internal Locations created (Stock: ${locStockId}, Shelf B: ${locShelfBId})`);

    // Create Category & UoM
    const catRes = await api('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Industrial Metals', description: 'Raw and processed metal stock' }
    });
    categoryId = catRes.data.data.id;

    const uomRes = await api('/uom', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Pieces', code: 'PCS', category: 'unit', conversion_to_base: 1.0 }
    });
    uomId = uomRes.data.data.id;

    // Create Product (Lot tracked)
    const prodRes = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: 'Steel Rods 20mm',
        sku: 'STEEL-20MM',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'lot',
        cost_price: 0.00
      }
    });
    if (!prodRes.ok) throw new Error(`Product creation failed: ${JSON.stringify(prodRes)}`);
    productId = prodRes.data.data.id;
    console.log(`✔ Lot-tracked Product created (ID: ${productId}, SKU: STEEL-20MM, cost_price: $0.00)`);

    // ----------------------------------------------------
    // TEST 1: Inbound Receipt 1 (Lot Creation & Cost Layer)
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Inbound Receipt 1 (100 units @ $10.00) ---');
    const expiryLotA = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // +30 days

    const receipt1Res = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Apex Metals Corp',
        destination_warehouse_id: warehouseId,
        lines: [
          {
            product_id: productId,
            lot_number: 'LOT-A-2026',
            expiry_date: expiryLotA,
            expected_qty: 100,
            unit_price: 10.00,
            dest_location_id: locStockId
          }
        ]
      }
    });

    if (receipt1Res.status !== 201 || !receipt1Res.data.success) {
      throw new Error(`Receipt 1 creation failed: ${JSON.stringify(receipt1Res)}`);
    }
    const receipt1 = receipt1Res.data.data;
    console.log(`✔ Inbound Receipt 1 created & processed (Ref: ${receipt1.reference}, Status: ${receipt1.status})`);

    // Verify product weighted average cost is now 10.00
    const prodAfterR1 = await api(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const costAfterR1 = parseFloat(prodAfterR1.data.data.cost_price);
    if (Math.abs(costAfterR1 - 10.00) > 0.001) {
      throw new Error(`Expected cost_price 10.00, got ${costAfterR1}`);
    }
    console.log(`✔ Product weighted-average cost correctly initialized to: $${costAfterR1.toFixed(2)}`);

    // Verify Stock Quant at Stock Location
    const quantsR1 = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!quantsR1.data.data || quantsR1.data.data.length !== 1 || parseFloat(quantsR1.data.data[0].quantity) !== 100) {
      throw new Error(`Expected quant of 100 for Lot A, got: ${JSON.stringify(quantsR1.data)}`);
    }
    const lotAId = quantsR1.data.data[0].lot_id;
    console.log(`✔ Stock Quant verified: 100 units in Lot A (Lot ID: ${lotAId}) at location ${locStockId}`);

    // Verify Stock Moves logged for receipt
    const movesR1 = await api(`/moves?product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const receiptMoves = movesR1.data.data.filter(m => m.origin_document === receipt1.reference);
    if (receiptMoves.length !== 1 || parseFloat(receiptMoves[0].quantity) !== 100 || receiptMoves[0].move_type !== 'receipt') {
      throw new Error(`Expected 1 receipt move of qty 100, got: ${JSON.stringify(receiptMoves)}`);
    }
    console.log(`✔ Immutable stock move recorded: Move Ref ${receiptMoves[0].reference}, Type: receipt, Qty: 100`);

    // ----------------------------------------------------
    // TEST 2: Inbound Receipt 2 (Weighted-Average Recalculation)
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Inbound Receipt 2 (50 units @ $13.00, Recalculate WAC) ---');
    const expiryLotB = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // +60 days

    const receipt2Res = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Beta Global Steel',
        destination_warehouse_id: warehouseId,
        lines: [
          {
            product_id: productId,
            lot_number: 'LOT-B-2026',
            expiry_date: expiryLotB,
            expected_qty: 50,
            unit_price: 13.00,
            dest_location_id: locStockId
          }
        ]
      }
    });

    if (receipt2Res.status !== 201 || !receipt2Res.data.success) {
      throw new Error(`Receipt 2 creation failed: ${JSON.stringify(receipt2Res)}`);
    }
    const receipt2 = receipt2Res.data.data;
    console.log(`✔ Inbound Receipt 2 created & processed (Ref: ${receipt2.reference})`);

    // Formula: ((100 * 10.00) + (50 * 13.00)) / (100 + 50) = 1650 / 150 = 11.00
    const prodAfterR2 = await api(`/products/${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const costAfterR2 = parseFloat(prodAfterR2.data.data.cost_price);
    if (Math.abs(costAfterR2 - 11.00) > 0.001) {
      throw new Error(`Expected weighted-average cost 11.00, got ${costAfterR2}`);
    }
    console.log(`✔ Product weighted-average cost correctly recalculated: $${costAfterR2.toFixed(2)} [((100*10)+(50*13))/150 = $11.00]`);

    // Verify Quants now have 2 lots (Lot A = 100, Lot B = 50)
    const quantsR2 = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const totalQty = quantsR2.data.data.reduce((s, q) => s + parseFloat(q.quantity), 0);
    if (totalQty !== 150 || quantsR2.data.data.length !== 2) {
      throw new Error(`Expected 2 quants totaling 150, got: ${JSON.stringify(quantsR2.data)}`);
    }
    const lotBQuant = quantsR2.data.data.find(q => q.lot_number === 'LOT-B-2026');
    const lotBId = lotBQuant.lot_id;
    console.log(`✔ Total stock in location verified: 150 units (Lot A: 100, Lot B: 50)`);

    // ----------------------------------------------------
    // TEST 3: Outbound Delivery with Strict FEFO Consumption
    // ----------------------------------------------------
    console.log('\n--- 3. Testing FEFO Outbound Delivery (Deliver 120 units) ---');
    const deliveryRes = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Metro Construction Ltd',
        source_warehouse_id: warehouseId,
        lines: [
          {
            product_id: productId,
            requested_qty: 120,
            src_location_id: locStockId
          }
        ]
      }
    });

    if (deliveryRes.status !== 201 || !deliveryRes.data.success) {
      throw new Error(`Delivery creation failed: ${JSON.stringify(deliveryRes)}`);
    }
    const delivery = deliveryRes.data.data;
    console.log(`✔ Delivery created & validated (Ref: ${delivery.reference}, Status: ${delivery.status})`);

    // Verify FEFO allocations in response
    const lineAllocations = delivery.allocations;
    console.log('✔ Allocations returned by delivery engine:');
    lineAllocations.forEach(a => {
      console.log(`   - Lot: ${a.lotNumber || 'N/A'}, Qty: ${a.quantity}, Expiry: ${a.expiryDate}`);
    });

    const allocLotA = lineAllocations.find(a => a.lotNumber === 'LOT-A-2026');
    const allocLotB = lineAllocations.find(a => a.lotNumber === 'LOT-B-2026');

    if (!allocLotA || parseFloat(allocLotA.quantity) !== 100) {
      throw new Error(`FEFO error: Expected 100 units consumed from Lot A (+30d), got ${allocLotA?.quantity}`);
    }
    if (!allocLotB || parseFloat(allocLotB.quantity) !== 20) {
      throw new Error(`FEFO error: Expected 20 units consumed from Lot B (+60d), got ${allocLotB?.quantity}`);
    }
    console.log('✔ FEFO rule strictly respected: older expiry lot fully consumed first, next lot consumed for remainder.');

    // Check Quants after delivery
    const quantsAfterDel = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const quantA = quantsAfterDel.data.data.find(q => q.lot_number === 'LOT-A-2026');
    const quantB = quantsAfterDel.data.data.find(q => q.lot_number === 'LOT-B-2026');

    if (quantA && parseFloat(quantA.quantity) !== 0) {
      throw new Error(`Expected Lot A quant to be 0, got ${quantA.quantity}`);
    }
    if (!quantB || parseFloat(quantB.quantity) !== 30) {
      throw new Error(`Expected Lot B quant to be 30, got ${quantB?.quantity}`);
    }
    console.log('✔ Quants successfully updated: Lot A = 0 units, Lot B = 30 units (30 total in stock)');

    // Check Cost Layers depletion in DB
    const costLayersDb = await mockPool.query(
      'SELECT id, initial_qty, remaining_qty, unit_cost FROM cost_layers WHERE product_id = $1 ORDER BY id ASC',
      [productId]
    );
    if (parseFloat(costLayersDb.rows[0].remaining_qty) !== 0) {
      throw new Error(`Expected first cost layer remaining to be 0, got ${costLayersDb.rows[0].remaining_qty}`);
    }
    if (parseFloat(costLayersDb.rows[1].remaining_qty) !== 30) {
      throw new Error(`Expected second cost layer remaining to be 30, got ${costLayersDb.rows[1].remaining_qty}`);
    }
    console.log('✔ Cost layers correctly depleted: Layer 1 remaining = 0, Layer 2 remaining = 30 units');

    // ----------------------------------------------------
    // TEST 4: Delivery Validation — Insufficient Stock
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Insufficient Stock Rejection (Attempt delivery of 50 when 30 available) ---');
    const overDeliveryRes = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Metro Construction Ltd',
        source_warehouse_id: warehouseId,
        lines: [
          {
            product_id: productId,
            requested_qty: 50, // Only 30 available!
            src_location_id: locStockId
          }
        ]
      }
    });

    if (overDeliveryRes.status === 400 && overDeliveryRes.data.error.code === 'INSUFFICIENT_STOCK') {
      console.log(`✔ Rejected with 400 INSUFFICIENT_STOCK: "${overDeliveryRes.data.error.message}"`);
    } else {
      throw new Error(`Failed to reject over-delivery: ${JSON.stringify(overDeliveryRes)}`);
    }

    // Verify stock is still exactly 30
    const quantsAfterFailedDel = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const quantBCheck = quantsAfterFailedDel.data.data.find(q => q.lot_number === 'LOT-B-2026');
    if (parseFloat(quantBCheck.quantity) !== 30) {
      throw new Error(`Transaction rollback failure: expected 30 remaining, found ${quantBCheck.quantity}`);
    }
    console.log('✔ Transaction rolled back: zero quant changes persisted on failure.');

    // ----------------------------------------------------
    // TEST 5: Internal Transfer (Location to Location)
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Internal Stock Transfer (10 units Lot B from Stock to Shelf B) ---');
    const transferRes = await api('/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        product_id: productId,
        lot_id: lotBId,
        source_location_id: locStockId,
        destination_location_id: locShelfBId,
        quantity: 10,
        remarks: 'Replenishing picking shelf B'
      }
    });

    if (transferRes.status !== 201 || !transferRes.data.success) {
      throw new Error(`Transfer creation failed: ${JSON.stringify(transferRes)}`);
    }
    console.log(`✔ Internal Transfer executed (Ref: ${transferRes.data.data.reference})`);

    // Verify Source quant decreased to 20
    const sourceQuant = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const bAtSource = sourceQuant.data.data.find(q => q.lot_id === lotBId);
    if (parseFloat(bAtSource.quantity) !== 20) {
      throw new Error(`Expected source quant to be 20, got ${bAtSource?.quantity}`);
    }

    // Verify Dest quant increased to 10 with SAME LOT
    const destQuant = await api(`/quants?product_id=${productId}&location_id=${locShelfBId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const bAtDest = destQuant.data.data.find(q => q.lot_id === lotBId);
    if (!bAtDest || parseFloat(bAtDest.quantity) !== 10) {
      throw new Error(`Expected dest quant to be 10 for Lot B, got ${bAtDest?.quantity}`);
    }

    // Verify total quantity invariant: 20 + 10 = 30
    console.log(`✔ Transfer quantities verified: Source Stock = 20, Dest Shelf B = 10 (Total across warehouse = 30)`);
    console.log(`✔ Lot preservation verified: Lot ID ${lotBId} (${bAtDest.lot_number}) preserved at destination.`);

    // Verify Stock Move record
    const movesTransfer = await api(`/moves?product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const transferMove = movesTransfer.data.data.find(m => m.origin_document === transferRes.data.data.reference);
    if (!transferMove || transferMove.move_type !== 'internal_transfer' || parseFloat(transferMove.quantity) !== 10) {
      throw new Error(`Expected internal_transfer move of qty 10, got: ${JSON.stringify(transferMove)}`);
    }
    console.log(`✔ Immutable stock move logged for transfer: Ref ${transferMove.reference}, Type: internal_transfer`);

    // ----------------------------------------------------
    // TEST 6: Inventory Adjustment (Damaged stock write-off)
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Inventory Adjustment & RBAC (Physical count: 18 units at Stock, -2 scrap) ---');
    // First, verify staff cannot execute adjustments
    const staffAdjRes = await api('/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        product_id: productId,
        location_id: locStockId,
        lot_id: lotBId,
        counted_qty: 18,
        reason: 'Staff attempted adjustment'
      }
    });
    if (staffAdjRes.status === 403 && staffAdjRes.data.error.code === 'FORBIDDEN') {
      console.log('✔ RBAC enforced: Warehouse staff forbidden from creating adjustments (403 FORBIDDEN)');
    } else {
      throw new Error(`Expected 403 FORBIDDEN for staff adjustment: ${JSON.stringify(staffAdjRes)}`);
    }

    // Now execute adjustment as Inventory Manager
    const adjustRes = await api('/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        product_id: productId,
        location_id: locStockId,
        lot_id: lotBId,
        counted_qty: 18, // Was 20, so difference is -2
        reason: 'Water damage during warehouse cleaning'
      }
    });

    if (adjustRes.status !== 201 || !adjustRes.data.success) {
      throw new Error(`Adjustment failed: ${JSON.stringify(adjustRes)}`);
    }
    console.log(`✔ Adjustment executed as manager (Ref: ${adjustRes.data.data.reference}, Diff: ${adjustRes.data.data.difference_qty})`);

    // Verify stock at Stock location is now 18
    const stockAfterAdj = await api(`/quants?product_id=${productId}&location_id=${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const bAfterAdj = stockAfterAdj.data.data.find(q => q.lot_id === lotBId);
    if (parseFloat(bAfterAdj.quantity) !== 18) {
      throw new Error(`Expected quant to be 18 after adjustment, got ${bAfterAdj?.quantity}`);
    }
    console.log('✔ Quant updated accurately to counted physical quantity: 18 units');

    // Verify Adjustment Stock Move logged
    const movesAdj = await api(`/moves?product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const adjMove = movesAdj.data.data.find(m => m.origin_document === adjustRes.data.data.reference);
    if (!adjMove || adjMove.move_type !== 'adjustment_out' || parseFloat(adjMove.quantity) !== 2) {
      throw new Error(`Expected adjustment_out move of qty 2, got: ${JSON.stringify(adjMove)}`);
    }
    console.log(`✔ Immutable stock move logged for adjustment: Ref ${adjMove.reference}, Move Type: adjustment_out, Qty: 2`);

    // ----------------------------------------------------
    // TEST 7: Mid-Transaction Rollback on Failure
    // ----------------------------------------------------
    console.log('\n--- 7. Testing Atomic Rollback on Mid-Transaction Failure ---');
    // Try to transfer more than available from Shelf B (has 10, try to transfer 50)
    const failTransfer = await api('/transfers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        product_id: productId,
        lot_id: lotBId,
        source_location_id: locShelfBId,
        destination_location_id: locStockId,
        quantity: 50 // Exceeds 10 available
      }
    });

    if (failTransfer.status === 400 && failTransfer.data.error.code === 'INSUFFICIENT_STOCK') {
      console.log('✔ Transfer rejected with INSUFFICIENT_STOCK');
    } else {
      throw new Error(`Expected INSUFFICIENT_STOCK for over-transfer: ${JSON.stringify(failTransfer)}`);
    }

    // Check shelf B quant still 10
    const checkShelfB = await api(`/quants?product_id=${productId}&location_id=${locShelfBId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const bCheck = checkShelfB.data.data.find(q => q.lot_id === lotBId);
    if (parseFloat(bCheck.quantity) !== 10) {
      throw new Error(`Rollback failed! Shelf B quant altered to ${bCheck?.quantity}`);
    }
    console.log('✔ Transaction integrity verified: No state leaked during failed transfer');

    // ----------------------------------------------------
    // TEST 8: Query & Operational Endpoints
    // ----------------------------------------------------
    console.log('\n--- 8. Testing Operational Query Endpoints ---');

    // GET /api/quants
    const allQuants = await api('/quants', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allQuants.status !== 200 || !Array.isArray(allQuants.data.data)) {
      throw new Error(`GET /api/quants failed: ${JSON.stringify(allQuants)}`);
    }
    console.log(`✔ GET /api/quants returned ${allQuants.data.data.length} quant entries`);

    // GET /api/moves
    const allMoves = await api('/moves', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allMoves.status !== 200 || !Array.isArray(allMoves.data.data)) {
      throw new Error(`GET /api/moves failed: ${JSON.stringify(allMoves)}`);
    }
    console.log(`✔ GET /api/moves returned ${allMoves.data.data.length} immutable ledger moves`);

    // GET /api/lots
    const allLots = await api(`/lots?product_id=${productId}`, { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allLots.status !== 200 || allLots.data.data.length !== 2) {
      throw new Error(`GET /api/lots failed: ${JSON.stringify(allLots)}`);
    }
    console.log(`✔ GET /api/lots returned ${allLots.data.data.length} lots (Lot A & Lot B) with quantities`);

    // GET /api/receipts
    const allRecs = await api('/receipts', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allRecs.status !== 200 || allRecs.data.data.length !== 2) {
      throw new Error(`GET /api/receipts failed: ${JSON.stringify(allRecs)}`);
    }
    console.log(`✔ GET /api/receipts returned ${allRecs.data.data.length} receipts`);

    // GET /api/deliveries
    const allDels = await api('/deliveries', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allDels.status !== 200 || allDels.data.data.length !== 1) {
      throw new Error(`GET /api/deliveries failed: ${JSON.stringify(allDels)}`);
    }
    console.log(`✔ GET /api/deliveries returned ${allDels.data.data.length} deliveries`);

    // GET /api/transfers
    const allTrans = await api('/transfers', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allTrans.status !== 200 || allTrans.data.data.length !== 1) {
      throw new Error(`GET /api/transfers failed: ${JSON.stringify(allTrans)}`);
    }
    console.log(`✔ GET /api/transfers returned ${allTrans.data.data.length} transfers`);

    // GET /api/adjustments
    const allAdjs = await api('/adjustments', { headers: { Authorization: `Bearer ${staffToken}` } });
    if (allAdjs.status !== 200 || allAdjs.data.data.length !== 1) {
      throw new Error(`GET /api/adjustments failed: ${JSON.stringify(allAdjs)}`);
    }
    console.log(`✔ GET /api/adjustments returned ${allAdjs.data.data.length} adjustments`);

    // ----------------------------------------------------
    // TEST 9: Audit Logs Completeness
    // ----------------------------------------------------
    console.log('\n--- 9. Verifying Audit Log Records ---');
    const auditRes = await api('/audit-logs', { headers: { Authorization: `Bearer ${managerToken}` } });
    if (auditRes.status !== 200 || !Array.isArray(auditRes.data.data)) {
      throw new Error(`GET /api/audit-logs failed: ${JSON.stringify(auditRes)}`);
    }
    const logs = auditRes.data.data;
    console.log(`✔ Audit log entries recorded: ${logs.length}`);

    const hasReceiptAudit = logs.some(a => a.entity_type === 'receipts');
    const hasDeliveryAudit = logs.some(a => a.entity_type === 'deliveries');
    const hasTransferAudit = logs.some(a => a.entity_type === 'transfers' && a.action === 'TRANSFER');
    const hasAdjustmentAudit = logs.some(a => a.entity_type === 'adjustments' && a.action === 'ADJUST');

    if (!hasReceiptAudit) throw new Error('Missing audit log for receipts');
    if (!hasDeliveryAudit) throw new Error('Missing audit log for deliveries');
    if (!hasTransferAudit) throw new Error('Missing audit log for transfers');
    if (!hasAdjustmentAudit) throw new Error('Missing audit log for adjustments');

    console.log('   - Verified presence of receipts audit log');
    console.log('   - Verified presence of deliveries audit log');
    console.log('   - Verified presence of transfers (TRANSFER) audit log');
    console.log('   - Verified presence of adjustments (ADJUST) audit log');

    console.log('\n====================================================');
    console.log('  ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!  ');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ PHASE 3 TEST SUITE FAILED WITH ERROR:');
  console.error(err);
  process.exit(1);
});
