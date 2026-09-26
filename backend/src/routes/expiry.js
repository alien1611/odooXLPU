const express = require('express');
const expiryService = require('../services/expiryService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/expiry/risk
 * Retrieves active lots (quantity > 0) with their expiry risk classification.
 * Filterable by warehouse, location, product, and risk_window ('expired', '7', '30', '60', '90', 'safe', 'all').
 */
router.get('/risk', requireStaffOrManager, async (req, res, next) => {
  try {
    const lots = await expiryService.getExpiryRiskLots({
      warehouseId: req.query.warehouse_id,
      locationId: req.query.location_id,
      productId: req.query.product_id,
      riskWindow: req.query.risk_window || 'all'
    });
    res.status(200).json({
      success: true,
      data: lots
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/expiry/summary
 * Retrieves overall expiry risk aggregate count and quantity metrics.
 */
router.get('/summary', requireStaffOrManager, async (req, res, next) => {
  try {
    const summary = await expiryService.getExpirySummary({
      warehouseId: req.query.warehouse_id,
      locationId: req.query.location_id,
      productId: req.query.product_id
    });
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
