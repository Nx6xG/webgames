export type GameStatus = 'ongoing' | 'win' | 'draw';

/** Per-action caller context injected by the server */
export interface ActionContext {
  /** Socket ID of the acting player */
  playerId: string;
  /** 0-based seat index of the acting player */
  playerIndex: number;
}

export interface StatusResult {
  status: GameStatus;
  /** playerId of the winner (only set when status === 'win') */
  winner?: string;
}

/**
 * Authoritative server-side game engine interface.
 * All state transitions happen here; clients only send actions.
 */
export interface GameEngine<TState, TAction> {
  /**
   * Called once when enough players have joined; returns the initial board state.
   * `playerIds` contains tokens for every seated player (length 2 for most games,
   * 2–6 for party games like Liar's Bar).
   * Pass `startingPlayerIndex` to control which player moves first.
   * Defaults to 0 when omitted — callers should always pass a random value.
   * `config` is an optional game-specific configuration object (only used by RPS).
   */
  initialState(playerIds: string[], startingPlayerIndex?: number, config?: unknown): TState;

  /**
   * Apply a player action to the current state.
   * Must validate turn order, move legality, and game-over conditions.
   * Throws an Error with format "ERROR_CODE: human message" on illegal moves.
   */
  applyAction(state: TState, action: TAction, ctx: ActionContext): TState;

  /** Derive the current game status from state */
  getStatus(state: TState): StatusResult;

  /** Called every tickInterval ms for real-time games (e.g. Curve Fever). */
  tick?(state: TState): TState;
  /** Interval in ms between tick() calls (e.g. 50 = 20 tps). */
  tickInterval?: number;
  /** When true, skip turn-order and rate-limit checks (all players act simultaneously). */
  simultaneousInput?: boolean;
}
