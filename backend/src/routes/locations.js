const express = require('express');
const locationService = require('../services/locationService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/locations
 * Query params: ?warehouse_id=...
 */
router.get('/', async (req, res, next) => {
  try {
    const warehouseId = req.query.warehouse_id ? parseInt(req.query.warehouse_id, 10) : null;
    const locations = await locationService.listLocations(warehouseId);
    res.status(200).json({
      success: true,
      data: locations
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/locations
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const location = await locationService.createLocation(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: location
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
