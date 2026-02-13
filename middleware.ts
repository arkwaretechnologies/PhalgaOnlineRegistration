import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIP } from '@/lib/security';

/**
 * Rate limit configuration for different endpoint types
 */
interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Rate limit configurations by endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Critical write operations - very strict
  critical: {
    limit: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Status check endpoints - moderate
  status: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Read operations - more lenient
  read: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
  },
};

// In-memory store for rate limit data
// Format: Map<"path:ip", RateLimitRecord>
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 60 seconds to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    // Use forEach to avoid iterator compatibility issues
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    });
  }, 60000); // Clean every minute
}

/**
 * Get rate limit configuration for a given path
 */
function getRateLimitConfig(path: string): RateLimitConfig {
  // Critical write endpoints
  if (
    path.includes('/submit-registration') ||
    path.includes('/upload-payment-proof') ||
    path.includes('/delete-payment-proof')
  ) {
    return RATE_LIMITS.critical;
  }

  // Status check endpoints
  if (path.includes('/check-registration') || path.includes('/check-province-lgu')) {
    return RATE_LIMITS.status;
  }

  // Default to read operations for all other endpoints
  return RATE_LIMITS.read;
}

/**
 * Check if request should be rate limited
 * @returns Object with isAllowed boolean and rate limit info
 */
function checkRateLimit(
  ip: string,
  path: string,
  config: RateLimitConfig
): {
  isAllowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = `${path}:${ip}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // If no record exists or window has expired, create new record
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      isAllowed: true,
      remaining: config.limit - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (record.count >= config.limit) {
    return {
      isAllowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  return {
    isAllowed: true,
    remaining: config.limit - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Check maintenance status via internal API (avoids Edge/Supabase compatibility issues)
 */
async function checkMaintenance(
  hostname: string,
  request: NextRequest
): Promise<boolean> {
  try {
    const baseUrl = request.nextUrl.origin;
    const url = new URL('/api/check-maintenance', baseUrl);
    const res = await fetch(url.toString(), {
      headers: {
        'x-maintenance-check-host': hostname,
      },
      cache: 'no-store',
    });
    const data = await res.json();
    return data?.onMaintenance === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow check-maintenance API through (needed for maintenance check)
  if (path === '/api/check-maintenance') {
    return NextResponse.next();
  }

  const hostname =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost';

  let onMaintenance = false;
  try {
    onMaintenance = await checkMaintenance(hostname, request);
  } catch (e) {
    console.warn('Maintenance check failed:', e);
  }

  // If on /maintenance but NOT on maintenance, redirect to landing page
  if (path === '/maintenance') {
    if (!onMaintenance) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (onMaintenance) {
    // Redirect page requests to maintenance page
    if (!path.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
    // Block API requests with 503
    return NextResponse.json(
      { error: 'System is currently under maintenance. Please try again later.' },
      { status: 503 }
    );
  }

  // Only apply rate limiting to API routes
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Extract client IP
  const ip = getClientIP(request);

  // Get rate limit configuration for this endpoint
  const config = getRateLimitConfig(path);

  // Check rate limit
  const rateLimitResult = checkRateLimit(ip, path, config);

  // Prepare response headers
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', config.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  headers.set(
    'X-RateLimit-Reset',
    new Date(rateLimitResult.resetTime).toISOString()
  );

  // If rate limit exceeded, return 429
  if (!rateLimitResult.isAllowed) {
    console.warn(
      `Rate limit exceeded for IP: ${ip}, Path: ${path}, Limit: ${config.limit}/${config.windowMs}ms`
    );
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers,
      }
    );
  }

  // Add rate limit headers to successful requests
  const response = NextResponse.next();
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|left.png|right.png|bg.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
