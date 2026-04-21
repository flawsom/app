'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[UNIFY] Route error:', error);
    const anyWin = typeof window !== 'undefined' ? (window as any) : null;
    if (anyWin?.Sentry?.captureException) {
      try { anyWin.Sentry.captureException(error); } catch {}
    }
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: '#010104', color: '#F0F0F5' }}>
      <div className="max-w-md text-center space-y-4">
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00E5FF]">UNIFY — ERROR</div>
        <h1 className="text-4xl font-black tracking-tighter">We hit a snag.</h1>
        <p className="text-sm text-white/60">{error?.message || 'An unexpected error occurred.'}</p>
        <button onClick={() => reset()}
                className="mt-4 px-4 py-2 rounded-md bg-white text-black text-xs font-bold tracking-wider">
          TRY AGAIN
        </button>
      </div>
    </div>
  );
}
