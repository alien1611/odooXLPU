const express = require('express');
const router = express.Router();
const carrierService = require('../services/carrierService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);

/**
 * GET /api/carriers - List carriers
 */
router.get('/', async (req, res, next) => {
  try {
    const { active_only } = req.query;
    const carriers = await carrierService.listCarriers({ active_only: active_only === 'true' });
    res.json({
      success: true,
      count: carriers.length,
      data: carriers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/carriers - Create carrier (manager only)
 */
router.post('/', requireRole('inventory_manager'), async (req, res, next) => {
  try {
    const carrier = await carrierService.createCarrier(req.body, req.user.id, req.ip);
    res.status(201).json({
      success: true,
      message: `Carrier ${carrier.carrier_name} created successfully.`,
      data: carrier
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/carriers/:id - Update carrier (manager only)
 */
router.patch('/:id', requireRole('inventory_manager'), async (req, res, next) => {
  try {
    const carrier = await carrierService.updateCarrier(req.params.id, req.body, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Carrier ${carrier.carrier_name} updated successfully.`,
      data: carrier
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
