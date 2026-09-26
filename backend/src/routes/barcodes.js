const express = require('express');
const barcodeService = require('../services/barcodeService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager, requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/barcodes/lookup?code=...
 * Centralized barcode scanner resolution endpoint.
 */
router.get('/lookup', requireStaffOrManager, async (req, res, next) => {
  try {
    const result = await barcodeService.lookupBarcode(req.query.code);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/barcodes/assign
 * Assign or update a barcode for product, location, or lot.
 * Enforces uniqueness across system. Manager only.
 */
router.post('/assign', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await barcodeService.assignBarcode(req.body, req.user.id, ipAddress);
    res.status(200).json({
      success: true,
      message: 'Barcode successfully assigned.',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/barcodes/location-inventory/:locationId
 * Retrieves on-hand theoretical stock quants for a location to facilitate cycle count audits.
 */
router.get('/location-inventory/:locationId', requireStaffOrManager, async (req, res, next) => {
  try {
    const result = await barcodeService.getLocationInventoryForCycleCount(req.params.locationId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
