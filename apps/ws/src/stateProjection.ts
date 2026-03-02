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
} from 'shared';

// ── Viewer context ─────────────────────────────────────────────────────────────

export interface ViewerCtx {
  /** Index of the viewing player (0 or 1).  null for spectators. */
  playerIndex: 0 | 1 | null;
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
  const oppIdx: 0 | 1 = ctx.playerIndex === 0 ? 1 : 0;
  const newPlayers: [BsPlayerState, BsPlayerState] = [bs.players[0], bs.players[1]];
  newPlayers[oppIdx] = projectOpponentPlayer(bs.players[oppIdx]);

  return { ...bs, players: newPlayers };
}
