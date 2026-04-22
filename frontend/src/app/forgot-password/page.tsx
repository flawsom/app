'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { ArrowLeft, Mail, Key, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ✅ NEW: Auto-detect token from URL
  useEffect(() => {
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      setStep('reset'); // skip email step
    }
  }, [params]);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/forgot-password', { email });
      if (data.reset_token) setToken(data.reset_token); // keeps your existing feature
      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Missing reset token');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await apiPost('/api/auth/reset-password', { token, password });
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-zinc-900 flex items-center justify-center p-8" data-testid="forgot-password-page">
      <div className="w-full max-w-md">

        {/* BACK BUTTON */}
        <button
          onClick={() => step === 'email' ? router.push('/login') : setStep('email')}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-8 transition-colors"
          data-testid="forgot-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* EMAIL STEP */}
        {step === 'email' && (
          <>
            <div className="w-12 h-12 bg-[#002FA7] flex items-center justify-center mb-6">
              <Mail className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2 font-['Outfit'] dark:text-white">
              Reset Password
            </h1>

            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Enter your email to receive a reset link
            </p>

            {error && <div className="badge-error p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={requestReset} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                placeholder="you@example.com"
                required
                data-testid="forgot-email-input"
              />

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
                data-testid="forgot-submit-btn"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        {/* RESET STEP */}
        {step === 'reset' && (
          <>
            <div className="w-12 h-12 bg-[#002FA7] flex items-center justify-center mb-6">
              <Key className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2 font-['Outfit'] dark:text-white">
              New Password
            </h1>

            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Enter your new password
            </p>

            {error && <div className="badge-error p-3 mb-4 text-sm">{error}</div>}

            <form onSubmit={doReset} className="space-y-4">

              {/* TOKEN FIELD (auto-filled OR manual fallback) */}
              <div>
                <label className="text-sm font-medium block mb-1 dark:text-zinc-300">
                  Reset Token
                </label>

                <input
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="input-field font-mono text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  required
                  data-testid="reset-token-input"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1 dark:text-zinc-300">
                  New Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  placeholder="Min. 6 characters"
                  required
                  data-testid="reset-password-input"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1 dark:text-zinc-300">
                  Confirm Password
                </label>

                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="input-field dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  placeholder="Confirm password"
                  required
                  data-testid="reset-confirm-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
                data-testid="reset-submit-btn"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {/* DONE STEP */}
        {step === 'done' && (
          <div className="text-center" data-testid="reset-success">
            <div className="w-16 h-16 bg-[#E6F4EA] flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-[#0D652D]" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2 font-['Outfit'] dark:text-white">
              Password Reset!
            </h1>

            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Your password has been updated successfully.
            </p>

            <button
              onClick={() => router.push('/login')}
              className="btn-primary"
              data-testid="goto-login-btn"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}