import type { CosmeticsSelection } from 'shared';

/** Unified profile data that both local and cloud sources can produce. */
export interface ProfileData {
  userId: string | null; // null for local-only guests
  nickname: string;
  createdAt: string | null;
  cosmetics: CosmeticsSelection;
  achievementsUnlocked: number;
  achievementsTotal: number;
  totalPlayed: number;
  totalWins: number;
  totalWinrate: number; // 0–100
  favoriteGame: string | null;
  perGame: GameStatEntry[];
  badges: string[];
  /** True if this is the viewing user's own profile. */
  isOwnProfile: boolean;
  /** True if data comes only from localStorage (no cloud). */
  isLocalOnly: boolean;
}

export interface GameStatEntry {
  gameId: string;
  played: number;
  wins: number;
  winrate: number;
  bestScore?: number | null;
  bestTime?: number | null;
  bestTile?: number | null;
  bestLines?: number | null;
}
