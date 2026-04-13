'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardRedirect() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user !== false && user !== null) {
      router.replace(`/dashboard/${user.role}`);
    } else if (user === false) {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center h-64" data-testid="dashboard-redirect">
      <p className="text-zinc-500">Redirecting to your dashboard...</p>
    </div>
  );
}
