// ─────────────────────────────────────────────────────────────────────────────
// Tetris — stats persistence (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

export const TETRIS_STATS_KEY = 'webgames.tetris.stats';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TetrisRun {
  score: number;
  lines: number;
  level: number;
  date:  number; // Date.now()
}

export interface TetrisStats {
  bestScore:    number;
  bestLines:    number;
  gamesPlayed:  number;
  top10:        TetrisRun[];
}

// ── Factories ────────────────────────────────────────────────────────────────

function emptyStats(): TetrisStats {
  return { bestScore: 0, bestLines: 0, gamesPlayed: 0, top10: [] };
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function getStats(): TetrisStats {
  try {
    const raw = localStorage.getItem(TETRIS_STATS_KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as Partial<TetrisStats>;
    return {
      bestScore:   p.bestScore   ?? 0,
      bestLines:   p.bestLines   ?? 0,
      gamesPlayed: p.gamesPlayed ?? 0,
      top10:       Array.isArray(p.top10) ? p.top10.slice(0, 10) : [],
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: TetrisStats): void {
  try { localStorage.setItem(TETRIS_STATS_KEY, JSON.stringify(stats)); } catch { /* noop */ }
}

// ── Record a run ─────────────────────────────────────────────────────────────

export function recordRun(run: TetrisRun): TetrisStats {
  const stats = getStats();
  stats.gamesPlayed++;
  if (run.score > stats.bestScore) stats.bestScore = run.score;
  if (run.lines > stats.bestLines) stats.bestLines = run.lines;
  stats.top10 = [...stats.top10, run]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  saveStats(stats);
  return stats;
}

// ── Clear ────────────────────────────────────────────────────────────────────

export function clearStats(): TetrisStats {
  const empty = emptyStats();
  saveStats(empty);
  return empty;
}
