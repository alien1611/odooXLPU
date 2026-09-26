import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { User, Mail, Lock, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { Logo, Button, Input, Select } from '../../components/ui';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'inventory_manager'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signup(formData);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-neutral-900 relative overflow-hidden font-sans">
      <div 
        className="fixed top-[-10%] left-[20%] w-[600px] h-[600px] rounded-full bg-amber-100/40 blur-[140px] pointer-events-none -z-10" 
        aria-hidden="true"
      />
      <div 
        className="fixed bottom-[-10%] right-[20%] w-[550px] h-[550px] rounded-full bg-slate-200/50 blur-[150px] pointer-events-none -z-10" 
        aria-hidden="true"
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex justify-center mb-3">
          <Logo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">
          Create Profile
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          Register an authenticated Stockyard warehouse account
        </p>
      </div>

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
              label="Full Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Alex Walker"
              icon={User}
            />

            <Input
              label="Work Email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="alex@stockyard.local"
              icon={Mail}
              autoComplete="username"
            />

            <Input
              label="Password (min 8 characters)"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              icon={Lock}
              autoComplete="new-password"
            />

            <Select
              label="Assigned System Role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={[
                { value: 'inventory_manager', label: 'Inventory Manager (Full Access)' },
                { value: 'warehouse_staff', label: 'Warehouse Staff (Operations)' }
              ]}
            />

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
                Register & Sign In
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-500">
              Already have an account?{' '}
              <Link to="/login" className="text-amber-700 hover:text-amber-800 font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
