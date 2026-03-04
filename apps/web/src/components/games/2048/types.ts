/** 4×4 grid — 0 represents an empty cell. */
export type Grid = number[][];

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id:       number;
  row:      number;
  col:      number;
  value:    number;
  isNew:    boolean;
  isMerged: boolean;
}

export interface GameState {
  grid:        Grid;
  /** Animated tile objects — source of truth for rendering. */
  tiles:       Tile[];
  /** Monotonically increasing ID counter for new tiles. */
  nextId:      number;
  score:       number;
  best:        number;
  moves:       number;
  status:      'playing' | 'won' | 'over';
  keepPlaying: boolean;
}

export interface HighscoreEntry {
  id:       string;
  date:     string;    // ISO date string
  score:    number;
  maxTile:  number;
  moves:    number;
  duration: number;   // seconds
}
