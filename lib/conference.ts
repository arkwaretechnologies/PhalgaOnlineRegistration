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
  include_psgc: string | null;
  exclude_psgc: string | null;
  on_maintenance: string | null;
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

    // Extract domain without port and normalize
    const domain = hostname.split(':')[0].toLowerCase().trim();
    // Try with and without www for production (e.g. www.reg.example.com vs reg.example.com)
    const domainsToTry = [domain];
    if (domain.startsWith('www.')) {
      domainsToTry.push(domain.slice(4));
    } else if (!domain.includes('localhost') && domain !== '127.0.0.1') {
      domainsToTry.push('www.' + domain);
    }

    // console.log(`Detecting conference for domain: ${domain}`);

    let data: ConferenceInfo | null = null;
    let lastError: any = null;

    for (const d of domainsToTry) {
      const { data: row, error } = await supabase
        .from('conference')
        .select('*')
        .eq('domain', d)
        .maybeSingle();

      if (!error && row) {
        data = row;
        break;
      }
      if (error && error.code !== 'PGRST116') lastError = error;
    }

    if (!data) {
      // Not found - use default for localhost/development
      if (domain.includes('localhost') || domain === '127.0.0.1') {
        console.warn(`No conference found for domain: ${domain}. Using default for localhost.`);
        const { data: defaultConf } = await supabase
          .from('conference')
          .select('*')
          .limit(1)
          .single();

        if (defaultConf) {
          return defaultConf;
        }
      } else if (lastError) {
        console.error(`Error fetching conference for domain ${domain}:`, lastError.message);
      }
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

/**
 * Check if the conference for the given domain is on maintenance
 * @param hostname - Optional hostname (will be extracted from headers if not provided)
 * @returns Object with onMaintenance boolean and optional conference info
 */
export async function isConferenceOnMaintenance(hostname?: string): Promise<{
  onMaintenance: boolean;
  conference: ConferenceInfo | null;
}> {
  const conference = await getConferenceByDomain(hostname);
  const onMaintenance = conference?.on_maintenance?.toUpperCase() === 'Y';
  return { onMaintenance, conference };
}
