import type { PersonalScoreEntry, ScoreGameConfig } from './types';

const STORAGE_PREFIX = 'webgames.pb.';

function getStorageKey(gameId: string): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

export function loadScores(gameId: string): PersonalScoreEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(gameId));
    if (!raw) return [];
    return JSON.parse(raw) as PersonalScoreEntry[];
  } catch {
    return [];
  }
}

export function saveScores(gameId: string, entries: PersonalScoreEntry[]): void {
  try {
    localStorage.setItem(getStorageKey(gameId), JSON.stringify(entries));
  } catch { /* noop */ }
}

export function clearScores(gameId: string): void {
  try {
    localStorage.removeItem(getStorageKey(gameId));
  } catch { /* noop */ }
}

/**
 * Insert a new score entry, sort by the config's direction, trim to maxEntries.
 * Returns the updated list and the index of the new entry (-1 if it didn't make the cut).
 */
export function insertScore(
  gameId: string,
  entry: PersonalScoreEntry,
  config: ScoreGameConfig,
): { entries: PersonalScoreEntry[]; index: number } {
  const existing = loadScores(gameId);
  const all = [...existing, entry];

  const sorted = all.sort((a, b) =>
    config.sortDirection === 'desc' ? b.score - a.score : a.score - b.score,
  );

  const trimmed = sorted.slice(0, config.maxEntries);
  saveScores(gameId, trimmed);

  const index = trimmed.findIndex((e) => e.id === entry.id);
  return { entries: trimmed, index };
}
