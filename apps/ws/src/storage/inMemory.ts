import type { Storage, LeaderboardEntry } from './types.js';

export class InMemoryStorage implements Storage {
  private readonly leaderboard = new Map<string, LeaderboardEntry>();

  async upsertLeaderboard(entry: LeaderboardEntry): Promise<void> {
    this.leaderboard.set(entry.playerToken, entry);
  }

  async getLeaderboardTop(limit: number): Promise<LeaderboardEntry[]> {
    return [...this.leaderboard.values()]
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limit);
  }
}
