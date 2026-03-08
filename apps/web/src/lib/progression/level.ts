import type { PlayerProgression, LevelUpResult } from './types';
import { getXpRequiredForLevel } from './xp';

/**
 * Add XP to a progression, processing level-ups.
 * Returns updated progression and any level-ups that occurred.
 */
export function applyXp(
  prog: PlayerProgression,
  amount: number,
): { progression: PlayerProgression; levelUps: LevelUpResult[] } {
  const levelUps: LevelUpResult[] = [];
  prog.xp += amount;

  let required = getXpRequiredForLevel(prog.level);
  while (prog.xp >= required) {
    const fromLevel = prog.level;
    prog.xp -= required;
    prog.level++;
    prog.tokens++;
    levelUps.push({ fromLevel, toLevel: prog.level, tokensGranted: 1 });
    required = getXpRequiredForLevel(prog.level);
  }

  return { progression: prog, levelUps };
}
