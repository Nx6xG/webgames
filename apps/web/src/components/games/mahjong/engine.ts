import type { MahjongTile, TileFace, LayoutId } from './types';
import type { LayoutPosition } from './layouts';
import { getLayout } from './layouts';
import { getAllFaces, facesMatch } from './tiles';

// ── Shuffle utility ─────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Generate tiles for a layout ─────────────────────────────────────────────

/**
 * Create a solvable Mahjong board.
 * We place pairs of matching faces at positions, then shuffle.
 */
export function generateBoard(layoutId: LayoutId): MahjongTile[] {
  const positions = getLayout(layoutId);
  const tileCount = positions.length;

  // We need tileCount/2 pairs of matching faces
  const pairCount = Math.floor(tileCount / 2);

  // Build face pool: all 42 faces, each can appear up to 2 times (pairs)
  // For 144 tiles = 72 pairs, we need 72 unique or repeated faces
  const allFaces = getAllFaces(); // 42 faces
  let facePairs: TileFace[] = [];

  // Each regular face (bamboo/circle/character 1-9, winds, dragons) gets 2 pairs (4 tiles)
  // 34 regular faces × 2 pairs = 68 pairs
  // Flowers (4) and Seasons (4) = 4 pairs each suit = 4 pairs
  // Total: 68 + 4 = 72 pairs = 144 tiles

  const regularFaces = allFaces.filter(f => f.suit !== 'flower' && f.suit !== 'season');
  // 34 regular faces × 2 pairs = 68 pairs
  for (const face of regularFaces) {
    facePairs.push(face, face); // pair 1
    facePairs.push(face, face); // pair 2
  }

  // Flowers: 4 tiles that all match each other → 2 pairs
  const flowers = allFaces.filter(f => f.suit === 'flower');
  for (let i = 0; i < flowers.length; i++) {
    facePairs.push(flowers[i]);
  }

  // Seasons: 4 tiles that all match each other → 2 pairs
  const seasons = allFaces.filter(f => f.suit === 'season');
  for (let i = 0; i < seasons.length; i++) {
    facePairs.push(seasons[i]);
  }

  // Shuffle faces and assign to positions
  facePairs = shuffle(facePairs).slice(0, tileCount);

  return positions.map((pos, i) => ({
    id: i,
    face: facePairs[i],
    col: pos.col,
    row: pos.row,
    layer: pos.layer,
    removed: false,
  }));
}

// ── Tile interaction rules ──────────────────────────────────────────────────

/**
 * A tile is "free" if:
 * 1. Nothing is on top of it (no tile on a higher layer overlapping its 2×2 area)
 * 2. It's not blocked on BOTH left and right sides
 */
export function isTileFree(tile: MahjongTile, tiles: MahjongTile[]): boolean {
  if (tile.removed) return false;

  const active = tiles.filter(t => !t.removed && t.id !== tile.id);

  // Check if anything is on top (overlapping on a higher layer)
  const hasOnTop = active.some(t =>
    t.layer > tile.layer &&
    Math.abs(t.col - tile.col) < 2 &&
    Math.abs(t.row - tile.row) < 2
  );
  if (hasOnTop) return false;

  // Check left/right blocking (same layer, adjacent column, overlapping rows)
  const blockedLeft = active.some(t =>
    t.layer === tile.layer &&
    t.col === tile.col - 2 &&
    Math.abs(t.row - tile.row) < 2
  );
  const blockedRight = active.some(t =>
    t.layer === tile.layer &&
    t.col === tile.col + 2 &&
    Math.abs(t.row - tile.row) < 2
  );

  return !blockedLeft || !blockedRight;
}

/** Get all free tiles on the board. */
export function getFreeTiles(tiles: MahjongTile[]): MahjongTile[] {
  return tiles.filter(t => !t.removed && isTileFree(t, tiles));
}

/** Check if any valid moves remain. */
export function hasValidMoves(tiles: MahjongTile[]): boolean {
  const free = getFreeTiles(tiles);
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (facesMatch(free[i].face, free[j].face)) return true;
    }
  }
  return false;
}

/** Count remaining (non-removed) tiles. */
export function remainingCount(tiles: MahjongTile[]): number {
  return tiles.filter(t => !t.removed).length;
}

/** Count available matching pairs among free tiles. */
export function availablePairs(tiles: MahjongTile[]): number {
  const free = getFreeTiles(tiles);
  let count = 0;
  const used = new Set<number>();
  for (let i = 0; i < free.length; i++) {
    if (used.has(free[i].id)) continue;
    for (let j = i + 1; j < free.length; j++) {
      if (used.has(free[j].id)) continue;
      if (facesMatch(free[i].face, free[j].face)) {
        count++;
        used.add(free[i].id);
        used.add(free[j].id);
        break;
      }
    }
  }
  return count;
}

/** Find a hint: returns a pair of tile IDs that can be matched, or null. */
export function findHint(tiles: MahjongTile[]): [number, number] | null {
  const free = getFreeTiles(tiles);
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (facesMatch(free[i].face, free[j].face)) {
        return [free[i].id, free[j].id];
      }
    }
  }
  return null;
}
