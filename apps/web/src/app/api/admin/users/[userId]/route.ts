import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function auditLog(
  sb: ReturnType<typeof getSupabaseAdmin>,
  adminId: string,
  action: string,
  targetUserId: string,
  details?: Record<string, unknown>,
) {
  await sb!.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details: details ?? null,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await params;
  const sb = getSupabaseAdmin()!;

  const [profileRes, statsRes, achievementsRes, cosmeticsRes, unlockedRes, authRes] =
    await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).single(),
      sb.from('user_stats').select('*').eq('user_id', userId).single(),
      sb.from('user_achievements').select('*').eq('user_id', userId).single(),
      sb.from('user_cosmetics').select('*').eq('user_id', userId).single(),
      sb.from('user_unlocked_cosmetics').select('*').eq('user_id', userId).single(),
      sb.auth.admin.getUserById(userId),
    ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    profile: profileRes.data,
    email: authRes.data?.user?.email ?? null,
    stats: statsRes.data ?? null,
    achievements: achievementsRes.data ?? null,
    cosmetics: cosmeticsRes.data ?? null,
    unlockedCosmetics: unlockedRes.data ?? null,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await params;
  const sb = getSupabaseAdmin()!;
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'reset_stats': {
      await sb.from('user_stats').update({
        plays_total: 0,
        wins_total: 0,
        invites_total: 0,
        plays_by_game: {},
        wins_by_game: {},
      }).eq('user_id', userId);
      await auditLog(sb, admin.userId, 'reset_stats', userId);
      return NextResponse.json({ ok: true });
    }

    case 'grant_achievement': {
      const { achievementId } = body;
      if (!achievementId) return NextResponse.json({ error: 'Missing achievementId' }, { status: 400 });
      const { data } = await sb.from('user_achievements').select('unlocked').eq('user_id', userId).single();
      const current: string[] = data?.unlocked ?? [];
      if (!current.includes(achievementId)) {
        await sb.from('user_achievements').upsert({
          user_id: userId,
          unlocked: [...current, achievementId],
        });
      }
      await auditLog(sb, admin.userId, 'grant_achievement', userId, { achievementId });
      return NextResponse.json({ ok: true });
    }

    case 'revoke_achievement': {
      const { achievementId } = body;
      if (!achievementId) return NextResponse.json({ error: 'Missing achievementId' }, { status: 400 });
      const { data } = await sb.from('user_achievements').select('unlocked').eq('user_id', userId).single();
      const current: string[] = data?.unlocked ?? [];
      await sb.from('user_achievements').upsert({
        user_id: userId,
        unlocked: current.filter((a) => a !== achievementId),
      });
      await auditLog(sb, admin.userId, 'revoke_achievement', userId, { achievementId });
      return NextResponse.json({ ok: true });
    }

    case 'grant_cosmetic': {
      const { cosmeticId, slot } = body;
      if (!cosmeticId || !slot) return NextResponse.json({ error: 'Missing cosmeticId or slot' }, { status: 400 });
      const { data } = await sb.from('user_unlocked_cosmetics').select('data').eq('user_id', userId).single();
      const current = (data?.data ?? {}) as Record<string, string[]>;
      const slotArr = current[slot] ?? [];
      if (!slotArr.includes(cosmeticId)) {
        current[slot] = [...slotArr, cosmeticId];
      }
      await sb.from('user_unlocked_cosmetics').upsert({ user_id: userId, data: current });
      await auditLog(sb, admin.userId, 'grant_cosmetic', userId, { cosmeticId, slot });
      return NextResponse.json({ ok: true });
    }

    case 'revoke_cosmetic': {
      const { cosmeticId, slot } = body;
      if (!cosmeticId || !slot) return NextResponse.json({ error: 'Missing cosmeticId or slot' }, { status: 400 });
      const { data } = await sb.from('user_unlocked_cosmetics').select('data').eq('user_id', userId).single();
      const current = (data?.data ?? {}) as Record<string, string[]>;
      current[slot] = (current[slot] ?? []).filter((c) => c !== cosmeticId);
      await sb.from('user_unlocked_cosmetics').upsert({ user_id: userId, data: current });
      await auditLog(sb, admin.userId, 'revoke_cosmetic', userId, { cosmeticId, slot });
      return NextResponse.json({ ok: true });
    }

    case 'suspend': {
      await sb.from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', userId);
      await auditLog(sb, admin.userId, 'suspend', userId);
      return NextResponse.json({ ok: true });
    }

    case 'unsuspend': {
      await sb.from('profiles').update({ suspended_at: null }).eq('id', userId);
      await auditLog(sb, admin.userId, 'unsuspend', userId);
      return NextResponse.json({ ok: true });
    }

    case 'set_role': {
      const { role } = body;
      if (role !== 'admin' && role !== 'user') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      await sb.from('profiles').update({ role }).eq('id', userId);
      await auditLog(sb, admin.userId, 'set_role', userId, { role });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
