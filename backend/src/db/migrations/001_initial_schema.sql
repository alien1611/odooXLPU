-- ============================================================================
-- Stockyard ERP - Initial Database Schema Migration
-- Migration: 001_initial_schema.sql
-- Description: Core schema including master data, inventory engine,
--              immutable stock moves, cached quants, lots/FEFO, cost layers,
--              receipts, deliveries, adjustments, reorders, and audit logging.
-- ============================================================================

-- Create migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'inventory_manager' CONSTRAINT chk_users_role CHECK (role IN ('inventory_manager', 'warehouse_staff', 'admin', 'manager', 'staff')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Password Resets
CREATE TABLE IF NOT EXISTS password_resets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Product Categories (Supports hierarchical taxonomy)
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    parent_id BIGINT NULL REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Units of Measure (UoM)
CREATE TABLE IF NOT EXISTS uom (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'unit',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    address TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Locations (Internal, Supplier, Customer, Inventory Loss, Transit)
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'supplier', 'customer', 'inventory_loss', 'transit')),
    barcode VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_locations_warehouse_code UNIQUE (warehouse_id, code)
);

-- 7. Products
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(100) NULL,
    category_id BIGINT NULL REFERENCES categories(id) ON DELETE SET NULL,
    uom_id BIGINT NOT NULL REFERENCES uom(id),
    tracking_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (tracking_type IN ('none', 'lot')),
    cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (cost_price >= 0),
    sale_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (sale_price >= 0),
    min_stock_level NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (min_stock_level >= 0),
    max_stock_level NUMERIC(15, 4) NULL CHECK (max_stock_level IS NULL OR max_stock_level >= min_stock_level),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Lots / Batches (Crucial for FEFO with Expiry tracking)
CREATE TABLE IF NOT EXISTS lots (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_number VARCHAR(100) NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    alert_date TIMESTAMPTZ NULL,
    removal_date TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lots_product_lot_number UNIQUE (product_id, lot_number)
);

-- 9. Stock Moves (IMMUTABLE SINGLE SOURCE OF TRUTH for inventory changes)
CREATE TABLE IF NOT EXISTS stock_moves (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    src_location_id BIGINT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    dest_location_id BIGINT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
    uom_id BIGINT NOT NULL REFERENCES uom(id),
    unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
    state VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'confirmed', 'assigned', 'done', 'cancelled')),
    move_type VARCHAR(30) NOT NULL CHECK (move_type IN ('receipt', 'delivery', 'internal_transfer', 'adjustment_in', 'adjustment_out', 'scrap')),
    origin_document VARCHAR(100) NULL,
    performed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    done_at TIMESTAMPTZ NULL,
    CONSTRAINT chk_src_or_dest_required CHECK (src_location_id IS NOT NULL OR dest_location_id IS NOT NULL)
);

-- 10. Stock Quants (Cached current-state inventory breakdown by location & lot)
CREATE TABLE IF NOT EXISTS stock_quants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (quantity >= 0),
    reserved_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique indexes to support lot-tracked and non-lot-tracked inventory
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_quants_unique_lot 
    ON stock_quants (product_id, location_id, lot_id) 
    WHERE lot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_quants_unique_no_lot 
    ON stock_quants (product_id, location_id) 
    WHERE lot_id IS NULL;

-- 11. Cost Layers (Used for inventory valuation & weighted-average costing)
CREATE TABLE IF NOT EXISTS cost_layers (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    stock_move_id BIGINT NULL REFERENCES stock_moves(id) ON DELETE SET NULL,
    initial_qty NUMERIC(15, 4) NOT NULL CHECK (initial_qty > 0),
    remaining_qty NUMERIC(15, 4) NOT NULL CHECK (remaining_qty >= 0 AND remaining_qty <= initial_qty),
    unit_cost NUMERIC(15, 4) NOT NULL CHECK (unit_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Receipts (Inbound Shipments)
CREATE TABLE IF NOT EXISTS receipts (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    supplier_name VARCHAR(255) NOT NULL,
    destination_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'cancelled')),
    received_date TIMESTAMPTZ NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Receipt Lines
CREATE TABLE IF NOT EXISTS receipt_lines (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_number VARCHAR(100) NULL,
    expiry_date TIMESTAMPTZ NULL,
    expected_qty NUMERIC(15, 4) NOT NULL CHECK (expected_qty > 0),
    received_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (received_qty >= 0),
    unit_price NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_price >= 0),
    dest_location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Deliveries (Outbound Orders)
CREATE TABLE IF NOT EXISTS deliveries (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    source_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'cancelled')),
    scheduled_date TIMESTAMPTZ NULL,
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Delivery Lines
CREATE TABLE IF NOT EXISTS delivery_lines (
    id BIGSERIAL PRIMARY KEY,
    delivery_id BIGINT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    requested_qty NUMERIC(15, 4) NOT NULL CHECK (requested_qty > 0),
    reserved_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (reserved_qty >= 0),
    done_qty NUMERIC(15, 4) NOT NULL DEFAULT 0.0000 CHECK (done_qty >= 0),
    src_location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. Adjustments (Physical Inventory Discrepancy Reconciliation)
CREATE TABLE IF NOT EXISTS adjustments (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_id BIGINT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    counted_qty NUMERIC(15, 4) NOT NULL CHECK (counted_qty >= 0),
    theoretical_qty NUMERIC(15, 4) NOT NULL CHECK (theoretical_qty >= 0),
    difference_qty NUMERIC(15, 4) NOT NULL,
    reason TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'cancelled')),
    created_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. Reorder Suggestions (Automated stock replenishment planning)
CREATE TABLE IF NOT EXISTS reorder_suggestions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    current_stock NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    min_stock NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    avg_daily_consumption NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    suggested_qty NUMERIC(15, 4) NOT NULL CHECK (suggested_qty > 0),
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'ordered')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL
);

-- 18. Audit Log (Full traceability of system changes)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL CONSTRAINT chk_audit_log_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VALIDATE', 'CANCEL', 'ADJUST', 'LOGIN', 'RESET_PASSWORD')),
    user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR FREQUENTLY QUERIED RELATIONSHIPS & SEARCHES
-- ============================================================================

-- Fast lookup for stock movements (as required by specification)
CREATE INDEX IF NOT EXISTS idx_stock_moves_product_created 
    ON stock_moves (product_id, created_at DESC);

-- Fast lookup for stock quants (as required by specification)
CREATE INDEX IF NOT EXISTS idx_stock_quants_product_location 
    ON stock_quants (product_id, location_id);

-- FEFO (First-Expiry-First-Out) index for batch allocation
CREATE INDEX IF NOT EXISTS idx_lots_product_expiry 
    ON lots (product_id, expiry_date ASC);

-- Cost layer lookup for inventory valuation & FIFO/weighted-average depletion
CREATE INDEX IF NOT EXISTS idx_cost_layers_product_remaining 
    ON cost_layers (product_id, remaining_qty);

-- Stock moves by lot and locations
CREATE INDEX IF NOT EXISTS idx_stock_moves_lot ON stock_moves (lot_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_src ON stock_moves (src_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_dest ON stock_moves (dest_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_moves_state_type ON stock_moves (state, move_type);

-- Document lines fast lookup
CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON receipt_lines (receipt_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery ON delivery_lines (delivery_id);

-- Pending reorder suggestions lookup
CREATE INDEX IF NOT EXISTS idx_reorder_suggestions_status ON reorder_suggestions (warehouse_id, status);

-- Audit log lookup
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
