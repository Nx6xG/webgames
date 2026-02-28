import type { Match } from 'shared';

export type { Match };

const MAX = 10;
const store = new Map<string, Match[]>();

export function addMatch(nickname: string, match: Match): void {
  const list = store.get(nickname) ?? [];
  list.unshift(match);
  if (list.length > MAX) list.length = MAX;
  store.set(nickname, list);
}

export function getHistory(nickname: string): Match[] {
  return store.get(nickname) ?? [];
}
