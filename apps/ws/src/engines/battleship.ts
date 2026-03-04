import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type {
  BattleshipState,
  BattleshipAction,
  BsPlayerState,
  BattleshipShip,
  ShipId,
  Coord,
  Orientation,
  ShotRecord,
  BsSlot,
} from 'shared';
import { SHIP_DEFS, BOARD_SIZE } from 'shared';

const DEV = process.env.NODE_ENV !== 'production';

// ── Pure helpers ──────────────────────────────────────────────────────────────

function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

function coordEq(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function shipCells(origin: Coord, orientation: Orientation, length: number): Coord[] {
  const cells: Coord[] = [];
  for (let i = 0; i < length; i++) {
    cells.push(
      orientation === 'H'
        ? { x: origin.x + i, y: origin.y }
        : { x: origin.x,     y: origin.y + i },
    );
  }
  return cells;
}

function emptyPlayer(): BsPlayerState {
  return { ships: [], ready: false };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export const battleshipEngine: GameEngine<BattleshipState, BattleshipAction> = {

  initialState([p0, p1]): BattleshipState {
    return {
      phase:       'setup',
      playerIds:   [p0, p1],
      players:     [emptyPlayer(), emptyPlayer()],
      shotsFired:  [[], []],
      currentTurn: p0,  // slot-A's token; satisfies server sanity guard during setup
      winner:      null,
      lastShot:    null,
      status:      'ongoing',
    };
  },

  applyAction(state: BattleshipState, action: BattleshipAction, ctx: ActionContext): BattleshipState {
    if (state.status === 'win') throw new Error('GAME_OVER: Game is already finished');

    const pIdx = ctx.playerIndex as 0 | 1;
    const slot: BsSlot = pIdx === 0 ? 'A' : 'B';

    switch (action.type) {

      // ── BS_PLACE_SHIP ─────────────────────────────────────────────────────
      case 'BS_PLACE_SHIP': {
        if (DEV) console.log('[BS] PLACE_SHIP', {
          playerIndex: pIdx,
          shipId: action.shipId,
          origin: action.origin,
          orientation: action.orientation,
          phase: state.phase,
          playerReady: state.players[pIdx].ready,
        });

        if (state.phase !== 'setup') {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: wrong phase', state.phase);
          throw new Error('INVALID_ACTION: Ship placement is only allowed during setup');
        }
        if (state.players[pIdx].ready) {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: already ready');
          throw new Error('INVALID_ACTION: You already marked as ready');
        }

        const def = SHIP_DEFS.find((d) => d.id === action.shipId);
        if (!def) {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: unknown shipId', action.shipId);
          throw new Error('INVALID_ACTION: Unknown ship id');
        }

        const cells = shipCells(action.origin, action.orientation, def.length);

        if (!cells.every(inBounds)) {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: out of bounds', cells);
          throw new Error('INVALID_POSITION: Ship extends outside the board');
        }

        // All other ships (excluding the one being re-placed)
        const others = state.players[pIdx].ships.filter((s) => s.id !== action.shipId);
        const occupied = others.flatMap((s) => s.cells ?? []);
        if (cells.some((c) => occupied.some((o) => coordEq(c, o)))) {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: overlap', cells);
          throw new Error('INVALID_POSITION: Ships cannot overlap');
        }

        const newShip: BattleshipShip = { id: action.shipId, cells, hits: [], sunk: false };
        const newPlayer: BsPlayerState = { ...state.players[pIdx], ships: [...others, newShip] };
        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[pIdx] = newPlayer;

        return { ...state, players: newPlayers };
      }

      // ── BS_RESET_PLACEMENT ────────────────────────────────────────────────
      case 'BS_RESET_PLACEMENT': {
        if (state.phase !== 'setup') throw new Error('INVALID_ACTION: Reset is only allowed during setup');
        if (state.players[pIdx].ready)  throw new Error('INVALID_ACTION: You already marked as ready');

        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[pIdx] = emptyPlayer();

        return { ...state, players: newPlayers };
      }

      // ── BS_READY ──────────────────────────────────────────────────────────
      case 'BS_READY': {
        if (state.phase !== 'setup')   throw new Error('INVALID_ACTION: Ready is only allowed during setup');
        if (state.players[pIdx].ready) throw new Error('INVALID_ACTION: Already ready');
        if (state.players[pIdx].ships.length < SHIP_DEFS.length) {
          throw new Error('INVALID_ACTION: You must place all ships before marking ready');
        }

        const newPlayer: BsPlayerState = { ...state.players[pIdx], ready: true };
        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[pIdx] = newPlayer;

        const bothReady = newPlayers[0].ready && newPlayers[1].ready;

        return {
          ...state,
          players: newPlayers,
          phase: bothReady ? 'playing' : 'setup',
        };
      }

      // ── BS_FIRE ───────────────────────────────────────────────────────────
      case 'BS_FIRE': {
        if (state.phase !== 'playing') throw new Error('INVALID_ACTION: Can only fire during the playing phase');
        // currentTurn is a player token (UUID); ctx.playerId is the acting player's token.
        if (state.currentTurn !== ctx.playerId) throw new Error('NOT_YOUR_TURN: Wait for your turn to fire');

        const { at } = action;
        if (!inBounds(at)) throw new Error('INVALID_POSITION: Target is outside the board');

        if (state.shotsFired[pIdx].some((s) => coordEq(s.at, at))) {
          throw new Error('CELL_TAKEN: You already fired at this cell');
        }

        const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
        const oppPlayer       = state.players[oppIdx];

        // Find hit ship
        let hitShip: BattleshipShip | null = null;
        for (const ship of oppPlayer.ships) {
          if ((ship.cells ?? []).some((c) => coordEq(c, at))) { hitShip = ship; break; }
        }

        const result             = hitShip ? 'hit' : 'miss';
        let   sunkShipId: ShipId | null = null;

        // Update hit / sunk status on opponent's ships
        const newOppShips = oppPlayer.ships.map((ship): BattleshipShip => {
          if (ship.id !== hitShip?.id) return ship;
          const newHits = [...(ship.hits ?? []), at];
          const sunk    = newHits.length === (ship.cells?.length ?? 0);
          if (sunk) sunkShipId = ship.id;
          return { ...ship, hits: newHits, sunk };
        });

        const newOppPlayer: BsPlayerState = { ...oppPlayer, ships: newOppShips };
        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[oppIdx] = newOppPlayer;

        const shotRecord: ShotRecord = { at, result, sunkShipId, shipId: hitShip?.id ?? null };

        const newShotsFired: [ShotRecord[], ShotRecord[]] = [
          [...state.shotsFired[0]],
          [...state.shotsFired[1]],
        ];
        newShotsFired[pIdx] = [...newShotsFired[pIdx], shotRecord];

        const lastShot = { ...shotRecord, by: slot };

        // Win condition: all opponent ships sunk
        if (newOppShips.every((s) => s.sunk)) {
          return {
            ...state,
            players:    newPlayers,
            shotsFired: newShotsFired,
            lastShot,
            phase:      'finished',
            status:     'win',
            winner:     slot,
          };
        }

        // Miss → opponent's turn; Hit or Sunk → same player fires again.
        const nextTurnToken: string = result === 'miss'
          ? state.playerIds[oppIdx]
          : ctx.playerId;

        return {
          ...state,
          players:     newPlayers,
          shotsFired:  newShotsFired,
          currentTurn: nextTurnToken,
          lastShot,
        };
      }

      default:
        throw new Error('INVALID_ACTION: Unknown action type');
    }
  },

  getStatus(state: BattleshipState): StatusResult {
    if (state.status === 'win' && state.winner !== null) {
      const winnerIdx: 0 | 1 = state.winner === 'A' ? 0 : 1;
      return { status: 'win', winner: state.playerIds[winnerIdx] };
    }
    return { status: 'ongoing' };
  },
};
