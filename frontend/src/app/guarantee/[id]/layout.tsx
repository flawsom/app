import type { Metadata } from 'next';

// UNIFY: Dynamic OG metadata for rich share previews on LinkedIn / WhatsApp / X.
// Runs on the server per request so previews always reflect the live probability.

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.unifies.codes';

interface Props {
  params: { id: string };
  children: React.ReactNode;
}

async function fetchBadge(userId: string) {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/public/probability/${userId}`, {
      // Revalidate every 10 minutes — rich preview cards cache heavily anyway.
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      display_name?: string;
      probability?: number;
      confidence_level?: string;
      department?: string;
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const badge = await fetchBadge(params.id);
  const name = badge?.display_name || 'A UNIFY-verified candidate';
  const pct = badge?.probability ? Math.round(badge.probability * 100) : null;
  const title = pct
    ? `${name} · ${pct}% UNIFY hire probability`
    : `${name} · UNIFY-verified placement profile`;
  const description = pct
    ? `${name} is job-ready and verified by UNIFY. Live hire probability: ${pct}% (${badge?.confidence_level || 'low'} confidence). See the full breakdown.`
    : 'Verified placement profile on UNIFY — the adaptive hiring engine. See live probability, skills, and certificates.';
  const canonical = `${SITE_URL}/guarantee/${params.id}`;
  // Clearbit-style OG image via our backend. Backend composes a branded PNG per user.
  const ogImage = `${SITE_URL}/og.png`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'UNIFY',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${name} — UNIFY-verified`,
        },
      ],
      locale: 'en_US',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

export default function GuaranteeLayout({ children }: Props) {
  return <>{children}</>;
}
