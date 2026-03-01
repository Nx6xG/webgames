export type RpsPick = 'rock' | 'paper' | 'scissors';

export interface RpsPlayer {
  id: string;
}

export interface RpsState {
  players: [RpsPlayer, RpsPlayer];
  /** Match-wins per player: [p0wins, p1wins] */
  scores: [number, number];
  /** Current round number (1-indexed) */
  round: number;
  bestOf: number;
  /** Rounds needed to win: Math.ceil(bestOf / 2) */
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
}

export interface RpsPickAction {
  type: 'rps_pick';
  pick: RpsPick;
}

export type RpsAction = RpsPickAction;
