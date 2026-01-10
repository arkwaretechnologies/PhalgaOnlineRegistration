/**
 * Application configuration
 * Reads from database config table with sensible defaults
 */

import { supabase } from './db';

/**
 * Get the maximum registration limit from database config table
 * Registration closes when count >= this limit
 * 
 * Database table: config
 * Column: paramname = "REGISTRATION_LIMIT"
 * Returns: paramvalue as integer
 * Default: 3 (if not found in database)
 */
export async function getRegistrationLimit(): Promise<number> {
  try {
    // Query config table with paramname = 'REGISTRATION_LIMIT'
    const { data, error } = await supabase
      .from('config')
      .select('paramvalue')
      .eq('paramname', 'REGISTRATION_LIMIT')
      .single();

    if (error) {
      // Check if it's a "not found" error (PGRST116) or actual database error
      if (error.code === 'PGRST116') {
        console.warn(
          `REGISTRATION_LIMIT not found in config table. ` +
          `Using default: 3`
        );
      } else {
        console.warn(
          `Failed to fetch REGISTRATION_LIMIT from database: ${error.message}. ` +
          `Using default: 3`
        );
      }
      return 3;
    }

    if (!data || !data.paramvalue) {
      console.warn(
        `REGISTRATION_LIMIT found but paramvalue is empty in config table. ` +
        `Using default: 3`
      );
      return 3;
    }

    const parsed = parseInt(String(data.paramvalue), 10);
    
    if (isNaN(parsed) || parsed < 0) {
      console.warn(
        `Invalid REGISTRATION_LIMIT value in database: "${data.paramvalue}". ` +
        `Expected a positive number. Using default: 3`
      );
      return 3;
    }
    
    return parsed;
  } catch (error: any) {
    console.error(
      `Error fetching REGISTRATION_LIMIT from database: ${error?.message || error}. ` +
      `Using default: 3`
    );
    return 3;
  }
}

/**
 * Check if registration is open based on current count
 * @param currentCount - Current number of registered participants
 * @returns true if registration is open (count < limit), false if closed (count >= limit)
 */
export async function isRegistrationOpen(currentCount: number): Promise<boolean> {
  const limit = await getRegistrationLimit();
  return currentCount < limit;
}

/**
 * Get the maximum limit for registrations per Province-LGU combination from database config table
 * Registration for a specific Province-LGU closes when count >= this limit
 * 
 * Database table: config
 * Column: paramname = "PROVINCE_LGU_LIMIT"
 * Returns: paramvalue as integer
 * Default: 10 (if not found in database)
 */
export async function getProvinceLguLimit(): Promise<number> {
  try {
    // Query config table with paramname = 'PROVINCE_LGU_LIMIT'
    const { data, error } = await supabase
      .from('config')
      .select('paramvalue')
      .eq('paramname', 'PROVINCE_LGU_LIMIT')
      .single();

    if (error) {
      // Check if it's a "not found" error (PGRST116) or actual database error
      if (error.code === 'PGRST116') {
        console.warn(
          `PROVINCE_LGU_LIMIT not found in config table. ` +
          `Using default: 10`
        );
      } else {
        console.warn(
          `Failed to fetch PROVINCE_LGU_LIMIT from database: ${error.message}. ` +
          `Using default: 10`
        );
      }
      return 10;
    }

    if (!data || !data.paramvalue) {
      console.warn(
        `PROVINCE_LGU_LIMIT found but paramvalue is empty in config table. ` +
        `Using default: 10`
      );
      return 10;
    }

    const parsed = parseInt(String(data.paramvalue), 10);
    
    if (isNaN(parsed) || parsed < 0) {
      console.warn(
        `Invalid PROVINCE_LGU_LIMIT value in database: "${data.paramvalue}". ` +
        `Expected a positive number. Using default: 10`
      );
      return 10;
    }
    
    return parsed;
  } catch (error: any) {
    console.error(
      `Error fetching PROVINCE_LGU_LIMIT from database: ${error?.message || error}. ` +
      `Using default: 10`
    );
    return 10;
  }
}

/**
 * Check if registration is open for a specific Province-LGU combination
 * @param currentCount - Current number of registered participants for this Province-LGU
 * @returns true if registration is open (count < limit), false if closed (count >= limit)
 */
export async function isProvinceLguRegistrationOpen(currentCount: number): Promise<boolean> {
  const limit = await getProvinceLguLimit();
  return currentCount < limit;
}

/**
 * Get registration limit from conference table for a specific conference
 * Falls back to config table REGISTRATION_LIMIT if conference doesn't have reg_limit set
 * @param confcode - Conference code
 * @returns Registration limit number
 */
export async function getRegistrationLimitByConference(confcode: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('conference')
      .select('reg_limit')
      .eq('confcode', confcode)
      .single();

    if (error || !data?.reg_limit) {
      console.warn(
        `Failed to fetch reg_limit for conference ${confcode} from conference table. ` +
        `Falling back to config table REGISTRATION_LIMIT.`
      );
      // Fallback to config table if conference table doesn't have reg_limit
      return await getRegistrationLimit();
    }

    const limit = parseInt(String(data.reg_limit), 10);
    
    if (isNaN(limit) || limit < 0) {
      console.warn(
        `Invalid reg_limit value in conference table for ${confcode}: "${data.reg_limit}". ` +
        `Falling back to config table REGISTRATION_LIMIT.`
      );
      return await getRegistrationLimit();
    }
    
    console.log(`Using registration limit from conference table: ${limit} for ${confcode}`);
    return limit;
  } catch (error: any) {
    console.error(
      `Error fetching reg_limit for conference ${confcode}: ${error?.message || error}. ` +
      `Falling back to config table REGISTRATION_LIMIT.`
    );
    return await getRegistrationLimit();
  }
}
