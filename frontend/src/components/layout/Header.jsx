import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import useAuth from '../../hooks/useAuth';
import { Warehouse, CheckCircle2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

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
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Left: Active Facility & Context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded border border-slate-200 text-xs font-medium text-slate-700">
          <Warehouse className="w-3.5 h-3.5 text-slate-500" />
          <span>Warehouse: <strong className="font-semibold text-slate-900">WH-MAIN</strong></span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          <span>Costing: <strong className="text-slate-700">Weighted Average</strong></span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          <span>Dispatch: <strong className="text-slate-700">FEFO Engine</strong></span>
        </div>
      </div>

      {/* Right: API Health Status & User Profile */}
      <div className="flex items-center gap-3">
        {/* Backend API Health Indicator */}
        <button
          onClick={fetchHealth}
          title="Click to re-check backend connection status"
          className="flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-mono transition-colors hover:bg-slate-50"
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
          ) : health.status === 'online' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          )}

          <span className="text-[11px]">
            API: <strong className={health.status === 'online' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              {health.status.toUpperCase()}
            </strong>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500">
            DB: <span className={health.database === 'connected' ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
              {health.database || '...'}
            </span>
          </span>
        </button>

        {/* User Identity & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-mono">
            {getInitials(user?.name)}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[130px]">
              {user?.name || 'Operator'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {user?.role || 'staff'}
            </div>
          </div>

          <button
            onClick={logout}
            title="Log Out of Station"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
