const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { createStockMove } = require('./stockMoveService');
const { adjustQuant } = require('./stockQuantService');
const { createCostLayer, updateProductWeightedAverageCost } = require('./costLayerService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generateReceiptReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REC-${dateStr}-${rand}`;
}

/**
 * Creates and optionally processes an inbound receipt within an atomic transaction.
 *
 * @param {Object} data
 * @param {string} data.supplier_name
 * @param {number} data.destination_warehouse_id
 * @param {Array} data.lines - Array of { product_id, lot_number, expiry_date, expected_qty, unit_price, dest_location_id }
 * @param {boolean} [data.auto_process=true] - If true, immediately validates and posts stock movements
 * @param {number} userId - Authenticated user ID
 * @param {string|null} ipAddress
 */
async function createReceipt({
  supplier_name,
  destination_warehouse_id,
  lines = [],
  auto_process = true
}, userId, ipAddress = null) {
  if (!supplier_name || typeof supplier_name !== 'string' || supplier_name.trim().length === 0) {
    throw new AppError('Supplier name is required.', 400, 'VALIDATION_ERROR');
  }

  if (!destination_warehouse_id) {
    throw new AppError('destination_warehouse_id is required.', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError('At least one receipt item line is required.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify Destination Warehouse exists
    const whRes = await client.query('SELECT id, code, name FROM warehouses WHERE id = $1', [destination_warehouse_id]);
    if (whRes.rows.length === 0) {
      throw new AppError('Destination warehouse not found. Invalid reference.', 400, 'INVALID_FOREIGN_KEY');
    }

    const reference = generateReceiptReference();
    const initialStatus = auto_process ? 'done' : 'draft';

    // 2. Create Receipt Header
    const receiptInsertSql = `
      INSERT INTO receipts (
        reference, supplier_name, destination_warehouse_id,
        status, received_date, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, reference, supplier_name, destination_warehouse_id, status, received_date, created_at;
    `;
    const receiptRes = await client.query(receiptInsertSql, [
      reference,
      supplier_name.trim(),
      destination_warehouse_id,
      initialStatus,
      auto_process ? new Date() : null,
      userId
    ]);
    const receipt = receiptRes.rows[0];

    const processedLines = [];

    // 3. Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pId = parseInt(line.product_id, 10);
      const locId = parseInt(line.dest_location_id, 10);
      const qty = parseFloat(line.expected_qty);
      const unitCost = parseFloat(line.unit_price) || 0;

      if (!pId) throw new AppError(`Line ${i + 1}: product_id is required.`, 400, 'VALIDATION_ERROR');
      if (!locId) throw new AppError(`Line ${i + 1}: dest_location_id is required.`, 400, 'VALIDATION_ERROR');
      if (isNaN(qty) || qty <= 0) throw new AppError(`Line ${i + 1}: expected_qty must be greater than 0.`, 400, 'VALIDATION_ERROR');
      if (isNaN(unitCost) || unitCost < 0) throw new AppError(`Line ${i + 1}: unit_price cannot be negative.`, 400, 'VALIDATION_ERROR');

      // Verify Product
      const prodRes = await client.query(
        'SELECT id, name, sku, uom_id, tracking_type, cost_price FROM products WHERE id = $1 FOR UPDATE',
        [pId]
      );
      if (prodRes.rows.length === 0) {
        throw new AppError(`Line ${i + 1}: Product ID ${pId} not found.`, 400, 'INVALID_FOREIGN_KEY');
      }
      const product = prodRes.rows[0];

      // Verify Destination Location belongs to this warehouse
      const locRes = await client.query(
        'SELECT id, warehouse_id, code, name FROM locations WHERE id = $1',
        [locId]
      );
      if (locRes.rows.length === 0) {
        throw new AppError(`Line ${i + 1}: Location ID ${locId} not found.`, 400, 'INVALID_FOREIGN_KEY');
      }
      if (parseInt(locRes.rows[0].warehouse_id, 10) !== parseInt(destination_warehouse_id, 10)) {
        throw new AppError(
          `Line ${i + 1}: Location "${locRes.rows[0].code}" does not belong to destination warehouse.`,
          400,
          'INVALID_LOCATION'
        );
      }

      // Handle Lot / Batch if provided or required
      let lotId = null;
      let cleanLotNumber = line.lot_number ? line.lot_number.trim() : null;
      let expiryDate = line.expiry_date ? new Date(line.expiry_date) : null;

      if (product.tracking_type === 'lot') {
        if (!cleanLotNumber) {
          throw new AppError(
            `Line ${i + 1}: Product "${product.name}" is lot-tracked. A lot_number is required.`,
            400,
            'LOT_REQUIRED'
          );
        }

        if (!expiryDate || isNaN(expiryDate.getTime())) {
          // Default to 1 year if not provided, or reject
          expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }

        // Check if lot already exists for this product
        const lotRes = await client.query(
          'SELECT id, lot_number, expiry_date FROM lots WHERE product_id = $1 AND lot_number = $2 FOR UPDATE',
          [pId, cleanLotNumber]
        );

        if (lotRes.rows.length > 0) {
          lotId = lotRes.rows[0].id;
        } else {
          // Insert new lot
          const newLotSql = `
            INSERT INTO lots (product_id, lot_number, expiry_date, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            RETURNING id;
          `;
          const newLotRes = await client.query(newLotSql, [pId, cleanLotNumber, expiryDate]);
          lotId = newLotRes.rows[0].id;
        }
      }

      // Insert Receipt Line
      const lineInsertSql = `
        INSERT INTO receipt_lines (
          receipt_id, product_id, lot_number, expiry_date,
          expected_qty, received_qty, unit_price, dest_location_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, receipt_id, product_id, lot_number, expiry_date, expected_qty, received_qty, unit_price, dest_location_id;
      `;
      const lineRes = await client.query(lineInsertSql, [
        receipt.id,
        pId,
        cleanLotNumber,
        expiryDate,
        qty,
        auto_process ? qty : 0,
        unitCost,
        locId
      ]);
      const createdLine = lineRes.rows[0];

      // If auto-processing (standard inbound receipt flow):
      if (auto_process) {
        // 4. Create immutable stock_move
        const move = await createStockMove(client, {
          productId: pId,
          lotId,
          srcLocationId: null, // Supplier receipt has NULL origin
          destLocationId: locId,
          quantity: qty,
          uomId: product.uom_id,
          unitCost,
          state: 'done',
          moveType: 'receipt',
          originDocument: receipt.reference,
          performedBy: userId
        });

        // 5. Update cached stock_quant
        await adjustQuant(client, {
          productId: pId,
          locationId: locId,
          lotId,
          deltaQuantity: qty
        });

        // 6. Create cost layer
        await createCostLayer(client, {
          productId: pId,
          stockMoveId: move.id,
          quantity: qty,
          unitCost
        });

        // 7. Recalculate weighted-average cost
        await updateProductWeightedAverageCost(client, {
          productId: pId,
          receivedQty: qty,
          receivedUnitCost: unitCost
        });
      }

      processedLines.push(createdLine);
    }

    // 8. Audit Log
    await logAudit({
      userId,
      action: auto_process ? 'VALIDATE' : 'CREATE',
      entityType: 'receipts',
      entityId: receipt.id,
      newValues: { reference: receipt.reference, supplier: supplier_name, lineCount: processedLines.length },
      ipAddress,
      client
    });

    // 9. Check Cross-Docking Opportunities (without mutating stock)
    let crossDockAlerts = [];
    if (auto_process) {
      try {
        const { checkCrossDockOpportunities } = require('./crossDockService');
        crossDockAlerts = await checkCrossDockOpportunities(client, {
          receiptId: receipt.id,
          lines: processedLines,
          warehouseId: destination_warehouse_id
        });
      } catch (xdErr) {
        console.warn('[CROSS-DOCK] Opportunity check skipped:', xdErr.message);
      }
    }

    // 10. Atomically Commit
    await client.query('COMMIT');

    return {
      ...receipt,
      lines: processedLines,
      cross_dock_alerts: crossDockAlerts
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List all receipts with line count and warehouse details.
 */
async function listReceipts({ status = null } = {}) {
  let sql = `
    SELECT 
      r.id,
      r.reference,
      r.supplier_name,
      r.destination_warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      r.status,
      r.received_date,
      r.created_by,
      u.full_name AS created_by_name,
      r.created_at,
      COUNT(rl.id)::int AS line_count,
      COALESCE(SUM(rl.expected_qty), 0) AS total_expected_qty,
      COALESCE(SUM(rl.received_qty), 0) AS total_received_qty,
      COALESCE(SUM(rl.expected_qty * rl.unit_price), 0) AS total_value
    FROM receipts r
    JOIN warehouses w ON r.destination_warehouse_id = w.id
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN receipt_lines rl ON r.id = rl.receipt_id
  `;

  const params = [];
  if (status) {
    sql += ` WHERE r.status = $1`;
    params.push(status);
  }

  sql += `
    GROUP BY r.id, r.reference, r.supplier_name, r.destination_warehouse_id, w.name, w.code, r.status, r.received_date, r.created_by, u.full_name, r.created_at
    ORDER BY r.created_at DESC, r.id DESC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get detailed receipt by ID with lines and associated stock moves.
 */
async function getReceiptById(receiptId) {
  const rId = parseInt(receiptId, 10);
  const headRes = await query(
    `SELECT 
      r.id, r.reference, r.supplier_name, r.destination_warehouse_id,
      w.name AS warehouse_name, w.code AS warehouse_code,
      r.status, r.received_date, r.created_by, u.full_name AS created_by_name,
      r.created_at
     FROM receipts r
     JOIN warehouses w ON r.destination_warehouse_id = w.id
     LEFT JOIN users u ON r.created_by = u.id
     WHERE r.id = $1`,
    [rId]
  );

  if (headRes.rows.length === 0) {
    throw new AppError('Receipt not found.', 404, 'NOT_FOUND');
  }

  const linesRes = await query(
    `SELECT 
      rl.id, rl.receipt_id, rl.product_id, p.name AS product_name, p.sku AS product_sku,
      rl.lot_number, rl.expiry_date, rl.expected_qty, rl.received_qty, rl.unit_price,
      rl.dest_location_id, l.name AS dest_location_name, l.code AS dest_location_code
     FROM receipt_lines rl
     JOIN products p ON rl.product_id = p.id
     JOIN locations l ON rl.dest_location_id = l.id
     WHERE rl.receipt_id = $1
     ORDER BY rl.id ASC`,
    [rId]
  );

  const movesRes = await query(
    `SELECT sm.id, sm.reference, sm.quantity, sm.unit_cost, sm.state, sm.done_at
     FROM stock_moves sm
     WHERE sm.origin_document = $1
     ORDER BY sm.id ASC`,
    [`receipt:${headRes.rows[0].reference}`]
  );

  return {
    ...headRes.rows[0],
    lines: linesRes.rows,
    moves: movesRes.rows
  };
}

module.exports = {
  createReceipt,
  listReceipts,
  getReceiptById
};
