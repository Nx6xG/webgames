'use client';

/**
 * Aggregates local-only stats from multiple localStorage sources
 * into a unified view for the profile and leaderboards pages.
 *
 * Sources:
 * - Achievement stats (webgames_stats_v1): plays/wins per game
 * - Snake highscores (webgames.snake.highscores)
 * - Tetris stats (webgames.tetris.stats)
 * - 2048 highscores (webgames.2048.highscores)
 * - Flappy highscores (webgames.flappy.highscores)
 * - Sudoku stats (webgames.sudoku.stats)
 */

import { loadStats, loadUnlocked } from '@/lib/achievements/store';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { loadScores } from '@/lib/personal-scores/storage';
import { getScoreConfig } from '@/lib/personal-scores/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GameStat {
  gameId: string;
  plays: number;
  wins: number;
  winRate: number; // 0-100
  bestScore: number | null;
  bestTime: number | null; // seconds
  bestTile: number | null;
  bestLines: number | null;
}

export interface HighscoreRun {
  score: number;
  date: number; // timestamp ms
  extra?: string; // e.g. "Level 12" or "512 tile"
}

export interface GameLeaderboardData {
  gameId: string;
  plays: number;
  wins: number;
  winRate: number;
  bestScore: number | null;
  bestTime: number | null;
  bestTile: number | null;
  bestLines: number | null;
  topRuns: HighscoreRun[];
}

export interface LocalProfile {
  playsTotal: number;
  winsTotal: number;
  winRate: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteGameId: string | null;
  perGame: GameStat[];
}

// ── All known game IDs (display order) ────────────────────────────────────────

export const MULTIPLAYER_GAME_IDS = ['tictactoe', 'connect4', 'rps', 'chess', 'battleship', 'liarsbar', 'curvefever', 'uno'] as const;
export const SINGLEPLAYER_GAME_IDS = ['2048', 'snake', 'tetris', 'flappy', 'sudoku', 'tictactoe-solo', 'pong', 'breakout', 'minesweeper'] as const;
export const ALL_GAME_IDS = [...MULTIPLAYER_GAME_IDS, ...SINGLEPLAYER_GAME_IDS] as const;

export const GAME_EMOJI: Record<string, string> = {
  tictactoe: '✖️',
  connect4: '🔴',
  rps: '✊',
  chess: '♟️',
  battleship: '🚢',
  liarsbar: '🃏',
  curvefever: '🐍',
  uno: '🎴',
  '2048': '🔢',
  snake: '🐍',
  tetris: '🧱',
  flappy: '🐦',
  sudoku: '#️⃣',
  'tictactoe-solo': '✖️',
  pong: '🏓',
  breakout: '🧱',
  minesweeper: '💣',
  mahjong: '🀄',
  doodlejump: '🦘',
  crossyroad: '🐔',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ── Personal-scores helper (reads from webgames.pb.* keys) ──────────────────

function loadPbBestScore(gameId: string): number | null {
  const entries = loadScores(gameId);
  if (entries.length === 0) return null;
  const config = getScoreConfig(gameId);
  if (!config) return entries[0]?.score ?? null;
  return entries[0]?.score ?? null;
}

function loadPbTopRuns(gameId: string, extraFn?: (meta?: Record<string, unknown>) => string | undefined): HighscoreRun[] {
  return loadScores(gameId).map((e) => ({
    score: e.score,
    date: e.createdAt,
    extra: extraFn ? extraFn(e.meta as Record<string, unknown> | undefined) : undefined,
  }));
}

// ── Snake ─────────────────────────────────────────────────────────────────────

function loadSnakeData(): { bestScore: number | null; topRuns: HighscoreRun[] } {
  const pbBest = loadPbBestScore('snake');
  if (pbBest !== null) return { bestScore: pbBest, topRuns: loadPbTopRuns('snake') };
  // Fallback: legacy format
  interface SnakeEntry { score: number; date: number }
  const entries = parseJSON<SnakeEntry[]>(safeGet('webgames.snake.highscores'));
  if (!entries || entries.length === 0) return { bestScore: null, topRuns: [] };
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    bestScore: sorted[0].score,
    topRuns: sorted.slice(0, 10).map((e) => ({ score: e.score, date: e.date })),
  };
}

// ── Tetris ────────────────────────────────────────────────────────────────────

function loadTetrisData(): { bestScore: number | null; bestLines: number | null; topRuns: HighscoreRun[] } {
  const pbBest = loadPbBestScore('tetris');
  if (pbBest !== null) {
    const runs = loadPbTopRuns('tetris', (m) => {
      if (!m) return undefined;
      return `Lvl ${m.level ?? '?'} · ${m.lines ?? '?'} lines`;
    });
    // bestLines from pb meta
    const pbEntries = loadScores('tetris');
    const bestLines = pbEntries.reduce((mx, e) => {
      const l = (e.meta?.lines as number) ?? 0;
      return l > mx ? l : mx;
    }, 0);
    return { bestScore: pbBest, bestLines: bestLines > 0 ? bestLines : null, topRuns: runs };
  }
  // Fallback: legacy format
  interface TetrisRun { score: number; lines: number; level: number; date: number }
  interface TetrisStats { bestScore: number; bestLines: number; gamesPlayed: number; top10: TetrisRun[] }
  const stats = parseJSON<TetrisStats>(safeGet('webgames.tetris.stats'));
  if (!stats) return { bestScore: null, bestLines: null, topRuns: [] };
  return {
    bestScore: stats.bestScore > 0 ? stats.bestScore : null,
    bestLines: stats.bestLines > 0 ? stats.bestLines : null,
    topRuns: (stats.top10 ?? []).map((r) => ({
      score: r.score,
      date: r.date,
      extra: `Lvl ${r.level} · ${r.lines} lines`,
    })),
  };
}

// ── 2048 ──────────────────────────────────────────────────────────────────────

function load2048Data(): { bestScore: number | null; bestTile: number | null; topRuns: HighscoreRun[] } {
  const pbBest = loadPbBestScore('2048');
  if (pbBest !== null) {
    const pbEntries = loadScores('2048');
    const bestTile = pbEntries.reduce((mx, e) => {
      const tile = (e.meta?.maxTile as number) ?? 0;
      return tile > mx ? tile : mx;
    }, 0);
    const runs = loadPbTopRuns('2048', (m) => m?.maxTile ? `${m.maxTile} tile` : undefined);
    return { bestScore: pbBest, bestTile: bestTile > 0 ? bestTile : null, topRuns: runs };
  }
  // Fallback: legacy format
  interface Entry2048 { score: number; maxTile: number; date: string }
  const entries = parseJSON<Entry2048[]>(safeGet('webgames.2048.highscores'));
  if (!entries || entries.length === 0) return { bestScore: null, bestTile: null, topRuns: [] };
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    bestScore: sorted[0].score,
    bestTile: sorted.reduce((m, e) => Math.max(m, e.maxTile ?? 0), 0) || null,
    topRuns: sorted.slice(0, 10).map((e) => ({
      score: e.score,
      date: new Date(e.date).getTime(),
      extra: e.maxTile ? `${e.maxTile} tile` : undefined,
    })),
  };
}

// ── Flappy ────────────────────────────────────────────────────────────────────

function loadFlappyData(): { bestScore: number | null; topRuns: HighscoreRun[] } {
  const pbBest = loadPbBestScore('flappy');
  if (pbBest !== null) return { bestScore: pbBest, topRuns: loadPbTopRuns('flappy') };
  // Fallback: legacy format
  interface FlappyEntry { score: number; date: number }
  const entries = parseJSON<FlappyEntry[]>(safeGet('webgames.flappy.highscores'));
  if (!entries || entries.length === 0) return { bestScore: null, topRuns: [] };
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return {
    bestScore: sorted[0].score,
    topRuns: sorted.slice(0, 10).map((e) => ({ score: e.score, date: e.date })),
  };
}

// ── Sudoku ────────────────────────────────────────────────────────────────────

interface DiffStats { games: number; wins: number; bestTime: number | null }
interface SudokuStatsRaw { easy: DiffStats; medium: DiffStats; hard: DiffStats; expert: DiffStats }

function loadSudokuData(): { bestTime: number | null } {
  const stats = parseJSON<SudokuStatsRaw>(safeGet('webgames.sudoku.stats'));
  if (!stats) return { bestTime: null };
  const times = [stats.easy, stats.medium, stats.hard, stats.expert]
    .map((d) => d?.bestTime)
    .filter((t): t is number => t !== null && t > 0);
  return { bestTime: times.length > 0 ? Math.min(...times) : null };
}

// ── Minesweeper ──────────────────────────────────────────────────────────────

interface MsStats { bestTimeEasy: number | null; bestTimeMedium: number | null; bestTimeHard: number | null }

function loadMinesweeperData(): { bestTime: number | null } {
  const stats = parseJSON<MsStats>(safeGet('webgames.minesweeper.stats'));
  if (!stats) return { bestTime: null };
  const times = [stats.bestTimeEasy, stats.bestTimeMedium, stats.bestTimeHard]
    .filter((t): t is number => t !== null && t > 0);
  return { bestTime: times.length > 0 ? Math.min(...times) : null };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Lightweight summary for the dropdown header (no per-game breakdown). */
export interface QuickStats {
  playsTotal: number;
  winsTotal: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export function loadQuickStats(): QuickStats {
  const achStats = loadStats();
  const unlocked = loadUnlocked();
  return {
    playsTotal: achStats.playsTotal,
    winsTotal: achStats.winsTotal,
    achievementsUnlocked: unlocked.size,
    achievementsTotal: ACHIEVEMENTS.length,
  };
}

export function loadLocalProfile(): LocalProfile {
  const achStats = loadStats();
  const unlocked = loadUnlocked();

  const perGame: GameStat[] = ALL_GAME_IDS.map((gid) => {
    const plays = achStats.playsByGame[gid] ?? 0;
    const wins = achStats.winsByGame[gid] ?? 0;
    const winRate = plays > 0 ? Math.round((wins / plays) * 100) : 0;

    let bestScore: number | null = null;
    let bestTime: number | null = null;
    let bestTile: number | null = null;
    let bestLines: number | null = null;

    if (gid === 'snake') bestScore = loadSnakeData().bestScore;
    else if (gid === 'tetris') {
      const td = loadTetrisData();
      bestScore = td.bestScore;
      bestLines = td.bestLines;
    } else if (gid === '2048') {
      const d = load2048Data();
      bestScore = d.bestScore;
      bestTile = d.bestTile;
    } else if (gid === 'flappy') bestScore = loadFlappyData().bestScore;
    else if (gid === 'sudoku') bestTime = loadSudokuData().bestTime;
    else if (gid === 'minesweeper') bestTime = loadMinesweeperData().bestTime;

    return { gameId: gid, plays, wins, winRate, bestScore, bestTime, bestTile, bestLines };
  });

  // Favorite = most played
  let favoriteGameId: string | null = null;
  let maxPlays = 0;
  for (const g of perGame) {
    if (g.plays > maxPlays) { maxPlays = g.plays; favoriteGameId = g.gameId; }
  }

  return {
    playsTotal: achStats.playsTotal,
    winsTotal: achStats.winsTotal,
    winRate: achStats.playsTotal > 0 ? Math.round((achStats.winsTotal / achStats.playsTotal) * 100) : 0,
    achievementsUnlocked: unlocked.size,
    achievementsTotal: ACHIEVEMENTS.length,
    favoriteGameId,
    perGame,
  };
}

export function loadLeaderboardData(): GameLeaderboardData[] {
  const achStats = loadStats();

  return ALL_GAME_IDS.map((gid) => {
    const plays = achStats.playsByGame[gid] ?? 0;
    const wins = achStats.winsByGame[gid] ?? 0;
    const winRate = plays > 0 ? Math.round((wins / plays) * 100) : 0;

    let bestScore: number | null = null;
    let bestTime: number | null = null;
    let bestTile: number | null = null;
    let bestLines: number | null = null;
    let topRuns: HighscoreRun[] = [];

    if (gid === 'snake') {
      const d = loadSnakeData();
      bestScore = d.bestScore;
      topRuns = d.topRuns;
    } else if (gid === 'tetris') {
      const d = loadTetrisData();
      bestScore = d.bestScore;
      bestLines = d.bestLines;
      topRuns = d.topRuns;
    } else if (gid === '2048') {
      const d = load2048Data();
      bestScore = d.bestScore;
      bestTile = d.bestTile;
      topRuns = d.topRuns;
    } else if (gid === 'flappy') {
      const d = loadFlappyData();
      bestScore = d.bestScore;
      topRuns = d.topRuns;
    } else if (gid === 'sudoku') {
      bestTime = loadSudokuData().bestTime;
    } else if (gid === 'minesweeper') {
      bestTime = loadMinesweeperData().bestTime;
    }

    return { gameId: gid, plays, wins, winRate, bestScore, bestTime, bestTile, bestLines, topRuns };
  });
}
