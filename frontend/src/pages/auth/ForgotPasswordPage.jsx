import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Mail, KeyRound, AlertCircle, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import { Logo, Button, Input } from '../../components/ui';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoOtpResult, setDemoOtpResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.requestOtp({ email });
      setDemoOtpResult(data);
    } catch (err) {
      setError(err.message || 'Failed to generate reset OTP.');
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
          Password Recovery
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          Request an authentication OTP to reset your credentials
        </p>
      </div>

      <div className="w-full sm:max-w-md">
        <div className="bg-white/70 backdrop-blur-2xl py-8 px-7 sm:px-10 rounded-[24px] border border-white/60 shadow-[0_16px_40px_rgba(0,0,0,0.06)]">
          {/* Demo Mode Notice Banner */}
          <div className="mb-5 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">
                Demo Evaluation Mode
              </p>
              <p className="text-[11px] text-amber-900/80 mt-0.5 leading-snug">
                OTP is displayed on-screen and operates securely without third-party email services.
              </p>
            </div>
          </div>

          {demoOtpResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-center">
                <span className="text-xs text-emerald-800 font-medium block mb-1">
                  Generated Demo OTP Code:
                </span>
                <div className="text-3xl font-mono font-bold tracking-widest text-emerald-700 py-1">
                  {demoOtpResult.demo_otp}
                </div>
                <span className="text-[11px] text-emerald-600 block mt-1">
                  Valid for {demoOtpResult.expires_in_minutes} minutes
                </span>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}&otp=${demoOtpResult.demo_otp}`)}
                className="w-full py-2.5 shadow-sm"
                icon={ArrowRight}
                iconPosition="right"
              >
                Proceed to Reset Password
              </Button>
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

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  variant="primary"
                  size="md"
                  className="w-full py-2.5 shadow-sm"
                  icon={!loading ? KeyRound : undefined}
                >
                  Generate Password Reset OTP
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
