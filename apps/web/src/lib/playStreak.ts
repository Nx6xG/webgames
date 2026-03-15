'use client';

import { getTodayStr } from '@/lib/dailyChallenges/definitions';
import { isBrowser } from '@/lib/utils';

const STORAGE_KEY = 'webgames_play_streak_v1';

export interface StreakData {
  /** Last date all dailies were completed (YYYY-MM-DD). */
  lastPlayDate: string;
  /** Current consecutive day streak. */
  currentStreak: number;
  /** All-time best streak. */
  bestStreak: number;
}

function defaultData(): StreakData {
  return { lastPlayDate: '', currentStreak: 0, bestStreak: 0 };
}

export function loadStreak(): StreakData {
  if (!isBrowser()) return defaultData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return { ...defaultData(), ...JSON.parse(raw) };
  } catch {
    return defaultData();
  }
}

function saveStreak(data: StreakData): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded */ }
}

/** Returns the date string for yesterday. */
function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Call when a game is played. Records the play date but does NOT update streak.
 * Streak only increases when all dailies are completed (see recordDailyStreak).
 * Returns the current streak data.
 */
export function recordPlay(): StreakData {
  return loadStreak();
}

/**
 * Call when all daily challenges are completed. Updates the streak counter.
 * Returns the updated streak data.
 */
export function recordDailyStreak(): StreakData {
  const today = getTodayStr();
  const data = loadStreak();

  // Already completed all dailies today — no change
  if (data.lastPlayDate === today) return data;

  if (data.lastPlayDate === yesterdayStr()) {
    // Consecutive day
    data.currentStreak += 1;
  } else {
    // Streak broken or first completion
    data.currentStreak = 1;
  }

  data.lastPlayDate = today;
  data.bestStreak = Math.max(data.bestStreak, data.currentStreak);
  saveStreak(data);
  return data;
}

/**
 * Returns the current streak, accounting for potential streak break.
 * If last completion was before yesterday, streak is 0.
 */
export function getActiveStreak(): StreakData {
  const data = loadStreak();
  const today = getTodayStr();
  if (data.lastPlayDate !== today && data.lastPlayDate !== yesterdayStr()) {
    // Streak has been broken
    return { ...data, currentStreak: 0 };
  }
  return data;
}
