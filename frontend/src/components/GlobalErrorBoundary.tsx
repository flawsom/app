'use client';

import React from 'react';

interface State { hasError: boolean; err?: Error }

export class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, err };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    // Best-effort: report to Sentry if loaded
    const anyWin = typeof window !== 'undefined' ? (window as any) : null;
    if (anyWin?.Sentry?.captureException) {
      try { anyWin.Sentry.captureException(err, { extra: info }); } catch {}
    }
    // eslint-disable-next-line no-console
    console.error('[UNIFY] Unhandled UI error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6"
             style={{ background: '#010104', color: '#F0F0F5' }}>
          <div className="max-w-md text-center space-y-4">
            <div className="text-[10px] font-mono tracking-[0.3em] text-[#00E5FF]">UNIFY — ERROR</div>
            <h1 className="text-3xl font-black tracking-tighter">Something broke.</h1>
            <p className="text-sm text-white/60">
              We’ve logged the error. Refresh to retry. If it persists, email support@unifies.codes.
            </p>
            <button onClick={() => location.reload()}
                    className="mt-4 px-4 py-2 rounded-md bg-white text-black text-xs font-bold tracking-wider">
              RELOAD
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
