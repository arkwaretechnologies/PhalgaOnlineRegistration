'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Client-side guard to redirect to maintenance page when on maintenance.
 * When on /register?confcode=XXX, passes confcode to check-maintenance so the correct venue is checked.
 */
export default function MaintenanceGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const confcode = pathname === '/register' ? searchParams.get('confcode') : null;

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (pathname === '/maintenance') return;

      try {
        const url = confcode
          ? `/api/check-maintenance?confcode=${encodeURIComponent(confcode)}`
          : '/api/check-maintenance';
        const res = await fetch(url, {
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
  }, [pathname, confcode]);

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
        const params = new URLSearchParams(window.location.search);
        const confcodeParam = window.location.pathname === '/register' ? params.get('confcode') : null;
        const url = confcodeParam
          ? `/api/check-maintenance?confcode=${encodeURIComponent(confcodeParam)}`
          : '/api/check-maintenance';
        const res = await fetch(url, {
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
