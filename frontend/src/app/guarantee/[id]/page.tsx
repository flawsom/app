'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Award, TrendingUp, Loader2, XCircle, ArrowLeft } from 'lucide-react';

interface BadgeData {
  verified: boolean;
  user_id: string;
  display_name: string;
  probability: number;
  confidence_level: 'high' | 'medium' | 'low';
  applications: number;
  certificates: number;
  skills_count?: number;
  department?: string;
  message: string;
  issued_at: string;
  share_url: string;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low:    'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',
};

export default function PlacementGuaranteePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.REACT_APP_BACKEND_URL || '';
    fetch(`${apiUrl}/api/public/probability/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Profile not found' : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div data-testid="guarantee-loading" className="min-h-screen bg-[#010104] flex items-center justify-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="font-mono text-xs">VERIFYING ON UNIFY…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div data-testid="guarantee-not-found" className="min-h-screen bg-[#010104] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-white mb-1">Profile not verifiable</h1>
          <p className="text-sm text-zinc-500 mb-6">{error || 'No UNIFY score found for this ID.'}</p>
          <Link href="/" className="inline-flex items-center gap-2 text-[#00E5FF] text-sm hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to UNIFY
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.round(data.probability * 100);
  const ciColor = CONFIDENCE_COLORS[data.confidence_level] || CONFIDENCE_COLORS.low;
  const issued = new Date(data.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#010104] text-zinc-100 flex items-center justify-center px-4 py-12">
      <div
        data-testid="guarantee-card"
        className="w-full max-w-md border border-zinc-800/80 rounded-2xl p-8 bg-gradient-to-b from-zinc-900/40 to-zinc-950 shadow-2xl shadow-cyan-500/5"
      >
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="w-5 h-5 text-[#00E5FF]" />
          <span className="text-[10px] tracking-[0.2em] text-zinc-500 font-mono">UNIFY · PLACEMENT GUARANTEE</span>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Verified Candidate</p>
          <h1 data-testid="guarantee-name" className="text-3xl font-semibold text-white">{data.display_name}</h1>
          {data.department && <p className="text-sm text-zinc-400 mt-1">{data.department}</p>}
        </div>

        <div className="bg-black/50 rounded-xl p-6 border border-zinc-800/60 mb-6">
          <div className="flex items-baseline gap-2">
            <span data-testid="guarantee-probability" className="text-6xl font-bold text-[#00E5FF] tabular-nums">{pct}%</span>
            <span className="text-sm text-zinc-500 font-mono">hire probability</span>
          </div>
          <p className="text-xs text-zinc-400 mt-2">
            Computed live against the latest active roles using UNIFY's self-learning hiring model.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span
              data-testid="guarantee-confidence"
              className={`text-[10px] uppercase font-mono tracking-[0.15em] px-2 py-1 rounded border ${ciColor}`}
            >
              {data.confidence_level} confidence
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">v. {issued}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <Stat testid="guarantee-stat-apps" label="Applications" value={data.applications} />
          <Stat testid="guarantee-stat-certs" label="Certificates" value={data.certificates} />
          <Stat testid="guarantee-stat-skills" label="Skills" value={data.skills_count ?? 0} />
        </div>

        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4 flex gap-3 items-start">
          <Award className="w-4 h-4 text-[#00E5FF] mt-0.5 shrink-0" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <span className="text-[#00E5FF] font-semibold">UNIFY verified.</span> This probability is refreshed
            on every view from the current self-learning model — not cached, not paid-for. Employers can
            <Link href="/dashboard/employer" className="text-[#00E5FF] hover:underline"> rank candidates </Link>
            directly by this score.
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <Link href="/" className="hover:text-[#00E5FF] inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> unify.codes
          </Link>
          <a
            href={`https://twitter.com/intent/tweet?text=I%27m%20UNIFY-verified%20at%20${pct}%25%20hire%20probability%20%E2%80%94%20${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
            target="_blank"
            rel="noreferrer"
            data-testid="guarantee-share-twitter"
            className="inline-flex items-center gap-1 hover:text-[#00E5FF]"
          >
            <TrendingUp className="w-3 h-3" /> Share score
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: number; testid: string }) {
  return (
    <div data-testid={testid} className="bg-zinc-900/40 rounded-lg py-3 border border-zinc-800/60">
      <div className="text-xl font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1 font-mono">{label}</div>
    </div>
  );
}
