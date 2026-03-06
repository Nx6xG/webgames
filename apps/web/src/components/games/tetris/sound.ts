/**
 * Synthesized sound effects for Tetris.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.tetris.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Piece moves left/right. */
export function moveSound() {
  se.tone(300, 0.02, 0.04, 'sine');
}

/** Piece rotates. */
export function rotateSound() {
  se.tone(500, 0.04, 0.06, 'sine');
}

/** Piece soft-drops one row. */
export function softDropSound() {
  se.tone(200, 0.02, 0.03, 'sine');
}

/** Piece hard-drops and locks. */
export function hardDropSound() {
  se.tone(150, 0.08, 0.10, 'square');
}

/** Piece locks into place (natural gravity). */
export function lockSound() {
  se.tone(250, 0.06, 0.06, 'square');
}

/** Line(s) cleared. */
export function clearSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.08, 0.10, 'sine'), 60);
}

/** Tetris (4 lines cleared at once). */
export function tetrisSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.06, 0.08, 'sine'), 60);
  setTimeout(() => se.tone(784, 0.06, 0.08, 'sine'), 120);
  setTimeout(() => se.tone(1047, 0.12, 0.10, 'sine'), 180);
}

/** Hold piece. */
export function holdSound() {
  se.tone(440, 0.04, 0.06, 'triangle');
}

/** Game over. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(330, 0.12, 0.08, 'sine');
  setTimeout(() => se.tone(220, 0.20, 0.08, 'sine'), 120);
}
