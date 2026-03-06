export const STATS_KEY = 'webgames.pong.stats';

export interface PongStats {
  games: number;
  wins:  number;
  losses: number;
}

export function emptyStats(): PongStats {
  return { games: 0, wins: 0, losses: 0 };
}

export function loadStats(): PongStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: PongStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function updateStats(stats: PongStats, won: boolean): PongStats {
  return {
    games:  stats.games + 1,
    wins:   stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
  };
}
