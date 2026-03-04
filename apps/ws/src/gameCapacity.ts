import type { GameId } from 'shared';

/** Per-game player capacity. All games default to 2/2 unless overridden here. */
const CAPACITY: Partial<Record<GameId, { min: number; max: number }>> = {
  liarsbar: { min: 2, max: 6 },
};

export function getGameCapacity(gameId: GameId): { min: number; max: number } {
  return CAPACITY[gameId] ?? { min: 2, max: 2 };
}
