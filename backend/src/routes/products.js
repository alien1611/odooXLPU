const express = require('express');
const productService = require('../services/productService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/products
 * Query params: ?search=...&category_id=...
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, category_id } = req.query;
    const categoryIdNum = category_id ? parseInt(category_id, 10) : null;
    const products = await productService.listProducts({
      search,
      category_id: categoryIdNum
    });
    res.status(200).json({
      success: true,
      data: products
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const product = await productService.createProduct(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
