import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type { RpsState, RpsAction, RpsPick, RpsMode } from 'shared';

const VALID_PICKS = new Set<string>(['rock', 'paper', 'scissors']);

export interface RpsEngineConfig {
  mode?: RpsMode;
  /** Only used in best_of mode. Must be odd. Default: 3. */
  bestOf?: number;
}

function resolveRound(p0: RpsPick, p1: RpsPick): 'p0_wins' | 'p1_wins' | 'draw' {
  if (p0 === p1) return 'draw';
  if (
    (p0 === 'rock'     && p1 === 'scissors') ||
    (p0 === 'scissors' && p1 === 'paper')    ||
    (p0 === 'paper'    && p1 === 'rock')
  ) return 'p0_wins';
  return 'p1_wins';
}

export const rpsEngine: GameEngine<RpsState, RpsAction> = {
  initialState([p0, p1]: string[], startingPlayerIndex: number = 0, config?: unknown): RpsState {
    const cfg = config as RpsEngineConfig | undefined;
    const mode: RpsMode = cfg?.mode === 'showdown' ? 'showdown' : 'best_of';
    // showdown: no round cap; best_of: use provided value (must be odd), default 3
    const rawBestOf = typeof cfg?.bestOf === 'number' && cfg.bestOf > 0 ? cfg.bestOf : 3;
    const bestOf    = mode === 'showdown' ? 0 : (rawBestOf % 2 === 0 ? rawBestOf + 1 : rawBestOf);
    const winsNeeded = mode === 'showdown' ? 1 : Math.ceil(bestOf / 2);
    const first = startingPlayerIndex === 0 ? p0 : p1;
    return {
      mode,
      players:         [{ id: p0 }, { id: p1 }],
      scores:          [0, 0],
      round:           1,
      bestOf,
      winsNeeded,
      pendingPick0:    null,
      pendingPick1:    null,
      hasPicked:       [false, false],
      picks:           [null, null],
      lastRoundResult: null,
      currentTurn:     first,
      status:          'ongoing',
    };
  },

  applyAction(state: RpsState, action: RpsAction, ctx: ActionContext): RpsState {
    if (state.status !== 'ongoing') throw new Error('GAME_OVER: Match is already finished');
    if (action.type !== 'rps_pick')  throw new Error('INVALID_ACTION: Unknown action type');

    const { pick } = action;
    if (!VALID_PICKS.has(pick)) throw new Error('INVALID_ACTION: Invalid pick value');

    const pIdx = state.players.findIndex((p) => p.id === ctx.playerId);
    if (pIdx === -1) throw new Error('NOT_IN_ROOM: You are not a player in this match');
    if (state.hasPicked[pIdx]) throw new Error('ALREADY_PICKED: You already picked for this round');

    const newHasPicked: [boolean, boolean] = [state.hasPicked[0], state.hasPicked[1]];
    newHasPicked[pIdx] = true;

    const newPending0 = pIdx === 0 ? pick : state.pendingPick0;
    const newPending1 = pIdx === 1 ? pick : state.pendingPick1;

    const bothPicked = newHasPicked[0] && newHasPicked[1];

    // ── One player submitted, waiting for the other ─────────────────────────
    if (!bothPicked) {
      // Set currentTurn to the player who still needs to pick
      const nextTurn = pIdx === 0 ? state.players[1].id : state.players[0].id;
      return {
        ...state,
        pendingPick0:    newPending0,
        pendingPick1:    newPending1,
        hasPicked:       newHasPicked,
        picks:           [null, null], // hide picks during picking phase
        lastRoundResult: null,
        currentTurn:     nextTurn,
      };
    }

    // ── Both have picked — resolve the round ─────────────────────────────────
    const p0pick = newPending0!;
    const p1pick = newPending1!;
    const roundResult = resolveRound(p0pick, p1pick);

    const newScores: [number, number] = [state.scores[0], state.scores[1]];
    if (roundResult === 'p0_wins') newScores[0]++;
    else if (roundResult === 'p1_wins') newScores[1]++;

    const newRound = state.round + 1;

    // Check if the match is over
    let matchStatus: 'ongoing' | 'win' | 'draw' = 'ongoing';
    let matchWinner: string | undefined;

    if (state.mode === 'showdown') {
      // Showdown: first non-draw round decides the winner; draws keep going
      if (roundResult !== 'draw') {
        matchStatus = 'win';
        matchWinner = roundResult === 'p0_wins' ? state.players[0].id : state.players[1].id;
      }
      // draw → matchStatus stays 'ongoing', play another round
    } else {
      // Best-of: standard first-to-winsNeeded logic
      if (newScores[0] >= state.winsNeeded) {
        matchStatus = 'win';
        matchWinner = state.players[0].id;
      } else if (newScores[1] >= state.winsNeeded) {
        matchStatus = 'win';
        matchWinner = state.players[1].id;
      } else if (newRound > state.bestOf) {
        // Exhausted all rounds without a decisive winner
        if (newScores[0] === newScores[1]) {
          matchStatus = 'draw';
        } else {
          matchStatus = 'win';
          matchWinner = newScores[0] > newScores[1] ? state.players[0].id : state.players[1].id;
        }
      }
    }

    // ── Reset for the next round ─────────────────────────────────────────────
    // picks[] is intentionally kept non-null here so the client can display
    // what each player chose. hasPicked[] and pendingPick* are cleared
    // immediately so both players can pick as soon as the reveal is shown.
    // The UI must use hasPicked[] (not picks[]) to decide if a player can act.
    // lastRound is set here and never cleared on match end — the match summary
    // screen reads from it so it is always available regardless of timing.
    return {
      ...state,
      pendingPick0:    null,
      pendingPick1:    null,
      hasPicked:       [false, false],
      picks:           [p0pick, p1pick], // revealed; next pick resets to [null,null]
      scores:          newScores,
      round:           matchStatus === 'ongoing' ? newRound : state.round,
      lastRoundResult: roundResult,
      lastRound:       { p0Pick: p0pick, p1Pick: p1pick, result: roundResult },
      currentTurn:     state.players[0].id, // reset for next round
      status:          matchStatus,
      winner:          matchWinner,
    };
  },

  getStatus(state: RpsState): StatusResult {
    return { status: state.status, winner: state.winner };
  },
};
