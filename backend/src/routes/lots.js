const express = require('express');
const { query } = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/lots
 * Query lots with product details, expiry dates, and current on-hand quantities.
 */
router.get('/', async (req, res, next) => {
  try {
    const { product_id } = req.query;
    let sql = `
      SELECT 
        l.id,
        l.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        l.lot_number,
        l.expiry_date,
        l.alert_date,
        l.removal_date,
        l.created_at,
        COALESCE(SUM(sq.quantity), 0) AS total_on_hand,
        COALESCE(SUM(sq.reserved_quantity), 0) AS total_reserved,
        COALESCE(SUM(sq.quantity - sq.reserved_quantity), 0) AS available_quantity,
        CASE 
          WHEN l.expiry_date <= NOW() THEN 'expired'
          WHEN l.expiry_date <= NOW() + INTERVAL '30 days' THEN 'near_expiry'
          ELSE 'good'
        END AS expiry_status
      FROM lots l
      JOIN products p ON l.product_id = p.id
      LEFT JOIN stock_quants sq ON sq.lot_id = l.id
    `;

    const params = [];
    if (product_id) {
      params.push(parseInt(product_id, 10));
      sql += ` WHERE l.product_id = $1`;
    }

    sql += `
      GROUP BY l.id, l.product_id, p.name, p.sku, l.lot_number, l.expiry_date, l.alert_date, l.removal_date, l.created_at
      ORDER BY l.expiry_date ASC, l.id ASC;
    `;

    const result = await query(sql, params);
    res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
