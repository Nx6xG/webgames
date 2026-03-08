import type { PlayerProgression } from './types';
import { getTodayStr } from '@/lib/dailyChallenges/definitions';
import { createSeededRng } from '@/lib/seededRandom';

/** Mirror of GameOfTheDay SPOTLIGHT_POOL ids — must stay in sync. */
const GOTD_POOL_IDS = ['2048', 'snake', 'sudoku', 'tetris', 'flappy', 'pong', 'breakout', 'minesweeper'];

/** XP required to complete the given level (i.e. to go from `level` to `level+1`). */
export function getXpRequiredForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.45));
}

/** Daily XP cap for match XP (challenges/achievements are exempt). */
export const DAILY_XP_CAP = 500;

/** Reset daily cap counter if a new day has started. Mutates `prog` in place. */
export function resetDailyCapIfNeeded(prog: PlayerProgression): void {
  const today = getTodayStr();
  if (prog.dailyXpDate !== today) {
    prog.dailyXpEarned = 0;
    prog.dailyXpDate = today;
  }
}

/** Clamp match XP against the daily cap. Returns the clamped amount. Mutates `prog.dailyXpEarned`. */
export function applyDailyCap(prog: PlayerProgression, matchXp: number): number {
  const remaining = Math.max(0, DAILY_XP_CAP - prog.dailyXpEarned);
  const capped = Math.min(matchXp, remaining);
  prog.dailyXpEarned += capped;
  return capped;
}

/** Get today's Game of the Day id (mirrors GameOfTheDay.tsx logic). */
export function getGotdId(): string {
  const rng = createSeededRng(`gotd_${getTodayStr()}`);
  const idx = Math.floor(rng() * GOTD_POOL_IDS.length);
  return GOTD_POOL_IDS[idx];
}

/** Check if the GOTD bonus is available for this game today. */
export function isGotdBonusAvailable(prog: PlayerProgression, gameId: string): boolean {
  return prog.gotdBonusDate !== getTodayStr() && gameId === getGotdId();
}

/** Mark GOTD bonus as claimed for today. */
export function claimGotdBonus(prog: PlayerProgression): void {
  prog.gotdBonusDate = getTodayStr();
}
