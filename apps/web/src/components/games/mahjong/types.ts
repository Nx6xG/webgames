/** Mahjong Solitaire tile & layout types. */

export type TileSuit = 'bamboo' | 'circle' | 'character' | 'wind' | 'dragon' | 'flower' | 'season';

export interface TileFace {
  suit: TileSuit;
  value: number; // 1-9 for suits, 1-4 for winds, 1-3 for dragons, 1-4 for flower/season
}

export interface MahjongTile {
  id: number;
  face: TileFace;
  /** Column position (0-based). */
  col: number;
  /** Row position (0-based). */
  row: number;
  /** Layer (z-level, 0 = bottom). */
  layer: number;
  /** Whether this tile has been removed from the board. */
  removed: boolean;
}

export type GamePhase = 'menu' | 'playing' | 'won' | 'lost';

export type LayoutDifficulty = 'easy' | 'medium' | 'hard';

export type LayoutId =
  | 'flat' | 'arena' | 'garden' | 'staircase' | 'turtle' | 'river' | 'meadow' | 'columns' | 'valley' | 'bricks'
  | 'pyramid' | 'fortress' | 'bridge' | 'temple' | 'waves' | 'hashtag' | 'wings' | 'spiral' | 'crab' | 'fan'
  | 'cross' | 'spider' | 'diamond' | 'pagoda' | 'dragon' | 'maze' | 'phoenix' | 'tower' | 'volcano' | 'labyrinth';
