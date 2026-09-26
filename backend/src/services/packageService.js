const { pool, query } = require('../db/pool');
const { AppError } = require('./authService');
const { logAudit } = require('./auditService');
const crypto = require('crypto');

function generatePackageNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PKG-${dateStr}-${rand}`;
}

function generateLocalTrackingNumber(prefix = 'TRK') {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const cleanPrefix = (prefix || 'TRK').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${cleanPrefix}-${dateStr}-${rand}`;
}

/**
 * List deliveries eligible for packing at the packing station.
 */
async function listReadyDeliveries({ warehouse_id = null, search = null } = {}) {
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
      d.created_at,
      COUNT(dl.id)::int AS line_count,
      COALESCE(SUM(CASE WHEN d.status = 'done' AND dl.done_qty > 0 THEN dl.done_qty ELSE dl.requested_qty END), 0)::numeric AS deliverable_qty
    FROM deliveries d
    JOIN warehouses w ON d.source_warehouse_id = w.id
    JOIN delivery_lines dl ON d.id = dl.delivery_id
    WHERE d.status IN ('done', 'ready')
  `;

  const params = [];
  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    sql += ` AND d.source_warehouse_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    sql += ` AND (LOWER(d.reference) LIKE $${params.length} OR LOWER(d.customer_name) LIKE $${params.length})`;
  }

  sql += `
    GROUP BY d.id, d.reference, d.customer_name, d.source_warehouse_id, w.name, w.code, d.status, d.scheduled_date, d.created_at
    ORDER BY d.created_at DESC;
  `;

  const res = await query(sql, params);
  if (res.rows.length === 0) return [];

  // Query packed quantities per delivery
  const packedRes = await query(`
    SELECT 
      dl.delivery_id,
      COALESCE(SUM(pl.packed_qty), 0)::numeric AS packed_qty
    FROM package_lines pl
    JOIN delivery_lines dl ON pl.delivery_line_id = dl.id
    GROUP BY dl.delivery_id;
  `);
  const packedMap = {};
  packedRes.rows.forEach(r => {
    packedMap[r.delivery_id] = parseFloat(r.packed_qty);
  });

  // Query active package count per delivery
  const pkgCountRes = await query(`
    SELECT delivery_id, COUNT(id)::int AS package_count
    FROM packages
    WHERE status != 'cancelled'
    GROUP BY delivery_id;
  `);
  const pkgCountMap = {};
  pkgCountRes.rows.forEach(r => {
    pkgCountMap[r.delivery_id] = parseInt(r.package_count, 10);
  });

  return res.rows.map(row => {
    const deliverable = parseFloat(row.deliverable_qty);
    const packed = packedMap[row.id] || 0;
    const remaining = Math.max(0, deliverable - packed);
    const pkgCount = pkgCountMap[row.id] || 0;
    return {
      ...row,
      package_count: pkgCount,
      deliverable_qty: deliverable,
      already_packed_qty: packed,
      remaining_to_pack: remaining,
      packing_complete: deliverable > 0 && packed >= deliverable
    };
  });
}

/**
 * Create a new carton / package for a delivery.
 */
async function createPackage({
  delivery_id,
  warehouse_id,
  package_type = 'box',
  length = 0,
  width = 0,
  height = 0,
  dimension_unit = 'cm',
  gross_weight = 0,
  tare_weight = 0,
  weight_unit = 'kg',
  notes = null
}, userId, ipAddress = null) {
  const dId = parseInt(delivery_id, 10);
  if (!dId) throw new AppError('delivery_id is required.', 400, 'VALIDATION_ERROR');

  const lenVal = parseFloat(length || 0);
  const widVal = parseFloat(width || 0);
  const hgtVal = parseFloat(height || 0);
  const grossVal = parseFloat(gross_weight || 0);
  const tareVal = parseFloat(tare_weight || 0);

  if (lenVal < 0 || widVal < 0 || hgtVal < 0) {
    throw new AppError('Package dimensions cannot be negative.', 400, 'VALIDATION_ERROR');
  }
  if (grossVal < 0 || tareVal < 0) {
    throw new AppError('Package weights cannot be negative.', 400, 'VALIDATION_ERROR');
  }
  if (grossVal < tareVal) {
    throw new AppError('Gross weight cannot be less than tare weight.', 400, 'VALIDATION_ERROR');
  }

  const netVal = Math.round((grossVal - tareVal) * 1000) / 1000;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify delivery
    const delivRes = await client.query(
      'SELECT id, reference, source_warehouse_id, status FROM deliveries WHERE id = $1',
      [dId]
    );
    if (delivRes.rows.length === 0) {
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    }
    const delivery = delivRes.rows[0];

    if (delivery.status === 'cancelled') {
      throw new AppError('Cannot create a package for a cancelled delivery.', 400, 'INVALID_STATUS');
    }

    const whId = warehouse_id ? parseInt(warehouse_id, 10) : parseInt(delivery.source_warehouse_id, 10);
    if (whId !== parseInt(delivery.source_warehouse_id, 10)) {
      throw new AppError('Warehouse ID does not match delivery source warehouse.', 400, 'WAREHOUSE_MISMATCH');
    }

    const pkgNumber = generatePackageNumber();

    const insertSql = `
      INSERT INTO packages (
        package_number, delivery_id, warehouse_id, package_type,
        length, width, height, dimension_unit,
        gross_weight, tare_weight, net_weight, weight_unit,
        status, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        'packing', $13, $14, NOW(), NOW()
      )
      RETURNING id, package_number, delivery_id, warehouse_id, package_type,
                length, width, height, dimension_unit,
                gross_weight, tare_weight, net_weight, weight_unit,
                status, notes, created_by, created_at;
    `;
    const res = await client.query(insertSql, [
      pkgNumber,
      dId,
      whId,
      package_type || 'box',
      lenVal,
      widVal,
      hgtVal,
      dimension_unit || 'cm',
      grossVal,
      tareVal,
      netVal,
      weight_unit || 'kg',
      notes,
      userId
    ]);
    const pkg = res.rows[0];

    // Audit Log
    await logAudit({
      userId,
      action: 'PACKAGE_CREATE',
      entityType: 'packages',
      entityId: pkg.id,
      newValues: {
        package_number: pkg.package_number,
        delivery_id: dId,
        package_type: pkg.package_type
      },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return pkg;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List packages with summary details.
 */
async function listPackages({ delivery_id = null, warehouse_id = null, status = null, carrier_id = null } = {}) {
  let sql = `
    SELECT 
      p.id,
      p.package_number,
      p.delivery_id,
      d.reference AS delivery_reference,
      d.customer_name,
      p.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      p.package_type,
      p.length,
      p.width,
      p.height,
      p.dimension_unit,
      p.gross_weight,
      p.tare_weight,
      p.net_weight,
      p.weight_unit,
      p.status,
      p.carrier_id,
      c.carrier_name,
      c.carrier_code,
      p.tracking_number,
      p.notes,
      p.created_by,
      u1.full_name AS created_by_name,
      p.packed_by,
      u2.full_name AS packed_by_name,
      p.dispatched_by,
      u3.full_name AS dispatched_by_name,
      p.packed_at,
      p.dispatched_at,
      p.created_at,
      p.updated_at,
      COUNT(pl.id)::int AS item_count,
      COALESCE(SUM(pl.packed_qty), 0)::numeric AS total_packed_qty
    FROM packages p
    JOIN deliveries d ON p.delivery_id = d.id
    JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN carriers c ON p.carrier_id = c.id
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.packed_by = u2.id
    LEFT JOIN users u3 ON p.dispatched_by = u3.id
    LEFT JOIN package_lines pl ON p.id = pl.package_id
  `;

  const where = [];
  const params = [];

  if (delivery_id) {
    params.push(parseInt(delivery_id, 10));
    where.push(`p.delivery_id = $${params.length}`);
  }
  if (warehouse_id) {
    params.push(parseInt(warehouse_id, 10));
    where.push(`p.warehouse_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`p.status = $${params.length}`);
  }
  if (carrier_id) {
    params.push(parseInt(carrier_id, 10));
    where.push(`p.carrier_id = $${params.length}`);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += `
    GROUP BY p.id, p.package_number, p.delivery_id, d.reference, d.customer_name,
             p.warehouse_id, w.name, w.code, p.package_type, p.length, p.width, p.height,
             p.dimension_unit, p.gross_weight, p.tare_weight, p.net_weight, p.weight_unit,
             p.status, p.carrier_id, c.carrier_name, c.carrier_code, p.tracking_number, p.notes,
             p.created_by, u1.full_name, p.packed_by, u2.full_name, p.dispatched_by, u3.full_name,
             p.packed_at, p.dispatched_at, p.created_at, p.updated_at
    ORDER BY p.created_at DESC, p.id DESC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Get detailed package with its packed lines, delivery details, and carrier.
 */
async function getPackageById(packageId) {
  const pId = parseInt(packageId, 10);
  if (!pId) throw new AppError('Invalid package ID.', 400, 'VALIDATION_ERROR');

  const headSql = `
    SELECT 
      p.id,
      p.package_number,
      p.delivery_id,
      d.reference AS delivery_reference,
      d.customer_name,
      d.status AS delivery_status,
      p.warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      p.package_type,
      p.length,
      p.width,
      p.height,
      p.dimension_unit,
      p.gross_weight,
      p.tare_weight,
      p.net_weight,
      p.weight_unit,
      p.status,
      p.carrier_id,
      c.carrier_name,
      c.carrier_code,
      c.service_level,
      p.tracking_number,
      p.notes,
      p.created_by,
      u1.full_name AS created_by_name,
      p.packed_by,
      u2.full_name AS packed_by_name,
      p.dispatched_by,
      u3.full_name AS dispatched_by_name,
      p.packed_at,
      p.dispatched_at,
      p.created_at,
      p.updated_at
    FROM packages p
    JOIN deliveries d ON p.delivery_id = d.id
    JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN carriers c ON p.carrier_id = c.id
    LEFT JOIN users u1 ON p.created_by = u1.id
    LEFT JOIN users u2 ON p.packed_by = u2.id
    LEFT JOIN users u3 ON p.dispatched_by = u3.id
    WHERE p.id = $1
  `;
  const headRes = await query(headSql, [pId]);
  if (headRes.rows.length === 0) {
    throw new AppError('Package not found.', 404, 'NOT_FOUND');
  }
  const pkg = headRes.rows[0];

  // Fetch package lines
  const linesSql = `
    SELECT 
      pl.id,
      pl.package_id,
      pl.delivery_line_id,
      pl.product_id,
      pr.name AS product_name,
      pr.sku AS product_sku,
      pr.tracking_type,
      uom.name AS uom_name,
      pl.lot_id,
      l.lot_number,
      l.expiry_date,
      pl.packed_qty,
      dl.requested_qty AS delivery_requested_qty,
      dl.done_qty AS delivery_done_qty,
      pl.created_at
    FROM package_lines pl
    JOIN products pr ON pl.product_id = pr.id
    JOIN uom ON pr.uom_id = uom.id
    JOIN delivery_lines dl ON pl.delivery_line_id = dl.id
    LEFT JOIN lots l ON pl.lot_id = l.id
    WHERE pl.package_id = $1
    ORDER BY pl.id ASC;
  `;
  const linesRes = await query(linesSql, [pId]);

  return {
    ...pkg,
    lines: linesRes.rows
  };
}

/**
 * Add an item / line to an open package.
 */
async function addPackageLine(packageId, { delivery_line_id, product_id, lot_id = null, packed_qty }, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);
  const dlId = parseInt(delivery_line_id, 10);
  const prId = parseInt(product_id, 10);
  const qty = parseFloat(packed_qty);

  if (!pId || !dlId || !prId) {
    throw new AppError('package_id, delivery_line_id, and product_id are required.', 400, 'VALIDATION_ERROR');
  }
  if (isNaN(qty) || qty <= 0) {
    throw new AppError('packed_qty must be greater than zero.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock package
    const pkgRes = await client.query(
      'SELECT id, delivery_id, status FROM packages WHERE id = $1 FOR UPDATE',
      [pId]
    );
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    const pkg = pkgRes.rows[0];

    if (pkg.status !== 'packing') {
      throw new AppError(`Cannot add items to a package in "${pkg.status}" status.`, 400, 'INVALID_STATE');
    }

    // 2. Lock delivery line
    const dlRes = await client.query(
      `SELECT dl.id, dl.delivery_id, dl.product_id, dl.requested_qty, dl.done_qty, d.status AS delivery_status
       FROM delivery_lines dl
       JOIN deliveries d ON dl.delivery_id = d.id
       WHERE dl.id = $1 FOR UPDATE`,
      [dlId]
    );
    if (dlRes.rows.length === 0) throw new AppError('Delivery line not found.', 404, 'NOT_FOUND');
    const delivLine = dlRes.rows[0];

    if (parseInt(delivLine.delivery_id, 10) !== parseInt(pkg.delivery_id, 10)) {
      throw new AppError('Delivery line does not belong to this package delivery.', 400, 'DELIVERY_MISMATCH');
    }
    if (parseInt(delivLine.product_id, 10) !== parseInt(prId, 10)) {
      throw new AppError('Product ID does not match delivery line product.', 400, 'PRODUCT_MISMATCH');
    }

    // 3. Compute deliverable limit
    const deliverableLimit = parseFloat(
      delivLine.done_qty > 0 ? delivLine.done_qty : delivLine.requested_qty
    );

    // 4. Calculate total already packed across all packages for this delivery line
    const packedSumRes = await client.query(
      'SELECT COALESCE(SUM(packed_qty), 0) AS total_packed FROM package_lines WHERE delivery_line_id = $1',
      [dlId]
    );
    const currentlyPacked = parseFloat(packedSumRes.rows[0].total_packed);

    if (currentlyPacked + qty > deliverableLimit) {
      throw new AppError(
        `Packed quantity (${currentlyPacked + qty}) would exceed total deliverable quantity (${deliverableLimit}) for this line.`,
        400,
        'EXCEEDS_DELIVERABLE_QTY'
      );
    }

    // 5. Insert package line
    const insertSql = `
      INSERT INTO package_lines (package_id, delivery_line_id, product_id, lot_id, packed_qty, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, package_id, delivery_line_id, product_id, lot_id, packed_qty;
    `;
    const lineRes = await client.query(insertSql, [pId, dlId, prId, lot_id || null, qty]);
    const line = lineRes.rows[0];

    await client.query('UPDATE packages SET updated_at = NOW() WHERE id = $1', [pId]);

    // Audit Log
    await logAudit({
      userId,
      action: 'PACKAGE_LINE_ADD',
      entityType: 'package_lines',
      entityId: line.id,
      newValues: {
        package_id: pId,
        product_id: prId,
        lot_id,
        packed_qty: qty
      },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return line;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update a package line quantity.
 */
async function updatePackageLine(packageId, lineId, { packed_qty }, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);
  const lId = parseInt(lineId, 10);
  const newQty = parseFloat(packed_qty);

  if (isNaN(newQty) || newQty <= 0) {
    throw new AppError('packed_qty must be greater than zero.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgRes = await client.query('SELECT id, status FROM packages WHERE id = $1 FOR UPDATE', [pId]);
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    if (pkgRes.rows[0].status !== 'packing') {
      throw new AppError(`Cannot modify line in "${pkgRes.rows[0].status}" package.`, 400, 'INVALID_STATE');
    }

    const lineRes = await client.query(
      'SELECT id, delivery_line_id, packed_qty FROM package_lines WHERE id = $1 AND package_id = $2 FOR UPDATE',
      [lId, pId]
    );
    if (lineRes.rows.length === 0) throw new AppError('Package line not found.', 404, 'NOT_FOUND');
    const line = lineRes.rows[0];

    const dlRes = await client.query(
      'SELECT requested_qty, done_qty FROM delivery_lines WHERE id = $1',
      [line.delivery_line_id]
    );
    const dl = dlRes.rows[0];
    const deliverableLimit = parseFloat(dl.done_qty > 0 ? dl.done_qty : dl.requested_qty);

    const otherPackedRes = await client.query(
      'SELECT COALESCE(SUM(packed_qty), 0) AS other_packed FROM package_lines WHERE delivery_line_id = $1 AND id != $2',
      [line.delivery_line_id, lId]
    );
    const otherPacked = parseFloat(otherPackedRes.rows[0].other_packed);

    if (otherPacked + newQty > deliverableLimit) {
      throw new AppError(
        `Packed quantity (${otherPacked + newQty}) would exceed deliverable limit (${deliverableLimit}).`,
        400,
        'EXCEEDS_DELIVERABLE_QTY'
      );
    }

    await client.query(
      'UPDATE package_lines SET packed_qty = $1, updated_at = NOW() WHERE id = $2',
      [newQty, lId]
    );
    await client.query('UPDATE packages SET updated_at = NOW() WHERE id = $1', [pId]);

    await client.query('COMMIT');
    return { success: true, line_id: lId, packed_qty: newQty };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove an item / line from a package.
 */
async function removePackageLine(packageId, lineId, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);
  const lId = parseInt(lineId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgRes = await client.query('SELECT id, status FROM packages WHERE id = $1 FOR UPDATE', [pId]);
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    if (pkgRes.rows[0].status !== 'packing') {
      throw new AppError(`Cannot remove line from package in "${pkgRes.rows[0].status}" status.`, 400, 'INVALID_STATE');
    }

    const delRes = await client.query(
      'DELETE FROM package_lines WHERE id = $1 AND package_id = $2 RETURNING id',
      [lId, pId]
    );
    if (delRes.rows.length === 0) throw new AppError('Package line not found.', 404, 'NOT_FOUND');

    await client.query('UPDATE packages SET updated_at = NOW() WHERE id = $1', [pId]);
    await client.query('COMMIT');
    return { success: true, message: `Package line ${lId} removed.` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Mark package as packed (finalizing dimensions, weights, and locking contents).
 */
async function packPackage(packageId, {
  length = null,
  width = null,
  height = null,
  dimension_unit = null,
  gross_weight = null,
  tare_weight = null,
  weight_unit = null,
  notes = null
} = {}, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgRes = await client.query(
      'SELECT id, package_number, status, length, width, height, dimension_unit, gross_weight, tare_weight, net_weight, weight_unit FROM packages WHERE id = $1 FOR UPDATE',
      [pId]
    );
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    const pkg = pkgRes.rows[0];

    if (pkg.status !== 'packing') {
      throw new AppError(`Cannot pack a package that is in "${pkg.status}" status.`, 400, 'INVALID_STATE');
    }

    // Verify package has at least one item
    const countRes = await client.query(
      'SELECT COUNT(id)::int AS cnt FROM package_lines WHERE package_id = $1',
      [pId]
    );
    if (countRes.rows[0].cnt === 0) {
      throw new AppError('Cannot mark an empty package as packed. Add items first.', 400, 'EMPTY_PACKAGE');
    }

    const finalLen = length !== null && length !== undefined ? parseFloat(length) : parseFloat(pkg.length);
    const finalWid = width !== null && width !== undefined ? parseFloat(width) : parseFloat(pkg.width);
    const finalHgt = height !== null && height !== undefined ? parseFloat(height) : parseFloat(pkg.height);
    const finalGross = gross_weight !== null && gross_weight !== undefined ? parseFloat(gross_weight) : parseFloat(pkg.gross_weight);
    const finalTare = tare_weight !== null && tare_weight !== undefined ? parseFloat(tare_weight) : parseFloat(pkg.tare_weight);

    if (finalLen < 0 || finalWid < 0 || finalHgt < 0) {
      throw new AppError('Package dimensions cannot be negative.', 400, 'VALIDATION_ERROR');
    }
    if (finalGross < 0 || finalTare < 0) {
      throw new AppError('Package weights cannot be negative.', 400, 'VALIDATION_ERROR');
    }
    if (finalGross < finalTare) {
      throw new AppError('Gross weight cannot be less than tare weight.', 400, 'VALIDATION_ERROR');
    }

    const finalNet = Math.round((finalGross - finalTare) * 1000) / 1000;
    const finalDimUnit = dimension_unit || pkg.dimension_unit || 'cm';
    const finalWeightUnit = weight_unit || pkg.weight_unit || 'kg';

    const updateSql = `
      UPDATE packages
      SET status = 'packed',
          length = $1, width = $2, height = $3, dimension_unit = $4,
          gross_weight = $5, tare_weight = $6, net_weight = $7, weight_unit = $8,
          notes = COALESCE($9, notes),
          packed_by = $10,
          packed_at = NOW(),
          updated_at = NOW()
      WHERE id = $11
      RETURNING *;
    `;
    const res = await client.query(updateSql, [
      finalLen, finalWid, finalHgt, finalDimUnit,
      finalGross, finalTare, finalNet, finalWeightUnit,
      notes,
      userId,
      pId
    ]);
    const updatedPkg = res.rows[0];

    // Audit Log
    await logAudit({
      userId,
      action: 'PACKAGE_PACK',
      entityType: 'packages',
      entityId: pId,
      newValues: {
        status: 'packed',
        package_number: updatedPkg.package_number,
        net_weight: finalNet,
        gross_weight: finalGross
      },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return updatedPkg;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cancel a package.
 */
async function cancelPackage(packageId, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgRes = await client.query('SELECT id, package_number, status FROM packages WHERE id = $1 FOR UPDATE', [pId]);
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    const pkg = pkgRes.rows[0];

    if (pkg.status === 'dispatched') {
      throw new AppError('Cannot cancel a package that has already been dispatched.', 400, 'INVALID_STATE');
    }

    await client.query("UPDATE packages SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [pId]);

    await client.query('COMMIT');
    return { success: true, message: `Package ${pkg.package_number} cancelled.` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Assign carrier to a package.
 */
async function assignCarrier(packageId, { carrier_id }, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);
  const cId = parseInt(carrier_id, 10);

  if (!cId) throw new AppError('carrier_id is required.', 400, 'VALIDATION_ERROR');

  const carrierRes = await query('SELECT id, carrier_code, carrier_name FROM carriers WHERE id = $1', [cId]);
  if (carrierRes.rows.length === 0) throw new AppError('Carrier not found.', 404, 'NOT_FOUND');
  const carrier = carrierRes.rows[0];

  const updateRes = await query(
    'UPDATE packages SET carrier_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, package_number, carrier_id, status',
    [cId, pId]
  );
  if (updateRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');

  await logAudit({
    userId,
    action: 'CARRIER_ASSIGN',
    entityType: 'packages',
    entityId: pId,
    newValues: { carrier_id: cId, carrier_name: carrier.carrier_name },
    ipAddress
  });

  return await getPackageById(pId);
}

/**
 * Dispatch a packed package with carrier assignment and tracking reference.
 */
async function dispatchPackage(packageId, { carrier_id = null, tracking_number = null } = {}, userId, ipAddress = null) {
  const pId = parseInt(packageId, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pkgRes = await client.query(
      'SELECT id, package_number, delivery_id, status, carrier_id FROM packages WHERE id = $1 FOR UPDATE',
      [pId]
    );
    if (pkgRes.rows.length === 0) throw new AppError('Package not found.', 404, 'NOT_FOUND');
    const pkg = pkgRes.rows[0];

    // Must be in 'packed' status to dispatch
    if (pkg.status !== 'packed') {
      throw new AppError(`Cannot dispatch package in "${pkg.status}" status. Package must be marked "packed" first.`, 400, 'INVALID_STATE');
    }

    const effectiveCarrierId = carrier_id ? parseInt(carrier_id, 10) : pkg.carrier_id;
    if (!effectiveCarrierId) {
      throw new AppError('A carrier must be assigned before dispatching this package.', 400, 'CARRIER_REQUIRED');
    }

    const carrierRes = await client.query(
      'SELECT id, carrier_code, carrier_name, tracking_prefix, is_active FROM carriers WHERE id = $1',
      [effectiveCarrierId]
    );
    if (carrierRes.rows.length === 0) throw new AppError('Assigned carrier not found.', 404, 'NOT_FOUND');
    const carrier = carrierRes.rows[0];

    const finalTracking = (tracking_number && tracking_number.trim()) || generateLocalTrackingNumber(carrier.tracking_prefix);

    const updateSql = `
      UPDATE packages
      SET status = 'dispatched',
          carrier_id = $1,
          tracking_number = $2,
          dispatched_by = $3,
          dispatched_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;
    const res = await client.query(updateSql, [effectiveCarrierId, finalTracking, userId, pId]);
    const dispatchedPkg = res.rows[0];

    // Audit Log
    await logAudit({
      userId,
      action: 'PACKAGE_DISPATCH',
      entityType: 'packages',
      entityId: pId,
      newValues: {
        package_number: dispatchedPkg.package_number,
        carrier_name: carrier.carrier_name,
        tracking_number: finalTracking,
        status: 'dispatched'
      },
      ipAddress,
      client
    });

    await client.query('COMMIT');
    return await getPackageById(pId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generate Packing Slip document data.
 */
async function getPackingSlipData(packageId) {
  const pkg = await getPackageById(packageId);

  // Total packages for this delivery
  const totalPkgsRes = await query(
    'SELECT COUNT(id)::int AS cnt, array_agg(package_number ORDER BY id ASC) AS pkg_numbers FROM packages WHERE delivery_id = $1 AND status != \'cancelled\'',
    [pkg.delivery_id]
  );
  const totalPkgs = totalPkgsRes.rows[0].cnt;
  const pkgIndex = (totalPkgsRes.rows[0].pkg_numbers || []).indexOf(pkg.package_number) + 1;

  return {
    document_type: 'PACKING_SLIP',
    document_number: `PS-${pkg.package_number}`,
    title: 'Warehouse Packing Slip',
    issued_date: new Date().toISOString(),
    package: {
      id: pkg.id,
      package_number: pkg.package_number,
      package_type: pkg.package_type,
      status: pkg.status,
      package_index: pkgIndex > 0 ? pkgIndex : 1,
      total_packages: totalPkgs || 1,
      dimensions: {
        length: parseFloat(pkg.length),
        width: parseFloat(pkg.width),
        height: parseFloat(pkg.height),
        unit: pkg.dimension_unit
      },
      weights: {
        gross_weight: parseFloat(pkg.gross_weight),
        tare_weight: parseFloat(pkg.tare_weight),
        net_weight: parseFloat(pkg.net_weight),
        unit: pkg.weight_unit
      },
      carrier: pkg.carrier_name ? {
        code: pkg.carrier_code,
        name: pkg.carrier_name,
        service: pkg.service_level,
        tracking_number: pkg.tracking_number
      } : null,
      packed_at: pkg.packed_at,
      dispatched_at: pkg.dispatched_at,
      packed_by: pkg.packed_by_name,
      dispatched_by: pkg.dispatched_by_name
    },
    delivery: {
      id: pkg.delivery_id,
      reference: pkg.delivery_reference,
      customer_name: pkg.customer_name,
      status: pkg.delivery_status
    },
    warehouse: {
      id: pkg.warehouse_id,
      name: pkg.warehouse_name,
      code: pkg.warehouse_code
    },
    items: pkg.lines.map((l, idx) => ({
      line_number: idx + 1,
      product_name: l.product_name,
      sku: l.product_sku,
      tracking_type: l.tracking_type,
      lot_number: l.lot_number || 'N/A',
      expiry_date: l.expiry_date,
      packed_qty: parseFloat(l.packed_qty),
      uom: l.uom_name
    })),
    summary: {
      total_items: pkg.lines.length,
      total_units: pkg.lines.reduce((sum, l) => sum + parseFloat(l.packed_qty), 0),
      total_gross_weight: `${pkg.gross_weight} ${pkg.weight_unit}`,
      total_net_weight: `${pkg.net_weight} ${pkg.weight_unit}`
    }
  };
}

/**
 * Generate Bill of Lading (BOL) document data.
 */
async function getBillOfLadingData(packageId) {
  const pkg = await getPackageById(packageId);

  // Query all active packages for this shipment/delivery
  const allPkgsRes = await query(
    `SELECT 
       p.id, p.package_number, p.package_type, p.gross_weight, p.net_weight, p.weight_unit,
       p.length, p.width, p.height, p.dimension_unit,
       COUNT(pl.id)::int AS items_count,
       COALESCE(SUM(pl.packed_qty), 0)::numeric AS units_count
     FROM packages p
     LEFT JOIN package_lines pl ON p.id = pl.package_id
     WHERE p.delivery_id = $1 AND p.status != 'cancelled'
     GROUP BY p.id, p.package_number, p.package_type, p.gross_weight, p.net_weight, p.weight_unit, p.length, p.width, p.height, p.dimension_unit
     ORDER BY p.id ASC;`,
    [pkg.delivery_id]
  );

  const shipmentPackages = allPkgsRes.rows;
  const totalGrossWeight = shipmentPackages.reduce((sum, p) => sum + parseFloat(p.gross_weight), 0);
  const totalNetWeight = shipmentPackages.reduce((sum, p) => sum + parseFloat(p.net_weight), 0);
  const totalUnits = shipmentPackages.reduce((sum, p) => sum + parseFloat(p.units_count), 0);

  return {
    document_type: 'BILL_OF_LADING',
    document_number: `BOL-${pkg.package_number}`,
    title: 'Uniform Straight Bill of Lading',
    bol_date: pkg.dispatched_at || new Date().toISOString(),
    shipper: {
      facility_name: `Stockyard Logistics — ${pkg.warehouse_name}`,
      facility_code: pkg.warehouse_code,
      origin: 'Warehouse Dispatch Dock'
    },
    consignee: {
      customer_name: pkg.customer_name,
      delivery_reference: pkg.delivery_reference,
      destination: 'Customer Receiving'
    },
    carrier_info: {
      carrier_code: pkg.carrier_code || 'UNASSIGNED',
      carrier_name: pkg.carrier_name || 'Carrier Pending Assignment',
      service_level: pkg.service_level || 'Standard Freight',
      pro_tracking_number: pkg.tracking_number || 'LOCAL-STAGE-PENDING',
      is_local_tracking: true
    },
    shipment_summary: {
      total_handling_units: shipmentPackages.length,
      total_pieces: totalUnits,
      total_gross_weight: Math.round(totalGrossWeight * 1000) / 1000,
      total_net_weight: Math.round(totalNetWeight * 1000) / 1000,
      weight_unit: pkg.weight_unit
    },
    handling_units: shipmentPackages.map(hp => ({
      package_number: hp.package_number,
      type: hp.package_type,
      dimensions: `${hp.length}×${hp.width}×${hp.height} ${hp.dimension_unit}`,
      gross_weight: `${hp.gross_weight} ${hp.weight_unit}`,
      net_weight: `${hp.net_weight} ${hp.weight_unit}`,
      pieces: parseFloat(hp.units_count)
    })),
    commodities: pkg.lines.map(l => ({
      description: l.product_name,
      sku: l.product_sku,
      lot_batch: l.lot_number || 'N/A',
      quantity: `${parseFloat(l.packed_qty)} ${l.uom_name}`
    })),
    special_instructions: pkg.notes || 'Handle with standard warehouse care. Deliver Oldest Expiry First (FEFO Certified).',
    certification: 'Shipper certifies that the above-named materials are properly classified, described, packaged, marked, and labeled for outbound transport according to standard freight logistics guidelines.'
  };
}

/**
 * Logistics and shipping dashboard metrics.
 */
async function getShippingDashboardStats() {
  const readyDeliveries = await listReadyDeliveries();
  const readyToPackCount = readyDeliveries.filter(d => !d.packing_complete).length;

  const pkgStatsRes = await query(`
    SELECT 
      COUNT(CASE WHEN status = 'packing' THEN 1 END)::int AS packing_count,
      COUNT(CASE WHEN status = 'packed' THEN 1 END)::int AS packed_count,
      COUNT(CASE WHEN status = 'packed' AND carrier_id IS NOT NULL THEN 1 END)::int AS ready_to_dispatch_count,
      COUNT(CASE WHEN status = 'dispatched' AND dispatched_at::date = CURRENT_DATE THEN 1 END)::int AS dispatched_today_count
    FROM packages;
  `);

  const s = pkgStatsRes.rows[0];

  return {
    deliveries_ready_to_pack: readyToPackCount,
    packages_being_packed: s.packing_count || 0,
    packed_deliveries: s.packed_count || 0,
    ready_to_dispatch: s.ready_to_dispatch_count || 0,
    dispatched_today: s.dispatched_today_count || 0
  };
}

module.exports = {
  listReadyDeliveries,
  createPackage,
  listPackages,
  getPackageById,
  addPackageLine,
  updatePackageLine,
  removePackageLine,
  packPackage,
  cancelPackage,
  assignCarrier,
  dispatchPackage,
  getPackingSlipData,
  getBillOfLadingData,
  getShippingDashboardStats
};
