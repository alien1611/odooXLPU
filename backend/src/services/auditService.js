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

/**
 * List audit logs with user details.
 */
async function listAuditLogs({ entityType = null, limit = 100 } = {}) {
  let sql = `
    SELECT 
      a.id, 
      a.user_id, 
      u.full_name AS user_name,
      u.email AS user_email,
      a.action, 
      a.entity_type, 
      a.entity_id, 
      a.old_values, 
      a.new_values, 
      a.ip_address, 
      a.created_at
    FROM audit_log a
    LEFT JOIN users u ON a.user_id = u.id
  `;
  const params = [];
  if (entityType) {
    params.push(entityType);
    sql += ` WHERE a.entity_type = $1`;
  }
  sql += ` ORDER BY a.id DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  logAudit,
  listAuditLogs
};
