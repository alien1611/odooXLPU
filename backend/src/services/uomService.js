const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { AppError } = require('./authService');

/**
 * List all Units of Measure.
 */
async function listUom() {
  const sql = `
    SELECT 
      u.id, 
      u.name, 
      u.code, 
      u.category, 
      u.conversion_to_base, 
      u.is_active, 
      u.created_at,
      COUNT(p.id)::int AS product_count
    FROM uom u
    LEFT JOIN products p ON p.uom_id = u.id
    GROUP BY u.id, u.name, u.code, u.category, u.conversion_to_base, u.is_active, u.created_at
    ORDER BY u.name ASC;
  `;
  const res = await query(sql);
  return res.rows;
}

/**
 * Create a new Unit of Measure.
 */
async function createUom({ name, code, category = 'unit', conversion_to_base = 1.0 }, userId, ipAddress = null) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError('UoM name is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanName = name.trim();
  const cleanCode = (code && typeof code === 'string' && code.trim().length > 0)
    ? code.trim().toUpperCase()
    : cleanName.substring(0, 4).toUpperCase();

  const conv = parseFloat(conversion_to_base);
  if (isNaN(conv) || conv <= 0) {
    throw new AppError('conversion_to_base must be a positive number greater than 0.', 400, 'VALIDATION_ERROR');
  }

  // Check duplicate name or code
  const dupName = await query('SELECT id FROM uom WHERE LOWER(name) = LOWER($1)', [cleanName]);
  if (dupName.rows.length > 0) {
    throw new AppError(`A unit of measure with the name "${cleanName}" already exists.`, 409, 'DUPLICATE_UOM');
  }

  const dupCode = await query('SELECT id FROM uom WHERE UPPER(code) = UPPER($1)', [cleanCode]);
  if (dupCode.rows.length > 0) {
    throw new AppError(`A unit of measure with the code "${cleanCode}" already exists.`, 409, 'DUPLICATE_UOM_CODE');
  }

  const insertSql = `
    INSERT INTO uom (name, code, category, conversion_to_base, is_active, created_at)
    VALUES ($1, $2, $3, $4, TRUE, NOW())
    RETURNING id, name, code, category, conversion_to_base, is_active, created_at;
  `;
  const res = await query(insertSql, [cleanName, cleanCode, category || 'unit', conv]);
  const newUom = res.rows[0];

  // Audit Log
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'uom',
    entityId: newUom.id,
    newValues: newUom,
    ipAddress
  });

  return newUom;
}

module.exports = {
  listUom,
  createUom
};
