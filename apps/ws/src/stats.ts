import type { GameId, GameStats } from 'shared';

// ── In-memory store (swap Map → DB calls to persist) ─────────────────────────

type StatsResult = { winner: 0 | 1 } | { draw: true };

const store = new Map<GameId, GameStats>();

function ensure(gameId: GameId): GameStats {
  if (!store.has(gameId)) {
    store.set(gameId, { gamesPlayed: 0, winsByPlayerIndex: { 0: 0, 1: 0 }, draws: 0 });
  }
  return store.get(gameId)!;
}

export function getStats(gameId: GameId): GameStats {
  return { ...ensure(gameId), winsByPlayerIndex: { ...ensure(gameId).winsByPlayerIndex } };
}

/** All known game IDs — keep in sync with shared GameId union */
const ALL_GAME_IDS: GameId[] = ['tictactoe', 'connect4'];

export function getAllStats(): Record<GameId, GameStats> {
  const out = {} as Record<GameId, GameStats>;
  for (const id of ALL_GAME_IDS) out[id] = getStats(id);
  return out;
}

export function recordResult(gameId: GameId, result: StatsResult): GameStats {
  const s = ensure(gameId);
  s.gamesPlayed++;
  if ('draw' in result) {
    s.draws++;
  } else {
    s.winsByPlayerIndex[result.winner]++;
  }
  return getStats(gameId);
}
