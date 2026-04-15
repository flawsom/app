'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Zap, Shield, BarChart3, ChevronRight, Play, Target, AlertTriangle, TrendingUp, Brain, Award, Users, Clock, Sun, Moon, Flame } from 'lucide-react';

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const num = parseFloat(target);
    if (isNaN(num)) { setDisplay(target); return; }
    const duration = 1500; const startTime = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Number.isInteger(num) ? Math.round(num * eased).toString() : (num * eased).toFixed(1));
      if (p < 1) requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver((e) => { if (e[0].isIntersecting) { tick(); obs.disconnect(); } }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <span ref={ref}>{display}{suffix}</span>;
}

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  // Probability Demo state
  const [demoSkills, setDemoSkills] = useState('');
  const [demoCgpa, setDemoCgpa] = useState('');
  const [demoResult, setDemoResult] = useState<{probability: number; verdict: string; tip: string} | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  // Roast state
  const [roastSkills, setRoastSkills] = useState('');
  const [roastResult, setRoastResult] = useState<{score: number; roast: string; percentile: number; improvements: string[]} | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (user && user !== false && user !== null) router.push(`/dashboard/${user.role}`);
  }, [user, router]);

  useEffect(() => {
    if (!mounted) return;
    (async () => { try {
      const g = await import('gsap'); const s = await import('gsap/ScrollTrigger');
      const gsap = g.default; gsap.registerPlugin(s.ScrollTrigger);
      gsap.utils.toArray('.reveal-section').forEach((el: any) => {
        gsap.fromTo(el, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } });
      });
      gsap.utils.toArray('.reveal-card').forEach((el: any, i: number) => {
        gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: i * 0.08, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
      });
    } catch {} })();
  }, [mounted]);

  const toggleTheme = () => {
    const next = !darkMode; setDarkMode(next);
    if (next) { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); document.body.style.background = '#010104'; document.body.style.color = '#F0F0F5'; localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); document.body.style.background = '#F5F5F7'; document.body.style.color = '#1A1A2E'; localStorage.setItem('theme', 'light'); }
  };

  const runDemo = () => {
    if (!demoSkills.trim()) return;
    setDemoLoading(true);
    setTimeout(() => {
      const skills = demoSkills.split(',').map(s => s.trim()).filter(Boolean);
      const cgpa = parseFloat(demoCgpa) || 7.0;
      const base = Math.min(skills.length * 12, 60); const cgpaBonus = Math.min((cgpa - 5) * 5, 20); const prob = Math.min(95, Math.max(8, base + cgpaBonus + Math.random() * 10));
      const verdict = prob > 65 ? 'Strong Match' : prob > 40 ? 'Moderate — Improvable' : 'Stretch — Action Needed';
      const tip = prob > 65 ? 'You match well. Apply to top roles within 24h for max advantage.' : prob > 40 ? `Add ${3 - Math.min(skills.length, 3)} more relevant skills to cross 65%.` : 'Your profile needs work. Focus on building 2-3 core skills first.';
      setDemoResult({ probability: Math.round(prob), verdict, tip });
      setDemoLoading(false);
    }, 800);
  };

  const runRoast = () => {
    if (!roastSkills.trim()) return;
    const skills = roastSkills.split(',').map(s => s.trim()).filter(Boolean);
    const score = Math.min(95, skills.length * 11 + Math.random() * 15);
    const percentile = Math.min(99, Math.round(score * 0.9 + Math.random() * 10));
    const roasts = [
      score > 70 ? `Not bad. You're in the top ${100 - percentile}%. But "not bad" doesn't get offers.` : score > 40 ? `You're in the bottom ${percentile}%. ${100 - percentile}% of students would beat you for the same role.` : `Brutal truth: with ${skills.length} skill${skills.length === 1 ? '' : 's'}, you'll get auto-rejected by ${90 + Math.round(Math.random()*8)}% of companies. ATS won't even see your resume.`,
    ];
    const improvements = [];
    if (skills.length < 3) improvements.push(`Add ${3 - skills.length} more in-demand skills (React, Python, SQL are safe bets)`);
    if (skills.length < 5) improvements.push('Your skill set is too narrow. Employers want T-shaped candidates.');
    improvements.push('Most students have 6+ skills listed. You need to catch up.');
    if (score < 60) improvements.push('At your current level, you need 3x more applications to get 1 interview.');
    setRoastResult({ score: Math.round(score), roast: roasts[0], percentile, improvements: improvements.slice(0, 3) });
  };

  if (!mounted) return null;

  return (
    <div data-testid="landing-page">
      {/* ═══ NAV ═══ */}
      <nav className="fixed top-0 w-full z-50 glass-strong" data-testid="landing-nav">
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <span className="text-black font-bold text-xs">U</span>
            </div>
            <span className="font-bold text-lg tracking-tight">UNIFY</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={toggleTheme} className="p-2 hover:bg-white/5 rounded-md transition-colors" data-testid="landing-theme-toggle">
              {darkMode ? <Sun className="w-4 h-4 text-[var(--text-muted)]" /> : <Moon className="w-4 h-4 text-[var(--text-muted)]" />}
            </button>
            <button onClick={() => router.push('/login')} className="btn-secondary text-xs px-3 sm:px-5 py-2 sm:py-2.5 magnetic-btn" data-testid="nav-login-btn">Sign In</button>
            <button onClick={() => router.push('/register')} className="btn-primary text-xs px-3 sm:px-5 py-2 sm:py-2.5 magnetic-btn" data-testid="nav-register-btn">
              <span className="hidden sm:inline">Get Started</span><span className="sm:hidden">Start</span> <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO — Pain → Outcome ═══ */}
      <section className="relative min-h-screen flex items-center overflow-hidden hero-grid">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.04] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-24 pb-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7">
              <div className="hero-badge inline-flex items-center gap-2.5 px-4 py-2 glass rounded-full mb-8">
                <span className="status-dot status-dot-active" />
                <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wider">INTELLIGENCE ENGINE ACTIVE</span>
              </div>

              <div className="overflow-hidden mb-2"><h1 className="hero-line-1 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.92] tracking-tighter">Stop wasting</h1></div>
              <div className="overflow-hidden mb-2"><h1 className="hero-line-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[0.92] tracking-tighter">applications.</h1></div>
              <div className="overflow-hidden mb-6 sm:mb-8"><h1 className="hero-line-3 text-2xl sm:text-3xl md:text-4xl font-black leading-[1.05] tracking-tight text-[var(--cyan)] glow-text">Apply where you can win.</h1></div>

              <p className="hero-sub text-base sm:text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed mb-8 sm:mb-10">
                See your hiring probability <strong className="text-white">before</strong> you apply. The system learns from every outcome and gets smarter with every user.
              </p>

              <div className="hero-cta-group flex flex-col sm:flex-row gap-4">
                <button onClick={() => router.push('/register')} className="btn-primary text-sm px-8 py-3.5 magnetic-btn group" data-testid="hero-get-started-btn">
                  <span className="relative z-10 flex items-center gap-2">
                    See Your Probability <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                <button onClick={() => document.getElementById('demo')?.scrollIntoView({behavior: 'smooth'})} className="btn-secondary text-sm px-6 py-3.5 magnetic-btn flex items-center gap-2" data-testid="hero-try-demo-btn">
                  <Play className="w-3.5 h-3.5" /> Try Free Demo
                </button>
              </div>
            </div>

            {/* Right — Live probability card */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="space-y-4">
                <div className="hero-card-1 glass p-6 rounded-lg glow-cyan">
                  <div className="flex items-center gap-3 mb-3">
                    <Target className="w-5 h-5 text-[#00E5FF]" />
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">HIRING PROBABILITY</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <span className="text-6xl font-black font-mono text-[#00E5FF]"><AnimatedCounter target="72" suffix="%" /></span>
                    <div className="pb-2"><span className="text-xs font-semibold text-[#22C55E] block">Strong Match</span><span className="text-[10px] text-[var(--text-muted)] font-mono">Backend Dev @ TechCorp</span></div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                    {[{l:'Skills',v:90,c:'#22C55E'},{l:'Exp',v:40,c:'#EAB308'},{l:'Comp',v:70,c:'#00E5FF'},{l:'Profile',v:80,c:'#A855F7'},{l:'Time',v:60,c:'#3B82F6'}].map(f => (
                      <div key={f.l}><div className="h-12 bg-[var(--bg-elevated)] rounded-sm overflow-hidden relative"><div className="absolute bottom-0 w-full rounded-sm transition-all duration-1000" style={{height:`${f.v}%`,background:f.c}} /></div><span className="text-[8px] font-mono text-[var(--text-muted)] mt-1 block">{f.l}</span></div>
                    ))}
                  </div>
                </div>
                <div className="hero-card-2 glass p-5 rounded-lg flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
                  <div><p className="text-xs font-bold text-red-400">Apply in next 6 hours</p><p className="text-[10px] text-[var(--text-muted)] font-mono">+18% higher chance vs tomorrow</p></div>
                </div>
                <div className="hero-card-3 glass p-5 rounded-lg flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#22C55E]/10 border border-[#22C55E]/20"><TrendingUp className="w-5 h-5 text-[#22C55E]" /></div>
                  <div><p className="text-xs font-bold text-[#22C55E]">Model v47 — Self-learning</p><p className="text-[10px] text-[var(--text-muted)] font-mono">Gets smarter with every outcome</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float z-10">
          <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest">SCROLL</span>
          <div className="w-px h-8 bg-gradient-to-b from-[var(--cyan)] to-transparent" />
        </div>
      </section>

      {/* ═══ PROBLEM — Agitate ═══ */}
      <section className="py-24 reveal-section">
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center">
          <span className="overline block mb-6">THE PROBLEM</span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tighter leading-[0.95] mb-12">
            Applied to 100 jobs.<br /><span className="text-[var(--text-muted)]">Zero replies.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <AlertTriangle className="w-6 h-6" />, pain: "Competing blindly", desc: "You don't know who else applied. You don't know your odds. You're guessing." },
              { icon: <Clock className="w-6 h-6" />, pain: "Wasting time", desc: "Hours on applications that have 3% chance. Nobody told you." },
              { icon: <Target className="w-6 h-6" />, pain: "No direction", desc: "What skill to learn next? Which job to target? No one knows." },
            ].map((p, i) => (
              <div key={i} className="reveal-card card text-left" style={{ borderTop: '2px solid #EF4444' }}>
                <div className="text-red-400 mb-3">{p.icon}</div>
                <h3 className="font-bold text-sm mb-2">{p.pain}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE DIFFERENCE — Comparison ═══ */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-4xl mx-auto px-6 md:px-10 reveal-section">
          <span className="overline block mb-6 text-center">THE DIFFERENCE</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-center mb-12">
            Others show jobs.<br /><span className="glow-text" style={{color:'var(--cyan)'}}>UNIFY shows probability.</span>
          </h2>
          <div className="overflow-x-auto rounded-lg">
            <div className="min-w-[320px] grid grid-cols-2 gap-px rounded-lg overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
            {[
              ['Everyone Else', 'UNIFY'],
              ['Random apply', 'Strategic apply'],
              ['Guessing', 'Data-driven decisions'],
              ['Effort does not equal outcome', 'Effort mapped to probability'],
              ['Static job listings', 'Self-learning match engine'],
              ['No feedback', 'Real-time improvement signals'],
            ].map((row, i) => (
              <React.Fragment key={i}>
                <div className={`p-4 ${i === 0 ? 'font-bold text-xs text-[var(--text-muted)]' : 'text-xs text-[var(--text-secondary)]'}`} style={{ background: i === 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}>{row[0]}</div>
                <div className={`p-4 ${i === 0 ? 'font-bold text-xs text-[var(--cyan)]' : 'text-xs'}`} style={{ background: i === 0 ? 'var(--bg-elevated)' : 'var(--bg-surface)' }}>{row[1]}</div>
              </React.Fragment>
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PROBABILITY DEMO — Interactive ═══ */}
      <section id="demo" className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-3xl mx-auto px-6 md:px-10 reveal-section">
          <span className="overline block mb-6 text-center">TRY IT NOW</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-center mb-4">
            What are your <span className="glow-text" style={{color:'var(--cyan)'}}>real</span> chances?
          </h2>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-10 max-w-md mx-auto">Enter your skills and CGPA. Get your hiring probability in 2 seconds. No signup needed.</p>

          <div className="card-glow p-6 md:p-8" data-testid="probability-demo">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2">YOUR SKILLS (COMMA-SEPARATED)</label>
                <input value={demoSkills} onChange={e => setDemoSkills(e.target.value)} className="input-field py-3" placeholder="React, Python, SQL, Machine Learning..." data-testid="demo-skills-input" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2">CGPA</label>
                <input type="number" step="0.1" value={demoCgpa} onChange={e => setDemoCgpa(e.target.value)} className="input-field py-3" placeholder="8.5" data-testid="demo-cgpa-input" />
              </div>
            </div>
            <button onClick={runDemo} disabled={demoLoading || !demoSkills.trim()} className="btn-primary w-full py-3 text-sm disabled:opacity-30" data-testid="demo-calculate-btn">
              {demoLoading ? 'Calculating...' : 'Calculate My Probability'}
            </button>

            {demoResult && (
              <div className="mt-6 p-5 glass rounded-lg animate-fade-in" data-testid="demo-result">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">YOUR HIRE PROBABILITY</span>
                    <div className="flex items-end gap-3 mt-1">
                      <span className="text-5xl font-black font-mono" style={{ color: demoResult.probability > 65 ? '#22C55E' : demoResult.probability > 40 ? '#EAB308' : '#EF4444' }}>{demoResult.probability}%</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-sm mb-2 ${demoResult.probability > 65 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : demoResult.probability > 40 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{demoResult.verdict}</span>
                    </div>
                  </div>
                  <Target className="w-8 h-8 text-[var(--cyan)]" />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4">{demoResult.tip}</p>
                <button onClick={() => router.push('/register')} className="btn-primary text-xs px-6 py-2.5" data-testid="demo-signup-btn">
                  Get Full Analysis <ArrowRight className="inline w-3 h-3 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS — 3 Steps ═══ */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-4xl mx-auto px-6 md:px-10 reveal-section">
          <span className="overline block mb-6 text-center">HOW IT WORKS</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-center mb-16">Three steps. <span style={{color:'var(--cyan)'}}>Zero guesswork.</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Build your profile', desc: 'Add skills, upload resume. AI auto-scores and fills gaps.', icon: <Users className="w-6 h-6" /> },
              { step: '02', title: 'See your probability', desc: 'Every job shows your odds. Factors explained transparently.', icon: <Target className="w-6 h-6" /> },
              { step: '03', title: 'Follow the system', desc: 'AI tells you exactly what to do next. Your odds improve daily.', icon: <TrendingUp className="w-6 h-6" /> },
            ].map((s, i) => (
              <div key={i} className="reveal-card text-center">
                <div className="w-14 h-14 mx-auto mb-5 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)' }}>
                  <span className="text-[var(--cyan)]">{s.icon}</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">{s.step}</span>
                <h3 className="font-bold text-lg mt-1 mb-2">{s.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ROAST MY PROFILE — Viral Hook ═══ */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-3xl mx-auto px-6 md:px-10 reveal-section">
          <div className="text-center mb-10">
            <span className="overline block mb-4">REALITY CHECK</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-3">
              <span className="text-red-400">Roast</span> My Profile
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">Brutally honest. No sugar-coating. Find out where you actually stand.</p>
          </div>
          <div className="card p-6 md:p-8" style={{ borderTop: '3px solid #EF4444' }} data-testid="roast-section">
            <div className="mb-4">
              <label className="block text-[10px] font-mono text-[var(--text-muted)] mb-2">YOUR SKILLS</label>
              <input value={roastSkills} onChange={e => setRoastSkills(e.target.value)} className="input-field py-3" placeholder="Be honest. List everything you know..." data-testid="roast-input" />
            </div>
            <button onClick={runRoast} disabled={!roastSkills.trim()} className="w-full py-3 text-sm font-bold rounded-md transition-all disabled:opacity-30" style={{ background: '#EF4444', color: 'white' }} data-testid="roast-btn">
              <Flame className="inline w-4 h-4 mr-2" />Roast Me
            </button>
            {roastResult && (
              <div className="mt-6 animate-fade-in" data-testid="roast-result">
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center" style={{ borderColor: roastResult.score > 70 ? '#22C55E' : roastResult.score > 40 ? '#EAB308' : '#EF4444' }}>
                    <span className="text-2xl font-black font-mono" style={{ color: roastResult.score > 70 ? '#22C55E' : roastResult.score > 40 ? '#EAB308' : '#EF4444' }}>{roastResult.score}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-1">You are in the {roastResult.score > 70 ? 'top' : 'bottom'} {100 - roastResult.percentile}%</p>
                    <p className="text-xs text-[var(--text-secondary)]">{roastResult.roast}</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {roastResult.improvements.map((imp, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                      <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                      <span>{imp}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push('/register')} className="btn-primary text-xs w-full py-2.5" data-testid="roast-signup-btn">
                  Fix My Profile Now <ArrowRight className="inline w-3 h-3 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-6 md:px-10 reveal-section">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 mb-16">
            {[
              { value: '72', suffix: '%', label: 'HIGHER PLACEMENT RATE' },
              { value: '3.2', suffix: 'x', label: 'FASTER TO OFFER' },
              { value: '500', suffix: '+', label: 'ACTIVE USERS' },
              { value: '94', suffix: '%', label: 'MATCH ACCURACY' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl md:text-5xl font-black font-mono tracking-tighter glow-text" style={{ color: 'var(--cyan)' }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-2 tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Priya S.', dept: 'CS, IIT Bhubaneswar', quote: 'Got 3 offers in 2 weeks. The probability scores told me exactly where to focus.', metric: '72% hit rate' },
              { name: 'Rahul M.', dept: 'ECE, NIT Rourkela', quote: 'The system told me to learn Docker. 2 weeks later, my match scores jumped 30%.', metric: '+30% match' },
              { name: 'Ananya K.', dept: 'IT, KIIT', quote: 'I was applying randomly. UNIFY showed me I had 8% chance on most jobs. Changed everything.', metric: '8% to 65%' },
            ].map((t, i) => (
              <div key={i} className="reveal-card card">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">"{t.quote}"</p>
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-bold">{t.name}</p><p className="text-[10px] text-[var(--text-muted)]">{t.dept}</p></div>
                  <span className="text-[10px] font-mono px-2 py-1 bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 rounded-sm">{t.metric}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/[0.02] to-transparent" />
        <div className="max-w-4xl mx-auto px-6 md:px-10 text-center relative z-10 reveal-section">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter leading-[0.9] mb-4">
            If you don't use this,<br /><span className="text-[var(--text-muted)]">you're losing.</span>
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto text-sm">Every day without data is a day your competitors get ahead. The system is live. The model is learning.</p>
          <button onClick={() => router.push('/register')} className="btn-primary text-base px-10 py-4 magnetic-btn" data-testid="final-cta-btn">
            See My Probability Now <ArrowRight className="inline w-5 h-5 ml-2" />
          </button>
          <p className="text-[10px] text-[var(--text-muted)] mt-4 font-mono">Free forever. No credit card. 30 seconds to start.</p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-10" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-sm flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <span className="text-black font-bold text-[8px]">U</span>
            </div>
            <span className="font-bold text-[var(--text-secondary)]">UNIFY</span>
          </div>
          <p className="font-mono text-[10px]">STOP GUESSING. START WINNING.</p>
        </div>
      </footer>
    </div>
  );
}
