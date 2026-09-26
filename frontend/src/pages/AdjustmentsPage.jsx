import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function AdjustmentsPage() {
  return (
    <ModulePlaceholder
      title="Stock Adjustments"
      description="Physical cycle counts, discrepancy reconciliation, and balanced compensatory stock movements."
      table="adjustments"
      phase="Phase 6 - Adjustments & Audit Reconciliation"
      icon={SlidersHorizontal}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Adjustment document ID' },
        { name: 'reference', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL', desc: 'Adjustment reference (e.g., ADJ-001)' },
        { name: 'counted_qty', type: 'NUMERIC(15,4)', constraints: 'CHECK >= 0', desc: 'Actual counted physical inventory' },
        { name: 'theoretical_qty', type: 'NUMERIC(15,4)', constraints: 'CHECK >= 0', desc: 'System computed on-hand quant quantity' },
        { name: 'difference_qty', type: 'NUMERIC(15,4)', constraints: 'NOT NULL', desc: 'Variance (counted - theoretical)' },
        { name: 'status', type: 'VARCHAR(30)', constraints: 'draft, applied, cancelled', desc: 'Approval and posting state' },
      ]}
    />
  );
}
