const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { AppError } = require('./authService');

/**
 * List all warehouses with location counts.
 */
async function listWarehouses() {
  const sql = `
    SELECT 
      w.id, 
      w.code, 
      w.name, 
      w.address, 
      w.is_active, 
      w.created_at, 
      w.updated_at,
      COUNT(l.id)::int AS location_count
    FROM warehouses w
    LEFT JOIN locations l ON l.warehouse_id = w.id
    GROUP BY w.id, w.code, w.name, w.address, w.is_active, w.created_at, w.updated_at
    ORDER BY w.name ASC;
  `;
  const res = await query(sql);
  return res.rows;
}

/**
 * Create a new warehouse.
 */
async function createWarehouse({ code, name, address = null }, userId, ipAddress = null) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError('Warehouse name is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanName = name.trim();
  let cleanCode = (code && typeof code === 'string' && code.trim().length > 0)
    ? code.trim().toUpperCase()
    : 'WH-' + cleanName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Check duplicate code
  const dupCode = await query('SELECT id FROM warehouses WHERE UPPER(code) = UPPER($1)', [cleanCode]);
  if (dupCode.rows.length > 0) {
    throw new AppError(`A warehouse with code "${cleanCode}" already exists.`, 409, 'DUPLICATE_WAREHOUSE_CODE');
  }

  const insertSql = `
    INSERT INTO warehouses (code, name, address, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, TRUE, NOW(), NOW())
    RETURNING id, code, name, address, is_active, created_at;
  `;
  const res = await query(insertSql, [cleanCode, cleanName, address ? address.trim() : null]);
  const newWarehouse = res.rows[0];

  // Auto-create default 'Stock' internal location for convenience
  const defaultLocSql = `
    INSERT INTO locations (warehouse_id, code, name, type, is_active, created_at, updated_at)
    VALUES ($1, 'STOCK', 'General Stock', 'internal', TRUE, NOW(), NOW())
    ON CONFLICT (warehouse_id, code) DO NOTHING;
  `;
  await query(defaultLocSql, [newWarehouse.id]);

  // Audit Log
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'warehouses',
    entityId: newWarehouse.id,
    newValues: newWarehouse,
    ipAddress
  });

  return newWarehouse;
}

module.exports = {
  listWarehouses,
  createWarehouse
};
