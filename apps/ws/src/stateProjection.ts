/**
 * Per-client state projection.
 *
 * For most games the full authoritative state is safe to broadcast to all players.
 * Battleship is the exception: each player's ship positions must stay hidden from
 * their opponent (and from spectators) until a ship is sunk.
 *
 * projectGameState() is called once per socket before every game_state / room_joined /
 * room_rejoined / player_joined / rematch_started emission so every viewer receives
 * only the information they are allowed to see.
 *
 * Reveal rules (player viewer):
 *   own ships          → always full (cells + hits present)
 *   opponent ship sunk → reveal cells (outline shown after sink); hits stripped (redundant)
 *   opponent ship live → cells + hits stripped entirely (anti-cheat)
 *
 * Spectator rules:
 *   both players' ships → cells + hits always stripped, even after sinking
 */

import type {
  GameId,
  AnyGameState,
  BattleshipState,
  BattleshipShip,
  BsPlayerState,
  LiarsBarState,
} from 'shared';

// ── Viewer context ─────────────────────────────────────────────────────────────

export interface ViewerCtx {
  /** Index of the viewing player (0-based seat).  null for spectators. */
  playerIndex: number | null;
  isSpectator: boolean;
}

// ── Ship projectors ────────────────────────────────────────────────────────────

/** Strip every positional field — used for spectators and for live (unsunk) opponent ships. */
function stripShip(ship: BattleshipShip): BattleshipShip {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cells: _c, hits: _h, ...rest } = ship;
  return rest as BattleshipShip;
}

/**
 * Project one opponent ship for a **player** viewer:
 * - Sunk   → keep cells (reveal outline), strip hits (redundant: all cells hit).
 * - Live   → strip both cells and hits (hidden until sunk).
 */
function projectOpponentShip(ship: BattleshipShip): BattleshipShip {
  if (ship.sunk) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hits: _h, ...rest } = ship;   // keep cells, drop hits
    return rest as BattleshipShip;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cells: _c, hits: _h, ...rest } = ship;
  return rest as BattleshipShip;
}

function stripPlayer(player: BsPlayerState): BsPlayerState {
  return { ...player, ships: player.ships.map(stripShip) };
}

function projectOpponentPlayer(player: BsPlayerState): BsPlayerState {
  return { ...player, ships: player.ships.map(projectOpponentShip) };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Return a view of `state` safe for the given viewer.
 * For non-Battleship games returns `state` unchanged (zero-copy fast path).
 */
export function projectGameState(
  gameId: GameId,
  state: AnyGameState,
  ctx: ViewerCtx,
): AnyGameState {
  if (gameId === 'liarsbar') return projectLiarsBar(state as LiarsBarState, ctx);
  if (gameId !== 'battleship') return state;

  const bs = state as BattleshipState;

  if (ctx.isSpectator || ctx.playerIndex === null) {
    // Spectators see no ship positions at all — even sunk ships stay fogged.
    return {
      ...bs,
      players: [stripPlayer(bs.players[0]), stripPlayer(bs.players[1])],
    };
  }

  // Player: own ships untouched; opponent ships get per-sunk projection.
  // Battleship is always 2-player, so playerIndex is always 0 or 1 here.
  const oppIdx: 0 | 1 = (ctx.playerIndex === 0 ? 1 : 0);
  const newPlayers: [BsPlayerState, BsPlayerState] = [bs.players[0], bs.players[1]];
  newPlayers[oppIdx] = projectOpponentPlayer(bs.players[oppIdx]);

  return { ...bs, players: newPlayers };
}

// ── Liar's Deck projector ──────────────────────────────────────────────────────

/**
 * Strip opponent hands so each player only sees their own cards.
 * Spectators see no hands at all.
 * The deck is always stripped (anti-cheat).
 */
function projectLiarsBar(state: LiarsBarState, ctx: ViewerCtx): LiarsBarState {
  const emptyHands = state.hands.map(() => [] as LiarsBarState['hands'][number]);

  // Strip actual cards from lastClaim (anti-cheat: only revealed on call)
  const projectedClaim = state.lastClaim
    ? { ...state.lastClaim, cards: [] }
    : null;

  // Strip bulletPos from per-player revolvers (anti-cheat: only expose cylinderPos)
  let projectedRevolvers: Record<string, { cylinderPos: number; bulletPos: number }> | undefined;
  if (state.revolvers) {
    projectedRevolvers = {};
    for (const [key, rv] of Object.entries(state.revolvers)) {
      projectedRevolvers[key] = { cylinderPos: rv.cylinderPos, bulletPos: -1 };
    }
  }

  // Legacy single roulette (backward compat for mid-game migration)
  const projectedRoulette = state.roulette
    ? { cylinderPos: state.roulette.cylinderPos, bulletPos: -1 }
    : undefined;

  const base = { ...state, deck: [], discard: [], lastClaim: projectedClaim, rngSeed: 0, revolvers: projectedRevolvers, roulette: projectedRoulette };

  if (ctx.isSpectator || ctx.playerIndex === null) {
    return { ...base, hands: emptyHands };
  }

  // Player sees only their own hand
  const projected = emptyHands.map((_, i) =>
    i === ctx.playerIndex ? [...state.hands[i]] : [],
  );

  return { ...base, hands: projected };
}
