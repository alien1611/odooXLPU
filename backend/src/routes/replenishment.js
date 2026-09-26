const express = require('express');
const router = express.Router();
const replenishmentService = require('../services/replenishmentService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);

/**
 * GET /api/replenishment - List replenishment tasks
 */
router.get('/', async (req, res, next) => {
  try {
    const { warehouse_id, status } = req.query;
    const tasks = await replenishmentService.listReplenishmentTasks({ warehouse_id, status });
    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/replenishment/configs - List forward bin configurations
 */
router.get('/configs', async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;
    const configs = await replenishmentService.listReplenishmentConfigs({ warehouse_id });
    res.json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/replenishment/configs - Save forward bin threshold config
 */
router.post('/configs', requireRole('inventory_manager'), async (req, res, next) => {
  try {
    const config = await replenishmentService.setReplenishmentConfig(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Replenishment configuration saved successfully.',
      data: config
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/replenishment/generate - Scan forward bins and compute replenishment tasks
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { warehouse_id } = req.body;
    const result = await replenishmentService.generateReplenishmentTasks(
      { warehouse_id },
      req.user.id,
      req.ip
    );
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/replenishment/:id - Get replenishment task detail
 */
router.get('/:id', async (req, res, next) => {
  try {
    const task = await replenishmentService.getReplenishmentTaskById(req.params.id);
    res.json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/replenishment/:id/execute - Execute replenishment transfer
 */
router.post('/:id/execute', async (req, res, next) => {
  try {
    const { source_location_id, lot_id, quantity, transfer_quantity } = req.body;
    const result = await replenishmentService.executeReplenishment(
      req.params.id,
      { source_location_id, lot_id, quantity: quantity || transfer_quantity },
      req.user.id,
      req.ip
    );
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/replenishment/:id/dismiss - Dismiss replenishment suggestion
 */
router.post('/:id/dismiss', async (req, res, next) => {
  try {
    const result = await replenishmentService.dismissReplenishment(req.params.id, req.user.id, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
