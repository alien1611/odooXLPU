const express = require('express');
const { testConnection } = require('../db/pool');

const router = express.Router();

/**
 * GET /api/health
 * Returns system health status and database connectivity details.
 */
router.get('/', async (req, res) => {
  const dbHealth = await testConnection();

  res.status(200).json({
    status: 'ok',
    service: 'stockyard-api',
    database: dbHealth.ok ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
