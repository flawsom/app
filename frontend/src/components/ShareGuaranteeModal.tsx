'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { X, Copy, Linkedin, MessageCircle, ExternalLink, Check, Shield } from 'lucide-react';
import { useI18n } from '@/i18n';

interface Props {
  userId: string;
  displayName?: string;
  open: boolean;
  onClose: () => void;
}

interface PreviewData {
  display_name: string;
  probability: number;
  confidence_level: string;
  applications: number;
  certificates: number;
  skills_count: number;
  department?: string;
}

export function ShareGuaranteeModal({ userId, displayName, open, onClose }: Props) {
  const { locale } = useI18n();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/guarantee/${userId}`
      : `/guarantee/${userId}`;

  // Compelling share text per locale
  const shareText: Record<string, string> = {
    en: "I'm job-ready and verified by UNIFY. Check my live placement probability:",
    hi: 'मैं UNIFY द्वारा सत्यापित और नौकरी के लिए तैयार हूं। मेरी प्लेसमेंट प्रोबेबिलिटी देखें:',
    te: 'నేను UNIFY ద్వారా ధృవీకరించబడ్డాను మరియు ఉద్యోగానికి సిద్ధంగా ఉన్నాను. నా ప్లేస్‌మెంట్ ప్రోబబిలిటీ చూడండి:',
    ta: 'நான் UNIFY-ஆல் சரிபார்க்கப்பட்டுள்ளேன். என் நேரடி பிளேஸ்மென்ட் நிகழ்தகவைப் பாருங்கள்:',
    or: 'ମୁଁ UNIFY ଦ୍ୱାରା ଯାଞ୍ଚିତ ଏବଂ ଚାକିରି ପାଇଁ ପ୍ରସ୍ତୁତ। ମୋର ପ୍ଲେସମେଣ୍ଟ ସମ୍ଭାବନା ଦେଖନ୍ତୁ:',
  };

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiBase}/api/public/probability/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setPreview(data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Escape key closes + body-scroll-lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Copied', description: 'Share link copied to clipboard.' });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({ title: 'Copy failed', description: shareUrl, variant: 'destructive' });
    }
  };

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    shareUrl
  )}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `${shareText[locale] || shareText.en} ${shareUrl}`
  )}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${shareText[locale] || shareText.en}`
  )}&url=${encodeURIComponent(shareUrl)}`;

  if (!open) return null;

  const pct = preview ? Math.round((preview.probability || 0) * 100) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(1,1,4,0.82)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      data-testid="share-guarantee-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="relative w-full max-w-md rounded-xl border overflow-hidden"
        style={{ background: '#0C0C14', borderColor: '#22222A' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: '#22222A',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(139,92,246,0.06))',
          }}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00E5FF]" />
            <h2 id="share-modal-title" className="text-sm font-semibold text-white">
              Share your Placement Guarantee
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            data-testid="share-modal-close"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="px-5 pt-4">
          <p className="text-[10px] font-mono text-zinc-500 mb-2">LIVE PREVIEW</p>
          <div
            className="rounded-lg p-4 border"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.04), transparent)',
              borderColor: 'rgba(0,229,255,0.15)',
            }}
            data-testid="share-preview-card"
          >
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-24 bg-zinc-800 rounded" />
                <div className="h-8 w-32 bg-zinc-800 rounded" />
                <div className="h-3 w-40 bg-zinc-800 rounded" />
              </div>
            ) : preview ? (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {preview.display_name || displayName || 'UNIFY Student'}
                    </p>
                    {preview.department && (
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {preview.department}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30 rounded-sm">
                    UNIFY VERIFIED
                  </span>
                </div>
                <div className="flex items-end gap-2 mt-3">
                  <span className="text-4xl font-black font-mono text-[#00E5FF] tabular-nums">
                    {pct}%
                  </span>
                  <span className="pb-1 text-[10px] font-mono text-zinc-500 uppercase">
                    {preview.confidence_level} confidence
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-[10px] font-mono text-zinc-500">
                  <span>
                    <span className="text-zinc-300">{preview.applications}</span> apps
                  </span>
                  <span>
                    <span className="text-zinc-300">{preview.certificates}</span> certs
                  </span>
                  <span>
                    <span className="text-zinc-300">{preview.skills_count}</span> skills
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Preview unavailable.</p>
            )}
          </div>
        </div>

        {/* URL row */}
        <div className="px-5 pt-4">
          <div
            className="flex items-center gap-2 px-2.5 py-2 rounded-md border"
            style={{ background: 'rgba(0,0,0,0.4)', borderColor: '#22222A' }}
          >
            <code
              className="text-[10px] text-[#00E5FF] break-all font-mono flex-1"
              data-testid="share-modal-url"
            >
              {shareUrl}
            </code>
            <button
              onClick={copyLink}
              className="shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-[#00E5FF] text-black font-bold hover:opacity-90 transition-opacity"
              data-testid="share-modal-copy-btn"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
        </div>

        {/* Share targets */}
        <div className="px-5 py-4 grid grid-cols-3 gap-2">
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 py-3 rounded-md border text-xs font-semibold transition-all hover:border-[#0077B5]/50 hover:bg-[#0077B5]/5"
            style={{ borderColor: '#22222A', color: '#E6E6EA' }}
            data-testid="share-modal-linkedin"
          >
            <Linkedin className="w-4 h-4 text-[#0077B5]" />
            <span className="text-[10px]">LinkedIn</span>
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 py-3 rounded-md border text-xs font-semibold transition-all hover:border-[#25D366]/50 hover:bg-[#25D366]/5"
            style={{ borderColor: '#22222A', color: '#E6E6EA' }}
            data-testid="share-modal-whatsapp"
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            <span className="text-[10px]">WhatsApp</span>
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center gap-1 py-3 rounded-md border text-xs font-semibold transition-all hover:border-zinc-500 hover:bg-white/5"
            style={{ borderColor: '#22222A', color: '#E6E6EA' }}
            data-testid="share-modal-twitter"
          >
            <ExternalLink className="w-4 h-4 text-zinc-300" />
            <span className="text-[10px]">X / Twitter</span>
          </a>
        </div>

        {/* Footer CTA */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between"
          style={{ borderColor: '#22222A', background: 'rgba(0,0,0,0.3)' }}
        >
          <a
            href={`/guarantee/${userId}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-mono text-[#00E5FF] hover:underline inline-flex items-center gap-1"
            data-testid="share-modal-open-public"
          >
            OPEN PUBLIC PAGE <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <span className="text-[10px] font-mono text-zinc-600">Refreshes on every view</span>
        </div>
      </div>
    </div>
  );
}
