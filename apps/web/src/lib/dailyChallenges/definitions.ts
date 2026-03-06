import type { ChallengeTemplate, DailyChallenge } from './types';
import { mulberry32, hashString } from '@/lib/seededRandom';

// ── Challenge pool ───────────────────────────────────────────────────────────

export const CHALLENGE_POOL: ChallengeTemplate[] = [
  // Play game challenges
  { id: 'play_snake_2', type: 'play_game', gameId: 'snake', target: 2, nameKey: 'daily.play_snake_2.name', descKey: 'daily.play_snake_2.desc', icon: '🐍' },
  { id: 'play_tetris_2', type: 'play_game', gameId: 'tetris', target: 2, nameKey: 'daily.play_tetris_2.name', descKey: 'daily.play_tetris_2.desc', icon: '🧱' },
  { id: 'play_2048_2', type: 'play_game', gameId: '2048', target: 2, nameKey: 'daily.play_2048_2.name', descKey: 'daily.play_2048_2.desc', icon: '🔢' },
  { id: 'play_flappy_3', type: 'play_game', gameId: 'flappy', target: 3, nameKey: 'daily.play_flappy_3.name', descKey: 'daily.play_flappy_3.desc', icon: '🐦' },
  { id: 'play_minesweeper_2', type: 'play_game', gameId: 'minesweeper', target: 2, nameKey: 'daily.play_minesweeper_2.name', descKey: 'daily.play_minesweeper_2.desc', icon: '💣' },
  { id: 'play_sudoku_1', type: 'play_game', gameId: 'sudoku', target: 1, nameKey: 'daily.play_sudoku_1.name', descKey: 'daily.play_sudoku_1.desc', icon: '#️⃣' },
  { id: 'play_pong_2', type: 'play_game', gameId: 'pong', target: 2, nameKey: 'daily.play_pong_2.name', descKey: 'daily.play_pong_2.desc', icon: '🏓' },
  { id: 'play_breakout_2', type: 'play_game', gameId: 'breakout', target: 2, nameKey: 'daily.play_breakout_2.name', descKey: 'daily.play_breakout_2.desc', icon: '🧱' },

  // Win game challenges
  { id: 'win_minesweeper_1', type: 'win_game', gameId: 'minesweeper', target: 1, nameKey: 'daily.win_minesweeper_1.name', descKey: 'daily.win_minesweeper_1.desc', icon: '💣' },
  { id: 'win_sudoku_1', type: 'win_game', gameId: 'sudoku', target: 1, nameKey: 'daily.win_sudoku_1.name', descKey: 'daily.win_sudoku_1.desc', icon: '#️⃣' },
  { id: 'win_pong_1', type: 'win_game', gameId: 'pong', target: 1, nameKey: 'daily.win_pong_1.name', descKey: 'daily.win_pong_1.desc', icon: '🏓' },
  { id: 'win_breakout_1', type: 'win_game', gameId: 'breakout', target: 1, nameKey: 'daily.win_breakout_1.name', descKey: 'daily.win_breakout_1.desc', icon: '🧱' },
  { id: 'win_2048_1', type: 'win_game', gameId: '2048', target: 1, nameKey: 'daily.win_2048_1.name', descKey: 'daily.win_2048_1.desc', icon: '🔢' },

  // Play any game challenges
  { id: 'play_any_3', type: 'play_any', gameId: null, target: 3, nameKey: 'daily.play_any_3.name', descKey: 'daily.play_any_3.desc', icon: '🎮' },
  { id: 'play_any_5', type: 'play_any', gameId: null, target: 5, nameKey: 'daily.play_any_5.name', descKey: 'daily.play_any_5.desc', icon: '🎮' },
];

// ── Daily selection ──────────────────────────────────────────────────────────

const CHALLENGES_PER_DAY = 3;

/**
 * Deterministic: given the same dateStr, always returns the same 3 challenges.
 * Uses a seeded PRNG based on the date to pick from the pool.
 */
export function getDailyChallenges(dateStr: string): DailyChallenge[] {
  const seed = hashString('daily_challenges_' + dateStr);
  const rng = mulberry32(seed);

  // Shuffle pool indices using Fisher-Yates with our seeded RNG
  const indices = CHALLENGE_POOL.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Pick first N, ensuring no duplicate gameIds (except null for play_any)
  const picked: DailyChallenge[] = [];
  const usedGames = new Set<string>();

  for (const idx of indices) {
    if (picked.length >= CHALLENGES_PER_DAY) break;
    const tmpl = CHALLENGE_POOL[idx];
    if (tmpl.gameId && usedGames.has(tmpl.gameId)) continue;
    if (tmpl.gameId) usedGames.add(tmpl.gameId);
    picked.push({
      templateId: tmpl.id,
      type: tmpl.type,
      gameId: tmpl.gameId,
      target: tmpl.target,
      nameKey: tmpl.nameKey,
      descKey: tmpl.descKey,
      icon: tmpl.icon,
    });
  }

  return picked;
}

/** Returns today's date as YYYY-MM-DD string. */
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
