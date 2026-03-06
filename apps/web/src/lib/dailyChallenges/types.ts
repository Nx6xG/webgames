// ── Daily Challenge types ────────────────────────────────────────────────────

export type ChallengeType = 'play_game' | 'win_game' | 'play_any';

export interface ChallengeTemplate {
  /** Unique template id, e.g. 'play_snake_2'. */
  id: string;
  type: ChallengeType;
  /** Game id (null for 'play_any'). */
  gameId: string | null;
  /** How many plays/wins required. */
  target: number;
  /** i18n key for challenge name. */
  nameKey: string;
  /** i18n key for description. */
  descKey: string;
  /** Emoji shown next to challenge. */
  icon: string;
}

export interface DailyChallenge {
  templateId: string;
  type: ChallengeType;
  gameId: string | null;
  target: number;
  nameKey: string;
  descKey: string;
  icon: string;
}

export interface DailyChallengeProgress {
  /** ISO date string, e.g. '2026-03-06'. */
  date: string;
  /** Map of templateId → current count. */
  progress: Record<string, number>;
  /** Set of completed templateIds. */
  completed: string[];
}
