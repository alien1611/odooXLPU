-- ============================================================================
-- Stockyard ERP - Migration 003: Core Stock Engine Enhancements
-- Description: Adds transfers table, indexes for origin_document lookup,
--              and broadens audit_log actions for stock operations.
-- ============================================================================

-- 1. Transfers Table (Internal Stock Transfers between locations)
CREATE TABLE IF NOT EXISTS transfers (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    source_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    dest_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    src_location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    dest_location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'done', 'cancelled')),
    notes TEXT NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    done_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_transfers_locations_different CHECK (src_location_id != dest_location_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_product ON transfers (product_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers (status);
CREATE INDEX IF NOT EXISTS idx_transfers_locations ON transfers (src_location_id, dest_location_id);

-- 2. Index for stock_moves origin_document fast retrieval
CREATE INDEX IF NOT EXISTS idx_stock_moves_origin_document ON stock_moves (origin_document);

-- 3. Update audit_log action constraint to include TRANSFER
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_action;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action 
    CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 'ADJUST', 'LOGIN', 'RESET_PASSWORD', 'TRANSFER'));
