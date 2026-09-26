const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { createStockMove } = require('./stockMoveService');
const { adjustQuant, getQuant } = require('./stockQuantService');
const { createCostLayer, depleteCostLayers } = require('./costLayerService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generateAdjustmentReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ADJ-${dateStr}-${rand}`;
}

/**
 * Creates and applies an inventory adjustment (reconciliation, damage scrap, or found stock).
 *
 * @param {Object} data
 * @param {number} data.product_id
 * @param {number} data.location_id
 * @param {number|null} [data.lot_id]
 * @param {number} [data.difference_qty] - Direct delta (+/-)
 * @param {number} [data.counted_qty] - Actual counted quantity
 * @param {string} data.reason - Reason for discrepancy
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function createAdjustment({
  product_id,
  location_id,
  lot_id = null,
  difference_qty = null,
  counted_qty = null,
  reason
}, userId, ipAddress = null) {
  const pId = parseInt(product_id, 10);
  const locId = parseInt(location_id, 10);
  const lId = lot_id ? parseInt(lot_id, 10) : null;

  if (!pId) throw new AppError('product_id is required.', 400, 'VALIDATION_ERROR');
  if (!locId) throw new AppError('location_id is required.', 400, 'VALIDATION_ERROR');
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new AppError('Adjustment reason is required (e.g. damaged, cycle count discrepancy).', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify Product
    const prodRes = await client.query(
      'SELECT id, name, sku, uom_id, tracking_type, cost_price FROM products WHERE id = $1 FOR UPDATE',
      [pId]
    );
    if (prodRes.rows.length === 0) {
      throw new AppError('Product not found.', 404, 'NOT_FOUND');
    }
    const product = prodRes.rows[0];

    // If product is lot-tracked, lot_id should be provided
    if (product.tracking_type === 'lot' && !lId) {
      throw new AppError(`Product "${product.name}" is lot-tracked. Please specify a lot_id to adjust.`, 400, 'LOT_REQUIRED');
    }

    if (lId) {
      const lotCheck = await client.query('SELECT id, lot_number FROM lots WHERE id = $1 AND product_id = $2', [lId, pId]);
      if (lotCheck.rows.length === 0) {
        throw new AppError('Invalid lot reference for this product.', 400, 'INVALID_LOT');
      }
    }

    // 2. Verify Location & Get Warehouse
    const locRes = await client.query('SELECT id, warehouse_id, code, name FROM locations WHERE id = $1', [locId]);
    if (locRes.rows.length === 0) throw new AppError('Location not found.', 404, 'NOT_FOUND');
    const location = locRes.rows[0];

    // 3. Lock & Get Current Theoretical Quant
    const currentQuant = await getQuant(client, { productId: pId, locationId: locId, lotId: lId }, true);
    const theoreticalQty = currentQuant ? parseFloat(currentQuant.quantity) : 0.0;

    let delta = 0;
    let finalCounted = 0;

    if (difference_qty !== null && difference_qty !== undefined) {
      delta = parseFloat(difference_qty);
      finalCounted = Math.round((theoreticalQty + delta) * 10000) / 10000;
    } else if (counted_qty !== null && counted_qty !== undefined) {
      finalCounted = parseFloat(counted_qty);
      delta = Math.round((finalCounted - theoreticalQty) * 10000) / 10000;
    } else {
      throw new AppError('Either difference_qty or counted_qty must be provided.', 400, 'VALIDATION_ERROR');
    }

    if (isNaN(delta) || delta === 0) {
      throw new AppError('Adjustment difference cannot be 0 (no variance detected).', 400, 'VALIDATION_ERROR');
    }

    if (finalCounted < 0) {
      throw new AppError(
        `Adjustment would result in negative stock. Current theoretical: ${theoreticalQty}, Attempted delta: ${delta}.`,
        400,
        'INVALID_ADJUSTMENT'
      );
    }

    const reference = generateAdjustmentReference();
    const isIncrease = delta > 0;
    const absDelta = Math.abs(delta);

    // 4. Create Adjustment Record
    const adjSql = `
      INSERT INTO adjustments (
        reference, warehouse_id, location_id, product_id, lot_id,
        counted_qty, theoretical_qty, difference_qty, reason,
        status, created_by, applied_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'applied', $10, NOW(), NOW())
      RETURNING id, reference, warehouse_id, location_id, product_id, lot_id, counted_qty, theoretical_qty, difference_qty, reason, status, applied_at, created_at;
    `;
    const adjRes = await client.query(adjSql, [
      reference,
      location.warehouse_id,
      locId,
      pId,
      lId,
      finalCounted,
      theoreticalQty,
      delta,
      reason.trim(),
      userId
    ]);
    const adjustment = adjRes.rows[0];

    // 5. Update Stock Quant
    await adjustQuant(client, {
      productId: pId,
      locationId: locId,
      lotId: lId,
      deltaQuantity: delta
    });

    // 6. Create Immutable Stock Move
    const move = await createStockMove(client, {
      productId: pId,
      lotId: lId,
      srcLocationId: isIncrease ? null : locId,
      destLocationId: isIncrease ? locId : null,
      quantity: absDelta,
      uomId: product.uom_id,
      unitCost: parseFloat(product.cost_price || 0),
      state: 'done',
      moveType: isIncrease ? 'adjustment_in' : 'adjustment_out',
      originDocument: reference,
      performedBy: userId
    });

    // 7. Cost Layer adjustment
    if (isIncrease) {
      await createCostLayer(client, {
        productId: pId,
        stockMoveId: move.id,
        quantity: absDelta,
        unitCost: parseFloat(product.cost_price || 0)
      });
    } else {
      await depleteCostLayers(client, {
        productId: pId,
        quantity: absDelta
      });
    }

    // 8. Audit Log
    await logAudit({
      userId,
      action: 'ADJUST',
      entityType: 'adjustments',
      entityId: adjustment.id,
      newValues: {
        reference,
        product: product.sku,
        theoretical: theoreticalQty,
        counted: finalCounted,
        delta,
        reason
      },
      ipAddress,
      client
    });

    // 9. Commit Transaction Atomically
    await client.query('COMMIT');

    return {
      ...adjustment,
      stock_move: move
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List adjustments with full product and location descriptions.
 */
async function listAdjustments({ productId = null } = {}) {
  let sql = `
    SELECT 
      a.id,
      a.reference,
      a.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      a.location_id,
      l.name AS location_name,
      l.code AS location_code,
      a.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      a.lot_id,
      lots.lot_number,
      lots.expiry_date,
      a.counted_qty,
      a.theoretical_qty,
      a.difference_qty,
      u.code AS uom_code,
      a.reason,
      a.status,
      a.created_by,
      users.full_name AS created_by_name,
      a.applied_at,
      a.created_at
    FROM adjustments a
    JOIN warehouses w ON a.warehouse_id = w.id
    JOIN locations l ON a.location_id = l.id
    JOIN products p ON a.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    LEFT JOIN lots ON a.lot_id = lots.id
    LEFT JOIN users ON a.created_by = users.id
  `;

  const params = [];
  if (productId) {
    sql += ` WHERE a.product_id = $1`;
    params.push(parseInt(productId, 10));
  }

  sql += ` ORDER BY a.created_at DESC, a.id DESC;`;

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  createAdjustment,
  listAdjustments
};
