export type RpsPick = 'rock' | 'paper' | 'scissors';

/**
 * Game-mode setting for a RPS match.
 * best_of: play up to `bestOf` rounds; first to `winsNeeded` round-wins wins.
 * showdown: sudden-death; first player to win a (non-draw) round wins the match.
 */
export type RpsMode = 'best_of' | 'showdown';

export interface RpsPlayer {
  id: string;
}

export interface RpsState {
  /** Determines victory condition (best_of or showdown). */
  mode: RpsMode;
  players: [RpsPlayer, RpsPlayer];
  /** Match-wins per player: [p0wins, p1wins] */
  scores: [number, number];
  /** Current round number (1-indexed) */
  round: number;
  /** Total rounds cap (best_of mode) or 0 (showdown, no cap) */
  bestOf: number;
  /** Rounds needed to win: Math.ceil(bestOf / 2) for best_of; 1 for showdown */
  winsNeeded: number;
  /**
   * Server-side pick buffer — stores each player's pick before round resolves.
   * Clients should not render these directly; use `picks` and `hasPicked` instead.
   */
  pendingPick0: RpsPick | null;
  pendingPick1: RpsPick | null;
  /** Whether each player has submitted their pick for the current round */
  hasPicked: [boolean, boolean];
  /**
   * Both picks revealed simultaneously when round resolves.
   * Null during the picking phase.
   */
  picks: [RpsPick | null, RpsPick | null];
  /** Result of the most recently completed round; null during picking phase */
  lastRoundResult: 'p0_wins' | 'p1_wins' | 'draw' | null;
  /** Required by the server sanity guard: set to whoever still needs to act */
  currentTurn: string;
  status: 'ongoing' | 'win' | 'draw';
  /** playerToken of the match winner (only set when status === 'win') */
  winner?: string;
  /**
   * Picks and outcome of the most recently completed round.
   * Set the moment a round resolves; never cleared on match end.
   * Use this (not `picks`) for the match-end summary screen.
   */
  lastRound?: { p0Pick: RpsPick; p1Pick: RpsPick; result: 'p0_wins' | 'p1_wins' | 'draw' };
}

export interface RpsPickAction {
  type: 'rps_pick';
  pick: RpsPick;
}

export type RpsAction = RpsPickAction;
