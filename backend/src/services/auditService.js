const { query } = require('../db/pool');

/**
 * Service to record immutable audit trail entries in audit_log.
 * 
 * @param {Object} params
 * @param {number|string|null} params.userId - Authenticated user ID (null for system actions)
 * @param {string} params.action - 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'RESET_PASSWORD', etc.
 * @param {string} params.entityType - e.g. 'users', 'categories', 'uom', 'warehouses', 'locations', 'products'
 * @param {number|string} params.entityId - Primary identifier of the affected entity
 * @param {Object|null} [params.oldValues] - State prior to mutation
 * @param {Object|null} [params.newValues] - State after mutation
 * @param {string|null} [params.ipAddress] - Request IP address
 * @param {Object} [params.client] - Optional transactional pg client
 */
async function logAudit({
  userId = null,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  client = null
}) {
  const sql = `
    INSERT INTO audit_log (
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      ip_address,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id, created_at;
  `;

  const values = [
    userId ? parseInt(userId, 10) : null,
    action,
    entityType,
    String(entityId),
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    ipAddress
  ];

  try {
    if (client) {
      const res = await client.query(sql, values);
      return res.rows[0];
    } else {
      const res = await query(sql, values);
      return res.rows[0];
    }
  } catch (err) {
    // Fail-safe: log warning but avoid breaking caller transactions if logging is non-critical
    console.error(`[AUDIT_LOG_ERROR] Failed to record audit for ${action} on ${entityType}:${entityId}:`, err.message);
    return null;
  }
}

module.exports = {
  logAudit
};
