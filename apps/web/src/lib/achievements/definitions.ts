import type { CosmeticSlot } from '@/lib/cosmetics';

// ── Achievement types ──────────────────────────────────────────────────────────

export type AchievementId = string;

export interface AchievementStats {
  playsTotal: number;
  winsTotal: number;
  invitesTotal: number;
  playsByGame: Record<string, number>;
  winsByGame: Record<string, number>;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDefinition {
  id: AchievementId;
  icon: string;
  nameKey: string;
  descKey: string;
  tags?: string[];
  hidden?: boolean;
  /** @deprecated Use cosmeticReward instead */
  frameReward?: string;
  /** If set, unlocking this achievement also grants the specified cosmetic(s). */
  cosmeticReward?: { slot: CosmeticSlot; id: string } | { slot: CosmeticSlot; id: string }[];
  condition: (stats: AchievementStats) => boolean;
  getProgress?: (stats: AchievementStats) => AchievementProgress;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function plays(gameId: string, n: number): (s: AchievementStats) => boolean {
  return (s) => (s.playsByGame[gameId] ?? 0) >= n;
}
function wins(gameId: string, n: number): (s: AchievementStats) => boolean {
  return (s) => (s.winsByGame[gameId] ?? 0) >= n;
}

function playsProgress(gameId: string, target: number): (s: AchievementStats) => AchievementProgress {
  return (s) => ({ current: Math.min(s.playsByGame[gameId] ?? 0, target), target });
}
function winsProgress(gameId: string, target: number): (s: AchievementStats) => AchievementProgress {
  return (s) => ({ current: Math.min(s.winsByGame[gameId] ?? 0, target), target });
}

// ── Category order (for the achievements page) ───────────────────────────────

export const CATEGORY_ORDER = [
  'general',
  'tictactoe',
  'connect4',
  'rps',
  'chess',
  'battleship',
  'liarsbar',
  'sudoku',
  '2048',
  'snake',
  'tetris',
  'flappy',
] as const;

export type AchievementCategory = (typeof CATEGORY_ORDER)[number];

// ── Definitions ────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── General ──────────────────────────────────────────────────────────────────
  {
    id: 'general.first_game',
    icon: '🎮',
    nameKey: 'achievements.general.first_game.name',
    descKey: 'achievements.general.first_game.desc',
    tags: ['general'],
    cosmeticReward: { slot: 'aura', id: 'softGlow' },
    condition: (s) => s.playsTotal >= 1,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 1), target: 1 }),
  },
  {
    id: 'general.play_10',
    icon: '🔟',
    nameKey: 'achievements.general.play_10.name',
    descKey: 'achievements.general.play_10.desc',
    tags: ['general'],
    frameReward: 'bronze',
    cosmeticReward: { slot: 'frame', id: 'bronze' },
    condition: (s) => s.playsTotal >= 10,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 10), target: 10 }),
  },
  {
    id: 'general.first_win',
    icon: '🏆',
    nameKey: 'achievements.general.first_win.name',
    descKey: 'achievements.general.first_win.desc',
    tags: ['general'],
    cosmeticReward: { slot: 'portal', id: 'void' },
    condition: (s) => s.winsTotal >= 1,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 1), target: 1 }),
  },
  {
    id: 'general.win_10',
    icon: '👑',
    nameKey: 'achievements.general.win_10.name',
    descKey: 'achievements.general.win_10.desc',
    tags: ['general'],
    hidden: true,
    frameReward: 'silver',
    cosmeticReward: [{ slot: 'frame', id: 'silver' }, { slot: 'badge', id: 'badge_veteran' }],
    condition: (s) => s.winsTotal >= 10,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 10), target: 10 }),
  },
  {
    id: 'general.invite_1',
    icon: '📨',
    nameKey: 'achievements.general.invite_1.name',
    descKey: 'achievements.general.invite_1.desc',
    tags: ['general', 'social'],
    cosmeticReward: { slot: 'head', id: 'cap' },
    condition: (s) => s.invitesTotal >= 1,
    getProgress: (s) => ({ current: Math.min(s.invitesTotal, 1), target: 1 }),
  },

  // ── Tic-Tac-Toe ─────────────────────────────────────────────────────────────
  {
    id: 'tictactoe.first_win',
    icon: '✖️',
    nameKey: 'achievements.tictactoe.first_win.name',
    descKey: 'achievements.tictactoe.first_win.desc',
    tags: ['tictactoe'],
    cosmeticReward: { slot: 'badge', id: 'badge_ttt' },
    condition: wins('tictactoe', 1),
    getProgress: winsProgress('tictactoe', 1),
  },
  {
    id: 'tictactoe.win_5',
    icon: '⭐',
    nameKey: 'achievements.tictactoe.win_5.name',
    descKey: 'achievements.tictactoe.win_5.desc',
    tags: ['tictactoe'],
    hidden: true,
    cosmeticReward: { slot: 'aura', id: 'electric' },
    condition: wins('tictactoe', 5),
    getProgress: winsProgress('tictactoe', 5),
  },
  {
    id: 'tictactoe.play_10',
    icon: '🎯',
    nameKey: 'achievements.tictactoe.play_10.name',
    descKey: 'achievements.tictactoe.play_10.desc',
    tags: ['tictactoe'],
    condition: plays('tictactoe', 10),
    getProgress: playsProgress('tictactoe', 10),
  },

  // ── Connect 4 ────────────────────────────────────────────────────────────────
  {
    id: 'connect4.first_win',
    icon: '🔴',
    nameKey: 'achievements.connect4.first_win.name',
    descKey: 'achievements.connect4.first_win.desc',
    tags: ['connect4'],
    cosmeticReward: { slot: 'badge', id: 'badge_c4' },
    condition: wins('connect4', 1),
    getProgress: winsProgress('connect4', 1),
  },
  {
    id: 'connect4.win_5',
    icon: '🟡',
    nameKey: 'achievements.connect4.win_5.name',
    descKey: 'achievements.connect4.win_5.desc',
    tags: ['connect4'],
    hidden: true,
    condition: wins('connect4', 5),
    getProgress: winsProgress('connect4', 5),
  },
  {
    id: 'connect4.play_10',
    icon: '🏅',
    nameKey: 'achievements.connect4.play_10.name',
    descKey: 'achievements.connect4.play_10.desc',
    tags: ['connect4'],
    condition: plays('connect4', 10),
    getProgress: playsProgress('connect4', 10),
  },

  // ── Rock Paper Scissors ──────────────────────────────────────────────────────
  {
    id: 'rps.first_win',
    icon: '✊',
    nameKey: 'achievements.rps.first_win.name',
    descKey: 'achievements.rps.first_win.desc',
    tags: ['rps'],
    cosmeticReward: { slot: 'badge', id: 'badge_rps' },
    condition: wins('rps', 1),
    getProgress: winsProgress('rps', 1),
  },
  {
    id: 'rps.win_5',
    icon: '✌️',
    nameKey: 'achievements.rps.win_5.name',
    descKey: 'achievements.rps.win_5.desc',
    tags: ['rps'],
    hidden: true,
    condition: wins('rps', 5),
    getProgress: winsProgress('rps', 5),
  },
  {
    id: 'rps.play_10',
    icon: '🤜',
    nameKey: 'achievements.rps.play_10.name',
    descKey: 'achievements.rps.play_10.desc',
    tags: ['rps'],
    condition: plays('rps', 10),
    getProgress: playsProgress('rps', 10),
  },

  // ── Chess ────────────────────────────────────────────────────────────────────
  {
    id: 'chess.first_win',
    icon: '♟️',
    nameKey: 'achievements.chess.first_win.name',
    descKey: 'achievements.chess.first_win.desc',
    tags: ['chess'],
    cosmeticReward: { slot: 'badge', id: 'badge_chess' },
    condition: wins('chess', 1),
    getProgress: winsProgress('chess', 1),
  },
  {
    id: 'chess.win_3',
    icon: '♛',
    nameKey: 'achievements.chess.win_3.name',
    descKey: 'achievements.chess.win_3.desc',
    tags: ['chess'],
    hidden: true,
    frameReward: 'gold',
    cosmeticReward: { slot: 'frame', id: 'gold' },
    condition: wins('chess', 3),
    getProgress: winsProgress('chess', 3),
  },
  {
    id: 'chess.play_5',
    icon: '♜',
    nameKey: 'achievements.chess.play_5.name',
    descKey: 'achievements.chess.play_5.desc',
    tags: ['chess'],
    condition: plays('chess', 5),
    getProgress: playsProgress('chess', 5),
  },

  // ── Battleship ───────────────────────────────────────────────────────────────
  {
    id: 'battleship.first_win',
    icon: '🚢',
    nameKey: 'achievements.battleship.first_win.name',
    descKey: 'achievements.battleship.first_win.desc',
    tags: ['battleship'],
    cosmeticReward: { slot: 'badge', id: 'badge_battleship' },
    condition: wins('battleship', 1),
    getProgress: winsProgress('battleship', 1),
  },
  {
    id: 'battleship.win_3',
    icon: '💣',
    nameKey: 'achievements.battleship.win_3.name',
    descKey: 'achievements.battleship.win_3.desc',
    tags: ['battleship'],
    hidden: true,
    frameReward: 'fire',
    cosmeticReward: { slot: 'frame', id: 'fire' },
    condition: wins('battleship', 3),
    getProgress: winsProgress('battleship', 3),
  },
  {
    id: 'battleship.play_5',
    icon: '⚓',
    nameKey: 'achievements.battleship.play_5.name',
    descKey: 'achievements.battleship.play_5.desc',
    tags: ['battleship'],
    condition: plays('battleship', 5),
    getProgress: playsProgress('battleship', 5),
  },

  // ── Liar's Deck ──────────────────────────────────────────────────────────────
  {
    id: 'liarsbar.first_win',
    icon: '🃏',
    nameKey: 'achievements.liarsbar.first_win.name',
    descKey: 'achievements.liarsbar.first_win.desc',
    tags: ['liarsbar'],
    cosmeticReward: { slot: 'badge', id: 'badge_liar' },
    condition: wins('liarsbar', 1),
    getProgress: winsProgress('liarsbar', 1),
  },
  {
    id: 'liarsbar.win_3',
    icon: '🎭',
    nameKey: 'achievements.liarsbar.win_3.name',
    descKey: 'achievements.liarsbar.win_3.desc',
    tags: ['liarsbar'],
    hidden: true,
    cosmeticReward: { slot: 'aura', id: 'shadow' },
    condition: wins('liarsbar', 3),
    getProgress: winsProgress('liarsbar', 3),
  },
  {
    id: 'liarsbar.play_5',
    icon: '🎲',
    nameKey: 'achievements.liarsbar.play_5.name',
    descKey: 'achievements.liarsbar.play_5.desc',
    tags: ['liarsbar'],
    condition: plays('liarsbar', 5),
    getProgress: playsProgress('liarsbar', 5),
  },

  // ── Sudoku ───────────────────────────────────────────────────────────────────
  {
    id: 'sudoku.first_win',
    icon: '#️⃣',
    nameKey: 'achievements.sudoku.first_win.name',
    descKey: 'achievements.sudoku.first_win.desc',
    tags: ['sudoku'],
    condition: wins('sudoku', 1),
    getProgress: winsProgress('sudoku', 1),
  },
  {
    id: 'sudoku.win_5',
    icon: '🧩',
    nameKey: 'achievements.sudoku.win_5.name',
    descKey: 'achievements.sudoku.win_5.desc',
    tags: ['sudoku'],
    hidden: true,
    cosmeticReward: { slot: 'head', id: 'wizard_hat' },
    condition: wins('sudoku', 5),
    getProgress: winsProgress('sudoku', 5),
  },

  // ── 2048 ─────────────────────────────────────────────────────────────────────
  {
    id: '2048.first_win',
    icon: '🔢',
    nameKey: 'achievements.2048.first_win.name',
    descKey: 'achievements.2048.first_win.desc',
    tags: ['2048'],
    condition: wins('2048', 1),
    getProgress: winsProgress('2048', 1),
  },
  {
    id: '2048.play_5',
    icon: '🧮',
    nameKey: 'achievements.2048.play_5.name',
    descKey: 'achievements.2048.play_5.desc',
    tags: ['2048'],
    condition: plays('2048', 5),
    getProgress: playsProgress('2048', 5),
  },

  // ── Snake ────────────────────────────────────────────────────────────────────
  {
    id: 'snake.play_5',
    icon: '🐍',
    nameKey: 'achievements.snake.play_5.name',
    descKey: 'achievements.snake.play_5.desc',
    tags: ['snake'],
    cosmeticReward: { slot: 'badge', id: 'badge_snake' },
    condition: plays('snake', 5),
    getProgress: playsProgress('snake', 5),
  },

  // ── Tetris ───────────────────────────────────────────────────────────────────
  {
    id: 'tetris.play_5',
    icon: '🧱',
    nameKey: 'achievements.tetris.play_5.name',
    descKey: 'achievements.tetris.play_5.desc',
    tags: ['tetris'],
    condition: plays('tetris', 5),
    getProgress: playsProgress('tetris', 5),
  },

  // ── Flappy Bird ──────────────────────────────────────────────────────────────
  {
    id: 'flappy.play_5',
    icon: '🐦',
    nameKey: 'achievements.flappy.play_5.name',
    descKey: 'achievements.flappy.play_5.desc',
    tags: ['flappy'],
    condition: plays('flappy', 5),
    getProgress: playsProgress('flappy', 5),
  },
];
