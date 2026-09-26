-- ============================================================================
-- Stockyard ERP - Migration 006: Advanced Warehouse Logistics & Wave Management
-- Description: Adds pick_waves, links deliveries to waves, configures forward
--              pick bin roles and replenishment tasks, implements cross-dock
--              alerts table, and expands audit actions.
-- ============================================================================

-- 1. Pick Waves Table
CREATE TABLE IF NOT EXISTS pick_waves (
    id BIGSERIAL PRIMARY KEY,
    wave_number VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'released', 'picking', 'completed', 'cancelled')),
    notes TEXT NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Link Deliveries to Waves
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS wave_id BIGINT NULL REFERENCES pick_waves(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_wave_id ON deliveries (wave_id);
CREATE INDEX IF NOT EXISTS idx_pick_waves_warehouse ON pick_waves (warehouse_id, status);

-- 3. Extend Locations with Operational Role (reserve, forward_pick, general)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_role VARCHAR(30) NOT NULL DEFAULT 'general';
ALTER TABLE locations DROP CONSTRAINT IF EXISTS chk_locations_role;
ALTER TABLE locations ADD CONSTRAINT chk_locations_role CHECK (location_role IN ('general', 'reserve', 'forward_pick'));
CREATE INDEX IF NOT EXISTS idx_locations_role ON locations (warehouse_id, location_role);

-- 4. Forward Pick Bin Replenishment Configurations
CREATE TABLE IF NOT EXISTS replenishment_configs (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    min_qty NUMERIC(15, 4) NOT NULL CHECK (min_qty >= 0),
    max_qty NUMERIC(15, 4) NOT NULL CHECK (max_qty > min_qty),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_replenishment_configs_loc_prod UNIQUE (location_id, product_id)
);

-- 5. Replenishment Tasks / Suggestions
CREATE TABLE IF NOT EXISTS replenishment_tasks (
    id BIGSERIAL PRIMARY KEY,
    task_number VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    destination_location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    source_location_id BIGINT NULL REFERENCES locations(id) ON DELETE SET NULL,
    current_forward_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    threshold_qty NUMERIC(15, 4) NOT NULL,
    target_qty NUMERIC(15, 4) NOT NULL,
    suggested_qty NUMERIC(15, 4) NOT NULL CHECK (suggested_qty > 0),
    available_reserve_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    status VARCHAR(30) NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'ready', 'partially_fulfillable', 'executed', 'dismissed')),
    transfer_id BIGINT NULL REFERENCES transfers(id) ON DELETE SET NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ NULL,
    dismissed_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_replenishment_tasks_wh_status ON replenishment_tasks (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_replenishment_tasks_dest ON replenishment_tasks (destination_location_id);

-- 6. Cross-Docking Alerts Table
CREATE TABLE IF NOT EXISTS cross_dock_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_number VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    receipt_line_id BIGINT NULL REFERENCES receipt_lines(id) ON DELETE SET NULL,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE SET NULL,
    received_qty NUMERIC(15, 4) NOT NULL CHECK (received_qty > 0),
    pending_demand_qty NUMERIC(15, 4) NOT NULL CHECK (pending_demand_qty > 0),
    suggested_cross_dock_qty NUMERIC(15, 4) NOT NULL CHECK (suggested_cross_dock_qty > 0),
    pending_delivery_id BIGINT NULL REFERENCES deliveries(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ NULL,
    dismissed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_dock_alerts_product ON cross_dock_alerts (product_id);
CREATE INDEX IF NOT EXISTS idx_cross_dock_alerts_status ON cross_dock_alerts (warehouse_id, status);

-- 7. Update audit_log action constraint to include Phase 6 logistics operations
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
        'CROSS_DOCK_DISMISS', 'CROSS_DOCK_ACKNOWLEDGE'
    ));
