/**
 * Security utility functions for DDoS protection and request validation
 */

/**
 * Extract client IP address from request headers
 * Handles Railway and other proxy headers correctly
 */
export function getClientIP(request: Request): string {
  // Priority: x-forwarded-for (first IP) > x-real-ip > request headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to 'unknown' if no IP can be determined
  return 'unknown';
}

/**
 * Validate request size based on Content-Length header
 * @param request - The incoming request
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateRequestSize(
  request: Request,
  maxSizeBytes: number
): { isValid: boolean; error?: string } {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size)) {
      return { isValid: false, error: 'Invalid Content-Length header' };
    }
    if (size > maxSizeBytes) {
      return {
        isValid: false,
        error: `Request payload too large. Maximum size is ${Math.round(maxSizeBytes / 1024)}KB`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Create a timeout promise that rejects after the specified time
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects with a timeout error after timeoutMs
 */
export function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeoutMs);
  });
}

/**
 * Wrap a Supabase query with a timeout using Promise.race
 * This ensures the query is actually cancelled when timeout occurs
 * Supabase query builders are thenable, so we can race them directly
 * @param queryBuilder - The Supabase query builder (thenable object)
 * @param timeoutPromise - The timeout promise from createTimeout
 * @returns The result of the query, or throws timeout error
 */
export async function withTimeout<T>(
  queryBuilder: any, // Supabase query builders are thenable but TypeScript doesn't recognize them as Promise<T>
  timeoutPromise: Promise<never>
): Promise<T> {
  // Supabase query builders are thenable, so we can use them directly in Promise.race
  return Promise.race([queryBuilder as Promise<T>, timeoutPromise]);
}

/**
 * Create an AbortController with a timeout (for operations that support abort signals)
 * Also provides a timeout promise for Promise.race usage
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with abortController, timeoutId, and timeoutPromise
 */
export function createTimeout(timeoutMs: number): {
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  timeoutPromise: Promise<never>;
} {
  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error('Request timeout'));
    }, timeoutMs);
  });

  return { abortController, timeoutId: timeoutId!, timeoutPromise };
}

/**
 * Validate Content-Type header
 * @param request - The incoming request
 * @param allowedTypes - Array of allowed Content-Type values
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateContentType(
  request: Request,
  allowedTypes: string[]
): { isValid: boolean; error?: string } {
  const contentType = request.headers.get('content-type');
  
  if (!contentType) {
    return { isValid: false, error: 'Content-Type header is required' };
  }

  // Check if content type matches any allowed type
  const isValid = allowedTypes.some((type) => {
    // Handle cases like "application/json; charset=utf-8"
    return contentType.toLowerCase().startsWith(type.toLowerCase());
  });

  if (!isValid) {
    return {
      isValid: false,
      error: `Invalid Content-Type. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { isValid: true };
}
