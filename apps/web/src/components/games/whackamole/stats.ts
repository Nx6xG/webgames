export const STATS_KEY = 'webgames.whackamole.stats';

export interface WhackAMoleStats {
  games: number;
  bestScore: number;
  totalWhacked: number;
  bestAccuracy: number;
}

export function emptyStats(): WhackAMoleStats {
  return { games: 0, bestScore: 0, totalWhacked: 0, bestAccuracy: 0 };
}

export function loadStats(): WhackAMoleStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: WhackAMoleStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function updateStats(
  stats: WhackAMoleStats,
  finalScore: number,
  whacked: number,
  accuracy: number,
): WhackAMoleStats {
  return {
    games:        stats.games + 1,
    bestScore:    Math.max(stats.bestScore, finalScore),
    totalWhacked: stats.totalWhacked + whacked,
    bestAccuracy: Math.max(stats.bestAccuracy, accuracy),
  };
}
