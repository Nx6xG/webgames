/**
 * Simple save/load utility for singleplayer game state persistence.
 */

const PREFIX = 'webgames.save.';

export function saveGame(gameId: string, state: unknown): void {
  try {
    localStorage.setItem(PREFIX + gameId, JSON.stringify(state));
  } catch { /* quota exceeded or private mode */ }
}

export function loadGame<T>(gameId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + gameId);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

export function clearSave(gameId: string): void {
  try { localStorage.removeItem(PREFIX + gameId); } catch { /* ignore */ }
}

export function hasSave(gameId: string): boolean {
  try { return localStorage.getItem(PREFIX + gameId) !== null; } catch { return false; }
}
