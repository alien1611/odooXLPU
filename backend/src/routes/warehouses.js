const express = require('express');
const warehouseService = require('../services/warehouseService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/warehouses
 */
router.get('/', async (req, res, next) => {
  try {
    const warehouses = await warehouseService.listWarehouses();
    res.status(200).json({
      success: true,
      data: warehouses
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/warehouses
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const warehouse = await warehouseService.createWarehouse(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: warehouse
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
