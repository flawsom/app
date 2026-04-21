'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: '#010104', color: '#F0F0F5' }}>
      <div className="max-w-md text-center space-y-4">
        <div className="text-[10px] font-mono tracking-[0.3em] text-[#00E5FF]">UNIFY — 404</div>
        <h1 className="text-5xl font-black tracking-tighter">Nothing here.</h1>
        <p className="text-sm text-white/60">
          The page you’re looking for isn’t part of UNIFIES. It may have moved,
          been renamed, or never existed.
        </p>
        <Link href="/"
              className="inline-block mt-4 px-4 py-2 rounded-md bg-white text-black text-xs font-bold tracking-wider">
          GO HOME
        </Link>
      </div>
    </div>
  );
}
