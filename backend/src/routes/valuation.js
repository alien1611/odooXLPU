const express = require('express');
const valuationService = require('../services/valuationService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/valuation/summary
 * Total inventory valuation from cost_layers: SUM(remaining_qty * unit_cost).
 */
router.get('/summary', requireStaffOrManager, async (req, res, next) => {
  try {
    const summary = await valuationService.getValuationSummary({
      warehouseId: req.query.warehouse_id
    });
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/valuation/products
 * Product-level inventory valuation breakdown and weighted-average unit costs.
 */
router.get('/products', requireStaffOrManager, async (req, res, next) => {
  try {
    const products = await valuationService.getProductValuation({
      categoryId: req.query.category_id,
      search: req.query.search
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
 * GET /api/valuation/layers/:productId
 * Cost layer breakdown for a specific product.
 */
router.get('/layers/:productId', requireStaffOrManager, async (req, res, next) => {
  try {
    const layers = await valuationService.getCostLayersByProduct(req.params.productId);
    res.status(200).json({
      success: true,
      data: layers
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
