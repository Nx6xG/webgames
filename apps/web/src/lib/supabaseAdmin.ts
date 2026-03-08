import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null | undefined;

/**
 * Returns a server-only Supabase client using the service role key.
 * Bypasses RLS — use only in API routes, never expose to client.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (instance !== undefined) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !key) {
    instance = null;
    return null;
  }

  instance = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return instance;
}
