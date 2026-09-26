const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const categoryRoutes = require('./categories');
const uomRoutes = require('./uom');
const warehouseRoutes = require('./warehouses');
const locationRoutes = require('./locations');
const productRoutes = require('./products');

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

module.exports = router;
