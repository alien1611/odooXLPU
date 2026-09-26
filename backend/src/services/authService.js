const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db/pool');
const { logAudit } = require('./auditService');
const { JWT_SECRET } = require('../middleware/auth');

const ALLOWED_ROLES = ['inventory_manager', 'warehouse_staff'];

/**
 * Custom AppError helper for predictable HTTP statuses and codes
 */
class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Register a new user account.
 */
async function signup({ name, email, password, role }, ipAddress = null) {
  // 1. Validation
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new AppError('Full name must be at least 2 characters long.', 400, 'VALIDATION_ERROR');
  }

  if (!email || typeof email !== 'string') {
    throw new AppError('Email address is required.', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new AppError('A valid email address is required.', 400, 'VALIDATION_ERROR');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400, 'VALIDATION_ERROR');
  }

  if (!role || !ALLOWED_ROLES.includes(role)) {
    throw new AppError(
      `Role must be one of: ${ALLOWED_ROLES.join(', ')}.`,
      400,
      'VALIDATION_ERROR'
    );
  }

  // 2. Duplicate email check
  const existingRes = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingRes.rows.length > 0) {
    throw new AppError('An account with this email address already exists.', 409, 'DUPLICATE_EMAIL');
  }

  // 3. Hash password with bcrypt
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Insert user
  const insertSql = `
    INSERT INTO users (full_name, email, password_hash, role, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
    RETURNING id, full_name, email, role, is_active, created_at;
  `;
  const insertRes = await query(insertSql, [name.trim(), normalizedEmail, passwordHash, role]);
  const user = insertRes.rows[0];

  // 5. Audit Log
  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'users',
    entityId: user.id,
    newValues: { email: user.email, role: user.role, full_name: user.full_name },
    ipAddress
  });

  // 6. Generate JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role
    },
    token
  };
}

/**
 * Authenticate user credentials and return JWT.
 */
async function login({ email, password }, ipAddress = null) {
  if (!email || !password) {
    throw new AppError('Email and password are required.', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const user = userRes.rows[0];

  if (!user.is_active) {
    throw new AppError('Account is deactivated. Please contact your administrator.', 403, 'ACCOUNT_DEACTIVATED');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  // Audit Log
  await logAudit({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'users',
    entityId: user.id,
    ipAddress
  });

  // Generate JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    user: {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role
    },
    token
  };
}

/**
 * Generate Demo Mode 6-digit OTP for password reset.
 */
async function requestOtp({ email }, ipAddress = null) {
  if (!email || typeof email !== 'string') {
    throw new AppError('Email address is required.', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRes = await query('SELECT id, full_name, email FROM users WHERE email = $1', [normalizedEmail]);

  if (userRes.rows.length === 0) {
    throw new AppError('No account found with the provided email address.', 404, 'USER_NOT_FOUND');
  }

  const user = userRes.rows[0];

  // Generate secure 6-digit OTP
  const otpNumber = crypto.randomInt(100000, 999999).toString();
  const tokenHash = await bcrypt.hash(otpNumber, 8);
  const expiresInMinutes = 15;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Invalidate any prior unused OTPs for this user
  await query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);

  // Insert into password_resets table
  const insertSql = `
    INSERT INTO password_resets (user_id, token_hash, otp_code, expires_at, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id;
  `;
  const resetRes = await query(insertSql, [user.id, tokenHash, otpNumber, expiresAt]);

  // Audit Log
  await logAudit({
    userId: user.id,
    action: 'CREATE',
    entityType: 'password_resets',
    entityId: resetRes.rows[0].id,
    ipAddress
  });

  return {
    message: 'OTP generated successfully.',
    demo_otp: otpNumber,
    expires_in_minutes: expiresInMinutes,
    demo_notice: 'Demo Mode — OTP is displayed on-screen and is not sent by email/SMS.'
  };
}

/**
 * Verify OTP and reset password.
 */
async function resetPassword({ email, otp, new_password }, ipAddress = null) {
  if (!email || !otp || !new_password) {
    throw new AppError('Email, OTP code, and new password are required.', 400, 'VALIDATION_ERROR');
  }

  if (typeof new_password !== 'string' || new_password.length < 6) {
    throw new AppError('New password must be at least 6 characters long.', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRes = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

  if (userRes.rows.length === 0) {
    throw new AppError('No account found with the provided email address.', 404, 'USER_NOT_FOUND');
  }

  const user = userRes.rows[0];

  // Retrieve the latest unused OTP record
  const resetRes = await query(
    `SELECT id, token_hash, otp_code, expires_at 
     FROM password_resets 
     WHERE user_id = $1 AND used_at IS NULL 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [user.id]
  );

  if (resetRes.rows.length === 0) {
    throw new AppError('No active password reset request found. Please request a new OTP.', 400, 'INVALID_OTP');
  }

  const resetRecord = resetRes.rows[0];

  // Verify expiry
  if (new Date() > new Date(resetRecord.expires_at)) {
    throw new AppError('The OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
  }

  // Verify OTP matches
  const cleanOtp = otp.toString().trim();
  const directMatch = resetRecord.otp_code && resetRecord.otp_code === cleanOtp;
  const hashMatch = resetRecord.token_hash && (await bcrypt.compare(cleanOtp, resetRecord.token_hash));

  if (!directMatch && !hashMatch) {
    throw new AppError('Invalid OTP code entered.', 400, 'INVALID_OTP');
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(new_password, 10);

  // Update user password and mark OTP used atomically
  await query('BEGIN');
  try {
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );

    await query(
      'UPDATE password_resets SET used_at = NOW() WHERE id = $1',
      [resetRecord.id]
    );

    await query('COMMIT');
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }

  // Audit Log
  await logAudit({
    userId: user.id,
    action: 'RESET_PASSWORD',
    entityType: 'users',
    entityId: user.id,
    ipAddress
  });

  return {
    message: 'Password has been reset successfully. You may now log in with your new password.'
  };
}

module.exports = {
  signup,
  login,
  requestOtp,
  resetPassword,
  AppError,
  ALLOWED_ROLES
};
