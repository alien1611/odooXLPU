const { query } = require('../db/pool');

/**
 * Expiry Risk Analytics Service.
 * Evaluates lot-tracked inventory from active stock_quants with quantity > 0.
 * Classifies lots into operational risk windows: expired, <=7d, <=30d, <=60d, <=90d, safe.
 */

/**
 * Retrieves lots with active inventory and their expiry risk classifications.
 *
 * @param {Object} options
 * @param {number|null} [options.warehouseId]
 * @param {number|null} [options.locationId]
 * @param {number|null} [options.productId]
 * @param {string} [options.riskWindow='all'] - 'all', 'expired', '7', '30', '60', '90', 'safe', 'at_risk'
 */
async function getExpiryRiskLots({
  warehouseId = null,
  locationId = null,
  productId = null,
  riskWindow = 'all'
} = {}) {
  let sql = `
    SELECT 
      l.id AS lot_id,
      l.lot_number,
      l.expiry_date,
      l.alert_date,
      l.removal_date,
      p.id AS product_id,
      p.name AS product_name,
      p.sku,
      p.cost_price,
      u.code AS uom_code,
      loc.id AS location_id,
      loc.name AS location_name,
      loc.code AS location_code,
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.code AS warehouse_code,
      sq.quantity,
      (l.expiry_date::date - CURRENT_DATE) AS days_remaining,
      CASE
        WHEN (l.expiry_date::date < CURRENT_DATE) THEN 'expired'
        WHEN (l.expiry_date::date <= CURRENT_DATE + INTERVAL '7 days') THEN 'within_7_days'
        WHEN (l.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days') THEN 'within_30_days'
        WHEN (l.expiry_date::date <= CURRENT_DATE + INTERVAL '60 days') THEN 'within_60_days'
        WHEN (l.expiry_date::date <= CURRENT_DATE + INTERVAL '90 days') THEN 'within_90_days'
        ELSE 'safe'
      END AS risk_classification
    FROM stock_quants sq
    JOIN lots l ON sq.lot_id = l.id
    JOIN products p ON sq.product_id = p.id
    JOIN uom u ON p.uom_id = u.id
    JOIN locations loc ON sq.location_id = loc.id
    JOIN warehouses w ON loc.warehouse_id = w.id
    WHERE sq.quantity > 0 AND loc.type = 'internal'
  `;

  const params = [];

  if (warehouseId) {
    params.push(parseInt(warehouseId, 10));
    sql += ` AND w.id = $${params.length}`;
  }

  if (locationId) {
    params.push(parseInt(locationId, 10));
    sql += ` AND loc.id = $${params.length}`;
  }

  if (productId) {
    params.push(parseInt(productId, 10));
    sql += ` AND p.id = $${params.length}`;
  }

  // Filter by risk window if requested
  if (riskWindow === 'expired') {
    sql += ` AND (l.expiry_date::date < CURRENT_DATE)`;
  } else if (riskWindow === '7' || riskWindow === 'within_7_days') {
    sql += ` AND (l.expiry_date::date >= CURRENT_DATE AND l.expiry_date::date <= CURRENT_DATE + INTERVAL '7 days')`;
  } else if (riskWindow === '30' || riskWindow === 'within_30_days') {
    sql += ` AND (l.expiry_date::date >= CURRENT_DATE AND l.expiry_date::date <= CURRENT_DATE + INTERVAL '30 days')`;
  } else if (riskWindow === '60' || riskWindow === 'within_60_days') {
    sql += ` AND (l.expiry_date::date >= CURRENT_DATE AND l.expiry_date::date <= CURRENT_DATE + INTERVAL '60 days')`;
  } else if (riskWindow === '90' || riskWindow === 'within_90_days') {
    sql += ` AND (l.expiry_date::date >= CURRENT_DATE AND l.expiry_date::date <= CURRENT_DATE + INTERVAL '90 days')`;
  } else if (riskWindow === 'safe') {
    sql += ` AND (l.expiry_date::date > CURRENT_DATE + INTERVAL '90 days')`;
  } else if (riskWindow === 'at_risk') {
    sql += ` AND (l.expiry_date::date <= CURRENT_DATE + INTERVAL '90 days')`;
  }

  // Urgent expiry results sorted by earliest expiry date first
  sql += ` ORDER BY l.expiry_date ASC, sq.quantity DESC;`;

  const { rows } = await query(sql, params);
  return rows.map(r => ({
    ...r,
    quantity: parseFloat(r.quantity),
    days_remaining: parseInt(r.days_remaining, 10),
    cost_price: parseFloat(r.cost_price || 0)
  }));
}

/**
 * Returns overall expiry risk aggregate summary metrics.
 */
async function getExpirySummary({ warehouseId = null, locationId = null, productId = null } = {}) {
  const allLots = await getExpiryRiskLots({ warehouseId, locationId, productId, riskWindow: 'all' });

  let expiredCount = 0;
  let expiredQty = 0;
  let within7DaysCount = 0;
  let within7DaysQty = 0;
  let within30DaysCount = 0;
  let within30DaysQty = 0;
  let within60DaysCount = 0;
  let within60DaysQty = 0;
  let within90DaysCount = 0;
  let within90DaysQty = 0;
  let safeCount = 0;
  let safeQty = 0;

  for (const lot of allLots) {
    const days = lot.days_remaining;
    const qty = lot.quantity;

    if (days < 0) {
      expiredCount++;
      expiredQty += qty;
    } else if (days <= 7) {
      within7DaysCount++;
      within7DaysQty += qty;
    } else if (days <= 30) {
      within30DaysCount++;
      within30DaysQty += qty;
    } else if (days <= 60) {
      within60DaysCount++;
      within60DaysQty += qty;
    } else if (days <= 90) {
      within90DaysCount++;
      within90DaysQty += qty;
    } else {
      safeCount++;
      safeQty += qty;
    }
  }

  const atRiskCount = expiredCount + within7DaysCount + within30DaysCount + within60DaysCount + within90DaysCount;
  const atRiskQty = expiredQty + within7DaysQty + within30DaysQty + within60DaysQty + within90DaysQty;

  return {
    total_lots: allLots.length,
    at_risk_count: atRiskCount,
    at_risk_qty: Math.round(atRiskQty * 100) / 100,
    expired_count: expiredCount,
    expired_qty: Math.round(expiredQty * 100) / 100,
    within_7_days_count: within7DaysCount,
    within_7_days_qty: Math.round(within7DaysQty * 100) / 100,
    within_30_days_count: within30DaysCount,
    within_30_days_qty: Math.round(within30DaysQty * 100) / 100,
    within_60_days_count: within60DaysCount,
    within_60_days_qty: Math.round(within60DaysQty * 100) / 100,
    within_90_days_count: within90DaysCount,
    within_90_days_qty: Math.round(within90DaysQty * 100) / 100,
    safe_count: safeCount,
    safe_qty: Math.round(safeQty * 100) / 100
  };
}

module.exports = {
  getExpiryRiskLots,
  getExpirySummary
};
