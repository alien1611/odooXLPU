const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { AppError } = require('./authService');

/**
 * Retrieve all product categories with parent relationship details and product counts.
 */
async function listCategories() {
  const sql = `
    SELECT 
      c.id, 
      c.name, 
      c.parent_id, 
      p.name AS parent_name,
      c.description, 
      c.created_at, 
      c.updated_at,
      COUNT(prod.id)::int AS product_count
    FROM categories c
    LEFT JOIN categories p ON c.parent_id = p.id
    LEFT JOIN products prod ON prod.category_id = c.id
    GROUP BY c.id, c.name, c.parent_id, p.name, c.description, c.created_at, c.updated_at
    ORDER BY c.name ASC;
  `;
  const res = await query(sql);
  return res.rows;
}

/**
 * Create a new product category.
 */
async function createCategory({ name, parent_id = null, description = null }, userId, ipAddress = null) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new AppError('Category name is required.', 400, 'VALIDATION_ERROR');
  }

  const cleanName = name.trim();

  // Check duplicate category name (case-insensitive)
  const dupCheck = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [cleanName]);
  if (dupCheck.rows.length > 0) {
    throw new AppError(`A category with the name "${cleanName}" already exists.`, 409, 'DUPLICATE_CATEGORY');
  }

  // Validate parent_id if provided
  let validParentId = null;
  if (parent_id) {
    const parentCheck = await query('SELECT id FROM categories WHERE id = $1', [parent_id]);
    if (parentCheck.rows.length === 0) {
      throw new AppError('Parent category not found. Please select a valid category.', 400, 'INVALID_FOREIGN_KEY');
    }
    validParentId = parent_id;
  }

  const insertSql = `
    INSERT INTO categories (name, parent_id, description, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id, name, parent_id, description, created_at;
  `;
  const res = await query(insertSql, [cleanName, validParentId, description ? description.trim() : null]);
  const newCategory = res.rows[0];

  // Audit Log
  await logAudit({
    userId,
    action: 'CREATE',
    entityType: 'categories',
    entityId: newCategory.id,
    newValues: newCategory,
    ipAddress
  });

  return newCategory;
}

module.exports = {
  listCategories,
  createCategory
};
