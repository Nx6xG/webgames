import { type NextRequest } from 'next/server';
import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Verify that the request comes from an authenticated admin user.
 * Extracts the Supabase access token from the Authorization header,
 * validates it, then checks `profiles.role === 'admin'`.
 *
 * Returns `{ userId }` on success, or `{ error: string }` on failure.
 */
export async function verifyAdmin(
  request: NextRequest,
): Promise<{ userId: string } | { error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is missing' };

  // Extract Bearer token from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { error: 'No Authorization header' };

  const token = authHeader.slice(7);
  if (!token) return { error: 'Empty Bearer token' };

  // Verify JWT and get user
  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);
  if (error || !user) return { error: `JWT verification failed: ${error?.message ?? 'no user'}` };

  // Check admin role in profiles table
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) return { error: `Profile lookup failed: ${profileError.message}` };
  if (!profile || profile.role !== 'admin') return { error: `Role is '${profile?.role ?? 'null'}', not 'admin'. User: ${user.id}` };

  return { userId: user.id };
}
