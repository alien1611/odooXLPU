-- ============================================================================
-- Stockyard ERP - Migration 007: Shipping, Cartonization & Carrier Integrations
-- Description: Adds carriers, packages (cartonization/dimensions/weight), 
--              package_lines (package contents tracking), and updates audit
--              log constraints for packing and dispatch operations.
-- ============================================================================

-- 1. Carriers Table (Local Carrier Management)
CREATE TABLE IF NOT EXISTS carriers (
    id BIGSERIAL PRIMARY KEY,
    carrier_code VARCHAR(50) NOT NULL UNIQUE,
    carrier_name VARCHAR(150) NOT NULL,
    service_level VARCHAR(100) NOT NULL DEFAULT 'Standard',
    tracking_prefix VARCHAR(20) NOT NULL DEFAULT 'TRK',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Packages Table (Cartonization, Box Dimensions, Weight Capture, Dispatch)
CREATE TABLE IF NOT EXISTS packages (
    id BIGSERIAL PRIMARY KEY,
    package_number VARCHAR(100) NOT NULL UNIQUE,
    delivery_id BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    package_type VARCHAR(50) NOT NULL DEFAULT 'box' CHECK (package_type IN ('box', 'carton', 'pallet', 'crate', 'envelope', 'custom')),
    length NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (length >= 0),
    width NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (width >= 0),
    height NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (height >= 0),
    dimension_unit VARCHAR(10) NOT NULL DEFAULT 'cm' CHECK (dimension_unit IN ('cm', 'in', 'm')),
    gross_weight NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (gross_weight >= 0),
    tare_weight NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (tare_weight >= 0),
    net_weight NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (net_weight >= 0),
    weight_unit VARCHAR(10) NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb', 'g')),
    status VARCHAR(30) NOT NULL DEFAULT 'packing' CHECK (status IN ('packing', 'packed', 'dispatched', 'cancelled')),
    carrier_id BIGINT NULL REFERENCES carriers(id) ON DELETE SET NULL,
    tracking_number VARCHAR(100) NULL,
    notes TEXT NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    packed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    dispatched_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    packed_at TIMESTAMPTZ NULL,
    dispatched_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packages_delivery_id ON packages(delivery_id);
CREATE INDEX IF NOT EXISTS idx_packages_warehouse_status ON packages(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_packages_carrier ON packages(carrier_id);

-- 3. Package Lines Table (Carton Contents per Delivery Line & Product/Lot)
CREATE TABLE IF NOT EXISTS package_lines (
    id BIGSERIAL PRIMARY KEY,
    package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    delivery_line_id BIGINT NOT NULL REFERENCES delivery_lines(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE SET NULL,
    packed_qty NUMERIC(15, 4) NOT NULL CHECK (packed_qty > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_package_lines_package ON package_lines(package_id);
CREATE INDEX IF NOT EXISTS idx_package_lines_deliv_line ON package_lines(delivery_line_id);
CREATE INDEX IF NOT EXISTS idx_package_lines_product ON package_lines(product_id);

-- 4. Update audit_log action constraint to include Phase 7 shipping operations
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_action;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action 
    CHECK (action IN (
        'CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 
        'ADJUST', 'LOGIN', 'RESET_PASSWORD', 'TRANSFER',
        'APPROVE', 'DISMISS', 'REORDER_APPROVE', 'REORDER_DISMISS',
        'BARCODE_ASSIGN', 'BARCODE_UPDATE', 'BARCODE_REMOVE',
        'SCAN_RECEIPT', 'SCAN_DELIVERY', 'SCAN_CYCLE_COUNT',
        'WAVE_CREATE', 'WAVE_RELEASE', 'WAVE_START', 'WAVE_COMPLETE', 'WAVE_CANCEL',
        'REPLENISHMENT_GENERATE', 'REPLENISHMENT_EXECUTE', 'REPLENISHMENT_DISMISS',
        'CROSS_DOCK_DISMISS', 'CROSS_DOCK_ACKNOWLEDGE',
        'PACKAGE_CREATE', 'PACKAGE_LINE_ADD', 'PACKAGE_PACK', 'CARRIER_ASSIGN', 'PACKAGE_DISPATCH'
    ));
