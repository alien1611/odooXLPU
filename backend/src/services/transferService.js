const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { createStockMove } = require('./stockMoveService');
const { adjustQuant, getQuant } = require('./stockQuantService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generateTransferReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TRF-${dateStr}-${rand}`;
}

/**
 * Executes an internal stock transfer between warehouse locations.
 * Preserves product lot identity, creates immutable ledger moves, and updates quants atomically.
 *
 * @param {Object} data
 * @param {number} data.product_id
 * @param {number} data.src_location_id
 * @param {number} data.dest_location_id
 * @param {number|null} [data.lot_id]
 * @param {number} data.quantity
 * @param {string|null} [data.notes]
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function createTransfer({
  product_id,
  src_location_id,
  source_location_id,
  dest_location_id,
  destination_location_id,
  lot_id = null,
  quantity,
  notes = null,
  remarks = null
}, userId, ipAddress = null) {
  const pId = parseInt(product_id, 10);
  const srcId = parseInt(src_location_id || source_location_id, 10);
  const destId = parseInt(dest_location_id || destination_location_id, 10);
  const lId = lot_id ? parseInt(lot_id, 10) : null;
  const qty = parseFloat(quantity);
  const transferNotes = notes || remarks || null;

  if (!pId) throw new AppError('product_id is required.', 400, 'VALIDATION_ERROR');
  if (!srcId) throw new AppError('src_location_id is required.', 400, 'VALIDATION_ERROR');
  if (!destId) throw new AppError('dest_location_id is required.', 400, 'VALIDATION_ERROR');
  if (srcId === destId) {
    throw new AppError('Source and destination locations must be different.', 400, 'VALIDATION_ERROR');
  }
  if (isNaN(qty) || qty <= 0) {
    throw new AppError('Transfer quantity must be greater than 0.', 400, 'VALIDATION_ERROR');
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

    // If product is lot-tracked, verify lot
    if (product.tracking_type === 'lot' && !lId) {
      throw new AppError(`Product "${product.name}" is lot-tracked. Please specify a lot_id to transfer.`, 400, 'LOT_REQUIRED');
    }

    if (lId) {
      const lotCheck = await client.query('SELECT id, lot_number FROM lots WHERE id = $1 AND product_id = $2', [lId, pId]);
      if (lotCheck.rows.length === 0) {
        throw new AppError('Invalid lot reference for this product.', 400, 'INVALID_LOT');
      }
    }

    // 2. Verify Source & Destination Locations
    const srcRes = await client.query('SELECT id, warehouse_id, code, name FROM locations WHERE id = $1', [srcId]);
    if (srcRes.rows.length === 0) throw new AppError('Source location not found.', 404, 'NOT_FOUND');
    const srcLoc = srcRes.rows[0];

    const destRes = await client.query('SELECT id, warehouse_id, code, name FROM locations WHERE id = $1', [destId]);
    if (destRes.rows.length === 0) throw new AppError('Destination location not found.', 404, 'NOT_FOUND');
    const destLoc = destRes.rows[0];

    // 3. Check and Lock Source Stock Quant
    const srcQuant = await getQuant(client, { productId: pId, locationId: srcId, lotId: lId }, true);
    const availableAtSource = srcQuant ? (parseFloat(srcQuant.quantity) - parseFloat(srcQuant.reserved_quantity)) : 0;

    if (availableAtSource < qty) {
      throw new AppError(
        `Insufficient available stock at source location "${srcLoc.code}". Available: ${availableAtSource}, Requested: ${qty}.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    const reference = generateTransferReference();

    // 4. Create Transfer Document Record
    const transferSql = `
      INSERT INTO transfers (
        reference, source_warehouse_id, dest_warehouse_id,
        src_location_id, dest_location_id, product_id, lot_id,
        quantity, status, notes, created_by, created_at, done_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'done', $9, $10, NOW(), NOW())
      RETURNING id, reference, source_warehouse_id, dest_warehouse_id, src_location_id, dest_location_id, product_id, lot_id, quantity, status, created_at, done_at;
    `;
    const transRes = await client.query(transferSql, [
      reference,
      srcLoc.warehouse_id,
      destLoc.warehouse_id,
      srcId,
      destId,
      pId,
      lId,
      qty,
      transferNotes ? transferNotes.trim() : null,
      userId
    ]);
    const transfer = transRes.rows[0];

    // 5. Deduct from Source Quant
    await adjustQuant(client, {
      productId: pId,
      locationId: srcId,
      lotId: lId,
      deltaQuantity: -qty
    });

    // 6. Add to Destination Quant (Preserving Lot Identity)
    await adjustQuant(client, {
      productId: pId,
      locationId: destId,
      lotId: lId,
      deltaQuantity: qty
    });

    // 7. Create Immutable Stock Move (Internal Transfer)
    const move = await createStockMove(client, {
      productId: pId,
      lotId: lId,
      srcLocationId: srcId,
      destLocationId: destId,
      quantity: qty,
      uomId: product.uom_id,
      unitCost: parseFloat(product.cost_price || 0),
      state: 'done',
      moveType: 'internal_transfer',
      originDocument: reference,
      performedBy: userId
    });

    // 8. Audit Log
    await logAudit({
      userId,
      action: 'TRANSFER',
      entityType: 'transfers',
      entityId: transfer.id,
      newValues: {
        reference,
        product: product.sku,
        quantity: qty,
        fromLocation: srcLoc.code,
        toLocation: destLoc.code
      },
      ipAddress,
      client
    });

    // 9. Commit Atomically
    await client.query('COMMIT');

    return {
      ...transfer,
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
 * List internal transfers with full reference details.
 */
async function listTransfers({ productId = null } = {}) {
  let sql = `
    SELECT 
      t.id,
      t.reference,
      t.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      t.lot_id,
      lots.lot_number,
      lots.expiry_date,
      t.src_location_id,
      sl.name AS src_location_name,
      sl.code AS src_location_code,
      sw.name AS source_warehouse_name,
      t.dest_location_id,
      dl.name AS dest_location_name,
      dl.code AS dest_location_code,
      dw.name AS dest_warehouse_name,
      t.quantity,
      u.code AS uom_code,
      t.status,
      t.notes,
      t.created_by,
      users.full_name AS created_by_name,
      t.created_at,
      t.done_at
    FROM transfers t
    JOIN products p ON t.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    JOIN locations sl ON t.src_location_id = sl.id
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN locations dl ON t.dest_location_id = dl.id
    JOIN warehouses dw ON t.dest_warehouse_id = dw.id
    LEFT JOIN lots ON t.lot_id = lots.id
    LEFT JOIN users ON t.created_by = users.id
  `;

  const params = [];
  if (productId) {
    sql += ` WHERE t.product_id = $1`;
    params.push(parseInt(productId, 10));
  }

  sql += ` ORDER BY t.created_at DESC, t.id DESC;`;

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  createTransfer,
  listTransfers
};
