export type Mark = 'X' | 'O';
export type Cell = Mark | null;

export interface TicTacToePlayer {
  id: string;
  mark: Mark;
}

export interface TicTacToeState {
  /** Flat 9-cell board in row-major order: index = y*3 + x */
  board: Cell[];
  /** Socket ID of the player whose turn it is */
  currentTurn: string;
  players: [TicTacToePlayer, TicTacToePlayer];
  status: 'ongoing' | 'win' | 'draw';
  /** Socket ID of the winner (undefined unless status === 'win') */
  winner?: string;
  /** Indices of the three winning cells (undefined unless status === 'win') */
  winnerCells?: [number, number, number];
}

export interface PlaceMarkAction {
  type: 'place_mark';
  /** Column 0-2 */
  x: number;
  /** Row 0-2 */
  y: number;
}

export type TicTacToeAction = PlaceMarkAction;
