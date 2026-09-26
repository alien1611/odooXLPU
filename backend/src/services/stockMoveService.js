const { query } = require('../db/pool');
const { AppError } = require('./authService');
const crypto = require('crypto');

/**
 * Generates an immutable, collision-resistant stock movement reference.
 * Example: MOV-20260926-A1B2C3
 */
function generateMoveReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MOV-${dateStr}-${rand}`;
}

/**
 * Creates an immutable stock movement record.
 * This is the SINGLE SOURCE OF TRUTH for every inventory quantity change.
 *
 * @param {Object} client - PostgreSQL transactional client
 * @param {Object} moveData
 * @param {string} [moveData.reference]
 * @param {number} moveData.productId
 * @param {number|null} [moveData.lotId]
 * @param {number|null} [moveData.srcLocationId]
 * @param {number|null} [moveData.destLocationId]
 * @param {number} moveData.quantity
 * @param {number} moveData.uomId
 * @param {number} [moveData.unitCost]
 * @param {string} [moveData.state] - 'draft', 'confirmed', 'assigned', 'done', 'cancelled'
 * @param {string} moveData.moveType - 'receipt', 'delivery', 'internal_transfer', 'adjustment_in', 'adjustment_out', 'scrap'
 * @param {string|null} [moveData.originDocument]
 * @param {number|null} [moveData.performedBy]
 */
async function createStockMove(client, {
  reference = null,
  productId,
  lotId = null,
  srcLocationId = null,
  destLocationId = null,
  quantity,
  uomId,
  unitCost = 0,
  state = 'done',
  moveType,
  originDocument = null,
  performedBy = null
}) {
  const ref = reference || generateMoveReference();
  const pId = parseInt(productId, 10);
  const lId = lotId ? parseInt(lotId, 10) : null;
  const srcId = srcLocationId ? parseInt(srcLocationId, 10) : null;
  const destId = destLocationId ? parseInt(destLocationId, 10) : null;
  const qty = parseFloat(quantity);
  const uId = parseInt(uomId, 10);
  const cost = parseFloat(unitCost) || 0;
  const user = performedBy ? parseInt(performedBy, 10) : null;

  if (qty <= 0) {
    throw new AppError('Stock movement quantity must be greater than 0.', 400, 'VALIDATION_ERROR');
  }

  if (!srcId && !destId) {
    throw new AppError('Stock movement requires at least a source or destination location.', 400, 'VALIDATION_ERROR');
  }

  const insertSql = `
    INSERT INTO stock_moves (
      reference, product_id, lot_id, src_location_id, dest_location_id,
      quantity, uom_id, unit_cost, state, move_type, origin_document,
      performed_by, created_at, done_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11,
      $12, NOW(), CASE WHEN $9 = 'done' THEN NOW() ELSE NULL END
    )
    RETURNING 
      id, reference, product_id, lot_id, src_location_id, dest_location_id,
      quantity, uom_id, unit_cost, state, move_type, origin_document,
      performed_by, created_at, done_at;
  `;

  const values = [
    ref, pId, lId, srcId, destId,
    qty, uId, cost, state, moveType, originDocument,
    user
  ];

  const res = await client.query(insertSql, values);
  return res.rows[0];
}

/**
 * List immutable stock moves ledger with rich relationships.
 */
async function listStockMoves({
  productId = null,
  moveType = null,
  originDocument = null,
  limit = 50,
  offset = 0
} = {}) {
  let sql = `
    SELECT 
      sm.id,
      sm.reference,
      sm.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      sm.lot_id,
      lots.lot_number,
      lots.expiry_date,
      sm.src_location_id,
      sl.name AS src_location_name,
      sl.code AS src_location_code,
      sm.dest_location_id,
      dl.name AS dest_location_name,
      dl.code AS dest_location_code,
      sm.quantity,
      u.code AS uom_code,
      sm.unit_cost,
      (sm.quantity * sm.unit_cost) AS total_value,
      sm.state,
      sm.move_type,
      sm.origin_document,
      sm.performed_by,
      users.full_name AS performed_by_name,
      sm.created_at,
      sm.done_at
    FROM stock_moves sm
    JOIN products p ON sm.product_id = p.id
    JOIN uom u ON sm.uom_id = u.id
    LEFT JOIN lots ON sm.lot_id = lots.id
    LEFT JOIN locations sl ON sm.src_location_id = sl.id
    LEFT JOIN locations dl ON sm.dest_location_id = dl.id
    LEFT JOIN users ON sm.performed_by = users.id
  `;

  const where = [];
  const params = [];

  if (productId) {
    params.push(parseInt(productId, 10));
    where.push(`sm.product_id = $${params.length}`);
  }
  if (moveType) {
    params.push(moveType);
    where.push(`sm.move_type = $${params.length}`);
  }
  if (originDocument) {
    params.push(originDocument);
    where.push(`sm.origin_document = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ` ORDER BY sm.created_at DESC, sm.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
  params.push(limit, offset);

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  createStockMove,
  listStockMoves,
  generateMoveReference
};
