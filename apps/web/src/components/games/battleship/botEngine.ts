import type {
  BattleshipState, BattleshipAction, BsPlayerState, BattleshipShip,
  ShipDef, Coord, Orientation, ShotRecord, BsSlot,
} from 'shared';
import { FLEET_PRESETS } from 'shared';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function countSurviving(player: BsPlayerState): number {
  return player.ships.filter(s => !s.sunk).length;
}

// ── Auto place (same as server) ────────────────────────────────────────────────

export function autoPlaceShips(shipDefs: readonly ShipDef[], boardSize: number): BattleshipShip[] {
  for (let attempt = 0; attempt < 20; attempt++) {
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
        if (!cells.every(c => inBounds(c, boardSize))) continue;
        const occupied = placed.flatMap(s => s.cells ?? []);
        if (cells.some(c => occupied.some(o => coordEq(c, o)))) continue;
        placed.push({ id: def.id, cells, hits: [], sunk: false });
        success = true;
        break;
      }
      if (!success) { failed = true; break; }
    }
    if (!failed) return placed;
  }
  throw new Error('AUTO_PLACE_FAILED');
}

// ── Initial state ──────────────────────────────────────────────────────────────

export function createInitialState(config: {
  fleetPreset: string;
  boardSize: number;
  salvoMode: boolean;
  shotTimerSec: number;
}): BattleshipState {
  const requestedPreset = config.fleetPreset ?? 'random';
  const preset = requestedPreset === 'random'
    ? FLEET_PRESETS[Math.floor(Math.random() * FLEET_PRESETS.length)]
    : FLEET_PRESETS.find(p => p.id === requestedPreset) ?? FLEET_PRESETS[0];

  return {
    phase: 'setup',
    playerIds: ['human', 'bot'],
    players: [{ ships: [], ready: false }, { ships: [], ready: false }],
    shotsFired: [[], []],
    currentTurn: 'human',
    winner: null,
    lastShot: null,
    status: 'ongoing',
    shipDefs: [...preset.ships],
    fleetId: preset.id,
    boardSize: config.boardSize,
    salvoMode: config.salvoMode,
    salvoShotsRemaining: 0,
    salvoTotal: 0,
    shotTimerSec: 0, // no timer in bot mode
    turnStartedAt: null,
  };
}

// ── Apply action (client-side, for human actions) ──────────────────────────────

export function applyAction(state: BattleshipState, action: BattleshipAction, actor: 'human' | 'bot'): BattleshipState {
  const pIdx = actor === 'human' ? 0 : 1;
  const slot: BsSlot = pIdx === 0 ? 'A' : 'B';
  const boardSize = state.boardSize;
  const shipDefs = state.shipDefs;

  switch (action.type) {
    case 'BS_PLACE_SHIP': {
      if (state.phase !== 'setup') throw new Error('INVALID_ACTION');
      if (state.players[pIdx].ready) throw new Error('INVALID_ACTION');
      const def = shipDefs.find(d => d.id === action.shipId);
      if (!def) throw new Error('INVALID_ACTION');
      const cells = shipCells(action.origin, action.orientation, def.length);
      if (!cells.every(c => inBounds(c, boardSize))) throw new Error('INVALID_POSITION');
      const others = state.players[pIdx].ships.filter(s => s.id !== action.shipId);
      const occupied = others.flatMap(s => s.cells ?? []);
      if (cells.some(c => occupied.some(o => coordEq(c, o)))) throw new Error('INVALID_POSITION');
      const newShip: BattleshipShip = { id: action.shipId, cells, hits: [], sunk: false };
      const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
      newPlayers[pIdx] = { ...state.players[pIdx], ships: [...others, newShip] };
      return { ...state, players: newPlayers };
    }
    case 'BS_RESET_PLACEMENT': {
      if (state.phase !== 'setup') throw new Error('INVALID_ACTION');
      if (state.players[pIdx].ready) throw new Error('INVALID_ACTION');
      const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
      newPlayers[pIdx] = { ships: [], ready: false };
      return { ...state, players: newPlayers };
    }
    case 'BS_AUTO_PLACE': {
      if (state.phase !== 'setup') throw new Error('INVALID_ACTION');
      if (state.players[pIdx].ready) throw new Error('INVALID_ACTION');
      const ships = autoPlaceShips(shipDefs, boardSize);
      const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
      newPlayers[pIdx] = { ...state.players[pIdx], ships };
      return { ...state, players: newPlayers };
    }
    case 'BS_READY': {
      if (state.phase !== 'setup') throw new Error('INVALID_ACTION');
      if (state.players[pIdx].ready) throw new Error('INVALID_ACTION');
      if (state.players[pIdx].ships.length < shipDefs.length) throw new Error('INVALID_ACTION');
      const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
      newPlayers[pIdx] = { ...state.players[pIdx], ready: true };
      const bothReady = newPlayers[0].ready && newPlayers[1].ready;
      if (bothReady) {
        const firstIdx = 0; // human always goes first
        const salvoCount = state.salvoMode ? countSurviving(newPlayers[firstIdx]) : 0;
        return { ...state, players: newPlayers, phase: 'playing', salvoShotsRemaining: salvoCount, salvoTotal: salvoCount, turnStartedAt: null };
      }
      return { ...state, players: newPlayers };
    }
    case 'BS_FIRE': {
      return applyFire(state, action.at, pIdx, slot);
    }
    default:
      throw new Error('INVALID_ACTION');
  }
}

function applyFire(state: BattleshipState, at: Coord, pIdx: 0 | 1, slot: BsSlot): BattleshipState {
  const boardSize = state.boardSize;
  if (state.phase !== 'playing') throw new Error('INVALID_ACTION');
  if (!inBounds(at, boardSize)) throw new Error('INVALID_POSITION');
  if (state.shotsFired[pIdx].some(s => coordEq(s.at, at))) throw new Error('CELL_TAKEN');

  const oppIdx: 0 | 1 = pIdx === 0 ? 1 : 0;
  const oppPlayer = state.players[oppIdx];

  let hitShip: BattleshipShip | null = null;
  for (const ship of oppPlayer.ships) {
    if ((ship.cells ?? []).some(c => coordEq(c, at))) { hitShip = ship; break; }
  }

  const result = hitShip ? 'hit' : 'miss';
  let sunkShipId: string | null = null;

  const newOppShips = oppPlayer.ships.map((ship): BattleshipShip => {
    if (ship.id !== hitShip?.id) return ship;
    const newHits = [...(ship.hits ?? []), at];
    const sunk = newHits.length === (ship.cells?.length ?? 0);
    if (sunk) sunkShipId = ship.id;
    return { ...ship, hits: newHits, sunk };
  });

  const newPlayers: [BsPlayerState, BsPlayerState] = [state.players[0], state.players[1]];
  newPlayers[oppIdx] = { ...oppPlayer, ships: newOppShips };

  const shotRecord: ShotRecord = { at, result, sunkShipId, shipId: hitShip?.id ?? null };
  const newShotsFired: [ShotRecord[], ShotRecord[]] = [[...state.shotsFired[0]], [...state.shotsFired[1]]];
  newShotsFired[pIdx] = [...newShotsFired[pIdx], shotRecord];
  const lastShot = { ...shotRecord, by: slot };

  // Win?
  if (newOppShips.every(s => s.sunk)) {
    return { ...state, players: newPlayers, shotsFired: newShotsFired, lastShot, phase: 'finished', status: 'win', winner: slot, salvoShotsRemaining: 0, salvoTotal: 0, turnStartedAt: null };
  }

  // Next turn
  if (state.salvoMode) {
    const remaining = state.salvoShotsRemaining - 1;
    if (remaining > 0) {
      return { ...state, players: newPlayers, shotsFired: newShotsFired, lastShot, salvoShotsRemaining: remaining, turnStartedAt: null };
    }
    const nextSalvo = countSurviving(newPlayers[oppIdx]);
    return { ...state, players: newPlayers, shotsFired: newShotsFired, currentTurn: state.playerIds[oppIdx], lastShot, salvoShotsRemaining: nextSalvo, salvoTotal: nextSalvo, turnStartedAt: null };
  }

  const nextTurnToken = result === 'miss' ? state.playerIds[oppIdx] : state.playerIds[pIdx];
  return { ...state, players: newPlayers, shotsFired: newShotsFired, currentTurn: nextTurnToken, lastShot, turnStartedAt: null };
}

// ── Bot AI ─────────────────────────────────────────────────────────────────────

interface BotMemory {
  /** Cells hit but not yet sunk */
  hitStack: Coord[];
  /** Cells already tried around a hit (to avoid re-trying) */
  triedAround: Set<string>;
}

function coordKey(c: Coord): string { return `${c.x},${c.y}`; }

const DIRS: Coord[] = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

export function getBotShot(
  state: BattleshipState,
  difficulty: BotDifficulty,
  memory: BotMemory,
): Coord {
  const boardSize = state.boardSize;
  const botIdx = 1;
  const shotSet = new Set(state.shotsFired[botIdx].map(s => coordKey(s.at)));

  // Remove sunk ship cells from hitStack
  const sunkIds = new Set(state.shotsFired[botIdx].filter(s => s.sunkShipId).map(s => s.sunkShipId));
  // When a ship sinks, remove all its hits from hitStack
  const sunkHitCoords = new Set(
    state.shotsFired[botIdx]
      .filter(s => s.shipId && sunkIds.has(s.shipId))
      .map(s => coordKey(s.at))
  );
  memory.hitStack = memory.hitStack.filter(c => !sunkHitCoords.has(coordKey(c)));

  // === EASY: random shots (with slight preference for checkerboard) ===
  if (difficulty === 'easy') {
    return randomShot(boardSize, shotSet);
  }

  // === MEDIUM & HARD: hunt/target ===
  // If we have unsunk hits, target around them
  if (memory.hitStack.length > 0) {
    // Try to find a line direction from multiple hits
    const target = findTargetShot(memory, boardSize, shotSet, state, difficulty);
    if (target) return target;
  }

  // Hunt mode
  if (difficulty === 'hard') {
    return probabilityShot(state, boardSize, shotSet);
  }

  return checkerboardShot(boardSize, shotSet);
}

function randomShot(boardSize: number, shotSet: Set<string>): Coord {
  const unshot: Coord[] = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      if (!shotSet.has(`${x},${y}`)) unshot.push({ x, y });
    }
  }
  return unshot[Math.floor(Math.random() * unshot.length)];
}

function checkerboardShot(boardSize: number, shotSet: Set<string>): Coord {
  // Prefer checkerboard pattern (every other cell) for efficiency
  const primary: Coord[] = [];
  const secondary: Coord[] = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      if (shotSet.has(`${x},${y}`)) continue;
      if ((x + y) % 2 === 0) primary.push({ x, y });
      else secondary.push({ x, y });
    }
  }
  const pool = primary.length > 0 ? primary : secondary;
  return pool[Math.floor(Math.random() * pool.length)];
}

function probabilityShot(state: BattleshipState, boardSize: number, shotSet: Set<string>): Coord {
  // Calculate probability density for each cell based on remaining ships
  const oppShips = state.players[0].ships; // opponent is human (index 0)
  const remainingLengths = oppShips.filter(s => !s.sunk).map(s => (s.cells?.length ?? 0));

  const density: number[][] = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));

  for (const len of remainingLengths) {
    for (let x = 0; x < boardSize; x++) {
      for (let y = 0; y < boardSize; y++) {
        // Try horizontal
        if (x + len <= boardSize) {
          let valid = true;
          for (let i = 0; i < len; i++) {
            const key = `${x + i},${y}`;
            const shot = state.shotsFired[1].find(s => coordKey(s.at) === key);
            if (shot && shot.result === 'miss') { valid = false; break; }
          }
          if (valid) {
            for (let i = 0; i < len; i++) {
              if (!shotSet.has(`${x + i},${y}`)) density[y][x + i]++;
            }
          }
        }
        // Try vertical
        if (y + len <= boardSize) {
          let valid = true;
          for (let i = 0; i < len; i++) {
            const key = `${x},${y + i}`;
            const shot = state.shotsFired[1].find(s => coordKey(s.at) === key);
            if (shot && shot.result === 'miss') { valid = false; break; }
          }
          if (valid) {
            for (let i = 0; i < len; i++) {
              if (!shotSet.has(`${x},${y + i}`)) density[y + i][x]++;
            }
          }
        }
      }
    }
  }

  // Find max density cell
  let bestScore = -1;
  let bestCells: Coord[] = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      if (shotSet.has(`${x},${y}`)) continue;
      if (density[y][x] > bestScore) {
        bestScore = density[y][x];
        bestCells = [{ x, y }];
      } else if (density[y][x] === bestScore) {
        bestCells.push({ x, y });
      }
    }
  }

  return bestCells[Math.floor(Math.random() * bestCells.length)] ?? randomShot(boardSize, shotSet);
}

function findTargetShot(
  memory: BotMemory,
  boardSize: number,
  shotSet: Set<string>,
  state: BattleshipState,
  difficulty: BotDifficulty,
): Coord | null {
  const hits = memory.hitStack;

  // If multiple hits, try to determine line direction
  if (hits.length >= 2) {
    const isHorizontal = hits[0].y === hits[1].y;
    const isVertical = hits[0].x === hits[1].x;

    if (isHorizontal || isVertical) {
      // Extend the line in both directions
      const sorted = isHorizontal
        ? [...hits].sort((a, b) => a.x - b.x)
        : [...hits].sort((a, b) => a.y - b.y);

      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      // Try extending after the last hit
      const after: Coord = isHorizontal
        ? { x: last.x + 1, y: last.y }
        : { x: last.x, y: last.y + 1 };
      if (inBounds(after, boardSize) && !shotSet.has(coordKey(after))) return after;

      // Try extending before the first hit
      const before: Coord = isHorizontal
        ? { x: first.x - 1, y: first.y }
        : { x: first.x, y: first.y - 1 };
      if (inBounds(before, boardSize) && !shotSet.has(coordKey(before))) return before;
    }
  }

  // Try adjacent cells around any hit
  for (const hit of hits) {
    const shuffledDirs = [...DIRS].sort(() => Math.random() - 0.5);
    for (const d of shuffledDirs) {
      const target: Coord = { x: hit.x + d.x, y: hit.y + d.y };
      const key = coordKey(target);
      if (!inBounds(target, boardSize)) continue;
      if (shotSet.has(key)) continue;
      if (memory.triedAround.has(`${coordKey(hit)}->${key}`)) continue;
      memory.triedAround.add(`${coordKey(hit)}->${key}`);
      return target;
    }
  }

  // All adjacent cells tried, clear hitStack (ship might be fully hit but counted wrong)
  memory.hitStack = [];
  memory.triedAround.clear();
  return null;
}

export function createBotMemory(): BotMemory {
  return { hitStack: [], triedAround: new Set() };
}

export function updateBotMemory(memory: BotMemory, shot: ShotRecord): void {
  if (shot.result === 'hit') {
    memory.hitStack.push(shot.at);
  }
  if (shot.sunkShipId) {
    // Remove all hits belonging to the sunk ship
    const sunkId = shot.sunkShipId;
    // We don't know exact cells, but the ship is sunk so clear related hits
    // Actually we have the shipId on each shot record, so filter by that
    memory.hitStack = memory.hitStack.filter(c => {
      // Keep hits that don't belong to the sunk ship — but we don't know which hits belong to which ship from memory alone
      // Simple approach: clear all hits (safe, just slightly less efficient)
      return false;
    });
    memory.triedAround.clear();
  }
}
