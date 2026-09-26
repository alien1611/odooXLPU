import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { Warehouse, CheckCircle2, AlertCircle, RefreshCw, LogOut, Scan } from 'lucide-react';
import { Button } from '../ui';

export default function Header() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState({ status: 'checking', service: null, database: null });
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await api.checkHealth();
      setHealth({ status: 'online', service: data.service, database: data.database });
    } catch (err) {
      setHealth({ status: 'offline', service: 'stockyard-api', database: 'unavailable' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="h-14 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] px-5 sm:px-7 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Active Facility & Engine Rules */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/80 border border-black/[0.06] rounded-full text-xs font-medium text-neutral-700 shadow-2xs">
          <Warehouse className="w-3.5 h-3.5 text-neutral-500 stroke-[1.8]" />
          <span>Warehouse: <strong className="font-semibold text-neutral-900">WH-MAIN</strong></span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400">
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <span>Costing: <strong className="text-neutral-600 font-medium">Weighted Average</strong></span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <span>Allocation: <strong className="text-neutral-600 font-medium">FEFO Engine</strong></span>
        </div>
      </div>

      {/* Right: Actions, Health & User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Barcode Scanner Quick Link */}
        <Link to="/warehouse/scanner">
          <Button
            variant="secondary"
            size="sm"
            icon={Scan}
            className="text-neutral-700 hover:text-amber-800"
          >
            <span className="hidden sm:inline">Scanner Station</span>
          </Button>
        </Link>

        {/* Live Backend Connection Indicator */}
        <button
          onClick={fetchHealth}
          title="Click to refresh system connection status"
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.06] bg-white/60 hover:bg-white text-xs font-mono transition-colors shadow-2xs"
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 text-neutral-400 animate-spin" />
          ) : health.status === 'online' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}

          <span className="text-[11px] text-neutral-600 hidden sm:inline">
            API: <strong className={health.status === 'online' ? 'text-emerald-700' : 'text-amber-700'}>{health.status.toUpperCase()}</strong>
          </span>
        </button>

        {/* User Identity & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-200/80">
          <Link
            to="/settings"
            title="System Settings"
            className="flex items-center gap-2 p-1 pr-2.5 rounded-full hover:bg-white/80 border border-transparent hover:border-black/[0.05] transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-semibold font-mono tracking-wider">
              {getInitials(user?.name)}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-medium text-neutral-900 leading-none truncate max-w-[110px]">
                {user?.name || 'Operator'}
              </div>
              <div className="text-[9px] text-neutral-400 font-mono mt-0.5 capitalize">
                {user?.role?.replace('_', ' ') || 'staff'}
              </div>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            title="Log Out"
            className="p-1.5 rounded-full text-neutral-400 hover:text-rose-600 hover:bg-rose-50/80"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
