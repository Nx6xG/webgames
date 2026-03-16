// ─────────────────────────────────────────────────────────────────────────────
// Tetris — types
// ─────────────────────────────────────────────────────────────────────────────

/** 10-wide × 20-tall grid. 0 = empty; 1-7 = filled by piece kind index. */
export type Board = number[][];

/** The seven standard tetrominoes. */
export type TetrominoKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** Rotation state: 0=spawn, 1=CW90, 2=180, 3=CCW90. */
export type Rotation = 0 | 1 | 2 | 3;

/** An active (or held) piece on the board. */
export interface Piece {
  kind: TetrominoKind;
  rot: Rotation;
  /** Column offset (0-based from left edge of board). */
  x: number;
  /** Row offset (0-based from top of board). */
  y: number;
}

/** High-level lifecycle state of the game. */
export type GameStatus = 'menu' | 'countdown' | 'running' | 'paused' | 'gameover';

/** Snapshot of a completed line-clear for toast/animation purposes. */
export interface ClearInfo {
  linesCleared: number;
  scoreGained: number;
  /** Original row indices (before removal) that were cleared. */
  clearedRows: number[];
}

/** Complete game state — everything the UI needs to render one frame. */
export interface TetrisState {
  /** 20 rows × 10 cols — 0=empty, 1-7=filled. */
  board: Board;

  /** The piece currently falling. null only briefly between lock and spawn. */
  active: Piece;

  /** Kind currently in the hold slot (undefined if never held). */
  holdKind?: TetrominoKind;

  /** Whether the player can trigger hold this drop (reset when a new piece spawns). */
  canHold: boolean;

  /**
   * Look-ahead queue — UI shows the first 5.
   * Engine guarantees length ≥ 5 at all times (after every action).
   */
  nextQueue: TetrominoKind[];

  /** Remaining pieces in the current 7-bag. Refilled when empty. */
  bag: TetrominoKind[];

  score: number;
  lines: number;
  level: number;

  status: GameStatus;

  /** Populated after a line clear; cleared on the next action. */
  lastClear?: ClearInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action discriminated union
// ─────────────────────────────────────────────────────────────────────────────

export type TetrisAction =
  | { type: 'tick' }
  | { type: 'moveLeft' }
  | { type: 'moveRight' }
  | { type: 'softDrop' }
  | { type: 'hardDrop' }
  | { type: 'rotateCW' }
  | { type: 'rotateCCW' }
  | { type: 'hold' }
  | { type: 'togglePause' }
  | { type: 'restart' }
  | { type: 'startGame' };
