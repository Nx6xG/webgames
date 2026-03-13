/**
 * Synthesized sound effects for 2048.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.2048.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Tiles sliding across the board. */
export function slideSound() {
  se.tone(300, 0.03, 0.04, 'sine');
}

/** Two tiles merge together. */
export function mergeSound() {
  se.tone(500, 0.04, 0.06, 'sine');
}

/** Merging into a high-value tile (512+). */
export function bigMergeSound() {
  se.tone(700, 0.05, 0.08, 'sine');
}

/** No more moves — game over. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(400, 0.12, 0.06, 'sine');
  setTimeout(() => se.tone(300, 0.15, 0.06, 'sine'), 120);
  setTimeout(() => se.tone(200, 0.25, 0.06, 'sine'), 260);
}

/** Reaching 2048 — ascending arpeggio. */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.08, 0.06, 'sine');
  setTimeout(() => se.tone(659, 0.08, 0.06, 'sine'), 80);
  setTimeout(() => se.tone(784, 0.08, 0.06, 'sine'), 160);
  setTimeout(() => se.tone(1047, 0.15, 0.08, 'sine'), 240);
}
