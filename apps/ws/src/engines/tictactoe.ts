import type { GameEngine, ActionContext, StatusResult, GameStatus } from 'shared';
import type { TicTacToeState, TicTacToeAction, Cell, Mark } from 'shared';

const WINNING_LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkStatus(
  board: Cell[],
  players: TicTacToeState['players'],
): StatusResult & { winnerCells?: [number, number, number] } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      const mark = board[a] as Mark;
      const winner = players.find((p) => p.mark === mark)!;
      return { status: 'win', winner: winner.id, winnerCells: line };
    }
  }
  if (board.every((cell) => cell !== null)) return { status: 'draw' };
  return { status: 'ongoing' };
}

export const ticTacToeEngine: GameEngine<TicTacToeState, TicTacToeAction> = {
  initialState([p0, p1]): TicTacToeState {
    return {
      board: Array(9).fill(null) as Cell[],
      currentTurn: p0,
      players: [
        { id: p0, mark: 'X' },
        { id: p1, mark: 'O' },
      ],
      status: 'ongoing',
    };
  },

  applyAction(state, action, ctx: ActionContext): TicTacToeState {
    if (state.status !== 'ongoing') throw new Error('GAME_OVER: Game is already finished');
    if (state.currentTurn !== ctx.playerId) throw new Error('NOT_YOUR_TURN: Wait for your turn');
    if (action.type !== 'place_mark') throw new Error('INVALID_ACTION: Unknown action type');

    const { x, y } = action;
    if (x < 0 || x > 2 || y < 0 || y > 2) throw new Error('INVALID_POSITION: Coordinates out of bounds');

    const idx = y * 3 + x;
    if (state.board[idx] !== null) throw new Error('CELL_TAKEN: That cell is already occupied');

    const player = state.players.find((p) => p.id === ctx.playerId)!;
    const newBoard = [...state.board] as Cell[];
    newBoard[idx] = player.mark;

    const result = checkStatus(newBoard, state.players);
    const other = state.players.find((p) => p.id !== ctx.playerId)!;

    return {
      ...state,
      board: newBoard,
      currentTurn: result.status === 'ongoing' ? other.id : state.currentTurn,
      status: result.status,
      winner: result.winner,
      winnerCells: result.winnerCells,
    };
  },

  getStatus(state): StatusResult {
    return { status: state.status as GameStatus, winner: state.winner };
  },
};
