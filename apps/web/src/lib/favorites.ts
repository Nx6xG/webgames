const STORAGE_KEY = 'webgames.favorites';

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setFavorites(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function toggleFavorite(gameId: string): string[] {
  const favs = getFavorites();
  const idx = favs.indexOf(gameId);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(gameId);
  setFavorites(favs);
  return favs;
}

export function isFavorite(gameId: string): boolean {
  return getFavorites().includes(gameId);
}
