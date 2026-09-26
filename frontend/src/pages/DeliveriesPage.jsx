import React from 'react';
import { ArrowUpFromLine } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function DeliveriesPage() {
  return (
    <ModulePlaceholder
      title="Outbound Deliveries"
      description="Sales order fulfillment, customer shipments, and automated FEFO lot reservation."
      table="deliveries & delivery_lines"
      phase="Phase 5 - Outbound Operations & FEFO Dispatch"
      icon={ArrowUpFromLine}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Delivery order ID' },
        { name: 'reference', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL', desc: 'Order tracking reference (e.g., OUT-001)' },
        { name: 'customer_name', type: 'VARCHAR(255)', constraints: 'NOT NULL', desc: 'Recipient customer name' },
        { name: 'source_warehouse_id', type: 'BIGINT', constraints: 'FK warehouses, NOT NULL', desc: 'Dispatching warehouse facility' },
        { name: 'status', type: 'VARCHAR(30)', constraints: 'draft, waiting, ready, done, cancelled', desc: 'Fulfillment workflow status' },
      ]}
    />
  );
}
