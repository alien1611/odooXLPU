-- ============================================================================
-- Stockyard ERP - Migration 005: Barcode & Warehouse Operations Flow
-- Description: Adds barcode column to lots, establishes uniqueness indexes
--              on products, locations, and lots barcodes, and expands
--              audit log action constraints for barcode events.
-- ============================================================================

-- 1. Add barcode column to lots
ALTER TABLE lots ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) NULL;

-- 2. Unique indexes for non-null barcodes to prevent duplicates within entities
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_barcode ON products (barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_barcode ON locations (barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lots_barcode ON lots (barcode) WHERE barcode IS NOT NULL;

-- 3. Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode_search ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_locations_barcode_search ON locations (barcode);
CREATE INDEX IF NOT EXISTS idx_lots_barcode_search ON lots (barcode);

-- 4. Update audit_log action constraint to include barcode operations
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_action;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action 
    CHECK (action IN (
        'CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 
        'ADJUST', 'LOGIN', 'RESET_PASSWORD', 'TRANSFER',
        'APPROVE', 'DISMISS', 'REORDER_APPROVE', 'REORDER_DISMISS',
        'BARCODE_ASSIGN', 'BARCODE_UPDATE', 'BARCODE_REMOVE',
        'SCAN_RECEIPT', 'SCAN_DELIVERY', 'SCAN_CYCLE_COUNT'
    ));
