const express = require('express');
const router = express.Router();
const packageService = require('../services/packageService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);

/**
 * GET /api/packages/ready-deliveries - List deliveries ready to be packed
 */
router.get('/ready-deliveries', async (req, res, next) => {
  try {
    const { warehouse_id, search } = req.query;
    const deliveries = await packageService.listReadyDeliveries({ warehouse_id, search });
    res.json({
      success: true,
      count: deliveries.length,
      data: deliveries
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/packages/stats - Shipping & logistics dashboard metrics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await packageService.getShippingDashboardStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/packages - List packages
 */
router.get('/', async (req, res, next) => {
  try {
    const { delivery_id, warehouse_id, status, carrier_id } = req.query;
    const packages = await packageService.listPackages({
      delivery_id,
      warehouse_id,
      status,
      carrier_id
    });
    res.json({
      success: true,
      count: packages.length,
      data: packages
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages - Create a new package/carton
 */
router.post('/', async (req, res, next) => {
  try {
    const pkg = await packageService.createPackage(req.body, req.user.id, req.ip);
    res.status(201).json({
      success: true,
      message: `Package ${pkg.package_number} created successfully.`,
      data: pkg
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/packages/:id - Get package details with contents
 */
router.get('/:id', async (req, res, next) => {
  try {
    const pkg = await packageService.getPackageById(req.params.id);
    res.json({
      success: true,
      data: pkg
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages/:id/lines - Add line/item to package
 */
router.post('/:id/lines', async (req, res, next) => {
  try {
    const line = await packageService.addPackageLine(req.params.id, req.body, req.user.id, req.ip);
    res.status(201).json({
      success: true,
      message: 'Item packed into package successfully.',
      data: line
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/packages/:id/lines/:lineId - Update packed quantity
 */
router.patch('/:id/lines/:lineId', async (req, res, next) => {
  try {
    const result = await packageService.updatePackageLine(
      req.params.id,
      req.params.lineId,
      req.body,
      req.user.id,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/packages/:id/lines/:lineId - Remove item from package
 */
router.delete('/:id/lines/:lineId', async (req, res, next) => {
  try {
    const result = await packageService.removePackageLine(
      req.params.id,
      req.params.lineId,
      req.user.id,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages/:id/pack - Mark package as packed (finalizing dimensions and weight)
 */
router.post('/:id/pack', async (req, res, next) => {
  try {
    const pkg = await packageService.packPackage(req.params.id, req.body, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Package ${pkg.package_number} marked as packed. Ready for dispatch.`,
      data: pkg
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages/:id/cancel - Cancel package (manager only)
 */
router.post('/:id/cancel', requireRole('inventory_manager'), async (req, res, next) => {
  try {
    const result = await packageService.cancelPackage(req.params.id, req.user.id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages/:id/assign-carrier - Assign shipping carrier
 */
router.post('/:id/assign-carrier', async (req, res, next) => {
  try {
    const pkg = await packageService.assignCarrier(req.params.id, req.body, req.user.id, req.ip);
    res.json({
      success: true,
      message: 'Carrier assigned successfully.',
      data: pkg
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/packages/:id/dispatch - Dispatch package with carrier tracking
 */
router.post('/:id/dispatch', async (req, res, next) => {
  try {
    const pkg = await packageService.dispatchPackage(req.params.id, req.body, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Package ${pkg.package_number} dispatched successfully via ${pkg.carrier_name} (Tracking: ${pkg.tracking_number}).`,
      data: pkg
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/packages/:id/packing-slip - Packing Slip document data
 */
router.get('/:id/packing-slip', async (req, res, next) => {
  try {
    const doc = await packageService.getPackingSlipData(req.params.id);
    res.json({
      success: true,
      data: doc
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/packages/:id/bill-of-lading - Bill of Lading (BOL) document data
 */
router.get('/:id/bill-of-lading', async (req, res, next) => {
  try {
    const doc = await packageService.getBillOfLadingData(req.params.id);
    res.json({
      success: true,
      data: doc
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
