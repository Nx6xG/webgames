import type { AchievementStats } from './definitions';
import type { CosmeticSlot } from '@/lib/cosmetics';
import { getCosmeticDef } from '@/lib/cosmetics';

const STATS_KEY = 'webgames_stats_v1';
const UNLOCKED_KEY = 'webgames_achievements_v1';
const UNLOCKED_FRAMES_KEY = 'webgames_unlocked_frames_v1';
const UNLOCKED_COSMETICS_KEY = 'webgames_unlocked_cosmetics_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function defaultStats(): AchievementStats {
  return {
    playsTotal: 0,
    winsTotal: 0,
    invitesTotal: 0,
    playsByGame: {},
    winsByGame: {},
  };
}

export function loadStats(): AchievementStats {
  if (!isBrowser()) return defaultStats();
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    return { ...defaultStats(), ...parsed };
  } catch {
    return defaultStats();
  }
}

export function saveStats(stats: AchievementStats): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* quota exceeded — ignore */ }
}

export function loadUnlocked(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveUnlocked(set: Set<string>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...set]));
  } catch { /* quota exceeded — ignore */ }
}

/** Returns true only when the achievement was newly unlocked (first time). */
export function unlock(id: string): boolean {
  const set = loadUnlocked();
  if (set.has(id)) return false;
  set.add(id);
  saveUnlocked(set);
  return true;
}

// ── Unlocked frames ──────────────────────────────────────────────────────────

export function loadUnlockedFrames(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(UNLOCKED_FRAMES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveUnlockedFrames(set: Set<string>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(UNLOCKED_FRAMES_KEY, JSON.stringify([...set]));
  } catch { /* quota exceeded — ignore */ }
}

export function unlockFrame(frame: string): boolean {
  const set = loadUnlockedFrames();
  if (set.has(frame)) return false;
  set.add(frame);
  saveUnlockedFrames(set);
  return true;
}

// ── Unlocked cosmetics (slot-based) ─────────────────────────────────────────

export type UnlockedCosmeticsMap = Record<CosmeticSlot, string[]>;

function defaultCosmeticsMap(): UnlockedCosmeticsMap {
  return { frame: [], head: [], portal: [], aura: [], banner: [], cardColor: [], badge: [], title: [] };
}

function migrateFramesToCosmetics(): UnlockedCosmeticsMap {
  const frames = loadUnlockedFrames();
  const result: UnlockedCosmeticsMap = { ...defaultCosmeticsMap(), frame: [...frames] };
  if (!isBrowser()) return result;
  try {
    localStorage.setItem(UNLOCKED_COSMETICS_KEY, JSON.stringify(result));
  } catch { /* ignore */ }
  return result;
}

export function loadUnlockedCosmetics(): UnlockedCosmeticsMap {
  if (!isBrowser()) return defaultCosmeticsMap();
  try {
    const raw = localStorage.getItem(UNLOCKED_COSMETICS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultCosmeticsMap(), ...parsed };
    }
  } catch { /* fall through */ }
  // Migration from legacy frames key
  return migrateFramesToCosmetics();
}

export function saveUnlockedCosmetics(map: UnlockedCosmeticsMap): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(UNLOCKED_COSMETICS_KEY, JSON.stringify(map));
    // Keep legacy frames key in sync
    saveUnlockedFrames(new Set(map.frame ?? []));
  } catch { /* ignore */ }
}

export function isCosmeticUnlocked(slot: CosmeticSlot, id: string): boolean {
  const map = loadUnlockedCosmetics();
  if ((map[slot] ?? []).includes(id)) return true;
  // Fallback: check if the cosmetic's required achievement is unlocked.
  // This handles cosmetics that aren't granted as explicit achievement rewards
  // but are still gated by requiredAchievement in the registry.
  const def = getCosmeticDef(id, slot);
  if (def?.requiredAchievement) {
    const unlocked = loadUnlocked();
    return unlocked.has(def.requiredAchievement);
  }
  return false;
}

export function unlockCosmetic(slot: CosmeticSlot, id: string): boolean {
  const map = loadUnlockedCosmetics();
  const list = map[slot] ?? [];
  if (list.includes(id)) return false;
  list.push(id);
  map[slot] = list;
  saveUnlockedCosmetics(map);
  return true;
}
