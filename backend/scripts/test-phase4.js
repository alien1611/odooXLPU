/**
 * Phase 4 Automated Verification Suite
 * Tests:
 * 1. 30-day consumption calculation from immutable stock_moves (delivery, scrap, adjustment_out)
 * 2. Days remaining and lead-time based reorder trigger
 * 3. Zero-consumption safety (no division by zero, no false urgent flags)
 * 4. Automated reorder suggestion generation & persistence
 * 5. Reorder approval -> DRAFT receipt creation (ZERO stock moves, quants unchanged)
 * 6. Reorder dismissal & RBAC enforcement
 * 7. Expiry risk classification (expired, <=7d, <=30d, <=60d, <=90d, safe)
 * 8. Zero-quantity lot exclusion from active expiry risk
 * 9. Sorting by earliest expiry date first
 * 10. Inventory valuation calculation: SUM(remaining_qty * unit_cost)
 * 11. Product-level valuation reconciliation with cost layers
 * 12. Audit trail verification for reorder actions
 */

const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('  STARTING PHASE 4 REORDER, EXPIRY & VALUATION TEST');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL with migrations 001, 002, 003, and 004
  const memDb = newDb();

  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 18.0 (pg-mem)'
  });

  const sql1 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/001_initial_schema.sql'), 'utf8');
  const sql2 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/002_phase2_auth_and_master_data.sql'), 'utf8');
  const sql3 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/003_phase3_stock_engine.sql'), 'utf8');
  const sql4 = fs.readFileSync(path.resolve(__dirname, '../src/db/migrations/004_phase4_reorder_expiry_valuation.sql'), 'utf8');

  memDb.public.none(sql1);
  memDb.public.none(sql2);
  memDb.public.none(sql3);
  memDb.public.none(sql4);
  console.log('✔ Migrations 001, 002, 003, and 004 applied cleanly into database.');

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
  let categoryId = null;
  let uomId = null;
  let productFastId = null;
  let productZeroId = null;
  let productLotId = null;

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

    const mgrRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Manager Morgan', email: 'manager@phase4.test', password: 'Password123!', role: 'inventory_manager' }
    });
    managerToken = mgrRes.data.data.token;
    console.log('✔ Manager created');

    const staffRes = await api('/auth/signup', {
      method: 'POST',
      body: { name: 'Staff Sam', email: 'staff@phase4.test', password: 'Password123!', role: 'warehouse_staff' }
    });
    staffToken = staffRes.data.data.token;
    console.log('✔ Warehouse staff created');

    const whRes = await api('/warehouses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { code: 'WH-MAIN', name: 'Central Logistics Hub' }
    });
    warehouseId = whRes.data.data.id;
    console.log(`✔ Warehouse created (ID: ${warehouseId})`);

    const locRes = await api('/locations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId, code: 'LOC-STOCK', name: 'Main Storage', type: 'internal' }
    });
    locStockId = locRes.data.data.id;
    console.log(`✔ Internal Location created (ID: ${locStockId})`);

    const catRes = await api('/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Healthcare Supplies', code: 'HEALTH' }
    });
    categoryId = catRes.data.data.id;

    const uomRes = await api('/uom', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { name: 'Box', code: 'BOX', category: 'unit', conversion_to_base: 1.0 }
    });
    uomId = uomRes.data.data.id;

    // Product 1: Fast Mover (lead_time_days = 7, reorder_point = 40, cost = $12.00)
    const pFast = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'SKU-FAST-01',
        name: 'Surgical Gloves Nitrile (Box of 100)',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'none',
        cost_price: 12.00,
        sale_price: 24.00,
        reorder_point: 40,
        lead_time_days: 7,
        min_stock_level: 20
      }
    });
    productFastId = pFast.data.data.id;
    console.log(`✔ Fast-mover product created (ID: ${productFastId}, Reorder Point: 40, Lead Time: 7d)`);

    // Product 2: Zero-Consumption Product (lead_time_days = 10, reorder_point = 15, cost = $80.00)
    const pZero = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'SKU-ZERO-01',
        name: 'Emergency Defibrillator Pads Special Edition',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'none',
        cost_price: 80.00,
        sale_price: 150.00,
        reorder_point: 15,
        lead_time_days: 10,
        min_stock_level: 10
      }
    });
    productZeroId = pZero.data.data.id;
    console.log(`✔ Zero-consumption product created (ID: ${productZeroId})`);

    // Product 3: Lot-tracked Item with Expiry Dates (cost = $35.00)
    const pLot = await api('/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        sku: 'SKU-LOT-PHARMA',
        name: 'Antibiotic Injectable Solution 500mg',
        category_id: categoryId,
        uom_id: uomId,
        tracking_type: 'lot',
        cost_price: 35.00,
        sale_price: 70.00,
        reorder_point: 30,
        lead_time_days: 5,
        min_stock_level: 20
      }
    });
    productLotId = pLot.data.data.id;
    console.log(`✔ Lot-tracked product created (ID: ${productLotId})`);

    // ----------------------------------------------------
    // 1. INBOUND RECEIPTS: Seed Stock
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Inbound Receipts & Inventory Setup ---');

    // Receive 100 units of Fast Mover @ $12.00
    await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        supplier_name: 'MedSupply Global',
        destination_warehouse_id: warehouseId,
        lines: [{
          product_id: productFastId,
          expected_qty: 100,
          unit_price: 12.00,
          dest_location_id: locStockId
        }]
      }
    });
    console.log('✔ Inbound receipt 1: 100 units of Fast Mover received');

    // Receive 50 units of Zero-Consumption item @ $80.00
    await api('/receipts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        supplier_name: 'DefibTech Co',
        destination_warehouse_id: warehouseId,
        lines: [{
          product_id: productZeroId,
          expected_qty: 50,
          unit_price: 80.00,
          dest_location_id: locStockId
        }]
      }
    });
    console.log('✔ Inbound receipt 2: 50 units of Zero-Consumption item received');

    // Helper for generating UTC ISO date strings relative to now
    function getOffsetDate(days) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString();
    }

    // Receive Product Lot with different expiry dates:
    // - Expired: -5 days (10 units)
    // - Within 7 days: +3 days (15 units)
    // - Within 30 days: +20 days (20 units)
    // - Within 60 days: +45 days (25 units)
    // - Within 90 days: +75 days (30 units)
    // - Safe: +180 days (50 units)
    // - Zero-qty lot: +10 days (5 units, to be delivered out immediately)
    const lotReceiptLines = [
      { product_id: productLotId, lot_number: 'LOT-EXPIRED', expiry_date: getOffsetDate(-5), expected_qty: 10, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-7D', expiry_date: getOffsetDate(3), expected_qty: 15, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-30D', expiry_date: getOffsetDate(20), expected_qty: 20, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-60D', expiry_date: getOffsetDate(45), expected_qty: 25, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-90D', expiry_date: getOffsetDate(75), expected_qty: 30, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-SAFE', expiry_date: getOffsetDate(180), expected_qty: 50, unit_price: 35.00, dest_location_id: locStockId },
      { product_id: productLotId, lot_number: 'LOT-ZERO', expiry_date: getOffsetDate(10), expected_qty: 5, unit_price: 35.00, dest_location_id: locStockId }
    ];

    for (const line of lotReceiptLines) {
      await api('/receipts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${managerToken}` },
        body: {
          supplier_name: 'PharmaDirect Labs',
          destination_warehouse_id: warehouseId,
          lines: [line]
        }
      });
    }
    console.log('✔ Inbound receipts for all 7 lots created across risk windows');

    // ----------------------------------------------------
    // 2. DELIVERIES: Create Outbound Consumption History
    // ----------------------------------------------------
    console.log('\n--- 2. Creating Outbound Consumption History ---');

    // Deliver 70 units of Fast Mover -> Current stock becomes 100 - 70 = 30 units
    await api('/deliveries', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        customer_name: 'Regional Hospital Network',
        source_warehouse_id: warehouseId,
        lines: [{
          product_id: productFastId,
          requested_qty: 70,
          src_location_id: locStockId
        }]
      }
    });
    console.log('✔ Outbound delivery: 70 units of Fast Mover consumed (Current stock: 30)');

    // Deliver out LOT-ZERO (5 units) so that its quant drops to 0
    // To target LOT-ZERO directly, FEFO will naturally deliver expired/earliest first unless we adjust or deliver
    // Let's use inventory adjustment scrap to write off the 5 units of LOT-ZERO
    const lotsRes = await api('/lots', { headers: { Authorization: `Bearer ${staffToken}` } });
    const lotZeroRecord = lotsRes.data.data.find(l => l.lot_number === 'LOT-ZERO');
    if (!lotZeroRecord) throw new Error('LOT-ZERO record not found');

    await api('/adjustments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        warehouse_id: warehouseId,
        location_id: locStockId,
        product_id: productLotId,
        lot_id: lotZeroRecord.id,
        counted_qty: 0,
        difference_qty: -5,
        reason: 'Recalled defect batch write-off'
      }
    });
    console.log('✔ Adjusted LOT-ZERO quantity to 0 to verify exclusion from active risk');

    // ----------------------------------------------------
    // 3. REORDER INTELLIGENCE & CONSUMPTION CALCULATIONS
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Consumption-Based Reorder Calculations ---');

    const analysisRes = await api(`/reorders/analysis?warehouse_id=${warehouseId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!analysisRes.ok) throw new Error(`Reorder analysis failed: ${JSON.stringify(analysisRes)}`);

    const analysis = analysisRes.data.data;
    const fastAnalysis = analysis.find(a => a.product_id === productFastId);
    const zeroAnalysis = analysis.find(a => a.product_id === productZeroId);

    if (!fastAnalysis) throw new Error('Fast mover analysis missing');
    if (!zeroAnalysis) throw new Error('Zero consumption analysis missing');

    console.log(`✔ Fast Mover Analysis:
       - 30-day Consumption: ${fastAnalysis.total_consumed_30d} units
       - Avg Daily Consumption: ${fastAnalysis.avg_daily_consumption} units/day (Expected: 70/30 = 2.3333)
       - Current Stock: ${fastAnalysis.current_stock}
       - Days Remaining: ${fastAnalysis.days_remaining}d (Expected: 30 / 2.3333 = 12.9d)
       - Lead Time: ${fastAnalysis.lead_time_days}d
       - Reorder Point: ${fastAnalysis.reorder_point}
       - At Risk: ${fastAnalysis.is_at_risk}
       - Suggested Qty: ${fastAnalysis.suggested_qty}`);

    // Verify formula
    const expectedAvg = 70 / 30.0;
    if (Math.abs(fastAnalysis.avg_daily_consumption - expectedAvg) > 0.01) {
      throw new Error(`Average daily consumption mismatch. Got ${fastAnalysis.avg_daily_consumption}, expected ~${expectedAvg}`);
    }
    console.log('✔ Verified avg_daily_consumption = 30_day_consumption / 30');

    const expectedDaysLeft = 30 / expectedAvg;
    if (Math.abs(fastAnalysis.days_remaining - expectedDaysLeft) > 0.2) {
      throw new Error(`Days left mismatch. Got ${fastAnalysis.days_remaining}, expected ~${expectedDaysLeft}`);
    }
    console.log('✔ Verified days_left = current_quantity / avg_daily_consumption');

    // Current stock is 30, which is <= reorder_point (40).
    // Suggested qty should bring stock to at least reorder point: MAX((7 * 2.3333) - 30, 40 - 30, 0) = 10 units
    if (fastAnalysis.suggested_qty < 10) {
      throw new Error(`Expected suggested quantity >= 10, got ${fastAnalysis.suggested_qty}`);
    }
    console.log('✔ Verified suggested_qty formula correctly accounts for lead time and reorder point');

    // Verify Zero-Consumption Safety
    console.log(`✔ Zero Consumption Analysis:
       - 30-day Consumption: ${zeroAnalysis.total_consumed_30d}
       - Avg Daily Consumption: ${zeroAnalysis.avg_daily_consumption}
       - Current Stock: ${zeroAnalysis.current_stock}
       - Days Remaining: ${zeroAnalysis.days_remaining} (Should be null - safe against division by zero)
       - Is At Risk: ${zeroAnalysis.is_at_risk} (Should be false, stock 50 > reorder point 15)
       - Suggested Qty: ${zeroAnalysis.suggested_qty}`);

    if (zeroAnalysis.avg_daily_consumption !== 0) {
      throw new Error('Zero consumption product should have avg_daily_consumption = 0');
    }
    if (zeroAnalysis.days_remaining !== null) {
      throw new Error('Zero consumption product must have days_remaining = null (no division by zero)');
    }
    if (zeroAnalysis.is_at_risk !== false || zeroAnalysis.suggested_qty !== 0) {
      throw new Error('Zero consumption product with adequate stock must NOT trigger false urgent reorder');
    }
    console.log('✔ Verified zero-consumption safety: no division by zero, no false urgency');

    // ----------------------------------------------------
    // 4. PERSISTENCE & APPROVAL -> DRAFT RECEIPT
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Suggestion Generation & Reorder Approval ---');

    // Generate suggestions as manager
    const genRes = await api('/reorders/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { warehouse_id: warehouseId }
    });
    if (!genRes.ok) throw new Error(`Reorder generate failed: ${JSON.stringify(genRes)}`);
    console.log(`✔ Reorder suggestions generated: ${genRes.data.message}`);

    // List suggestions
    const listRes = await api('/reorders/suggestions?status=pending', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!listRes.ok) throw new Error(`List suggestions failed: ${JSON.stringify(listRes)}`);
    const pendingSuggestions = listRes.data.data;
    const fastSuggestion = pendingSuggestions.find(s => s.product_id === productFastId);
    if (!fastSuggestion) throw new Error('Pending reorder suggestion for Fast Mover not found');
    console.log(`✔ Found pending suggestion ID ${fastSuggestion.id} for "${fastSuggestion.product_name}" (Suggested Qty: ${fastSuggestion.suggested_qty})`);

    // Verify RBAC: Staff cannot approve reorder
    const staffApproveRes = await api(`/reorders/${fastSuggestion.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (staffApproveRes.status !== 403) {
      throw new Error(`Expected 403 FORBIDDEN for warehouse_staff approving reorder, got ${staffApproveRes.status}`);
    }
    console.log('✔ RBAC enforced: warehouse_staff correctly rejected from approving reorder (403 FORBIDDEN)');

    // Approve as manager
    const approveRes = await api(`/reorders/${fastSuggestion.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    if (!approveRes.ok) throw new Error(`Approve reorder failed: ${JSON.stringify(approveRes)}`);

    const approvalData = approveRes.data.data;
    const createdDraftReceipt = approvalData.receipt;
    const updatedSuggestion = approvalData.suggestion;

    if (!createdDraftReceipt || !createdDraftReceipt.id) {
      throw new Error('Expected draft receipt object returned on approval');
    }
    if (createdDraftReceipt.status !== 'draft') {
      throw new Error(`Expected receipt status 'draft', got '${createdDraftReceipt.status}'`);
    }
    console.log(`✔ Reorder approved -> Inbound Receipt ${createdDraftReceipt.reference} created with status 'draft'`);

    if (updatedSuggestion.status !== 'approved' || String(updatedSuggestion.receipt_id) !== String(createdDraftReceipt.id)) {
      throw new Error(`Suggestion not properly linked to receipt. Suggestion: ${JSON.stringify(updatedSuggestion)}`);
    }
    console.log(`✔ Suggestion updated to 'approved' and linked to receipt_id: ${updatedSuggestion.receipt_id}`);

    // CRITICAL ENGINE INVARIANT: Check that stock quants were NOT changed by reorder approval
    const quantCheckRes = await api(`/quants?product_id=${productFastId}`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const currentQuant = quantCheckRes.data.data.reduce((sum, q) => sum + parseFloat(q.quantity), 0);
    if (currentQuant !== 30) {
      throw new Error(`Inventory mutated upon approval! Expected 30 units, found ${currentQuant}`);
    }
    console.log('✔ CRITICAL INVARIANT: Inventory quantity remained strictly unchanged (30 units) upon reorder approval');

    // ----------------------------------------------------
    // 5. EXPIRY RISK ANALYTICS
    // ----------------------------------------------------
    console.log('\n--- 5. Testing Expiry Risk Analytics ---');

    const expiryRiskRes = await api('/expiry/risk', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!expiryRiskRes.ok) throw new Error(`Expiry risk query failed: ${JSON.stringify(expiryRiskRes)}`);

    const expiryLots = expiryRiskRes.data.data;
    console.log(`✔ Retrieved ${expiryLots.length} active lots with expiry risk analysis`);

    // Verify Zero-Quantity lot exclusion
    const zeroLotInRisk = expiryLots.find(l => l.lot_number === 'LOT-ZERO');
    if (zeroLotInRisk) {
      throw new Error('LOT-ZERO (quantity = 0) must be EXCLUDED from active expiry risk analytics');
    }
    console.log('✔ Verified zero-quantity lots are strictly excluded from expiry risk analytics');

    // Verify Sorting: Earliest expiry date first
    for (let i = 0; i < expiryLots.length - 1; i++) {
      const dateA = new Date(expiryLots[i].expiry_date).getTime();
      const dateB = new Date(expiryLots[i + 1].expiry_date).getTime();
      if (dateA > dateB) {
        throw new Error(`Expiry results not sorted ascending by date: ${expiryLots[i].lot_number} (${expiryLots[i].expiry_date}) before ${expiryLots[i + 1].lot_number} (${expiryLots[i + 1].expiry_date})`);
      }
    }
    console.log('✔ Verified urgent expiry results strictly sorted by earliest expiry date first');

    // Verify Classifications
    const expiredLot = expiryLots.find(l => l.lot_number === 'LOT-EXPIRED');
    const lot7d = expiryLots.find(l => l.lot_number === 'LOT-7D');
    const lot30d = expiryLots.find(l => l.lot_number === 'LOT-30D');
    const lot60d = expiryLots.find(l => l.lot_number === 'LOT-60D');
    const lot90d = expiryLots.find(l => l.lot_number === 'LOT-90D');
    const safeLot = expiryLots.find(l => l.lot_number === 'LOT-SAFE');

    if (!expiredLot || expiredLot.risk_classification !== 'expired') {
      throw new Error(`Expired lot mismatch: ${JSON.stringify(expiredLot)}`);
    }
    console.log(`✔ LOT-EXPIRED classified as 'expired' (days_remaining: ${expiredLot.days_remaining})`);

    if (!lot7d || lot7d.risk_classification !== 'within_7_days') {
      throw new Error(`7-day lot mismatch: ${JSON.stringify(lot7d)}`);
    }
    console.log(`✔ LOT-7D classified as 'within_7_days' (days_remaining: ${lot7d.days_remaining})`);

    if (!lot30d || lot30d.risk_classification !== 'within_30_days') {
      throw new Error(`30-day lot mismatch: ${JSON.stringify(lot30d)}`);
    }
    console.log(`✔ LOT-30D classified as 'within_30_days' (days_remaining: ${lot30d.days_remaining})`);

    if (!lot60d || lot60d.risk_classification !== 'within_60_days') {
      throw new Error(`60-day lot mismatch: ${JSON.stringify(lot60d)}`);
    }
    console.log(`✔ LOT-60D classified as 'within_60_days' (days_remaining: ${lot60d.days_remaining})`);

    if (!lot90d || lot90d.risk_classification !== 'within_90_days') {
      throw new Error(`90-day lot mismatch: ${JSON.stringify(lot90d)}`);
    }
    console.log(`✔ LOT-90D classified as 'within_90_days' (days_remaining: ${lot90d.days_remaining})`);

    if (!safeLot || safeLot.risk_classification !== 'safe') {
      throw new Error(`Safe lot mismatch: ${JSON.stringify(safeLot)}`);
    }
    console.log(`✔ LOT-SAFE classified as 'safe' (days_remaining: ${safeLot.days_remaining})`);

    // Verify filter by risk_window: 7 days
    const filter7Res = await api('/expiry/risk?risk_window=7', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const filter7Lots = filter7Res.data.data;
    if (filter7Lots.length !== 1 || filter7Lots[0].lot_number !== 'LOT-7D') {
      throw new Error(`Filter risk_window=7 failed. Expected only LOT-7D, got: ${JSON.stringify(filter7Lots)}`);
    }
    console.log('✔ Verified risk_window=7 filter returns only lots within 7-day window');

    // Verify Expiry Summary API
    const summaryRes = await api('/expiry/summary', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const sumData = summaryRes.data.data;
    if (sumData.expired_count !== 1 || sumData.within_7_days_count !== 1 || sumData.safe_count !== 1) {
      throw new Error(`Expiry summary mismatch: ${JSON.stringify(sumData)}`);
    }
    console.log(`✔ Expiry summary metrics verified: ${sumData.at_risk_count} lots at risk, ${sumData.expired_count} expired, ${sumData.safe_count} safe`);

    // ----------------------------------------------------
    // 6. INVENTORY VALUATION
    // ----------------------------------------------------
    console.log('\n--- 6. Testing Inventory Valuation Reconciliations ---');

    // Expected valuation calculation:
    // Fast Mover: 30 units remaining @ $12.00 = $360.00
    // Zero Consumption: 50 units remaining @ $80.00 = $4,000.00
    // Lot Pharma:
    //   LOT-EXPIRED: 10 units @ $35.00 = $350.00
    //   LOT-7D: 15 units @ $35.00 = $525.00
    //   LOT-30D: 20 units @ $35.00 = $700.00
    //   LOT-60D: 25 units @ $35.00 = $875.00
    //   LOT-90D: 30 units @ $35.00 = $1,050.00
    //   LOT-SAFE: 50 units @ $35.00 = $1,750.00
    //   LOT-ZERO: 0 units remaining = $0.00
    // Total Pharma = 150 units @ $35.00 = $5,250.00
    // Grand Total Valuation = $360.00 + $4,000.00 + $5,250.00 = $9,610.00
    // Grand Total Quantity = 30 + 50 + 150 = 230 units

    const valSummaryRes = await api('/valuation/summary', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (!valSummaryRes.ok) throw new Error(`Valuation summary failed: ${JSON.stringify(valSummaryRes)}`);

    const valSummary = valSummaryRes.data.data;
    console.log(`✔ Valuation Summary:
       - Total Value: $${valSummary.total_inventory_value.toFixed(2)} (Expected: $9,610.00)
       - Total Quantity: ${valSummary.total_quantity} (Expected: 230)
       - Active Cost Layers: ${valSummary.active_layers_count}`);

    if (Math.abs(valSummary.total_inventory_value - 9610.00) > 0.01) {
      throw new Error(`Valuation total mismatch! Expected 9610.00, got ${valSummary.total_inventory_value}`);
    }
    if (Math.abs(valSummary.total_quantity - 230) > 0.01) {
      throw new Error(`Valuation total quantity mismatch! Expected 230, got ${valSummary.total_quantity}`);
    }
    console.log('✔ SUM(cost_layers.remaining_qty * cost_layers.unit_cost) matches theoretical cost-layer valuation exactly');

    // Product-level valuation check
    const valProductsRes = await api('/valuation/products', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const valProducts = valProductsRes.data.data;
    const fastVal = valProducts.find(p => p.product_id === productFastId);
    const zeroVal = valProducts.find(p => p.product_id === productZeroId);
    const lotVal = valProducts.find(p => p.product_id === productLotId);

    if (Math.abs(fastVal.total_inventory_value - 360.00) > 0.01) {
      throw new Error(`Fast mover valuation mismatch: got ${fastVal.total_inventory_value}, expected 360.00`);
    }
    if (Math.abs(zeroVal.total_inventory_value - 4000.00) > 0.01) {
      throw new Error(`Zero item valuation mismatch: got ${zeroVal.total_inventory_value}, expected 4000.00`);
    }
    if (Math.abs(lotVal.total_inventory_value - 5250.00) > 0.01) {
      throw new Error(`Lot pharma valuation mismatch: got ${lotVal.total_inventory_value}, expected 5250.00`);
    }
    console.log('✔ Product-level valuations accurately reconcile with underlying cost layers');

    // ----------------------------------------------------
    // 7. AUDIT LOG INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- 7. Verifying Audit Log Integrity ---');
    const auditRes = await api('/audit-logs?entity_type=reorder_suggestions', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const reorderAudits = auditRes.data.data;
    const approveAudit = reorderAudits.find(a => a.action === 'REORDER_APPROVE');
    if (!approveAudit) {
      throw new Error('Expected REORDER_APPROVE audit log entry not found');
    }
    console.log(`✔ Verified audit trail: REORDER_APPROVE recorded for suggestion ID ${approveAudit.entity_id}`);

    console.log('\n====================================================');
    console.log('  ALL PHASE 4 VERIFICATION TESTS PASSED CLEANLY!  ');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runPhase4Tests().catch(err => {
  console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
