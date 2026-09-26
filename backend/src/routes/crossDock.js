const express = require('express');
const router = express.Router();
const crossDockService = require('../services/crossDockService');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

/**
 * GET /api/cross-dock - List cross-docking alerts
 */
router.get('/', async (req, res, next) => {
  try {
    const { warehouse_id, status } = req.query;
    const alerts = await crossDockService.listCrossDockAlerts({ warehouse_id, status });
    res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cross-dock/scan - Scan and detect cross-docking opportunities
 */
router.post('/scan', async (req, res, next) => {
  try {
    const { warehouse_id } = req.body;
    const result = await crossDockService.scanAllCrossDockOpportunities(
      { warehouse_id },
      req.user.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/cross-dock/:id - Get cross-dock alert detail
 */
router.get('/:id', async (req, res, next) => {
  try {
    const alert = await crossDockService.getCrossDockAlertById(req.params.id);
    res.json({
      success: true,
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cross-dock/:id/acknowledge - Acknowledge cross-dock alert
 */
router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const result = await crossDockService.acknowledgeCrossDockAlert(
      req.params.id,
      req.user.id,
      req.ip
    );
    const updated = await crossDockService.getCrossDockAlertById(req.params.id);
    res.json({
      success: true,
      message: result.message,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/cross-dock/:id/dismiss - Dismiss cross-dock alert
 */
router.post('/:id/dismiss', async (req, res, next) => {
  try {
    const result = await crossDockService.dismissCrossDockAlert(
      req.params.id,
      req.user.id,
      req.ip
    );
    const updated = await crossDockService.getCrossDockAlertById(req.params.id);
    res.json({
      success: true,
      message: result.message,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
