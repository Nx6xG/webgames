import type { PlayerProgression, LevelProgress } from './types';
import { getXpRequiredForLevel } from './xp';

const RANK_THRESHOLDS: [number, string][] = [
  [35, 'Legend'],
  [20, 'Master'],
  [10, 'Challenger'],
  [5, 'Player'],
  [1, 'Rookie'],
];

/** Get the rank label for a given level. */
export function getPlayerRank(level: number): string {
  for (const [threshold, label] of RANK_THRESHOLDS) {
    if (level >= threshold) return label;
  }
  return 'Rookie';
}

/** Get full level progress info for display. */
export function getLevelProgress(prog: PlayerProgression): LevelProgress {
  const required = getXpRequiredForLevel(prog.level);
  return {
    level: prog.level,
    currentXp: prog.xp,
    requiredXp: required,
    progress: required > 0 ? prog.xp / required : 0,
    rank: getPlayerRank(prog.level),
    totalTokens: prog.tokens,
  };
}
