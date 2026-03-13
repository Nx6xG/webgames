/**
 * Synthesized sound effects for Sudoku.
 * Kept very subtle — Sudoku is a calm, focused game.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.sudoku.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Placing a valid number — soft click. */
export function placeSound() {
  se.tone(400, 0.02, 0.04, 'sine');
}

/** Erasing a number — softer, lower tone. */
export function eraseSound() {
  se.tone(250, 0.02, 0.03, 'sine');
}

/** Placing a conflicting number — low buzz. */
export function errorSound() {
  se.tone(150, 0.06, 0.05, 'square');
}

/** Completing the puzzle — ascending arpeggio C-E-G-C. */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.10, 0.06, 'sine');   // C5
  setTimeout(() => se.tone(659, 0.10, 0.06, 'sine'), 100);  // E5
  setTimeout(() => se.tone(784, 0.10, 0.06, 'sine'), 200);  // G5
  setTimeout(() => se.tone(1047, 0.16, 0.08, 'sine'), 300);  // C6
}
