const { query } = require('../db/pool');

/**
 * Inventory Valuation Service.
 * Evaluates current inventory valuation using active cost layers.
 * Core formula: SUM(cost_layers.remaining_qty * cost_layers.unit_cost)
 * Employs PostgreSQL NUMERIC arithmetic.
 */

/**
 * Retrieves aggregate inventory valuation summary.
 * Reconciles directly with active cost layers (remaining_qty > 0).
 *
 * @param {Object} [options]
 * @param {number|null} [options.warehouseId]
 */
async function getValuationSummary({ warehouseId = null } = {}) {
  // If warehouseId is provided, we can join with stock_moves -> locations to filter
  let sql = `
    SELECT 
      COALESCE(SUM(cl.remaining_qty * cl.unit_cost), 0)::NUMERIC(15, 2) AS total_inventory_value,
      COALESCE(SUM(cl.remaining_qty), 0)::NUMERIC(15, 4) AS total_quantity,
      COUNT(cl.id)::INT AS active_layers_count,
      COUNT(DISTINCT cl.product_id)::INT AS total_products_count
    FROM cost_layers cl
    WHERE cl.remaining_qty > 0
  `;
  const params = [];

  if (warehouseId) {
    sql = `
      SELECT 
        COALESCE(SUM(cl.remaining_qty * cl.unit_cost), 0)::NUMERIC(15, 2) AS total_inventory_value,
        COALESCE(SUM(cl.remaining_qty), 0)::NUMERIC(15, 4) AS total_quantity,
        COUNT(cl.id)::INT AS active_layers_count,
        COUNT(DISTINCT cl.product_id)::INT AS total_products_count
      FROM cost_layers cl
      LEFT JOIN stock_moves sm ON cl.stock_move_id = sm.id
      LEFT JOIN locations loc ON sm.dest_location_id = loc.id
      WHERE cl.remaining_qty > 0
        AND loc.warehouse_id = $1
    `;
    params.push(parseInt(warehouseId, 10));
  }

  const { rows } = await query(sql, params);
  const row = rows[0] || {};

  return {
    total_inventory_value: parseFloat(row.total_inventory_value || 0),
    total_quantity: parseFloat(row.total_quantity || 0),
    active_layers_count: parseInt(row.active_layers_count || 0, 10),
    total_products_count: parseInt(row.total_products_count || 0, 10)
  };
}

/**
 * Retrieves valuation broken down by product.
 * Compares current weighted average cost (p.cost_price) with layer-summed valuation.
 *
 * @param {Object} [options]
 * @param {number|null} [options.categoryId]
 * @param {string|null} [options.search]
 */
async function getProductValuation({ categoryId = null, search = null } = {}) {
  let sql = `
    SELECT 
      p.id AS product_id,
      p.sku,
      p.name AS product_name,
      p.category_id,
      c.name AS category_name,
      p.uom_id,
      u.code AS uom_code,
      p.tracking_type,
      p.cost_price AS weighted_average_cost,
      p.sale_price,
      COALESCE(SUM(cl.remaining_qty), 0)::NUMERIC(15, 4) AS total_quantity,
      COALESCE(SUM(cl.remaining_qty * cl.unit_cost), 0)::NUMERIC(15, 2) AS total_inventory_value,
      COUNT(cl.id)::INT AS active_layers_count
    FROM products p
    JOIN uom u ON p.uom_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN cost_layers cl ON p.id = cl.product_id AND cl.remaining_qty > 0
    WHERE p.is_active = TRUE
  `;
  const params = [];

  if (categoryId) {
    params.push(parseInt(categoryId, 10));
    sql += ` AND p.category_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
  }

  sql += `
    GROUP BY p.id, p.sku, p.name, p.category_id, c.name, p.uom_id, u.code, p.tracking_type, p.cost_price, p.sale_price
    ORDER BY total_inventory_value DESC, p.name ASC;
  `;

  const { rows } = await query(sql, params);
  return rows.map(r => ({
    product_id: parseInt(r.product_id, 10),
    sku: r.sku,
    product_name: r.product_name,
    category_id: r.category_id ? parseInt(r.category_id, 10) : null,
    category_name: r.category_name,
    uom_id: parseInt(r.uom_id, 10),
    uom_code: r.uom_code,
    tracking_type: r.tracking_type,
    weighted_average_cost: parseFloat(r.weighted_average_cost || 0),
    sale_price: parseFloat(r.sale_price || 0),
    total_quantity: parseFloat(r.total_quantity || 0),
    total_inventory_value: parseFloat(r.total_inventory_value || 0),
    active_layers_count: parseInt(r.active_layers_count || 0, 10)
  }));
}

/**
 * Retrieves the specific active cost layers for a given product.
 *
 * @param {number} productId
 */
async function getCostLayersByProduct(productId) {
  const pId = parseInt(productId, 10);
  const sql = `
    SELECT 
      cl.id AS layer_id,
      cl.product_id,
      cl.stock_move_id,
      sm.origin_document,
      cl.initial_qty,
      cl.remaining_qty,
      cl.unit_cost,
      (cl.remaining_qty * cl.unit_cost)::NUMERIC(15, 2) AS layer_value,
      cl.created_at
    FROM cost_layers cl
    LEFT JOIN stock_moves sm ON cl.stock_move_id = sm.id
    WHERE cl.product_id = $1 AND cl.remaining_qty > 0
    ORDER BY cl.created_at ASC, cl.id ASC;
  `;
  const { rows } = await query(sql, [pId]);
  return rows.map(r => ({
    layer_id: parseInt(r.layer_id, 10),
    product_id: parseInt(r.product_id, 10),
    stock_move_id: r.stock_move_id ? parseInt(r.stock_move_id, 10) : null,
    origin_document: r.origin_document,
    initial_qty: parseFloat(r.initial_qty),
    remaining_qty: parseFloat(r.remaining_qty),
    unit_cost: parseFloat(r.unit_cost),
    layer_value: parseFloat(r.layer_value),
    created_at: r.created_at
  }));
}

module.exports = {
  getValuationSummary,
  getProductValuation,
  getCostLayersByProduct
};
