'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Zap, Shield, BarChart3, ChevronRight, Play } from 'lucide-react';

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let mouse = { x: 0, y: 0 };
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }

    const onMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener('mousemove', onMouse);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          p.vx -= dx * 0.00005;
          p.vy -= dy * 0.00005;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${p.alpha})`;
        ctx.fill();

        particles.forEach((p2, j) => {
          if (j <= i) return;
          const d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 229, 255, ${0.06 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" style={{ pointerEvents: 'none' }} />;
}

function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const num = parseFloat(target);
    if (isNaN(num)) { setDisplay(target); return; }
    let start = 0;
    const duration = 1500;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (num - start) * eased * 10) / 10;
      setDisplay(Number.isInteger(num) ? Math.round(current).toString() : current.toFixed(1));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { tick(); observer.disconnect(); }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{display}{suffix}</span>;
}

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (user && user !== false && user !== null) router.push(`/dashboard/${user.role}`);
  }, [user, router]);

  useEffect(() => {
    if (!mounted) return;
    const initGSAP = async () => {
      try {
        const gsapModule = await import('gsap');
        const scrollModule = await import('gsap/ScrollTrigger');
        const gsap = gsapModule.default;
        gsap.registerPlugin(scrollModule.ScrollTrigger);

        // Only scroll-triggered sections (hero uses CSS animations)
        gsap.utils.toArray('.reveal-section').forEach((el: any) => {
          gsap.fromTo(el, { y: 60, opacity: 0 }, {
            y: 0, opacity: 1, duration: 1, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 50%', toggleActions: 'play none none reverse' }
          });
        });

        gsap.utils.toArray('.reveal-card').forEach((el: any, i: number) => {
          gsap.fromTo(el, { y: 40, opacity: 0, scale: 0.97 }, {
            y: 0, opacity: 1, scale: 1, duration: 0.8, delay: i * 0.08, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' }
          });
        });
      } catch (e) { console.log('GSAP scroll init:', e); }
    };
    initGSAP();
  }, [mounted]);

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
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/login')} className="btn-secondary text-xs px-5 py-2.5 magnetic-btn" data-testid="nav-login-btn">Sign In</button>
            <button onClick={() => router.push('/register')} className="btn-primary text-xs px-5 py-2.5 magnetic-btn" data-testid="nav-register-btn">
              Get Started <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden hero-grid">
        {/* Subtle gradient orbs - positioned carefully to not overlap text */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.04] blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-24 pb-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-7">
              <div className="hero-badge inline-flex items-center gap-2.5 px-4 py-2 glass rounded-full mb-8">
                <span className="status-dot status-dot-active" />
                <span className="text-[10px] font-mono text-[var(--text-secondary)] tracking-wider">SYSTEM OPERATIONAL</span>
              </div>

              <div className="overflow-hidden mb-3">
                <h1 className="hero-line-1 text-[clamp(3rem,8vw,6.5rem)] font-black leading-[0.9] tracking-tighter text-white">
                  FIND
                </h1>
              </div>
              <div className="overflow-hidden mb-3">
                <h1 className="hero-line-2 text-[clamp(3rem,8vw,6.5rem)] font-black leading-[0.9] tracking-tighter text-white">
                  YOUR
                </h1>
              </div>
              <div className="overflow-hidden mb-8">
                <h1 className="hero-line-3 text-[clamp(3rem,8vw,6.5rem)] font-black leading-[0.9] tracking-tighter text-[#00E5FF] glow-text">
                  EDGE<span className="text-[#8B5CF6]">.</span>
                </h1>
              </div>

              <p className="hero-sub text-lg text-[var(--text-secondary)] max-w-md leading-relaxed mb-10">
                AI-powered matching. Real-time feedback loops.
                A system that evolves with every action you take.
              </p>

              <div className="hero-cta-group flex gap-4">
                <button onClick={() => router.push('/register')} className="btn-primary text-sm px-8 py-3.5 magnetic-btn group" data-testid="hero-get-started-btn">
                  <span className="relative z-10 flex items-center gap-2">
                    Enter System <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                <button onClick={() => document.getElementById('systems')?.scrollIntoView({behavior: 'smooth'})} className="btn-secondary text-sm px-6 py-3.5 magnetic-btn flex items-center gap-2" data-testid="hero-learn-more-btn">
                  <Play className="w-3.5 h-3.5" /> Explore
                </button>
              </div>
            </div>

            {/* Right side cards */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="space-y-4">
                {[
                  { icon: <Zap className="w-5 h-5" />, label: 'AI Match Score', value: '94', suffix: '%', sub: 'GPT-5.2 Powered', color: '#00E5FF', glow: 'glow-cyan', anim: 'hero-card-1' },
                  { icon: <Shield className="w-5 h-5" />, label: 'Verified Hash', value: 'SHA256', suffix: '', sub: 'Blockchain Sealed', color: '#22C55E', glow: 'glow-purple', anim: 'hero-card-2' },
                  { icon: <BarChart3 className="w-5 h-5" />, label: 'Placement Rate', value: '87.5', suffix: '%', sub: 'Live Analytics', color: '#EAB308', glow: '', anim: 'hero-card-3' },
                ].map((item, i) => (
                  <div key={i} className={`${item.anim} glass flex items-center gap-5 p-5 rounded-lg group cursor-default ${item.glow}`}>
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#06060C] border border-white/5 group-hover:border-[#00E5FF]/20 transition-colors" style={{ color: item.color }}>
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-mono text-[#B0B0C0] tracking-wider">{item.label}</p>
                      <p className="font-mono font-bold text-2xl" style={{ color: item.color }}>
                        {item.suffix === '%' ? <AnimatedCounter target={item.value} suffix="%" /> : item.value}
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-[#9090A8]">{item.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float z-10">
          <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest">SCROLL</span>
          <div className="w-px h-8 bg-gradient-to-b from-[var(--cyan)] to-transparent" />
        </div>
      </section>

      {/* ═══ SYSTEMS ═══ */}
      <section id="systems" className="relative py-32 overflow-hidden">
        <div className="gradient-orb w-[400px] h-[400px] bg-purple-500/5 top-20 right-20" style={{ position: 'absolute' }} />
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="reveal-section mb-16">
            <span className="overline block mb-4">ARCHITECTURE</span>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]">
              Five Core<br /><span className="glow-text" style={{color:'var(--cyan)'}}>Systems</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { num: '01', title: 'Command Center', desc: 'Real-time system view. Live activity, progress, AI suggestions.', accent: 'var(--cyan)' },
              { num: '02', title: 'Match Engine', desc: 'AI recommendations with transparent scoring logic.', accent: 'var(--green)' },
              { num: '03', title: 'Profile Engine', desc: 'Dynamic capability model with strength analysis.', accent: 'var(--amber)' },
              { num: '04', title: 'Feedback Engine', desc: 'Behavior-driven adaptation. The system learns from you.', accent: 'var(--blue)' },
              { num: '05', title: 'Momentum', desc: 'Streaks, XP, milestones. Feel your velocity.', accent: 'var(--purple)' },
            ].map((s, i) => (
              <div key={i} className="reveal-card card group cursor-default relative">
                <div className="absolute top-0 left-0 w-12 h-0.5 transition-all duration-500 group-hover:w-full" style={{ background: s.accent }} />
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[10px] px-2 py-1 border rounded-sm transition-all duration-300" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{s.num}</span>
                  <h3 className="font-bold text-lg">{s.title}</h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="py-24 border-t border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="reveal-section grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
            {[
              { value: '94', suffix: '%', label: 'AVG MATCH ACCURACY' },
              { value: '500', suffix: '+', label: 'ACTIVE STUDENTS' },
              { value: '87.5', suffix: '%', label: 'PLACEMENT RATE' },
              { value: '50', suffix: '+', label: 'PARTNER COMPANIES' },
            ].map((s, i) => (
              <div key={i} className="text-center md:text-left">
                <p className="text-4xl md:text-5xl font-black font-mono tracking-tighter glow-text" style={{ color: 'var(--cyan)' }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-2 tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ROLES ═══ */}
      <section className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="reveal-section mb-16">
            <span className="overline block mb-4">STAKEHOLDERS</span>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter">
              Built for<br /><span style={{color:'var(--purple)'}}>every role</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { role: 'Students', desc: 'AI matching, leaderboard, momentum tracking, skill analysis.' },
              { role: 'Mentors', desc: 'Application review, student progress, guided feedback.' },
              { role: 'Employers', desc: 'Post jobs, matched candidates, interviews, certificates.' },
              { role: 'Placement', desc: 'Analytics, reports, placement rates, system overview.' },
            ].map((item, i) => (
              <div key={i} className="reveal-card card group">
                <h4 className="font-bold text-lg mb-2 group-hover:text-[var(--cyan)] transition-colors">{item.role}</h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">{item.desc}</p>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--cyan)] group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-32 relative overflow-hidden">
        <div className="gradient-orb w-[500px] h-[500px] bg-cyan-500/8 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ position: 'absolute' }} />
        <div className="max-w-7xl mx-auto px-6 md:px-10 text-center relative z-10">
          <div className="reveal-section">
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.9] mb-6">
              READY<br />TO <span className="glow-text" style={{color:'var(--cyan)'}}>BEGIN</span><span style={{color:'var(--purple)'}}>?</span>
            </h2>
            <p className="text-[var(--text-secondary)] mb-10 max-w-md mx-auto">The system adapts to you. Every action shapes your path.</p>
            <button onClick={() => router.push('/register')} className="btn-primary text-base px-10 py-4 magnetic-btn" data-testid="cta-get-started-btn">
              Enter the System <ArrowRight className="inline w-5 h-5 ml-2" />
            </button>
          </div>
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
          <p className="font-mono text-[10px]">ADAPTIVE PLACEMENT INTELLIGENCE</p>
        </div>
      </footer>
    </div>
  );
}
