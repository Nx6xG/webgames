import type { LeaderboardEntry, LeaderboardMode } from 'shared';

interface PlayerRecord {
  nickname: string;
  winsByGame: Record<string, number>;
  gamesByGame: Record<string, number>;
  totalWins: number;
  totalGames: number;
  /** Current win streak per game — resets on loss or draw */
  streakByGame: Record<string, number>;
  /** Current win streak across all games — resets on any loss or draw */
  totalStreak: number;
}

/** token → player record */
const store = new Map<string, PlayerRecord>();

function ensureRecord(token: string, nickname: string): PlayerRecord {
  let record = store.get(token);
  if (!record) {
    record = {
      nickname,
      winsByGame: {},
      gamesByGame: {},
      totalWins: 0,
      totalGames: 0,
      streakByGame: {},
      totalStreak: 0,
    };
    store.set(token, record);
  }
  record.nickname = nickname;
  return record;
}

/** Call when a match ends with a decisive winner. */
export function recordMatchResult(
  winnerToken: string,
  winnerNickname: string,
  loserToken: string,
  loserNickname: string,
  gameId: string,
): void {
  const winner = ensureRecord(winnerToken, winnerNickname);
  winner.winsByGame[gameId] = (winner.winsByGame[gameId] ?? 0) + 1;
  winner.gamesByGame[gameId] = (winner.gamesByGame[gameId] ?? 0) + 1;
  winner.totalWins++;
  winner.totalGames++;
  winner.streakByGame[gameId] = (winner.streakByGame[gameId] ?? 0) + 1;
  winner.totalStreak++;

  if (loserToken) {
    const loser = ensureRecord(loserToken, loserNickname);
    loser.gamesByGame[gameId] = (loser.gamesByGame[gameId] ?? 0) + 1;
    loser.totalGames++;
    loser.streakByGame[gameId] = 0;
    loser.totalStreak = 0;
  }
}

/** Call when a match ends in a draw — increments games and resets streaks for both. */
export function recordDraw(
  token0: string, nickname0: string,
  token1: string, nickname1: string,
  gameId: string,
): void {
  for (const [token, nickname] of [[token0, nickname0], [token1, nickname1]] as [string, string][]) {
    const record = ensureRecord(token, nickname);
    record.gamesByGame[gameId] = (record.gamesByGame[gameId] ?? 0) + 1;
    record.totalGames++;
    record.streakByGame[gameId] = 0;
    record.totalStreak = 0;
  }
}

export function updateNickname(token: string, nickname: string): void {
  const record = store.get(token);
  if (record) record.nickname = nickname;
}

export function getEntries(
  mode: LeaderboardMode,
  gameId?: string,
  myToken?: string,
): LeaderboardEntry[] {
  const rows: { token: string; nickname: string; wins: number; games: number; streak: number }[] = [];

  for (const [token, record] of store.entries()) {
    const wins   = mode === 'overall' ? record.totalWins   : (record.winsByGame[gameId ?? '']   ?? 0);
    const games  = mode === 'overall' ? record.totalGames  : (record.gamesByGame[gameId ?? '']  ?? 0);
    const streak = mode === 'overall' ? record.totalStreak : (record.streakByGame[gameId ?? ''] ?? 0);
    if (games > 0) rows.push({ token, nickname: record.nickname, wins, games, streak });
  }

  // Primary sort: wins desc; secondary: streak desc (tiebreaker)
  rows.sort((a, b) => b.wins - a.wins || b.streak - a.streak);

  return rows.map((e, i) => ({
    rank:    i + 1,
    nickname: e.nickname,
    wins:    e.wins,
    games:   e.games,
    winrate: e.games > 0 ? Math.round((e.wins / e.games) * 1000) / 10 : 0,
    streak:  e.streak,
    ...(myToken !== undefined ? { isYou: e.token === myToken } : {}),
  }));
}
