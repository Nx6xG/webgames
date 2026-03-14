export const STATS_KEY = 'webgames.fruitninja.stats';

export interface FruitNinjaStats {
  games: number;
  bestScore: number;
  bestCombo: number;
  totalSliced: number;
}

export function emptyStats(): FruitNinjaStats {
  return { games: 0, bestScore: 0, bestCombo: 0, totalSliced: 0 };
}

export function loadStats(): FruitNinjaStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: FruitNinjaStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function updateStats(
  stats: FruitNinjaStats,
  finalScore: number,
  maxCombo: number,
  sliced: number,
): FruitNinjaStats {
  return {
    games:      stats.games + 1,
    bestScore:  Math.max(stats.bestScore, finalScore),
    bestCombo:  Math.max(stats.bestCombo, maxCombo),
    totalSliced: stats.totalSliced + sliced,
  };
}
