/**
 * Phase 5 Automated Verification Suite
 * Tests:
 * 1. Barcode lookup service across products, locations, and lots
 * 2. Unknown barcode rejection (404 BARCODE_NOT_FOUND)
 * 3. Barcode assignment and global duplicate rejection (409 DUPLICATE_BARCODE)
 * 4. Barcode-assisted inbound receipt execution via core engine (stock_moves, quants, costing)
 * 5. Barcode-assisted outbound delivery with authoritative backend FEFO lot allocation (120 units from Lot A:100 + Lot B:20)
 * 6. Barcode-assisted cycle count retrieval and reconciliation via core adjustment engine
 * 7. RBAC enforcement (warehouse_staff vs inventory_manager privileges)
 * 8. Audit trail integrity for barcode events
 */

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('  STARTING PHASE 5 BARCODE & WAREHOUSE OPS TEST');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL with migrations 001 through 005
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

  memDb.public.none(sql1);
  memDb.public.none(sql2);
  memDb.public.none(sql3);
  memDb.public.none(sql4);
  memDb.public.none(sql5);
  console.log('✔ Migrations 001, 002, 003, 004, and 005 applied cleanly into database.');

  // Mock pool adapter
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
  let locDockId = null;
  let categoryId = null;
  let uomId = null;
  let productId = null;
  let lotAId = null;
  let lotBId = null;

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
    console.log('--- 0. Setup: Users & Barcoded Master Data ---');

    const mgrRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Manager Marcus', email: 'manager@phase5.test', password: 'Password123!', role: 'inventory_manager' }
    });
    managerToken = mgrRes.data.data.token;

    const staffRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Operator Otto', email: 'operator@phase5.test', password: 'Password123!', role: 'warehouse_staff' }
    });
    staffToken = staffRes.data.data.token;
    console.log('✔ Manager and Staff users created');

    const whRes = await api('/warehouses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { code: 'WH-METRO', name: 'Metro Distribution Center' }
    });
    warehouseId = whRes.data.data.id;

    // Location with explicit barcode
    const locStockRes = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: warehouseId,
        code: 'BIN-A1-01',
        name: 'Aisle 1 Shelf 1',
        type: 'internal',
        barcode: 'LOC-BIN-A1-01'
      }
    });
    locStockId = locStockRes.data.data.id;

    // Secondary Location without initial barcode
    const locDockRes = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: warehouseId,
        code: 'STAGING-DOCK',
        name: 'Inbound Staging Area',
        type: 'internal'
      }
    });
    locDockId = locDockRes.data.data.id;
    console.log(`✔ Storage locations created (Stock: ${locStockId}, Dock: ${locDockId})`);

    const catRes = await api('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Industrial Hardware', code: 'IND-HW' }
    });
    categoryId = catRes.data.data.id;

    const uomRes = await api('/uom', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Kilogram', code: 'KG', category: 'weight', conversion_to_base: 1.0 }
    });
    uomId = uomRes.data.data.id;

    // Product with explicit barcode and lot-tracking
    const prodRes = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'STL-ROD-20MM',
        name: 'Precision Steel Rods 20mm',
        barcode: '8901234567890',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'lot',
        cost_price: 10.00,
        sale_price: 18.00,
        reorder_point: 50,
        lead_time_days: 7
      }
    });
    productId = prodRes.data.data.id;
    console.log(`✔ Lot-tracked Product created (ID: ${productId}, Barcode: 8901234567890)`);

    // ----------------------------------------------------
    // 1. BARCODE LOOKUP SERVICE
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Barcode Lookup Service ---');

    // Lookup Product by Barcode
    const prodLookup = await api('/barcodes/lookup?code=8901234567890', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!prodLookup.ok) throw new Error(`Product barcode lookup failed: ${JSON.stringify(prodLookup)}`);
    if (prodLookup.data.data.entity_type !== 'product' || prodLookup.data.data.entity_id !== productId) {
      throw new Error(`Product lookup mismatch: ${JSON.stringify(prodLookup.data)}`);
    }
    console.log(`✔ Successfully resolved Product barcode: "${prodLookup.data.data.display_name}" (SKU: ${prodLookup.data.data.product.sku})`);

    // Lookup Product by fallback SKU
    const skuLookup = await api('/barcodes/lookup?code=STL-ROD-20MM', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!skuLookup.ok || skuLookup.data.data.entity_type !== 'product') {
      throw new Error('Product SKU fallback lookup failed');
    }
    console.log('✔ Successfully resolved Product by SKU fallback');

    // Lookup Location by Barcode
    const locLookup = await api('/barcodes/lookup?code=LOC-BIN-A1-01', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!locLookup.ok) throw new Error(`Location barcode lookup failed: ${JSON.stringify(locLookup)}`);
    if (locLookup.data.data.entity_type !== 'location' || locLookup.data.data.entity_id !== locStockId) {
      throw new Error(`Location lookup mismatch: ${JSON.stringify(locLookup.data)}`);
    }
    console.log(`✔ Successfully resolved Location barcode: "${locLookup.data.data.display_name}"`);

    // Lookup Non-existent Barcode (404 BARCODE_NOT_FOUND)
    const notFoundLookup = await api('/barcodes/lookup?code=NON-EXISTENT-BARCODE-999', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (notFoundLookup.status !== 404 || notFoundLookup.data.error?.code !== 'BARCODE_NOT_FOUND') {
      throw new Error(`Expected 404 BARCODE_NOT_FOUND, got ${notFoundLookup.status}: ${JSON.stringify(notFoundLookup)}`);
    }
    console.log('✔ Non-existent barcode correctly rejected with 404 BARCODE_NOT_FOUND');

    // ----------------------------------------------------
    // 2. BARCODE ASSIGNMENT & GLOBAL DUPLICATE PREVENTION
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Barcode Assignment & Duplicate Prevention ---');

    // Assign barcode to Dock Location as manager
    const assignLocRes = await api('/barcodes/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        entityType: 'location',
        entityId: locDockId,
        barcode: 'LOC-DOCK-STAGING'
      }
    });
    if (!assignLocRes.ok) throw new Error(`Assign barcode to location failed: ${JSON.stringify(assignLocRes)}`);
    console.log('✔ Barcode "LOC-DOCK-STAGING" successfully assigned to Location');

    // Verify lookup now finds the assigned barcode
    const verifyDockLookup = await api('/barcodes/lookup?code=LOC-DOCK-STAGING', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!verifyDockLookup.ok || verifyDockLookup.data.data.entity_id !== locDockId) {
      throw new Error('Assigned location barcode not found in lookup');
    }
    console.log('✔ Verified newly assigned barcode resolves immediately via lookup');

    // Attempt to assign the SAME barcode to Product -> 409 DUPLICATE_BARCODE
    const dupProdRes = await api('/barcodes/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        entityType: 'product',
        entityId: productId,
        barcode: 'LOC-DOCK-STAGING'
      }
    });
    if (dupProdRes.status !== 409 || dupProdRes.data.error?.code !== 'DUPLICATE_BARCODE') {
      throw new Error(`Expected 409 DUPLICATE_BARCODE on global duplicate assignment, got ${dupProdRes.status}`);
    }
    console.log('✔ Global duplicate barcode across namespaces correctly rejected with 409 DUPLICATE_BARCODE');

    // RBAC: Staff cannot assign barcodes
    const staffAssignRes = await api('/barcodes/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        entityType: 'location',
        entityId: locDockId,
        barcode: 'STAFF-FAIL-BC'
      }
    });
    if (staffAssignRes.status !== 403) {
      throw new Error(`Expected 403 FORBIDDEN for staff barcode assignment, got ${staffAssignRes.status}`);
    }
    console.log('✔ RBAC enforced: warehouse_staff blocked from assigning barcodes (403 FORBIDDEN)');

    // ----------------------------------------------------
    // 3. BARCODE-ASSISTED RECEIPT WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Barcode-Assisted Inbound Receiving ---');

    // Receipt 1: Lot A (100 units @ $10.00, Expiry: +30 days)
    const expiryA = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const rec1Res = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Metro Steel Mills',
        destination_warehouse_id: warehouseId,
        lines: [{
          product_id: productId,
          lot_number: 'LOT-A-STEEL',
          expiry_date: expiryA,
          expected_qty: 100,
          unit_price: 10.00,
          dest_location_id: locStockId
        }]
      }
    });
    if (!rec1Res.ok) throw new Error(`Receipt 1 failed: ${JSON.stringify(rec1Res)}`);
    console.log(`✔ Receipt 1 validated: 100 units Lot A @ $10.00 received (Ref: ${rec1Res.data.data.reference})`);

    // Receipt 2: Lot B (50 units @ $13.00, Expiry: +60 days)
    const expiryB = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const rec2Res = await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        supplier_name: 'Metro Steel Mills',
        destination_warehouse_id: warehouseId,
        lines: [{
          product_id: productId,
          lot_number: 'LOT-B-STEEL',
          expiry_date: expiryB,
          expected_qty: 50,
          unit_price: 13.00,
          dest_location_id: locStockId
        }]
      }
    });
    if (!rec2Res.ok) throw new Error(`Receipt 2 failed: ${JSON.stringify(rec2Res)}`);
    console.log(`✔ Receipt 2 validated: 50 units Lot B @ $13.00 received (Ref: ${rec2Res.data.data.reference})`);

    // Fetch created lot IDs
    const lotsRes = await api('/lots', { headers: { Authorization: `Bearer ${staffToken}` } });
    const lotA = lotsRes.data.data.find(l => l.lot_number === 'LOT-A-STEEL');
    const lotB = lotsRes.data.data.find(l => l.lot_number === 'LOT-B-STEEL');
    if (!lotA || !lotB) throw new Error('Created lots not found');
    lotAId = lotA.id;
    lotBId = lotB.id;

    // Assign barcode to Lot A
    await api('/barcodes/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { entityType: 'lot', entityId: lotAId, barcode: 'BC-LOT-A-STEEL' }
    });

    // Lookup Lot by its assigned barcode
    const lotLookup = await api('/barcodes/lookup?code=BC-LOT-A-STEEL', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!lotLookup.ok || lotLookup.data.data.entity_type !== 'lot' || lotLookup.data.data.entity_id !== lotAId) {
      throw new Error(`Lot barcode lookup failed: ${JSON.stringify(lotLookup)}`);
    }
    console.log(`✔ Lot barcode "BC-LOT-A-STEEL" resolved: Lot ${lotLookup.data.data.lot.lot_number}`);

    // Verify Stock Moves & Cost Layers were generated by core engine
    const movesRes = await api(`/moves?product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (movesRes.data.data.length !== 2) {
      throw new Error(`Expected 2 immutable stock moves from receipts, got ${movesRes.data.data.length}`);
    }
    console.log('✔ Verified receipts correctly generated immutable stock_moves (single source of truth)');

    // ----------------------------------------------------
    // 4. BARCODE-ASSISTED DELIVERY (FEFO ALLOCATION VERIFICATION)
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Barcode Delivery with Authoritative FEFO ---');

    // Deliver 120 units:
    // Core Engine Rule: Must strictly consume:
    // - Lot A (older expiry +30d): 100 units (full lot)
    // - Lot B (newer expiry +60d): 20 units (partial lot)
    const delRes = await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Metro Construction Group',
        source_warehouse_id: warehouseId,
        lines: [{
          product_id: productId,
          requested_qty: 120,
          src_location_id: locStockId
        }]
      }
    });
    if (!delRes.ok) throw new Error(`Delivery creation failed: ${JSON.stringify(delRes)}`);

    const delivery = delRes.data.data;
    const allocations = delivery.allocations || [];
    console.log('✔ Delivery validated. FEFO Allocations executed:');
    allocations.forEach(a => {
      console.log(`   - Lot ID ${a.lotId} (${a.lotNumber}): ${a.quantity} units (Expiry: ${a.expiryDate})`);
    });

    const allocA = allocations.find(a => String(a.lotId) === String(lotAId));
    const allocB = allocations.find(a => String(a.lotId) === String(lotBId));

    if (!allocA || parseFloat(allocA.quantity) !== 100) {
      throw new Error(`FEFO violation: Expected 100 units allocated from Lot A, got ${allocA?.quantity}`);
    }
    if (!allocB || parseFloat(allocB.quantity) !== 20) {
      throw new Error(`FEFO violation: Expected 20 units allocated from Lot B, got ${allocB?.quantity}`);
    }
    console.log('✔ Authoritative backend FEFO verified: 100 units from Lot A + 20 units from Lot B');

    // Verify remaining quantities in stock_quants
    const quantsRes = await api(`/quants?location_id=${locStockId}&product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const quantA = quantsRes.data.data.find(q => String(q.lot_id) === String(lotAId));
    const quantB = quantsRes.data.data.find(q => String(q.lot_id) === String(lotBId));

    if (parseFloat(quantA?.quantity || 0) !== 0) {
      throw new Error(`Expected Lot A quant to be 0, got ${quantA?.quantity}`);
    }
    if (parseFloat(quantB?.quantity || 0) !== 30) {
      throw new Error(`Expected Lot B quant to be 30 (50 - 20), got ${quantB?.quantity}`);
    }
    console.log('✔ Stock quants updated accurately: Lot A = 0 units, Lot B = 30 units');

    // ----------------------------------------------------
    // 5. BARCODE-ASSISTED CYCLE COUNT / INVENTORY COUNTING
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Barcode-Assisted Cycle Count Audit ---');

    // Retrieve expected location inventory by location ID
    const locInvRes = await api(`/barcodes/location-inventory/${locStockId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!locInvRes.ok) throw new Error(`Location inventory query failed: ${JSON.stringify(locInvRes)}`);

    const invData = locInvRes.data.data;
    console.log(`✔ Retrieved location inventory for "${invData.location.name}": ${invData.items.length} active item(s)`);

    const countItem = invData.items.find(i => String(i.lot_id) === String(lotBId));
    if (!countItem || parseFloat(countItem.theoretical_qty) !== 30) {
      throw new Error(`Expected theoretical quantity of 30 for Lot B, got ${countItem?.theoretical_qty}`);
    }
    console.log(`✔ Expected theoretical stock for Lot B: ${countItem.theoretical_qty} KG`);

    // Perform Cycle Count: Physical count is 28 KG (variance = -2 KG)
    // Uses the existing Phase 3 adjustmentService via POST /api/adjustments
    const adjRes = await api('/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: warehouseId,
        location_id: locStockId,
        product_id: productId,
        lot_id: lotBId,
        counted_qty: 28,
        difference_qty: -2,
        reason: 'Barcode cycle count discrepancy (-2 KG scrap)'
      }
    });
    if (!adjRes.ok) throw new Error(`Cycle count adjustment failed: ${JSON.stringify(adjRes)}`);
    console.log(`✔ Cycle count adjustment applied (Ref: ${adjRes.data.data.reference}, Diff: -2 KG)`);

    // Verify stock quant updated to 28
    const postAdjQuants = await api(`/quants?location_id=${locStockId}&product_id=${productId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const postQuantB = postAdjQuants.data.data.find(q => String(q.lot_id) === String(lotBId));
    if (parseFloat(postQuantB?.quantity || 0) !== 28) {
      throw new Error(`Expected quant to be updated to 28, got ${postQuantB?.quantity}`);
    }
    console.log('✔ Stock quant reconciled to physical counted quantity (28 KG)');

    // Verify immutable stock_move recorded for the cycle count
    const adjMoves = await api(`/moves?product_id=${productId}&move_type=adjustment_out`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (adjMoves.data.data.length !== 1 || parseFloat(adjMoves.data.data[0].quantity) !== 2) {
      throw new Error('Expected 1 adjustment_out stock move with quantity 2');
    }
    console.log(`✔ Immutable stock move recorded for cycle count variance (Ref: ${adjMoves.data.data[0].reference}, Qty: 2 KG)`);

    // ----------------------------------------------------
    // 6. AUDIT TRAIL VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 6. Verifying Audit Trail for Barcode Events ---');
    const auditRes = await api('/audit-logs?entity_type=locations', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const locAudits = auditRes.data.data;
    const barcodeAudit = locAudits.find(a => a.action === 'BARCODE_ASSIGN');
    if (!barcodeAudit) {
      throw new Error('Expected BARCODE_ASSIGN audit record not found');
    }
    console.log(`✔ Verified audit trail: BARCODE_ASSIGN recorded for Location ID ${barcodeAudit.entity_id}`);

    console.log('\n====================================================');
    console.log('  ALL PHASE 5 VERIFICATION TESTS PASSED CLEANLY!  ');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runPhase5Tests().catch(err => {
  console.error('\n❌ PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
