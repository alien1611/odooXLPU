import React from 'react';
import { Settings } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      title="Master Configuration & Settings"
      description="Warehouses, storage locations, product categories, and units of measure (UoM)."
      table="warehouses, locations, categories, uom"
      phase="Phase 2 - Master Data Management"
      icon={Settings}
      schemaFields={[
        { name: 'warehouses', type: 'TABLE', constraints: 'code UNIQUE', desc: 'Physical logistics facilities' },
        { name: 'locations', type: 'TABLE', constraints: 'warehouse_id + code UNIQUE', desc: 'Internal bins, supplier, customer, transit' },
        { name: 'categories', type: 'TABLE', constraints: 'name UNIQUE', desc: 'Hierarchical product categorization' },
        { name: 'uom', type: 'TABLE', constraints: 'code UNIQUE', desc: 'Standard units of measure (KG, PCS, L, etc.)' },
      ]}
    />
  );
}
