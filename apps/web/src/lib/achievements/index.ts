export { trackAchievementEvent, consumeCompletedDaily } from './engine';
export type { AchievementEvent } from './engine';
export { ACHIEVEMENTS, CATEGORY_ORDER } from './definitions';
export type { AchievementId, AchievementDefinition, AchievementStats, AchievementProgress, AchievementCategory } from './definitions';
export { loadUnlockedFrames, unlockFrame } from './store';

import { ACHIEVEMENTS as _ACH } from './definitions';

export function getAchievementById(id: string) {
  return _ACH.find((a) => a.id === id) ?? null;
}
