'use client';

/**
 * Profile Showcase — lets users curate which stats and achievements
 * other players see on their mini-profile card.
 *
 * Config (user's choices) is stored in localStorage.
 * The wire-format ProfileShowcase (with pre-computed display values) is
 * built at identify-time and sent via the presence system.
 */

import type { ProfileShowcase, ShowcaseStat } from 'shared';
import { loadStats, loadUnlocked } from '@/lib/achievements/store';
import { GAME_EMOJI, ALL_GAME_IDS } from '@/lib/localStats';
import { loadScores } from '@/lib/personal-scores/storage';

const STORAGE_KEY = 'webgames_showcase_v1';

// ── Config (user choices) ────────────────────────────────────────────────────

export interface ShowcaseStatChoice {
  gameId: string;   // 'total' | specific gameId
  statKey: string;  // 'wins' | 'winRate' | 'plays' | 'bestScore' | 'bestTime'
}

export interface ShowcaseConfig {
  favoriteGameId?: string;
  stats?: ShowcaseStatChoice[];   // max 3
  achievements?: string[];         // max 3 achievement IDs
}

export function loadShowcaseConfig(): ShowcaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveShowcaseConfig(config: ShowcaseConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
}

// ── Available stat options ───────────────────────────────────────────────────

export interface AvailableStat {
  gameId: string;
  statKey: string;
  value: string;
  numericValue: number;
}

export function getAvailableStats(): AvailableStat[] {
  const achStats = loadStats();
  const result: AvailableStat[] = [];

  // Totals
  if (achStats.playsTotal > 0) {
    result.push({ gameId: 'total', statKey: 'plays', value: String(achStats.playsTotal), numericValue: achStats.playsTotal });
    result.push({ gameId: 'total', statKey: 'wins', value: String(achStats.winsTotal), numericValue: achStats.winsTotal });
    const wr = Math.round((achStats.winsTotal / achStats.playsTotal) * 100);
    result.push({ gameId: 'total', statKey: 'winRate', value: `${wr}%`, numericValue: wr });
  }

  // Per-game
  for (const gid of ALL_GAME_IDS) {
    const plays = achStats.playsByGame[gid] ?? 0;
    const wins = achStats.winsByGame[gid] ?? 0;
    if (plays === 0) continue;

    result.push({ gameId: gid, statKey: 'plays', value: String(plays), numericValue: plays });
    result.push({ gameId: gid, statKey: 'wins', value: String(wins), numericValue: wins });
    const wr = Math.round((wins / plays) * 100);
    result.push({ gameId: gid, statKey: 'winRate', value: `${wr}%`, numericValue: wr });

    // Best score from personal scores
    const scores = loadScores(gid);
    if (scores.length > 0) {
      result.push({ gameId: gid, statKey: 'bestScore', value: String(scores[0].score), numericValue: scores[0].score });
    }
  }

  return result;
}

/** All game IDs the user has actually played (plays > 0). */
export function getPlayedGameIds(): string[] {
  const achStats = loadStats();
  return ALL_GAME_IDS.filter((gid) => (achStats.playsByGame[gid] ?? 0) > 0);
}

// ── Build wire-format showcase ───────────────────────────────────────────────

export function buildShowcase(config: ShowcaseConfig): ProfileShowcase {
  const available = getAvailableStats();
  const unlocked = loadUnlocked();

  const hasManualConfig = !!(config.favoriteGameId || config.stats?.length || config.achievements?.length);

  if (hasManualConfig) {
    // Manual config — resolve user choices
    const stats: ShowcaseStat[] = [];
    for (const choice of config.stats?.slice(0, 3) ?? []) {
      const found = available.find((a) => a.gameId === choice.gameId && a.statKey === choice.statKey);
      if (found) stats.push({ gameId: found.gameId, statKey: found.statKey, value: found.value });
    }

    const achievements: string[] = [];
    for (const id of config.achievements?.slice(0, 3) ?? []) {
      if (unlocked.has(id)) achievements.push(id);
    }

    return {
      favoriteGameId: config.favoriteGameId,
      stats: stats.length > 0 ? stats : undefined,
      achievements: achievements.length > 0 ? achievements : undefined,
    };
  }

  // Auto-generate showcase from available data
  return buildAutoShowcase(available, unlocked);
}

/** Auto-pick showcase content when user hasn't configured anything. */
function buildAutoShowcase(available: AvailableStat[], unlocked: Set<string>): ProfileShowcase {
  // Favorite game = most played (exclude 'total')
  const gamePlays = available.filter((s) => s.gameId !== 'total' && s.statKey === 'plays');
  gamePlays.sort((a, b) => b.numericValue - a.numericValue);
  const favoriteGameId = gamePlays[0]?.gameId;

  // Stats: pick total plays, total wins, total winRate (the 3 totals)
  const autoStats: ShowcaseStat[] = [];
  for (const key of ['plays', 'wins', 'winRate'] as const) {
    const found = available.find((s) => s.gameId === 'total' && s.statKey === key);
    if (found) autoStats.push({ gameId: found.gameId, statKey: found.statKey, value: found.value });
  }

  // Achievements: pick up to 3 unlocked (last unlocked = most recent)
  const achIds = [...unlocked].slice(-3);

  return {
    favoriteGameId,
    stats: autoStats.length > 0 ? autoStats : undefined,
    achievements: achIds.length > 0 ? achIds : undefined,
  };
}

export { GAME_EMOJI };
