import type { PlayerProgression } from './types';

/** Update win streak on a win. */
export function incrementWinStreak(prog: PlayerProgression): void {
  prog.winStreak++;
  prog._lastWasWin = true;
}

/**
 * Check and reset streak for multiplayer game_played.
 * Called before processing a new multiplayer game.
 * If the previous game was not a win, reset streak.
 */
export function checkStreakReset(prog: PlayerProgression): void {
  if (!prog._lastWasWin) {
    prog.winStreak = 0;
  }
  prog._lastWasWin = false;
}

/** Get bonus XP for current win streak. */
export function getStreakBonus(streak: number): number {
  if (streak >= 5) return 20;
  if (streak >= 3) return 10;
  if (streak >= 2) return 5;
  return 0;
}
