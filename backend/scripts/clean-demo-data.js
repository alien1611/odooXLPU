const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/db/pool');

async function cleanDemoData() {
  console.log('====================================================');
  console.log('  STOCKYARD DATABASE CLEANUP — FINAL DEMO DATASET   ');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('[1/6] Removing bulk and test transaction data...');
    await client.query('DELETE FROM package_lines');
    await client.query('DELETE FROM packages');
    await client.query('DELETE FROM cross_dock_alerts');
    await client.query('DELETE FROM replenishment_tasks');
    await client.query('DELETE FROM replenishment_configs');
    await client.query('DELETE FROM reorder_suggestions');
    await client.query('DELETE FROM delivery_lines');
    await client.query('DELETE FROM deliveries');
    await client.query('DELETE FROM pick_waves');
    await client.query('DELETE FROM receipt_lines');
    await client.query('DELETE FROM receipts');
    await client.query('DELETE FROM transfers');
    await client.query('DELETE FROM adjustments');
    await client.query('DELETE FROM cost_layers');
    await client.query('DELETE FROM stock_moves');
    await client.query('DELETE FROM stock_quants');
    await client.query('DELETE FROM lots');
    console.log('✔ All historical transactions, moves, quants, and lots cleaned.');

    console.log('[2/6] Cleaning old test audit log entries...');
    await client.query(`
      DELETE FROM audit_log
      WHERE entity_type IN (
        'package_lines', 'packages', 'cross_dock_alerts', 'replenishment_tasks',
        'pick_waves', 'delivery_lines', 'deliveries', 'receipt_lines', 'receipts',
        'transfers', 'adjustments', 'products', 'lots', 'stock_moves',
        'locations', 'warehouses', 'categories', 'carriers'
      )
    `);
    console.log('✔ Bulk test audit records safely cleaned while preserving audit table and login events.');

    console.log('[3/6] Cleaning and preparing master data...');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM locations');
    await client.query("DELETE FROM warehouses WHERE code != 'WH-MAIN'");
    await client.query(`
      UPDATE warehouses 
      SET name = 'Main Warehouse', address = '100 Industrial Parkway, Sector 4', is_active = TRUE
      WHERE code = 'WH-MAIN'
    `);
    const whRes = await client.query("SELECT id FROM warehouses WHERE code = 'WH-MAIN'");
    let mainWhId;
    if (whRes.rows.length === 0) {
      const insWh = await client.query(`
        INSERT INTO warehouses (code, name, address, is_active)
        VALUES ('WH-MAIN', 'Main Warehouse', '100 Industrial Parkway, Sector 4', TRUE)
        RETURNING id
      `);
      mainWhId = insWh.rows[0].id;
    } else {
      mainWhId = whRes.rows[0].id;
    }

    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM carriers');
    console.log('✔ Master data reset to 1 warehouse (WH-MAIN).');

    console.log('[4/6] Creating categories and locations...');
    const catMetal = await client.query(`
      INSERT INTO categories (name, description)
      VALUES ('Steel & Metals', 'Raw steel, structural metal, rods and industrial hardware')
      RETURNING id
    `);
    const catPack = await client.query(`
      INSERT INTO categories (name, description)
      VALUES ('Packaging', 'Corrugated cartons, industrial tape and protective packing supplies')
      RETURNING id
    `);
    const metalCatId = catMetal.rows[0].id;
    const packCatId = catPack.rows[0].id;

    const locSpecs = [
      ['Receiving', 'LOC-REC', 'internal', 'general', 'LOC-REC'],
      ['Reserve Rack A', 'LOC-RES-A', 'internal', 'reserve', 'LOC-RES-A'],
      ['Forward Bin A', 'LOC-FWD-A', 'internal', 'forward_pick', 'LOC-FWD-A'],
      ['Packing Station', 'LOC-PACK', 'internal', 'general', 'LOC-PACK'],
      ['Dispatch', 'LOC-DISP', 'internal', 'general', 'LOC-DISP']
    ];
    const locMap = {};
    for (const [name, code, type, role, barcode] of locSpecs) {
      const res = await client.query(`
        INSERT INTO locations (warehouse_id, code, name, type, location_role, barcode, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id, code
      `, [mainWhId, code, name, type, role, barcode]);
      locMap[code] = res.rows[0].id;
    }
    console.log('✔ Categories and 5 Locations created.');

    console.log('[5/6] Creating 5 demo products & 3 local carriers...');
    const uomRes = await client.query("SELECT id FROM uom WHERE code = 'UNT' OR name = 'Units' LIMIT 1");
    if (uomRes.rows.length === 0) {
      throw new Error('Default Units UoM not found in database.');
    }
    const unitsUomId = uomRes.rows[0].id;

    // 1. Steel Rods (Tracking: lot / FEFO) - ZERO STOCK, ZERO LOTS
    await client.query(`
      INSERT INTO products (
        sku, name, category_id, uom_id, tracking_type, barcode,
        cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
    `, [
      'STEEL-001', 'Steel Rods', metalCatId, unitsUomId, 'lot', 'STEEL-001',
      10.0000, 18.0000, 20.0000, 200.0000, 20.0000, 5
    ]);

    // 2. Heavy Duty Packing Tape
    const tapeRes = await client.query(`
      INSERT INTO products (
        sku, name, category_id, uom_id, tracking_type, barcode,
        cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING id
    `, [
      'TAPE-HD', 'Heavy Duty Packing Tape', packCatId, unitsUomId, 'none', 'TAPE-HD',
      3.5000, 6.0000, 10.0000, 100.0000, 10.0000, 3
    ]);
    const tapeId = tapeRes.rows[0].id;

    // 3. Safety Gloves
    const glovesRes = await client.query(`
      INSERT INTO products (
        sku, name, category_id, uom_id, tracking_type, barcode,
        cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING id
    `, [
      'GLOVES-01', 'Safety Gloves', packCatId, unitsUomId, 'none', 'GLOVES-01',
      8.0000, 14.0000, 10.0000, 80.0000, 10.0000, 4
    ]);
    const glovesId = glovesRes.rows[0].id;

    // 4. Cardboard Boxes
    const boxesRes = await client.query(`
      INSERT INTO products (
        sku, name, category_id, uom_id, tracking_type, barcode,
        cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING id
    `, [
      'BOX-01', 'Cardboard Boxes', packCatId, unitsUomId, 'none', 'BOX-01',
      1.2000, 2.5000, 15.0000, 150.0000, 15.0000, 2
    ]);
    const boxesId = boxesRes.rows[0].id;

    // 5. Industrial Bolts
    const boltsRes = await client.query(`
      INSERT INTO products (
        sku, name, category_id, uom_id, tracking_type, barcode,
        cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING id
    `, [
      'BOLT-01', 'Industrial Bolts', metalCatId, unitsUomId, 'none', 'BOLT-01',
      0.5000, 1.2000, 20.0000, 200.0000, 20.0000, 3
    ]);
    const boltsId = boltsRes.rows[0].id;

    await client.query(`
      INSERT INTO carriers (carrier_code, carrier_name, service_level, tracking_prefix, is_active)
      VALUES 
        ('SWIFT', 'Swift Air Express', 'Next Day Air', 'SWF', TRUE),
        ('GROUND', 'Road Freight Ground', 'Standard Ground (3-5 Days)', 'RFG', TRUE),
        ('METRO', 'Metro Local Courier', 'Same Day Local', 'MLC', TRUE)
    `);
    console.log('✔ Products and Carriers created.');

    console.log('[6/6] Establishing baseline stock for other 4 products...');
    await client.query(`
      INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
      VALUES ($1, $2, NULL, 20.0000, 0.0000, NOW())
    `, [tapeId, locMap['LOC-RES-A']]);
    await client.query(`
      INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
      VALUES ($1, NULL, 20.0000, 20.0000, 3.5000, NOW(), NOW())
    `, [tapeId]);

    await client.query(`
      INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
      VALUES ($1, $2, NULL, 15.0000, 0.0000, NOW())
    `, [glovesId, locMap['LOC-FWD-A']]);
    await client.query(`
      INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
      VALUES ($1, NULL, 15.0000, 15.0000, 8.0000, NOW(), NOW())
    `, [glovesId]);

    await client.query(`
      INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
      VALUES ($1, $2, NULL, 30.0000, 0.0000, NOW())
    `, [boxesId, locMap['LOC-RES-A']]);
    await client.query(`
      INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
      VALUES ($1, NULL, 30.0000, 30.0000, 1.2000, NOW(), NOW())
    `, [boxesId]);

    await client.query(`
      INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
      VALUES ($1, $2, NULL, 25.0000, 0.0000, NOW())
    `, [boltsId, locMap['LOC-FWD-A']]);
    await client.query(`
      INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
      VALUES ($1, NULL, 25.0000, 25.0000, 0.5000, NOW(), NOW())
    `, [boltsId]);

    await client.query('COMMIT');
    console.log('✔ Baseline stock established.');
    console.log('\n====================================================');
    console.log('  CLEAN DEMO DATASET READY FOR LIVE PRODUCT DEMO!   ');
    console.log('====================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database cleanup:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDemoData().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
