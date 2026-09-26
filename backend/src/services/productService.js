const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { AppError } = require('./authService');

/**
 * List products with category and UoM references.
 */
async function listProducts({ search = '', category_id = null } = {}) {
  let sql = `
    SELECT 
      p.id, 
      p.sku, 
      p.name, 
      p.barcode, 
      p.category_id, 
      c.name AS category_name,
      p.uom_id, 
      u.name AS uom_name,
      u.code AS uom_code,
      p.tracking_type, 
      p.cost_price, 
      p.sale_price, 
      p.reorder_point, 
      p.lead_time_days, 
      p.min_stock_level,
      p.is_active, 
      p.created_at, 
      p.updated_at,
      COALESCE(SUM(sq.quantity), 0) AS on_hand_qty,
      COALESCE(SUM(sq.reserved_quantity), 0) AS reserved_qty
    FROM products p
    JOIN uom u ON p.uom_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock_quants sq ON sq.product_id = p.id
  `;

  const whereClauses = [];
  const params = [];

  if (search && search.trim().length > 0) {
    params.push(`%${search.trim().toLowerCase()}%`);
    whereClauses.push(`(LOWER(p.name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length} OR LOWER(COALESCE(p.barcode, '')) LIKE $${params.length})`);
  }

  if (category_id) {
    params.push(category_id);
    whereClauses.push(`p.category_id = $${params.length}`);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += `
    GROUP BY p.id, p.sku, p.name, p.barcode, p.category_id, c.name, p.uom_id, u.name, u.code, p.tracking_type, p.cost_price, p.sale_price, p.reorder_point, p.lead_time_days, p.min_stock_level, p.is_active, p.created_at, p.updated_at
    ORDER BY p.name ASC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

/**
 * Create a new product with strict validation and foreign key integrity.
 */
async function createProduct({
  name,
  sku,
  barcode = null,
  category_id = null,
  uom_id,
  tracking_type = 'none',
  cost_price = 0,
  sale_price = 0,
  reorder_point = 0,
  lead_time_days = 0,
  min_stock_level = null,
  max_stock_level = null
}, userId, ipAddress = null) {
  // 1. Validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError('Product name is required.', 400, 'VALIDATION_ERROR');
  }

  // 2. Validate sku
  if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
    throw new AppError('Product SKU is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanName = name.trim();
  const cleanSku = sku.trim().toUpperCase();

  // 3. Unique SKU check
  const dupSku = await query('SELECT id FROM products WHERE UPPER(sku) = UPPER($1)', [cleanSku]);
  if (dupSku.rows.length > 0) {
    throw new AppError(`A product with SKU "${cleanSku}" already exists.`, 409, 'DUPLICATE_SKU');
  }

  // 4. Validate UoM FK
  if (!uom_id) {
    throw new AppError('uom_id is required.', 400, 'VALIDATION_ERROR');
  }
  const uomCheck = await query('SELECT id FROM uom WHERE id = $1', [uom_id]);
  if (uomCheck.rows.length === 0) {
    throw new AppError('Unit of Measure (uom_id) not found. Invalid foreign key reference.', 400, 'INVALID_FOREIGN_KEY');
  }

  // 5. Validate Category FK if provided
  let validCategoryId = null;
  if (category_id) {
    const catCheck = await query('SELECT id FROM categories WHERE id = $1', [category_id]);
    if (catCheck.rows.length === 0) {
      throw new AppError('Category (category_id) not found. Invalid foreign key reference.', 400, 'INVALID_FOREIGN_KEY');
    }
    validCategoryId = category_id;
  }

  // 6. Validate numerical metrics
  const cleanReorderPoint = parseFloat(reorder_point) || 0;
  if (cleanReorderPoint < 0) {
    throw new AppError('reorder_point must be greater than or equal to 0.', 400, 'VALIDATION_ERROR');
  }

  const cleanLeadTime = parseInt(lead_time_days, 10) || 0;
  if (cleanLeadTime < 0) {
    throw new AppError('lead_time_days must be greater than or equal to 0.', 400, 'VALIDATION_ERROR');
  }

  const cleanCostPrice = parseFloat(cost_price) || 0;
  if (cleanCostPrice < 0) {
    throw new AppError('cost_price must be greater than or equal to 0.', 400, 'VALIDATION_ERROR');
  }

  const cleanSalePrice = parseFloat(sale_price) || 0;
  if (cleanSalePrice < 0) {
    throw new AppError('sale_price must be greater than or equal to 0.', 400, 'VALIDATION_ERROR');
  }

  const cleanTrackingType = tracking_type === 'lot' ? 'lot' : 'none';
  const cleanMinStock = min_stock_level !== null ? parseFloat(min_stock_level) : cleanReorderPoint;

  const insertSql = `
    INSERT INTO products (
      name, sku, barcode, category_id, uom_id, tracking_type,
      cost_price, sale_price, reorder_point, lead_time_days,
      min_stock_level, max_stock_level, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, TRUE, NOW(), NOW()
    )
    RETURNING 
      id, name, sku, barcode, category_id, uom_id, tracking_type,
      cost_price, sale_price, reorder_point, lead_time_days,
      min_stock_level, is_active, created_at;
  `;

  const values = [
    cleanName,
    cleanSku,
    barcode ? barcode.trim() : null,
    validCategoryId,
    uom_id,
    cleanTrackingType,
    cleanCostPrice,
    cleanSalePrice,
    cleanReorderPoint,
    cleanLeadTime,
    cleanMinStock,
    max_stock_level ? parseFloat(max_stock_level) : null
  ];

  const res = await query(insertSql, values);
  const newProduct = res.rows[0];

  // Audit Log
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'products',
    entityId: newProduct.id,
    newValues: newProduct,
    ipAddress
  });

  return newProduct;
}

module.exports = {
  listProducts,
  createProduct
};
