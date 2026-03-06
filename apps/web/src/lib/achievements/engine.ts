import { ACHIEVEMENTS } from './definitions';
import type { AchievementId } from './definitions';
import { loadStats, saveStats, unlock, unlockFrame, unlockCosmetic } from './store';
import { getDailyChallenges, getTodayStr, incrementProgress } from '@/lib/dailyChallenges';
import { recordPlay } from '@/lib/playStreak';
import { recordRecentGame } from '@/lib/recentlyPlayed';

export type AchievementEvent =
  | { type: 'game_played'; gameId: string }
  | { type: 'game_won'; gameId: string }
  | { type: 'invite_link_copied' };

/** templateIds of daily challenges completed during this call (consumed by useAchievements). */
let _lastCompletedDaily: string[] = [];
export function consumeCompletedDaily(): string[] {
  const r = _lastCompletedDaily;
  _lastCompletedDaily = [];
  return r;
}

/**
 * Process an achievement event: update stats, evaluate all conditions,
 * and return an array of newly unlocked achievement IDs (empty if none).
 * Also tracks daily challenge progress as a side-effect.
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

  // ── Play streak + recently played ──────────────────────────────────────────
  if (ev.type === 'game_played') {
    recordPlay();
    recordRecentGame(ev.gameId);
  }

  // ── Daily challenge tracking ────────────────────────────────────────────────
  _lastCompletedDaily = [];
  if (ev.type === 'game_played' || ev.type === 'game_won') {
    const today = getTodayStr();
    const challenges = getDailyChallenges(today);
    for (const ch of challenges) {
      const matches =
        (ch.type === 'play_game' && ev.type === 'game_played' && ch.gameId === ev.gameId) ||
        (ch.type === 'win_game' && ev.type === 'game_won' && ch.gameId === ev.gameId) ||
        (ch.type === 'play_any' && ev.type === 'game_played');
      if (matches) {
        const justCompleted = incrementProgress(today, ch.templateId, ch.target);
        if (justCompleted) _lastCompletedDaily.push(ch.templateId);
      }
    }
  }

  // ── Achievement evaluation ──────────────────────────────────────────────────
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
