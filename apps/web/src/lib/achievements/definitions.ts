// ── Achievement types ──────────────────────────────────────────────────────────

export type AchievementId = string;

export interface AchievementStats {
  playsTotal: number;
  winsTotal: number;
  lossesTotal: number;
  invitesTotal: number;
  lobbiesHosted: number;
  publicGamesJoined: number;
  messagesSent: number;
  profileCustomized: boolean;
  currentWinStreak: number;
  maxWinStreak: number;
  tttCurrentWinStreak: number;
  tttMaxWinStreak: number;
  level: number;
  totalUnlocked: number;
  playsByGame: Record<string, number>;
  winsByGame: Record<string, number>;
  flags: Record<string, boolean>;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export type AchievementTier = 'easy' | 'medium' | 'hard' | 'epic';

export interface AchievementDefinition {
  id: AchievementId;
  icon: string;
  nameKey: string;
  descKey: string;
  tags?: string[];
  /** Difficulty / effort tier — determines XP or token reward */
  tier: AchievementTier;
  condition: (stats: AchievementStats) => boolean;
  getProgress?: (stats: AchievementStats) => AchievementProgress;
}

/** XP reward per tier (epic grants a token instead) */
export const TIER_XP: Record<AchievementTier, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
  epic: 0,
};

/** Token reward per tier */
export const TIER_TOKENS: Record<AchievementTier, number> = {
  easy: 0,
  medium: 0,
  hard: 0,
  epic: 1,
};

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

function flag(key: string): (s: AchievementStats) => boolean {
  return (s) => s.flags[key] === true;
}

function allFlags(...keys: string[]): (s: AchievementStats) => boolean {
  return (s) => keys.every((k) => s.flags[k] === true);
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
  'uno',
  'tictactoe_offline',
  'sudoku',
  '2048',
  'snake',
  'tetris',
  'flappy',
  'pong',
  'breakout',
  'minesweeper',
] as const;

export type AchievementCategory = (typeof CATEGORY_ORDER)[number];

// ── Definitions ────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── General ──────────────────────────────────────────────────────────────────
  {
    id: 'general.play_10',
    icon: '🎮',
    nameKey: 'achievements.general.play_10.name',
    descKey: 'achievements.general.play_10.desc',
    tags: ['general'],
    tier: 'easy',
    condition: (s) => s.playsTotal >= 10,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 10), target: 10 }),
  },
  {
    id: 'general.play_25',
    icon: '🎮',
    nameKey: 'achievements.general.play_25.name',
    descKey: 'achievements.general.play_25.desc',
    tags: ['general'],
    tier: 'medium',
    condition: (s) => s.playsTotal >= 25,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 25), target: 25 }),
  },
  {
    id: 'general.play_50',
    icon: '🎮',
    nameKey: 'achievements.general.play_50.name',
    descKey: 'achievements.general.play_50.desc',
    tags: ['general'],
    tier: 'hard',
    condition: (s) => s.playsTotal >= 50,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 50), target: 50 }),
  },
  {
    id: 'general.play_100',
    icon: '🎮',
    nameKey: 'achievements.general.play_100.name',
    descKey: 'achievements.general.play_100.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.playsTotal >= 100,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 100), target: 100 }),
  },
  {
    id: 'general.play_500',
    icon: '🎮',
    nameKey: 'achievements.general.play_500.name',
    descKey: 'achievements.general.play_500.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.playsTotal >= 500,
    getProgress: (s) => ({ current: Math.min(s.playsTotal, 500), target: 500 }),
  },
  {
    id: 'general.win_10',
    icon: '🏆',
    nameKey: 'achievements.general.win_10.name',
    descKey: 'achievements.general.win_10.desc',
    tags: ['general'],
    tier: 'easy',
    condition: (s) => s.winsTotal >= 10,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 10), target: 10 }),
  },
  {
    id: 'general.win_25',
    icon: '🏆',
    nameKey: 'achievements.general.win_25.name',
    descKey: 'achievements.general.win_25.desc',
    tags: ['general'],
    tier: 'medium',
    condition: (s) => s.winsTotal >= 25,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 25), target: 25 }),
  },
  {
    id: 'general.win_50',
    icon: '🏆',
    nameKey: 'achievements.general.win_50.name',
    descKey: 'achievements.general.win_50.desc',
    tags: ['general'],
    tier: 'hard',
    condition: (s) => s.winsTotal >= 50,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 50), target: 50 }),
  },
  {
    id: 'general.win_100',
    icon: '👑',
    nameKey: 'achievements.general.win_100.name',
    descKey: 'achievements.general.win_100.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.winsTotal >= 100,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 100), target: 100 }),
  },
  {
    id: 'general.win_250',
    icon: '👑',
    nameKey: 'achievements.general.win_250.name',
    descKey: 'achievements.general.win_250.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.winsTotal >= 250,
    getProgress: (s) => ({ current: Math.min(s.winsTotal, 250), target: 250 }),
  },
  {
    id: 'general.lose_1000',
    icon: '😢',
    nameKey: 'achievements.general.lose_1000.name',
    descKey: 'achievements.general.lose_1000.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.lossesTotal >= 1000,
    getProgress: (s) => ({ current: Math.min(s.lossesTotal, 1000), target: 1000 }),
  },
  {
    id: 'general.lobby_master',
    icon: '🏠',
    nameKey: 'achievements.general.lobby_master.name',
    descKey: 'achievements.general.lobby_master.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.lobbiesHosted >= 100,
    getProgress: (s) => ({ current: Math.min(s.lobbiesHosted, 100), target: 100 }),
  },
  {
    id: 'general.social_gamer',
    icon: '📨',
    nameKey: 'achievements.general.social_gamer.name',
    descKey: 'achievements.general.social_gamer.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.invitesTotal >= 100,
    getProgress: (s) => ({ current: Math.min(s.invitesTotal, 100), target: 100 }),
  },
  {
    id: 'general.level_40',
    icon: '⭐',
    nameKey: 'achievements.general.level_40.name',
    descKey: 'achievements.general.level_40.desc',
    tags: ['general'],
    tier: 'epic',
    condition: (s) => s.level >= 40,
    getProgress: (s) => ({ current: Math.min(s.level, 40), target: 40 }),
  },
  {
    id: 'general.all_unlocked',
    icon: '🌟',
    nameKey: 'achievements.general.all_unlocked.name',
    descKey: 'achievements.general.all_unlocked.desc',
    tags: ['general'],
    tier: 'epic',
    // -1 because we exclude this achievement itself
    condition: (s) => s.totalUnlocked >= ACHIEVEMENTS.length - 1,
  },
  {
    id: 'general.profile_custom',
    icon: '🎨',
    nameKey: 'achievements.general.profile_custom.name',
    descKey: 'achievements.general.profile_custom.desc',
    tags: ['general'],
    tier: 'easy',
    condition: (s) => s.profileCustomized === true,
  },
  {
    id: 'general.daily_master',
    icon: '📋',
    nameKey: 'achievements.general.daily_master.name',
    descKey: 'achievements.general.daily_master.desc',
    tags: ['general'],
    tier: 'hard',
    condition: flag('all_dailies_completed'),
  },
  {
    id: 'general.daily_week',
    icon: '📅',
    nameKey: 'achievements.general.daily_week.name',
    descKey: 'achievements.general.daily_week.desc',
    tags: ['general'],
    tier: 'hard',
    condition: flag('daily_week_streak'),
  },
  {
    id: 'general.win_streak_5',
    icon: '🔥',
    nameKey: 'achievements.general.win_streak_5.name',
    descKey: 'achievements.general.win_streak_5.desc',
    tags: ['general'],
    tier: 'medium',
    condition: (s) => s.maxWinStreak >= 5,
    getProgress: (s) => ({ current: Math.min(s.maxWinStreak, 5), target: 5 }),
  },
  {
    id: 'general.gotd',
    icon: '📆',
    nameKey: 'achievements.general.gotd.name',
    descKey: 'achievements.general.gotd.desc',
    tags: ['general'],
    tier: 'easy',
    condition: flag('gotd_played'),
  },
  {
    id: 'general.public_join',
    icon: '🌐',
    nameKey: 'achievements.general.public_join.name',
    descKey: 'achievements.general.public_join.desc',
    tags: ['general'],
    tier: 'easy',
    condition: (s) => s.publicGamesJoined >= 1,
  },
  {
    id: 'general.first_message',
    icon: '💬',
    nameKey: 'achievements.general.first_message.name',
    descKey: 'achievements.general.first_message.desc',
    tags: ['general'],
    tier: 'easy',
    condition: (s) => s.messagesSent >= 1,
  },

  // ── Tic-Tac-Toe (online) ──────────────────────────────────────────────────
  {
    id: 'tictactoe.first_win',
    icon: '✖️',
    nameKey: 'achievements.tictactoe.first_win.name',
    descKey: 'achievements.tictactoe.first_win.desc',
    tags: ['tictactoe'],
    tier: 'easy',
    condition: wins('tictactoe', 1),
    getProgress: winsProgress('tictactoe', 1),
  },
  {
    id: 'tictactoe.play_10',
    icon: '🎯',
    nameKey: 'achievements.tictactoe.play_10.name',
    descKey: 'achievements.tictactoe.play_10.desc',
    tags: ['tictactoe'],
    tier: 'medium',
    condition: plays('tictactoe', 10),
    getProgress: playsProgress('tictactoe', 10),
  },
  {
    id: 'tictactoe.win_streak_10',
    icon: '🔥',
    nameKey: 'achievements.tictactoe.win_streak_10.name',
    descKey: 'achievements.tictactoe.win_streak_10.desc',
    tags: ['tictactoe'],
    tier: 'hard',
    condition: (s) => s.tttMaxWinStreak >= 10,
    getProgress: (s) => ({ current: Math.min(s.tttMaxWinStreak, 10), target: 10 }),
  },

  // ── Connect 4 ────────────────────────────────────────────────────────────────
  {
    id: 'connect4.first_win',
    icon: '🔴',
    nameKey: 'achievements.connect4.first_win.name',
    descKey: 'achievements.connect4.first_win.desc',
    tags: ['connect4'],
    tier: 'easy',
    condition: wins('connect4', 1),
    getProgress: winsProgress('connect4', 1),
  },
  {
    id: 'connect4.play_10',
    icon: '🏅',
    nameKey: 'achievements.connect4.play_10.name',
    descKey: 'achievements.connect4.play_10.desc',
    tags: ['connect4'],
    tier: 'medium',
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
    tier: 'easy',
    condition: wins('rps', 1),
    getProgress: winsProgress('rps', 1),
  },
  {
    id: 'rps.play_10',
    icon: '🤜',
    nameKey: 'achievements.rps.play_10.name',
    descKey: 'achievements.rps.play_10.desc',
    tags: ['rps'],
    tier: 'medium',
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
    tier: 'easy',
    condition: wins('chess', 1),
    getProgress: winsProgress('chess', 1),
  },
  {
    id: 'chess.play_10',
    icon: '♜',
    nameKey: 'achievements.chess.play_10.name',
    descKey: 'achievements.chess.play_10.desc',
    tags: ['chess'],
    tier: 'medium',
    condition: plays('chess', 10),
    getProgress: playsProgress('chess', 10),
  },

  // ── Battleship ───────────────────────────────────────────────────────────────
  {
    id: 'battleship.first_win',
    icon: '🚢',
    nameKey: 'achievements.battleship.first_win.name',
    descKey: 'achievements.battleship.first_win.desc',
    tags: ['battleship'],
    tier: 'easy',
    condition: wins('battleship', 1),
    getProgress: winsProgress('battleship', 1),
  },
  {
    id: 'battleship.play_10',
    icon: '⚓',
    nameKey: 'achievements.battleship.play_10.name',
    descKey: 'achievements.battleship.play_10.desc',
    tags: ['battleship'],
    tier: 'medium',
    condition: plays('battleship', 10),
    getProgress: playsProgress('battleship', 10),
  },
  {
    id: 'battleship.flawless',
    icon: '🛡️',
    nameKey: 'achievements.battleship.flawless.name',
    descKey: 'achievements.battleship.flawless.desc',
    tags: ['battleship'],
    tier: 'hard',
    condition: flag('battleship_flawless'),
  },

  // ── Liar's Deck ──────────────────────────────────────────────────────────────
  {
    id: 'liarsbar.first_win',
    icon: '🃏',
    nameKey: 'achievements.liarsbar.first_win.name',
    descKey: 'achievements.liarsbar.first_win.desc',
    tags: ['liarsbar'],
    tier: 'easy',
    condition: wins('liarsbar', 1),
    getProgress: winsProgress('liarsbar', 1),
  },
  {
    id: 'liarsbar.play_10',
    icon: '🎲',
    nameKey: 'achievements.liarsbar.play_10.name',
    descKey: 'achievements.liarsbar.play_10.desc',
    tags: ['liarsbar'],
    tier: 'medium',
    condition: plays('liarsbar', 10),
    getProgress: playsProgress('liarsbar', 10),
  },
  {
    id: 'liarsbar.honest',
    icon: '😇',
    nameKey: 'achievements.liarsbar.honest.name',
    descKey: 'achievements.liarsbar.honest.desc',
    tags: ['liarsbar'],
    tier: 'hard',
    condition: flag('liarsbar_honest'),
  },

  // ── UNO ──────────────────────────────────────────────────────────────────────
  {
    id: 'uno.first_win',
    icon: '🟥',
    nameKey: 'achievements.uno.first_win.name',
    descKey: 'achievements.uno.first_win.desc',
    tags: ['uno'],
    tier: 'easy',
    condition: wins('uno', 1),
    getProgress: winsProgress('uno', 1),
  },
  {
    id: 'uno.play_10',
    icon: '🃏',
    nameKey: 'achievements.uno.play_10.name',
    descKey: 'achievements.uno.play_10.desc',
    tags: ['uno'],
    tier: 'medium',
    condition: plays('uno', 10),
    getProgress: playsProgress('uno', 10),
  },
  {
    id: 'uno.wild_draw4_finish',
    icon: '🌈',
    nameKey: 'achievements.uno.wild_draw4_finish.name',
    descKey: 'achievements.uno.wild_draw4_finish.desc',
    tags: ['uno'],
    tier: 'hard',
    condition: flag('uno_wild_draw4_finish'),
  },

  // ── TicTacToe Offline ────────────────────────────────────────────────────────
  {
    id: 'tictactoe_offline.local_play',
    icon: '🤝',
    nameKey: 'achievements.tictactoe_offline.local_play.name',
    descKey: 'achievements.tictactoe_offline.local_play.desc',
    tags: ['tictactoe_offline'],
    tier: 'easy',
    condition: flag('ttt_offline_local'),
  },
  {
    id: 'tictactoe_offline.ai_play',
    icon: '🤖',
    nameKey: 'achievements.tictactoe_offline.ai_play.name',
    descKey: 'achievements.tictactoe_offline.ai_play.desc',
    tags: ['tictactoe_offline'],
    tier: 'easy',
    condition: flag('ttt_offline_ai'),
  },
  {
    id: 'tictactoe_offline.ai_easy_win',
    icon: '😊',
    nameKey: 'achievements.tictactoe_offline.ai_easy_win.name',
    descKey: 'achievements.tictactoe_offline.ai_easy_win.desc',
    tags: ['tictactoe_offline'],
    tier: 'easy',
    condition: flag('ttt_offline_ai_easy_win'),
  },
  {
    id: 'tictactoe_offline.ai_normal_win',
    icon: '😤',
    nameKey: 'achievements.tictactoe_offline.ai_normal_win.name',
    descKey: 'achievements.tictactoe_offline.ai_normal_win.desc',
    tags: ['tictactoe_offline'],
    tier: 'medium',
    condition: flag('ttt_offline_ai_normal_win'),
  },
  {
    id: 'tictactoe_offline.ai_hard_win',
    icon: '🧠',
    nameKey: 'achievements.tictactoe_offline.ai_hard_win.name',
    descKey: 'achievements.tictactoe_offline.ai_hard_win.desc',
    tags: ['tictactoe_offline'],
    tier: 'hard',
    condition: flag('ttt_offline_ai_hard_win'),
  },

  // ── 2048 ─────────────────────────────────────────────────────────────────────
  {
    id: '2048.play_1',
    icon: '🔢',
    nameKey: 'achievements.2048.play_1.name',
    descKey: 'achievements.2048.play_1.desc',
    tags: ['2048'],
    tier: 'easy',
    condition: plays('2048', 1),
    getProgress: playsProgress('2048', 1),
  },
  {
    id: '2048.play_10',
    icon: '🧮',
    nameKey: 'achievements.2048.play_10.name',
    descKey: 'achievements.2048.play_10.desc',
    tags: ['2048'],
    tier: 'medium',
    condition: plays('2048', 10),
    getProgress: playsProgress('2048', 10),
  },
  {
    id: '2048.reach_2048',
    icon: '🏆',
    nameKey: 'achievements.2048.reach_2048.name',
    descKey: 'achievements.2048.reach_2048.desc',
    tags: ['2048'],
    tier: 'medium',
    condition: flag('2048_reach_2048'),
  },
  {
    id: '2048.reach_4096',
    icon: '👑',
    nameKey: 'achievements.2048.reach_4096.name',
    descKey: 'achievements.2048.reach_4096.desc',
    tags: ['2048'],
    tier: 'hard',
    condition: flag('2048_reach_4096'),
  },

  // ── Snake ────────────────────────────────────────────────────────────────────
  {
    id: 'snake.play_1',
    icon: '🐍',
    nameKey: 'achievements.snake.play_1.name',
    descKey: 'achievements.snake.play_1.desc',
    tags: ['snake'],
    tier: 'easy',
    condition: plays('snake', 1),
    getProgress: playsProgress('snake', 1),
  },
  {
    id: 'snake.play_10',
    icon: '🐍',
    nameKey: 'achievements.snake.play_10.name',
    descKey: 'achievements.snake.play_10.desc',
    tags: ['snake'],
    tier: 'medium',
    condition: plays('snake', 10),
    getProgress: playsProgress('snake', 10),
  },
  {
    id: 'snake.score_25',
    icon: '🍎',
    nameKey: 'achievements.snake.score_25.name',
    descKey: 'achievements.snake.score_25.desc',
    tags: ['snake'],
    tier: 'medium',
    condition: flag('snake_score_25'),
  },
  {
    id: 'snake.score_50',
    icon: '🍎',
    nameKey: 'achievements.snake.score_50.name',
    descKey: 'achievements.snake.score_50.desc',
    tags: ['snake'],
    tier: 'hard',
    condition: flag('snake_score_50'),
  },

  // ── Sudoku ───────────────────────────────────────────────────────────────────
  {
    id: 'sudoku.play_1',
    icon: '#️⃣',
    nameKey: 'achievements.sudoku.play_1.name',
    descKey: 'achievements.sudoku.play_1.desc',
    tags: ['sudoku'],
    tier: 'easy',
    condition: plays('sudoku', 1),
    getProgress: playsProgress('sudoku', 1),
  },
  {
    id: 'sudoku.play_10',
    icon: '#️⃣',
    nameKey: 'achievements.sudoku.play_10.name',
    descKey: 'achievements.sudoku.play_10.desc',
    tags: ['sudoku'],
    tier: 'medium',
    condition: plays('sudoku', 10),
    getProgress: playsProgress('sudoku', 10),
  },
  {
    id: 'sudoku.easy',
    icon: '✅',
    nameKey: 'achievements.sudoku.easy.name',
    descKey: 'achievements.sudoku.easy.desc',
    tags: ['sudoku'],
    tier: 'easy',
    condition: flag('sudoku_easy'),
  },
  {
    id: 'sudoku.medium',
    icon: '✅',
    nameKey: 'achievements.sudoku.medium.name',
    descKey: 'achievements.sudoku.medium.desc',
    tags: ['sudoku'],
    tier: 'medium',
    condition: flag('sudoku_medium'),
  },
  {
    id: 'sudoku.hard',
    icon: '✅',
    nameKey: 'achievements.sudoku.hard.name',
    descKey: 'achievements.sudoku.hard.desc',
    tags: ['sudoku'],
    tier: 'hard',
    condition: flag('sudoku_hard'),
  },
  {
    id: 'sudoku.mastermind',
    icon: '🧩',
    nameKey: 'achievements.sudoku.mastermind.name',
    descKey: 'achievements.sudoku.mastermind.desc',
    tags: ['sudoku'],
    tier: 'hard',
    condition: allFlags('sudoku_easy', 'sudoku_medium', 'sudoku_hard'),
  },

  // ── Tetris ───────────────────────────────────────────────────────────────────
  {
    id: 'tetris.play_1',
    icon: '🧱',
    nameKey: 'achievements.tetris.play_1.name',
    descKey: 'achievements.tetris.play_1.desc',
    tags: ['tetris'],
    tier: 'easy',
    condition: plays('tetris', 1),
    getProgress: playsProgress('tetris', 1),
  },
  {
    id: 'tetris.play_10',
    icon: '🧱',
    nameKey: 'achievements.tetris.play_10.name',
    descKey: 'achievements.tetris.play_10.desc',
    tags: ['tetris'],
    tier: 'medium',
    condition: plays('tetris', 10),
    getProgress: playsProgress('tetris', 10),
  },

  // ── Flappy Bird ──────────────────────────────────────────────────────────────
  {
    id: 'flappy.play_1',
    icon: '🐦',
    nameKey: 'achievements.flappy.play_1.name',
    descKey: 'achievements.flappy.play_1.desc',
    tags: ['flappy'],
    tier: 'easy',
    condition: plays('flappy', 1),
    getProgress: playsProgress('flappy', 1),
  },
  {
    id: 'flappy.play_10',
    icon: '🐦',
    nameKey: 'achievements.flappy.play_10.name',
    descKey: 'achievements.flappy.play_10.desc',
    tags: ['flappy'],
    tier: 'medium',
    condition: plays('flappy', 10),
    getProgress: playsProgress('flappy', 10),
  },
  {
    id: 'flappy.score_50',
    icon: '🏅',
    nameKey: 'achievements.flappy.score_50.name',
    descKey: 'achievements.flappy.score_50.desc',
    tags: ['flappy'],
    tier: 'hard',
    condition: flag('flappy_score_50'),
  },

  // ── Pong ──────────────────────────────────────────────────────────────────
  {
    id: 'pong.play_1',
    icon: '🏓',
    nameKey: 'achievements.pong.play_1.name',
    descKey: 'achievements.pong.play_1.desc',
    tags: ['pong'],
    tier: 'easy',
    condition: plays('pong', 1),
    getProgress: playsProgress('pong', 1),
  },
  {
    id: 'pong.play_10',
    icon: '🏓',
    nameKey: 'achievements.pong.play_10.name',
    descKey: 'achievements.pong.play_10.desc',
    tags: ['pong'],
    tier: 'medium',
    condition: plays('pong', 10),
    getProgress: playsProgress('pong', 10),
  },
  {
    id: 'pong.win_easy',
    icon: '😊',
    nameKey: 'achievements.pong.win_easy.name',
    descKey: 'achievements.pong.win_easy.desc',
    tags: ['pong'],
    tier: 'easy',
    condition: flag('pong_win_easy'),
  },
  {
    id: 'pong.win_medium',
    icon: '😤',
    nameKey: 'achievements.pong.win_medium.name',
    descKey: 'achievements.pong.win_medium.desc',
    tags: ['pong'],
    tier: 'medium',
    condition: flag('pong_win_medium'),
  },
  {
    id: 'pong.win_hard',
    icon: '🏆',
    nameKey: 'achievements.pong.win_hard.name',
    descKey: 'achievements.pong.win_hard.desc',
    tags: ['pong'],
    tier: 'hard',
    condition: flag('pong_win_hard'),
  },

  // ── Breakout ──────────────────────────────────────────────────────────────
  {
    id: 'breakout.play_1',
    icon: '🧱',
    nameKey: 'achievements.breakout.play_1.name',
    descKey: 'achievements.breakout.play_1.desc',
    tags: ['breakout'],
    tier: 'easy',
    condition: plays('breakout', 1),
    getProgress: playsProgress('breakout', 1),
  },
  {
    id: 'breakout.play_10',
    icon: '🧱',
    nameKey: 'achievements.breakout.play_10.name',
    descKey: 'achievements.breakout.play_10.desc',
    tags: ['breakout'],
    tier: 'medium',
    condition: plays('breakout', 10),
    getProgress: playsProgress('breakout', 10),
  },

  // ── Minesweeper ─────────────────────────────────────────────────────────────
  {
    id: 'minesweeper.play_1',
    icon: '💣',
    nameKey: 'achievements.minesweeper.play_1.name',
    descKey: 'achievements.minesweeper.play_1.desc',
    tags: ['minesweeper'],
    tier: 'easy',
    condition: plays('minesweeper', 1),
    getProgress: playsProgress('minesweeper', 1),
  },
  {
    id: 'minesweeper.play_10',
    icon: '💣',
    nameKey: 'achievements.minesweeper.play_10.name',
    descKey: 'achievements.minesweeper.play_10.desc',
    tags: ['minesweeper'],
    tier: 'medium',
    condition: plays('minesweeper', 10),
    getProgress: playsProgress('minesweeper', 10),
  },
  {
    id: 'minesweeper.easy',
    icon: '✅',
    nameKey: 'achievements.minesweeper.easy.name',
    descKey: 'achievements.minesweeper.easy.desc',
    tags: ['minesweeper'],
    tier: 'easy',
    condition: flag('minesweeper_easy'),
  },
  {
    id: 'minesweeper.medium',
    icon: '✅',
    nameKey: 'achievements.minesweeper.medium.name',
    descKey: 'achievements.minesweeper.medium.desc',
    tags: ['minesweeper'],
    tier: 'medium',
    condition: flag('minesweeper_medium'),
  },
  {
    id: 'minesweeper.hard',
    icon: '✅',
    nameKey: 'achievements.minesweeper.hard.name',
    descKey: 'achievements.minesweeper.hard.desc',
    tags: ['minesweeper'],
    tier: 'hard',
    condition: flag('minesweeper_hard'),
  },
  {
    id: 'minesweeper.master',
    icon: '🏆',
    nameKey: 'achievements.minesweeper.master.name',
    descKey: 'achievements.minesweeper.master.desc',
    tags: ['minesweeper'],
    tier: 'hard',
    condition: allFlags('minesweeper_easy', 'minesweeper_medium', 'minesweeper_hard'),
  },
];
