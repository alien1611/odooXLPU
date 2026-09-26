const express = require('express');
const receiptService = require('../services/receiptService');
const { authenticateToken } = require('../middleware/auth');
const { requireStaffOrManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/receipts
 */
router.get('/', async (req, res, next) => {
  try {
    const receipts = await receiptService.listReceipts({ status: req.query.status });
    res.status(200).json({
      success: true,
      data: receipts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/receipts/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const receipt = await receiptService.getReceiptById(req.params.id);
    res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/receipts
 * Inbound goods receipt processing
 */
router.post('/', requireStaffOrManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await receiptService.createReceipt(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
