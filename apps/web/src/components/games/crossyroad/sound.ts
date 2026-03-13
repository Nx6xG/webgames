/**
 * Synthesized sound effects for Crossy Road.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.crossyroad.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

/** Hop forward/sideways — short bouncy chirp. */
export function hopSound() {
  se.tone(350, 0.03, 0.06, 'triangle');
}

/** Coin collected — ascending two-note sparkle. */
export function coinSound() {
  if (!se.getCtx()) return;
  se.tone(800, 0.05, 0.07, 'sine');
  setTimeout(() => se.tone(1000, 0.05, 0.06, 'sine'), 60);
}

/** Splash into water — wet buzz. */
export function splashSound() {
  se.tone(200, 0.12, 0.06, 'sawtooth');
}

/** Hit by vehicle — heavy thud. */
export function hitSound() {
  se.tone(120, 0.15, 0.09, 'square');
}

/** Train warning — two rapid beeps. */
export function trainWarningSound() {
  if (!se.getCtx()) return;
  se.tone(600, 0.06, 0.05, 'square');
  setTimeout(() => se.tone(600, 0.06, 0.05, 'square'), 120);
}

/** Game over — descending three-note sad tone. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(200, 0.15, 0.08, 'square');
  setTimeout(() => se.tone(150, 0.2, 0.07, 'square'), 150);
  setTimeout(() => se.tone(100, 0.3, 0.06, 'square'), 350);
}
