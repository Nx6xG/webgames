/**
 * Synthesized sound effects for Doodle Jump.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.doodlejump.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

/** Normal platform bounce — short pop. */
export function jumpSound() {
  se.tone(440, 0.04, 0.06, 'triangle');
}

/** Spring bounce — higher pitch. */
export function springSound() {
  se.tone(880, 0.06, 0.08, 'sine');
}

/** Breakable platform cracking. */
export function breakSound() {
  se.tone(180, 0.08, 0.07, 'square');
}

/** Game over — descending tone. */
export function gameOverSound() {
  se.tone(150, 0.2, 0.1, 'sawtooth');
  const ctx = se.getCtx();
  if (ctx) setTimeout(() => se.tone(100, 0.3, 0.08, 'sawtooth'), 200);
}

/** Score milestone ding. */
export function scoreSound() {
  se.tone(660, 0.04, 0.05, 'sine');
}

/** Countdown tick. */
export function countdownBeep() {
  se.tone(440, 0.06, 0.06, 'sine');
}

/** Countdown "GO". */
export function countdownGo() {
  se.tone(880, 0.10, 0.08, 'sine');
}
