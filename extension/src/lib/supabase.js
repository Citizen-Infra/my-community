import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

// Supabase is only a fallback source for older Harmonica sessions. The primary
// events API remains useful without these build-time variables, so missing
// fallback configuration must not prevent the dashboard from starting.
export function createOptionalSupabaseClient(url, anonKey, create = createClient) {
  return url && anonKey ? create(url, anonKey) : null;
}

export const supabase = createOptionalSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
