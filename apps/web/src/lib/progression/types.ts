export interface PlayerProgression {
  xp: number;             // current XP within level
  level: number;          // starts at 1
  tokens: number;
  dailyXpEarned: number;
  dailyXpDate: string;    // ISO date for cap reset
  gotdBonusDate: string;  // last GOTD bonus claimed date
  winStreak: number;
  /** Flag: was the last multiplayer game a win? Used for streak reset + deferred loss XP. */
  _lastWasWin: boolean;
  /** Whether a multiplayer game is pending outcome (game_played fired, awaiting game_won or next game_played). */
  _pendingMultiplayerResult: boolean;
}

export interface LevelUpResult {
  fromLevel: number;
  toLevel: number;
  tokensGranted: number;
}

export interface LevelProgress {
  level: number;
  currentXp: number;
  requiredXp: number;
  /** 0–1 progress through current level */
  progress: number;
  rank: string;
  totalTokens: number;
}
