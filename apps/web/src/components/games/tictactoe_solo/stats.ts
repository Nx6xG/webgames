import type { GameConfig, Mark } from './types';

export const STATS_KEY = 'webgames.tictactoe_solo.stats';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocalStats {
  xWins:  number;
  oWins:  number;
  draws:  number;
  games:  number;
}

export interface AiDiffStats {
  wins:   number;
  losses: number;
  draws:  number;
  games:  number;
}

export interface TttStats {
  local: LocalStats;
  ai: {
    easy:   AiDiffStats;
    normal: AiDiffStats;
    hard:   AiDiffStats;
  };
}

/** Status snapshot for a finished game (excludes the 'playing' branch). */
export type EndedStatus =
  | { kind: 'won'; winner: Mark }
  | { kind: 'draw' };

// ── Factories ──────────────────────────────────────────────────────────────────

function emptyLocalStats(): LocalStats {
  return { xWins: 0, oWins: 0, draws: 0, games: 0 };
}

function emptyAiDiffStats(): AiDiffStats {
  return { wins: 0, losses: 0, draws: 0, games: 0 };
}

export function emptyStats(): TttStats {
  return {
    local: emptyLocalStats(),
    ai: {
      easy:   emptyAiDiffStats(),
      normal: emptyAiDiffStats(),
      hard:   emptyAiDiffStats(),
    },
  };
}

// ── Persistence ────────────────────────────────────────────────────────────────

export function loadStats(): TttStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const p    = JSON.parse(raw) as TttStats; // data we wrote — safe cast
    const base = emptyStats();
    // Defensive merge: fill any missing keys from a schema update
    return {
      local: { ...base.local, ...p.local },
      ai: {
        easy:   { ...base.ai.easy,   ...p.ai.easy   },
        normal: { ...base.ai.normal, ...p.ai.normal },
        hard:   { ...base.ai.hard,   ...p.ai.hard   },
      },
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: TttStats): void {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

// ── Updater ────────────────────────────────────────────────────────────────────

export function updateStats(
  stats: TttStats,
  config: GameConfig,
  ended: EndedStatus,
): TttStats {
  if (config.mode === 'pvp') {
    const local = { ...stats.local };
    if (ended.kind === 'draw') {
      local.draws++;
    } else if (ended.winner === 'X') {
      local.xWins++;
    } else {
      local.oWins++;
    }
    local.games++;
    return { ...stats, local };
  }

  // AI mode — result from human perspective
  const diff = config.difficulty;
  const slot  = { ...stats.ai[diff] };
  if (ended.kind === 'draw') {
    slot.draws++;
  } else if (ended.winner === config.humanMark) {
    slot.wins++;
  } else {
    slot.losses++;
  }
  slot.games++;
  return { ...stats, ai: { ...stats.ai, [diff]: slot } };
}

// ── Query helper ───────────────────────────────────────────────────────────────

export function totalGames(stats: TttStats): number {
  return (
    stats.local.games +
    stats.ai.easy.games +
    stats.ai.normal.games +
    stats.ai.hard.games
  );
}
