import type { LayoutId, LayoutDifficulty } from './types';

export interface LayoutPosition {
  col: number;
  row: number;
  layer: number;
}

export interface LayoutMeta {
  id: LayoutId;
  difficulty: LayoutDifficulty;
}

/** All layouts grouped by difficulty. */
export const LAYOUTS: LayoutMeta[] = [
  // Easy
  { id: 'flat',      difficulty: 'easy' },
  { id: 'arena',     difficulty: 'easy' },
  { id: 'garden',    difficulty: 'easy' },
  { id: 'staircase', difficulty: 'easy' },
  { id: 'turtle',    difficulty: 'easy' },
  { id: 'river',     difficulty: 'easy' },
  { id: 'meadow',    difficulty: 'easy' },
  { id: 'columns',   difficulty: 'easy' },
  { id: 'valley',    difficulty: 'easy' },
  { id: 'bricks',    difficulty: 'easy' },
  // Medium
  { id: 'pyramid',   difficulty: 'medium' },
  { id: 'fortress',  difficulty: 'medium' },
  { id: 'bridge',    difficulty: 'medium' },
  { id: 'temple',    difficulty: 'medium' },
  { id: 'waves',     difficulty: 'medium' },
  { id: 'hashtag',   difficulty: 'medium' },
  { id: 'wings',     difficulty: 'medium' },
  { id: 'spiral',    difficulty: 'medium' },
  { id: 'crab',      difficulty: 'medium' },
  { id: 'fan',       difficulty: 'medium' },
  // Hard
  { id: 'cross',     difficulty: 'hard' },
  { id: 'spider',    difficulty: 'hard' },
  { id: 'diamond',   difficulty: 'hard' },
  { id: 'pagoda',    difficulty: 'hard' },
  { id: 'dragon',    difficulty: 'hard' },
  { id: 'maze',      difficulty: 'hard' },
  { id: 'phoenix',   difficulty: 'hard' },
  { id: 'tower',     difficulty: 'hard' },
  { id: 'volcano',   difficulty: 'hard' },
  { id: 'labyrinth', difficulty: 'hard' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Pad or trim a layout to exactly `n` tiles (must be even). */
function ensureCount(pos: LayoutPosition[], n: number): LayoutPosition[] {
  if (pos.length >= n) return pos.slice(0, n);
  while (pos.length < n) {
    const base = pos.filter(p => p.layer === 0);
    const pick = base[pos.length % base.length];
    pos.push({ col: pick.col, row: pick.row + 1, layer: 0 });
  }
  return pos.slice(0, n);
}

/** Shift all positions so min col = 0, min row = 0. */
function normalize(pos: LayoutPosition[]): LayoutPosition[] {
  if (pos.length === 0) return pos;
  const minCol = Math.min(...pos.map(p => p.col));
  const minRow = Math.min(...pos.map(p => p.row));
  if (minCol === 0 && minRow === 0) return pos;
  return pos.map(p => ({ col: p.col - minCol, row: p.row - minRow, layer: p.layer }));
}

// ══════════════════════════════════════════════════════════════════════════════
// EASY LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Flat (144) — Wide rectangle, minimal stacking ───────────────────────────

function flatLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: 12 × 8 = 96
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 12; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // L1: 8 × 6 = 48 (centered)
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: 4 + c * 2, row: 2 + r * 2, layer: 1 });
  return ensureCount(pos, 144);
}

// ── Arena (144) — Ring/donut shape ──────────────────────────────────────────

function arenaLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: 14×10 outer ring with hollow center (remove 8×4 inner)
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 14; c++) {
      if (r >= 3 && r < 7 && c >= 3 && c < 11) continue;
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
    }
  // L1: four corner stacks (3×2 each = 24)
  for (const [cc, rr] of [[0, 0], [11, 0], [0, 8], [11, 8]]) {
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++)
        pos.push({ col: (cc + c) * 2, row: (rr + r) * 2, layer: 1 });
  }
  // L2: four corner pairs (8)
  for (const [cc, rr] of [[1, 0], [12, 0], [1, 8], [12, 8]]) {
    pos.push({ col: cc * 2, row: rr * 2, layer: 2 });
    pos.push({ col: cc * 2, row: (rr + 1) * 2, layer: 2 });
  }
  return ensureCount(pos, 144);
}

// ── Garden (144) — Four separate beds ───────────────────────────────────────

function gardenLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const blocks: [number, number][] = [[0, 0], [10, 0], [0, 8], [10, 8]];

  for (const [bx, by] of blocks) {
    // L0: 5×4 = 20 per block
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 5; c++)
        pos.push({ col: bx + c * 2, row: by + r * 2, layer: 0 });
    // L1: 3×2 = 6 per block
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++)
        pos.push({ col: bx + 2 + c * 2, row: by + 2 + r * 2, layer: 1 });
    // L2: 2×1 = 2 per block
    for (let c = 0; c < 2; c++)
      pos.push({ col: bx + 3 + c * 2, row: by + 3, layer: 2 });
  }
  // Center path: 2×8 connecting them
  for (let r = 0; r < 8; r++)
    pos.push({ col: 8, row: r * 2, layer: 0 });
  // Horizontal path
  for (let c = 0; c < 8; c++)
    pos.push({ col: 2 + c * 2, row: 6, layer: 0 });

  return ensureCount(pos, 144);
}

// ── Staircase (144) — Ascending steps ───────────────────────────────────────

function staircaseLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // 4 adjacent columns, each 4 wide × 7 tall, each adding one more layer
  const colWidth = 4;
  const colHeight = 7;
  for (let step = 0; step < 4; step++) {
    const ox = step * colWidth * 2; // no gap
    for (let layer = 0; layer <= step; layer++) {
      const inset = layer;
      const w = colWidth - inset;
      const h = colHeight - inset * 2;
      if (w <= 0 || h <= 0) continue;
      for (let r = 0; r < h; r++)
        for (let c = 0; c < w; c++)
          pos.push({ col: ox + (inset + c) * 2, row: (inset + r) * 2, layer });
    }
  }
  return ensureCount(pos, 144);
}

// ── Classic "Turtle" (144) ──────────────────────────────────────────────────

function turtleLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const baseRows: number[][] = [
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21],
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
    [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21],
    [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
  ];
  for (let r = 0; r < baseRows.length; r++)
    for (const c of baseRows[r]) pos.push({ col: c, row: r * 2, layer: 0 });

  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: 4 + c * 2, row: 2 + r * 2, layer: 1 });

  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++)
      pos.push({ col: 6 + c * 2, row: 4 + r * 2, layer: 2 });

  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 8 + c * 2, row: 6 + r * 2, layer: 3 });

  pos.push({ col: 10, row: 7, layer: 4 });
  pos.push({ col: 12, row: 7, layer: 4 });

  return ensureCount(pos, 144);
}

// ── River (144) — Winding river with banks ──────────────────────────────────

function riverLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: Two banks (top and bottom) with a winding channel between
  // Top bank: 14×3
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 14; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // Bottom bank: 14×3
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 14; c++)
      pos.push({ col: c * 2, row: 10 + r * 2, layer: 0 });
  // River stones (scattered in the middle channel)
  for (let c = 1; c < 13; c += 2)
    pos.push({ col: c * 2, row: 7 * 2, layer: 0 });
  for (let c = 0; c < 14; c += 2)
    pos.push({ col: c * 2, row: 8, layer: 0 });
  // L1: bridge stacks on banks
  for (let c = 2; c < 12; c++)
    pos.push({ col: c * 2, row: 2, layer: 1 });
  for (let c = 2; c < 12; c++)
    pos.push({ col: c * 2, row: 12, layer: 1 });
  return ensureCount(pos, 144);
}

// ── Meadow (144) — Scattered flower clusters ────────────────────────────────

function meadowLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // 6 clusters of tiles arranged like flower patches
  const clusters: [number, number][] = [[0, 0], [10, 0], [20, 0], [5, 8], [15, 8], [10, 4]];
  for (const [bx, by] of clusters) {
    // L0: 4×4 = 16
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        pos.push({ col: bx + c * 2, row: by + r * 2, layer: 0 });
    // L1: 2×2 = 4 centered
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++)
        pos.push({ col: bx + 2 + c * 2, row: by + 2 + r * 2, layer: 1 });
  }
  // Center connecting tiles
  for (let c = 4; c < 20; c += 2)
    pos.push({ col: c, row: 7 * 2, layer: 0 });
  return ensureCount(pos, 144);
}

// ── Columns (144) — Tall columns in a row ───────────────────────────────────

function columnsLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // 6 columns, each 2 wide × 8 tall, with increasing layers
  for (let col = 0; col < 6; col++) {
    const ox = col * 4;
    const layers = (col % 3) + 1; // 1, 2, 3, 1, 2, 3
    for (let layer = 0; layer < layers; layer++) {
      for (let r = layer; r < 8 - layer; r++)
        for (let c = 0; c < 2; c++)
          pos.push({ col: ox + c * 2, row: r * 2, layer });
    }
  }
  // Bottom connecting base
  for (let c = 0; c < 12; c++)
    pos.push({ col: c * 2, row: 16, layer: 0 });
  return ensureCount(pos, 144);
}

// ── Valley (144) — Two slopes meeting in a low center ───────────────────────

function valleyLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // Left slope: layers descend left to right
  for (let c = 0; c < 6; c++) {
    const layers = 3 - Math.floor(c / 2);
    for (let layer = 0; layer < layers; layer++)
      for (let r = layer; r < 8 - layer; r++)
        pos.push({ col: c * 2, row: r * 2, layer });
  }
  // Right slope: mirror
  for (let c = 0; c < 6; c++) {
    const layers = 3 - Math.floor(c / 2);
    for (let layer = 0; layer < layers; layer++)
      for (let r = layer; r < 8 - layer; r++)
        pos.push({ col: (12 + c) * 2, row: r * 2, layer });
  }
  // Valley floor: flat 6×8
  for (let r = 0; r < 8; r++)
    for (let c = 6; c < 12; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  return ensureCount(pos, 144);
}

// ── Bricks (144) — Staggered brick wall pattern ─────────────────────────────

function bricksLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: brick wall — even rows offset by 1 tile
  for (let r = 0; r < 8; r++) {
    const offset = (r % 2) * 1;
    for (let c = 0; c < 12; c++)
      pos.push({ col: offset + c * 2, row: r * 2, layer: 0 });
  }
  // L1: scattered stacks (every other brick, rows 1-6)
  for (let r = 1; r < 7; r++) {
    const offset = (r % 2) * 1;
    for (let c = 1; c < 11; c += 2)
      pos.push({ col: offset + c * 2, row: r * 2, layer: 1 });
  }
  return ensureCount(pos, 144);
}

// ══════════════════════════════════════════════════════════════════════════════
// MEDIUM LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Pyramid (144) ───────────────────────────────────────────────────────────

function pyramidLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });

  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 6; c++)
      pos.push({ col: 2 + c * 2, row: 2 + r * 2, layer: 1 });

  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 4 + c * 2, row: 4 + r * 2, layer: 2 });

  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 6 + c * 2, row: 5 + r * 2, layer: 3 });

  pos.push({ col: 7, row: 7, layer: 4 });
  pos.push({ col: 7, row: 9, layer: 4 });

  return ensureCount(pos, 144);
}

// ── Fortress (144) ──────────────────────────────────────────────────────────

function fortressLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 10; c++) {
      if ((r < 2 || r > 5) && (c < 2 || c > 7)) continue;
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
    }

  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: 2 + c * 2, row: 2 + r * 2, layer: 1 });

  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 6 + c * 2, row: 4 + r * 2, layer: 2 });

  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 8 + c * 2, row: 6 + r * 2, layer: 3 });

  return ensureCount(pos, 144);
}

// ── Bridge (144) ────────────────────────────────────────────────────────────

function bridgeLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 5; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 5; c++)
      pos.push({ col: 14 + c * 2, row: r * 2, layer: 0 });

  for (let r = 3; r < 5; r++)
    for (let c = 5; c < 7; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });

  for (let r = 1; r < 7; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: 2 + c * 2, row: r * 2, layer: 1 });

  for (let r = 1; r < 7; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: 16 + c * 2, row: r * 2, layer: 1 });

  for (let r = 2; r < 6; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 3 + c * 2, row: r * 2, layer: 2 });

  for (let r = 2; r < 6; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 17 + c * 2, row: r * 2, layer: 2 });

  pos.push({ col: 4, row: 7, layer: 3 });
  pos.push({ col: 18, row: 7, layer: 3 });

  return ensureCount(pos, 144);
}

// ── Temple (144) — Symmetric temple with pillars ────────────────────────────

function templeLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];

  // L0: Wide base platform 14×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 14; c++)
      pos.push({ col: c * 2, row: 6 + r * 2, layer: 0 });

  // L0: Roof triangle — rows narrowing upward
  const roofWidths = [12, 10, 8, 6];
  for (let i = 0; i < roofWidths.length; i++) {
    const w = roofWidths[i];
    const offset = (14 - w) / 2;
    for (let c = 0; c < w; c++)
      pos.push({ col: (offset + c) * 2, row: (5 - i) * 2, layer: 0 });
  }

  // L0: Two pillars (2×6 each)
  for (let r = 0; r < 6; r++) {
    pos.push({ col: 2, row: 4 + r * 2, layer: 0 });
    pos.push({ col: 24, row: 4 + r * 2, layer: 0 });
  }

  // L1: Inner sanctum 8×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: 6 + c * 2, row: 6 + r * 2, layer: 1 });

  // L2: Altar 4×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 10 + c * 2, row: 8 + r * 2, layer: 2 });

  // L3: Peak 2×2
  pos.push({ col: 12, row: 8, layer: 3 });
  pos.push({ col: 12, row: 10, layer: 3 });

  return ensureCount(pos, 144);
}

// ── Waves (144) — Wavy layered rows ─────────────────────────────────────────

function wavesLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];

  // 5 wavy rows, each 14 tiles wide, at varying layer heights
  // Row layers: 0, 1, 2, 1, 0 — creating a wave
  const rowLayers = [0, 1, 2, 1, 0];
  for (let wave = 0; wave < 5; wave++) {
    const baseLayer = rowLayers[wave];
    const ry = wave * 4; // space between rows

    // Main row: 14 tiles wide
    for (let c = 0; c < 14; c++)
      pos.push({ col: c * 2, row: ry, layer: baseLayer });

    // Second sub-row: 10 tiles (centered), layer+1
    if (baseLayer < 2) {
      for (let c = 0; c < 10; c++)
        pos.push({ col: 4 + c * 2, row: ry + 2, layer: baseLayer + 1 });
    } else {
      for (let c = 0; c < 8; c++)
        pos.push({ col: 6 + c * 2, row: ry + 2, layer: baseLayer });
    }
  }

  return ensureCount(pos, 144);
}

// ── Hashtag (144) — # shape with deep center ────────────────────────────────

function hashtagLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: Two vertical bars (3 wide × 8 tall) and two horizontal bars (12 wide × 2 tall)
  // Vertical bar left
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: (2 + c) * 2, row: r * 2, layer: 0 });
  // Vertical bar right
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: (9 + c) * 2, row: r * 2, layer: 0 });
  // Horizontal bar top (excluding overlap with verticals)
  for (let c = 0; c < 14; c++) {
    if (c >= 2 && c < 5) continue;
    if (c >= 9 && c < 12) continue;
    pos.push({ col: c * 2, row: 4, layer: 0 });
    pos.push({ col: c * 2, row: 6, layer: 0 });
  }
  // Horizontal bar bottom
  for (let c = 0; c < 14; c++) {
    if (c >= 2 && c < 5) continue;
    if (c >= 9 && c < 12) continue;
    pos.push({ col: c * 2, row: 10, layer: 0 });
    pos.push({ col: c * 2, row: 12, layer: 0 });
  }
  // L1: stacks at intersections (2×2 each, 4 intersections = 16)
  for (const [cx, cy] of [[3, 2], [10, 2], [3, 5], [10, 5]]) {
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++)
        pos.push({ col: (cx + c) * 2, row: (cy + r) * 2, layer: 1 });
  }
  // L2: center of each intersection
  for (const [cx, cy] of [[3, 2], [10, 2], [3, 5], [10, 5]])
    pos.push({ col: cx * 2, row: cy * 2, layer: 2 });
  return ensureCount(pos, 144);
}

// ── Wings (144) — Butterfly/angel wings ─────────────────────────────────────

function wingsLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const cx = 12;
  // Left wing L0 (triangular shape)
  const leftWidths = [2, 4, 6, 8, 6, 4, 2];
  for (let r = 0; r < leftWidths.length; r++) {
    const w = leftWidths[r];
    for (let c = 0; c < w; c++)
      pos.push({ col: (cx - 2 - w * 2 + c * 2), row: r * 2, layer: 0 });
  }
  // Right wing L0 (mirror)
  for (let r = 0; r < leftWidths.length; r++) {
    const w = leftWidths[r];
    for (let c = 0; c < w; c++)
      pos.push({ col: cx + 2 + c * 2, row: r * 2, layer: 0 });
  }
  // Body (center column 2 wide × 7 tall)
  for (let r = 0; r < 7; r++)
    pos.push({ col: cx, row: r * 2, layer: 0 });
  for (let r = 0; r < 7; r++)
    pos.push({ col: cx - 2, row: r * 2, layer: 0 });
  // L1: wing tips (inner triangles)
  for (let r = 1; r < 6; r++) {
    pos.push({ col: cx - 6, row: r * 2, layer: 1 });
    pos.push({ col: cx + 4, row: r * 2, layer: 1 });
  }
  // L2: body stack
  for (let r = 2; r < 5; r++) {
    pos.push({ col: cx - 1, row: r * 2, layer: 1 });
    pos.push({ col: cx + 1, row: r * 2, layer: 1 });
  }
  return ensureCount(pos, 144);
}

// ── Spiral (144) — Inward spiral with layered center ────────────────────────

function spiralLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: Outer ring 12×8 minus 8×4 inner
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 12; c++) {
      if (r >= 2 && r < 6 && c >= 2 && c < 10) continue;
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
    }
  // Spiral arm: opening at top-right of ring, filling clockwise
  // Inner ring (offset by 1)
  for (let c = 3; c < 9; c++)
    pos.push({ col: c * 2, row: 4, layer: 0 });
  for (let r = 2; r < 6; r++)
    pos.push({ col: 3 * 2, row: r * 2, layer: 0 });
  for (let c = 3; c < 9; c++)
    pos.push({ col: c * 2, row: 10, layer: 0 });
  // L1: middle square 6×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++)
      pos.push({ col: 6 + c * 2, row: 4 + r * 2, layer: 1 });
  // L2: inner 4×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 8 + c * 2, row: 6 + r * 2, layer: 2 });
  // L3: center 2×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 10 + c * 2, row: 6 + r * 2, layer: 3 });
  return ensureCount(pos, 144);
}

// ── Crab (144) — Wide body with claws ───────────────────────────────────────

function crabLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // Body: central oval 10×6
  for (let r = 0; r < 6; r++) {
    const w = r >= 1 && r <= 4 ? 10 : 8;
    const off = (10 - w) / 2;
    for (let c = 0; c < w; c++)
      pos.push({ col: (off + c + 3) * 2, row: (r + 4) * 2, layer: 0 });
  }
  // Left claw (L shape)
  for (let r = 0; r < 4; r++)
    pos.push({ col: 0, row: r * 2, layer: 0 });
  for (let c = 1; c < 4; c++)
    pos.push({ col: c * 2, row: 0, layer: 0 });
  for (let c = 1; c < 3; c++)
    pos.push({ col: c * 2, row: 6, layer: 0 });
  // Right claw (mirrored L)
  for (let r = 0; r < 4; r++)
    pos.push({ col: 24, row: r * 2, layer: 0 });
  for (let c = 0; c < 3; c++)
    pos.push({ col: (10 + c) * 2, row: 0, layer: 0 });
  for (let c = 0; c < 2; c++)
    pos.push({ col: (10 + c) * 2, row: 6, layer: 0 });
  // Legs: 3 per side
  for (let i = 0; i < 3; i++) {
    pos.push({ col: 2 * 2, row: (5 + i) * 2, layer: 0 });
    pos.push({ col: 1 * 2, row: (5 + i) * 2, layer: 0 });
    pos.push({ col: 11 * 2, row: (5 + i) * 2, layer: 0 });
    pos.push({ col: 12 * 2, row: (5 + i) * 2, layer: 0 });
  }
  // L1: shell stack 6×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++)
      pos.push({ col: 8 + c * 2, row: 10 + r * 2, layer: 1 });
  // L2: center 2×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 12 + c * 2, row: 12 + r * 2, layer: 2 });
  return ensureCount(pos, 144);
}

// ── Fan (144) — Semicircular fan shape ──────────────────────────────────────

function fanLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const cx = 12;
  // L0: Fan ribs radiating outward — approximated as widening rows
  const rowWidths = [4, 6, 8, 10, 12, 14, 14];
  for (let r = 0; r < rowWidths.length; r++) {
    const w = rowWidths[r];
    const off = cx - w;
    for (let c = 0; c < w; c++)
      pos.push({ col: off + c * 2, row: r * 2, layer: 0 });
  }
  // Handle: narrow bottom
  for (let r = 7; r < 9; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: cx - 4 + c * 2, row: r * 2, layer: 0 });
  // L1: inner fan 8×4
  for (let r = 1; r < 5; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: cx - 8 + c * 2, row: r * 2, layer: 1 });
  // L2: center 4×2
  for (let r = 2; r < 4; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: cx - 4 + c * 2, row: r * 2, layer: 2 });
  // L3: peak
  pos.push({ col: cx - 1, row: 5, layer: 3 });
  pos.push({ col: cx + 1, row: 5, layer: 3 });
  return ensureCount(pos, 144);
}

// ══════════════════════════════════════════════════════════════════════════════
// HARD LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Cross (144) ─────────────────────────────────────────────────────────────

function crossLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: horizontal 12×4 + vertical 4×8 (minus overlap)
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 12; c++)
      pos.push({ col: c * 2, row: 4 + r * 2, layer: 0 });
  for (let r = 0; r < 4; r++)
    for (let c = 4; c < 8; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  for (let r = 0; r < 4; r++)
    for (let c = 4; c < 8; c++)
      pos.push({ col: c * 2, row: 8 + r * 2, layer: 0 });
  // L1: smaller cross
  for (let c = 1; c < 11; c++)
    pos.push({ col: c * 2, row: 6, layer: 1 });
  for (let r = 1; r < 11; r++) {
    if (r === 3) continue;
    for (let c = 5; c < 7; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 1 });
  }
  // L2: center 4×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 8 + c * 2, row: 4 + r * 2, layer: 2 });
  // L3: center 2×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 10 + c * 2, row: 6 + r * 2, layer: 3 });
  return ensureCount(pos, 144);
}

// ── Spider (144) ────────────────────────────────────────────────────────────

function spiderLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const cx = 8, cy = 6;
  // L0: central 6×6 body
  for (let r = -3; r < 3; r++)
    for (let c = -3; c < 3; c++)
      pos.push({ col: cx + c * 2, row: cy + r * 2, layer: 0 });
  // 4 short legs (2 tiles each, 2 wide)
  for (let i = 0; i < 3; i++) {
    pos.push({ col: cx + 6 + i * 2, row: cy, layer: 0 });
    pos.push({ col: cx + 6 + i * 2, row: cy - 2, layer: 0 });
    pos.push({ col: cx - 8 - i * 2, row: cy, layer: 0 });
    pos.push({ col: cx - 8 - i * 2, row: cy - 2, layer: 0 });
    pos.push({ col: cx, row: cy + 6 + i * 2, layer: 0 });
    pos.push({ col: cx - 2, row: cy + 6 + i * 2, layer: 0 });
    pos.push({ col: cx, row: cy - 8 - i * 2, layer: 0 });
    pos.push({ col: cx - 2, row: cy - 8 - i * 2, layer: 0 });
  }
  // L1: center 4×4
  for (let r = -2; r < 2; r++)
    for (let c = -2; c < 2; c++)
      pos.push({ col: cx + c * 2, row: cy + r * 2, layer: 1 });
  // L2: center 2×2
  for (let r = -1; r < 1; r++)
    for (let c = -1; c < 1; c++)
      pos.push({ col: cx + c * 2, row: cy + r * 2, layer: 2 });
  // L3: peak
  pos.push({ col: cx - 1, row: cy - 1, layer: 3 });
  pos.push({ col: cx - 1, row: cy + 1, layer: 3 });
  return ensureCount(pos, 144);
}

// ── Diamond (144) ───────────────────────────────────────────────────────────

function diamondLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const cx = 8, cy = 8;
  // L0: diamond (8 rows)
  const widths = [2, 4, 8, 10, 10, 8, 4, 2];
  for (let r = 0; r < widths.length; r++) {
    const w = widths[r];
    const offset = (10 - w) / 2;
    for (let c = 0; c < w; c++)
      pos.push({ col: cx - 10 + (offset + c) * 2, row: r * 2, layer: 0 });
  }
  // L1: smaller diamond (6 rows)
  const w1 = [2, 6, 6, 6, 6, 2];
  for (let r = 0; r < w1.length; r++) {
    const w = w1[r];
    const offset = (6 - w) / 2;
    for (let c = 0; c < w; c++)
      pos.push({ col: cx - 6 + (offset + c) * 2, row: 2 + r * 2, layer: 1 });
  }
  // L2: 4×4 center
  const w2 = [2, 4, 4, 2];
  for (let r = 0; r < w2.length; r++) {
    const w = w2[r];
    const offset = (4 - w) / 2;
    for (let c = 0; c < w; c++)
      pos.push({ col: cx - 4 + (offset + c) * 2, row: 4 + r * 2, layer: 2 });
  }
  // L3: 2×2 peak
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: cx - 2 + c * 2, row: 6 + r * 2, layer: 3 });
  // L4: cap
  pos.push({ col: cx - 1, row: 7, layer: 4 });
  pos.push({ col: cx + 1, row: 7, layer: 4 });
  return ensureCount(pos, 144);
}

// ── Pagoda (144) — Tall narrow tower, many layers ───────────────────────────

function pagodaLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: 8×8 = 64
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // L1: 7×7 = 49
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 7; c++)
      pos.push({ col: 1 + c * 2, row: 1 + r * 2, layer: 1 });
  // L2: 5×5 = 25
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++)
      pos.push({ col: 3 + c * 2, row: 3 + r * 2, layer: 2 });
  // L3: 3×3 = 9
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: 5 + c * 2, row: 5 + r * 2, layer: 3 });
  // L4: 2×2 = 4
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 6 + c * 2, row: 6 + r * 2, layer: 4 });
  // L5: peak
  pos.push({ col: 7, row: 7, layer: 5 });
  pos.push({ col: 7, row: 7, layer: 6 });
  return ensureCount(pos, 144);
}

// ── Dragon (144) — Serpentine S-shape with deep stacking ────────────────────

function dragonLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: Z-shaped body — wider, shorter
  // Top horizontal: 12×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 12; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // Diagonal connector: 3 wide, going right to left
  for (let r = 2; r < 5; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: (9 - r * 2) + c * 2, row: r * 2, layer: 0 });
  // Bottom horizontal: 12×2
  for (let r = 5; r < 7; r++)
    for (let c = 0; c < 12; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // Head (top-right blob)
  for (let r = 0; r < 2; r++)
    for (let c = 12; c < 14; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // Tail (bottom-left extension)
  for (let r = 5; r < 7; r++)
    for (let c = -2; c < 0; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // L1: stacking on horizontals
  for (let c = 2; c < 10; c++)
    pos.push({ col: c * 2, row: 1 * 2, layer: 1 });
  for (let c = 2; c < 10; c++)
    pos.push({ col: c * 2, row: 5 * 2, layer: 1 });
  // L2: center stacks
  for (let c = 4; c < 8; c++)
    pos.push({ col: c * 2, row: 1 * 2, layer: 2 });
  for (let c = 4; c < 8; c++)
    pos.push({ col: c * 2, row: 5 * 2, layer: 2 });
  // L3: peaks
  pos.push({ col: 10, row: 2, layer: 3 });
  pos.push({ col: 12, row: 2, layer: 3 });
  pos.push({ col: 10, row: 10, layer: 3 });
  pos.push({ col: 12, row: 10, layer: 3 });
  return ensureCount(pos, 144);
}

// ── Maze (144) — Labyrinth corridors with stacked dead ends ─────────────────

function mazeLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: maze-like grid with corridors
  // Horizontal corridors
  for (let c = 0; c < 13; c++) {
    pos.push({ col: c * 2, row: 0, layer: 0 });
    pos.push({ col: c * 2, row: 6, layer: 0 });
    pos.push({ col: c * 2, row: 12, layer: 0 });
  }
  // Vertical corridors
  for (let r = 0; r < 7; r++) {
    pos.push({ col: 0, row: r * 2, layer: 0 });
    pos.push({ col: 12, row: r * 2, layer: 0 });
    pos.push({ col: 24, row: r * 2, layer: 0 });
  }
  // Internal walls
  for (let r = 1; r < 3; r++)
    for (let c = 2; c < 5; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  for (let r = 4; r < 6; r++)
    for (let c = 8; c < 11; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  for (let r = 1; r < 3; r++)
    for (let c = 8; c < 11; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  for (let r = 4; r < 6; r++)
    for (let c = 2; c < 5; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // L1: dead-end stacks
  for (const [cx, cy] of [[3, 1], [9, 1], [3, 4], [9, 4]]) {
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++)
        pos.push({ col: (cx + c) * 2, row: (cy + r) * 2, layer: 1 });
  }
  // L2: center stack
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 10 + c * 2, row: 4 + r * 2, layer: 2 });
  return ensureCount(pos, 144);
}

// ── Phoenix (144) — Rising bird with spread wings ───────────────────────────

function phoenixLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  const cx = 12;
  // Body: central column 4 wide × 10 tall
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: cx - 4 + c * 2, row: r * 2, layer: 0 });
  // Left wing: triangular (widest at top)
  const wingWidths = [5, 4, 3, 2, 1];
  for (let r = 0; r < wingWidths.length; r++) {
    const w = wingWidths[r];
    for (let c = 0; c < w; c++)
      pos.push({ col: cx - 6 - c * 2, row: (r + 2) * 2, layer: 0 });
  }
  // Right wing (mirror)
  for (let r = 0; r < wingWidths.length; r++) {
    const w = wingWidths[r];
    for (let c = 0; c < w; c++)
      pos.push({ col: cx + 4 + c * 2, row: (r + 2) * 2, layer: 0 });
  }
  // Tail feathers (bottom, splayed)
  for (let c = -2; c <= 2; c++)
    pos.push({ col: cx + c * 2, row: 20, layer: 0 });
  // L1: body center
  for (let r = 1; r < 8; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: cx - 2 + c * 2, row: r * 2, layer: 1 });
  // L2: core
  for (let r = 2; r < 6; r++)
    pos.push({ col: cx - 1, row: r * 2, layer: 2 });
  // L3: eye
  pos.push({ col: cx - 1, row: 2, layer: 3 });
  pos.push({ col: cx - 1, row: 4, layer: 3 });
  return ensureCount(pos, 144);
}

// ── Tower (144) — Narrow deep tower, 7+ layers ─────────────────────────────

function towerLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: wide base 10×6
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 10; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  // L1: 8×5
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++)
      pos.push({ col: 2 + c * 2, row: 1 + r * 2, layer: 1 });
  // L2: 6×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++)
      pos.push({ col: 4 + c * 2, row: 2 + r * 2, layer: 2 });
  // L3: 4×3
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 6 + c * 2, row: 3 + r * 2, layer: 3 });
  // L4: 3×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++)
      pos.push({ col: 7 + c * 2, row: 4 + r * 2, layer: 4 });
  // L5: 2×2
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 8 + c * 2, row: 4 + r * 2, layer: 5 });
  // L6: peak
  pos.push({ col: 9, row: 5, layer: 6 });
  pos.push({ col: 9, row: 5, layer: 7 });
  return ensureCount(pos, 144);
}

// ── Volcano (144) — Crater rim with deep center hole ────────────────────────

function volcanoLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // L0: outer ring 12×10, hollow center 6×4
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 12; c++) {
      if (r >= 3 && r < 7 && c >= 3 && c < 9) continue;
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
    }
  // L1: rim stacks — the 4 edges
  for (let c = 1; c < 11; c++)
    pos.push({ col: c * 2, row: 0, layer: 1 });
  for (let c = 1; c < 11; c++)
    pos.push({ col: c * 2, row: 18, layer: 1 });
  for (let r = 1; r < 9; r++)
    pos.push({ col: 0, row: r * 2, layer: 1 });
  for (let r = 1; r < 9; r++)
    pos.push({ col: 22, row: r * 2, layer: 1 });
  // L2: corner peaks
  for (const [cc, rr] of [[1, 1], [10, 1], [1, 8], [10, 8]]) {
    pos.push({ col: cc * 2, row: rr * 2, layer: 2 });
    pos.push({ col: (cc + 1) * 2, row: rr * 2, layer: 2 });
  }
  // Lava in center (single layer)
  for (let r = 4; r < 6; r++)
    for (let c = 5; c < 7; c++)
      pos.push({ col: c * 2, row: r * 2, layer: 0 });
  return ensureCount(pos, 144);
}

// ── Labyrinth (144) — Nested rectangles with gaps ───────────────────────────

function labyrinthLayout(): LayoutPosition[] {
  const pos: LayoutPosition[] = [];
  // Outer ring 14×10 with gap at top-right
  for (let c = 0; c < 14; c++) pos.push({ col: c * 2, row: 0, layer: 0 });
  for (let c = 0; c < 14; c++) pos.push({ col: c * 2, row: 18, layer: 0 });
  for (let r = 1; r < 9; r++) pos.push({ col: 0, row: r * 2, layer: 0 });
  for (let r = 1; r < 7; r++) pos.push({ col: 26, row: r * 2, layer: 0 });
  // Middle ring 10×6 with gap at bottom-left
  for (let c = 2; c < 12; c++) pos.push({ col: c * 2, row: 4, layer: 0 });
  for (let c = 4; c < 12; c++) pos.push({ col: c * 2, row: 14, layer: 0 });
  for (let r = 3; r < 7; r++) pos.push({ col: 22, row: r * 2, layer: 0 });
  for (let r = 3; r < 7; r++) pos.push({ col: 4, row: r * 2, layer: 0 });
  // Inner block 4×4
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      pos.push({ col: 12 + c * 2, row: 6 + r * 2, layer: 0 });
  // L1: stacks on inner block
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 2; c++)
      pos.push({ col: 14 + c * 2, row: 8 + r * 2, layer: 1 });
  // L1: corner stacks on outer ring
  for (const [cc, rr] of [[0, 0], [13, 0], [0, 9], [13, 9]]) {
    pos.push({ col: cc * 2, row: rr * 2, layer: 1 });
    pos.push({ col: (cc === 0 ? 1 : cc - 1) * 2, row: rr * 2, layer: 1 });
  }
  // L2: inner peak
  pos.push({ col: 15, row: 9, layer: 2 });
  pos.push({ col: 17, row: 9, layer: 2 });
  return ensureCount(pos, 144);
}

// ── Registry ────────────────────────────────────────────────────────────────

const LAYOUT_FNS: Record<LayoutId, () => LayoutPosition[]> = {
  flat: flatLayout,
  arena: arenaLayout,
  garden: gardenLayout,
  staircase: staircaseLayout,
  turtle: turtleLayout,
  river: riverLayout,
  meadow: meadowLayout,
  columns: columnsLayout,
  valley: valleyLayout,
  bricks: bricksLayout,
  pyramid: pyramidLayout,
  fortress: fortressLayout,
  bridge: bridgeLayout,
  temple: templeLayout,
  waves: wavesLayout,
  hashtag: hashtagLayout,
  wings: wingsLayout,
  spiral: spiralLayout,
  crab: crabLayout,
  fan: fanLayout,
  cross: crossLayout,
  spider: spiderLayout,
  diamond: diamondLayout,
  pagoda: pagodaLayout,
  dragon: dragonLayout,
  maze: mazeLayout,
  phoenix: phoenixLayout,
  tower: towerLayout,
  volcano: volcanoLayout,
  labyrinth: labyrinthLayout,
};

export function getLayout(id: LayoutId): LayoutPosition[] {
  return normalize(LAYOUT_FNS[id]());
}
