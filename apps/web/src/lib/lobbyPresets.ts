const STORAGE_KEY = 'webgames_lobby_presets';

function loadAll(): Record<string, Record<string, unknown>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, Record<string, unknown>>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota */ }
}

export function saveLastConfig(gameId: string, config: Record<string, unknown>): void {
  const all = loadAll();
  all[gameId] = config;
  saveAll(all);
}

export function loadLastConfig<T extends Record<string, unknown>>(gameId: string): T | null {
  const all = loadAll();
  return (all[gameId] as T) ?? null;
}

export function hasLastConfig(gameId: string): boolean {
  const all = loadAll();
  return gameId in all;
}
