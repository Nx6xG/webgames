export const STATS_KEY = 'webgames.typingtest.stats';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TypingTestStats {
  games:        number;
  bestWpm:      number | null;
  bestAccuracy: number | null; // percentage 0-100
  avgWpm:       number | null;
}

// ── Factories ──────────────────────────────────────────────────────────────────

export function emptyStats(): TypingTestStats {
  return { games: 0, bestWpm: null, bestAccuracy: null, avgWpm: null };
}

// ── Persistence ────────────────────────────────────────────────────────────────

export function loadStats(): TypingTestStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as TypingTestStats;
    return { ...emptyStats(), ...p };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: TypingTestStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

// ── Updater ────────────────────────────────────────────────────────────────────

export function recordRun(
  stats: TypingTestStats,
  wpm: number,
  accuracy: number,
): TypingTestStats {
  const next = { ...stats };
  next.games++;
  next.bestWpm = next.bestWpm === null ? wpm : Math.max(next.bestWpm, wpm);
  next.bestAccuracy = next.bestAccuracy === null ? accuracy : Math.max(next.bestAccuracy, accuracy);
  // Incremental average
  if (next.avgWpm === null) {
    next.avgWpm = wpm;
  } else {
    next.avgWpm = Math.round(((next.avgWpm * (next.games - 1)) + wpm) / next.games);
  }
  return next;
}
