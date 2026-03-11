/** A single personal-best entry stored per game (localStorage). */
export interface PersonalScoreEntry {
  id: string;
  score: number;
  createdAt: number; // Date.now() timestamp
  meta?: Record<string, number | string | boolean>;
}

/** A public leaderboard entry (from Supabase). */
export interface PublicScoreEntry {
  id: string;
  userId: string;
  nickname: string;
  gameId: string;
  score: number;
  createdAt: string; // ISO timestamp
  meta?: Record<string, number | string | boolean>;
}

export type SortDirection = 'asc' | 'desc';
export type LeaderboardMode = 'personal' | 'public';

/** Describes one extra column in the leaderboard table. */
export interface MetaColumn {
  key: string;
  labelKey: string; // i18n key
  format?: (value: number | string | boolean) => string;
}

/** Per-game configuration for the personal-scores system. */
export interface ScoreGameConfig {
  sortDirection: SortDirection;
  maxEntries: number;
  publicMaxEntries: number;
  shouldStore: (score: number, meta?: Record<string, number | string | boolean>) => boolean;
  scoreLabelKey: string; // i18n key for the main score column header
  scoreFormat?: (score: number) => string;
  columns: MetaColumn[];
}
