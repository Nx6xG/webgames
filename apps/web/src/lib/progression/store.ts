import type { PlayerProgression, LevelUpResult } from './types';

const STORAGE_KEY = 'webgames_progression_v1';
const LEVELUP_QUEUE_KEY = 'webgames_progression_levelups_v1';

function defaultProgression(): PlayerProgression {
  return {
    xp: 0,
    level: 1,
    tokens: 0,
    dailyXpEarned: 0,
    dailyXpDate: '',
    gotdBonusDate: '',
    winStreak: 0,
    _lastWasWin: false,
    _pendingMultiplayerResult: false,
  };
}

export function loadProgression(): PlayerProgression {
  if (typeof window === 'undefined') return defaultProgression();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgression();
    return { ...defaultProgression(), ...JSON.parse(raw) };
  } catch {
    return defaultProgression();
  }
}

export function saveProgression(prog: PlayerProgression): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
  } catch {
    // Storage full — silently ignore
  }
}

/** Queue level-up events for UI consumption (toast/animation). */
export function queueLevelUps(levelUps: LevelUpResult[]): void {
  if (typeof window === 'undefined' || levelUps.length === 0) return;
  try {
    const existing = JSON.parse(localStorage.getItem(LEVELUP_QUEUE_KEY) ?? '[]') as LevelUpResult[];
    localStorage.setItem(LEVELUP_QUEUE_KEY, JSON.stringify([...existing, ...levelUps]));
  } catch {
    // ignore
  }
}

/** Consume and clear queued level-up events. */
export function consumeLevelUps(): LevelUpResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEVELUP_QUEUE_KEY);
    if (!raw) return [];
    localStorage.removeItem(LEVELUP_QUEUE_KEY);
    return JSON.parse(raw) as LevelUpResult[];
  } catch {
    return [];
  }
}
