const express = require('express');
const deliveryService = require('../services/deliveryService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/deliveries
 */
router.get('/', async (req, res, next) => {
  try {
    const deliveries = await deliveryService.listDeliveries({ status: req.query.status });
    res.status(200).json({
      success: true,
      data: deliveries
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/deliveries/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const delivery = await deliveryService.getDeliveryById(req.params.id);
    res.status(200).json({
      success: true,
      data: delivery
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/deliveries
 * Outbound delivery order fulfillment with FEFO allocation
 */
router.post('/', requireStaffOrManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await deliveryService.createDelivery(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
