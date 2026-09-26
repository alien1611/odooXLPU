import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  ShieldAlert,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  RefreshCw,
  Repeat,
  Package,
  FolderTree,
  Scale,
  Warehouse,
  MapPin,
  Database,
  Scan
} from 'lucide-react';

const operationItems = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Mobile Scanner', to: '/warehouse/scanner', icon: Scan },
  { name: 'Inventory Quants', to: '/inventory', icon: Boxes },
  { name: 'Stock Moves (Ledger)', to: '/moves', icon: ArrowLeftRight },
  { name: 'Lots & FEFO Expiry', to: '/lots', icon: ShieldAlert },
  { name: 'Inbound Receipts', to: '/receipts', icon: ArrowDownToLine },
  { name: 'Outbound Deliveries', to: '/deliveries', icon: ArrowUpFromLine },
  { name: 'Internal Transfers', to: '/transfers', icon: Repeat },
  { name: 'Stock Adjustments', to: '/adjustments', icon: SlidersHorizontal },
  { name: 'Reorder Suggestions', to: '/reorders', icon: RefreshCw },
];

const masterDataItems = [
  { name: 'Products', to: '/products', icon: Package },
  { name: 'Categories', to: '/categories', icon: FolderTree },
  { name: 'Units of Measure', to: '/uom', icon: Scale },
  { name: 'Warehouses', to: '/warehouses', icon: Warehouse },
  { name: 'Locations', to: '/locations', icon: MapPin },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-14 flex items-center px-4 gap-3 border-b border-slate-800 bg-slate-950">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
          SY
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100 text-sm tracking-wide leading-none">STOCKYARD</span>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider mt-1 uppercase">ERP Core v1.0</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {/* Operations */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Warehouse Operations
          </div>
          <div className="space-y-0.5">
            {operationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Master Data */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Master Data Configuration
          </div>
          <div className="space-y-0.5">
            {masterDataItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Engine Status / System Core Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="truncate">
            <p className="text-[11px] font-mono text-slate-300 truncate">PostgreSQL Engine</p>
            <p className="text-[10px] text-slate-400 truncate">Immutable Stock Moves</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
