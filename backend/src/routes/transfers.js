const express = require('express');
const transferService = require('../services/transferService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/transfers
 */
router.get('/', async (req, res, next) => {
  try {
    const productId = req.query.product_id ? parseInt(req.query.product_id, 10) : null;
    const transfers = await transferService.listTransfers({ productId });
    res.status(200).json({
      success: true,
      data: transfers
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/transfers
 * Internal warehouse stock transfer
 */
router.post('/', requireStaffOrManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await transferService.createTransfer(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
