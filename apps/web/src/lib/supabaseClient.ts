import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null | undefined;

/**
 * Returns a singleton SupabaseClient, or null if env vars are missing.
 * Safe to call on server and client — returns null during SSR when
 * `window` is unavailable and env vars are empty.
 */
export function getSupabase(): SupabaseClient | null {
  if (instance !== undefined) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !key) {
    instance = null;
    return null;
  }

  instance = createClient(url, key);
  return instance;
}
