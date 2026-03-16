import type { SupabaseClient } from '@supabase/supabase-js';
import type { CosmeticsSelection } from 'shared';
import type { AchievementStats } from '@/lib/achievements/definitions';
import type { CosmeticSlot } from '@/lib/cosmetics';
import { loadCosmetics, saveCosmetics } from '@/lib/cosmetics';
import { getStoredNickname, setStoredNickname } from '@/lib/nickname';
import {
  loadStats,
  saveStats,
  loadUnlocked,
  saveUnlocked,
  loadUnlockedCosmetics,
  saveUnlockedCosmetics,
} from '@/lib/achievements/store';
import type { PlayerProgression } from '@/lib/progression';
import { loadProgression, saveProgression } from '@/lib/progression';

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
    lossesTotal: (data as Record<string, unknown>).losses_total as number ?? 0,
    invitesTotal: data.invites_total ?? 0,
    lobbiesHosted: (data as Record<string, unknown>).lobbies_hosted as number ?? 0,
    publicGamesJoined: (data as Record<string, unknown>).public_games_joined as number ?? 0,
    messagesSent: (data as Record<string, unknown>).messages_sent as number ?? 0,
    profileCustomized: (data as Record<string, unknown>).profile_customized as boolean ?? false,
    currentWinStreak: (data as Record<string, unknown>).current_win_streak as number ?? 0,
    maxWinStreak: (data as Record<string, unknown>).max_win_streak as number ?? 0,
    tttCurrentWinStreak: (data as Record<string, unknown>).ttt_current_win_streak as number ?? 0,
    tttMaxWinStreak: (data as Record<string, unknown>).ttt_max_win_streak as number ?? 0,
    level: (data as Record<string, unknown>).level as number ?? 0,
    totalUnlocked: (data as Record<string, unknown>).total_unlocked as number ?? 0,
    playsByGame: (data.plays_by_game as Record<string, number>) ?? {},
    winsByGame: (data.wins_by_game as Record<string, number>) ?? {},
    flags: (data as Record<string, unknown>).flags as Record<string, boolean> ?? {},
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

export async function fetchCloudProgression(
  sb: SupabaseClient,
  userId: string,
): Promise<PlayerProgression | null> {
  const { data } = await sb
    .from('user_progression')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.data as PlayerProgression) ?? null;
}

export async function saveCloudProgression(
  sb: SupabaseClient,
  userId: string,
  prog: PlayerProgression,
): Promise<void> {
  await sb
    .from('user_progression')
    .upsert({ user_id: userId, data: prog }, { onConflict: 'user_id' });
}

// ── Game progress (singleplayer unlocks) ─────────────────────────────────────

export type GameProgressData = Record<string, unknown>;

export async function fetchCloudGameProgress(
  sb: SupabaseClient,
  userId: string,
): Promise<GameProgressData | null> {
  const { data } = await sb
    .from('user_game_progress')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.data as GameProgressData) ?? null;
}

export async function saveCloudGameProgress(
  sb: SupabaseClient,
  userId: string,
  progress: GameProgressData,
): Promise<void> {
  await sb
    .from('user_game_progress')
    .upsert({ user_id: userId, data: progress }, { onConflict: 'user_id' });
}

// ── Roguelite save (stored in game progress) ─────────────────────────────────

export async function fetchCloudRogueliteSave(
  sb: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const progress = await fetchCloudGameProgress(sb, userId);
  if (!progress) return null;
  return (progress.asteroids_roguelite as Record<string, unknown>) ?? null;
}

export async function saveCloudRogueliteSave(
  sb: SupabaseClient,
  userId: string,
  save: Record<string, unknown>,
): Promise<void> {
  const existing = await fetchCloudGameProgress(sb, userId) ?? {};
  const merged = { ...existing, asteroids_roguelite: save };
  await saveCloudGameProgress(sb, userId, merged);
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

/** Merge two roguelite saves — takes the best of both. */
export function mergeRogueliteSaves(
  local: Record<string, unknown> | null,
  cloud: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!local) return cloud ?? {};
  if (!cloud) return local;

  // Numeric fields: take max
  const numMax = (key: string) => Math.max(
    (local[key] as number) ?? 0,
    (cloud[key] as number) ?? 0,
  );

  // Array fields: union
  const arrayUnion = (key: string) => [
    ...new Set([
      ...((local[key] as string[]) ?? []),
      ...((cloud[key] as string[]) ?? []),
    ]),
  ];

  // Upgrades: take max per upgrade
  const localUpg = (local.upgrades as Record<string, number>) ?? {};
  const cloudUpg = (cloud.upgrades as Record<string, number>) ?? {};
  const mergedUpg: Record<string, number> = { ...cloudUpg };
  for (const [k, v] of Object.entries(localUpg)) {
    mergedUpg[k] = Math.max(mergedUpg[k] ?? 0, v);
  }

  // Bestiary: union, take max count per entry
  const localBest = (local.bestiary as Record<string, { seen: boolean; count: number; firstWave?: number }>) ?? {};
  const cloudBest = (cloud.bestiary as Record<string, { seen: boolean; count: number; firstWave?: number }>) ?? {};
  const mergedBest: Record<string, { seen: boolean; count: number; firstWave?: number }> = {};
  const allKeys = new Set([...Object.keys(localBest), ...Object.keys(cloudBest)]);
  for (const key of allKeys) {
    const l = localBest[key];
    const c = cloudBest[key];
    if (!l) { mergedBest[key] = c; continue; }
    if (!c) { mergedBest[key] = l; continue; }
    mergedBest[key] = {
      seen: l.seen || c.seen,
      count: Math.max(l.count, c.count),
      firstWave: Math.min(l.firstWave ?? Infinity, c.firstWave ?? Infinity) === Infinity
        ? undefined
        : Math.min(l.firstWave ?? Infinity, c.firstWave ?? Infinity),
    };
  }

  return {
    scrap: numMax('scrap'),
    upgrades: mergedUpg,
    totalRuns: numMax('totalRuns'),
    bestWave: numMax('bestWave'),
    bestScore: numMax('bestScore'),
    ascensionLevel: numMax('ascensionLevel'),
    selectedShip: (cloud.selectedShip as string) ?? (local.selectedShip as string) ?? 'vanguard',
    unlockedMilestones: arrayUnion('unlockedMilestones'),
    bestiary: mergedBest,
    totalBossesKilled: numMax('totalBossesKilled'),
    totalAsteroidsKilled: numMax('totalAsteroidsKilled'),
    bestRunScrap: numMax('bestRunScrap'),
  };
}

// ── Profile bootstrap ────────────────────────────────────────────────────

/**
 * Ensure a profiles row exists for the user.
 * If one already exists, load its nickname into localStorage (cloud wins).
 * If none exists, create one using the current local nickname as fallback.
 */
export async function ensureProfile(
  sb: SupabaseClient,
  userId: string,
  email: string | undefined,
): Promise<void> {
  console.log('[ensureProfile] called for', userId);

  const { data, error: selectErr } = await sb
    .from('profiles')
    .select('id, nickname')
    .eq('id', userId)
    .maybeSingle();

  if (selectErr) {
    console.error('[ensureProfile] select error:', selectErr);
  }

  if (data) {
    console.log('[ensureProfile] row already exists');
    // Cloud nickname is source of truth — write it to localStorage
    const cloudNick = (data as { nickname?: string }).nickname;
    if (cloudNick) {
      console.log('[ensureProfile] applying cloud nickname:', cloudNick);
      setStoredNickname(cloudNick);
    }
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

/** Update the cloud profile nickname (for manual edits while logged in). */
export async function saveCloudNickname(
  sb: SupabaseClient,
  userId: string,
  nickname: string,
): Promise<void> {
  const { error } = await sb
    .from('profiles')
    .update({ nickname })
    .eq('id', userId);
  if (error) {
    console.error('[saveCloudNickname] error:', error);
  }
}

// ── Game progress local storage ──────────────────────────────────────────────

const GAME_PROGRESS_KEY = 'webgames.game_progress';

export function loadGameProgress(): GameProgressData {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(GAME_PROGRESS_KEY) : null;
    if (!raw) return {};
    return JSON.parse(raw) as GameProgressData;
  } catch { return {}; }
}

export function saveGameProgress(data: GameProgressData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GAME_PROGRESS_KEY, JSON.stringify(data));
}

/** Merge game progress: union arrays per game key. */
export function mergeGameProgress(
  local: GameProgressData,
  cloud: GameProgressData,
): GameProgressData {
  const result: GameProgressData = { ...cloud };
  for (const [key, val] of Object.entries(local)) {
    const cloudVal = result[key];
    if (Array.isArray(val) && Array.isArray(cloudVal)) {
      result[key] = [...new Set([...cloudVal, ...val])];
    } else if (Array.isArray(val)) {
      result[key] = val;
    }
    // cloud wins for non-array values
  }
  return result;
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

// ── Safe wrapper ─────────────────────────────────────────────────────────────

/** Run an async step, logging but never throwing on failure. */
async function safe(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[cloudSync] ${label} failed:`, err);
  }
}

// ── Initial sync (first login — merge local ↔ cloud) ─────────────────────

export async function runInitialSync(
  sb: SupabaseClient,
  userId: string,
  email?: string,
): Promise<void> {
  // Bootstrap profile row (no-op if already exists)
  await safe('ensureProfile', () => ensureProfile(sb, userId, email));

  // Load local data
  const localCosmetics = loadCosmetics();
  const localUnlocked = [...loadUnlocked()];
  const localStats = loadStats();
  const localUnlockedCosmetics = loadUnlockedCosmetics();
  const localProgression = loadProgression();
  const localGameProgress = loadGameProgress();

  // Load cloud data (each fetch is individually safe)
  const [cloudCosmetics, cloudUnlocked, cloudStats, cloudUnlockedCosmetics, cloudProgression, cloudGameProgress] =
    await Promise.all([
      fetchCloudCosmetics(sb, userId).catch((e) => { console.error('[cloudSync] fetchCosmetics:', e); return null; }),
      fetchCloudAchievements(sb, userId).catch((e) => { console.error('[cloudSync] fetchAchievements:', e); return null; }),
      fetchCloudStats(sb, userId).catch((e) => { console.error('[cloudSync] fetchStats:', e); return null; }),
      fetchCloudUnlockedCosmetics(sb, userId).catch((e) => { console.error('[cloudSync] fetchUnlockedCosmetics:', e); return null; }),
      fetchCloudProgression(sb, userId).catch((e) => { console.error('[cloudSync] fetchProgression:', e); return null; }),
      fetchCloudGameProgress(sb, userId).catch((e) => { console.error('[cloudSync] fetchGameProgress:', e); return null; }),
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
    lossesTotal: Math.max(localStats.lossesTotal, cloudStats?.lossesTotal ?? 0),
    invitesTotal: Math.max(localStats.invitesTotal, cloudStats?.invitesTotal ?? 0),
    lobbiesHosted: Math.max(localStats.lobbiesHosted, cloudStats?.lobbiesHosted ?? 0),
    publicGamesJoined: Math.max(localStats.publicGamesJoined, cloudStats?.publicGamesJoined ?? 0),
    messagesSent: Math.max(localStats.messagesSent, cloudStats?.messagesSent ?? 0),
    profileCustomized: localStats.profileCustomized || (cloudStats?.profileCustomized ?? false),
    currentWinStreak: Math.max(localStats.currentWinStreak, cloudStats?.currentWinStreak ?? 0),
    maxWinStreak: Math.max(localStats.maxWinStreak, cloudStats?.maxWinStreak ?? 0),
    tttCurrentWinStreak: Math.max(localStats.tttCurrentWinStreak, cloudStats?.tttCurrentWinStreak ?? 0),
    tttMaxWinStreak: Math.max(localStats.tttMaxWinStreak, cloudStats?.tttMaxWinStreak ?? 0),
    level: Math.max(localStats.level, cloudStats?.level ?? 0),
    totalUnlocked: Math.max(localStats.totalUnlocked, cloudStats?.totalUnlocked ?? 0),
    playsByGame: mergeMaxRecord(
      localStats.playsByGame,
      cloudStats?.playsByGame ?? {},
    ),
    winsByGame: mergeMaxRecord(
      localStats.winsByGame,
      cloudStats?.winsByGame ?? {},
    ),
    flags: { ...(cloudStats?.flags ?? {}), ...localStats.flags },
  };

  // Merge unlocked cosmetics (union per slot)
  const defaultMap: UnlockedCosmeticsMap = {
    frame: [], head: [], portal: [], aura: [], banner: [], cardColor: [], badge: [], title: [],
  };
  const mergedUnlockedCosmetics = mergeUnlockedCosmetics(
    localUnlockedCosmetics,
    cloudUnlockedCosmetics ?? defaultMap,
  );

  // Merge progression (take whichever is further ahead — higher level, or same level + more XP)
  const cp = cloudProgression;
  let mergedProgression = localProgression;
  if (cp) {
    const localAhead = localProgression.level > cp.level ||
      (localProgression.level === cp.level && localProgression.xp >= cp.xp);
    mergedProgression = localAhead ? localProgression : { ...localProgression, ...cp };
    mergedProgression.tokens = Math.max(localProgression.tokens, cp.tokens);
  }

  // Merge game progress (union of arrays per game key)
  const mergedGameProgress = mergeGameProgress(localGameProgress, cloudGameProgress ?? {});

  // Merge roguelite save (special handling — not array-based)
  const localRlRaw = typeof window !== 'undefined' ? localStorage.getItem('webgames.asteroids.roguelite') : null;
  const localRl = localRlRaw ? JSON.parse(localRlRaw) as Record<string, unknown> : null;
  const cloudRl = (mergedGameProgress.asteroids_roguelite as Record<string, unknown>) ?? null;
  if (localRl || cloudRl) {
    const mergedRl = mergeRogueliteSaves(localRl, cloudRl);
    if (typeof window !== 'undefined') {
      localStorage.setItem('webgames.asteroids.roguelite', JSON.stringify(mergedRl));
    }
    mergedGameProgress.asteroids_roguelite = mergedRl;
  }

  // Save merged → local
  saveCosmetics(mergedCosmetics);
  saveUnlocked(new Set(mergedUnlocked));
  saveStats(mergedStats);
  saveUnlockedCosmetics(mergedUnlockedCosmetics);
  saveProgression(mergedProgression);
  saveGameProgress(mergedGameProgress);

  // Save merged → cloud (each save is individually safe)
  await Promise.all([
    safe('saveCosmetics', () => saveCloudCosmetics(sb, userId, mergedCosmetics)),
    safe('saveAchievements', () => saveCloudAchievements(sb, userId, mergedUnlocked)),
    safe('saveStats', () => saveCloudStats(sb, userId, mergedStats)),
    safe('saveUnlockedCosmetics', () => saveCloudUnlockedCosmetics(sb, userId, mergedUnlockedCosmetics)),
    safe('saveProgression', () => saveCloudProgression(sb, userId, mergedProgression)),
    safe('saveGameProgress', () => saveCloudGameProgress(sb, userId, mergedGameProgress)),
  ]);

  markSyncDone(userId);
}

// ── Returning user: cloud → local ────────────────────────────────────────────

export async function loadCloudToLocal(
  sb: SupabaseClient,
  userId: string,
): Promise<void> {
  const [cloudCosmetics, cloudUnlocked, cloudStats, cloudUnlockedCosmetics, cloudProgression, cloudGameProgress] =
    await Promise.all([
      fetchCloudCosmetics(sb, userId).catch((e) => { console.error('[cloudSync] fetchCosmetics:', e); return null; }),
      fetchCloudAchievements(sb, userId).catch((e) => { console.error('[cloudSync] fetchAchievements:', e); return null; }),
      fetchCloudStats(sb, userId).catch((e) => { console.error('[cloudSync] fetchStats:', e); return null; }),
      fetchCloudUnlockedCosmetics(sb, userId).catch((e) => { console.error('[cloudSync] fetchUnlockedCosmetics:', e); return null; }),
      fetchCloudProgression(sb, userId).catch((e) => { console.error('[cloudSync] fetchProgression:', e); return null; }),
      fetchCloudGameProgress(sb, userId).catch((e) => { console.error('[cloudSync] fetchGameProgress:', e); return null; }),
    ]);

  if (cloudCosmetics) saveCosmetics(cloudCosmetics);
  if (cloudUnlocked) saveUnlocked(new Set(cloudUnlocked));
  if (cloudStats) saveStats(cloudStats);
  if (cloudUnlockedCosmetics) saveUnlockedCosmetics(cloudUnlockedCosmetics);
  if (cloudProgression) saveProgression(cloudProgression);
  if (cloudGameProgress) {
    saveGameProgress(cloudGameProgress);
    // Restore roguelite save from cloud
    const cloudRl = (cloudGameProgress as Record<string, unknown>).asteroids_roguelite;
    if (cloudRl && typeof window !== 'undefined') {
      localStorage.setItem('webgames.asteroids.roguelite', JSON.stringify(cloudRl));
    }
  }
}
