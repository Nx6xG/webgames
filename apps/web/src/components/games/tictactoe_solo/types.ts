export type Mark = 'X' | 'O';

/** Flat 3×3 board — index 0 (top-left) to 8 (bottom-right). */
export type Board = (Mark | null)[];

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode   = 'pvp' | 'ai';

export type GameStatus =
  | { kind: 'playing'; turn: Mark }
  | { kind: 'won';     winner: Mark; line: number[] }
  | { kind: 'draw' };

export interface GameConfig {
  mode:       GameMode;
  difficulty: Difficulty; // only used when mode === 'ai'
  humanMark:  Mark;       // only used when mode === 'ai'
}
