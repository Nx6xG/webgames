/**
 * Synthesized sound effects for Minesweeper.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.minesweeper.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Single cell reveal — short soft click. */
export function revealSound() {
  se.tone(800, 0.03, 0.06, 'sine');
}

/** Flood reveal — gentle sweep of multiple cells. */
export function floodSound() {
  se.tone(600, 0.08, 0.08, 'sine');
  setTimeout(() => se.tone(700, 0.06, 0.06, 'sine'), 40);
}

/** Place a flag. */
export function flagSound() {
  se.tone(900, 0.05, 0.08, 'square');
}

/** Remove a flag. */
export function unflagSound() {
  se.tone(500, 0.05, 0.06, 'square');
}

/** Clicked a mine — low rumble. */
export function explosionSound() {
  se.tone(100, 0.25, 0.14, 'sawtooth');
  setTimeout(() => se.tone(60, 0.30, 0.10, 'sawtooth'), 80);
}

/** Win — ascending three-tone jingle. */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.10, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.10, 0.08, 'sine'), 100);
  setTimeout(() => se.tone(784, 0.16, 0.10, 'sine'), 200);
}
