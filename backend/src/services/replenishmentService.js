const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');
const { createTransfer } = require('./transferService');
const crypto = require('crypto');

function generateTaskNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REP-${dateStr}-${rand}`;
}

/**
 * Configure forward bin threshold for a product.
 */
async function setReplenishmentConfig({ warehouse_id, location_id, product_id, min_qty, max_qty }, userId) {
  const whId = parseInt(warehouse_id, 10);
  const locId = parseInt(location_id, 10);
  const pId = parseInt(product_id, 10);
  const minVal = parseFloat(min_qty);
  const maxVal = parseFloat(max_qty);

  if (!whId || !locId || !pId) {
    throw new AppError('warehouse_id, location_id, and product_id are required.', 400, 'VALIDATION_ERROR');
  }
  if (isNaN(minVal) || minVal < 0) {
    throw new AppError('min_qty (threshold) must be a non-negative number.', 400, 'VALIDATION_ERROR');
  }
  if (isNaN(maxVal) || maxVal <= minVal) {
    throw new AppError('max_qty (target) must be greater than min_qty.', 400, 'VALIDATION_ERROR');
  }

  // Update location_role to forward_pick if not already set
  await query("UPDATE locations SET location_role = 'forward_pick' WHERE id = $1", [locId]);

  const sql = `
    INSERT INTO replenishment_configs (warehouse_id, location_id, product_id, min_qty, max_qty, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (location_id, product_id)
    DO UPDATE SET min_qty = EXCLUDED.min_qty, max_qty = EXCLUDED.max_qty, updated_at = NOW()
    RETURNING id, warehouse_id, location_id, product_id, min_qty, max_qty;
  `;
  const res = await query(sql, [whId, locId, pId, minVal, maxVal]);
  return res.rows[0];
}

/**
 * List replenishment configurations.
 */
async function listReplenishmentConfigs({ warehouse_id = null } = {}) {
  let sql = `
    SELECT 
      rc.id, rc.warehouse_id, w.name AS warehouse_name,
      rc.location_id, loc.code AS location_code, loc.name AS location_name, loc.location_role,
      rc.product_id, p.name AS product_name, p.sku AS product_sku,
      rc.min_qty, rc.max_qty, rc.updated_at
    FROM replenishment_configs rc
    JOIN warehouses w ON rc.warehouse_id = w.id
    JOIN locations loc ON rc.location_id = loc.id
    JOIN products p ON rc.product_id = p.id
  `;
  const params = [];
  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    sql += ' WHERE rc.warehouse_id = $1';
  }
  sql += ' ORDER BY loc.code ASC, p.name ASC';
  const res = await query(sql, params);
  return res.rows;
}

/**
 * Scan forward pick bins, check thresholds, select reserve sources, and generate replenishment tasks.
 */
async function generateReplenishmentTasks({ warehouse_id = null } = {}, userId, ipAddress = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Query active replenishment configs
    let configSql = `
      SELECT 
        rc.id, rc.warehouse_id, rc.location_id, rc.product_id,
        rc.min_qty, rc.max_qty,
        loc.code AS loc_code, loc.name AS loc_name,
        p.name AS product_name, p.sku AS product_sku, p.tracking_type
      FROM replenishment_configs rc
      JOIN locations loc ON rc.location_id = loc.id
      JOIN products p ON rc.product_id = p.id
    `;
    const params = [];
    if (warehouse_id) {
      params.push(parseInt(warehouse_id, 10));
      configSql += ' WHERE rc.warehouse_id = $1';
    }

    const configsRes = await client.query(configSql, params);
    const generatedTasks = [];

    for (const conf of configsRes.rows) {
      // Check current on-hand forward quantity
      const fwdRes = await client.query(
        'SELECT COALESCE(SUM(quantity), 0) AS qty FROM stock_quants WHERE location_id = $1 AND product_id = $2',
        [conf.location_id, conf.product_id]
      );
      const currentForwardQty = parseFloat(fwdRes.rows[0].qty);
      const threshold = parseFloat(conf.min_qty);
      const target = parseFloat(conf.max_qty);

      if (currentForwardQty < threshold) {
        const suggestedQty = Math.round((target - currentForwardQty) * 10000) / 10000;

        // Query available reserve stock in the same warehouse
        const reserveSql = `
          SELECT 
            sq.location_id,
            loc.code AS location_code,
            loc.name AS location_name,
            loc.location_role,
            COALESCE(SUM(sq.quantity - sq.reserved_quantity), 0) AS available_qty
          FROM stock_quants sq
          JOIN locations loc ON sq.location_id = loc.id
          WHERE loc.warehouse_id = $1
            AND sq.product_id = $2
            AND sq.location_id != $3
            AND (sq.quantity - sq.reserved_quantity) > 0
          GROUP BY sq.location_id, loc.code, loc.name, loc.location_role
          ORDER BY 
            CASE WHEN loc.location_role = 'reserve' THEN 1 ELSE 2 END,
            available_qty DESC
        `;
        const resRes = await client.query(reserveSql, [conf.warehouse_id, conf.product_id, conf.location_id]);

        let totalAvailableReserve = 0;
        let bestSourceLocationId = null;

        if (resRes.rows.length > 0) {
          totalAvailableReserve = resRes.rows.reduce((sum, r) => sum + parseFloat(r.available_qty), 0);
          bestSourceLocationId = resRes.rows[0].location_id;
        }

        // Determine status
        let taskStatus = 'suggested';
        if (totalAvailableReserve >= suggestedQty) {
          taskStatus = 'ready';
        } else if (totalAvailableReserve > 0) {
          taskStatus = 'partially_fulfillable';
        } else {
          taskStatus = 'partially_fulfillable'; // unfulfillable reserve
        }

        // Check if an unexecuted active task already exists for this destination & product
        const existingTaskRes = await client.query(
          `SELECT id FROM replenishment_tasks 
           WHERE destination_location_id = $1 AND product_id = $2 AND status IN ('suggested', 'ready', 'partially_fulfillable')
           FOR UPDATE`,
          [conf.location_id, conf.product_id]
        );

        if (existingTaskRes.rows.length > 0) {
          // Update existing task
          const taskId = existingTaskRes.rows[0].id;
          await client.query(
            `UPDATE replenishment_tasks
             SET current_forward_qty = $1,
                 threshold_qty = $2,
                 target_qty = $3,
                 suggested_qty = $4,
                 available_reserve_qty = $5,
                 source_location_id = $6,
                 status = $7,
                 updated_at = NOW()
             WHERE id = $8`,
            [
              currentForwardQty,
              threshold,
              target,
              suggestedQty,
              totalAvailableReserve,
              bestSourceLocationId,
              taskStatus,
              taskId
            ]
          );
          generatedTasks.push({ id: taskId, destination: conf.loc_code, product: conf.product_name, suggestedQty });
        } else {
          // Insert new task
          const taskNum = generateTaskNumber();
          const insertRes = await client.query(
            `INSERT INTO replenishment_tasks (
              task_number, warehouse_id, product_id, destination_location_id,
              source_location_id, current_forward_qty, threshold_qty, target_qty,
              suggested_qty, available_reserve_qty, status, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            RETURNING id;`,
            [
              taskNum,
              conf.warehouse_id,
              conf.product_id,
              conf.location_id,
              bestSourceLocationId,
              currentForwardQty,
              threshold,
              target,
              suggestedQty,
              totalAvailableReserve,
              taskStatus,
              userId
            ]
          );
          generatedTasks.push({ id: insertRes.rows[0].id, destination: conf.loc_code, product: conf.product_name, suggestedQty });
        }
      }
    }

    // Log audit
    await logAudit({
      userId,
      action: 'REPLENISHMENT_GENERATE',
      entityType: 'replenishment_tasks',
      entityId: null,
      newValues: { generated_count: generatedTasks.length },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return {
      success: true,
      message: `Generated/updated ${generatedTasks.length} replenishment requirement(s).`,
      count: generatedTasks.length,
      tasks: generatedTasks
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List replenishment tasks with location and product names.
 */
async function listReplenishmentTasks({ warehouse_id = null, status = null } = {}) {
  let sql = `
    SELECT 
      rt.id,
      rt.task_number,
      rt.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      rt.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.tracking_type,
      uom.name AS uom_name,
      rt.destination_location_id,
      dloc.code AS destination_location_code,
      dloc.name AS destination_location_name,
      dloc.barcode AS destination_location_barcode,
      rt.source_location_id,
      sloc.code AS source_location_code,
      sloc.name AS source_location_name,
      sloc.barcode AS source_location_barcode,
      rt.current_forward_qty,
      rt.threshold_qty,
      rt.target_qty,
      rt.suggested_qty,
      rt.available_reserve_qty,
      rt.status,
      rt.transfer_id,
      tr.reference AS transfer_reference,
      rt.created_at,
      rt.executed_at,
      rt.notes
    FROM replenishment_tasks rt
    JOIN warehouses w ON rt.warehouse_id = w.id
    JOIN products p ON rt.product_id = p.id
    JOIN uom ON p.uom_id = uom.id
    JOIN locations dloc ON rt.destination_location_id = dloc.id
    LEFT JOIN locations sloc ON rt.source_location_id = sloc.id
    LEFT JOIN transfers tr ON rt.transfer_id = tr.id
  `;

  const where = [];
  const params = [];

  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    where.push(`rt.warehouse_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`rt.status = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY CASE rt.status WHEN \'ready\' THEN 1 WHEN \'partially_fulfillable\' THEN 2 WHEN \'suggested\' THEN 3 ELSE 4 END, rt.created_at DESC';

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get replenishment task by ID.
 */
async function getReplenishmentTaskById(taskId) {
  const tId = parseInt(taskId, 10);
  const sql = `
    SELECT 
      rt.id,
      rt.task_number,
      rt.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      rt.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.tracking_type,
      uom.name AS uom_name,
      rt.destination_location_id,
      dloc.code AS destination_location_code,
      dloc.name AS destination_location_name,
      dloc.barcode AS destination_location_barcode,
      rt.source_location_id,
      sloc.code AS source_location_code,
      sloc.name AS source_location_name,
      sloc.barcode AS source_location_barcode,
      rt.current_forward_qty,
      rt.threshold_qty,
      rt.target_qty,
      rt.suggested_qty,
      rt.available_reserve_qty,
      rt.status,
      rt.transfer_id,
      rt.created_at,
      rt.executed_at,
      rt.notes
    FROM replenishment_tasks rt
    JOIN warehouses w ON rt.warehouse_id = w.id
    JOIN products p ON rt.product_id = p.id
    JOIN uom ON p.uom_id = uom.id
    JOIN locations dloc ON rt.destination_location_id = dloc.id
    LEFT JOIN locations sloc ON rt.source_location_id = sloc.id
    WHERE rt.id = $1
  `;
  const res = await query(sql, [tId]);
  if (res.rows.length === 0) throw new AppError('Replenishment task not found.', 404, 'NOT_FOUND');
  return res.rows[0];
}

/**
 * Execute replenishment task via existing Phase 3 transfer engine.
 */
async function executeReplenishment(taskId, { source_location_id = null, lot_id = null, quantity = null } = {}, userId, ipAddress = null) {
  const tId = parseInt(taskId, 10);
  const task = await getReplenishmentTaskById(tId);

  if (task.status === 'executed') {
    throw new AppError('Replenishment task has already been executed.', 400, 'ALREADY_EXECUTED');
  }
  if (task.status === 'dismissed') {
    throw new AppError('Cannot execute a dismissed replenishment task.', 400, 'TASK_DISMISSED');
  }

  const srcLocId = parseInt(source_location_id || task.source_location_id, 10);
  if (!srcLocId) {
    throw new AppError('A valid source reserve location is required to execute replenishment.', 400, 'SOURCE_LOCATION_REQUIRED');
  }

  const destLocId = parseInt(task.destination_location_id, 10);
  const qtyToTransfer = quantity ? parseFloat(quantity) : parseFloat(task.suggested_qty);

  if (isNaN(qtyToTransfer) || qtyToTransfer <= 0) {
    throw new AppError('Quantity must be greater than zero.', 400, 'VALIDATION_ERROR');
  }

  // If product is lot-tracked and no lot_id was specified, pick the earliest expiring lot at source
  let effectiveLotId = lot_id ? parseInt(lot_id, 10) : null;
  if (task.tracking_type === 'lot' && !effectiveLotId) {
    const lotRes = await query(
      `SELECT sq.lot_id, l.lot_number, l.expiry_date, (sq.quantity - sq.reserved_quantity) AS avail
       FROM stock_quants sq
       JOIN lots l ON sq.lot_id = l.id
       WHERE sq.location_id = $1 AND sq.product_id = $2 AND (sq.quantity - sq.reserved_quantity) > 0
       ORDER BY l.expiry_date ASC, sq.quantity DESC
       LIMIT 1`,
      [srcLocId, task.product_id]
    );
    if (lotRes.rows.length > 0) {
      effectiveLotId = lotRes.rows[0].lot_id;
    }
  }

  // Execute transfer using existing transactional transferService
  const transfer = await createTransfer(
    {
      product_id: task.product_id,
      src_location_id: srcLocId,
      dest_location_id: destLocId,
      lot_id: effectiveLotId,
      quantity: qtyToTransfer,
      notes: `Bin Replenishment from task ${task.task_number}`
    },
    userId,
    ipAddress
  );

  // Mark task executed
  await query(
    `UPDATE replenishment_tasks
     SET status = 'executed', transfer_id = $1, executed_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [transfer.id, tId]
  );

  // Log audit
  await logAudit({
    userId,
    action: 'REPLENISHMENT_EXECUTE',
    entityType: 'replenishment_tasks',
    entityId: tId,
    newValues: {
      task_number: task.task_number,
      transfer_id: transfer.id,
      transfer_reference: transfer.reference,
      transferred_qty: qtyToTransfer
    },
    ipAddress
  });

  return {
    success: true,
    message: `Replenishment task ${task.task_number} executed successfully.`,
    task_id: tId,
    transfer_reference: transfer.reference,
    transfer
  };
}

/**
 * Dismiss replenishment task.
 */
async function dismissReplenishment(taskId, userId, ipAddress = null) {
  const tId = parseInt(taskId, 10);
  const task = await getReplenishmentTaskById(tId);

  if (task.status === 'executed') {
    throw new AppError('Cannot dismiss an already executed task.', 400, 'INVALID_STATE');
  }

  await query(
    `UPDATE replenishment_tasks
     SET status = 'dismissed', dismissed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [tId]
  );

  await logAudit({
    userId,
    action: 'REPLENISHMENT_DISMISS',
    entityType: 'replenishment_tasks',
    entityId: tId,
    newValues: { task_number: task.task_number, status: 'dismissed' },
    ipAddress
  });

  return {
    success: true,
    message: `Replenishment task ${task.task_number} dismissed.`,
    task_id: tId
  };
}

module.exports = {
  setReplenishmentConfig,
  listReplenishmentConfigs,
  generateReplenishmentTasks,
  listReplenishmentTasks,
  getReplenishmentTaskById,
  executeReplenishment,
  dismissReplenishment
};
