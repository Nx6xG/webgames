/**
 * Synthesized sound effects for Fruit Ninja.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.fruitninja.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

export function sliceSound() {
  if (!se.getCtx()) return;
  se.tone(800, 0.06, 0.10, 'sawtooth');
  setTimeout(() => se.tone(1200, 0.04, 0.06, 'sawtooth'), 30);
}

export function splashSound() {
  se.tone(300, 0.08, 0.08, 'sine');
}

export function bombSound() {
  if (!se.getCtx()) return;
  se.tone(100, 0.20, 0.15, 'sawtooth');
  setTimeout(() => se.tone(60, 0.30, 0.12, 'square'), 80);
}

export function missSound() {
  se.tone(220, 0.12, 0.06, 'triangle');
}

export function comboSound() {
  if (!se.getCtx()) return;
  se.tone(660, 0.06, 0.08, 'sine');
  setTimeout(() => se.tone(880, 0.06, 0.08, 'sine'), 50);
  setTimeout(() => se.tone(1100, 0.08, 0.10, 'sine'), 100);
}

export function winSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.12, 0.10, 'sine');
  setTimeout(() => se.tone(659, 0.12, 0.10, 'sine'), 120);
  setTimeout(() => se.tone(784, 0.18, 0.12, 'sine'), 240);
}

export function loseSound() {
  if (!se.getCtx()) return;
  se.tone(330, 0.12, 0.08, 'sine');
  setTimeout(() => se.tone(220, 0.20, 0.08, 'sine'), 120);
}
