const express = require('express');
const uomService = require('../services/uomService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/uom
 */
router.get('/', async (req, res, next) => {
  try {
    const units = await uomService.listUom();
    res.status(200).json({
      success: true,
      data: units
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/uom
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const unit = await uomService.createUom(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: unit
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
