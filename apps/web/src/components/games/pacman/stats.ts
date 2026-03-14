const KEY = 'webgames.pacman.stats';

export interface PacmanStats {
  games: number;
  wins: number;
  bestScore: number;
  bestLevel: number;
}

const EMPTY: PacmanStats = { games: 0, wins: 0, bestScore: 0, bestLevel: 0 };

export function loadStats(): PacmanStats {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return JSON.parse(raw);
  } catch {
    return { ...EMPTY };
  }
}

export function saveStats(s: PacmanStats) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function updateStats(prev: PacmanStats, score: number, level: number): PacmanStats {
  return {
    games: prev.games + 1,
    wins: prev.wins + (level > prev.bestLevel ? 1 : 0),
    bestScore: Math.max(prev.bestScore, score),
    bestLevel: Math.max(prev.bestLevel, level),
  };
}
