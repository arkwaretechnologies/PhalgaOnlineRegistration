'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Client-side guard to redirect to maintenance page when on maintenance.
 * Uses full page redirect (window.location) so production always lands on maintenance page.
 * Catches browser back/forward cache (bfcache) and client-side navigations
 * that might bypass middleware.
 */
export default function MaintenanceGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (pathname === '/maintenance') return;

      try {
        const res = await fetch('/api/check-maintenance', {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        const data = await res.json();
        if (data?.onMaintenance === true) {
          window.location.replace('/maintenance');
        }
      } catch {
        // Ignore errors - middleware handles server requests
      }
    };

    checkAndRedirect();
  }, [pathname]);

  // Handle browser back/forward cache - page can be restored without middleware running
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkMaintenanceAndRedirect();
      }
    };

    const checkMaintenanceAndRedirect = async () => {
      if (typeof window === 'undefined' || window.location.pathname === '/maintenance') return;

      try {
        const res = await fetch('/api/check-maintenance', {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        const data = await res.json();
        if (data?.onMaintenance === true) {
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
