const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'stockyard_jwt_secret_dev_key';

/**
 * Authentication middleware that verifies the incoming Bearer JWT token.
 * Attaches decoded user payload { id, email, role, full_name } to req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required. Please log in.'
      }
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MALFORMED_TOKEN',
        message: 'Authorization header must follow "Bearer <token>" format.'
      }
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Authentication session has expired. Please log in again.' : 'Invalid authentication token.'
      }
    });
  }
}

module.exports = {
  authenticateToken,
  JWT_SECRET
};
