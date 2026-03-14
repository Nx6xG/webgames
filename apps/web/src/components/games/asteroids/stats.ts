// ─────────────────────────────────────────────────────────────────────────────
// Asteroids — stats persistence (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

export const STATS_KEY = 'webgames.asteroids.stats';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AsteroidsStats {
  games:          number;
  bestScore:      number;
  bestWave:       number;
  totalAsteroids: number;
}

// ── Factories ────────────────────────────────────────────────────────────────

function emptyStats(): AsteroidsStats {
  return { games: 0, bestScore: 0, bestWave: 0, totalAsteroids: 0 };
}

// ── Persistence ──────────────────────────────────────────────────────────────

export function loadStats(): AsteroidsStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as Partial<AsteroidsStats>;
    return {
      games:          p.games          ?? 0,
      bestScore:      p.bestScore      ?? 0,
      bestWave:       p.bestWave       ?? 0,
      totalAsteroids: p.totalAsteroids ?? 0,
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: AsteroidsStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* noop */ }
}

// ── Updater ──────────────────────────────────────────────────────────────────

export function updateStats(
  score:      number,
  wave:       number,
  destroyed:  number,
): AsteroidsStats {
  const stats = loadStats();
  stats.games++;
  if (score > stats.bestScore) stats.bestScore = score;
  if (wave > stats.bestWave) stats.bestWave = wave;
  stats.totalAsteroids += destroyed;
  saveStats(stats);
  return stats;
}

// ── Clear ────────────────────────────────────────────────────────────────────

export function clearStats(): AsteroidsStats {
  const empty = emptyStats();
  saveStats(empty);
  return empty;
}
