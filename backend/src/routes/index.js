const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const categoryRoutes = require('./categories');
const uomRoutes = require('./uom');
const warehouseRoutes = require('./warehouses');
const locationRoutes = require('./locations');
const productRoutes = require('./products');
const receiptRoutes = require('./receipts');
const deliveryRoutes = require('./deliveries');
const transferRoutes = require('./transfers');
const adjustmentRoutes = require('./adjustments');
const quantRoutes = require('./quants');
const moveRoutes = require('./moves');
const lotRoutes = require('./lots');
const auditRoutes = require('./auditLogs');

const router = express.Router();

// System routes
router.use('/health', healthRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Master Data routes
router.use('/categories', categoryRoutes);
router.use('/uom', uomRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/locations', locationRoutes);
router.use('/products', productRoutes);

// Core Stock Engine routes (Phase 3)
router.use('/receipts', receiptRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/transfers', transferRoutes);
router.use('/adjustments', adjustmentRoutes);
router.use('/quants', quantRoutes);
router.use('/moves', moveRoutes);
router.use('/lots', lotRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
