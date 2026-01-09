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

/**
 * Get the maximum limit for registrations per Province-LGU combination
 * Registration for a specific Province-LGU closes when count >= this limit
 * 
 * Environment variable: PROVINCE_LGU_LIMIT
 * Default: 10
 */
export function getProvinceLguLimit(): number {
  const limit = process.env.PROVINCE_LGU_LIMIT;
  
  if (limit) {
    const parsed = parseInt(limit, 10);
    
    if (isNaN(parsed) || parsed < 0) {
      console.warn(
        `Invalid PROVINCE_LGU_LIMIT value: "${limit}". ` +
        `Expected a positive number. Using default: 10`
      );
      return 10;
    }
    
    return parsed;
  }
  
  // Default limit if not set in environment
  return 10;
}

/**
 * Check if registration is open for a specific Province-LGU combination
 * @param currentCount - Current number of registered participants for this Province-LGU
 * @returns true if registration is open (count < limit), false if closed (count >= limit)
 */
export function isProvinceLguRegistrationOpen(currentCount: number): boolean {
  const limit = getProvinceLguLimit();
  return currentCount < limit;
}
