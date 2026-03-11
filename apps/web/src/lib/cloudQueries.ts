import type { CosmeticsSelection } from 'shared';
import { getSupabase } from '@/lib/supabaseClient';
import type { PublicScoreEntry } from '@/lib/personal-scores/types';
import { getScoreConfig } from '@/lib/personal-scores/config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardRow {
  userId: string;
  nickname: string;
  cosmetics: CosmeticsSelection | null;
  played: number;
  wins: number;
  winrate: number; // 0–100
}

export interface LeaderboardSummary {
  topMostWins: LeaderboardRow[];
  topMostPlayed: LeaderboardRow[];
  topBestWinrate: LeaderboardRow[];
}

export interface PublicProfile {
  userId: string;
  nickname: string;
  createdAt: string | null;
  cosmetics: CosmeticsSelection | null;
  achievementsUnlockedCount: number;
  achievementsUnlockedIds: string[];
  totalPlayed: number;
  totalWins: number;
  totalWinrate: number; // 0–100
  favoriteGame: string | null;
  statsByGame: { gameId: string; played: number; wins: number; winrate: number }[];
  badges: string[];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface RawStatsRow {
  user_id: string;
  plays_total: number;
  wins_total: number;
  invites_total: number;
  plays_by_game: Record<string, number> | null;
  wins_by_game: Record<string, number> | null;
}

interface RawProfileRow {
  id: string;
  nickname: string | null;
}

interface RawCosmeticsRow {
  user_id: string;
  data: CosmeticsSelection | null;
}

function winrate(played: number, wins: number): number {
  if (played === 0) return 0;
  return Math.round((wins / played) * 100);
}

/**
 * Fetches all stats + profiles + cosmetics in parallel and joins them.
 * Returns null if Supabase is not configured.
 */
async function fetchAllStatsJoined(): Promise<
  | {
      stats: RawStatsRow[];
      profiles: Map<string, RawProfileRow>;
      cosmetics: Map<string, CosmeticsSelection>;
    }
  | null
> {
  const sb = getSupabase();
  if (!sb) return null;

  const [statsRes, profilesRes, cosmeticsRes] = await Promise.all([
    sb.from('user_stats').select('*'),
    sb.from('profiles').select('id, nickname'),
    sb.from('user_cosmetics').select('user_id, data'),
  ]);

  if (statsRes.error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[cloudQueries] stats fetch error:', statsRes.error);
    }
    return null;
  }

  const profiles = new Map<string, RawProfileRow>();
  for (const p of (profilesRes.data ?? []) as RawProfileRow[]) {
    profiles.set(p.id, p);
  }

  const cosmetics = new Map<string, CosmeticsSelection>();
  for (const c of (cosmeticsRes.data ?? []) as RawCosmeticsRow[]) {
    if (c.data) cosmetics.set(c.user_id, c.data);
  }

  return {
    stats: (statsRes.data ?? []) as RawStatsRow[],
    profiles,
    cosmetics,
  };
}

function toRow(
  raw: { userId: string; played: number; wins: number },
  profiles: Map<string, RawProfileRow>,
  cosmetics: Map<string, CosmeticsSelection>,
): LeaderboardRow {
  const profile = profiles.get(raw.userId);
  return {
    userId: raw.userId,
    nickname: profile?.nickname || 'Spieler',
    cosmetics: cosmetics.get(raw.userId) ?? null,
    played: raw.played,
    wins: raw.wins,
    winrate: winrate(raw.played, raw.wins),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

const LIMIT = 20;
const MIN_GAMES_WINRATE = 5;

/**
 * Global leaderboard summary: top by wins, top by plays, top by winrate.
 * Returns empty summary if Supabase unavailable.
 */
export async function getLeaderboardSummary(): Promise<LeaderboardSummary> {
  const empty: LeaderboardSummary = {
    topMostWins: [],
    topMostPlayed: [],
    topBestWinrate: [],
  };

  const joined = await fetchAllStatsJoined();
  if (!joined) return empty;

  const { stats, profiles, cosmetics } = joined;

  // Most wins
  const byWins = [...stats]
    .filter((s) => s.wins_total > 0)
    .sort((a, b) => b.wins_total - a.wins_total)
    .slice(0, LIMIT)
    .map((s) =>
      toRow(
        { userId: s.user_id, played: s.plays_total, wins: s.wins_total },
        profiles,
        cosmetics,
      ),
    );

  // Most played
  const byPlayed = [...stats]
    .filter((s) => s.plays_total > 0)
    .sort((a, b) => b.plays_total - a.plays_total)
    .slice(0, LIMIT)
    .map((s) =>
      toRow(
        { userId: s.user_id, played: s.plays_total, wins: s.wins_total },
        profiles,
        cosmetics,
      ),
    );

  // Best winrate (min 5 games)
  const byWinrate = [...stats]
    .filter((s) => s.plays_total >= MIN_GAMES_WINRATE)
    .sort(
      (a, b) =>
        winrate(b.plays_total, b.wins_total) -
        winrate(a.plays_total, a.wins_total),
    )
    .slice(0, LIMIT)
    .map((s) =>
      toRow(
        { userId: s.user_id, played: s.plays_total, wins: s.wins_total },
        profiles,
        cosmetics,
      ),
    );

  return {
    topMostWins: byWins,
    topMostPlayed: byPlayed,
    topBestWinrate: byWinrate,
  };
}

/**
 * Per-game leaderboard: top players for a specific gameId.
 */
export async function getLeaderboardByGame(
  gameId: string,
): Promise<LeaderboardRow[]> {
  const joined = await fetchAllStatsJoined();
  if (!joined) return [];

  const { stats, profiles, cosmetics } = joined;

  const rows: LeaderboardRow[] = [];
  for (const s of stats) {
    const played = (s.plays_by_game ?? {})[gameId] ?? 0;
    const wins = (s.wins_by_game ?? {})[gameId] ?? 0;
    if (played === 0) continue;
    rows.push(toRow({ userId: s.user_id, played, wins }, profiles, cosmetics));
  }

  rows.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);
  return rows.slice(0, LIMIT);
}

// ── Public profile ──────────────────────────────────────────────────────────

/**
 * Load a single user's public profile by userId.
 * Returns null if Supabase is unavailable or the user doesn't exist at all.
 */
export async function getPublicProfileByUserId(
  userId: string,
): Promise<PublicProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const [profileRes, cosmeticsRes, achievementsRes, statsRes] =
    await Promise.all([
      sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
      sb.from('user_cosmetics').select('data').eq('user_id', userId).maybeSingle(),
      sb.from('user_achievements').select('unlocked').eq('user_id', userId).maybeSingle(),
      sb.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
    ]);

  // If no profile and no stats, user doesn't exist
  if (!profileRes.data && !statsRes.data) return null;

  const nickname =
    (profileRes.data as { nickname?: string } | null)?.nickname || 'Spieler';
  const createdAt =
    (profileRes.data as { created_at?: string } | null)?.created_at ?? null;
  const cosmetics =
    (cosmeticsRes.data?.data as CosmeticsSelection) ?? null;
  const unlocked = (achievementsRes.data?.unlocked as string[]) ?? [];

  const raw = statsRes.data as RawStatsRow | null;
  const totalPlayed = raw?.plays_total ?? 0;
  const totalWins = raw?.wins_total ?? 0;
  const playsByGame = raw?.plays_by_game ?? {};
  const winsByGame = raw?.wins_by_game ?? {};

  // Build per-game stats
  const gameIds = new Set([
    ...Object.keys(playsByGame),
    ...Object.keys(winsByGame),
  ]);
  const statsByGame: PublicProfile['statsByGame'] = [];
  let maxPlayed = 0;
  let favoriteGame: string | null = null;
  for (const gid of gameIds) {
    const played = playsByGame[gid] ?? 0;
    const wins = winsByGame[gid] ?? 0;
    if (played === 0) continue;
    statsByGame.push({
      gameId: gid,
      played,
      wins,
      winrate: winrate(played, wins),
    });
    if (played > maxPlayed) {
      maxPlayed = played;
      favoriteGame = gid;
    }
  }
  statsByGame.sort((a, b) => b.played - a.played);

  return {
    userId,
    nickname,
    createdAt,
    cosmetics,
    achievementsUnlockedCount: unlocked.length,
    achievementsUnlockedIds: unlocked,
    totalPlayed,
    totalWins,
    totalWinrate: winrate(totalPlayed, totalWins),
    favoriteGame,
    statsByGame,
    badges: cosmetics?.badges?.slice(0, 3) ?? [],
  };
}

// ── Singleplayer public leaderboard ──────────────────────────────────────────

interface SpScoreRow {
  id: string;
  user_id: string;
  nickname: string;
  game_id: string;
  score: number;
  created_at: string;
  meta: Record<string, number | string | boolean> | null;
}

/**
 * Fetch the public singleplayer leaderboard for a given gameId.
 * Returns only the best score per user.
 */
export async function getSingleplayerLeaderboard(
  gameId: string,
  limit = 25,
): Promise<PublicScoreEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const config = getScoreConfig(gameId);
  if (!config) return [];

  const ascending = config.sortDirection === 'asc';

  // Over-fetch so we have enough unique users after deduplication
  const { data, error } = await sb
    .from('singleplayer_scores')
    .select('*')
    .eq('game_id', gameId)
    .order('score', { ascending })
    .limit(limit * 4);

  if (error || !data) return [];

  // Deduplicate: keep only the best score per user (first seen = best, since sorted)
  const seen = new Set<string>();
  const result: PublicScoreEntry[] = [];
  for (const row of data as SpScoreRow[]) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    result.push({
      id: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      gameId: row.game_id,
      score: row.score,
      createdAt: row.created_at,
      meta: row.meta ?? undefined,
    });
    if (result.length >= limit) break;
  }
  return result;
}
