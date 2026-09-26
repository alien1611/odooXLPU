const express = require('express');
const router = express.Router();
const waveService = require('../services/waveService');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);

/**
 * GET /api/waves - List pick waves
 */
router.get('/', async (req, res, next) => {
  try {
    const { warehouse_id, status } = req.query;
    const waves = await waveService.listWaves({ warehouse_id, status });
    res.json({
      success: true,
      count: waves.length,
      data: waves
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves - Create a new pick wave
 */
router.post('/', async (req, res, next) => {
  try {
    const { warehouse_id, notes, delivery_ids } = req.body;
    const wave = await waveService.createWave(
      { warehouse_id, notes, delivery_ids },
      req.user.id,
      req.ip
    );
    res.status(201).json({
      success: true,
      message: `Pick wave ${wave.wave_number} created successfully.`,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/waves/:id - Get wave details, deliveries, and location picking sequence
 */
router.get('/:id', async (req, res, next) => {
  try {
    const wave = await waveService.getWaveById(req.params.id);
    res.json({
      success: true,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves/:id/release - Release draft wave to floor
 */
router.post('/:id/release', async (req, res, next) => {
  try {
    const wave = await waveService.releaseWave(req.params.id, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Wave ${wave.wave_number} released for warehouse picking.`,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves/:id/start - Start picking wave
 */
router.post('/:id/start', async (req, res, next) => {
  try {
    const wave = await waveService.startWave(req.params.id, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Wave ${wave.wave_number} picking in progress.`,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves/:id/complete - Complete wave picking & execute FEFO delivery allocations
 */
router.post('/:id/complete', async (req, res, next) => {
  try {
    const wave = await waveService.completeWave(req.params.id, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Wave ${wave.wave_number} completed and all order deliveries fulfilled.`,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves/:id/cancel - Cancel wave and detach orders
 */
router.post('/:id/cancel', requireRole('inventory_manager'), async (req, res, next) => {
  try {
    const wave = await waveService.cancelWave(req.params.id, req.user.id, req.ip);
    res.json({
      success: true,
      message: `Wave ${wave.wave_number} cancelled.`,
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/waves/:id/deliveries - Add eligible deliveries to wave
 */
router.post('/:id/deliveries', async (req, res, next) => {
  try {
    const { delivery_ids } = req.body;
    const wave = await waveService.addDeliveriesToWave(req.params.id, delivery_ids, req.user.id, req.ip);
    res.json({
      success: true,
      message: 'Deliveries added to wave successfully.',
      data: wave
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/waves/:id/deliveries/:deliveryId - Remove delivery from wave
 */
router.delete('/:id/deliveries/:deliveryId', async (req, res, next) => {
  try {
    const result = await waveService.removeDeliveryFromWave(
      req.params.id,
      req.params.deliveryId,
      req.user.id,
      req.ip
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
