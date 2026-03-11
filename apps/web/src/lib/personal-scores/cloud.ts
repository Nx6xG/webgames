import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicScoreEntry } from './types';
import { getScoreConfig } from './config';

// ── DB row shape (snake_case from Supabase) ─────────────────────────────────

interface ScoreRow {
  id: string;
  user_id: string;
  nickname: string;
  game_id: string;
  score: number;
  created_at: string;
  meta: Record<string, number | string | boolean> | null;
}

function rowToEntry(row: ScoreRow): PublicScoreEntry {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    gameId: row.game_id,
    score: row.score,
    createdAt: row.created_at,
    meta: row.meta ?? undefined,
  };
}

/**
 * Keep only the best entry per user_id.
 * The input MUST already be sorted by score (best first).
 */
function bestPerUser(rows: ScoreRow[]): ScoreRow[] {
  const seen = new Set<string>();
  const result: ScoreRow[] = [];
  for (const row of rows) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    result.push(row);
  }
  return result;
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** Fetch the public leaderboard for a game (best score per user). */
export async function fetchPublicLeaderboard(
  sb: SupabaseClient,
  gameId: string,
  limit: number,
): Promise<PublicScoreEntry[]> {
  const config = getScoreConfig(gameId);
  if (!config) return [];

  const ascending = config.sortDirection === 'asc';

  // Over-fetch to ensure enough unique users after dedup
  const { data, error } = await sb
    .from('singleplayer_scores')
    .select('*')
    .eq('game_id', gameId)
    .order('score', { ascending })
    .limit(limit * 4);

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[cloud] fetchPublicLeaderboard error:', error.message, error.code);
    }
    return [];
  }
  if (!data) return [];

  // Deduplicate: keep only the best score per user, then trim to requested limit
  return bestPerUser(data as ScoreRow[]).slice(0, limit).map(rowToEntry);
}

/** Submit a score to the public leaderboard. Only for logged-in users. */
export async function submitPublicScore(
  sb: SupabaseClient,
  userId: string,
  nickname: string,
  gameId: string,
  score: number,
  meta?: Record<string, number | string | boolean>,
): Promise<void> {
  const config = getScoreConfig(gameId);
  if (!config || !config.shouldStore(score, meta)) return;

  const { error } = await sb.from('singleplayer_scores').insert({
    user_id: userId,
    nickname,
    game_id: gameId,
    score,
    meta: meta ?? null,
  });
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[cloud] submitPublicScore error:', error.message, error.code);
  }
}

/** Get the current user's best public entry for a game (for rank highlight). */
export async function fetchMyBestPublicScore(
  sb: SupabaseClient,
  userId: string,
  gameId: string,
): Promise<PublicScoreEntry | null> {
  const config = getScoreConfig(gameId);
  if (!config) return null;

  const ascending = config.sortDirection === 'asc';

  const { data, error } = await sb
    .from('singleplayer_scores')
    .select('*')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .order('score', { ascending })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return rowToEntry(data[0] as ScoreRow);
}
