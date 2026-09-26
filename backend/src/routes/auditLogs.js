const express = require('express');
const auditService = require('../services/auditService');
const { authenticateToken } = require('../middleware/auth');
const { requireManager } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

/**
 * GET /api/audit-logs
 * Requires inventory_manager or admin
 */
router.get('/', requireManager, async (req, res, next) => {
  try {
    const { entity_type, limit } = req.query;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const logs = await auditService.listAuditLogs({
      entityType: entity_type || null,
      limit: limitNum
    });
    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
