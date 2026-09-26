const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { AppError } = require('./authService');

const VALID_LOCATION_TYPES = ['internal', 'supplier', 'customer', 'inventory_loss', 'transit'];

/**
 * List locations, optionally filtered by warehouse.
 */
async function listLocations(warehouseId = null) {
  let sql = `
    SELECT 
      l.id, 
      l.warehouse_id, 
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      l.parent_location_id,
      pl.name AS parent_location_name,
      l.code, 
      l.name, 
      l.type, 
      l.barcode, 
      l.is_active, 
      l.created_at,
      COUNT(sq.id)::int AS active_quant_count
    FROM locations l
    JOIN warehouses w ON l.warehouse_id = w.id
    LEFT JOIN locations pl ON l.parent_location_id = pl.id
    LEFT JOIN stock_quants sq ON sq.location_id = l.id AND sq.quantity > 0
  `;

  const params = [];
  if (warehouseId) {
    sql += ' WHERE l.warehouse_id = $1';
    params.push(warehouseId);
  }

  sql += `
    GROUP BY l.id, l.warehouse_id, w.name, w.code, l.parent_location_id, pl.name, l.code, l.name, l.type, l.barcode, l.is_active, l.created_at
    ORDER BY w.name ASC, l.name ASC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Create a new warehouse location.
 */
async function createLocation({
  warehouse_id,
  parent_location_id = null,
  code,
  name,
  type = 'internal',
  barcode = null
}, userId, ipAddress = null) {
  // 1. Validate warehouse_id
  if (!warehouse_id) {
    throw new AppError('warehouse_id is required.', 400, 'VALIDATION_ERROR');
  }

  const whCheck = await query('SELECT id, code FROM warehouses WHERE id = $1', [warehouse_id]);
  if (whCheck.rows.length === 0) {
    throw new AppError('Warehouse not found. Invalid foreign key reference.', 400, 'INVALID_FOREIGN_KEY');
  }

  // 2. Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError('Location name is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanName = name.trim();
  const cleanCode = (code && typeof code === 'string' && code.trim().length > 0)
    ? code.trim().toUpperCase()
    : 'LOC-' + cleanName.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 3. Validate type
  const cleanType = VALID_LOCATION_TYPES.includes(type) ? type : 'internal';

  // 4. Validate parent_location_id if supplied
  let validParentId = null;
  if (parent_location_id) {
    const parentCheck = await query(
      'SELECT id, warehouse_id FROM locations WHERE id = $1',
      [parent_location_id]
    );
    if (parentCheck.rows.length === 0) {
      throw new AppError('Parent location not found. Invalid foreign key reference.', 400, 'INVALID_FOREIGN_KEY');
    }
    // Verify parent is in the same warehouse
    if (parentCheck.rows[0].warehouse_id !== parseInt(warehouse_id, 10)) {
      throw new AppError('Parent location must belong to the same warehouse facility.', 400, 'VALIDATION_ERROR');
    }
    validParentId = parent_location_id;
  }

  // 5. Unique check within warehouse
  const dupCheck = await query(
    'SELECT id FROM locations WHERE warehouse_id = $1 AND UPPER(code) = UPPER($2)',
    [warehouse_id, cleanCode]
  );
  if (dupCheck.rows.length > 0) {
    throw new AppError(`A location with code "${cleanCode}" already exists in this warehouse.`, 409, 'DUPLICATE_LOCATION');
  }

  // 5b. Unique barcode check if provided
  const cleanBarcode = (barcode && typeof barcode === 'string' && barcode.trim().length > 0)
    ? barcode.trim()
    : null;
  if (cleanBarcode) {
    const dupBc = await query('SELECT id, name, code FROM locations WHERE barcode = $1', [cleanBarcode]);
    if (dupBc.rows.length > 0) {
      throw new AppError(`A location with barcode "${cleanBarcode}" already exists.`, 409, 'DUPLICATE_BARCODE');
    }
  }

  const insertSql = `
    INSERT INTO locations (warehouse_id, parent_location_id, code, name, type, barcode, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
    RETURNING id, warehouse_id, parent_location_id, code, name, type, barcode, is_active, created_at;
  `;
  const res = await query(insertSql, [
    warehouse_id,
    validParentId,
    cleanCode,
    cleanName,
    cleanType,
    barcode ? barcode.trim() : null
  ]);
  const newLocation = res.rows[0];

  // Audit Log
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'locations',
    entityId: newLocation.id,
    newValues: newLocation,
    ipAddress
  });

  return newLocation;
}

module.exports = {
  listLocations,
  createLocation,
  VALID_LOCATION_TYPES
};
