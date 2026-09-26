const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { createStockMove } = require('./stockMoveService');
const { adjustQuant } = require('./stockQuantService');
const { depleteCostLayers } = require('./costLayerService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generateDeliveryReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DEL-${dateStr}-${rand}`;
}

/**
 * Creates and processes an outbound delivery with automated FEFO lot allocation.
 *
 * @param {Object} data
 * @param {string} data.customer_name
 * @param {number} data.source_warehouse_id
 * @param {Array} data.lines - Array of { product_id, requested_qty, src_location_id }
 * @param {boolean} [data.auto_process=true]
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function createDelivery({
  customer_name,
  source_warehouse_id,
  lines = [],
  auto_process = true
}, userId, ipAddress = null) {
  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length === 0) {
    throw new AppError('Customer name is required.', 400, 'VALIDATION_ERROR');
  }

  if (!source_warehouse_id) {
    throw new AppError('source_warehouse_id is required.', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError('At least one delivery order line is required.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify Source Warehouse exists
    const whRes = await client.query('SELECT id, code, name FROM warehouses WHERE id = $1', [source_warehouse_id]);
    if (whRes.rows.length === 0) {
      throw new AppError('Source warehouse not found. Invalid reference.', 400, 'INVALID_FOREIGN_KEY');
    }

    const reference = generateDeliveryReference();
    const initialStatus = auto_process ? 'done' : 'draft';

    // 2. Create Delivery Header
    const deliveryInsertSql = `
      INSERT INTO deliveries (
        reference, customer_name, source_warehouse_id,
        status, scheduled_date, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), NOW())
      RETURNING id, reference, customer_name, source_warehouse_id, status, scheduled_date, created_at;
    `;
    const deliveryRes = await client.query(deliveryInsertSql, [
      reference,
      customer_name.trim(),
      source_warehouse_id,
      initialStatus,
      userId
    ]);
    const delivery = deliveryRes.rows[0];

    const processedLines = [];
    const allAllocations = [];

    // 3. Process each delivery line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pId = parseInt(line.product_id, 10);
      const locId = parseInt(line.src_location_id, 10);
      const requestedQty = parseFloat(line.requested_qty);

      if (!pId) throw new AppError(`Line ${i + 1}: product_id is required.`, 400, 'VALIDATION_ERROR');
      if (!locId) throw new AppError(`Line ${i + 1}: src_location_id is required.`, 400, 'VALIDATION_ERROR');
      if (isNaN(requestedQty) || requestedQty <= 0) {
        throw new AppError(`Line ${i + 1}: requested_qty must be greater than 0.`, 400, 'VALIDATION_ERROR');
      }

      // Verify Product
      const prodRes = await client.query(
        'SELECT id, name, sku, uom_id, tracking_type, cost_price FROM products WHERE id = $1 FOR UPDATE',
        [pId]
      );
      if (prodRes.rows.length === 0) {
        throw new AppError(`Line ${i + 1}: Product ID ${pId} not found.`, 400, 'INVALID_FOREIGN_KEY');
      }
      const product = prodRes.rows[0];

      // Verify Location belongs to this warehouse
      const locRes = await client.query(
        'SELECT id, warehouse_id, code, name FROM locations WHERE id = $1',
        [locId]
      );
      if (locRes.rows.length === 0) {
        throw new AppError(`Line ${i + 1}: Location ID ${locId} not found.`, 400, 'INVALID_FOREIGN_KEY');
      }
      if (locRes.rows[0].warehouse_id !== parseInt(source_warehouse_id, 10)) {
        throw new AppError(
          `Line ${i + 1}: Location "${locRes.rows[0].code}" does not belong to source warehouse.`,
          400,
          'INVALID_LOCATION'
        );
      }

      // 4. FEFO Lot Allocation Query with Row-Level Locks (if auto_process)
      let candidateQuants = [];
      const lineAllocations = [];

      if (auto_process) {
        if (product.tracking_type === 'lot') {
          // Enforce FEFO: Earliest expiry date first, secondary order by lot ID
          const fefoSql = `
            SELECT 
              sq.id AS quant_id,
              sq.location_id,
              sq.lot_id,
              sq.quantity,
              sq.reserved_quantity,
              (sq.quantity - sq.reserved_quantity) AS available_quantity,
              l.lot_number,
              l.expiry_date
            FROM stock_quants sq
            JOIN lots l ON sq.lot_id = l.id
            WHERE sq.product_id = $1 
              AND sq.location_id = $2
              AND (sq.quantity - sq.reserved_quantity) > 0
            ORDER BY l.expiry_date ASC, l.id ASC
            FOR UPDATE;
          `;
          const quantRes = await client.query(fefoSql, [pId, locId]);
          candidateQuants = quantRes.rows;
        } else {
          // Standard non-lot tracked
          const nonLotSql = `
            SELECT 
              sq.id AS quant_id,
              sq.location_id,
              sq.lot_id,
              sq.quantity,
              sq.reserved_quantity,
              (sq.quantity - sq.reserved_quantity) AS available_quantity,
              NULL AS lot_number,
              NULL AS expiry_date
            FROM stock_quants sq
            WHERE sq.product_id = $1 
              AND sq.location_id = $2
              AND (sq.quantity - sq.reserved_quantity) > 0
            ORDER BY sq.id ASC
            FOR UPDATE;
          `;
          const quantRes = await client.query(nonLotSql, [pId, locId]);
          candidateQuants = quantRes.rows;
        }

        // Check total available stock across candidate quants
        const totalAvailable = candidateQuants.reduce((sum, q) => sum + parseFloat(q.available_quantity), 0);

        if (totalAvailable < requestedQty) {
          throw new AppError(
            `Insufficient stock for product "${product.name}" (SKU: ${product.sku}). Requested: ${requestedQty}, Available at location: ${totalAvailable}.`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }

        // 5. Greedily Consume Stock According to FEFO Sort Order
        let remainingToConsume = requestedQty;

        for (const quant of candidateQuants) {
          if (remainingToConsume <= 0) break;

          const avail = parseFloat(quant.available_quantity);
          const takeQty = Math.round(Math.min(avail, remainingToConsume) * 10000) / 10000;

          lineAllocations.push({
            productId: pId,
            productName: product.name,
            sku: product.sku,
            quantId: quant.quant_id,
            lotId: quant.lot_id,
            lotNumber: quant.lot_number || 'Non-Lot Tracked',
            expiryDate: quant.expiry_date,
            quantity: takeQty,
            locationId: locId
          });

          remainingToConsume = Math.round((remainingToConsume - takeQty) * 10000) / 10000;
        }

        if (remainingToConsume > 0) {
          throw new AppError(
            `Failed to fully allocate inventory for "${product.name}". Remaining unallocated: ${remainingToConsume}.`,
            400,
            'ALLOCATION_FAILURE'
          );
        }
      }

      // 6. Record Delivery Line
      const lineInsertSql = `
        INSERT INTO delivery_lines (
          delivery_id, product_id, requested_qty, reserved_qty, done_qty, src_location_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, delivery_id, product_id, requested_qty, reserved_qty, done_qty, src_location_id;
      `;
      const dlRes = await client.query(lineInsertSql, [
        delivery.id,
        pId,
        requestedQty,
        0,
        auto_process ? requestedQty : 0,
        locId
      ]);
      processedLines.push(dlRes.rows[0]);

      // 7. Execute Inventory Deduction & Stock Moves if auto_process
      if (auto_process) {
        for (const alloc of lineAllocations) {
          // A. Deduct stock quant
          await adjustQuant(client, {
            productId: alloc.productId,
            locationId: alloc.locationId,
            lotId: alloc.lotId,
            deltaQuantity: -alloc.quantity
          });

          // B. Create immutable stock move
          await createStockMove(client, {
            productId: alloc.productId,
            lotId: alloc.lotId,
            srcLocationId: alloc.locationId,
            destLocationId: null, // Outbound customer delivery
            quantity: alloc.quantity,
            uomId: product.uom_id,
            unitCost: parseFloat(product.cost_price || 0),
            state: 'done',
            moveType: 'delivery',
            originDocument: delivery.reference,
            performedBy: userId
          });

          // C. Deplete Cost Layers
          await depleteCostLayers(client, {
            productId: alloc.productId,
            quantity: alloc.quantity
          });
        }
      }

      allAllocations.push(...lineAllocations);
    }

    // 8. Audit Log
    await logAudit({
      userId,
      action: auto_process ? 'VALIDATE' : 'CREATE',
      entityType: 'deliveries',
      entityId: delivery.id,
      newValues: {
        reference: delivery.reference,
        customer: customer_name,
        allocationsCount: allAllocations.length,
        allocations: allAllocations.map(a => ({
          sku: a.sku,
          lot: a.lotNumber,
          qty: a.quantity,
          expiry: a.expiryDate
        }))
      },
      ipAddress,
      client
    });

    // 9. Atomically Commit
    await client.query('COMMIT');

    return {
      ...delivery,
      lines: processedLines,
      allocations: allAllocations
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List deliveries with warehouse and items summary.
 */
async function listDeliveries({ status = null } = {}) {
  let sql = `
    SELECT 
      d.id,
      d.reference,
      d.customer_name,
      d.source_warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      d.status,
      d.scheduled_date,
      d.created_by,
      u.full_name AS created_by_name,
      d.created_at,
      COUNT(dl.id)::int AS line_count,
      COALESCE(SUM(dl.requested_qty), 0) AS total_requested_qty,
      COALESCE(SUM(dl.done_qty), 0) AS total_done_qty
    FROM deliveries d
    JOIN warehouses w ON d.source_warehouse_id = w.id
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN delivery_lines dl ON d.id = dl.delivery_id
  `;

  const params = [];
  if (status) {
    sql += ` WHERE d.status = $1`;
    params.push(status);
  }

  sql += `
    GROUP BY d.id, d.reference, d.customer_name, d.source_warehouse_id, w.name, w.code, d.status, d.scheduled_date, d.created_by, u.full_name, d.created_at
    ORDER BY d.created_at DESC, d.id DESC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get detailed delivery by ID with lines and associated FEFO stock movements.
 */
async function getDeliveryById(deliveryId) {
  const dId = parseInt(deliveryId, 10);
  const headRes = await query(
    `SELECT 
      d.id, d.reference, d.customer_name, d.source_warehouse_id,
      w.name AS warehouse_name, w.code AS warehouse_code,
      d.status, d.scheduled_date, d.created_by, u.full_name AS created_by_name,
      d.created_at
     FROM deliveries d
     JOIN warehouses w ON d.source_warehouse_id = w.id
     LEFT JOIN users u ON d.created_by = u.id
     WHERE d.id = $1`,
    [dId]
  );

  if (headRes.rows.length === 0) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  const linesRes = await query(
    `SELECT 
      dl.id, dl.delivery_id, dl.product_id, p.name AS product_name, p.sku AS product_sku,
      dl.requested_qty, dl.reserved_qty, dl.done_qty,
      dl.src_location_id, l.name AS src_location_name, l.code AS src_location_code
     FROM delivery_lines dl
     JOIN products p ON dl.product_id = p.id
     JOIN locations l ON dl.src_location_id = l.id
     WHERE dl.delivery_id = $1
     ORDER BY dl.id ASC`,
    [dId]
  );

  // Retrieve exact FEFO allocated stock movements
  const movesRes = await query(
    `SELECT 
      sm.id, sm.reference, sm.product_id, p.name AS product_name, p.sku AS product_sku,
      sm.lot_id, lots.lot_number, lots.expiry_date,
      sm.quantity, sm.unit_cost, sm.state, sm.done_at
     FROM stock_moves sm
     JOIN products p ON sm.product_id = p.id
     LEFT JOIN lots ON sm.lot_id = lots.id
     WHERE sm.origin_document = $1
     ORDER BY sm.id ASC`,
    [`delivery:${headRes.rows[0].reference}`]
  );

  return {
    ...headRes.rows[0],
    lines: linesRes.rows,
    moves: movesRes.rows
  };
}

/**
 * Process a pending/draft delivery order using authoritative FEFO allocation.
 * Can be called standalone or within an existing database transaction client.
 */
async function processDelivery(deliveryId, userId, ipAddress = null, externalClient = null) {
  const dId = parseInt(deliveryId, 10);
  const client = externalClient || (await pool.connect());
  const manageTx = !externalClient;

  try {
    if (manageTx) await client.query('BEGIN');

    // 1. Lock delivery
    const dRes = await client.query(
      'SELECT id, reference, customer_name, source_warehouse_id, status FROM deliveries WHERE id = $1 FOR UPDATE',
      [dId]
    );
    if (dRes.rows.length === 0) {
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    }
    const delivery = dRes.rows[0];

    if (delivery.status === 'done') {
      if (manageTx) await client.query('COMMIT');
      return delivery;
    }
    if (delivery.status === 'cancelled') {
      throw new AppError('Cannot process a cancelled delivery order.', 400, 'INVALID_STATE');
    }

    // 2. Fetch lines
    const linesRes = await client.query(
      'SELECT id, product_id, requested_qty, src_location_id FROM delivery_lines WHERE delivery_id = $1 ORDER BY id ASC',
      [dId]
    );
    if (linesRes.rows.length === 0) {
      throw new AppError('Delivery has no order lines.', 400, 'VALIDATION_ERROR');
    }

    const allAllocations = [];

    // 3. For each line, perform authoritative FEFO allocation
    for (const line of linesRes.rows) {
      const pId = parseInt(line.product_id, 10);
      const locId = parseInt(line.src_location_id, 10);
      const requestedQty = parseFloat(line.requested_qty);

      const prodRes = await client.query(
        'SELECT id, name, sku, uom_id, tracking_type, cost_price FROM products WHERE id = $1 FOR UPDATE',
        [pId]
      );
      if (prodRes.rows.length === 0) {
        throw new AppError(`Product ID ${pId} not found.`, 404, 'NOT_FOUND');
      }
      const product = prodRes.rows[0];

      let candidateQuants = [];
      if (product.tracking_type === 'lot') {
        const fefoSql = `
          SELECT 
            sq.id AS quant_id,
            sq.location_id,
            sq.lot_id,
            sq.quantity,
            sq.reserved_quantity,
            (sq.quantity - sq.reserved_quantity) AS available_quantity,
            l.lot_number,
            l.expiry_date
          FROM stock_quants sq
          JOIN lots l ON sq.lot_id = l.id
          WHERE sq.product_id = $1 
            AND sq.location_id = $2
            AND (sq.quantity - sq.reserved_quantity) > 0
          ORDER BY l.expiry_date ASC, l.id ASC
          FOR UPDATE;
        `;
        const qRes = await client.query(fefoSql, [pId, locId]);
        candidateQuants = qRes.rows;
      } else {
        const nonLotSql = `
          SELECT 
            sq.id AS quant_id,
            sq.location_id,
            sq.lot_id,
            sq.quantity,
            sq.reserved_quantity,
            (sq.quantity - sq.reserved_quantity) AS available_quantity,
            NULL AS lot_number,
            NULL AS expiry_date
          FROM stock_quants sq
          WHERE sq.product_id = $1 
            AND sq.location_id = $2
            AND (sq.quantity - sq.reserved_quantity) > 0
          ORDER BY sq.id ASC
          FOR UPDATE;
        `;
        const qRes = await client.query(nonLotSql, [pId, locId]);
        candidateQuants = qRes.rows;
      }

      const totalAvailable = candidateQuants.reduce((sum, q) => sum + parseFloat(q.available_quantity), 0);
      if (totalAvailable < requestedQty) {
        throw new AppError(
          `Insufficient stock for product "${product.name}" (SKU: ${product.sku}). Requested: ${requestedQty}, Available at location: ${totalAvailable}.`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }

      let remainingToConsume = requestedQty;
      for (const quant of candidateQuants) {
        if (remainingToConsume <= 0) break;
        const avail = parseFloat(quant.available_quantity);
        const takeQty = Math.round(Math.min(avail, remainingToConsume) * 10000) / 10000;

        // Deduct stock quant
        await adjustQuant(client, {
          productId: pId,
          locationId: locId,
          lotId: quant.lot_id,
          deltaQuantity: -takeQty
        });

        // Create immutable stock move
        await createStockMove(client, {
          productId: pId,
          lotId: quant.lot_id,
          srcLocationId: locId,
          destLocationId: null,
          quantity: takeQty,
          uomId: product.uom_id,
          unitCost: parseFloat(product.cost_price || 0),
          state: 'done',
          moveType: 'delivery',
          originDocument: delivery.reference,
          performedBy: userId
        });

        // Deplete cost layers
        await depleteCostLayers(client, {
          productId: pId,
          quantity: takeQty
        });

        allAllocations.push({
          productId: pId,
          productName: product.name,
          sku: product.sku,
          quantId: quant.quant_id,
          lotId: quant.lot_id,
          lotNumber: quant.lot_number || 'Non-Lot Tracked',
          expiryDate: quant.expiry_date,
          quantity: takeQty,
          locationId: locId
        });

        remainingToConsume = Math.round((remainingToConsume - takeQty) * 10000) / 10000;
      }

      // Update line done_qty
      await client.query(
        'UPDATE delivery_lines SET done_qty = requested_qty WHERE id = $1',
        [line.id]
      );
    }

    // 4. Update delivery status to done
    await client.query(
      "UPDATE deliveries SET status = 'done', updated_at = NOW() WHERE id = $1",
      [dId]
    );

    // 5. Audit Log
    await logAudit({
      userId,
      action: 'VALIDATE',
      entityType: 'deliveries',
      entityId: delivery.id,
      newValues: {
        reference: delivery.reference,
        customer: delivery.customer_name,
        allocationsCount: allAllocations.length,
        allocations: allAllocations.map(a => ({
          sku: a.sku,
          lot: a.lotNumber,
          qty: a.quantity,
          expiry: a.expiryDate
        }))
      },
      ipAddress,
      client
    });

    if (manageTx) await client.query('COMMIT');

    return {
      ...delivery,
      status: 'done',
      allocations: allAllocations
    };
  } catch (err) {
    if (manageTx) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (manageTx) client.release();
  }
}

module.exports = {
  createDelivery,
  listDeliveries,
  getDeliveryById,
  processDelivery
};
