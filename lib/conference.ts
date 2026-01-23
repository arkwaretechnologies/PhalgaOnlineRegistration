import { supabase } from './db';
import { headers } from 'next/headers';

export interface ConferenceInfo {
  confcode: string;
  name: string | null;
  date_from: string | null;
  date_to: string | null;
  venue: string | null;
  reg_limit: number | null;
  reg_alert_count: number | null;
  domain: string | null;
  prefix: string | null;
  psgc: string | null;
}

/**
 * Get conference information based on the request domain/hostname
 * @param hostname - Optional hostname (will be extracted from headers if not provided)
 * @returns ConferenceInfo object or null if not found
 */
export async function getConferenceByDomain(hostname?: string): Promise<ConferenceInfo | null> {
  try {
    // Get hostname from headers if not provided
    if (!hostname) {
      const headersList = await headers();
      hostname = 
        headersList.get('x-forwarded-host') || 
        headersList.get('host') || 
        'localhost';
    }

    // Extract domain without port
    const domain = hostname.split(':')[0].toLowerCase();
    
    // console.log(`Detecting conference for domain: ${domain}`);

    // Query conference table by domain
    const { data, error } = await supabase
      .from('conference')
      .select('*')
      .eq('domain', domain)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - use default for localhost/development
        if (domain.includes('localhost') || domain === '127.0.0.1') {
          console.warn(`No conference found for domain: ${domain}. Using default for localhost.`);
          // Query for a default conference (first active one)
          const { data: defaultConf } = await supabase
            .from('conference')
            .select('*')
            .limit(1)
            .single();
          
          if (defaultConf) {
            // console.log(`Using default conference: ${defaultConf.confcode}`);
            return defaultConf;
          }
        } else {
          console.error(`Conference not found for domain: ${domain}`);
        }
      } else {
        console.error(`Error fetching conference for domain ${domain}:`, error.message);
      }
      return null;
    }

    if (!data) {
      console.warn(`No conference data returned for domain: ${domain}`);
      return null;
    }

    // console.log(`Conference detected: ${data.confcode} - ${data.name}`);
    return data;
  } catch (error: any) {
    console.error(`Error detecting conference: ${error?.message || error}`);
    return null;
  }
}

/**
 * Get conference code only (lightweight version)
 * @param hostname - Optional hostname
 * @returns Conference code string or default fallback
 */
export async function getConferenceCode(hostname?: string): Promise<string> {
  const conference = await getConferenceByDomain(hostname);
  return conference?.confcode || '2026-GCMIN'; // Default fallback
}

/**
 * Get conference name for display
 * @param hostname - Optional hostname
 * @returns Conference name string or default
 */
export async function getConferenceName(hostname?: string): Promise<string> {
  const conference = await getConferenceByDomain(hostname);
  return conference?.name || 'Mindanao Geographic Conference'; // Default fallback
}
