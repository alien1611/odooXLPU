const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');

/**
 * Barcode Lookup & Management Service.
 * Centralized resolution of scanned barcodes across products, locations, and lots.
 * Prevents duplicate barcodes and ambiguous scans across the warehouse ecosystem.
 */

/**
 * Looks up a barcode across products, locations, and lots.
 *
 * @param {string} rawCode - Scanned or entered barcode string
 * @returns {Promise<Object>} Structured entity identification
 */
async function lookupBarcode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    throw new AppError('Barcode is required for lookup.', 400, 'VALIDATION_ERROR');
  }

  const code = rawCode.trim();

  // 1. Search Products (by barcode or fallback SKU)
  const prodSql = `
    SELECT 
      p.id, 
      p.sku, 
      p.name AS product_name, 
      p.barcode, 
      p.tracking_type, 
      p.cost_price, 
      p.sale_price, 
      p.reorder_point,
      p.lead_time_days,
      p.min_stock_level,
      p.uom_id, 
      u.name AS uom_name, 
      u.code AS uom_code,
      c.name AS category_name
    FROM products p
    JOIN uom u ON p.uom_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = TRUE 
      AND (p.barcode = $1 OR UPPER(p.sku) = UPPER($1))
    LIMIT 1;
  `;
  const prodRes = await query(prodSql, [code]);

  if (prodRes.rows.length > 0) {
    const p = prodRes.rows[0];
    const quantRes = await query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_on_hand FROM stock_quants WHERE product_id = $1',
      [p.id]
    );
    const totalOnHand = parseFloat(quantRes.rows[0]?.total_on_hand || 0);

    return {
      entity_type: 'product',
      entity_id: parseInt(p.id, 10),
      display_name: p.product_name,
      barcode: p.barcode || p.sku,
      product: {
        id: parseInt(p.id, 10),
        sku: p.sku,
        name: p.product_name,
        barcode: p.barcode,
        tracking_type: p.tracking_type,
        cost_price: parseFloat(p.cost_price || 0),
        sale_price: parseFloat(p.sale_price || 0),
        uom_id: parseInt(p.uom_id, 10),
        uom_name: p.uom_name,
        uom_code: p.uom_code,
        category_name: p.category_name,
        total_on_hand: totalOnHand
      }
    };
  }

  // 2. Search Locations (by barcode or fallback code)
  const locSql = `
    SELECT 
      l.id, 
      l.code AS location_code, 
      l.name AS location_name, 
      l.barcode, 
      l.type AS location_type, 
      l.warehouse_id, 
      w.name AS warehouse_name, 
      w.code AS warehouse_code
    FROM locations l
    JOIN warehouses w ON l.warehouse_id = w.id
    WHERE l.is_active = TRUE 
      AND (l.barcode = $1 OR UPPER(l.code) = UPPER($1))
    LIMIT 1;
  `;
  const locRes = await query(locSql, [code]);

  if (locRes.rows.length > 0) {
    const l = locRes.rows[0];
    const locQuantRes = await query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_units FROM stock_quants WHERE location_id = $1',
      [l.id]
    );
    const totalUnitsStored = parseFloat(locQuantRes.rows[0]?.total_units || 0);

    return {
      entity_type: 'location',
      entity_id: parseInt(l.id, 10),
      display_name: `${l.location_name} (${l.location_code})`,
      barcode: l.barcode || l.location_code,
      location: {
        id: parseInt(l.id, 10),
        code: l.location_code,
        name: l.location_name,
        barcode: l.barcode,
        type: l.location_type,
        warehouse_id: parseInt(l.warehouse_id, 10),
        warehouse_name: l.warehouse_name,
        warehouse_code: l.warehouse_code,
        total_units_stored: totalUnitsStored
      }
    };
  }

  // 3. Search Lots (by barcode or fallback lot_number)
  const lotSql = `
    SELECT 
      l.id, 
      l.lot_number, 
      l.barcode, 
      l.expiry_date, 
      l.alert_date,
      l.product_id, 
      p.name AS product_name, 
      p.sku AS product_sku, 
      p.cost_price, 
      u.code AS uom_code
    FROM lots l
    JOIN products p ON l.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    WHERE (l.barcode = $1 OR UPPER(l.lot_number) = UPPER($1))
    LIMIT 1;
  `;
  const lotRes = await query(lotSql, [code]);

  if (lotRes.rows.length > 0) {
    const lot = lotRes.rows[0];
    const lotQuantRes = await query(
      'SELECT COALESCE(SUM(quantity), 0) AS available_quantity FROM stock_quants WHERE lot_id = $1',
      [lot.id]
    );
    const availableQty = parseFloat(lotQuantRes.rows[0]?.available_quantity || 0);

    return {
      entity_type: 'lot',
      entity_id: parseInt(lot.id, 10),
      display_name: `Lot ${lot.lot_number} (${lot.product_name})`,
      barcode: lot.barcode || lot.lot_number,
      lot: {
        id: parseInt(lot.id, 10),
        lot_number: lot.lot_number,
        barcode: lot.barcode,
        expiry_date: lot.expiry_date,
        product_id: parseInt(lot.product_id, 10),
        product_name: lot.product_name,
        product_sku: lot.product_sku,
        cost_price: parseFloat(lot.cost_price || 0),
        uom_code: lot.uom_code,
        available_quantity: availableQty
      }
    };
  }

  // 4. Not found
  throw new AppError(`Barcode or identifier "${code}" not found in system.`, 404, 'BARCODE_NOT_FOUND');
}

/**
 * Assigns or updates a barcode for a product, location, or lot.
 * Enforces uniqueness across the entire system to prevent ambiguous scans.
 *
 * @param {Object} params
 * @param {'product'|'location'|'lot'} params.entityType
 * @param {number} params.entityId
 * @param {string|null} params.barcode
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function assignBarcode({ entityType, entityId, barcode = null }, userId, ipAddress = null) {
  const validTypes = ['product', 'location', 'lot'];
  if (!validTypes.includes(entityType)) {
    throw new AppError(`Invalid entity_type "${entityType}". Must be product, location, or lot.`, 400, 'VALIDATION_ERROR');
  }

  const id = parseInt(entityId, 10);
  if (!id) {
    throw new AppError('entity_id is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanBarcode = (barcode && typeof barcode === 'string' && barcode.trim().length > 0)
    ? barcode.trim()
    : null;

  // If assigning a non-null barcode, verify global uniqueness
  if (cleanBarcode) {
    // Check products
    const prodDup = await query(
      `SELECT id, name, sku FROM products WHERE barcode = $1 AND ($2 != 'product' OR id != $3)`,
      [cleanBarcode, entityType, id]
    );
    if (prodDup.rows.length > 0) {
      throw new AppError(
        `Barcode "${cleanBarcode}" is already assigned to Product "${prodDup.rows[0].name}" (SKU: ${prodDup.rows[0].sku}).`,
        409,
        'DUPLICATE_BARCODE'
      );
    }

    // Check locations
    const locDup = await query(
      `SELECT id, name, code FROM locations WHERE barcode = $1 AND ($2 != 'location' OR id != $3)`,
      [cleanBarcode, entityType, id]
    );
    if (locDup.rows.length > 0) {
      throw new AppError(
        `Barcode "${cleanBarcode}" is already assigned to Location "${locDup.rows[0].name}" (${locDup.rows[0].code}).`,
        409,
        'DUPLICATE_BARCODE'
      );
    }

    // Check lots
    const lotDup = await query(
      `SELECT id, lot_number FROM lots WHERE barcode = $1 AND ($2 != 'lot' OR id != $3)`,
      [cleanBarcode, entityType, id]
    );
    if (lotDup.rows.length > 0) {
      throw new AppError(
        `Barcode "${cleanBarcode}" is already assigned to Lot "${lotDup.rows[0].lot_number}".`,
        409,
        'DUPLICATE_BARCODE'
      );
    }
  }

  let table = '';
  let auditEntity = '';
  if (entityType === 'product') {
    table = 'products';
    auditEntity = 'products';
  } else if (entityType === 'location') {
    table = 'locations';
    auditEntity = 'locations';
  } else {
    table = 'lots';
    auditEntity = 'lots';
  }

  // Fetch previous state for audit
  const prevRes = await query(`SELECT id, barcode FROM ${table} WHERE id = $1`, [id]);
  if (prevRes.rows.length === 0) {
    throw new AppError(`${entityType} with ID ${id} not found.`, 404, 'NOT_FOUND');
  }
  const oldBarcode = prevRes.rows[0].barcode;

  // Update barcode
  const updateSql = `
    UPDATE ${table} 
    SET barcode = $1, updated_at = NOW() 
    WHERE id = $2 
    RETURNING *;
  `;
  const res = await query(updateSql, [cleanBarcode, id]);
  const updatedEntity = res.rows[0];

  // Audit Log
  const action = cleanBarcode ? (oldBarcode ? 'BARCODE_UPDATE' : 'BARCODE_ASSIGN') : 'BARCODE_REMOVE';
  await logAudit({
    userId,
    action,
    entityType: auditEntity,
    entityId: id,
    oldValues: { barcode: oldBarcode },
    newValues: { barcode: cleanBarcode },
    ipAddress
  });

  return updatedEntity;
}

/**
 * Retrieves current theoretical stock quants for a location to facilitate cycle counting.
 *
 * @param {number} locationId
 */
async function getLocationInventoryForCycleCount(locationId) {
  const locId = parseInt(locationId, 10);
  if (!locId) throw new AppError('location_id is required.', 400, 'VALIDATION_ERROR');

  const locRes = await query(
    `SELECT l.id, l.code, l.name, l.warehouse_id, w.name AS warehouse_name, w.code AS warehouse_code
     FROM locations l
     JOIN warehouses w ON l.warehouse_id = w.id
     WHERE l.id = $1`,
    [locId]
  );

  if (locRes.rows.length === 0) {
    throw new AppError('Location not found.', 404, 'NOT_FOUND');
  }
  const location = locRes.rows[0];

  const itemsSql = `
    SELECT 
      sq.id AS quant_id,
      sq.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.barcode AS product_barcode,
      p.tracking_type,
      sq.lot_id,
      l.lot_number,
      l.barcode AS lot_barcode,
      l.expiry_date,
      sq.quantity AS theoretical_qty,
      u.code AS uom_code
    FROM stock_quants sq
    JOIN products p ON sq.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    LEFT JOIN lots l ON sq.lot_id = l.id
    WHERE sq.location_id = $1 AND sq.quantity > 0
    ORDER BY p.name ASC, l.expiry_date ASC NULLS LAST;
  `;
  const { rows: items } = await query(itemsSql, [locId]);

  return {
    location,
    items: items.map(i => ({
      quant_id: parseInt(i.quant_id, 10),
      product_id: parseInt(i.product_id, 10),
      product_name: i.product_name,
      product_sku: i.product_sku,
      product_barcode: i.product_barcode,
      tracking_type: i.tracking_type,
      lot_id: i.lot_id ? parseInt(i.lot_id, 10) : null,
      lot_number: i.lot_number,
      lot_barcode: i.lot_barcode,
      expiry_date: i.expiry_date,
      theoretical_qty: parseFloat(i.theoretical_qty),
      uom_code: i.uom_code
    }))
  };
}

module.exports = {
  lookupBarcode,
  assignBarcode,
  getLocationInventoryForCycleCount
};
