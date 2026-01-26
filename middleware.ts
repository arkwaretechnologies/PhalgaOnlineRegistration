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

export function middleware(request: NextRequest) {
  // Only apply to API routes
  const path = request.nextUrl.pathname;
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
  matcher: '/api/:path*',
};
