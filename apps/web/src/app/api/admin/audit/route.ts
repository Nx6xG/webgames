import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = getSupabaseAdmin()!;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  const { data, count, error } = await sb
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve admin nicknames
  const adminIds = [...new Set((data ?? []).map((d) => d.admin_id))];
  const { data: adminProfiles } = adminIds.length > 0
    ? await sb.from('profiles').select('id, nickname').in('id', adminIds)
    : { data: [] };
  const nickMap = new Map((adminProfiles ?? []).map((p) => [p.id, p.nickname]));

  const entries = (data ?? []).map((d) => ({
    ...d,
    admin_nickname: nickMap.get(d.admin_id) ?? 'Unknown',
  }));

  return NextResponse.json({ entries, total: count ?? 0, page, limit });
}
