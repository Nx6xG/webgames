const KEY = 'webgames.penalties.stats';

export interface PenaltyStats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsSaved: number;
}

export function loadStats(): PenaltyStats {
  if (typeof window === 'undefined') return { games: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsSaved: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { games: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsSaved: 0 };
    return JSON.parse(raw);
  } catch {
    return { games: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsSaved: 0 };
  }
}

export function saveStats(s: PenaltyStats) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function updateStats(s: PenaltyStats, result: 'win' | 'loss' | 'draw', scored: number, saved: number): PenaltyStats {
  return {
    games: s.games + 1,
    wins: s.wins + (result === 'win' ? 1 : 0),
    losses: s.losses + (result === 'loss' ? 1 : 0),
    draws: s.draws + (result === 'draw' ? 1 : 0),
    goalsScored: s.goalsScored + scored,
    goalsSaved: s.goalsSaved + saved,
  };
}
