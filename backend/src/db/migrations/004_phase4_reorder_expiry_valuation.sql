-- ============================================================================
-- Stockyard ERP - Migration 004: Reorder Intelligence, Expiry & Valuation
-- Description: Extends reorder_suggestions with receipt_id, days_remaining,
--              lead_time_days, reorder_point; adds performance indexes
--              for consumption and expiry queries, and broadens audit actions.
-- ============================================================================

-- 1. Extend reorder_suggestions table for full traceability
ALTER TABLE reorder_suggestions ADD COLUMN IF NOT EXISTS days_remaining NUMERIC(15, 4) NULL;
ALTER TABLE reorder_suggestions ADD COLUMN IF NOT EXISTS lead_time_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reorder_suggestions ADD COLUMN IF NOT EXISTS reorder_point NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;
ALTER TABLE reorder_suggestions ADD COLUMN IF NOT EXISTS receipt_id BIGINT NULL REFERENCES receipts(id) ON DELETE SET NULL;

-- 2. Indexes for fast reorder and consumption calculations
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_product ON reorder_suggestions (product_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_warehouse ON reorder_suggestions (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_receipt ON reorder_suggestions (receipt_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_consumption ON stock_moves (product_id, move_type, state, created_at);

-- 3. Indexes for expiry analytics and valuation queries
CREATE INDEX IF NOT EXISTS idx_lots_expiry_date ON lots (expiry_date);
CREATE INDEX IF NOT EXISTS idx_cost_layers_product_remaining ON cost_layers (product_id, remaining_qty);

-- 4. Update audit_log action constraint to include REORDER_APPROVE, REORDER_DISMISS
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS chk_audit_log_action;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT chk_audit_log_action 
    CHECK (action IN (
        'CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 
        'ADJUST', 'LOGIN', 'RESET_PASSWORD', 'TRANSFER',
        'APPROVE', 'DISMISS', 'REORDER_APPROVE', 'REORDER_DISMISS'
    ));
