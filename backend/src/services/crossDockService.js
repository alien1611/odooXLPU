const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generateAlertNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `XDK-${dateStr}-${rand}`;
}

/**
 * Detect cross-docking opportunities for an inbound receipt's lines.
 * Evaluates pending outbound delivery demand for the received product(s) in the same warehouse.
 * Generates actionable cross-dock alerts without performing hidden inventory mutations.
 */
async function checkCrossDockOpportunities(clientOrPool, { receiptId, lines = [], warehouseId }) {
  const rId = parseInt(receiptId, 10);
  const whId = parseInt(warehouseId, 10);
  const isTx = clientOrPool && clientOrPool.query && clientOrPool !== pool;
  const client = isTx ? clientOrPool : await pool.connect();

  try {
    const alertsGenerated = [];

    for (const line of lines) {
      const pId = parseInt(line.product_id, 10);
      const receivedQty = parseFloat(line.received_qty || line.expected_qty || 0);
      if (!pId || receivedQty <= 0) continue;

      // Check pending delivery demand in the same warehouse
      const demandSql = `
        SELECT 
          d.id AS delivery_id,
          d.reference,
          d.customer_name,
          dl.id AS line_id,
          (dl.requested_qty - dl.done_qty) AS pending_qty
        FROM deliveries d
        JOIN delivery_lines dl ON d.id = dl.delivery_id
        WHERE d.source_warehouse_id = $1
          AND dl.product_id = $2
          AND d.status NOT IN ('done', 'cancelled')
          AND (dl.requested_qty - dl.done_qty) > 0
        ORDER BY d.created_at ASC;
      `;
      const demandRes = await client.query(demandSql, [whId, pId]);

      if (demandRes.rows.length > 0) {
        const totalPendingDemand = demandRes.rows.reduce((sum, r) => sum + parseFloat(r.pending_qty), 0);
        const suggestedCrossDockQty = Math.min(receivedQty, totalPendingDemand);
        const primaryDelivery = demandRes.rows[0];

        // Check if an alert already exists for this receipt and product
        const existingAlert = await client.query(
          'SELECT id FROM cross_dock_alerts WHERE receipt_id = $1 AND product_id = $2',
          [rId, pId]
        );

        if (existingAlert.rows.length === 0) {
          const alertNum = generateAlertNumber();
          const insertSql = `
            INSERT INTO cross_dock_alerts (
              alert_number, warehouse_id, product_id, receipt_id, receipt_line_id,
              lot_id, received_qty, pending_demand_qty, suggested_cross_dock_qty,
              pending_delivery_id, status, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, NOW())
            RETURNING id, alert_number, product_id, suggested_cross_dock_qty;
          `;
          const notes = `Cross-dock match: Received ${receivedQty} units can satisfy ${suggestedCrossDockQty} units of pending demand (Order: ${primaryDelivery.reference} for ${primaryDelivery.customer_name})`;
          const insRes = await client.query(insertSql, [
            alertNum,
            whId,
            pId,
            rId,
            line.id || null,
            line.lot_id || null,
            receivedQty,
            totalPendingDemand,
            suggestedCrossDockQty,
            primaryDelivery.delivery_id,
            notes
          ]);
          alertsGenerated.push(insRes.rows[0]);
        }
      }
    }

    return alertsGenerated;
  } finally {
    if (!isTx) client.release();
  }
}

/**
 * Scan all open receipts vs pending delivery demand and refresh cross-dock alerts.
 */
async function scanAllCrossDockOpportunities({ warehouse_id = null } = {}, userId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let sql = `
      SELECT 
        d.source_warehouse_id AS warehouse_id,
        dl.product_id,
        COALESCE(SUM(dl.requested_qty - dl.done_qty), 0) AS pending_demand
      FROM deliveries d
      JOIN delivery_lines dl ON d.id = dl.delivery_id
      WHERE d.status NOT IN ('done', 'cancelled')
        AND (dl.requested_qty - dl.done_qty) > 0
    `;
    const params = [];
    if (warehouse_id) {
      params.push(parseInt(warehouse_id, 10));
      sql += ' AND d.source_warehouse_id = $1';
    }
    sql += ' GROUP BY d.source_warehouse_id, dl.product_id';

    const demandRes = await client.query(sql, params);
    const generated = [];

    for (const d of demandRes.rows) {
      // Find latest receipt for this product in this warehouse
      const recSql = `
        SELECT 
          r.id AS receipt_id,
          r.destination_warehouse_id AS warehouse_id,
          rl.id AS receipt_line_id,
          rl.product_id,
          rl.received_qty,
          rl.lot_number
        FROM receipts r
        JOIN receipt_lines rl ON r.id = rl.receipt_id
        WHERE r.destination_warehouse_id = $1
          AND rl.product_id = $2
          AND r.status = 'done'
        ORDER BY r.created_at DESC
        LIMIT 1;
      `;
      const recRes = await client.query(recSql, [d.warehouse_id, d.product_id]);
      if (recRes.rows.length > 0) {
        const rec = recRes.rows[0];
        const res = await checkCrossDockOpportunities(client, {
          receiptId: rec.receipt_id,
          lines: [{ id: rec.receipt_line_id, product_id: rec.product_id, received_qty: rec.received_qty }],
          warehouseId: rec.warehouse_id
        });
        if (res.length > 0) generated.push(...res);
      }
    }

    await client.query('COMMIT');
    return {
      success: true,
      message: `Cross-dock scan completed. ${generated.length} alert(s) identified.`,
      alerts: generated
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List cross-dock alerts with enriched product, lot, and order details.
 */
async function listCrossDockAlerts({ warehouse_id = null, status = null } = {}) {
  let sql = `
    SELECT 
      xda.id,
      xda.alert_number,
      xda.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      xda.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.tracking_type,
      uom.name AS uom_name,
      xda.receipt_id,
      rec.reference AS receipt_reference,
      xda.lot_id,
      l.lot_number,
      l.expiry_date,
      xda.received_qty,
      xda.pending_demand_qty,
      xda.suggested_cross_dock_qty,
      xda.pending_delivery_id,
      del.reference AS pending_delivery_reference,
      del.customer_name AS pending_delivery_customer,
      xda.status,
      xda.notes,
      xda.created_at,
      xda.acknowledged_at,
      xda.dismissed_at
    FROM cross_dock_alerts xda
    JOIN warehouses w ON xda.warehouse_id = w.id
    JOIN products p ON xda.product_id = p.id
    JOIN uom ON p.uom_id = uom.id
    JOIN receipts rec ON xda.receipt_id = rec.id
    LEFT JOIN lots l ON xda.lot_id = l.id
    LEFT JOIN deliveries del ON xda.pending_delivery_id = del.id
  `;

  const where = [];
  const params = [];

  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    where.push(`xda.warehouse_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`xda.status = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY CASE xda.status WHEN \'active\' THEN 1 WHEN \'acknowledged\' THEN 2 ELSE 3 END, xda.created_at DESC;';

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get cross-dock alert by ID.
 */
async function getCrossDockAlertById(alertId) {
  const aId = parseInt(alertId, 10);
  const sql = `
    SELECT 
      xda.id,
      xda.alert_number,
      xda.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      xda.product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      p.tracking_type,
      uom.name AS uom_name,
      xda.receipt_id,
      rec.reference AS receipt_reference,
      xda.lot_id,
      l.lot_number,
      l.expiry_date,
      xda.received_qty,
      xda.pending_demand_qty,
      xda.suggested_cross_dock_qty,
      xda.pending_delivery_id,
      del.reference AS pending_delivery_reference,
      del.customer_name AS pending_delivery_customer,
      xda.status,
      xda.notes,
      xda.created_at,
      xda.acknowledged_at,
      xda.dismissed_at
    FROM cross_dock_alerts xda
    JOIN warehouses w ON xda.warehouse_id = w.id
    JOIN products p ON xda.product_id = p.id
    JOIN uom ON p.uom_id = uom.id
    JOIN receipts rec ON xda.receipt_id = rec.id
    LEFT JOIN lots l ON xda.lot_id = l.id
    LEFT JOIN deliveries del ON xda.pending_delivery_id = del.id
    WHERE xda.id = $1
  `;
  const res = await query(sql, [aId]);
  if (res.rows.length === 0) throw new AppError('Cross-dock alert not found.', 404, 'NOT_FOUND');
  return res.rows[0];
}

/**
 * Acknowledge cross-dock alert.
 */
async function acknowledgeCrossDockAlert(alertId, userId, ipAddress = null) {
  const aId = parseInt(alertId, 10);
  const alert = await getCrossDockAlertById(aId);

  await query(
    "UPDATE cross_dock_alerts SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = $1",
    [aId]
  );

  await logAudit({
    userId,
    action: 'CROSS_DOCK_ACKNOWLEDGE',
    entityType: 'cross_dock_alerts',
    entityId: aId,
    newValues: { alert_number: alert.alert_number, status: 'acknowledged' },
    ipAddress
  });

  return {
    success: true,
    message: `Cross-dock alert ${alert.alert_number} acknowledged.`,
    alert_id: aId
  };
}

/**
 * Dismiss cross-dock alert.
 */
async function dismissCrossDockAlert(alertId, userId, ipAddress = null) {
  const aId = parseInt(alertId, 10);
  const alert = await getCrossDockAlertById(aId);

  await query(
    "UPDATE cross_dock_alerts SET status = 'dismissed', dismissed_at = NOW() WHERE id = $1",
    [aId]
  );

  await logAudit({
    userId,
    action: 'CROSS_DOCK_DISMISS',
    entityType: 'cross_dock_alerts',
    entityId: aId,
    newValues: { alert_number: alert.alert_number, status: 'dismissed' },
    ipAddress
  });

  return {
    success: true,
    message: `Cross-dock alert ${alert.alert_number} dismissed.`,
    alert_id: aId
  };
}

module.exports = {
  checkCrossDockOpportunities,
  scanAllCrossDockOpportunities,
  listCrossDockAlerts,
  getCrossDockAlertById,
  acknowledgeCrossDockAlert,
  dismissCrossDockAlert
};
