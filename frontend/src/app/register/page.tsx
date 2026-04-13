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
