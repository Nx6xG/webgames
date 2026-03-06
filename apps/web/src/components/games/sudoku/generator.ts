import type { Board, Difficulty } from './types';

// ── Internal helpers ──────────────────────────────────────────────────────────

type RngFn = () => number;

function shuffle<T>(arr: T[], rng: RngFn = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isValid(board: Board, r: number, c: number, n: number): boolean {
  // Row check
  if (board[r].includes(n)) return false;
  // Column check
  for (let i = 0; i < 9; i++) {
    if (board[i][c] === n) return false;
  }
  // 3×3 box check
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      if (board[i][j] === n) return false;
    }
  }
  return true;
}

/** Fills an empty board with a random valid solution using backtracking. */
function fillBoard(board: Board, rng: RngFn): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
        for (const n of nums) {
          if (isValid(board, r, c, n)) {
            board[r][c] = n;
            if (fillBoard(board, rng)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true; // no empty cells — board is complete
}

export function generateSolvedBoard(rng: RngFn = Math.random): Board {
  const board: Board = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillBoard(board, rng);
  return board;
}

// ── Solution counter ──────────────────────────────────────────────────────────

/**
 * Count distinct solutions for `board`, stopping as soon as the count exceeds
 * `limit` (default 2) for early-exit efficiency.
 * Returns 0, 1, or >1 (stops counting once >1 is known).
 */
export function countSolutions(board: Board, limit = 2): number {
  // Work on a copy so the original is not mutated
  const copy: Board = board.map(row => [...row]);
  let count = 0;

  function backtrack(): void {
    if (count >= limit) return;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (copy[r][c] === 0) {
          for (let n = 1; n <= 9; n++) {
            if (count >= limit) return;
            if (isValid(copy, r, c, n)) {
              copy[r][c] = n;
              backtrack();
              copy[r][c] = 0;
            }
          }
          return; // no valid number — dead end
        }
      }
    }
    count++; // all cells filled
  }

  backtrack();
  return count;
}

// ── Puzzle creator ────────────────────────────────────────────────────────────

/** Number of cells to remove per difficulty (81 total cells). */
const REMOVE_COUNTS: Record<Difficulty, number> = {
  easy:   41, // ~40 prefilled
  medium: 49, // ~32 prefilled
  hard:   55, // ~26 prefilled
  expert: 59, // ~22 prefilled
};

/**
 * Remove cells from a solved board one by one, verifying unique solution after
 * each removal.  Returns a puzzle board (0 = empty cell).
 */
export function createPuzzle(solved: Board, difficulty: Difficulty, rng: RngFn = Math.random): Board {
  const puzzle: Board = solved.map(row => [...row]);
  const positions     = shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
  const target        = REMOVE_COUNTS[difficulty];
  let removed         = 0;

  for (const idx of positions) {
    if (removed >= target) break;
    const r      = Math.floor(idx / 9);
    const c      = idx % 9;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    if (countSolutions(puzzle) === 1) {
      removed++;
    } else {
      puzzle[r][c] = backup; // restore — would create multiple solutions
    }
  }

  return puzzle;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateSudoku(difficulty: Difficulty, rng?: RngFn): { puzzle: Board; solution: Board } {
  const solution = generateSolvedBoard(rng);
  const puzzle   = createPuzzle(solution, difficulty, rng);
  return { puzzle, solution };
}
