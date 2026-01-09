/**
 * Application configuration
 * Reads from environment variables with sensible defaults
 */

/**
 * Get the maximum registration limit
 * Registration closes when count >= this limit
 * 
 * Environment variable: REGISTRATION_LIMIT
 * Default: 3
 */
export function getRegistrationLimit(): number {
  const limit = process.env.REGISTRATION_LIMIT;
  
  if (limit) {
    const parsed = parseInt(limit, 10);
    
    if (isNaN(parsed) || parsed < 0) {
      console.warn(
        `Invalid REGISTRATION_LIMIT value: "${limit}". ` +
        `Expected a positive number. Using default: 3`
      );
      return 3;
    }
    
    return parsed;
  }
  
  // Default limit if not set in environment
  return 3;
}

/**
 * Check if registration is open based on current count
 * @param currentCount - Current number of registered participants
 * @returns true if registration is open (count < limit), false if closed (count >= limit)
 */
export function isRegistrationOpen(currentCount: number): boolean {
  const limit = getRegistrationLimit();
  return currentCount < limit;
}
