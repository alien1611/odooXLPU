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
const reorderRoutes = require('./reorders');
const expiryRoutes = require('./expiry');
const valuationRoutes = require('./valuation');
const barcodeRoutes = require('./barcodes');
const waveRoutes = require('./waves');
const replenishmentRoutes = require('./replenishment');
const crossDockRoutes = require('./crossDock');
const carrierRoutes = require('./carriers');
const packageRoutes = require('./packages');

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

// Intelligence & Analytics routes (Phase 4)
router.use('/reorders', reorderRoutes);
router.use('/expiry', expiryRoutes);
router.use('/valuation', valuationRoutes);

// Barcode & Warehouse Operations routes (Phase 5)
router.use('/barcodes', barcodeRoutes);

// Advanced Warehouse Logistics & Wave Management (Phase 6)
router.use('/waves', waveRoutes);
router.use('/replenishment', replenishmentRoutes);
router.use('/cross-dock', crossDockRoutes);

// Shipping, Cartonization & Carrier Integrations (Phase 7)
router.use('/carriers', carrierRoutes);
router.use('/packages', packageRoutes);

module.exports = router;

