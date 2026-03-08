import { type NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Verify that the request comes from an authenticated admin user.
 * Extracts the Supabase access token from the Authorization header,
 * validates it, then checks `profiles.role === 'admin'`.
 *
 * Returns `{ userId }` on success, or `null` if not admin.
 */
export async function verifyAdmin(
  request: NextRequest,
): Promise<{ userId: string } | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;

  // Extract Bearer token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  // Verify JWT and get user
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return null;

  // Check admin role in profiles table
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return null;

  return { userId: user.id };
}
