const { query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');

/**
 * List all carriers, optionally filtered by active status.
 */
async function listCarriers({ active_only = false } = {}) {
  let sql = `
    SELECT 
      id, carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at, updated_at
    FROM carriers
  `;
  const params = [];
  if (active_only) {
    sql += ' WHERE is_active = TRUE';
  }
  sql += ' ORDER BY carrier_name ASC';
  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get carrier by ID.
 */
async function getCarrierById(carrierId) {
  const cId = parseInt(carrierId, 10);
  if (!cId) throw new AppError('Invalid carrier ID.', 400, 'VALIDATION_ERROR');

  const res = await query(
    'SELECT id, carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at, updated_at FROM carriers WHERE id = $1',
    [cId]
  );
  if (res.rows.length === 0) {
    throw new AppError('Carrier not found.', 404, 'NOT_FOUND');
  }
  return res.rows[0];
}

/**
 * Create a new shipping carrier (local record).
 */
async function createCarrier({ carrier_code, carrier_name, service_level = 'Standard', tracking_prefix = 'TRK' }, userId, ipAddress = null) {
  if (!carrier_code || typeof carrier_code !== 'string' || carrier_code.trim().length === 0) {
    throw new AppError('carrier_code is required.', 400, 'VALIDATION_ERROR');
  }
  if (!carrier_name || typeof carrier_name !== 'string' || carrier_name.trim().length === 0) {
    throw new AppError('carrier_name is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanCode = carrier_code.trim().toUpperCase();
  const cleanName = carrier_name.trim();
  const cleanService = (service_level && service_level.trim()) || 'Standard';
  const cleanPrefix = ((tracking_prefix && tracking_prefix.trim().toUpperCase()) || 'TRK').replace(/[^A-Z0-9]/g, '');

  const dupCheck = await query('SELECT id FROM carriers WHERE carrier_code = $1', [cleanCode]);
  if (dupCheck.rows.length > 0) {
    throw new AppError(`Carrier code "${cleanCode}" already exists.`, 409, 'DUPLICATE_CARRIER');
  }

  const sql = `
    INSERT INTO carriers (carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
    RETURNING id, carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at;
  `;
  const res = await query(sql, [cleanCode, cleanName, cleanService, cleanPrefix]);
  const carrier = res.rows[0];

  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'carriers',
    entityId: carrier.id,
    newValues: carrier,
    ipAddress
  });

  return carrier;
}

/**
 * Update an existing carrier.
 */
async function updateCarrier(carrierId, { carrier_name, service_level, tracking_prefix, is_active }, userId, ipAddress = null) {
  const carrier = await getCarrierById(carrierId);

  const cleanName = carrier_name !== undefined ? carrier_name.trim() : carrier.carrier_name;
  const cleanService = service_level !== undefined ? service_level.trim() : carrier.service_level;
  const cleanPrefix = tracking_prefix !== undefined ? tracking_prefix.trim().toUpperCase() : carrier.tracking_prefix;
  const cleanActive = is_active !== undefined ? Boolean(is_active) : carrier.is_active;

  const sql = `
    UPDATE carriers
    SET carrier_name = $1, service_level = $2, tracking_prefix = $3, is_active = $4, updated_at = NOW()
    WHERE id = $5
    RETURNING id, carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at, updated_at;
  `;
  const res = await query(sql, [cleanName, cleanService, cleanPrefix, cleanActive, carrier.id]);
  const updated = res.rows[0];

  await logAudit({
    userId,
    action: 'UPDATE',
    entityType: 'carriers',
    entityId: carrier.id,
    oldValues: carrier,
    newValues: updated,
    ipAddress
  });

  return updated;
}

/**
 * Seed default local carriers if none exist.
 */
async function seedDefaultCarriers(userId = null) {
  const check = await query('SELECT COUNT(id)::int AS cnt FROM carriers');
  if (check.rows[0].cnt > 0) return;

  const defaults = [
    { code: 'GROUND', name: 'Standard Freight Ground', service: 'Ground (3-5 Days)', prefix: 'GND' },
    { code: 'EXPRESS', name: 'Express Freight Air', service: 'Next Day Air', prefix: 'EXP' },
    { code: 'LOCAL', name: 'City Metro Delivery', service: 'Same Day Local', prefix: 'LOC' }
  ];

  for (const c of defaults) {
    await query(
      `INSERT INTO carriers (carrier_code, carrier_name, service_level, tracking_prefix, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
       ON CONFLICT (carrier_code) DO NOTHING`,
      [c.code, c.name, c.service, c.prefix]
    );
  }
}

module.exports = {
  listCarriers,
  getCarrierById,
  createCarrier,
  updateCarrier,
  seedDefaultCarriers
};
