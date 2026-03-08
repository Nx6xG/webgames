/** XP reward constants */
export const XP_REWARDS = {
  MULTIPLAYER_WIN: 40,
  MULTIPLAYER_LOSS: 15,
  SINGLEPLAYER_COMPLETION: 15,
  DAILY_CHALLENGE_COMPLETION: 40,
  ACHIEVEMENT_UNLOCK: 100,
  GOTD_FIRST_WIN: 75,
} as const;

/** Set of multiplayer game IDs (from game registry). */
export const MULTIPLAYER_GAME_IDS = new Set([
  'tictactoe',
  'connect4',
  'rps',
  'chess',
  'battleship',
  'liarsbar',
]);

/** Get base match XP reward for a game event. */
export function getMatchXpReward(gameId: string, won: boolean): number {
  if (MULTIPLAYER_GAME_IDS.has(gameId)) {
    return won ? XP_REWARDS.MULTIPLAYER_WIN : XP_REWARDS.MULTIPLAYER_LOSS;
  }
  // Singleplayer games only grant XP on completion (game_played)
  return XP_REWARDS.SINGLEPLAYER_COMPLETION;
}
