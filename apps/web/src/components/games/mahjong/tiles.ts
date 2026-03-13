import type { TileFace, TileSuit } from './types';

/**
 * All 42 unique tile faces in a standard Mahjong set.
 * Each face appears 4 times in a full set (except flowers/seasons which are unique,
 * but we treat them as matching pairs by suit for solitaire).
 */

const SUITS: TileSuit[] = ['bamboo', 'circle', 'character'];
const SUIT_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const WIND_VALUES = [1, 2, 3, 4]; // East, South, West, North
const DRAGON_VALUES = [1, 2, 3]; // Red, Green, White

export function getAllFaces(): TileFace[] {
  const faces: TileFace[] = [];
  for (const suit of SUITS) {
    for (const value of SUIT_VALUES) {
      faces.push({ suit, value });
    }
  }
  for (const value of WIND_VALUES) {
    faces.push({ suit: 'wind', value });
  }
  for (const value of DRAGON_VALUES) {
    faces.push({ suit: 'dragon', value });
  }
  for (let i = 1; i <= 4; i++) {
    faces.push({ suit: 'flower', value: i });
  }
  for (let i = 1; i <= 4; i++) {
    faces.push({ suit: 'season', value: i });
  }
  return faces;
}

/** Check whether two tile faces can be matched. */
export function facesMatch(a: TileFace, b: TileFace): boolean {
  if (a.suit === 'flower' && b.suit === 'flower') return true;
  if (a.suit === 'season' && b.suit === 'season') return true;
  return a.suit === b.suit && a.value === b.value;
}

// ── Tile display — CJK characters for authentic look ────────────────────────

/** Main symbol shown large on the tile face. */
const FACE_CHARS: Record<TileSuit, string[]> = {
  bamboo:    ['一', '二', '三', '四', '五', '六', '七', '八', '九'],
  circle:    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'],
  character: ['壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'],
  wind:      ['東', '南', '西', '北'],
  dragon:    ['中', '發', '白'],
  flower:    ['梅', '蘭', '菊', '竹'],
  season:    ['春', '夏', '秋', '冬'],
};

export function tileChar(face: TileFace): string {
  return FACE_CHARS[face.suit]?.[face.value - 1] ?? '?';
}

/** Suit indicator shown small below the main character. */
const SUIT_INDICATOR: Record<TileSuit, string> = {
  bamboo: '索',
  circle: '筒',
  character: '萬',
  wind: '風',
  dragon: '龍',
  flower: '花',
  season: '季',
};

export function suitIndicator(suit: TileSuit): string {
  return SUIT_INDICATOR[suit];
}

/** Color class for the main character — dark colors on ivory background. */
const FACE_COLORS: Record<TileSuit, string> = {
  bamboo:    'text-emerald-800',
  circle:    'text-blue-800',
  character: 'text-red-800',
  wind:      'text-slate-800',
  dragon:    'text-red-700',  // 中 is traditionally red
  flower:    'text-pink-700',
  season:    'text-amber-800',
};

/** Per-tile color — dragons get individual colors (中=red, 發=green, 白=slate). */
export function faceColor(suit: TileSuit, value?: number): string {
  if (suit === 'dragon' && value === 2) return 'text-emerald-800'; // 發
  if (suit === 'dragon' && value === 3) return 'text-slate-500';   // 白
  return FACE_COLORS[suit];
}

// Keep old exports for compatibility but they won't be used in the new design
export function tileSymbol(face: TileFace): string {
  return tileChar(face);
}

export function tileLabel(face: TileFace): string {
  return tileChar(face);
}

export function tileColor(suit: TileSuit): string {
  return FACE_COLORS[suit];
}
