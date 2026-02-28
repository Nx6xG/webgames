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
  /** Called once when the second player joins; returns the initial board state */
  initialState(playerIds: [string, string]): TState;

  /**
   * Apply a player action to the current state.
   * Must validate turn order, move legality, and game-over conditions.
   * Throws an Error with format "ERROR_CODE: human message" on illegal moves.
   */
  applyAction(state: TState, action: TAction, ctx: ActionContext): TState;

  /** Derive the current game status from state */
  getStatus(state: TState): StatusResult;
}
