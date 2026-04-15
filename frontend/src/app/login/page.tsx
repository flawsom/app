'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff, ArrowLeft, Zap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user !== false && user !== null) router.push(`/dashboard/${user.role}`);
  }, [user, router]);

  if (user && user !== false && user !== null) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); } catch (err: any) { setError(err.message || 'Login failed'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex noise-overlay" style={{ background: 'var(--bg-void)' }} data-testid="login-page">
      {/* Left */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-16 overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
        <div className="gradient-orb w-[500px] h-[500px] bg-cyan-500/8 -top-20 -right-20" style={{ position: 'absolute' }} />
        <div className="gradient-orb w-[400px] h-[400px] bg-purple-500/6 bottom-10 -left-20" style={{ position: 'absolute' }} />
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'linear-gradient(rgba(0,229,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.012) 1px, transparent 1px)', backgroundSize: '80px 80px'}} />
        <div className="relative z-10 max-w-md">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-10 glow-cyan" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
            <Zap className="w-6 h-6 text-[var(--cyan)]" />
          </div>
          <h2 className="text-4xl font-black tracking-tighter mb-4 leading-[0.95]">
            Welcome<br />back<span style={{color:'var(--cyan)'}}>.</span>
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed text-sm">
            The system remembers. Your adaptive dashboard awaits.
          </p>
          <div className="mt-12 space-y-4">
            {['Real-time feedback loops', 'AI-powered matching', 'Verified credentials'].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-[var(--text-secondary)] text-sm animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
                <span className="status-dot status-dot-active" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-10 transition-colors" data-testid="login-back-btn">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <h1 className="text-3xl font-black tracking-tighter mb-1">Sign in</h1>
          <p className="text-[var(--text-muted)] text-sm mb-8">Enter your credentials</p>

          {error && <div className="badge-error p-3 mb-6 text-xs rounded-md" data-testid="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field py-3" placeholder="you@example.com" required data-testid="login-email-input" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="input-field py-3 pr-10" placeholder="Enter password" required data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-30" data-testid="login-submit-btn">
              {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" style={{ borderColor: 'var(--border-subtle)' }} /></div>
            <div className="relative flex justify-center"><span className="px-3 text-[10px] font-mono text-[var(--text-muted)]" style={{ background: 'var(--bg-void)' }}>OR</span></div>
          </div>

          <button onClick={() => {
            // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
            const redirectUrl = window.location.origin + '/dashboard/student';
            window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
          }} className="btn-secondary w-full py-3 flex items-center justify-center gap-3 text-xs" data-testid="google-login-btn">
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <p className="mt-6 text-xs text-[var(--text-muted)] text-center">
            No account?{' '}
            <button onClick={() => router.push('/register')} className="text-[var(--cyan)] font-medium hover:underline" data-testid="login-register-link">Create one</button>
            {' / '}
            <button onClick={() => router.push('/forgot-password')} className="text-[var(--text-secondary)] hover:underline" data-testid="login-forgot-link">Reset</button>
          </p>
        </div>
      </div>
    </div>
  );
}
