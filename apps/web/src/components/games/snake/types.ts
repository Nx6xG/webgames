export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Coord {
  x: number;
  y: number;
}

export interface GameState {
  snake:         Coord[];    // head at index 0
  direction:     Direction;  // current movement direction (applied on last tick)
  nextDirection: Direction;  // buffered player input
  food:          Coord;
  score:         number;
  best:          number;
  moves:         number;     // ticks elapsed while playing
  status:        'playing' | 'over';
}

export interface SnakeHighscoreEntry {
  id:          string;
  score:       number;
  date:        number;   // Unix timestamp ms
  moves:       number;
  durationSec: number;
  grid:        string;   // e.g. "20x20"
}
