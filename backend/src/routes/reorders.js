const express = require('express');
const reorderService = require('../services/reorderService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager, requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/reorders/suggestions
 * List all reorder suggestions with optional status, warehouse, and product filters.
 */
router.get('/suggestions', requireStaffOrManager, async (req, res, next) => {
  try {
    const suggestions = await reorderService.listReorderSuggestions({
      status: req.query.status,
      warehouseId: req.query.warehouse_id,
      productId: req.query.product_id
    });
    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reorders/analysis
 * Preview consumption-based calculation & days remaining without persisting.
 */
router.get('/analysis', requireStaffOrManager, async (req, res, next) => {
  try {
    const analysis = await reorderService.calculateConsumptionAndReorder({
      warehouseId: req.query.warehouse_id,
      productId: req.query.product_id
    });
    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reorders/generate
 * Generates automated replenishment suggestions based on 30-day consumption ledger.
 * Manager only.
 */
router.post('/generate', requireManager, async (req, res, next) => {
  try {
    const generated = await reorderService.generateReorderSuggestions({
      warehouseId: req.body.warehouse_id,
      userId: req.user.id
    });
    res.status(200).json({
      success: true,
      message: `Generated/updated ${generated.length} reorder suggestion(s).`,
      data: generated
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/reorders/:id
 * Get details of a single reorder suggestion.
 */
router.get('/:id', requireStaffOrManager, async (req, res, next) => {
  try {
    const suggestion = await reorderService.getReorderSuggestionById(req.params.id);
    res.status(200).json({
      success: true,
      data: suggestion
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reorders/:id/approve
 * Approves a reorder suggestion: Creates a DRAFT inbound receipt (no inventory changes).
 * Manager only.
 */
router.post('/:id/approve', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await reorderService.approveReorderSuggestion(req.params.id, req.user.id, ipAddress);
    res.status(200).json({
      success: true,
      message: 'Reorder suggestion approved. Draft inbound receipt created.',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/reorders/:id/dismiss
 * Dismisses a reorder suggestion.
 * Manager only.
 */
router.post('/:id/dismiss', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const dismissed = await reorderService.dismissReorderSuggestion(req.params.id, req.user.id, ipAddress);
    res.status(200).json({
      success: true,
      message: 'Reorder suggestion dismissed.',
      data: dismissed
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
