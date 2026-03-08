import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = getSupabaseAdmin()!;
  const url = new URL(request.url);
  const q = url.searchParams.get('q') ?? '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  let query = sb
    .from('profiles')
    .select('id, nickname, role, created_at, suspended_at', { count: 'exact' });

  if (q) {
    query = query.or(`nickname.ilike.%${q}%,id.eq.${q}`);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data: profiles, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch stats for these users
  const userIds = (profiles ?? []).map((p) => p.id);
  const { data: stats } = userIds.length > 0
    ? await sb.from('user_stats').select('user_id, plays_total, wins_total').in('user_id', userIds)
    : { data: [] };

  const statsMap = new Map((stats ?? []).map((s) => [s.user_id, s]));

  // Fetch emails from auth.users via admin API
  const emailMap = new Map<string, string>();
  for (const uid of userIds) {
    const { data } = await sb.auth.admin.getUserById(uid);
    if (data?.user?.email) emailMap.set(uid, data.user.email);
  }

  const users = (profiles ?? []).map((p) => {
    const s = statsMap.get(p.id);
    return {
      id: p.id,
      nickname: p.nickname,
      email: emailMap.get(p.id) ?? null,
      role: p.role,
      created_at: p.created_at,
      suspended_at: p.suspended_at,
      plays_total: s?.plays_total ?? 0,
      wins_total: s?.wins_total ?? 0,
    };
  });

  return NextResponse.json({ users, total: count ?? 0, page, limit });
}
