'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Runs on every page (via root layout). Checks connection to the app/API
 * by calling /api/health. Does not use any env variables.
 */
export default function ConnectionGuard() {
  const pathname = usePathname();
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    setConnectionFailed(false);
    try {
      const res = await fetch('/api/health', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok === true) {
        setConnectionFailed(false);
      } else {
        setConnectionFailed(true);
      }
    } catch {
      setConnectionFailed(true);
    } finally {
      setChecking(false);
    }
  }, []);

  // Check on mount and when pathname changes (every page)
  useEffect(() => {
    if (pathname === '/maintenance') return;
    checkConnection();
  }, [pathname, checkConnection]);

  // Re-check when tab becomes visible (user comes back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pathname !== '/maintenance') {
        checkConnection();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pathname, checkConnection]);

  if (!connectionFailed) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[99998] bg-amber-500 text-amber-950 px-4 py-2 shadow flex items-center justify-center gap-3 flex-wrap"
    >
      <span className="text-sm font-medium">
        Connection problem. Please check your network and try again.
      </span>
      <button
        type="button"
        onClick={() => checkConnection()}
        disabled={checking}
        className="text-sm font-semibold bg-amber-950 text-amber-100 px-3 py-1 rounded hover:bg-amber-900 disabled:opacity-60"
      >
        {checking ? 'Checking…' : 'Retry'}
      </button>
    </div>
  );
}
