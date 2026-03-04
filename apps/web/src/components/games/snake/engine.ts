import type { Coord, Direction, GameState } from './types';

export const GRID_SIZE = 20;
export const TICK_MS   = 160;

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns a fresh GameState with a 3-segment snake in the centre moving right. */
export function createInitialState(best = 0): GameState {
  const mid = Math.floor(GRID_SIZE / 2);
  const snake: Coord[] = [
    { x: mid,     y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    snake,
    direction:     'right',
    nextDirection: 'right',
    food:          spawnFood(snake),
    score:         0,
    best,
    moves:         0,
    status:        'playing',
  };
}

/**
 * Advances the game by one tick.
 * Returns the same state reference if the game is already over.
 */
export function step(state: GameState): GameState {
  if (state.status !== 'playing') return state;

  const dir     = state.nextDirection;
  const newHead = advance(state.snake[0], dir);

  // Wall collision
  if (
    newHead.x < 0 || newHead.x >= GRID_SIZE ||
    newHead.y < 0 || newHead.y >= GRID_SIZE
  ) {
    return { ...state, direction: dir, status: 'over', moves: state.moves + 1 };
  }

  // Self collision (skip the tail tip — it will vacate before we land)
  const bodyWithoutTail = state.snake.slice(0, -1);
  for (const seg of bodyWithoutTail) {
    if (seg.x === newHead.x && seg.y === newHead.y) {
      return { ...state, direction: dir, status: 'over', moves: state.moves + 1 };
    }
  }

  const ateFood  = newHead.x === state.food.x && newHead.y === state.food.y;
  const newSnake = ateFood
    ? [newHead, ...state.snake]              // grow: keep tail
    : [newHead, ...state.snake.slice(0, -1)]; // move: drop tail

  const newScore = state.score + (ateFood ? 1 : 0);

  return {
    snake:         newSnake,
    direction:     dir,
    nextDirection: dir,
    food:          ateFood ? spawnFood(newSnake) : state.food,
    score:         newScore,
    best:          Math.max(state.best, newScore),
    moves:         state.moves + 1,
    status:        'playing',
  };
}

/**
 * Queues a direction change.
 * Silently ignored if the direction is opposite to the current movement
 * or identical to the already-queued direction.
 */
export function changeDirection(state: GameState, dir: Direction): GameState {
  const OPPOSITE: Record<Direction, Direction> = {
    up: 'down', down: 'up', left: 'right', right: 'left',
  };
  // Prevent 180° reversal (checked against the live direction, not the buffer)
  if (OPPOSITE[dir] === state.direction) return state;
  if (dir === state.nextDirection)        return state;
  return { ...state, nextDirection: dir };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function advance(pos: Coord, dir: Direction): Coord {
  switch (dir) {
    case 'up':    return { x: pos.x,     y: pos.y - 1 };
    case 'down':  return { x: pos.x,     y: pos.y + 1 };
    case 'left':  return { x: pos.x - 1, y: pos.y     };
    case 'right': return { x: pos.x + 1, y: pos.y     };
  }
}

function spawnFood(snake: Coord[]): Coord {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  const free: Coord[] = [];
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE; x++)
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });

  // Extremely unlikely (board full = you won), fall back to head position
  if (free.length === 0) return snake[0];
  return free[Math.floor(Math.random() * free.length)];
}
