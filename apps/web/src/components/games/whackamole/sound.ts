/**
 * Synthesized sound effects for Whack-a-Mole.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.whackamole.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Normal mole whacked */
export function whackSound() {
  se.tone(300, 0.08, 0.14, 'square');
  setTimeout(() => se.tone(200, 0.06, 0.10, 'square'), 40);
}

/** Missed click */
export function missSound() {
  se.tone(180, 0.10, 0.06, 'triangle');
}

/** Mole popping up */
export function popUpSound() {
  se.tone(600, 0.05, 0.06, 'sine');
}

/** Golden mole whacked */
export function goldenSound() {
  if (!se.getCtx()) return;
  se.tone(880, 0.08, 0.10, 'sine');
  setTimeout(() => se.tone(1100, 0.08, 0.10, 'sine'), 60);
  setTimeout(() => se.tone(1320, 0.12, 0.12, 'sine'), 120);
}

/** Bomb mole hit */
export function bombSound() {
  if (!se.getCtx()) return;
  se.tone(100, 0.15, 0.16, 'sawtooth');
  setTimeout(() => se.tone(60, 0.20, 0.12, 'sawtooth'), 80);
}

/** Game over — good result */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.12, 0.10, 'sine');
  setTimeout(() => se.tone(659, 0.10, 0.10, 'sine'), 100);
  setTimeout(() => se.tone(784, 0.18, 0.12, 'sine'), 200);
}

/** Game over — poor result */
export function loseSound() {
  if (!se.getCtx()) return;
  se.tone(330, 0.12, 0.08, 'sine');
  setTimeout(() => se.tone(220, 0.20, 0.08, 'sine'), 120);
}

/** Countdown tick */
export function countdownBeep() {
  se.tone(880, 0.06, 0.08, 'square');
}

/** Countdown go */
export function countdownGo() {
  if (!se.getCtx()) return;
  se.tone(880, 0.08, 0.08, 'sine');
  setTimeout(() => se.tone(1100, 0.12, 0.10, 'sine'), 80);
}
