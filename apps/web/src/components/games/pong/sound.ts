/**
 * Synthesized sound effects for Pong.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.pong.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

export function paddleHit() {
  se.tone(660, 0.06, 0.12, 'square');
}

export function wallHit() {
  se.tone(440, 0.04, 0.06, 'sine');
}

export function goalScored() {
  se.tone(330, 0.15, 0.10, 'triangle');
}

export function countdownBeep() {
  se.tone(520, 0.08, 0.08, 'sine');
}

export function countdownGo() {
  se.tone(780, 0.12, 0.10, 'sine');
}

export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.12, 0.10, 'sine');
  setTimeout(() => se.tone(784, 0.18, 0.10, 'sine'), 120);
}

export function loseSound() {
  if (!se.getCtx()) return;
  se.tone(330, 0.12, 0.08, 'sine');
  setTimeout(() => se.tone(220, 0.20, 0.08, 'sine'), 120);
}
