/**
 * Role-Based Access Control (RBAC) Middleware.
 *
 * Permission Model:
 * - inventory_manager (and admin): Full administrative control over master data,
 *   receipts, deliveries, adjustments, lots, and system parameters.
 * - warehouse_staff: Read-only access to master data and stock levels,
 *   operational execution of inventory movements, but cannot create or alter master records.
 */

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User is not authenticated.'
        }
      });
    }

    const userRole = req.user.role;
    const normalizedAllowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Admin role always has overarching privileges if assigned
    if (userRole === 'admin' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: `Action restricted. Required role: ${normalizedAllowed.join(' or ')}. Your role: ${userRole}.`
      }
    });
  };
}

// Preset helpers for clean route definitions
const requireManager = requireRole(['inventory_manager', 'admin']);
const requireStaffOrManager = requireRole(['inventory_manager', 'warehouse_staff', 'admin']);

module.exports = {
  requireRole,
  requireManager,
  requireStaffOrManager
};
