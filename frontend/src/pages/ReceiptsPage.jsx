import React from 'react';
import { ArrowDownToLine } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function ReceiptsPage() {
  return (
    <ModulePlaceholder
      title="Inbound Receipts"
      description="Supplier shipments, purchase order goods receipts, and initial cost layer establishment."
      table="receipts & receipt_lines"
      phase="Phase 5 - Inbound Operations & Cost Layer Generation"
      icon={ArrowDownToLine}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Receipt document ID' },
        { name: 'reference', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL', desc: 'Document identifier (e.g., REC-001)' },
        { name: 'supplier_name', type: 'VARCHAR(255)', constraints: 'NOT NULL', desc: 'Originating vendor / supplier' },
        { name: 'destination_warehouse_id', type: 'BIGINT', constraints: 'FK warehouses, NOT NULL', desc: 'Receiving facility' },
        { name: 'status', type: 'VARCHAR(30)', constraints: 'draft, waiting, ready, done, cancelled', desc: 'Receipt workflow state' },
      ]}
    />
  );
}
