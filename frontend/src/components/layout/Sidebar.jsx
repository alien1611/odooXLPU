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
  Scan,
  Layers,
  ArrowUpRight,
  Zap,
  Truck,
  Settings
} from 'lucide-react';
import { Logo } from '../ui';

const operationItems = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Mobile Scanner', to: '/warehouse/scanner', icon: Scan },
  { name: 'Pick Waves', to: '/waves', icon: Layers },
  { name: 'Bin Replenishment', to: '/replenishment', icon: ArrowUpRight },
  { name: 'Cross-Docking', to: '/cross-dock', icon: Zap },
  { name: 'Shipping & Dispatch', to: '/shipping', icon: Truck },
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
  { name: 'System Settings', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white/70 backdrop-blur-2xl text-neutral-800 flex flex-col shrink-0 border-r border-black/[0.06] select-none z-20">
      {/* Brand Header with Apple-style Logo */}
      <div className="h-14 flex items-center px-5 border-b border-black/[0.06] bg-white/40">
        <Logo size="md" showWordmark={true} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {/* Operations */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
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
                    `flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[1.8]" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Master Data */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Master Data
          </div>
          <div className="space-y-0.5">
            {masterDataItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 stroke-[1.8]" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Engine Status / System Core Footer */}
      <div className="p-3.5 border-t border-black/[0.06] bg-white/40">
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-neutral-500">
          <Database className="w-3.5 h-3.5 text-amber-600 shrink-0 stroke-[1.8]" />
          <div className="truncate">
            <p className="text-[11px] font-medium text-neutral-800 leading-tight">PostgreSQL Engine</p>
            <p className="text-[10px] text-neutral-400 font-mono">Immutable Moves</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
