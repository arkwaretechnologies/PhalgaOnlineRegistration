import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Legacy function name for backward compatibility during migration
export function getDbConnection() {
  return supabase;
}

