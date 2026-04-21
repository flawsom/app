'use client';

import { useEffect } from 'react';

// PostHog is initialized lazily (no-op when key missing).
let _posthog: any = null;
export function getPostHog() {
  return _posthog;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!key || _posthog) return;
    (async () => {
      try {
        const mod = await import('posthog-js');
        mod.default.init(key, {
          api_host: host,
          capture_pageview: true,
          capture_pageleave: true,
          person_profiles: 'identified_only',
          loaded: (ph) => {
            _posthog = ph;
            if (process.env.NODE_ENV === 'development') ph.debug?.(false);
          },
        });
      } catch (e) {
        console.warn('[UNIFY] PostHog init failed:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    (async () => {
      try {
        const Sentry = await import('@sentry/nextjs');
        if (Sentry.getClient && Sentry.getClient()) return;
        Sentry.init({
          dsn,
          environment: process.env.NEXT_PUBLIC_SENTRY_ENV || 'production',
          tracesSampleRate: 0.1,
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0.1,
        });
      } catch (e) {
        console.warn('[UNIFY] Sentry init failed:', e);
      }
    })();
  }, []);

  return <>{children}</>;
}
