const express = require('express');
const authService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/signup
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.signup({ name, email, password, role }, ipAddress);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.login({ email, password }, ipAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/request-otp
 */
router.post('/request-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.requestOtp({ email }, ipAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.resetPassword({ email, otp, new_password }, ipAddress);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns authenticated user profile from token
 */
router.get('/me', authenticateToken, async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        name: req.user.full_name
      }
    }
  });
});

module.exports = router;
