export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type GamePhase = 'config' | 'generating' | 'playing' | 'won';

/** 9×9 grid — 0 means empty, 1–9 are placed numbers. */
export type Board = number[][];
