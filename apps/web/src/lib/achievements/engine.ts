import { ACHIEVEMENTS } from './definitions';
import type { AchievementId } from './definitions';
import { loadStats, saveStats, unlock, unlockFrame, unlockCosmetic } from './store';
import { getDailyChallenges, getTodayStr, incrementProgress } from '@/lib/dailyChallenges';
import { recordPlay } from '@/lib/playStreak';
import { recordRecentGame } from '@/lib/recentlyPlayed';
import type { PlayerProgression, LevelUpResult } from '@/lib/progression';
import {
  loadProgression, saveProgression, queueLevelUps,
  resetDailyCapIfNeeded, applyDailyCap, applyXp,
  isGotdBonusAvailable, claimGotdBonus,
  getMatchXpReward, MULTIPLAYER_GAME_IDS, XP_REWARDS,
  incrementWinStreak, checkStreakReset, getStreakBonus,
} from '@/lib/progression';

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

/** Level-ups produced during the last trackAchievementEvent call (in-memory, does NOT touch localStorage queue). */
let _lastLevelUps: LevelUpResult[] = [];
export function consumeLastLevelUps(): LevelUpResult[] {
  const r = _lastLevelUps;
  _lastLevelUps = [];
  return r;
}

/**
 * Process an achievement event: update stats, evaluate all conditions,
 * and return an array of newly unlocked achievement IDs (empty if none).
 * Also tracks daily challenge progress as a side-effect.
 */
export function trackAchievementEvent(
  ev: AchievementEvent,
  onProgressionUpdated?: (prog: PlayerProgression) => void,
): AchievementId[] {
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

  // ── XP / Progression ──────────────────────────────────────────────────────
  const prog = loadProgression();
  resetDailyCapIfNeeded(prog);
  let totalXp = 0;

  const gameId = ev.type === 'invite_link_copied' ? null : ev.gameId;
  const isMultiplayer = gameId != null && MULTIPLAYER_GAME_IDS.has(gameId);

  if (ev.type === 'game_won') {
    // Win streak
    incrementWinStreak(prog);
    // Mark pending result as resolved (win)
    prog._pendingMultiplayerResult = false;
    // Match XP (daily-capped)
    const gotdBonus = gameId != null && isGotdBonusAvailable(prog, gameId);
    let matchXp = getMatchXpReward(ev.gameId, true) + getStreakBonus(prog.winStreak);
    if (gotdBonus) {
      matchXp += XP_REWARDS.GOTD_FIRST_WIN;
      claimGotdBonus(prog);
    }
    totalXp += applyDailyCap(prog, matchXp);
  } else if (ev.type === 'game_played') {
    if (isMultiplayer) {
      // If a previous multiplayer game was pending and wasn't won → grant loss XP
      if (prog._pendingMultiplayerResult && !prog._lastWasWin) {
        totalXp += applyDailyCap(prog, XP_REWARDS.MULTIPLAYER_LOSS);
      }
      // Streak reset check
      checkStreakReset(prog);
      // Mark this multiplayer game as pending outcome
      prog._pendingMultiplayerResult = true;
    } else {
      // Singleplayer: grant completion XP immediately
      totalXp += applyDailyCap(prog, getMatchXpReward(ev.gameId, false));
    }
  }

  // Uncapped XP for completed daily challenges
  totalXp += _lastCompletedDaily.length * XP_REWARDS.DAILY_CHALLENGE_COMPLETION;

  // Uncapped XP for newly unlocked achievements
  totalXp += newlyUnlocked.length * XP_REWARDS.ACHIEVEMENT_UNLOCK;

  _lastLevelUps = [];
  if (totalXp > 0) {
    const { levelUps } = applyXp(prog, totalXp);
    if (levelUps.length > 0) {
      queueLevelUps(levelUps);  // localStorage queue for homepage celebration
      _lastLevelUps = levelUps; // in-memory for toast (does not consume localStorage queue)
    }
  }

  saveProgression(prog);
  onProgressionUpdated?.(prog);

  return newlyUnlocked;
}
