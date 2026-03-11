// ── Avatar Registry ──────────────────────────────────────────────────────────

import { ACHIEVEMENTS } from '@/lib/achievements';

export interface AvatarDef {
  id: string;
  emoji: string;
  category: 'default' | 'achievement';
  nameKey: string;
}

export const DEFAULT_AVATAR_ID = 'default.smile';

// ── Default avatars (always available) ──────────────────────────────────────
const DEFAULT_AVATARS: AvatarDef[] = [
  { id: 'default.smile',   emoji: '😊', category: 'default', nameKey: 'avatar.name.smile' },
  { id: 'default.cool',    emoji: '😎', category: 'default', nameKey: 'avatar.name.cool' },
  { id: 'default.fire',    emoji: '🔥', category: 'default', nameKey: 'avatar.name.fire' },
  { id: 'default.star',    emoji: '⭐', category: 'default', nameKey: 'avatar.name.star' },
  { id: 'default.ghost',   emoji: '👻', category: 'default', nameKey: 'avatar.name.ghost' },
  { id: 'default.robot',   emoji: '🤖', category: 'default', nameKey: 'avatar.name.robot' },
  { id: 'default.alien',   emoji: '👽', category: 'default', nameKey: 'avatar.name.alien' },
  { id: 'default.ninja',   emoji: '🥷', category: 'default', nameKey: 'avatar.name.ninja' },
  { id: 'default.cat',     emoji: '🐱', category: 'default', nameKey: 'avatar.name.cat' },
  { id: 'default.rocket',  emoji: '🚀', category: 'default', nameKey: 'avatar.name.rocket' },
];

// ── Achievement avatars (one per achievement, auto-generated) ───────────────
const ACHIEVEMENT_AVATARS: AvatarDef[] = ACHIEVEMENTS.map((ach) => ({
  id: `ach_${ach.id}`,
  emoji: ach.icon,
  category: 'achievement' as const,
  nameKey: ach.nameKey,
}));

// Defaults first, then achievements (stable ordering from ACHIEVEMENTS array)
export const AVATAR_REGISTRY: AvatarDef[] = [...DEFAULT_AVATARS, ...ACHIEVEMENT_AVATARS];

const avatarMap = new Map(AVATAR_REGISTRY.map((a) => [a.id, a]));

export function getAvatarById(id: string): AvatarDef | undefined {
  return avatarMap.get(id);
}

/** Returns the avatar associated with a given achievement, or null. */
export function getAvatarForAchievement(achievementId: string): AvatarDef | null {
  return AVATAR_REGISTRY.find((a) => a.id === `ach_${achievementId}`) ?? null;
}

export function getAvatarEmoji(id?: string): string {
  if (!id) return '😊';
  return avatarMap.get(id)?.emoji ?? '😊';
}

// ── LocalStorage helpers ────────────────────────────────────────────────────

const AVATAR_KEY = 'wg_avatar';

export function getStoredAvatarId(): string {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_ID;
  return localStorage.getItem(AVATAR_KEY) ?? DEFAULT_AVATAR_ID;
}

export function setStoredAvatarId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AVATAR_KEY, id);
}

// ── Recent avatar unlocks (localStorage-persisted) ──────────────────────────

const RECENT_UNLOCKS_KEY = 'wg_recent_avatar_unlocks';
const RECENT_UNLOCKS_MAX = 6;

export function getRecentAvatarUnlocks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_UNLOCKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Add avatar IDs to the front of the recent unlocks list (dedup, cap at 6). */
export function addRecentAvatarUnlocks(avatarIds: string[]): void {
  if (typeof window === 'undefined' || avatarIds.length === 0) return;
  const current = getRecentAvatarUnlocks();
  const filtered = current.filter((id) => !avatarIds.includes(id));
  const next = [...avatarIds, ...filtered].slice(0, RECENT_UNLOCKS_MAX);
  localStorage.setItem(RECENT_UNLOCKS_KEY, JSON.stringify(next));
}
