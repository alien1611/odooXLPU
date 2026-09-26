const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { createReceipt } = require('./receiptService');
const { logAudit } = require('./auditService');

/**
 * Calculates historical 30-day consumption and reorder risk for products.
 * Uses immutable stock_moves outbound ledger (delivery, scrap, adjustment_out).
 * Excludes receipts, internal transfers, and positive adjustments.
 *
 * @param {Object} options
 * @param {number|null} [options.warehouseId]
 * @param {number|null} [options.productId]
 * @param {number} [options.lookbackDays=30]
 */
async function calculateConsumptionAndReorder({ warehouseId = null, productId = null, lookbackDays = 30 } = {}) {
  const pId = productId ? parseInt(productId, 10) : null;
  const whId = warehouseId ? parseInt(warehouseId, 10) : null;

  // 1. Fetch products to evaluate
  let prodSql = `
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.tracking_type,
      p.cost_price,
      p.sale_price,
      p.min_stock_level,
      p.max_stock_level,
      p.reorder_point,
      p.lead_time_days,
      p.uom_id,
      u.name AS uom_name,
      u.code AS uom_code
    FROM products p
    JOIN uom u ON p.uom_id = u.id
    WHERE p.is_active = TRUE
  `;
  const prodParams = [];
  if (pId) {
    prodParams.push(pId);
    prodSql += ` AND p.id = $${prodParams.length}`;
  }
  prodSql += ` ORDER BY p.name ASC`;
  const { rows: products } = await query(prodSql, prodParams);

  if (products.length === 0) {
    return [];
  }

  // 2. Fetch warehouses to evaluate
  let whSql = `SELECT id, code, name FROM warehouses WHERE is_active = TRUE`;
  const whParams = [];
  if (whId) {
    whParams.push(whId);
    whSql += ` AND id = $${whParams.length}`;
  }
  whSql += ` ORDER BY id ASC`;
  const { rows: warehouses } = await query(whSql, whParams);

  if (warehouses.length === 0) {
    return [];
  }

  // 3. Query 30-day outbound consumption from stock_moves
  // Outbound movement types: delivery, scrap, adjustment_out (done state only)
  let moveSql = `
    SELECT 
      sm.product_id,
      loc.warehouse_id,
      COALESCE(SUM(sm.quantity), 0) AS total_consumed
    FROM stock_moves sm
    LEFT JOIN locations loc ON sm.src_location_id = loc.id
    WHERE sm.state = 'done'
      AND sm.move_type IN ('delivery', 'scrap', 'adjustment_out')
      AND sm.created_at >= NOW() - ($1 || ' days')::INTERVAL
  `;
  const moveParams = [lookbackDays];

  if (whId) {
    moveParams.push(whId);
    moveSql += ` AND loc.warehouse_id = $${moveParams.length}`;
  }
  if (pId) {
    moveParams.push(pId);
    moveSql += ` AND sm.product_id = $${moveParams.length}`;
  }
  moveSql += ` GROUP BY sm.product_id, loc.warehouse_id`;
  const { rows: moveRows } = await query(moveSql, moveParams);

  const consumptionMap = new Map();
  for (const m of moveRows) {
    const key = `${m.product_id}-${m.warehouse_id || 'all'}`;
    consumptionMap.set(key, parseFloat(m.total_consumed || 0));
  }

  // 4. Query current stock quantities from stock_quants in internal locations
  let quantSql = `
    SELECT 
      sq.product_id,
      loc.warehouse_id,
      COALESCE(SUM(sq.quantity), 0) AS current_stock
    FROM stock_quants sq
    JOIN locations loc ON sq.location_id = loc.id
    WHERE loc.type = 'internal'
  `;
  const quantParams = [];
  if (whId) {
    quantParams.push(whId);
    quantSql += ` AND loc.warehouse_id = $${quantParams.length}`;
  }
  if (pId) {
    quantParams.push(pId);
    quantSql += ` AND sq.product_id = $${quantParams.length}`;
  }
  quantSql += ` GROUP BY sq.product_id, loc.warehouse_id`;
  const { rows: quantRows } = await query(quantSql, quantParams);

  const stockMap = new Map();
  for (const q of quantRows) {
    const key = `${q.product_id}-${q.warehouse_id}`;
    stockMap.set(key, parseFloat(q.current_stock || 0));
  }

  // 5. Evaluate Reorder Logic per Product & Warehouse
  const results = [];

  for (const wh of warehouses) {
    for (const prod of products) {
      const stockKey = `${prod.id}-${wh.id}`;
      const moveKey = `${prod.id}-${wh.id}`;

      const currentStock = stockMap.get(stockKey) || 0;
      const consumedQty = consumptionMap.get(moveKey) || 0;

      // Formula: average_daily_consumption = total_consumed / lookbackDays
      const avgDailyConsumption = consumedQty > 0 ? (consumedQty / lookbackDays) : 0;
      const leadTimeDays = parseInt(prod.lead_time_days || 0, 10);
      const reorderPoint = parseFloat(prod.reorder_point || prod.min_stock_level || 0);
      const minStockLevel = parseFloat(prod.min_stock_level || 0);

      let daysRemaining = null;
      let isAtRisk = false;
      let reason = '';
      let suggestedQty = 0;

      if (avgDailyConsumption === 0) {
        // Safe against zero consumption: do NOT divide by zero or flag false urgent reorder
        daysRemaining = null;

        // Static safety check if stock is at or below designated minimum / reorder point
        if (reorderPoint > 0 && currentStock <= reorderPoint) {
          isAtRisk = true;
          suggestedQty = Math.max(reorderPoint - currentStock, 0);
          reason = `Current stock (${currentStock}) is at or below reorder threshold (${reorderPoint}). No outbound consumption recorded in last ${lookbackDays} days.`;
        } else if (minStockLevel > 0 && currentStock <= minStockLevel) {
          isAtRisk = true;
          suggestedQty = Math.max(minStockLevel - currentStock, 0);
          reason = `Current stock (${currentStock}) is at or below minimum safety stock (${minStockLevel}). No outbound consumption recorded in last ${lookbackDays} days.`;
        } else {
          reason = 'No recent consumption. Stock is within acceptable parameters.';
        }
      } else {
        // Active consumption calculation
        daysRemaining = currentStock / avgDailyConsumption;

        // Reorder trigger: projected stock-out is sooner than supplier lead time OR below threshold
        const triggersOnLeadTime = leadTimeDays > 0 && daysRemaining < leadTimeDays;
        const triggersOnReorderPoint = reorderPoint > 0 && currentStock <= reorderPoint;
        const triggersOnMinStock = minStockLevel > 0 && currentStock <= minStockLevel;

        if (triggersOnLeadTime || triggersOnReorderPoint || triggersOnMinStock) {
          isAtRisk = true;

          // Primary suggested qty: (lead_time_days * avg_daily_consumption) - current_quantity
          let calcSuggested = (leadTimeDays * avgDailyConsumption) - currentStock;

          // Ensure it also brings stock up to reorder point / min safety level
          if (reorderPoint > 0) {
            calcSuggested = Math.max(calcSuggested, reorderPoint - currentStock);
          }
          if (minStockLevel > 0) {
            calcSuggested = Math.max(calcSuggested, minStockLevel - currentStock);
          }

          suggestedQty = Math.max(calcSuggested, 0);

          if (triggersOnLeadTime) {
            reason = `Days remaining (${daysRemaining.toFixed(1)}d) is less than lead time (${leadTimeDays}d). Avg consumption: ${avgDailyConsumption.toFixed(2)}/day.`;
          } else if (triggersOnReorderPoint) {
            reason = `Current stock (${currentStock}) reached reorder threshold (${reorderPoint}). Days remaining: ${daysRemaining.toFixed(1)}d.`;
          } else {
            reason = `Current stock (${currentStock}) below minimum stock level (${minStockLevel}). Days remaining: ${daysRemaining.toFixed(1)}d.`;
          }
        } else {
          reason = `Sufficient stock for ${daysRemaining.toFixed(1)} days (lead time: ${leadTimeDays}d).`;
        }
      }

      // Round suggested quantity to 2 decimal places
      suggestedQty = Math.round(suggestedQty * 100) / 100;

      results.push({
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        tracking_type: prod.tracking_type,
        cost_price: parseFloat(prod.cost_price || 0),
        warehouse_id: wh.id,
        warehouse_code: wh.code,
        warehouse_name: wh.name,
        current_stock: currentStock,
        min_stock: minStockLevel,
        reorder_point: reorderPoint,
        lead_time_days: leadTimeDays,
        total_consumed_30d: Math.round(consumedQty * 100) / 100,
        avg_daily_consumption: Math.round(avgDailyConsumption * 10000) / 10000,
        days_remaining: daysRemaining !== null ? Math.round(daysRemaining * 10) / 10 : null,
        is_at_risk: isAtRisk,
        suggested_qty: suggestedQty,
        reason
      });
    }
  }

  return results;
}

/**
 * Generates automated replenishment suggestions based on consumption ledger and saves to reorder_suggestions.
 */
async function generateReorderSuggestions({ warehouseId = null, userId = null } = {}) {
  const analysis = await calculateConsumptionAndReorder({ warehouseId });
  const atRiskItems = analysis.filter(item => item.is_at_risk && item.suggested_qty > 0);

  const client = await pool.connect();
  const createdOrUpdated = [];

  try {
    await client.query('BEGIN');

    for (const item of atRiskItems) {
      // Check for an existing pending suggestion for this product and warehouse
      const existingRes = await client.query(
        `SELECT id FROM reorder_suggestions 
         WHERE product_id = $1 AND warehouse_id = $2 AND status = 'pending' 
         LIMIT 1`,
        [item.product_id, item.warehouse_id]
      );

      if (existingRes.rows.length > 0) {
        // Update existing pending suggestion with fresh consumption calculations
        const updateSql = `
          UPDATE reorder_suggestions 
          SET current_stock = $1,
              min_stock = $2,
              avg_daily_consumption = $3,
              suggested_qty = $4,
              reason = $5,
              days_remaining = $6,
              lead_time_days = $7,
              reorder_point = $8,
              generated_at = NOW()
          WHERE id = $9
          RETURNING *;
        `;
        const res = await client.query(updateSql, [
          item.current_stock,
          item.min_stock,
          item.avg_daily_consumption,
          item.suggested_qty,
          item.reason,
          item.days_remaining,
          item.lead_time_days,
          item.reorder_point,
          existingRes.rows[0].id
        ]);
        createdOrUpdated.push(res.rows[0]);
      } else {
        // Insert new pending suggestion
        const insertSql = `
          INSERT INTO reorder_suggestions (
            product_id, warehouse_id, current_stock, min_stock,
            avg_daily_consumption, suggested_qty, reason, status,
            days_remaining, lead_time_days, reorder_point, generated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, NOW())
          RETURNING *;
        `;
        const res = await client.query(insertSql, [
          item.product_id,
          item.warehouse_id,
          item.current_stock,
          item.min_stock,
          item.avg_daily_consumption,
          item.suggested_qty,
          item.reason,
          item.days_remaining,
          item.lead_time_days,
          item.reorder_point
        ]);
        createdOrUpdated.push(res.rows[0]);
      }
    }

    await client.query('COMMIT');
    return createdOrUpdated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List reorder suggestions with product and warehouse metadata.
 */
async function listReorderSuggestions({ status = null, warehouseId = null, productId = null } = {}) {
  let sql = `
    SELECT 
      rs.id,
      rs.product_id,
      p.name AS product_name,
      p.sku,
      p.cost_price,
      p.tracking_type,
      u.code AS uom_code,
      rs.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      rs.current_stock,
      rs.min_stock,
      rs.avg_daily_consumption,
      rs.suggested_qty,
      rs.days_remaining,
      rs.lead_time_days,
      rs.reorder_point,
      rs.reason,
      rs.status,
      rs.receipt_id,
      r.reference AS receipt_reference,
      r.status AS receipt_status,
      rs.generated_at,
      rs.reviewed_by,
      usr.full_name AS reviewed_by_name,
      rs.reviewed_at
    FROM reorder_suggestions rs
    JOIN products p ON rs.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    JOIN warehouses w ON rs.warehouse_id = w.id
    LEFT JOIN receipts r ON rs.receipt_id = r.id
    LEFT JOIN users usr ON rs.reviewed_by = usr.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    params.push(status);
    sql += ` AND rs.status = $${params.length}`;
  }
  if (warehouseId) {
    params.push(parseInt(warehouseId, 10));
    sql += ` AND rs.warehouse_id = $${params.length}`;
  }
  if (productId) {
    params.push(parseInt(productId, 10));
    sql += ` AND rs.product_id = $${params.length}`;
  }

  sql += `
    ORDER BY 
      CASE WHEN rs.status = 'pending' THEN 0 ELSE 1 END,
      rs.days_remaining ASC NULLS LAST,
      rs.generated_at DESC;
  `;

  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Get single reorder suggestion by ID.
 */
async function getReorderSuggestionById(id) {
  const sId = parseInt(id, 10);
  if (!sId) throw new AppError('Valid suggestion ID is required.', 400, 'VALIDATION_ERROR');

  const rows = await listReorderSuggestions();
  const suggestion = rows.find(r => r.id === sId);
  if (!suggestion) {
    throw new AppError('Reorder suggestion not found.', 404, 'NOT_FOUND');
  }
  return suggestion;
}

/**
 * Approves a reorder suggestion:
 * Generates an inbound DRAFT receipt (auto_process = false).
 * Does NOT generate stock moves or adjust inventory quantities.
 * Links draft receipt ID back to the reorder suggestion.
 *
 * @param {number} suggestionId
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function approveReorderSuggestion(suggestionId, userId, ipAddress = null) {
  const sId = parseInt(suggestionId, 10);
  if (!sId) throw new AppError('Valid suggestion ID is required.', 400, 'VALIDATION_ERROR');

  // 1. Fetch pending suggestion
  const { rows } = await query(
    `SELECT rs.*, p.name AS product_name, p.tracking_type, p.cost_price, w.name AS warehouse_name
     FROM reorder_suggestions rs
     JOIN products p ON rs.product_id = p.id
     JOIN warehouses w ON rs.warehouse_id = w.id
     WHERE rs.id = $1 FOR UPDATE`,
    [sId]
  );

  if (rows.length === 0) {
    throw new AppError('Reorder suggestion not found.', 404, 'NOT_FOUND');
  }

  const suggestion = rows[0];

  if (suggestion.status !== 'pending') {
    throw new AppError(
      `Cannot approve reorder suggestion in "${suggestion.status}" status. Only pending suggestions can be approved.`,
      400,
      'INVALID_STATUS'
    );
  }

  // 2. Locate internal destination receiving location for this warehouse
  const locRes = await query(
    `SELECT id, code, name FROM locations 
     WHERE warehouse_id = $1 AND type = 'internal' AND is_active = TRUE 
     ORDER BY id ASC LIMIT 1`,
    [suggestion.warehouse_id]
  );

  if (locRes.rows.length === 0) {
    throw new AppError(
      `No internal receiving location found in warehouse "${suggestion.warehouse_name}".`,
      400,
      'LOCATION_NOT_FOUND'
    );
  }
  const destLocation = locRes.rows[0];

  // 3. Create Draft Inbound Receipt (auto_process: false)
  // This explicitly prevents any stock moves, cost layers, or quant alterations
  const draftReceipt = await createReceipt({
    supplier_name: `Replenishment Order - Auto Generated`,
    destination_warehouse_id: suggestion.warehouse_id,
    auto_process: false, // DRAFT ONLY
    lines: [
      {
        product_id: suggestion.product_id,
        expected_qty: parseFloat(suggestion.suggested_qty),
        unit_price: parseFloat(suggestion.cost_price || 0),
        dest_location_id: destLocation.id,
        lot_number: suggestion.tracking_type === 'lot' ? `REPL-${Date.now().toString().slice(-6)}` : null,
        expiry_date: suggestion.tracking_type === 'lot' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null
      }
    ]
  }, userId, ipAddress);

  // 4. Update Reorder Suggestion state to 'approved' and link receipt_id
  const updateSql = `
    UPDATE reorder_suggestions 
    SET status = 'approved',
        receipt_id = $1,
        reviewed_by = $2,
        reviewed_at = NOW()
    WHERE id = $3
    RETURNING *;
  `;
  const updateRes = await query(updateSql, [draftReceipt.id, userId, sId]);
  const updatedSuggestion = updateRes.rows[0];

  // 5. Audit log
  await logAudit({
    userId,
    action: 'REORDER_APPROVE',
    entityType: 'reorder_suggestions',
    entityId: sId,
    oldValues: { status: 'pending' },
    newValues: { status: 'approved', receipt_id: draftReceipt.id, receipt_reference: draftReceipt.reference },
    ipAddress
  });

  return {
    suggestion: updatedSuggestion,
    receipt: draftReceipt
  };
}

/**
 * Dismisses a reorder suggestion.
 *
 * @param {number} suggestionId
 * @param {number} userId
 * @param {string|null} ipAddress
 */
async function dismissReorderSuggestion(suggestionId, userId, ipAddress = null) {
  const sId = parseInt(suggestionId, 10);
  if (!sId) throw new AppError('Valid suggestion ID is required.', 400, 'VALIDATION_ERROR');

  const { rows } = await query(
    `SELECT * FROM reorder_suggestions WHERE id = $1`,
    [sId]
  );

  if (rows.length === 0) {
    throw new AppError('Reorder suggestion not found.', 404, 'NOT_FOUND');
  }

  const suggestion = rows[0];

  if (suggestion.status !== 'pending') {
    throw new AppError(
      `Cannot dismiss reorder suggestion in "${suggestion.status}" status. Only pending suggestions can be dismissed.`,
      400,
      'INVALID_STATUS'
    );
  }

  const updateSql = `
    UPDATE reorder_suggestions 
    SET status = 'dismissed',
        reviewed_by = $1,
        reviewed_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;
  const updateRes = await query(updateSql, [userId, sId]);

  await logAudit({
    userId,
    action: 'REORDER_DISMISS',
    entityType: 'reorder_suggestions',
    entityId: sId,
    oldValues: { status: 'pending' },
    newValues: { status: 'dismissed' },
    ipAddress
  });

  return updateRes.rows[0];
}

module.exports = {
  calculateConsumptionAndReorder,
  generateReorderSuggestions,
  listReorderSuggestions,
  getReorderSuggestionById,
  approveReorderSuggestion,
  dismissReorderSuggestion
};
