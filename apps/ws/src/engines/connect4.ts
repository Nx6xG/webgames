import type { GameEngine, GameStatus, ActionContext } from 'shared';
import type { Connect4State, Connect4Action, Connect4Cell } from 'shared';

const ROWS = 6;
const COLS = 7;

const DIRECTIONS: [number, number][] = [
  [0, 1],  // horizontal
  [1, 0],  // vertical
  [1, 1],  // diagonal ↘
  [1, -1], // diagonal ↙
];

function findWinnerCells(
  board: Connect4Cell[][],
  row: number,
  col: number,
  piece: 1 | 2,
): [number, number][] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const cells: [number, number][] = [[row, col]];

    for (let i = 1; i < 4; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== piece) break;
      cells.push([r, c]);
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== piece) break;
      cells.push([r, c]);
    }

    if (cells.length >= 4) return cells;
  }
  return null;
}

export const connect4Engine: GameEngine<Connect4State, Connect4Action> = {
  initialState([p0, p1]: string[], startingPlayerIndex: number = 0): Connect4State {
    const first = startingPlayerIndex === 0 ? p0 : p1;
    return {
      board: Array.from({ length: ROWS }, () => Array<Connect4Cell>(COLS).fill(0)),
      currentPlayer: first,
      players: [
        { id: p0, piece: 1 },
        { id: p1, piece: 2 },
      ],
      status: 'ongoing',
    };
  },

  applyAction(state, action, ctx: ActionContext): Connect4State {
    if (state.status !== 'ongoing') throw new Error('GAME_OVER: Game is already finished');
    if (state.currentPlayer !== ctx.playerId) throw new Error('NOT_YOUR_TURN: Wait for your turn');
    if (action.type !== 'drop') throw new Error('INVALID_ACTION: Unknown action type');

    const { column } = action;
    if (!Number.isInteger(column) || column < 0 || column >= COLS) {
      throw new Error('INVALID_POSITION: Column out of bounds');
    }

    // Gravity: find the lowest empty row
    let dropRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.board[r][column] === 0) { dropRow = r; break; }
    }
    if (dropRow === -1) throw new Error('COLUMN_FULL: That column is full');

    const player = state.players.find((p) => p.id === ctx.playerId)!;
    const newBoard = state.board.map((row) => [...row] as Connect4Cell[]);
    newBoard[dropRow][column] = player.piece;

    const winCells = findWinnerCells(newBoard, dropRow, column, player.piece);
    if (winCells) {
      return { ...state, board: newBoard, status: 'win', winner: player.id, winnerCells: winCells };
    }

    // Draw: top row fully occupied means every column is full
    const isDraw = newBoard[0].every((cell) => cell !== 0);
    const other = state.players.find((p) => p.id !== ctx.playerId)!;
    return {
      ...state,
      board: newBoard,
      currentPlayer: isDraw ? state.currentPlayer : other.id,
      status: isDraw ? 'draw' : 'ongoing',
    };
  },

  getStatus(state) {
    return { status: state.status as GameStatus, winner: state.winner };
  },
};
