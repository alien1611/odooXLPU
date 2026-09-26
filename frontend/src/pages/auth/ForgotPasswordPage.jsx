import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { Mail, KeyRound, AlertCircle, ArrowRight, ArrowLeft, Info } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center font-bold text-white shadow-md mx-auto mb-3">
          SY
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
          Password Recovery
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Request an authentication OTP to reset your password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-950 py-8 px-6 shadow-xl border border-slate-800 rounded sm:px-10">
          {/* Prominent Mandatory Demo Mode Banner */}
          <div className="mb-5 p-3 rounded bg-blue-950/50 border border-blue-800/80 text-xs text-blue-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-300">
                  Demo Mode — OTP is displayed on-screen and is not sent by email/SMS.
                </p>
                <p className="text-[11px] text-blue-300/80 mt-1">
                  Local offline evaluation mode active. No third-party email API is involved.
                </p>
              </div>
            </div>
          </div>

          {demoOtpResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/80 rounded text-center">
                <span className="text-xs text-emerald-400 font-medium block mb-1">
                  Generated Demo OTP Code:
                </span>
                <div className="text-3xl font-mono font-bold tracking-widest text-emerald-300 py-2">
                  {demoOtpResult.demo_otp}
                </div>
                <span className="text-[11px] text-emerald-400/80 block mt-1">
                  Valid for {demoOtpResult.expires_in_minutes} minutes
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}&otp=${demoOtpResult.demo_otp}`)}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 rounded shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Proceed to Reset Password
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3 rounded bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Registered Work Email
                </label>
                <div className="mt-1 relative rounded shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@stockyard.local"
                    className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Generating OTP...' : 'Generate Password Reset OTP'}
                  {!loading && <KeyRound className="w-3.5 h-3.5" />}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300">
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
