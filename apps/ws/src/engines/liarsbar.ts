import type { GameEngine, ActionContext, StatusResult, GameStatus } from 'shared';
import type { LiarsBarState, LiarsBarAction } from 'shared';
import { lbCreateInitialState, lbApplyAction } from 'shared';

/**
 * Liar's Deck — server-side engine adapter.
 *
 * Supports 2–6 players with an explicit lobby phase.
 * The host sends lb_start to begin the game once enough players are seated.
 */
export const liarsBarEngine: GameEngine<LiarsBarState, LiarsBarAction> = {
  initialState(
    playerIds: string[],
    startingPlayerIndex: number = 0,
    config?: unknown,
  ): LiarsBarState {
    return lbCreateInitialState(playerIds, startingPlayerIndex, config);
  },

  applyAction(
    state: LiarsBarState,
    action: LiarsBarAction,
    ctx: ActionContext,
  ): LiarsBarState {
    return lbApplyAction(state, action, ctx.playerId);
  },

  getStatus(state: LiarsBarState): StatusResult {
    const status: GameStatus = state.phase === 'ended' ? 'win' : 'ongoing';
    return {
      status,
      winner: state.winner ?? undefined,
    };
  },
};
