export type Connect4Cell = 0 | 1 | 2;

export interface Connect4Player {
  id: string;
  piece: 1 | 2;
}

export interface Connect4State {
  /**
   * board[row][col] — row 0 is the top, row 5 is the bottom.
   * 0 = empty, 1 = player 1, 2 = player 2.
   */
  board: Connect4Cell[][];
  /** Socket ID of the player whose turn it is */
  currentPlayer: string;
  players: [Connect4Player, Connect4Player];
  status: 'ongoing' | 'win' | 'draw';
  winner?: string;
  /** [row, col] pairs of the four winning cells */
  winnerCells?: [number, number][];
}

export interface DropAction {
  type: 'drop';
  /** 0-indexed column (0–6) */
  column: number;
}

export type Connect4Action = DropAction;
