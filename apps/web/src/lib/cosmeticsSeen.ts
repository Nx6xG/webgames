/**
 * Tracks which cosmetics the user has "seen" in the studio,
 * so we can show "NEW" badges on freshly unlocked items.
 *
 * An item is "new" if: it has a requiredAchievement, that achievement
 * is unlocked, AND the item is NOT in the seen list.
 * Free items (no achievement gate) are never "new".
 */

const SEEN_KEY = 'wg_cosmetics_seen_v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

type SeenMap = Record<string, string[]>;

export function loadSeenCosmetics(): SeenMap {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveSeenCosmetics(map: SeenMap): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch { /* quota exceeded */ }
}

export function markCosmeticSeen(slot: string, id: string): void {
  const map = loadSeenCosmetics();
  const list = map[slot] ?? [];
  if (!list.includes(id)) {
    list.push(id);
    map[slot] = list;
    saveSeenCosmetics(map);
  }
}

export function markSlotAllSeen(slot: string, ids: string[]): void {
  const map = loadSeenCosmetics();
  const list = new Set(map[slot] ?? []);
  for (const id of ids) list.add(id);
  map[slot] = [...list];
  saveSeenCosmetics(map);
}

export function isCosmeticSeen(slot: string, id: string): boolean {
  const map = loadSeenCosmetics();
  return (map[slot] ?? []).includes(id);
}
