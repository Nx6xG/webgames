/**
 * Synthesized sound effects for Flappy Bird.
 * Kept light and subtle to match the game's feel.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.flappy.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Wing flap — short breathy puff. */
export function flapSound() {
  se.tone(280, 0.03, 0.06, 'triangle');
}

/** Passing through pipes — pleasant ding. */
export function scoreSound() {
  se.tone(660, 0.08, 0.07, 'sine');
}

/** Colliding with pipe or ground — low thud. */
export function hitSound() {
  se.tone(120, 0.10, 0.10, 'square');
}

/** Countdown tick. */
export function countdownBeep() {
  se.tone(440, 0.06, 0.06, 'sine');
}

/** Countdown "GO" — higher pitch ding. */
export function countdownGo() {
  se.tone(880, 0.10, 0.08, 'sine');
}
