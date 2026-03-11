import { ACHIEVEMENTS, TIER_XP, TIER_TOKENS } from './definitions';
import type { AchievementId } from './definitions';
import { loadStats, saveStats, unlock, loadUnlocked } from './store';
import { getDailyChallenges, getTodayStr, incrementProgress, loadProgress as loadDailyProgress } from '@/lib/dailyChallenges';
import { recordPlay } from '@/lib/playStreak';
import { recordRecentGame } from '@/lib/recentlyPlayed';
import type { PlayerProgression, LevelUpResult } from '@/lib/progression';
import {
  loadProgression, saveProgression, queueLevelUps,
  resetDailyCapIfNeeded, applyDailyCap, applyXp,
  isGotdBonusAvailable, claimGotdBonus, getGotdId,
  getMatchXpReward, MULTIPLAYER_GAME_IDS, XP_REWARDS,
  incrementWinStreak, checkStreakReset, getStreakBonus,
} from '@/lib/progression';

export type AchievementEvent =
  | { type: 'game_played'; gameId: string }
  | { type: 'game_won'; gameId: string; meta?: Record<string, unknown> }
  | { type: 'game_lost'; gameId: string }
  | { type: 'invite_link_copied' }
  | { type: 'lobby_hosted' }
  | { type: 'profile_customized' }
  | { type: 'public_game_joined' }
  | { type: 'message_sent' }
  | { type: 'gotd_played' }
  | { type: 'flag'; key: string };

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
      // Win streak (general)
      stats.currentWinStreak++;
      if (stats.currentWinStreak > stats.maxWinStreak) stats.maxWinStreak = stats.currentWinStreak;
      // TTT win streak
      if (ev.gameId === 'tictactoe') {
        stats.tttCurrentWinStreak++;
        if (stats.tttCurrentWinStreak > stats.tttMaxWinStreak) stats.tttMaxWinStreak = stats.tttCurrentWinStreak;
      }
      // Game-specific flags from meta
      if (ev.meta) {
        if (ev.meta.battleshipFlawless) stats.flags['battleship_flawless'] = true;
        if (ev.meta.liarsbarHonest) stats.flags['liarsbar_honest'] = true;
        if (ev.meta.unoWildDraw4Finish) stats.flags['uno_wild_draw4_finish'] = true;
      }
      break;
    case 'game_lost':
      stats.lossesTotal++;
      // Reset win streaks
      stats.currentWinStreak = 0;
      if (ev.gameId === 'tictactoe') stats.tttCurrentWinStreak = 0;
      break;
    case 'invite_link_copied':
      stats.invitesTotal++;
      break;
    case 'lobby_hosted':
      stats.lobbiesHosted++;
      break;
    case 'profile_customized':
      stats.profileCustomized = true;
      break;
    case 'public_game_joined':
      stats.publicGamesJoined++;
      break;
    case 'message_sent':
      stats.messagesSent++;
      break;
    case 'gotd_played':
      stats.flags['gotd_played'] = true;
      break;
    case 'flag':
      stats.flags[ev.key] = true;
      break;
  }

  // Sync level from progression
  try {
    const prog = loadProgression();
    stats.level = prog.level;
  } catch { /* ignore */ }

  // Sync totalUnlocked
  stats.totalUnlocked = loadUnlocked().size;

  saveStats(stats);

  // ── Play streak + recently played ──────────────────────────────────────────
  if (ev.type === 'game_played') {
    const streakData = recordPlay();
    recordRecentGame(ev.gameId);
    // Set gotd_played flag if this is today's Game of the Day
    if (ev.gameId === getGotdId()) {
      stats.flags['gotd_played'] = true;
    }
    // Set daily_week_streak flag if play streak reaches 7
    if (streakData.currentStreak >= 7) {
      stats.flags['daily_week_streak'] = true;
    }
    saveStats(stats);
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
    // Check if ALL dailies for today are now complete → set flag
    if (challenges.length > 0) {
      const dp = loadDailyProgress(today);
      const allComplete = challenges.every((ch) => dp.completed.includes(ch.templateId));
      if (allComplete && !stats.flags['all_dailies_completed']) {
        stats.flags['all_dailies_completed'] = true;
        saveStats(stats);
      }
    }
  }

  // ── Achievement evaluation ──────────────────────────────────────────────────
  const newlyUnlocked: AchievementId[] = [];
  for (const def of ACHIEVEMENTS) {
    if (def.condition(stats)) {
      if (unlock(def.id)) {
        newlyUnlocked.push(def.id);
      }
    }
  }

  // Update totalUnlocked after potential new unlocks (for "all_unlocked" meta-achievement)
  if (newlyUnlocked.length > 0) {
    stats.totalUnlocked = loadUnlocked().size;
    saveStats(stats);
    // Re-evaluate "all_unlocked" after new unlocks
    for (const def of ACHIEVEMENTS) {
      if (def.id === 'general.all_unlocked' && def.condition(stats)) {
        if (unlock(def.id)) {
          newlyUnlocked.push(def.id);
        }
      }
    }
  }

  // ── XP / Progression ──────────────────────────────────────────────────────
  const prog = loadProgression();
  resetDailyCapIfNeeded(prog);
  let totalXp = 0;

  const gameId = (ev.type === 'game_played' || ev.type === 'game_won' || ev.type === 'game_lost') ? ev.gameId : null;
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

  // Tier-based XP + tokens for newly unlocked achievements
  let achTokens = 0;
  for (const id of newlyUnlocked) {
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) continue;
    totalXp += TIER_XP[def.tier];
    achTokens += TIER_TOKENS[def.tier];
  }
  if (achTokens > 0) {
    prog.tokens += achTokens;
  }

  _lastLevelUps = [];
  if (totalXp > 0) {
    const { levelUps } = applyXp(prog, totalXp);
    if (levelUps.length > 0) {
      queueLevelUps(levelUps);  // localStorage queue for homepage celebration
      _lastLevelUps = levelUps; // in-memory for toast (does not consume localStorage queue)
    }
  }

  // Sync level back to stats after XP application
  stats.level = prog.level;
  saveStats(stats);

  saveProgression(prog);
  onProgressionUpdated?.(prog);

  return newlyUnlocked;
}
