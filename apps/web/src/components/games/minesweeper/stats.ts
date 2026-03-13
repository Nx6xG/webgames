export const STATS_KEY = 'webgames.minesweeper.stats';

export interface MinesweeperStats {
  games: number;
  wins: number;
  losses: number;
  winsEasy: number;
  winsMedium: number;
  winsHard: number;
  bestTimeEasy: number | null;
  bestTimeMedium: number | null;
  bestTimeHard: number | null;
}

export function emptyStats(): MinesweeperStats {
  return { games: 0, wins: 0, losses: 0, winsEasy: 0, winsMedium: 0, winsHard: 0, bestTimeEasy: null, bestTimeMedium: null, bestTimeHard: null };
}

export function loadStats(): MinesweeperStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: MinesweeperStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function updateStats(
  stats: MinesweeperStats,
  won: boolean,
  difficulty: 'easy' | 'medium' | 'hard',
  timeSec: number,
): MinesweeperStats {
  const next = {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
  };

  if (won) {
    const winsKey = difficulty === 'easy' ? 'winsEasy'
      : difficulty === 'medium' ? 'winsMedium'
      : 'winsHard';
    next[winsKey] = (next[winsKey] ?? 0) + 1;

    const key = difficulty === 'easy' ? 'bestTimeEasy'
      : difficulty === 'medium' ? 'bestTimeMedium'
      : 'bestTimeHard';
    const prev = next[key];
    next[key] = prev === null ? timeSec : Math.min(prev, timeSec);
  }

  return next;
}
