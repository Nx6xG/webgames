import type { Grid, Tile, Direction, GameState } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const GRID_SIZE = 4;
export const WIN_TILE  = 2048;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a brand-new GameState with two tiles already placed.
 * Pass a `best` value to carry the all-time best score across sessions.
 */
export function createInitialState(best = 0): GameState {
  let grid = emptyGrid();
  const tiles: Tile[] = [];
  let nextId = 1;

  for (let i = 0; i < 2; i++) {
    const result = spawnTileTracked(grid, nextId);
    grid   = result.grid;
    nextId = result.nextId;
    // No pop animation for the two starting tiles.
    if (result.tile) tiles.push({ ...result.tile, isNew: false });
  }

  return { grid, tiles, nextId, score: 0, best, moves: 0, status: 'playing', keepPlaying: false };
}

/**
 * Applies one move and returns a new GameState (always a fresh object).
 *
 * Rules:
 *  - If the board does not change the same state reference is returned (no-op).
 *  - On a valid move: merge tiles, add score, spawn one tile, increment moves.
 *  - Status transitions:
 *      playing → won   if any tile first reaches WIN_TILE and keepPlaying is false
 *      playing → over  if no moves remain after the spawn
 *  - When status is 'won' the player can call move() again only after keepPlaying is true.
 */
export function move(state: GameState, dir: Direction): GameState {
  if (state.status === 'over') return state;
  if (state.status === 'won' && !state.keepPlaying) return state;

  // Build ID grid from current tile positions.
  const idGrid: IdGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (const tile of state.tiles) {
    idGrid[tile.row][tile.col] = tile.id;
  }

  const {
    grid: movedGrid,
    idGrid: movedIdGrid,
    score: gained,
    changed,
    consumedIds,
    mergedIds,
  } = applyMoveWithIds(state.grid, idGrid, dir);

  if (!changed) return state;

  // Build surviving tiles with updated positions.
  const consumedSet = new Set(consumedIds);
  const mergedSet   = new Set(mergedIds);
  const movedTiles: Tile[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const id = movedIdGrid[r][c];
      if (id !== null && !consumedSet.has(id)) {
        movedTiles.push({
          id,
          row:      r,
          col:      c,
          value:    movedGrid[r][c],
          isNew:    false,
          isMerged: mergedSet.has(id),
        });
      }
    }
  }

  // Spawn one new tile.
  const spawned  = spawnTileTracked(movedGrid, state.nextId);
  const newTiles = spawned.tile ? [...movedTiles, spawned.tile] : movedTiles;

  const newScore = state.score + gained;
  const newBest  = Math.max(state.best, newScore);
  const hitWin   = !state.keepPlaying && maxTile(spawned.grid) >= WIN_TILE;
  const blocked  = !hasMovesLeft(spawned.grid);

  let status: GameState['status'] = 'playing';
  if (blocked)                           status = 'over';
  else if (hitWin && !state.keepPlaying) status = 'won';

  return {
    grid:        spawned.grid,
    tiles:       newTiles,
    nextId:      spawned.nextId,
    score:       newScore,
    best:        newBest,
    moves:       state.moves + 1,
    status,
    keepPlaying: state.keepPlaying,
  };
}

/**
 * Dismisses the "You win" overlay and lets the player continue past 2048.
 */
export function keepPlaying(state: GameState): GameState {
  return {
    ...state,
    status:      'playing',
    keepPlaying: true,
    // Clear animation flags so subsequent moves start clean.
    tiles: state.tiles.map(t => ({ ...t, isNew: false, isMerged: false })),
  };
}

// ── Grid helpers (also exported for UI use) ───────────────────────────────────

export function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0) as number[]);
}

export function cloneGrid(g: Grid): Grid {
  return g.map(row => [...row]);
}

export function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

export function maxTile(g: Grid): number {
  return Math.max(...g.flatMap(row => row));
}

// ── Spawn (legacy value-only export kept for compat) ──────────────────────────

/** Returns a new grid with one random tile placed (90 % → 2, 10 % → 4). */
export function spawnTile(g: Grid): Grid {
  return spawnTileTracked(g, -1).grid;
}

// ── Move logic (value-only, still exported) ───────────────────────────────────

interface MoveResult {
  grid:    Grid;
  score:   number;
  changed: boolean;
}

/** Applies a directional slide+merge on a raw grid (no tile ID tracking). */
export function applyMove(grid: Grid, dir: Direction): MoveResult {
  let g = cloneGrid(grid);
  let totalScore = 0;

  if (dir === 'right') g = g.map(row => [...row].reverse());
  if (dir === 'up')    g = transpose(g);
  if (dir === 'down')  g = transpose(g).map(row => [...row].reverse());

  const slid = g.map(row => {
    const { row: r, score } = slideRow(row);
    totalScore += score;
    return r;
  });

  let result: Grid;
  if      (dir === 'right') result = slid.map(row => [...row].reverse());
  else if (dir === 'up')    result = transpose(slid);
  else if (dir === 'down')  result = transpose(slid.map(row => [...row].reverse()));
  else                      result = slid;

  return { grid: result, score: totalScore, changed: !gridsEqual(grid, result) };
}

// ── Game-over detection ───────────────────────────────────────────────────────

/** Returns true if at least one move is still possible on this grid. */
export function hasMovesLeft(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c + 1 < GRID_SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < GRID_SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

// ── Internal ──────────────────────────────────────────────────────────────────

type IdGrid = (number | null)[][];

/** Spawn a tile and return updated grid, the tile object, and next ID. */
function spawnTileTracked(
  grid:   Grid,
  nextId: number,
): { grid: Grid; tile: Tile | null; nextId: number } {
  const empties: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === 0) empties.push([r, c]);

  if (empties.length === 0) return { grid, tile: null, nextId };

  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const value  = Math.random() < 0.9 ? 2 : 4;
  const newGrid = cloneGrid(grid);
  newGrid[r][c] = value;
  const tile: Tile = { id: nextId, row: r, col: c, value, isNew: true, isMerged: false };
  return { grid: newGrid, tile, nextId: nextId + 1 };
}

/**
 * Applies a directional slide+merge tracking tile IDs through the operation.
 * All four directions are normalised to a leftward slide via rotation,
 * then the inverse rotation is applied to the result.
 */
function applyMoveWithIds(
  grid:   Grid,
  idGrid: IdGrid,
  dir:    Direction,
): {
  grid:        Grid;
  idGrid:      IdGrid;
  score:       number;
  changed:     boolean;
  consumedIds: number[];
  mergedIds:   number[];
} {
  let g   = cloneGrid(grid);
  let ids = cloneIdGrid(idGrid);

  if (dir === 'right') { g = g.map(r => [...r].reverse());              ids = ids.map(r => [...r].reverse()); }
  if (dir === 'up')    { g = transpose(g);                              ids = transposeIds(ids); }
  if (dir === 'down')  { g = transpose(g).map(r => [...r].reverse());   ids = transposeIds(ids).map(r => [...r].reverse()); }

  let totalScore = 0;
  const allConsumed: number[] = [];
  const allMerged:   number[] = [];
  const slidG:   Grid   = [];
  const slidIds: IdGrid = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    const res = slideRowWithIds(g[r], ids[r]);
    slidG.push(res.values);
    slidIds.push(res.tileIds);
    totalScore       += res.score;
    allConsumed.push(...res.consumed);
    allMerged.push(...res.merged);
  }

  let finalG:   Grid;
  let finalIds: IdGrid;

  if      (dir === 'right') { finalG = slidG.map(r => [...r].reverse());              finalIds = slidIds.map(r => [...r].reverse()); }
  else if (dir === 'up')    { finalG = transpose(slidG);                              finalIds = transposeIds(slidIds); }
  else if (dir === 'down')  { finalG = transpose(slidG.map(r => [...r].reverse()));   finalIds = transposeIds(slidIds.map(r => [...r].reverse())); }
  else                      { finalG = slidG; finalIds = slidIds; }

  return {
    grid:        finalG,
    idGrid:      finalIds,
    score:       totalScore,
    changed:     !gridsEqual(grid, finalG),
    consumedIds: allConsumed,
    mergedIds:   allMerged,
  };
}

/** Slide and merge one row leftward, tracking tile IDs through merges. */
function slideRowWithIds(
  values: number[],
  ids:    (number | null)[],
): { values: number[]; tileIds: (number | null)[]; score: number; consumed: number[]; merged: number[] } {
  const active: { id: number; value: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== 0) active.push({ id: ids[i]!, value: values[i] });
  }

  let score = 0;
  const consumed: number[] = [];
  const merged:   number[] = [];

  for (let i = 0; i < active.length - 1; i++) {
    if (active[i].value === active[i + 1].value) {
      active[i].value *= 2;
      score += active[i].value;
      consumed.push(active[i + 1].id);
      merged.push(active[i].id);
      active.splice(i + 1, 1);
    }
  }

  const outValues: number[]          = active.map(t => t.value);
  const outIds:    (number | null)[] = active.map(t => t.id);
  while (outValues.length < GRID_SIZE) { outValues.push(0); outIds.push(null); }
  return { values: outValues, tileIds: outIds, score, consumed, merged };
}

/** Value-only row slide (used by the legacy applyMove export). */
function slideRow(row: number[]): { row: number[]; score: number } {
  const tiles = row.filter(v => v !== 0);
  let score = 0;
  for (let i = 0; i < tiles.length - 1; i++) {
    if (tiles[i] === tiles[i + 1]) {
      tiles[i] *= 2;
      score += tiles[i];
      tiles.splice(i + 1, 1);
    }
  }
  while (tiles.length < GRID_SIZE) tiles.push(0);
  return { row: tiles, score };
}

function transpose(g: Grid): Grid {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (__, c) => g[c][r]),
  );
}

function cloneIdGrid(g: IdGrid): IdGrid {
  return g.map(row => [...row]);
}

function transposeIds(g: IdGrid): IdGrid {
  return Array.from({ length: GRID_SIZE }, (_, r) =>
    Array.from({ length: GRID_SIZE }, (__, c) => g[c][r]),
  );
}
