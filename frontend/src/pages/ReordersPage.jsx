import React from 'react';
import { RefreshCw } from 'lucide-react';
import ModulePlaceholder from '../components/common/ModulePlaceholder';

export default function ReordersPage() {
  return (
    <ModulePlaceholder
      title="Consumption-Based Reorder Suggestions"
      description="Automated replenishment triggers driven by historical stock moves and configurable safety stock thresholds."
      table="reorder_suggestions"
      phase="Phase 7 - Reorder Engine & Forecasting"
      icon={RefreshCw}
      schemaFields={[
        { name: 'id', type: 'BIGSERIAL', constraints: 'PK', desc: 'Suggestion identifier' },
        { name: 'product_id', type: 'BIGINT', constraints: 'FK products, NOT NULL', desc: 'Product triggering reorder' },
        { name: 'warehouse_id', type: 'BIGINT', constraints: 'FK warehouses, NOT NULL', desc: 'Warehouse needing replenishment' },
        { name: 'current_stock', type: 'NUMERIC(15,4)', constraints: 'DEFAULT 0', desc: 'Current on-hand aggregate quant' },
        { name: 'min_stock', type: 'NUMERIC(15,4)', constraints: 'DEFAULT 0', desc: 'Configured minimum safety threshold' },
        { name: 'avg_daily_consumption', type: 'NUMERIC(15,4)', constraints: 'DEFAULT 0', desc: 'Computed daily outflow rate from stock_moves' },
        { name: 'suggested_qty', type: 'NUMERIC(15,4)', constraints: 'CHECK > 0', desc: 'Recommended replenishment order quantity' },
        { name: 'status', type: 'VARCHAR(30)', constraints: 'pending, approved, dismissed, ordered', desc: 'Review lifecycle state' },
      ]}
    />
  );
}
