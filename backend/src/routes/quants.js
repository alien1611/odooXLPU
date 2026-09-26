const express = require('express');
const { listQuants } = require('../services/stockQuantService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/quants
 * List on-hand inventory breakdown by product, warehouse, location, and lot.
 */
router.get('/', async (req, res, next) => {
  try {
    const { product_id, warehouse_id, location_id } = req.query;
    const quants = await listQuants({
      productId: product_id ? parseInt(product_id, 10) : null,
      warehouseId: warehouse_id ? parseInt(warehouse_id, 10) : null,
      locationId: location_id ? parseInt(location_id, 10) : null
    });

    res.status(200).json({
      success: true,
      data: quants
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
