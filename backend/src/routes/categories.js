const express = require('express');
const categoryService = require('../services/categoryService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/categories
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryService.listCategories();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/categories
 * Requires inventory_manager or admin
 */
router.post('/', requireManager, async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const category = await categoryService.createCategory(req.body, req.user.id, ipAddress);
    res.status(201).json({
      success: true,
      data: category
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
