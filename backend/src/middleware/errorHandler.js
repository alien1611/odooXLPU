/**
 * Centralized error-handling middleware.
 * Returns consistent JSON response format:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human readable explanation"
 *   }
 * }
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  if (!isProduction && err.stack && statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
      message: err.message || 'Internal Server Error',
      ...(err.details ? { details: err.details } : {})
    }
  });
}

/**
 * 404 Not Found middleware for unmatched routes.
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Resource not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
