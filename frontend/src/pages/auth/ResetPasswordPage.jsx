import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { Lock, KeyRound, Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Logo, Button, Input } from '../../components/ui';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState(searchParams.get('otp') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword({
        email,
        otp,
        new_password: newPassword
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Password reset failed.');
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
          Set New Password
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          Enter your 6-digit OTP code and choose a new password
        </p>
      </div>

      <div className="w-full sm:max-w-md">
        <div className="bg-white/70 backdrop-blur-2xl py-8 px-7 sm:px-10 rounded-[24px] border border-white/60 shadow-[0_16px_40px_rgba(0,0,0,0.06)]">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900">
                Password Reset Successfully
              </h3>
              <p className="text-xs text-neutral-500">
                Your credentials have been securely updated. You can now log into your station.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 shadow-sm"
                >
                  Proceed to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-xs text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Registered Work Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@stockyard.local"
                icon={Mail}
              />

              <Input
                label="6-Digit Reset OTP Code"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                icon={KeyRound}
                className="font-mono tracking-widest text-center"
              />

              <Input
                label="New Password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                autoComplete="new-password"
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                autoComplete="new-password"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  variant="primary"
                  size="md"
                  className="w-full py-2.5 shadow-sm"
                >
                  Update Password & Sign In
                </Button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
