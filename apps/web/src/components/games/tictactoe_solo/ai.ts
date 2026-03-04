import type { Board, Difficulty, Mark } from './types';

// ── Win-line table ─────────────────────────────────────────────────────────────

export const WIN_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

/** Returns the winning line indices if `mark` has won, otherwise null. */
export function checkWinner(board: Board, mark: Mark): number[] | null {
  for (const line of WIN_LINES) {
    if (line.every(i => board[i] === mark)) return [...line];
  }
  return null;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function hasWon(board: Board, mark: Mark): boolean {
  return WIN_LINES.some(line => line.every(i => board[i] === mark));
}

function emptyIndices(board: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) out.push(i);
  }
  return out;
}

/** Returns the index of a one-move win for `mark`, or -1 if none. */
function findWinMove(board: Board, mark: Mark): number {
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    const b = [...board] as Board;
    b[i] = mark;
    if (hasWon(b, mark)) return i;
  }
  return -1;
}

/**
 * Minimax — maximising player is aiMark, minimising is humanMark.
 * Score: +( 10 − depth ) for AI win (prefer faster wins),
 *        −( 10 − depth ) for human win (prefer slower losses),
 *        0 for draw.
 */
function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  aiMark: Mark,
  humanMark: Mark,
): number {
  if (hasWon(board, aiMark))   return 10 - depth;
  if (hasWon(board, humanMark)) return depth - 10;

  const empty = emptyIndices(board);
  if (empty.length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of empty) {
      const b = [...board] as Board;
      b[idx] = aiMark;
      best = Math.max(best, minimax(b, depth + 1, false, aiMark, humanMark));
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of empty) {
      const b = [...board] as Board;
      b[idx] = humanMark;
      best = Math.min(best, minimax(b, depth + 1, true, aiMark, humanMark));
    }
    return best;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the index (0–8) the AI should play.
 *
 * EASY   — random valid move.
 * NORMAL — win if possible, block if needed, prefer centre/corners/edges;
 *           but 30 % of the time plays randomly (intentionally fallible).
 * HARD   — unbeatable minimax; prefers faster wins / slower losses.
 */
export function getAIMove(
  board: Board,
  aiMark: Mark,
  humanMark: Mark,
  difficulty: Difficulty,
): number {
  const empty = emptyIndices(board);
  // Guard: board should never be full when this is called
  const fallback = empty[0] ?? 0;

  if (difficulty === 'easy') {
    return empty[Math.floor(Math.random() * empty.length)] ?? fallback;
  }

  if (difficulty === 'normal') {
    // 30 % random to make NORMAL beatable
    if (Math.random() < 0.30) {
      return empty[Math.floor(Math.random() * empty.length)] ?? fallback;
    }
    // Win immediately if possible
    const win = findWinMove(board, aiMark);
    if (win !== -1) return win;
    // Block human from winning
    const block = findWinMove(board, humanMark);
    if (block !== -1) return block;
    // Positional preference: centre → corners → edges
    const priority = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    return priority.find(i => board[i] === null) ?? fallback;
  }

  // HARD: full minimax
  let bestScore = -Infinity;
  let bestMove  = fallback;
  for (const idx of empty) {
    const b = [...board] as Board;
    b[idx] = aiMark;
    const score = minimax(b, 0, false, aiMark, humanMark);
    if (score > bestScore) {
      bestScore = score;
      bestMove  = idx;
    }
  }
  return bestMove;
}
