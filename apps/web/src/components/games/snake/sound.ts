/**
 * Synthesized sound effects for Snake.
 * Kept subtle — sine waves at low volumes for a clean feel.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.snake.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Eating food — happy ascending two-note chirp. */
export function eatSound() {
  if (!se.getCtx()) return;
  se.tone(520, 0.06, 0.06, 'sine');
  setTimeout(() => se.tone(780, 0.08, 0.07, 'sine'), 50);
}

/** Changing direction — very subtle tick. */
export function turnSound() {
  se.tone(400, 0.015, 0.03, 'sine');
}

/** Game over — descending sad tone. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(400, 0.15, 0.07, 'sine');
  setTimeout(() => se.tone(260, 0.25, 0.06, 'sine'), 140);
}

/** Speed mode milestone — ascending arpeggio (every 10 points). */
export function bonusSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.05, 0.05, 'sine');
  setTimeout(() => se.tone(659, 0.05, 0.05, 'sine'), 50);
  setTimeout(() => se.tone(784, 0.05, 0.05, 'sine'), 100);
  setTimeout(() => se.tone(1047, 0.10, 0.06, 'sine'), 150);
}
