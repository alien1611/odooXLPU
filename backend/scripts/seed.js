const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/db/pool');
const authService = require('../src/services/authService');

async function seed() {
  console.log('====================================================');
  console.log('  SEEDING STOCKYARD DEMO DATABASE (PostgreSQL 18)   ');
  console.log('====================================================\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clean previous demo/test data
    console.log('[SEED] Cleaning previous transactions and data...');
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
    await client.query(`
      DELETE FROM audit_log
      WHERE entity_type IN (
        'package_lines', 'packages', 'cross_dock_alerts', 'replenishment_tasks',
        'pick_waves', 'delivery_lines', 'deliveries', 'receipt_lines', 'receipts',
        'transfers', 'adjustments', 'products', 'lots', 'stock_moves',
        'locations', 'warehouses', 'categories', 'carriers'
      )
    `);
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM locations');
    await client.query("DELETE FROM warehouses WHERE code != 'WH-MAIN'");
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM carriers');

    // 2. Users
    console.log('[SEED] Ensuring default users...');
    let adminUser, staffUser;
    const existingAdmin = await client.query("SELECT * FROM users WHERE email = 'admin@stockyard.local'");
    if (existingAdmin.rows.length === 0) {
      const adminRes = await authService.signup({
        name: 'Admin Operator',
        email: 'admin@stockyard.local',
        password: 'Password123!',
        role: 'inventory_manager'
      }, '127.0.0.1');
      adminUser = adminRes.user;
      console.log('✔ Admin user created: admin@stockyard.local / Password123!');
    } else {
      adminUser = existingAdmin.rows[0];
      console.log('✔ Admin user exists: admin@stockyard.local');
    }

    const existingStaff = await client.query("SELECT * FROM users WHERE email = 'staff@stockyard.local'");
    if (existingStaff.rows.length === 0) {
      const staffRes = await authService.signup({
        name: 'Warehouse Floor Staff',
        email: 'staff@stockyard.local',
        password: 'Password123!',
        role: 'warehouse_staff'
      }, '127.0.0.1');
      staffUser = staffRes.user;
      console.log('✔ Staff user created: staff@stockyard.local / Password123!');
    } else {
      staffUser = existingStaff.rows[0];
      console.log('✔ Staff user exists: staff@stockyard.local');
    }

    // 3. Categories
    console.log('[SEED] Creating categories...');
    const catQueries = [
      ['Steel & Metals', 'Raw steel, structural metal, rods and industrial hardware'],
      ['Packaging', 'Corrugated cartons, industrial tape and protective packing supplies']
    ];
    const catMap = {};
    for (const [name, desc] of catQueries) {
      const res = await client.query(
        `INSERT INTO categories (name, description) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id, name`,
        [name, desc]
      );
      catMap[name] = res.rows[0].id;
    }
    console.log(`✔ Categories seeded: ${Object.keys(catMap).length}`);

    // 4. Units of Measure
    console.log('[SEED] Ensuring UoMs...');
    const uomQueries = [
      ['Units', 'UNT', 'unit', 1.000000],
      ['Boxes (10ct)', 'BOX', 'unit', 10.000000],
      ['Kilograms', 'KG', 'weight', 1.000000],
      ['Meters', 'MTR', 'length', 1.000000]
    ];
    const uomMap = {};
    for (const [name, code, type, conv] of uomQueries) {
      const res = await client.query(
        `INSERT INTO uom (name, code, category, conversion_to_base) VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, conversion_to_base = EXCLUDED.conversion_to_base
         RETURNING id, name`,
        [name, code, type, conv]
      );
      uomMap[name] = res.rows[0].id;
    }
    console.log(`✔ UoM verified: ${Object.keys(uomMap).length}`);

    // 5. Warehouse
    console.log('[SEED] Creating Main Warehouse...');
    const whRes = await client.query(
      `INSERT INTO warehouses (code, name, address, is_active) 
       VALUES ('WH-MAIN', 'Main Warehouse', '100 Industrial Parkway, Sector 4', TRUE)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, is_active = TRUE
       RETURNING id, code`
    );
    const mainWhId = whRes.rows[0].id;
    console.log('✔ Warehouse seeded: WH-MAIN (Main Warehouse)');

    // 6. Locations
    console.log('[SEED] Creating Locations...');
    const locQueries = [
      [mainWhId, 'LOC-REC', 'Receiving', 'internal', 'LOC-REC', 'general'],
      [mainWhId, 'LOC-RES-A', 'Reserve Rack A', 'internal', 'LOC-RES-A', 'reserve'],
      [mainWhId, 'LOC-FWD-A', 'Forward Bin A', 'internal', 'LOC-FWD-A', 'forward_pick'],
      [mainWhId, 'LOC-PACK', 'Packing Station', 'internal', 'LOC-PACK', 'general'],
      [mainWhId, 'LOC-DISP', 'Dispatch', 'internal', 'LOC-DISP', 'general']
    ];
    const locMap = {};
    for (const [whId, code, name, type, barcode, role] of locQueries) {
      const res = await client.query(
        `INSERT INTO locations (warehouse_id, code, name, type, barcode, location_role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (warehouse_id, code) DO UPDATE SET name = EXCLUDED.name, barcode = EXCLUDED.barcode, location_role = EXCLUDED.location_role, is_active = TRUE
         RETURNING id, code`,
        [whId, code, name, type, barcode, role]
      );
      locMap[code] = res.rows[0].id;
    }
    console.log(`✔ Locations seeded: ${Object.keys(locMap).length}`);

    // 7. Products
    console.log('[SEED] Creating Demo Products...');
    const prodQueries = [
      // Steel Rods: Tracking lot/FEFO - ZERO STOCK, ZERO LOTS
      ['Steel Rods', 'STEEL-001', 'STEEL-001', catMap['Steel & Metals'], uomMap['Units'], 'lot', 10.00, 18.00, 20, 200, 20, 5],
      ['Heavy Duty Packing Tape', 'TAPE-HD', 'TAPE-HD', catMap['Packaging'], uomMap['Units'], 'none', 3.50, 6.00, 10, 100, 10, 3],
      ['Safety Gloves', 'GLOVES-01', 'GLOVES-01', catMap['Packaging'], uomMap['Units'], 'none', 8.00, 14.00, 10, 80, 10, 4],
      ['Cardboard Boxes', 'BOX-01', 'BOX-01', catMap['Packaging'], uomMap['Units'], 'none', 1.20, 2.50, 15, 150, 15, 2],
      ['Industrial Bolts', 'BOLT-01', 'BOLT-01', catMap['Steel & Metals'], uomMap['Units'], 'none', 0.50, 1.20, 20, 200, 20, 3]
    ];
    const prodMap = {};
    for (const [name, sku, barcode, catId, uomId, trackingType, costPrice, salePrice, minStock, maxStock, reorderPt, leadDays] of prodQueries) {
      const res = await client.query(
        `INSERT INTO products (
           name, sku, barcode, category_id, uom_id, tracking_type,
           cost_price, sale_price, min_stock_level, max_stock_level, reorder_point, lead_time_days, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
         ON CONFLICT (sku) DO UPDATE SET 
           name = EXCLUDED.name, barcode = EXCLUDED.barcode, tracking_type = EXCLUDED.tracking_type,
           cost_price = EXCLUDED.cost_price, sale_price = EXCLUDED.sale_price,
           min_stock_level = EXCLUDED.min_stock_level, max_stock_level = EXCLUDED.max_stock_level,
           reorder_point = EXCLUDED.reorder_point, lead_time_days = EXCLUDED.lead_time_days, is_active = TRUE
         RETURNING id, sku, name`,
        [name, sku, barcode, catId, uomId, trackingType, costPrice, salePrice, minStock, maxStock, reorderPt, leadDays]
      );
      prodMap[sku] = res.rows[0].id;
    }
    console.log(`✔ Products seeded: ${Object.keys(prodMap).length} (Steel Rods has ZERO stock/lots)`);

    // 8. Carriers
    console.log('[SEED] Seeding Local Freight Carriers...');
    const carrierQueries = [
      ['SWIFT', 'Swift Air Express', 'Next Day Air', 'SWF'],
      ['GROUND', 'Road Freight Ground', 'Standard Ground (3-5 Days)', 'RFG'],
      ['METRO', 'Metro Local Courier', 'Same Day Local', 'MLC']
    ];
    for (const [code, name, service, prefix] of carrierQueries) {
      await client.query(
        `INSERT INTO carriers (carrier_code, carrier_name, service_level, tracking_prefix, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (carrier_code) DO UPDATE SET
           carrier_name = EXCLUDED.carrier_name, service_level = EXCLUDED.service_level, tracking_prefix = EXCLUDED.tracking_prefix, is_active = TRUE`,
        [code, name, service, prefix]
      );
    }
    console.log('✔ Carriers seeded: Swift Air Express, Road Freight Ground, Metro Local Courier.');

    // 9. Baseline Stock for Non-Steel Products (genuine stock_quants + cost_layers)
    console.log('[SEED] Establishing baseline stock for non-steel products...');
    const stockItems = [
      { sku: 'TAPE-HD', loc: 'LOC-RES-A', qty: 20.0000, cost: 3.5000 },
      { sku: 'GLOVES-01', loc: 'LOC-FWD-A', qty: 15.0000, cost: 8.0000 },
      { sku: 'BOX-01', loc: 'LOC-RES-A', qty: 30.0000, cost: 1.2000 },
      { sku: 'BOLT-01', loc: 'LOC-FWD-A', qty: 25.0000, cost: 0.5000 }
    ];

    for (const item of stockItems) {
      const pId = prodMap[item.sku];
      const locId = locMap[item.loc];

      await client.query(
        `INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
         VALUES ($1, $2, NULL, $3, 0.0000, NOW())`,
        [pId, locId, item.qty]
      );

      await client.query(
        `INSERT INTO cost_layers (product_id, stock_move_id, initial_qty, remaining_qty, unit_cost, created_at, updated_at)
         VALUES ($1, NULL, $2, $2, $3, NOW(), NOW())`,
        [pId, item.qty, item.cost]
      );
    }
    console.log('✔ Baseline stock established for Tape (20), Gloves (15), Boxes (30), Bolts (25).');

    await client.query('COMMIT');
    console.log('\n====================================================');
    console.log('  DATABASE SEEDING COMPLETED SUCCESSFULLY!          ');
    console.log('  Login: admin@stockyard.local / Password123!       ');
    console.log('====================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[SEED] Fatal error seeding database:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('[SEED] Fatal error seeding database:', err);
  process.exit(1);
});
