import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type {
  BattleshipState,
  BattleshipAction,
  BsPlayerState,
  BattleshipShip,
  ShipId,
  ShipDef,
  Coord,
  Orientation,
  ShotRecord,
  BsSlot,
} from 'shared';
import { FLEET_PRESETS, BOARD_SIZE } from 'shared';

const DEV = process.env.NODE_ENV !== 'production';

// ── Pure helpers ──────────────────────────────────────────────────────────────

function inBounds(c: Coord, boardSize: number): boolean {
  return c.x >= 0 && c.x < boardSize && c.y >= 0 && c.y < boardSize;
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

function countSurvivingShips(player: BsPlayerState): number {
  return player.ships.filter((s) => !s.sunk).length;
}

// ── Auto-place helper ────────────────────────────────────────────────────────

function autoPlaceShips(shipDefs: readonly ShipDef[], boardSize: number): BattleshipShip[] {
  const MAX_FULL_RETRIES = 20;

  for (let attempt = 0; attempt < MAX_FULL_RETRIES; attempt++) {
    const placed: BattleshipShip[] = [];
    let failed = false;

    for (const def of shipDefs) {
      let success = false;

      for (let tries = 0; tries < 200; tries++) {
        const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V';
        const maxX = orientation === 'H' ? boardSize - def.length : boardSize - 1;
        const maxY = orientation === 'V' ? boardSize - def.length : boardSize - 1;
        const x = Math.floor(Math.random() * (maxX + 1));
        const y = Math.floor(Math.random() * (maxY + 1));
        const cells = shipCells({ x, y }, orientation, def.length);

        if (!cells.every((c) => inBounds(c, boardSize))) continue;

        const occupied = placed.flatMap((s) => s.cells ?? []);
        if (cells.some((c) => occupied.some((o) => coordEq(c, o)))) continue;

        placed.push({ id: def.id, cells, hits: [], sunk: false });
        success = true;
        break;
      }

      if (!success) {
        failed = true;
        break;
      }
    }

    if (!failed) return placed;
  }

  // Should be extremely rare — fall back to empty (caller can handle)
  throw new Error('AUTO_PLACE_FAILED: Could not place all ships after maximum retries');
}

// ── Engine ────────────────────────────────────────────────────────────────────

export const battleshipEngine: GameEngine<BattleshipState, BattleshipAction> = {

  tickInterval: 500,

  initialState([p0, p1]: string[], startingPlayerIndex: number = 0, config?: unknown): BattleshipState {
    const first = startingPlayerIndex === 0 ? p0 : p1;

    // Resolve config
    const cfg = config as {
      fleetPreset?: string;
      boardSize?: number;
      salvoMode?: boolean;
      shotTimerSec?: number;
    } | undefined;

    const requestedPreset = cfg?.fleetPreset ?? 'random';
    const preset = requestedPreset === 'random'
      ? FLEET_PRESETS[Math.floor(Math.random() * FLEET_PRESETS.length)]
      : FLEET_PRESETS.find((p) => p.id === requestedPreset) ?? FLEET_PRESETS[0];

    const boardSize = cfg?.boardSize ?? 10;
    const salvoMode = cfg?.salvoMode ?? false;
    const shotTimerSec = cfg?.shotTimerSec ?? 0;

    return {
      phase:       'setup',
      playerIds:   [p0, p1],
      players:     [emptyPlayer(), emptyPlayer()],
      shotsFired:  [[], []],
      currentTurn: first,  // satisfies server sanity guard; also determines who fires first
      winner:      null,
      lastShot:    null,
      status:      'ongoing',
      shipDefs:    [...preset.ships],
      fleetId:     preset.id,
      boardSize,
      salvoMode,
      salvoShotsRemaining: 0,
      salvoTotal:  0,
      shotTimerSec,
      turnStartedAt: null,
    };
  },

  applyAction(state: BattleshipState, action: BattleshipAction, ctx: ActionContext): BattleshipState {
    if (state.status === 'win') throw new Error('GAME_OVER: Game is already finished');

    const pIdx = ctx.playerIndex as 0 | 1;
    const slot: BsSlot = pIdx === 0 ? 'A' : 'B';
    const shipDefs = state.shipDefs;
    const boardSize = state.boardSize;

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

        const def = shipDefs.find((d) => d.id === action.shipId);
        if (!def) {
          if (DEV) console.log('[BS] PLACE_SHIP rejected: unknown shipId', action.shipId);
          throw new Error('INVALID_ACTION: Unknown ship id');
        }

        const cells = shipCells(action.origin, action.orientation, def.length);

        if (!cells.every((c) => inBounds(c, boardSize))) {
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

      // ── BS_AUTO_PLACE ─────────────────────────────────────────────────────
      case 'BS_AUTO_PLACE': {
        if (state.phase !== 'setup') throw new Error('INVALID_ACTION: Auto-place is only allowed during setup');
        if (state.players[pIdx].ready) throw new Error('INVALID_ACTION: You already marked as ready');

        const ships = autoPlaceShips(shipDefs, boardSize);
        const newPlayer: BsPlayerState = { ...state.players[pIdx], ships };
        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[pIdx] = newPlayer;

        return { ...state, players: newPlayers };
      }

      // ── BS_READY ──────────────────────────────────────────────────────────
      case 'BS_READY': {
        if (state.phase !== 'setup')   throw new Error('INVALID_ACTION: Ready is only allowed during setup');
        if (state.players[pIdx].ready) throw new Error('INVALID_ACTION: Already ready');
        if (state.players[pIdx].ships.length < shipDefs.length) {
          throw new Error('INVALID_ACTION: You must place all ships before marking ready');
        }

        const newPlayer: BsPlayerState = { ...state.players[pIdx], ready: true };
        const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
        newPlayers[pIdx] = newPlayer;

        const bothReady = newPlayers[0].ready && newPlayers[1].ready;

        if (bothReady) {
          // Determine first player index
          const firstIdx = state.playerIds.indexOf(state.currentTurn) as 0 | 1;
          const salvoCount = state.salvoMode ? countSurvivingShips(newPlayers[firstIdx]) : 0;

          return {
            ...state,
            players: newPlayers,
            phase: 'playing',
            salvoShotsRemaining: salvoCount,
            salvoTotal: salvoCount,
            turnStartedAt: state.shotTimerSec > 0 ? Date.now() : null,
          };
        }

        return {
          ...state,
          players: newPlayers,
          phase: 'setup',
        };
      }

      // ── BS_FIRE ───────────────────────────────────────────────────────────
      case 'BS_FIRE': {
        if (state.phase !== 'playing') throw new Error('INVALID_ACTION: Can only fire during the playing phase');
        // currentTurn is a player token (UUID); ctx.playerId is the acting player's token.
        if (state.currentTurn !== ctx.playerId) throw new Error('NOT_YOUR_TURN: Wait for your turn to fire');

        const { at } = action;
        if (!inBounds(at, boardSize)) throw new Error('INVALID_POSITION: Target is outside the board');

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
            salvoShotsRemaining: 0,
            salvoTotal:  0,
            turnStartedAt: null,
          };
        }

        // Determine next turn
        if (state.salvoMode) {
          const remaining = state.salvoShotsRemaining - 1;
          if (remaining > 0) {
            // Same player fires again
            return {
              ...state,
              players:     newPlayers,
              shotsFired:  newShotsFired,
              currentTurn: ctx.playerId,
              lastShot,
              salvoShotsRemaining: remaining,
              turnStartedAt: state.shotTimerSec > 0 ? Date.now() : state.turnStartedAt,
            };
          }
          // Salvo exhausted — switch turns, compute new salvo for opponent
          const nextSalvo = countSurvivingShips(newPlayers[oppIdx]);
          return {
            ...state,
            players:     newPlayers,
            shotsFired:  newShotsFired,
            currentTurn: state.playerIds[oppIdx],
            lastShot,
            salvoShotsRemaining: nextSalvo,
            salvoTotal:  nextSalvo,
            turnStartedAt: state.shotTimerSec > 0 ? Date.now() : null,
          };
        }

        // Non-salvo: Miss → opponent's turn; Hit or Sunk → same player fires again.
        const nextTurnToken: string = result === 'miss'
          ? state.playerIds[oppIdx]
          : ctx.playerId;

        return {
          ...state,
          players:     newPlayers,
          shotsFired:  newShotsFired,
          currentTurn: nextTurnToken,
          lastShot,
          turnStartedAt: state.shotTimerSec > 0 ? Date.now() : state.turnStartedAt,
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

  tick(state: BattleshipState): BattleshipState {
    // No timer or not in playing phase — no-op
    if (state.shotTimerSec === 0 || state.phase !== 'playing' || state.turnStartedAt === null) {
      return state;
    }

    // Check if time expired
    if (Date.now() - state.turnStartedAt < state.shotTimerSec * 1000) {
      return state;
    }

    // Timer expired — fire a random shot for the current player
    const pIdx = state.playerIds.indexOf(state.currentTurn) as 0 | 1;
    const slot: BsSlot = pIdx === 0 ? 'A' : 'B';
    const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
    const boardSize = state.boardSize;

    // Find all unshot cells on opponent's board
    const shotSet = new Set(state.shotsFired[pIdx].map((s) => `${s.at.x},${s.at.y}`));
    const unshotCells: Coord[] = [];
    for (let x = 0; x < boardSize; x++) {
      for (let y = 0; y < boardSize; y++) {
        if (!shotSet.has(`${x},${y}`)) {
          unshotCells.push({ x, y });
        }
      }
    }

    if (unshotCells.length === 0) return state;

    const target = unshotCells[Math.floor(Math.random() * unshotCells.length)];

    // Execute the shot inline
    const oppPlayer = state.players[oppIdx];

    let hitShip: BattleshipShip | null = null;
    for (const ship of oppPlayer.ships) {
      if ((ship.cells ?? []).some((c) => coordEq(c, target))) { hitShip = ship; break; }
    }

    const result = hitShip ? 'hit' : 'miss';
    let sunkShipId: ShipId | null = null;

    const newOppShips = oppPlayer.ships.map((ship): BattleshipShip => {
      if (ship.id !== hitShip?.id) return ship;
      const newHits = [...(ship.hits ?? []), target];
      const sunk = newHits.length === (ship.cells?.length ?? 0);
      if (sunk) sunkShipId = ship.id;
      return { ...ship, hits: newHits, sunk };
    });

    const newOppPlayer: BsPlayerState = { ...oppPlayer, ships: newOppShips };
    const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
    newPlayers[oppIdx] = newOppPlayer;

    const shotRecord: ShotRecord = { at: target, result, sunkShipId, shipId: hitShip?.id ?? null };

    const newShotsFired: [ShotRecord[], ShotRecord[]] = [
      [...state.shotsFired[0]],
      [...state.shotsFired[1]],
    ];
    newShotsFired[pIdx] = [...newShotsFired[pIdx], shotRecord];

    const lastShot = { ...shotRecord, by: slot };

    // Win check
    if (newOppShips.every((s) => s.sunk)) {
      return {
        ...state,
        players:    newPlayers,
        shotsFired: newShotsFired,
        lastShot,
        phase:      'finished',
        status:     'win',
        winner:     slot,
        salvoShotsRemaining: 0,
        salvoTotal:  0,
        turnStartedAt: null,
      };
    }

    // Determine next turn after forced shot
    if (state.salvoMode) {
      const remaining = state.salvoShotsRemaining - 1;
      if (remaining > 0) {
        return {
          ...state,
          players:     newPlayers,
          shotsFired:  newShotsFired,
          currentTurn: state.currentTurn,
          lastShot,
          salvoShotsRemaining: remaining,
          turnStartedAt: Date.now(),
        };
      }
      // Salvo exhausted — switch turns
      const nextSalvo = countSurvivingShips(newPlayers[oppIdx]);
      return {
        ...state,
        players:     newPlayers,
        shotsFired:  newShotsFired,
        currentTurn: state.playerIds[oppIdx],
        lastShot,
        salvoShotsRemaining: nextSalvo,
        salvoTotal:  nextSalvo,
        turnStartedAt: Date.now(),
      };
    }

    // Non-salvo: hit = same player, miss = switch
    const nextTurnToken = result === 'miss'
      ? state.playerIds[oppIdx]
      : state.currentTurn;

    return {
      ...state,
      players:     newPlayers,
      shotsFired:  newShotsFired,
      currentTurn: nextTurnToken,
      lastShot,
      turnStartedAt: Date.now(),
    };
  },
};
