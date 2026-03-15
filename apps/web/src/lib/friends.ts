'use client';

import { isBrowser } from '@/lib/utils';

const STORAGE_KEY = 'webgames_friends_v1';

export interface FriendEntry {
  /** Player token of the friend. */
  token: string;
  /** Nickname at time of adding (display fallback when offline). */
  nickname: string;
  /** Timestamp when added. */
  addedAt: number;
}

export function loadFriends(): FriendEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FriendEntry[];
  } catch {
    return [];
  }
}

function saveFriends(list: FriendEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota exceeded */ }
}

export function addFriend(token: string, nickname: string): void {
  const list = loadFriends();
  if (list.some((f) => f.token === token)) return;
  list.push({ token, nickname, addedAt: Date.now() });
  saveFriends(list);
}

export function removeFriend(token: string): void {
  const list = loadFriends().filter((f) => f.token !== token);
  saveFriends(list);
}

export function isFriend(token: string): boolean {
  return loadFriends().some((f) => f.token === token);
}

/** Update a friend's nickname if it changed. */
export function updateFriendNickname(token: string, nickname: string): void {
  const list = loadFriends();
  const entry = list.find((f) => f.token === token);
  if (entry && entry.nickname !== nickname) {
    entry.nickname = nickname;
    saveFriends(list);
  }
}
