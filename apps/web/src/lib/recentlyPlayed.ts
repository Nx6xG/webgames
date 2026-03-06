'use client';

const STORAGE_KEY = 'webgames_recently_played_v1';
const MAX_ENTRIES = 5;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export interface RecentEntry {
  gameId: string;
  /** Timestamp of last play. */
  ts: number;
}

export function loadRecent(): RecentEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentEntry[];
  } catch {
    return [];
  }
}

export function recordRecentGame(gameId: string): void {
  if (!isBrowser()) return;
  try {
    const list = loadRecent().filter((e) => e.gameId !== gameId);
    list.unshift({ gameId, ts: Date.now() });
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota exceeded */ }
}
