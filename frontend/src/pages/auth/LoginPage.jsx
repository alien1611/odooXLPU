import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo, Button, Input } from '../../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-neutral-900 relative overflow-hidden font-sans">
      {/* Soft Apple ambient background depth */}
      <div 
        className="fixed top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-amber-100/40 blur-[140px] pointer-events-none -z-10" 
        aria-hidden="true"
      />
      <div 
        className="fixed bottom-[-10%] right-[20%] w-[550px] h-[550px] rounded-full bg-slate-200/50 blur-[150px] pointer-events-none -z-10" 
        aria-hidden="true"
      />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex justify-center mb-3">
          <Logo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">
          Stockyard
        </h1>
        <p className="mt-1 text-xs text-neutral-500 max-w-xs mx-auto">
          Warehouse & Inventory Management Control System
        </p>
      </div>

      {/* Centered Glass Card */}
      <div className="w-full sm:max-w-md">
        <div className="bg-white/70 backdrop-blur-2xl py-8 px-7 sm:px-10 rounded-[24px] border border-white/60 shadow-[0_16px_40px_rgba(0,0,0,0.06)]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Work Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@stockyard.local"
              icon={Mail}
              autoComplete="username"
            />

            <div>
              <div className="flex items-center justify-between mb-1 pl-1">
                <label className="text-xs font-medium text-neutral-600">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-medium text-amber-700 hover:text-amber-800"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                autoComplete="current-password"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                variant="primary"
                size="md"
                className="w-full py-2.5 shadow-sm hover:shadow"
                icon={!loading ? ArrowRight : undefined}
                iconPosition="right"
              >
                Sign In to Station
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-500">
              Need operator credentials?{' '}
              <Link to="/signup" className="text-amber-700 hover:text-amber-800 font-medium">
                Register Work Profile
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Helper Box */}
        <div className="mt-4 p-3 bg-white/50 backdrop-blur-md border border-black/[0.04] rounded-2xl text-[11px] text-neutral-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-neutral-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            RBAC Active
          </span>
          <span className="font-mono text-neutral-400">admin@stockyard.local</span>
        </div>
      </div>
    </div>
  );
}
