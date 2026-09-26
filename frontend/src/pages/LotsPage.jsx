import React from 'react';
import { ShieldAlert } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function LotsPage() {
  return (
    <ModulePlaceholder
      title="Lots & FEFO Expiry Tracking"
      description="Batch management and First-Expiry-First-Out reservation engine to eliminate product spoilage."
      table="lots"
      phase="Phase 4 - FEFO & Batch Engine"
      icon={ShieldAlert}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Unique lot identifier' },
        { name: 'product_id', type: 'BIGINT', constraints: 'FK products, NOT NULL', desc: 'Product associated with batch' },
        { name: 'lot_number', type: 'VARCHAR(100)', constraints: 'UNIQUE(product_id, lot_number)', desc: 'Vendor or internal batch code' },
        { name: 'expiry_date', type: 'TIMESTAMPTZ', constraints: 'NOT NULL', desc: 'Mandatory expiry date for FEFO sort order' },
        { name: 'alert_date', type: 'TIMESTAMPTZ', constraints: 'NULLABLE', desc: 'Threshold warning date before expiry' },
        { name: 'removal_date', type: 'TIMESTAMPTZ', constraints: 'NULLABLE', desc: 'Hard cutoff date when batch is unsellable' },
      ]}
    />
  );
}
