'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import ForgotPasswordInner from './ForgotPasswordInner';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}