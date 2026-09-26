const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/db/pool');
const authService = require('../src/services/authService');
const receiptService = require('../src/services/receiptService');
const deliveryService = require('../src/services/deliveryService');
const carrierService = require('../src/services/carrierService');

async function seed() {
  console.log('====================================================');
  console.log('  SEEDING STOCKYARD DEMO DATABASE (PostgreSQL 18)   ');
  console.log('====================================================\n');

  const client = await pool.connect();
  try {
    // 1. Users
    console.log('[SEED] Creating default users...');
    let adminUser, staffUser;
    try {
      const adminRes = await authService.signup({
        name: 'Admin Operator',
        email: 'admin@stockyard.local',
        password: 'Password123!',
        role: 'inventory_manager'
      }, '127.0.0.1');
      adminUser = adminRes.user;
      console.log('✔ Admin user created: admin@stockyard.local / Password123!');
    } catch (e) {
      console.log('Admin signup note:', e.message);
      const existing = await client.query("SELECT * FROM users WHERE email = 'admin@stockyard.local'");
      adminUser = existing.rows[0];
      console.log('✔ Admin user exists: admin@stockyard.local');
    }

    try {
      const staffRes = await authService.signup({
        name: 'Warehouse Floor Staff',
        email: 'staff@stockyard.local',
        password: 'Password123!',
        role: 'warehouse_staff'
      }, '127.0.0.1');
      staffUser = staffRes.user;
      console.log('✔ Staff user created: staff@stockyard.local / Password123!');
    } catch (e) {
      console.log('Staff signup note:', e.message);
      const existing = await client.query("SELECT * FROM users WHERE email = 'staff@stockyard.local'");
      staffUser = existing.rows[0];
      console.log('✔ Staff user exists: staff@stockyard.local');
    }

    // 2. Categories
    console.log('[SEED] Creating categories...');
    const catQueries = [
      ['Medical & PPE', 'Medical devices, sanitization, protective equipment'],
      ['Packaging & Tape', 'Corrugated cartons, industrial tape, void fill'],
      ['Pharmaceuticals', 'Active batches, sterile dressings, medical solutions'],
      ['Industrial Tools', 'Warehouse equipment, utility blades, hand tools']
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

    // 3. Units of Measure
    console.log('[SEED] Creating UoMs...');
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
    console.log(`✔ UoM seeded: ${Object.keys(uomMap).length}`);

    // 4. Warehouses
    console.log('[SEED] Creating Warehouses...');
    const wh1 = await client.query(
      `INSERT INTO warehouses (code, name, address) 
       VALUES ('WH-MAIN', 'Stockyard Central Distribution', '404 Logistics Way, Bay Area, CA')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, code`
    );
    const wh2 = await client.query(
      `INSERT INTO warehouses (code, name, address) 
       VALUES ('WH-EAST', 'Stockyard East Regional Depot', '12 Terminal Drive, Newark, NJ')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, code`
    );
    const mainWhId = wh1.rows[0].id;
    console.log('✔ Warehouses seeded: WH-MAIN and WH-EAST');

    // 5. Locations
    console.log('[SEED] Creating Locations...');
    const locQueries = [
      [mainWhId, 'LOC-REC-01', 'Inbound Receiving Dock', 'internal', 'LOC-REC-01', 'general'],
      [mainWhId, 'LOC-STK-01', 'Main Stock Floor Bay A', 'internal', 'LOC-STK-01', 'general'],
      [mainWhId, 'LOC-RES-01', 'Reserve High-Rack Bay 01', 'internal', 'LOC-RES-01', 'reserve'],
      [mainWhId, 'LOC-FWD-01', 'Forward Pick Bin 01', 'internal', 'LOC-FWD-01', 'forward_pick'],
      [mainWhId, 'LOC-OUT-01', 'Outbound Packing & Shipping Bay', 'internal', 'LOC-OUT-01', 'general'],
      [mainWhId, 'LOC-SUPPLIER', 'Global Supplier Partner Source', 'supplier', null, 'general'],
      [mainWhId, 'LOC-CUSTOMER', 'Outbound Customer Consignee', 'customer', null, 'general'],
      [mainWhId, 'LOC-SCRAP', 'Damaged & Quality Quarantine', 'inventory_loss', null, 'general']
    ];
    const locMap = {};
    for (const [whId, code, name, type, barcode, role] of locQueries) {
      const res = await client.query(
        `INSERT INTO locations (warehouse_id, code, name, type, barcode, location_role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (warehouse_id, code) DO UPDATE SET name = EXCLUDED.name, barcode = EXCLUDED.barcode, location_role = EXCLUDED.location_role
         RETURNING id, code`,
        [whId, code, name, type, barcode, role]
      );
      locMap[code] = res.rows[0].id;
    }
    console.log(`✔ Locations seeded: ${Object.keys(locMap).length}`);

    // 6. Products
    console.log('[SEED] Creating Products...');
    const prodQueries = [
      ['Nitrile Medical Gloves (Box 100)', 'GLV-100', 'PROD-GLV-100', catMap['Medical & PPE'], uomMap['Units'], 'lot', 40, 7],
      ['Heavy Duty Packing Tape', 'TAPE-HD', 'PROD-TAPE-HD', catMap['Packaging & Tape'], uomMap['Units'], 'none', 50, 5],
      ['Sterile Gauze Bandages', 'GAUZE-20', 'PROD-GAUZE-20', catMap['Pharmaceuticals'], uomMap['Units'], 'lot', 30, 10],
      ['Industrial Safety Helmet', 'HELMET-IND', 'PROD-HELMET-IND', catMap['Medical & PPE'], uomMap['Units'], 'none', 20, 14]
    ];
    const prodMap = {};
    for (const [name, sku, barcode, catId, uomId, trackingType, reorderPt, leadDays] of prodQueries) {
      const res = await client.query(
        `INSERT INTO products (name, sku, barcode, category_id, uom_id, tracking_type, reorder_point, lead_time_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (sku) DO UPDATE SET barcode = EXCLUDED.barcode, tracking_type = EXCLUDED.tracking_type
         RETURNING id, sku, name`,
        [name, sku, barcode, catId, uomId, trackingType, reorderPt, leadDays]
      );
      prodMap[sku] = res.rows[0].id;
    }
    console.log(`✔ Products seeded: ${Object.keys(prodMap).length}`);

    // 7. Carriers
    console.log('[SEED] Seeding Local Freight Carriers...');
    await carrierService.seedDefaultCarriers();
    console.log('✔ Carriers seeded.');

    // 8. Forward Pick Replenishment Rules
    console.log('[SEED] Creating Forward Pick Replenishment Thresholds...');
    await client.query(
      `INSERT INTO replenishment_configs 
       (warehouse_id, location_id, product_id, min_qty, max_qty)
       VALUES 
       ($1, $2, $3, 20, 80),
       ($1, $2, $4, 15, 60)
       ON CONFLICT (location_id, product_id) 
       DO UPDATE SET min_qty = EXCLUDED.min_qty, max_qty = EXCLUDED.max_qty`,
      [mainWhId, locMap['LOC-FWD-01'], prodMap['GLV-100'], prodMap['GAUZE-20']]
    );
    console.log('✔ Replenishment rules configured for Forward Bin LOC-FWD-01.');

    // 9. Initial Inbound Receipts (Seed Stock with FEFO Lots & Costing)
    console.log('[SEED] Processing Inbound Receipts with FEFO lots & cost layers...');
    const receiptRes = await receiptService.createReceipt({
      supplier_name: 'MediSupply Global Corp',
      destination_warehouse_id: mainWhId,
      auto_process: true,
      lines: [
        {
          product_id: prodMap['GLV-100'],
          dest_location_id: locMap['LOC-RES-01'],
          expected_qty: 30,
          unit_price: 12.50,
          lot_number: 'LOT-GLV-2026A',
          expiry_date: '2026-10-15'
        },
        {
          product_id: prodMap['GLV-100'],
          dest_location_id: locMap['LOC-RES-01'],
          expected_qty: 50,
          unit_price: 13.00,
          lot_number: 'LOT-GLV-2026B',
          expiry_date: '2026-12-30'
        },
        {
          product_id: prodMap['TAPE-HD'],
          dest_location_id: locMap['LOC-STK-01'],
          expected_qty: 100,
          unit_price: 3.50
        },
        {
          product_id: prodMap['GAUZE-20'],
          dest_location_id: locMap['LOC-RES-01'],
          expected_qty: 45,
          unit_price: 5.00,
          lot_number: 'LOT-GAUZE-01',
          expiry_date: '2026-11-20'
        }
      ]
    }, adminUser.id);
    console.log(`✔ Inbound stock validated (Receipt ${receiptRes.reference}): 80 Gloves (2 lots), 100 Tape, 45 Gauze.`);

    // 10. Create a Ready Outbound Delivery for Wave & Packing Testing
    console.log('[SEED] Creating a validated delivery order for packing & shipping demo...');
    const delRes = await deliveryService.createDelivery({
      customer_name: 'St. Jude Community Hospital',
      source_warehouse_id: mainWhId,
      auto_process: true,
      lines: [
        {
          product_id: prodMap['GLV-100'],
          src_location_id: locMap['LOC-RES-01'],
          requested_qty: 35
        },
        {
          product_id: prodMap['TAPE-HD'],
          src_location_id: locMap['LOC-STK-01'],
          requested_qty: 20
        }
      ]
    }, adminUser.id);
    console.log(`✔ Delivery ${delRes.reference} validated with FEFO split across lots.`);

    console.log('\n====================================================');
    console.log('  DATABASE SEEDING COMPLETED SUCCESSFULLY!          ');
    console.log('  Login: admin@stockyard.local / Password123!       ');
    console.log('====================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('[SEED] Fatal error seeding database:', err);
  process.exit(1);
});
