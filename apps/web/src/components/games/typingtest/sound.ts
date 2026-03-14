/**
 * Synthesized sound effects for Typing Test.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.typingtest.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Soft click for correct keystroke. */
export function keySound() {
  se.tone(600, 0.03, 0.04, 'sine');
}

/** Low buzz for incorrect keystroke. */
export function errorSound() {
  se.tone(150, 0.08, 0.06, 'square');
}

/** Rising arpeggio when test completes. */
export function completeSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.06, 0.08, 'sine'), 60);
  setTimeout(() => se.tone(784, 0.08, 0.10, 'sine'), 120);
}

/** Celebratory fanfare for high WPM. */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.06, 0.08, 'sine'), 80);
  setTimeout(() => se.tone(784, 0.06, 0.08, 'sine'), 160);
  setTimeout(() => se.tone(1047, 0.14, 0.12, 'sine'), 240);
}
