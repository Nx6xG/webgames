// ─────────────────────────────────────────────────────────────────────────────
// Geometry Dash — stats persistence (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

export const GD_STATS_KEY = 'webgames.geometrydash.stats';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GdStats {
  games:       number;
  bestPercent: number;
  bestLevel:   number;
  attempts:    number;
}

// ── Factories ────────────────────────────────────────────────────────────────

function emptyStats(): GdStats {
  return { games: 0, bestPercent: 0, bestLevel: 0, attempts: 0 };
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function getStats(): GdStats {
  try {
    const raw = localStorage.getItem(GD_STATS_KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as Partial<GdStats>;
    return {
      games:       p.games       ?? 0,
      bestPercent: p.bestPercent ?? 0,
      bestLevel:   p.bestLevel   ?? 0,
      attempts:    p.attempts    ?? 0,
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: GdStats): void {
  try { localStorage.setItem(GD_STATS_KEY, JSON.stringify(stats)); } catch { /* noop */ }
}

// ── Record a run ─────────────────────────────────────────────────────────────

export function recordRun(percent: number, level: number): GdStats {
  const stats = getStats();
  stats.games++;
  stats.attempts++;
  if (percent > stats.bestPercent) stats.bestPercent = percent;
  if (level > stats.bestLevel) stats.bestLevel = level;
  saveStats(stats);
  return stats;
}

// ── Clear ────────────────────────────────────────────────────────────────────

export function clearStats(): GdStats {
  const empty = emptyStats();
  saveStats(empty);
  return empty;
}
