/**
 * Synthesized sound effects for Breakout.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.breakout.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

export function paddleHit() {
  se.tone(660, 0.06, 0.12, 'square');
}

export function brickHit() {
  se.tone(520, 0.05, 0.10, 'square');
}

export function wallHit() {
  se.tone(440, 0.04, 0.06, 'sine');
}

export function loseLife() {
  se.tone(330, 0.15, 0.10, 'triangle');
}

export function powerupCollect() {
  if (!se.getCtx()) return;
  se.tone(880, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(1100, 0.10, 0.10, 'sine'), 60);
}

export function extraLife() {
  if (!se.getCtx()) return;
  se.tone(660, 0.08, 0.08, 'sine');
  setTimeout(() => se.tone(880, 0.08, 0.08, 'sine'), 80);
  setTimeout(() => se.tone(1100, 0.12, 0.10, 'sine'), 160);
}

export function bossHit() {
  se.tone(200, 0.08, 0.12, 'sawtooth');
}

export function bossCrack() {
  se.tone(150, 0.12, 0.14, 'sawtooth');
}

export function levelUp() {
  if (!se.getCtx()) return;
  se.tone(440, 0.08, 0.08, 'sine');
  setTimeout(() => se.tone(554, 0.08, 0.08, 'sine'), 80);
  setTimeout(() => se.tone(660, 0.12, 0.10, 'sine'), 160);
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
