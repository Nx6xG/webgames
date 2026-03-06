export const STATS_KEY = 'webgames.breakout.stats';

export interface BreakoutStats {
  games: number;
  wins:  number;
  losses: number;
  bestScore: number;
  bestLevel: number;
  totalBricks: number;
}

export function emptyStats(): BreakoutStats {
  return { games: 0, wins: 0, losses: 0, bestScore: 0, bestLevel: 0, totalBricks: 0 };
}

export function loadStats(): BreakoutStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: BreakoutStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function updateStats(
  stats: BreakoutStats,
  won: boolean,
  finalScore: number,
  levelReached: number,
  bricksDestroyed: number,
): BreakoutStats {
  return {
    games:       stats.games + 1,
    wins:        stats.wins + (won ? 1 : 0),
    losses:      stats.losses + (won ? 0 : 1),
    bestScore:   Math.max(stats.bestScore, finalScore),
    bestLevel:   Math.max(stats.bestLevel, levelReached),
    totalBricks: stats.totalBricks + bricksDestroyed,
  };
}
