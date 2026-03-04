import type { Difficulty } from './types';

export const STATS_KEY = 'webgames.sudoku.stats';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DiffStats {
  games:    number;
  wins:     number;
  bestTime: number | null; // seconds
}

export interface SudokuStats {
  easy:   DiffStats;
  medium: DiffStats;
  hard:   DiffStats;
  expert: DiffStats;
}

// ── Factories ──────────────────────────────────────────────────────────────────

function emptyDiff(): DiffStats {
  return { games: 0, wins: 0, bestTime: null };
}

export function emptyStats(): SudokuStats {
  return { easy: emptyDiff(), medium: emptyDiff(), hard: emptyDiff(), expert: emptyDiff() };
}

// ── Persistence ────────────────────────────────────────────────────────────────

export function loadStats(): SudokuStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const p    = JSON.parse(raw) as SudokuStats;
    const base = emptyStats();
    return {
      easy:   { ...base.easy,   ...p.easy   },
      medium: { ...base.medium, ...p.medium },
      hard:   { ...base.hard,   ...p.hard   },
      expert: { ...base.expert, ...p.expert },
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: SudokuStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

// ── Updater ────────────────────────────────────────────────────────────────────

export function updateStats(
  stats:      SudokuStats,
  difficulty: Difficulty,
  timeSec:    number,
): SudokuStats {
  const slot: DiffStats = { ...stats[difficulty] };
  slot.games++;
  slot.wins++;
  slot.bestTime = slot.bestTime === null ? timeSec : Math.min(slot.bestTime, timeSec);
  return { ...stats, [difficulty]: slot };
}

// ── Query helper ───────────────────────────────────────────────────────────────

export function totalGames(stats: SudokuStats): number {
  return stats.easy.games + stats.medium.games + stats.hard.games + stats.expert.games;
}
