/**
 * Synthesized sound effects for Geometry Dash.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.geometrydash.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Player jumps. */
export function jumpSound() {
  se.tone(520, 0.06, 0.08, 'sine');
}

/** Player dies / hits obstacle. */
export function deathSound() {
  if (!se.getCtx()) return;
  se.tone(200, 0.15, 0.10, 'square');
  setTimeout(() => se.tone(140, 0.25, 0.08, 'sawtooth'), 80);
}

/** Reached a new 10% checkpoint. */
export function checkpointSound() {
  if (!se.getCtx()) return;
  se.tone(660, 0.06, 0.06, 'sine');
  setTimeout(() => se.tone(880, 0.08, 0.08, 'sine'), 60);
}

/** Completed 100% — win! */
export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.08, 0.08, 'sine');
  setTimeout(() => se.tone(659, 0.08, 0.08, 'sine'), 80);
  setTimeout(() => se.tone(784, 0.08, 0.08, 'sine'), 160);
  setTimeout(() => se.tone(1047, 0.15, 0.10, 'sine'), 240);
}

/** Countdown tick. */
export function countdownBeep() {
  se.tone(440, 0.06, 0.06, 'sine');
}

/** Countdown go. */
export function countdownGo() {
  se.tone(880, 0.10, 0.08, 'sine');
}
