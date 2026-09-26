import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function StockMovesPage() {
  return (
    <ModulePlaceholder
      title="Stock Movements (Immutable Ledger)"
      description="The immutable single source of truth for all inventory additions, subtractions, and internal transfers."
      table="stock_moves"
      phase="Phase 3 - Inventory Movements Engine"
      icon={ArrowLeftRight}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Unique move identifier' },
        { name: 'reference', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL', desc: 'System generated movement reference (e.g., MOV-001)' },
        { name: 'product_id', type: 'BIGINT', constraints: 'FK products, NOT NULL', desc: 'Associated product' },
        { name: 'lot_id', type: 'BIGINT', constraints: 'FK lots, NULLABLE', desc: 'Allocated batch/lot' },
        { name: 'src_location_id', type: 'BIGINT', constraints: 'FK locations, NULLABLE', desc: 'Origin location (NULL for vendor receipts)' },
        { name: 'dest_location_id', type: 'BIGINT', constraints: 'FK locations, NULLABLE', desc: 'Destination location (NULL for customer delivery)' },
        { name: 'quantity', type: 'NUMERIC(15,4)', constraints: 'CHECK > 0, NOT NULL', desc: 'Exact quantity transferred' },
        { name: 'unit_cost', type: 'NUMERIC(15,4)', constraints: 'CHECK >= 0, NOT NULL', desc: 'Valuation cost per unit at time of movement' },
        { name: 'state', type: 'VARCHAR(30)', constraints: 'draft, confirmed, assigned, done, cancelled', desc: 'Lifecycle state of movement' },
        { name: 'move_type', type: 'VARCHAR(30)', constraints: 'receipt, delivery, internal_transfer, adjustment, scrap', desc: 'Operational nature of the move' },
      ]}
    />
  );
}
