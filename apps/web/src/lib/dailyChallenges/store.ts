'use client';

import type { DailyChallengeProgress } from './types';
import { isBrowser } from '@/lib/utils';

const STORAGE_KEY = 'webgames_daily_challenges_v1';

function defaultProgress(date: string): DailyChallengeProgress {
  return { date, progress: {}, completed: [] };
}

export function loadProgress(date: string): DailyChallengeProgress {
  if (!isBrowser()) return defaultProgress(date);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress(date);
    const parsed: DailyChallengeProgress = JSON.parse(raw);
    // If stored data is for a different day, start fresh
    if (parsed.date !== date) return defaultProgress(date);
    return { ...defaultProgress(date), ...parsed };
  } catch {
    return defaultProgress(date);
  }
}

export function saveProgress(p: DailyChallengeProgress): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Increment progress for a challenge template. Returns true if the challenge
 * was just completed (crossed the target threshold).
 */
export function incrementProgress(
  date: string,
  templateId: string,
  target: number,
): boolean {
  const p = loadProgress(date);
  if (p.completed.includes(templateId)) return false;
  const prev = p.progress[templateId] ?? 0;
  const next = prev + 1;
  p.progress[templateId] = next;
  if (next >= target) {
    p.completed.push(templateId);
  }
  saveProgress(p);
  return next >= target;
}
