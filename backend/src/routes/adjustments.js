const express = require('express');
const adjustmentService = require('../services/adjustmentService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/adjustments
 */
router.get('/', async (req, res, next) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
    const adjustments = await adjustmentService.listAdjustments({ productId });
    res.status(200).json({
      success: true,
      data: adjustments
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/adjustments
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await adjustmentService.createAdjustment(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
