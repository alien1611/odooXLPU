const { query, pool } = require('../db/pool');
const { AppError } = require('./authService');

/**
 * Retrieve or lock a specific stock quant row.
 * Handles both lot-tracked and non-lot-tracked products.
 */
async function getQuant(client, { productId, locationId, lotId = null }, forUpdate = false) {
  const pId = parseInt(productId, 10);
  const locId = parseInt(locationId, 10);
  const lId = lotId ? parseInt(lotId, 10) : null;

  let sql = `
    SELECT id, product_id, location_id, lot_id, quantity, reserved_quantity, updated_at
    FROM stock_quants
    WHERE product_id = $1 AND location_id = $2
  `;
  const params = [pId, locId];

  if (lId !== null) {
    sql += ` AND lot_id = $3`;
    params.push(lId);
  } else {
    sql += ` AND lot_id IS NULL`;
  }

  if (forUpdate) {
    sql += ` FOR UPDATE`;
  }

  const res = await client.query(sql, params);
  return res.rows[0] || null;
}

/**
 * Atomically adjusts on-hand quant quantity.
 * Rejects negative resulting quantities.
 *
 * @param {Object} client - PostgreSQL client with active transaction
 * @param {Object} params
 * @param {number} params.productId
 * @param {number} params.locationId
 * @param {number|null} [params.lotId]
 * @param {number} params.deltaQuantity - Positive to add, negative to subtract
 */
async function adjustQuant(client, { productId, locationId, lotId = null, deltaQuantity }) {
  const pId = parseInt(productId, 10);
  const locId = parseInt(locationId, 10);
  const lId = lotId ? parseInt(lotId, 10) : null;
  const delta = parseFloat(deltaQuantity);

  if (isNaN(delta) || delta === 0) {
    return null;
  }

  // Row-level lock existing quant
  const existing = await getQuant(client, { productId: pId, locationId: locId, lotId: lId }, true);

  if (existing) {
    const currentQty = parseFloat(existing.quantity);
    const newQty = Math.round((currentQty + delta) * 10000) / 10000;

    if (newQty < 0) {
      throw new AppError(
        `Insufficient inventory quantity. Current: ${currentQty}, Requested reduction: ${Math.abs(delta)}.`,
        400,
        'INSUFFICIENT_QUANTITY'
      );
    }

    const updateSql = `
      UPDATE stock_quants
      SET quantity = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, product_id, location_id, lot_id, quantity, reserved_quantity, updated_at;
    `;
    const res = await client.query(updateSql, [newQty, existing.id]);
    return res.rows[0];
  } else {
    // Quant does not exist yet
    if (delta < 0) {
      throw new AppError(
        `Cannot reduce stock from non-existent inventory quant (Location: ${locId}, Product: ${pId}).`,
        400,
        'INSUFFICIENT_QUANTITY'
      );
    }

    const insertSql = `
      INSERT INTO stock_quants (product_id, location_id, lot_id, quantity, reserved_quantity, updated_at)
      VALUES ($1, $2, $3, $4, 0.0000, NOW())
      RETURNING id, product_id, location_id, lot_id, quantity, reserved_quantity, updated_at;
    `;
    const res = await client.query(insertSql, [pId, locId, lId, delta]);
    return res.rows[0];
  }
}

/**
 * List all current stock quants with product, location, warehouse, and lot descriptions.
 */
async function listQuants({ productId = null, warehouseId = null, locationId = null } = {}) {
  let sql = `
    SELECT 
      sq.id,
      sq.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.tracking_type,
      p.cost_price,
      u.code AS uom_code,
      sq.location_id,
      l.name AS location_name,
      l.code AS location_code,
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      sq.lot_id,
      lots.lot_number,
      lots.expiry_date,
      sq.quantity,
      sq.reserved_quantity,
      (sq.quantity - sq.reserved_quantity) AS available_quantity,
      (sq.quantity * p.cost_price) AS total_value,
      sq.updated_at
    FROM stock_quants sq
    JOIN products p ON sq.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    JOIN locations l ON sq.location_id = l.id
    JOIN warehouses w ON l.warehouse_id = w.id
    LEFT JOIN lots ON sq.lot_id = lots.id
    WHERE sq.quantity > 0
  `;

  const where = [];
  const params = [];

  if (productId) {
    params.push(parseInt(productId, 10));
    where.push(`sq.product_id = $${params.length}`);
  }
  if (warehouseId) {
    params.push(parseInt(warehouseId, 10));
    where.push(`w.id = $${params.length}`);
  }
  if (locationId) {
    params.push(parseInt(locationId, 10));
    where.push(`sq.location_id = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ` AND ${where.join(' AND ')}`;
  }

  sql += ` ORDER BY p.name ASC, lots.expiry_date ASC NULLS LAST;`;

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  getQuant,
  adjustQuant,
  listQuants
};
