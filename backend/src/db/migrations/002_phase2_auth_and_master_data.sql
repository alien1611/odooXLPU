-- ============================================================================
-- Stockyard ERP - Migration 002: Auth & Master Data Enhancements
-- Description: Align role constraints, add conversion_to_base to UoM,
--              parent_location_id to Locations, and reorder_point/lead_time_days
--              to Products, plus OTP support in password_resets and audit actions.
-- ============================================================================

-- 1. Update user roles check constraint to include inventory_manager and warehouse_staff
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT chk_users_role 
    CHECK (role IN ('inventory_manager', 'warehouse_staff', 'admin', 'manager', 'staff'));

-- 2. Add conversion_to_base to UoM table
ALTER TABLE uom ADD COLUMN IF NOT EXISTS conversion_to_base NUMERIC(15, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE uom DROP CONSTRAINT IF EXISTS chk_uom_conversion;
ALTER TABLE uom ADD CONSTRAINT chk_uom_conversion CHECK (conversion_to_base > 0);

-- 3. Add parent_location_id to Locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS parent_location_id BIGINT NULL REFERENCES locations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations (parent_location_id);

-- 4. Add reorder_point and lead_time_days to Products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_reorder;
ALTER TABLE products ADD CONSTRAINT chk_products_reorder CHECK (reorder_point >= 0);
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_lead_time;
ALTER TABLE products ADD CONSTRAINT chk_products_lead_time CHECK (lead_time_days >= 0);

-- 5. Add OTP support columns to password_resets
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) NULL;
CREATE INDEX IF NOT EXISTS idx_password_resets_user_expires ON password_resets (user_id, expires_at DESC);

-- 6. Broaden audit_log action check constraint to support authentication security events
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_action;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action 
    CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 'ADJUST', 'LOGIN', 'RESET_PASSWORD'));
