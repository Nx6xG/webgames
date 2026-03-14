/**
 * Synthesized sound effects for Asteroids.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.asteroids.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Bullet fired. */
export function shootSound() {
  se.tone(880, 0.06, 0.05, 'square');
}

/** Asteroid explosion (small). */
export function explosionSound() {
  if (!se.getCtx()) return;
  se.tone(100, 0.15, 0.08, 'sawtooth');
  setTimeout(() => se.tone(60, 0.20, 0.06, 'sawtooth'), 40);
}

/** Big asteroid explosion. */
export function bigExplosionSound() {
  if (!se.getCtx()) return;
  se.tone(80, 0.20, 0.10, 'sawtooth');
  setTimeout(() => se.tone(50, 0.30, 0.08, 'sawtooth'), 60);
  setTimeout(() => se.tone(30, 0.25, 0.06, 'sawtooth'), 120);
}

/** Ship thrust. */
export function thrustSound() {
  se.tone(60, 0.04, 0.02, 'sawtooth');
}

/** Ship destroyed. */
export function deathSound() {
  if (!se.getCtx()) return;
  se.tone(200, 0.15, 0.10, 'square');
  setTimeout(() => se.tone(120, 0.20, 0.08, 'square'), 80);
  setTimeout(() => se.tone(60, 0.30, 0.06, 'square'), 160);
}

/** Level/wave completed. */
export function levelUpSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.06, 'sine');
  setTimeout(() => se.tone(659, 0.06, 0.06, 'sine'), 80);
  setTimeout(() => se.tone(784, 0.08, 0.06, 'sine'), 160);
}

/** Game over. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(330, 0.12, 0.08, 'sine');
  setTimeout(() => se.tone(220, 0.20, 0.08, 'sine'), 120);
  setTimeout(() => se.tone(110, 0.30, 0.06, 'sine'), 240);
}

/** Countdown beep. */
export function countdownBeep() {
  se.tone(440, 0.08, 0.05, 'sine');
}

/** Countdown go. */
export function countdownGo() {
  se.tone(880, 0.12, 0.06, 'sine');
}
