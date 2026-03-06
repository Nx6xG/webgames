import type { SupabaseClient } from '@supabase/supabase-js';
import type { CosmeticsSelection } from 'shared';
import type { AchievementStats } from '@/lib/achievements/definitions';
import type { CosmeticSlot } from '@/lib/cosmetics';
import { loadCosmetics, saveCosmetics } from '@/lib/cosmetics';
import { getStoredNickname } from '@/lib/nickname';
import {
  loadStats,
  saveStats,
  loadUnlocked,
  saveUnlocked,
  loadUnlockedCosmetics,
  saveUnlockedCosmetics,
} from '@/lib/achievements/store';

// ── Types ────────────────────────────────────────────────────────────────────

export type UnlockedCosmeticsMap = Record<CosmeticSlot, string[]>;

// ── Cloud CRUD ───────────────────────────────────────────────────────────────

export async function fetchCloudCosmetics(
  sb: SupabaseClient,
  userId: string,
): Promise<CosmeticsSelection | null> {
  const { data } = await sb
    .from('user_cosmetics')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.data as CosmeticsSelection) ?? null;
}

export async function saveCloudCosmetics(
  sb: SupabaseClient,
  userId: string,
  cosmetics: CosmeticsSelection,
): Promise<void> {
  await sb
    .from('user_cosmetics')
    .upsert({ user_id: userId, data: cosmetics }, { onConflict: 'user_id' });
}

export async function fetchCloudAchievements(
  sb: SupabaseClient,
  userId: string,
): Promise<string[] | null> {
  const { data } = await sb
    .from('user_achievements')
    .select('unlocked')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.unlocked as string[]) ?? null;
}

export async function saveCloudAchievements(
  sb: SupabaseClient,
  userId: string,
  unlocked: string[],
): Promise<void> {
  await sb
    .from('user_achievements')
    .upsert({ user_id: userId, unlocked }, { onConflict: 'user_id' });
}

export async function fetchCloudStats(
  sb: SupabaseClient,
  userId: string,
): Promise<AchievementStats | null> {
  const { data } = await sb
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return {
    playsTotal: data.plays_total ?? 0,
    winsTotal: data.wins_total ?? 0,
    invitesTotal: data.invites_total ?? 0,
    playsByGame: (data.plays_by_game as Record<string, number>) ?? {},
    winsByGame: (data.wins_by_game as Record<string, number>) ?? {},
  };
}

export async function saveCloudStats(
  sb: SupabaseClient,
  userId: string,
  stats: AchievementStats,
): Promise<void> {
  await sb.from('user_stats').upsert(
    {
      user_id: userId,
      plays_total: stats.playsTotal,
      wins_total: stats.winsTotal,
      invites_total: stats.invitesTotal,
      plays_by_game: stats.playsByGame,
      wins_by_game: stats.winsByGame,
    },
    { onConflict: 'user_id' },
  );
}

export async function fetchCloudUnlockedCosmetics(
  sb: SupabaseClient,
  userId: string,
): Promise<UnlockedCosmeticsMap | null> {
  const { data } = await sb
    .from('user_unlocked_cosmetics')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.data as UnlockedCosmeticsMap) ?? null;
}

export async function saveCloudUnlockedCosmetics(
  sb: SupabaseClient,
  userId: string,
  map: UnlockedCosmeticsMap,
): Promise<void> {
  await sb
    .from('user_unlocked_cosmetics')
    .upsert({ user_id: userId, data: map }, { onConflict: 'user_id' });
}

// ── Merge helpers ────────────────────────────────────────────────────────────

/** For each key, take the max of a and b. */
export function mergeMaxRecord(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const result = { ...a };
  for (const [k, v] of Object.entries(b)) {
    result[k] = Math.max(result[k] ?? 0, v);
  }
  return result;
}

/** Union per slot. */
export function mergeUnlockedCosmetics(
  local: UnlockedCosmeticsMap,
  cloud: UnlockedCosmeticsMap,
): UnlockedCosmeticsMap {
  const slots = Object.keys(local) as CosmeticSlot[];
  const result = {} as UnlockedCosmeticsMap;
  for (const slot of slots) {
    result[slot] = [...new Set([...(local[slot] ?? []), ...(cloud[slot] ?? [])])];
  }
  return result;
}

// ── Profile bootstrap ────────────────────────────────────────────────────

/** Ensure a profiles row exists for the user. Does not overwrite existing rows. */
export async function ensureProfile(
  sb: SupabaseClient,
  userId: string,
  email: string | undefined,
): Promise<void> {
  console.log('[ensureProfile] called for', userId);

  const { data, error: selectErr } = await sb
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selectErr) {
    console.error('[ensureProfile] select error:', selectErr);
  }

  if (data) {
    console.log('[ensureProfile] row already exists, skipping insert');
    return;
  }

  const nickname = getStoredNickname() || email?.split('@')[0] || 'Player';
  const payload = { id: userId, nickname };
  console.log('[ensureProfile] inserting:', payload);

  const { error: insertErr } = await sb.from('profiles').insert(payload);
  if (insertErr) {
    console.error('[ensureProfile] insert error:', insertErr);
  } else {
    console.log('[ensureProfile] profile created successfully');
  }
}

// ── Sync guard ───────────────────────────────────────────────────────────────

const SYNC_DONE_PREFIX = 'wg_cloud_sync_done:';

export function hasSyncedBefore(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SYNC_DONE_PREFIX + userId) === '1';
}

export function markSyncDone(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_DONE_PREFIX + userId, '1');
}

// ── Initial sync (first login — merge local ↔ cloud) ─────────────────────

export async function runInitialSync(
  sb: SupabaseClient,
  userId: string,
  email?: string,
): Promise<void> {
  // Bootstrap profile row (no-op if already exists)
  await ensureProfile(sb, userId, email);

  // Load local data
  const localCosmetics = loadCosmetics();
  const localUnlocked = [...loadUnlocked()];
  const localStats = loadStats();
  const localUnlockedCosmetics = loadUnlockedCosmetics();

  // Load cloud data
  const [cloudCosmetics, cloudUnlocked, cloudStats, cloudUnlockedCosmetics] =
    await Promise.all([
      fetchCloudCosmetics(sb, userId),
      fetchCloudAchievements(sb, userId),
      fetchCloudStats(sb, userId),
      fetchCloudUnlockedCosmetics(sb, userId),
    ]);

  // Merge cosmetics (local wins per field, cloud fills gaps)
  const mergedCosmetics: CosmeticsSelection = {
    ...(cloudCosmetics ?? { slots: {} }),
    ...localCosmetics,
    slots: { ...(cloudCosmetics?.slots ?? {}), ...localCosmetics.slots },
  };

  // Merge achievements (union)
  const mergedUnlocked = [...new Set([...localUnlocked, ...(cloudUnlocked ?? [])])];

  // Merge stats (max per field)
  const mergedStats: AchievementStats = {
    playsTotal: Math.max(localStats.playsTotal, cloudStats?.playsTotal ?? 0),
    winsTotal: Math.max(localStats.winsTotal, cloudStats?.winsTotal ?? 0),
    invitesTotal: Math.max(localStats.invitesTotal, cloudStats?.invitesTotal ?? 0),
    playsByGame: mergeMaxRecord(
      localStats.playsByGame,
      cloudStats?.playsByGame ?? {},
    ),
    winsByGame: mergeMaxRecord(
      localStats.winsByGame,
      cloudStats?.winsByGame ?? {},
    ),
  };

  // Merge unlocked cosmetics (union per slot)
  const defaultMap: UnlockedCosmeticsMap = {
    frame: [], head: [], portal: [], aura: [], banner: [], cardColor: [], badge: [],
  };
  const mergedUnlockedCosmetics = mergeUnlockedCosmetics(
    localUnlockedCosmetics,
    cloudUnlockedCosmetics ?? defaultMap,
  );

  // Save merged → local
  saveCosmetics(mergedCosmetics);
  saveUnlocked(new Set(mergedUnlocked));
  saveStats(mergedStats);
  saveUnlockedCosmetics(mergedUnlockedCosmetics);

  // Save merged → cloud
  await Promise.all([
    saveCloudCosmetics(sb, userId, mergedCosmetics),
    saveCloudAchievements(sb, userId, mergedUnlocked),
    saveCloudStats(sb, userId, mergedStats),
    saveCloudUnlockedCosmetics(sb, userId, mergedUnlockedCosmetics),
  ]);

  markSyncDone(userId);
}

// ── Returning user: cloud → local ────────────────────────────────────────────

export async function loadCloudToLocal(
  sb: SupabaseClient,
  userId: string,
): Promise<void> {
  const [cloudCosmetics, cloudUnlocked, cloudStats, cloudUnlockedCosmetics] =
    await Promise.all([
      fetchCloudCosmetics(sb, userId),
      fetchCloudAchievements(sb, userId),
      fetchCloudStats(sb, userId),
      fetchCloudUnlockedCosmetics(sb, userId),
    ]);

  if (cloudCosmetics) saveCosmetics(cloudCosmetics);
  if (cloudUnlocked) saveUnlocked(new Set(cloudUnlocked));
  if (cloudStats) saveStats(cloudStats);
  if (cloudUnlockedCosmetics) saveUnlockedCosmetics(cloudUnlockedCosmetics);
}
