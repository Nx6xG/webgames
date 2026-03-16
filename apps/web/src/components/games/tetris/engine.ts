// ─────────────────────────────────────────────────────────────────────────────
// Tetris — pure game engine (no React, no side-effects)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Board,
  ClearInfo,
  Piece,
  Rotation,
  TetrisAction,
  TetrisState,
  TetrominoKind,
} from './types';

// ── Constants ────────────────────────────────────────────────────────────────

export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

/** Colour index (1-7) assigned to each kind — matches CSS class index. */
export const KIND_INDEX: Record<TetrominoKind, number> = {
  I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7,
};

/**
 * Piece matrices for every (kind, rotation) pair.
 * Each entry is a flat array of [col, row] pairs relative to a 4×4 bounding box
 * whose top-left is at the piece's (x, y) on the board.
 *
 * Rotations:  0 = spawn, 1 = CW, 2 = 180°, 3 = CCW.
 */
const SHAPES: Record<TetrominoKind, [number, number][][]> = {
  //          0        1        2        3
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  T: [
    [[0,1],[1,0],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[0,1],[1,0],[1,1],[1,2]],
  ],
  S: [
    [[0,1],[1,1],[1,0],[2,0]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[0,2],[1,2],[1,1],[2,1]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[1,1],[1,2],[2,0],[2,1]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[0,1],[0,2],[1,0],[1,1]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,0]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[0,2],[1,0],[1,1],[1,2]],
  ],
  L: [
    [[0,1],[1,1],[2,0],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[0,2],[1,1],[2,1]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};

/**
 * SRS-style wall-kick offset table for non-I pieces.
 * Indexed by [fromRot][kickIndex] → [dx, dy].
 * We try kicks in order until one succeeds.
 */
const KICKS_NORMAL: Record<number, [number, number][]> = {
  0: [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1]],
  1: [[0,0],[1,0],[-1,0],[0,1],[1,1],[-1,1]],
  2: [[0,0],[1,0],[-1,0],[0,1],[1,1],[-1,1]],
  3: [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1]],
};

/** Extended kicks for the I piece (wider bounding box). */
const KICKS_I: Record<number, [number, number][]> = {
  0: [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  1: [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  2: [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  3: [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
};

// ── Board helpers ─────────────────────────────────────────────────────────────

/** Returns a fresh 20×10 board filled with zeros. */
export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(0));
}

/** Deep-copy the board (only copies cell values — rows are number[]). */
function copyBoard(board: Board): Board {
  return board.map(row => [...row]);
}

// ── Bag randomiser ────────────────────────────────────────────────────────────

const ALL_KINDS: TetrominoKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Fisher-Yates shuffle — returns new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns a fresh shuffled 7-bag. */
export function newBag(): TetrominoKind[] {
  return shuffle(ALL_KINDS);
}

/**
 * Pulls pieces from `bag` into `nextQueue` until queue length ≥ 5.
 * Refills the bag automatically when it runs out.
 * Returns updated (queue, bag) — does NOT mutate inputs.
 */
export function refillQueue(
  nextQueue: TetrominoKind[],
  bag: TetrominoKind[],
): { nextQueue: TetrominoKind[]; bag: TetrominoKind[] } {
  const q = [...nextQueue];
  let b = [...bag];
  while (q.length < 5) {
    if (b.length === 0) b = newBag();
    q.push(b.shift()!);
  }
  return { nextQueue: q, bag: b };
}

// ── Piece geometry ────────────────────────────────────────────────────────────

/**
 * Returns the board cells occupied by `piece`.
 * Each cell is { col, row } in absolute board coordinates.
 */
export function getCellsForPiece(piece: Piece): { col: number; row: number }[] {
  return SHAPES[piece.kind][piece.rot].map(([dc, dr]) => ({
    col: piece.x + dc,
    row: piece.y + dr,
  }));
}

/** True if any cell in `piece` is out-of-bounds or overlaps a filled cell. */
export function collides(board: Board, piece: Piece): boolean {
  for (const { col, row } of getCellsForPiece(piece)) {
    if (col < 0 || col >= BOARD_COLS) return true;
    if (row >= BOARD_ROWS) return true;
    // Cells above the visible board (row < 0) are allowed for spawn/rotation
    if (row >= 0 && board[row][col] !== 0) return true;
  }
  return false;
}

/** Returns the spawn piece for a given kind (standard spawn position). */
export function spawnKind(kind: TetrominoKind): Piece {
  // Centre horizontally; I and O start slightly different
  const x = kind === 'O' ? 3 : kind === 'I' ? 3 : 3;
  return { kind, rot: 0, x, y: 0 };
}

/**
 * Attempt to move `piece` by (dx, dy).
 * Returns the shifted piece, or null if it would collide.
 */
export function tryMove(
  board: Board,
  piece: Piece,
  dx: number,
  dy: number,
): Piece | null {
  const moved: Piece = { ...piece, x: piece.x + dx, y: piece.y + dy };
  return collides(board, moved) ? null : moved;
}

/**
 * Attempt to rotate `piece` by `dir` (+1 = CW, -1 = CCW).
 * Tests SRS-style wall-kick offsets in order; returns the first valid result.
 */
export function tryRotate(
  board: Board,
  piece: Piece,
  dir: 1 | -1,
): Piece | null {
  const fromRot = piece.rot;
  const toRot = ((piece.rot + dir + 4) % 4) as Rotation;
  const rotated: Piece = { ...piece, rot: toRot };
  const kicks = piece.kind === 'I' ? KICKS_I : KICKS_NORMAL;
  const offsets = kicks[fromRot] ?? [[0, 0]];
  for (const [dx, dy] of offsets) {
    const candidate: Piece = { ...rotated, x: rotated.x + dx, y: rotated.y + dy };
    if (!collides(board, candidate)) return candidate;
  }
  return null;
}

/** How many cells the piece can fall before it collides. */
export function hardDropDistance(board: Board, piece: Piece): number {
  let dist = 0;
  while (tryMove(board, piece, 0, dist + 1) !== null) dist++;
  return dist;
}

// ── Lock + line clear ─────────────────────────────────────────────────────────

/** Merge `cells` into `board` using the piece's colour index. Returns new board. */
function placePiece(board: Board, piece: Piece): Board {
  const b = copyBoard(board);
  const idx = KIND_INDEX[piece.kind];
  for (const { col, row } of getCellsForPiece(piece)) {
    if (row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS) {
      b[row][col] = idx;
    }
  }
  return b;
}

/** Removes full rows, shifts remaining rows down. Returns new board + count. */
export function clearLines(board: Board): { board: Board; linesCleared: number; clearedRows: number[] } {
  const clearedRows: number[] = [];
  const kept: number[][] = [];
  for (let r = 0; r < board.length; r++) {
    if (board[r].every(cell => cell !== 0)) {
      clearedRows.push(r);
    } else {
      kept.push(board[r]);
    }
  }
  const linesCleared = clearedRows.length;
  if (linesCleared === 0) return { board, linesCleared: 0, clearedRows: [] };
  const empty = Array.from({ length: linesCleared }, () => Array(BOARD_COLS).fill(0));
  return { board: [...empty, ...kept], linesCleared, clearedRows };
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const BASE_SCORE: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };

/** Score for clearing `n` lines at the given level. */
export function scoreForClear(n: number, level: number): number {
  return (BASE_SCORE[n] ?? 0) * (level + 1);
}

/** Level based on total lines cleared. */
export function updateLevel(totalLines: number): number {
  return Math.floor(totalLines / 10);
}

// ── State factories ───────────────────────────────────────────────────────────

/**
 * Spawn a new piece from the front of the queue.
 * Returns the updated state or sets status='gameover' if spawn collides.
 */
function spawnNext(state: TetrisState): TetrisState {
  // Pull next kind from the queue
  const [kind, ...remaining] = state.nextQueue;
  const { nextQueue, bag } = refillQueue(remaining, state.bag);
  const active = spawnKind(kind);
  const status: TetrisState['status'] =
    collides(state.board, active) ? 'gameover' : state.status;
  return { ...state, active, nextQueue, bag, canHold: true, status };
}

/**
 * Lock the active piece into the board, clear lines, update score/level,
 * and spawn the next piece.
 */
function lockAndSpawn(state: TetrisState): TetrisState {
  // Place the piece
  const boardAfterPlace = placePiece(state.board, state.active);
  // Clear full lines
  const { board, linesCleared, clearedRows } = clearLines(boardAfterPlace);
  // Update totals
  const scoreGained = scoreForClear(linesCleared, state.level);
  const newLines = state.lines + linesCleared;
  const newLevel = updateLevel(newLines);
  const lastClear: ClearInfo | undefined =
    linesCleared > 0 ? { linesCleared, scoreGained, clearedRows } : undefined;

  const updated: TetrisState = {
    ...state,
    board,
    score: state.score + scoreGained,
    lines: newLines,
    level: newLevel,
    lastClear,
  };
  // Spawn the next piece (may trigger gameover)
  return spawnNext(updated);
}

/**
 * Creates a fresh game state with a filled queue and the first piece spawned.
 * Status is 'countdown' — the UI drives the countdown, then dispatches 'tick'
 * or player actions to transition to 'running'.
 */
export function createInitialState(): TetrisState {
  const board = createEmptyBoard();
  let bag = newBag();
  const queue1 = refillQueue([], bag);
  bag = queue1.bag;
  const { nextQueue } = refillQueue(queue1.nextQueue, bag);
  // Pull the first kind for active piece
  const [firstKind, ...remaining] = nextQueue;
  const filledQ = refillQueue(remaining, bag);

  const active = spawnKind(firstKind);

  return {
    board,
    active,
    holdKind: undefined,
    canHold: true,
    nextQueue: filledQ.nextQueue,
    bag: filledQ.bag,
    score: 0,
    lines: 0,
    level: 0,
    status: 'menu',
    lastClear: undefined,
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

/**
 * Pure state reducer.  Returns a new TetrisState (never mutates the input).
 */
export function reducer(state: TetrisState, action: TetrisAction): TetrisState {
  // Clear any previous clear-toast on every action
  const s: TetrisState = { ...state, lastClear: undefined };

  switch (action.type) {
    // ── Pause / resume ──────────────────────────────────────────────────────
    case 'togglePause': {
      if (s.status === 'running') return { ...s, status: 'paused' };
      if (s.status === 'paused')  return { ...s, status: 'running' };
      // Treat a pause action during countdown as "start" (begin running)
      if (s.status === 'countdown') return { ...s, status: 'running' };
      return s;
    }

    // ── Start game (menu → countdown) ──────────────────────────────────────
    case 'startGame': {
      if (s.status === 'menu') return { ...s, status: 'countdown' };
      return s;
    }

    // ── Restart ─────────────────────────────────────────────────────────────
    case 'restart': {
      const fresh = createInitialState();
      return { ...fresh, status: 'countdown' };
    }

    // ── Ignore inputs when game is not running ──────────────────────────────
    default: {
      if (s.status !== 'running') return s;
    }
  }

  // All remaining cases require status === 'running'
  switch (action.type) {
    // ── Gravity tick ─────────────────────────────────────────────────────────
    case 'tick': {
      const moved = tryMove(s.board, s.active, 0, 1);
      if (moved) return { ...s, active: moved };
      // Cannot move down — lock the piece
      return lockAndSpawn(s);
    }

    // ── Lateral movement ─────────────────────────────────────────────────────
    case 'moveLeft': {
      const moved = tryMove(s.board, s.active, -1, 0);
      return moved ? { ...s, active: moved } : s;
    }
    case 'moveRight': {
      const moved = tryMove(s.board, s.active, 1, 0);
      return moved ? { ...s, active: moved } : s;
    }

    // ── Soft drop (move 1 cell down + +1 score if moved) ────────────────────
    case 'softDrop': {
      const moved = tryMove(s.board, s.active, 0, 1);
      if (moved) return { ...s, active: moved, score: s.score + 1 };
      return lockAndSpawn(s);
    }

    // ── Hard drop (teleport to bottom + +2/cell score, then lock) ───────────
    case 'hardDrop': {
      const dist = hardDropDistance(s.board, s.active);
      const dropped: Piece = { ...s.active, y: s.active.y + dist };
      const bonus = dist * 2;
      return lockAndSpawn({ ...s, active: dropped, score: s.score + bonus });
    }

    // ── Rotation ─────────────────────────────────────────────────────────────
    case 'rotateCW': {
      const rotated = tryRotate(s.board, s.active, 1);
      return rotated ? { ...s, active: rotated } : s;
    }
    case 'rotateCCW': {
      const rotated = tryRotate(s.board, s.active, -1);
      return rotated ? { ...s, active: rotated } : s;
    }

    // ── Hold ─────────────────────────────────────────────────────────────────
    case 'hold': {
      if (!s.canHold) return s;
      const { holdKind, active } = s;

      if (holdKind === undefined) {
        // No previous hold — stash current piece, spawn next
        const withHold: TetrisState = { ...s, holdKind: active.kind, canHold: false };
        return spawnNext(withHold);
      } else {
        // Swap active ↔ hold
        const swapped = spawnKind(holdKind);
        if (collides(s.board, swapped)) return s; // no room — ignore
        return { ...s, active: swapped, holdKind: active.kind, canHold: false };
      }
    }

    default:
      return s;
  }
}
