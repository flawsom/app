'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[UNIFY] Route error:', error);
    const anyWin = typeof window !== 'undefined' ? (window as any) : null;
    if (anyWin?.Sentry?.captureException) {
      try { anyWin.Sentry.captureException(error); } catch {}
    }
  }, [error]);
  return (
    <html lang="en">
      <body style={{ background: '#010104', color: '#F0F0F5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#00E5FF' }}>UNIFY — FATAL</div>
            <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', margin: '16px 0' }}>System offline.</h1>
            <p style={{ fontSize: 14, color: '#9999AA' }}>
              A fatal error interrupted UNIFY. Try again or contact support@unifies.codes.
            </p>
            <button onClick={() => reset()} style={{ marginTop: 16, padding: '8px 16px', background: 'white', color: 'black', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              TRY AGAIN
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
