import { ACHIEVEMENTS } from './definitions';
import type { AchievementId } from './definitions';
import { loadStats, saveStats, unlock, unlockFrame, unlockCosmetic } from './store';

export type AchievementEvent =
  | { type: 'game_played'; gameId: string }
  | { type: 'game_won'; gameId: string }
  | { type: 'invite_link_copied' };

/**
 * Process an achievement event: update stats, evaluate all conditions,
 * and return an array of newly unlocked achievement IDs (empty if none).
 */
export function trackAchievementEvent(ev: AchievementEvent): AchievementId[] {
  const stats = loadStats();

  switch (ev.type) {
    case 'game_played':
      stats.playsTotal++;
      stats.playsByGame[ev.gameId] = (stats.playsByGame[ev.gameId] ?? 0) + 1;
      break;
    case 'game_won':
      stats.winsTotal++;
      stats.winsByGame[ev.gameId] = (stats.winsByGame[ev.gameId] ?? 0) + 1;
      break;
    case 'invite_link_copied':
      stats.invitesTotal++;
      break;
  }

  saveStats(stats);

  const newlyUnlocked: AchievementId[] = [];
  for (const def of ACHIEVEMENTS) {
    if (def.condition(stats)) {
      if (unlock(def.id)) {
        newlyUnlocked.push(def.id);
        if (def.frameReward) unlockFrame(def.frameReward);
        const rewards = Array.isArray(def.cosmeticReward) ? def.cosmeticReward : def.cosmeticReward ? [def.cosmeticReward] : [];
        for (const reward of rewards) unlockCosmetic(reward.slot, reward.id);
      }
    }
  }
  return newlyUnlocked;
}
