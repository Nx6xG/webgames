export type LeaderboardEntry = {
  playerToken: string;
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
};

export interface Storage {
  upsertLeaderboard(entry: LeaderboardEntry): Promise<void>;
  getLeaderboardTop(limit: number): Promise<LeaderboardEntry[]>;
}
