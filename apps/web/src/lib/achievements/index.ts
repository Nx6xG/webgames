export { trackAchievementEvent, consumeCompletedDaily, consumeLastLevelUps } from './engine';
export type { AchievementEvent } from './engine';
export { ACHIEVEMENTS, CATEGORY_ORDER, TIER_XP, TIER_TOKENS } from './definitions';
export type { AchievementId, AchievementDefinition, AchievementStats, AchievementProgress, AchievementCategory, AchievementTier } from './definitions';
export { loadUnlockedFrames, unlockFrame } from './store';

import { ACHIEVEMENTS as _ACH } from './definitions';

export function getAchievementById(id: string) {
  return _ACH.find((a) => a.id === id) ?? null;
}
