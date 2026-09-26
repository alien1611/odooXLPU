import React from 'react';
import { Boxes } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function InventoryPage() {
  return (
    <ModulePlaceholder
      title="Inventory Quants (On-Hand Stock)"
      description="Cached materialized representation of current physical inventory by warehouse location and lot."
      table="stock_quants"
      phase="Phase 3 - Inventory & Quants Service"
      icon={Boxes}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Unique identifier' },
        { name: 'product_id', type: 'BIGINT', constraints: 'FK products, NOT NULL', desc: 'Reference to tracked product' },
        { name: 'location_id', type: 'BIGINT', constraints: 'FK locations, NOT NULL', desc: 'Physical warehouse storage bin' },
        { name: 'lot_id', type: 'BIGINT', constraints: 'FK lots, NULLABLE', desc: 'Specific lot/batch if lot-tracked' },
        { name: 'quantity', type: 'NUMERIC(15,4)', constraints: 'CHECK >= 0, DEFAULT 0', desc: 'Total physical on-hand quantity' },
        { name: 'reserved_quantity', type: 'NUMERIC(15,4)', constraints: 'CHECK >= 0, <= quantity', desc: 'Quantity reserved for outbound orders' },
      ]}
    />
  );
}
