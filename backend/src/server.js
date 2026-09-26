const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiRoutes = require('./routes');
const { testConnection } = require('./db/pool');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes
app.use('/api', apiRoutes);

// 404 Handler for unmatched routes
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, async () => {
  console.log(`========================================`);
  console.log(` Stockyard ERP API Server`);
  console.log(` Listening on http://localhost:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================`);

  // Non-blocking initial database connectivity check
  const dbStatus = await testConnection();
  if (dbStatus.ok) {
    console.log(`[DATABASE] Connected to PostgreSQL successfully.`);
  } else {
    console.warn(`[DATABASE] Warning: PostgreSQL connection not established (${dbStatus.error}).`);
    console.warn(`[DATABASE] Ensure PostgreSQL is running and DATABASE_URL is configured in .env`);
  }
});

module.exports = { app, server };
