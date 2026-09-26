const express = require('express');
const { listStockMoves } = require('../services/stockMoveService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/moves
 * Query the immutable single source of truth stock moves ledger.
 */
router.get('/', async (req, res, next) => {
  try {
    const { product_id, move_type, origin_document, limit, offset } = req.query;
    const moves = await listStockMoves({
      productId: product_id ? parseInt(product_id, 10) : null,
      moveType: move_type || null,
      originDocument: origin_document || null,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0
    });

    res.status(200).json({
      success: true,
      data: moves
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
