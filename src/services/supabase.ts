import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isValidSupabaseUrl = (u: string) =>
  typeof u === 'string' &&
  u.startsWith('https://') &&
  u.includes('.supabase.co') &&
  !u.includes('www.supabase.co');

if (!url || !anonKey) {
  console.warn('Supabase env vars missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
} else if (!isValidSupabaseUrl(url)) {
  console.warn('VITE_SUPABASE_URL should be your project URL (e.g. https://xxxxx.supabase.co), not https://www.supabase.co');
}

export const supabase: SupabaseClient | null =
  url && anonKey && isValidSupabaseUrl(url)
    ? createClient(url, anonKey, {
        auth: {
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : null;

/** True when Supabase is configured and can be used for online storage */
export const isSupabaseReady = (): boolean => !!supabase;
