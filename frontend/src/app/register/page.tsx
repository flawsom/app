'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, GraduationCap, Users, Briefcase, BarChart3 } from 'lucide-react';

const ROLES = [
  { id: 'student', label: 'Student', icon: <GraduationCap className="w-5 h-5" />, desc: 'AI matching, leaderboard, momentum tracking' },
  { id: 'mentor', label: 'Faculty Mentor', icon: <Users className="w-5 h-5" />, desc: 'Approve applications, guide students' },
  { id: 'employer', label: 'Employer', icon: <Briefcase className="w-5 h-5" />, desc: 'Post jobs, review candidates, certify' },
  { id: 'placement', label: 'Placement Officer', icon: <BarChart3 className="w-5 h-5" />, desc: 'Analytics, reports, system oversight' },
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user !== false && user !== null) router.push(`/dashboard/${user.role}`);
  }, [user, router]);

  if (user && user !== false && user !== null) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setLoading(true);
    try { await register(email, password, name, role); } catch (err: any) { setError(err.message || 'Registration failed'); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 md:p-10" style={{ background: 'var(--bg-void)' }} data-testid="register-page">
      <div className="gradient-orb w-[500px] h-[500px] bg-purple-500/6 top-0 left-0" style={{ position: 'fixed' }} />
      <div className="gradient-orb w-[400px] h-[400px] bg-cyan-500/5 bottom-0 right-0" style={{ position: 'fixed' }} />
      <div className="w-full max-w-lg relative z-10">
        <button onClick={() => step > 1 ? setStep(1) : router.push('/')} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-10 transition-colors" data-testid="register-back-btn">
          <ArrowLeft className="w-3.5 h-3.5" /> {step > 1 ? 'Back' : 'Home'}
        </button>

        <div className="w-10 h-10 rounded-md flex items-center justify-center mb-6" style={{ background: 'var(--gradient-primary)' }}>
          <span className="text-black font-bold text-sm">U</span>
        </div>

        {step === 1 ? (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-black tracking-tighter mb-1">Join UNIFY</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">Select your role to enter the system</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ROLES.map(r => (
                <button key={r.id} onClick={() => { setRole(r.id); setStep(2); }}
                  className="card group text-left" data-testid={`register-role-${r.id}`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="text-[var(--cyan)] group-hover:scale-110 transition-transform">{r.icon}</span>
                    <span className="font-bold text-sm">{r.label}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-black tracking-tighter mb-1">Create account</h1>
            <p className="text-[var(--text-muted)] text-sm mb-8">
              Registering as <span className="font-bold text-[var(--cyan)] capitalize">{role}</span>
            </p>
            {error && <div className="badge-error p-3 mb-6 text-xs rounded-md" data-testid="register-error">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">{role === 'employer' ? 'Company Name' : 'Full Name'}</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field py-3" placeholder={role === 'employer' ? 'Acme Corp' : 'Siba Prasad Panda'} required data-testid="register-name-input" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field py-3" placeholder="you@example.com" required data-testid="register-email-input" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2 uppercase tracking-wider">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field py-3" placeholder="Min. 6 characters" required data-testid="register-password-input" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-30" data-testid="register-submit-btn">
                {loading ? 'CREATING...' : 'CREATE ACCOUNT'}
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
            }} className="btn-secondary w-full py-3 flex items-center justify-center gap-3 text-xs" data-testid="google-register-btn">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--text-muted)] text-center">
          Already have an account?{' '}
          <button onClick={() => router.push('/login')} className="text-[var(--cyan)] font-medium hover:underline" data-testid="register-login-link">Sign in</button>
        </p>
      </div>
    </div>
  );
}
