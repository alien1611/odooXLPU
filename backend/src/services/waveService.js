const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');
const { processDelivery } = require('./deliveryService');
const crypto = require('crypto');

function generateWaveReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `WAVE-${dateStr}-${rand}`;
}

/**
 * Create a new pick wave for a warehouse and optionally assign pending deliveries.
 */
async function createWave({ warehouse_id, notes = null, delivery_ids = [] }, userId, ipAddress = null) {
  const whId = parseInt(warehouse_id, 10);
  if (!whId) throw new AppError('warehouse_id is required.', 400, 'VALIDATION_ERROR');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify warehouse
    const whRes = await client.query('SELECT id, code, name FROM warehouses WHERE id = $1', [whId]);
    if (whRes.rows.length === 0) {
      throw new AppError('Warehouse not found.', 404, 'NOT_FOUND');
    }

    const waveNumber = generateWaveReference();

    // 2. Insert pick_waves header
    const waveSql = `
      INSERT INTO pick_waves (
        wave_number, warehouse_id, status, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, 'draft', $3, $4, NOW(), NOW())
      RETURNING id, wave_number, warehouse_id, status, notes, created_by, created_at;
    `;
    const waveRes = await client.query(waveSql, [waveNumber, whId, notes, userId]);
    const wave = waveRes.rows[0];

    // 3. Link deliveries if provided
    if (Array.isArray(delivery_ids) && delivery_ids.length > 0) {
      for (const rawId of delivery_ids) {
        const dId = parseInt(rawId, 10);
        if (!dId) continue;

        const dRes = await client.query(
          'SELECT id, reference, source_warehouse_id, status, wave_id FROM deliveries WHERE id = $1 FOR UPDATE',
          [dId]
        );
        if (dRes.rows.length === 0) {
          throw new AppError(`Delivery ID ${dId} not found.`, 404, 'NOT_FOUND');
        }
        const deliv = dRes.rows[0];

        if (deliv.source_warehouse_id !== whId) {
          throw new AppError(
            `Delivery "${deliv.reference}" belongs to another warehouse and cannot be added to this wave.`,
            400,
            'WAREHOUSE_MISMATCH'
          );
        }
        if (deliv.status === 'done' || deliv.status === 'cancelled') {
          throw new AppError(
            `Delivery "${deliv.reference}" is already in "${deliv.status}" status and cannot be added to a wave.`,
            400,
            'INVALID_STATUS'
          );
        }
        if (deliv.wave_id && deliv.wave_id !== wave.id) {
          throw new AppError(
            `Delivery "${deliv.reference}" is already assigned to another wave (Wave ID: ${deliv.wave_id}).`,
            409,
            'ALREADY_ASSIGNED'
          );
        }

        await client.query('UPDATE deliveries SET wave_id = $1, updated_at = NOW() WHERE id = $2', [wave.id, dId]);
      }
    }

    // 4. Audit Log
    await logAudit({
      userId,
      action: 'WAVE_CREATE',
      entityType: 'pick_waves',
      entityId: wave.id,
      newValues: {
        wave_number: wave.wave_number,
        warehouse_id: whId,
        deliveries_count: delivery_ids.length
      },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return {
      ...wave,
      delivery_count: Array.isArray(delivery_ids) ? delivery_ids.length : 0
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List pick waves with summary statistics.
 */
async function listWaves({ warehouse_id = null, status = null } = {}) {
  let sql = `
    SELECT 
      pw.id,
      pw.wave_number,
      pw.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      pw.status,
      pw.notes,
      pw.created_by,
      u.full_name AS created_by_name,
      pw.started_at,
      pw.completed_at,
      pw.created_at,
      COUNT(DISTINCT d.id)::int AS delivery_count,
      COALESCE(SUM(dl.requested_qty), 0)::numeric AS total_requested_qty,
      COALESCE(SUM(dl.done_qty), 0)::numeric AS total_done_qty
    FROM pick_waves pw
    JOIN warehouses w ON pw.warehouse_id = w.id
    LEFT JOIN users u ON pw.created_by = u.id
    LEFT JOIN deliveries d ON d.wave_id = pw.id
    LEFT JOIN delivery_lines dl ON dl.delivery_id = d.id
  `;

  const where = [];
  const params = [];

  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    where.push(`pw.warehouse_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`pw.status = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += `
    GROUP BY pw.id, pw.wave_number, pw.warehouse_id, w.name, w.code, pw.status, pw.notes, pw.created_by, u.full_name, pw.started_at, pw.completed_at, pw.created_at
    ORDER BY pw.created_at DESC, pw.id DESC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get detailed wave including deliveries and location-grouped picking sequence.
 */
async function getWaveById(waveId) {
  const wId = parseInt(waveId, 10);
  const waveRes = await query(
    `SELECT 
      pw.id,
      pw.wave_number,
      pw.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      pw.status,
      pw.notes,
      pw.created_by,
      u.full_name AS created_by_name,
      pw.started_at,
      pw.completed_at,
      pw.created_at
    FROM pick_waves pw
    JOIN warehouses w ON pw.warehouse_id = w.id
    LEFT JOIN users u ON pw.created_by = u.id
    WHERE pw.id = $1`,
    [wId]
  );

  if (waveRes.rows.length === 0) {
    throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
  }
  const wave = waveRes.rows[0];

  // Fetch assigned deliveries
  const delivsRes = await query(
    `SELECT 
      d.id,
      d.reference,
      d.customer_name,
      d.status,
      d.created_at,
      COUNT(dl.id)::int AS line_count,
      COALESCE(SUM(dl.requested_qty), 0)::numeric AS total_qty,
      COALESCE(SUM(dl.done_qty), 0)::numeric AS done_qty
    FROM deliveries d
    LEFT JOIN delivery_lines dl ON d.id = dl.delivery_id
    WHERE d.wave_id = $1
    GROUP BY d.id, d.reference, d.customer_name, d.status, d.created_at
    ORDER BY d.id ASC`,
    [wId]
  );

  // Fetch delivery lines grouped by Location/Bin -> Product
  const linesRes = await query(
    `SELECT 
      dl.id AS line_id,
      dl.delivery_id,
      d.reference AS delivery_reference,
      d.customer_name,
      d.status AS delivery_status,
      dl.product_id,
      p.name AS product_name,
      p.sku,
      p.tracking_type,
      uom.name AS uom_name,
      dl.src_location_id,
      loc.code AS location_code,
      loc.name AS location_name,
      loc.barcode AS location_barcode,
      dl.requested_qty,
      dl.done_qty
    FROM delivery_lines dl
    JOIN deliveries d ON dl.delivery_id = d.id
    JOIN products p ON dl.product_id = p.id
    JOIN uom ON p.uom_id = uom.id
    JOIN locations loc ON dl.src_location_id = loc.id
    WHERE d.wave_id = $1
    ORDER BY loc.code ASC, p.name ASC, dl.id ASC`,
    [wId]
  );

  // Fetch executed moves for completed deliveries in this wave
  const movesRes = await query(
    `SELECT 
      sm.product_id,
      sm.lot_id,
      l.lot_number,
      l.expiry_date,
      sm.quantity,
      sm.origin_document
    FROM stock_moves sm
    JOIN lots l ON sm.lot_id = l.id
    WHERE sm.origin_document IN (
      SELECT 'delivery:' || d.reference FROM deliveries d WHERE d.wave_id = $1
    ) AND sm.state = 'done'`,
    [wId]
  );

  // Fetch available lots for lot-tracked items at src locations
  const lotsRes = await query(
    `SELECT 
      sq.product_id,
      sq.location_id,
      sq.lot_id,
      l.lot_number,
      l.expiry_date,
      (sq.quantity - sq.reserved_quantity) AS available_qty
    FROM stock_quants sq
    JOIN lots l ON sq.lot_id = l.id
    WHERE sq.location_id IN (
      SELECT dl.src_location_id FROM delivery_lines dl JOIN deliveries d ON dl.delivery_id = d.id WHERE d.wave_id = $1
    ) AND sq.product_id IN (
      SELECT dl.product_id FROM delivery_lines dl JOIN deliveries d ON dl.delivery_id = d.id WHERE d.wave_id = $1
    ) AND (sq.quantity - sq.reserved_quantity) > 0
    ORDER BY l.expiry_date ASC, sq.quantity DESC`,
    [wId]
  );

  const enrichedLines = linesRes.rows.map(line => {
    let lots = [];
    if (line.delivery_status === 'done') {
      lots = movesRes.rows
        .filter(m => m.origin_document === `delivery:${line.delivery_reference}` && parseInt(m.product_id, 10) === parseInt(line.product_id, 10))
        .map(m => ({
          lot_id: m.lot_id,
          lot_number: m.lot_number,
          expiry_date: m.expiry_date,
          quantity: parseFloat(m.quantity)
        }));
    } else if (line.tracking_type === 'lot') {
      lots = lotsRes.rows
        .filter(al => parseInt(al.location_id, 10) === parseInt(line.src_location_id, 10) && parseInt(al.product_id, 10) === parseInt(line.product_id, 10))
        .map(al => ({
          lot_id: al.lot_id,
          lot_number: al.lot_number,
          expiry_date: al.expiry_date,
          available_qty: parseFloat(al.available_qty)
        }));
    }
    return {
      ...line,
      lot_allocations: lots
    };
  });

  // Group items by Location for warehouse pick path optimization
  const locationPicksMap = {};
  enrichedLines.forEach(line => {
    const locKey = line.src_location_id;
    if (!locationPicksMap[locKey]) {
      locationPicksMap[locKey] = {
        location_id: line.src_location_id,
        location_code: line.location_code,
        location_name: line.location_name,
        location_barcode: line.location_barcode,
        items: []
      };
    }
    locationPicksMap[locKey].items.push(line);
  });

  const locationPicks = Object.values(locationPicksMap);

  // Compute progress summary
  const totalDeliveries = delivsRes.rows.length;
  const completedDeliveries = delivsRes.rows.filter(d => d.status === 'done').length;
  const totalQty = enrichedLines.reduce((sum, l) => sum + parseFloat(l.requested_qty), 0);
  const doneQty = enrichedLines.reduce((sum, l) => sum + parseFloat(l.done_qty), 0);

  return {
    ...wave,
    progress: {
      total_deliveries: totalDeliveries,
      completed_deliveries: completedDeliveries,
      total_qty: totalQty,
      done_qty: doneQty,
      percent: totalQty > 0 ? Math.round((doneQty / totalQty) * 100) : 0
    },
    deliveries: delivsRes.rows,
    location_picks: locationPicks,
    lines: enrichedLines
  };
}

/**
 * Add eligible delivery orders to an existing draft/released wave.
 */
async function addDeliveriesToWave(waveId, deliveryIds = [], userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) {
    throw new AppError('delivery_ids array is required.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, warehouse_id, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status !== 'draft' && wave.status !== 'released') {
      throw new AppError(`Cannot modify deliveries for a wave in "${wave.status}" status.`, 400, 'INVALID_STATE');
    }

    for (const rawId of deliveryIds) {
      const dId = parseInt(rawId, 10);
      if (!dId) continue;

      const dRes = await client.query(
        'SELECT id, reference, source_warehouse_id, status, wave_id FROM deliveries WHERE id = $1 FOR UPDATE',
        [dId]
      );
      if (dRes.rows.length === 0) throw new AppError(`Delivery ID ${dId} not found.`, 404, 'NOT_FOUND');
      const deliv = dRes.rows[0];

      if (deliv.source_warehouse_id !== wave.warehouse_id) {
        throw new AppError(`Delivery "${deliv.reference}" belongs to another warehouse.`, 400, 'WAREHOUSE_MISMATCH');
      }
      if (deliv.status === 'done' || deliv.status === 'cancelled') {
        throw new AppError(`Delivery "${deliv.reference}" is already ${deliv.status}.`, 400, 'INVALID_STATUS');
      }
      if (deliv.wave_id && deliv.wave_id !== wave.id) {
        throw new AppError(`Delivery "${deliv.reference}" is already in wave ID ${deliv.wave_id}.`, 409, 'ALREADY_ASSIGNED');
      }

      await client.query('UPDATE deliveries SET wave_id = $1, updated_at = NOW() WHERE id = $2', [wave.id, dId]);
    }

    await client.query('UPDATE pick_waves SET updated_at = NOW() WHERE id = $1', [wave.id]);
    await client.query('COMMIT');
    return await getWaveById(wId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove a delivery order from a wave.
 */
async function removeDeliveryFromWave(waveId, deliveryId, userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  const dId = parseInt(deliveryId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status !== 'draft' && wave.status !== 'released') {
      throw new AppError(`Cannot remove deliveries from a wave in "${wave.status}" status.`, 400, 'INVALID_STATE');
    }

    const dRes = await client.query(
      'SELECT id, reference, wave_id FROM deliveries WHERE id = $1 AND wave_id = $2 FOR UPDATE',
      [dId, wId]
    );
    if (dRes.rows.length === 0) {
      throw new AppError('Delivery is not assigned to this wave.', 404, 'NOT_FOUND');
    }

    await client.query('UPDATE deliveries SET wave_id = NULL, updated_at = NOW() WHERE id = $1', [dId]);
    await client.query('UPDATE pick_waves SET updated_at = NOW() WHERE id = $1', [wId]);
    await client.query('COMMIT');
    return { success: true, message: `Delivery removed from wave ${wId}.` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transition wave from 'draft' to 'released'.
 */
async function releaseWave(waveId, userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, wave_number, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status !== 'draft') {
      throw new AppError(`Only draft waves can be released (current status: ${wave.status}).`, 400, 'INVALID_STATE');
    }

    const countRes = await client.query('SELECT COUNT(id)::int AS cnt FROM deliveries WHERE wave_id = $1', [wId]);
    if (countRes.rows[0].cnt === 0) {
      throw new AppError('Cannot release a wave with 0 deliveries assigned.', 400, 'EMPTY_WAVE');
    }

    await client.query(
      "UPDATE pick_waves SET status = 'released', updated_at = NOW() WHERE id = $1",
      [wId]
    );

    await logAudit({
      userId,
      action: 'WAVE_RELEASE',
      entityType: 'pick_waves',
      entityId: wId,
      newValues: { status: 'released' },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return await getWaveById(wId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transition wave from 'released' to 'picking'.
 */
async function startWave(waveId, userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, wave_number, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status !== 'released' && wave.status !== 'draft') {
      throw new AppError(`Cannot start wave in "${wave.status}" status.`, 400, 'INVALID_STATE');
    }

    await client.query(
      "UPDATE pick_waves SET status = 'picking', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1",
      [wId]
    );

    await logAudit({
      userId,
      action: 'WAVE_START',
      entityType: 'pick_waves',
      entityId: wId,
      newValues: { status: 'picking' },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return await getWaveById(wId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Complete wave by executing FEFO delivery fulfillment for all pending deliveries in the wave.
 */
async function completeWave(waveId, userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, wave_number, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status === 'completed') {
      await client.query('COMMIT');
      return await getWaveById(wId);
    }
    if (wave.status === 'cancelled') {
      throw new AppError('Cannot complete a cancelled wave.', 400, 'INVALID_STATE');
    }

    // Find pending deliveries assigned to this wave
    const delivsRes = await client.query(
      "SELECT id, reference, status FROM deliveries WHERE wave_id = $1 AND status != 'done' AND status != 'cancelled' ORDER BY id ASC",
      [wId]
    );

    // Process each delivery using authoritative FEFO logic
    for (const d of delivsRes.rows) {
      await processDelivery(d.id, userId, ipAddress, client);
    }

    await client.query(
      "UPDATE pick_waves SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
      [wId]
    );

    await logAudit({
      userId,
      action: 'WAVE_COMPLETE',
      entityType: 'pick_waves',
      entityId: wId,
      newValues: { status: 'completed', processed_deliveries_count: delivsRes.rows.length },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return await getWaveById(wId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel a wave and detach all delivery orders.
 */
async function cancelWave(waveId, userId, ipAddress = null) {
  const wId = parseInt(waveId, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const waveRes = await client.query(
      'SELECT id, wave_number, status FROM pick_waves WHERE id = $1 FOR UPDATE',
      [wId]
    );
    if (waveRes.rows.length === 0) throw new AppError('Pick wave not found.', 404, 'NOT_FOUND');
    const wave = waveRes.rows[0];

    if (wave.status === 'completed') {
      throw new AppError('Cannot cancel a completed wave.', 400, 'INVALID_STATE');
    }

    await client.query('UPDATE deliveries SET wave_id = NULL, updated_at = NOW() WHERE wave_id = $1', [wId]);
    await client.query("UPDATE pick_waves SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [wId]);

    await logAudit({
      userId,
      action: 'WAVE_CANCEL',
      entityType: 'pick_waves',
      entityId: wId,
      newValues: { status: 'cancelled' },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return await getWaveById(wId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createWave,
  listWaves,
  getWaveById,
  addDeliveriesToWave,
  removeDeliveryFromWave,
  releaseWave,
  startWave,
  completeWave,
  cancelWave
};
