'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client-side guard to redirect to maintenance page when on maintenance.
 * Catches browser back/forward cache (bfcache) and client-side navigations
 * that might bypass middleware.
 */
export default function MaintenanceGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (pathname === '/maintenance') return;

      try {
        const res = await fetch('/api/check-maintenance', { cache: 'no-store' });
        const data = await res.json();
        if (data?.onMaintenance) {
          router.replace('/maintenance');
        }
      } catch {
        // Ignore errors - middleware handles server requests
      }
    };

    checkAndRedirect();
  }, [pathname, router]);

  // Handle browser back/forward cache - page can be restored without middleware running
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache
        checkMaintenanceAndRedirect();
      }
    };

    const checkMaintenanceAndRedirect = async () => {
      if (typeof window === 'undefined' || window.location.pathname === '/maintenance') return;

      try {
        const res = await fetch('/api/check-maintenance', { cache: 'no-store' });
        const data = await res.json();
        if (data?.onMaintenance) {
          window.location.replace('/maintenance');
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  return null;
}
