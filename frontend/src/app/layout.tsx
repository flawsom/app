import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/lib/query-provider';
import { I18nProvider } from '@/i18n';
import { AnalyticsProvider } from '@/components/AnalyticsProvider';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.unifies.codes';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'UNIFY — Apply Where You Can Win',
    template: '%s | UNIFY',
  },
  description:
    'UNIFY is the adaptive placement intelligence platform that predicts hiring outcomes, closes skill gaps, and gets students to the right jobs — faster.',
  applicationName: 'UNIFY',
  keywords: ['UNIFY', 'placement', 'hiring', 'career', 'jobs', 'internships', 'ATS', 'AI'],
  authors: [{ name: 'UNIFY' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'UNIFY — Apply Where You Can Win',
    description:
      'Predict hiring probability. Close skill gaps. Apply where you can actually win. The adaptive placement intelligence platform.',
    url: SITE_URL,
    siteName: 'UNIFY',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'UNIFY' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UNIFY — Apply Where You Can Win',
    description:
      'Predict hiring probability. Close skill gaps. Apply where you can actually win.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: '#010104',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-title" content="UNIFY" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased" style={{ background: '#010104', color: '#F0F0F5' }}>
        <GlobalErrorBoundary>
          <AnalyticsProvider>
            <QueryProvider>
              <I18nProvider>
                <AuthProvider>
                  {children}
                </AuthProvider>
              </I18nProvider>
            </QueryProvider>
          </AnalyticsProvider>
        </GlobalErrorBoundary>
        {/* Google Identity Services — used by UNIFY Auth */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" async defer />
      </body>
    </html>
  );
}
