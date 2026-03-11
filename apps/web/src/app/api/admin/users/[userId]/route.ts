import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getXpRequiredForLevel } from '@/lib/progression';

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

  const [profileRes, statsRes, achievementsRes, cosmeticsRes, unlockedRes, progressionRes, authRes] =
    await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).single(),
      sb.from('user_stats').select('*').eq('user_id', userId).single(),
      sb.from('user_achievements').select('*').eq('user_id', userId).single(),
      sb.from('user_cosmetics').select('*').eq('user_id', userId).single(),
      sb.from('user_unlocked_cosmetics').select('*').eq('user_id', userId).single(),
      sb.from('user_progression').select('data').eq('user_id', userId).maybeSingle(),
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
    progression: progressionRes.data?.data ?? null,
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

    case 'add_xp': {
      const { amount } = body;
      if (typeof amount !== 'number' || amount === 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }
      const { data: progRow } = await sb
        .from('user_progression')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      const prev = (progRow?.data ?? { xp: 0, level: 1, tokens: 0 }) as Record<string, unknown>;
      const prevXp = (typeof prev.xp === 'number' ? prev.xp : 0);
      const prevLevel = (typeof prev.level === 'number' ? prev.level : 1);
      const prevTokens = (typeof prev.tokens === 'number' ? prev.tokens : 0);

      // Apply XP change and recalculate level
      let newXp = prevXp + amount;
      let newLevel = prevLevel;
      let newTokens = prevTokens;

      if (amount > 0) {
        // Level up loop
        let required = getXpRequiredForLevel(newLevel);
        while (newXp >= required) {
          newXp -= required;
          newLevel++;
          newTokens++;
          required = getXpRequiredForLevel(newLevel);
        }
      } else {
        // Negative XP: allow going below 0 within current level, but clamp at 0
        if (newXp < 0) {
          // De-level: go down levels if needed
          while (newXp < 0 && newLevel > 1) {
            newLevel--;
            newTokens = Math.max(0, newTokens - 1);
            const required = getXpRequiredForLevel(newLevel);
            newXp += required;
          }
          newXp = Math.max(0, newXp);
        }
      }

      const updated = { ...prev, xp: newXp, level: newLevel, tokens: newTokens };
      await sb.from('user_progression').upsert(
        { user_id: userId, data: updated },
        { onConflict: 'user_id' },
      );
      await auditLog(sb, admin.userId, 'add_xp', userId, {
        amount,
        prev: { xp: prevXp, level: prevLevel, tokens: prevTokens },
        after: { xp: newXp, level: newLevel, tokens: newTokens },
      });
      return NextResponse.json({ ok: true, progression: updated });
    }

    case 'set_tokens': {
      const { tokens } = body;
      if (typeof tokens !== 'number' || tokens < 0) {
        return NextResponse.json({ error: 'Invalid tokens' }, { status: 400 });
      }
      const { data: progRow } = await sb
        .from('user_progression')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      const prev = (progRow?.data ?? { xp: 0, level: 1, tokens: 0 }) as Record<string, unknown>;
      const prevTokens = typeof prev.tokens === 'number' ? prev.tokens : 0;
      const updated = { ...prev, tokens };
      await sb.from('user_progression').upsert(
        { user_id: userId, data: updated },
        { onConflict: 'user_id' },
      );
      await auditLog(sb, admin.userId, 'set_tokens', userId, {
        prevTokens,
        newTokens: tokens,
      });
      return NextResponse.json({ ok: true, progression: updated });
    }

    case 'bulk_grant_achievements': {
      const { achievementIds } = body as { achievementIds: string[] };
      if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
        return NextResponse.json({ error: 'Missing achievementIds' }, { status: 400 });
      }
      const { data } = await sb.from('user_achievements').select('unlocked').eq('user_id', userId).single();
      const current: string[] = data?.unlocked ?? [];
      const merged = [...new Set([...current, ...achievementIds])];
      await sb.from('user_achievements').upsert({ user_id: userId, unlocked: merged });
      await auditLog(sb, admin.userId, 'bulk_grant_achievements', userId, {
        count: achievementIds.length,
        added: merged.length - current.length,
      });
      return NextResponse.json({ ok: true });
    }

    case 'bulk_revoke_achievements': {
      const { achievementIds } = body as { achievementIds: string[] };
      if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
        return NextResponse.json({ error: 'Missing achievementIds' }, { status: 400 });
      }
      const { data } = await sb.from('user_achievements').select('unlocked').eq('user_id', userId).single();
      const current: string[] = data?.unlocked ?? [];
      const revokeSet = new Set(achievementIds);
      const filtered = current.filter((a) => !revokeSet.has(a));
      await sb.from('user_achievements').upsert({ user_id: userId, unlocked: filtered });
      await auditLog(sb, admin.userId, 'bulk_revoke_achievements', userId, {
        count: achievementIds.length,
        removed: current.length - filtered.length,
      });
      return NextResponse.json({ ok: true });
    }

    case 'bulk_grant_cosmetics': {
      const { cosmetics } = body as { cosmetics: { slot: string; id: string }[] };
      if (!Array.isArray(cosmetics) || cosmetics.length === 0) {
        return NextResponse.json({ error: 'Missing cosmetics' }, { status: 400 });
      }
      const { data } = await sb.from('user_unlocked_cosmetics').select('data').eq('user_id', userId).single();
      const current = (data?.data ?? {}) as Record<string, string[]>;
      let added = 0;
      for (const c of cosmetics) {
        const slotArr = current[c.slot] ?? [];
        if (!slotArr.includes(c.id)) {
          current[c.slot] = [...slotArr, c.id];
          added++;
        }
      }
      await sb.from('user_unlocked_cosmetics').upsert({ user_id: userId, data: current });
      await auditLog(sb, admin.userId, 'bulk_grant_cosmetics', userId, { count: cosmetics.length, added });
      return NextResponse.json({ ok: true });
    }

    case 'bulk_revoke_cosmetics': {
      const { cosmetics } = body as { cosmetics: { slot: string; id: string }[] };
      if (!Array.isArray(cosmetics) || cosmetics.length === 0) {
        return NextResponse.json({ error: 'Missing cosmetics' }, { status: 400 });
      }
      const { data } = await sb.from('user_unlocked_cosmetics').select('data').eq('user_id', userId).single();
      const current = (data?.data ?? {}) as Record<string, string[]>;
      let removed = 0;
      for (const c of cosmetics) {
        const slotArr = current[c.slot] ?? [];
        const idx = slotArr.indexOf(c.id);
        if (idx !== -1) {
          slotArr.splice(idx, 1);
          current[c.slot] = slotArr;
          removed++;
        }
      }
      await sb.from('user_unlocked_cosmetics').upsert({ user_id: userId, data: current });
      await auditLog(sb, admin.userId, 'bulk_revoke_cosmetics', userId, { count: cosmetics.length, removed });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
