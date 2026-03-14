/**
 * Synthesized sound effects for Pac-Man.
 * Uses Web Audio API via the shared sound factory.
 */

import { createSoundEngine } from '@/lib/soundFactory';

const se = createSoundEngine('webgames.pacman.muted');

export const isMuted = se.isMuted;
export const setMuted = se.setMuted;

// ── Public sounds ────────────────────────────────────────────────────────────

/** Eating a dot — quick blip. */
export function dotSound() {
  se.tone(600, 0.03, 0.04, 'sine');
}

/** Eating a power pellet — ascending chord. */
export function powerSound() {
  if (!se.getCtx()) return;
  se.tone(440, 0.08, 0.06, 'sine');
  setTimeout(() => se.tone(660, 0.08, 0.06, 'sine'), 60);
  setTimeout(() => se.tone(880, 0.1, 0.06, 'sine'), 120);
}

/** Eating a ghost — satisfying chomp. */
export function eatGhostSound() {
  if (!se.getCtx()) return;
  se.tone(200, 0.06, 0.06, 'square');
  setTimeout(() => se.tone(400, 0.06, 0.06, 'square'), 50);
  setTimeout(() => se.tone(800, 0.1, 0.07, 'square'), 100);
}

/** Pac-Man dies — descending sad wah. */
export function deathSound() {
  if (!se.getCtx()) return;
  se.tone(500, 0.12, 0.06, 'sine');
  setTimeout(() => se.tone(400, 0.12, 0.05, 'sine'), 100);
  setTimeout(() => se.tone(300, 0.15, 0.05, 'sine'), 200);
  setTimeout(() => se.tone(200, 0.2, 0.04, 'sine'), 300);
}

/** Level complete — happy ascending arpeggio. */
export function levelUpSound() {
  if (!se.getCtx()) return;
  se.tone(523, 0.06, 0.05, 'sine');
  setTimeout(() => se.tone(659, 0.06, 0.05, 'sine'), 60);
  setTimeout(() => se.tone(784, 0.06, 0.05, 'sine'), 120);
  setTimeout(() => se.tone(1047, 0.12, 0.06, 'sine'), 180);
}

/** Game over jingle. */
export function gameOverSound() {
  if (!se.getCtx()) return;
  se.tone(440, 0.15, 0.06, 'sine');
  setTimeout(() => se.tone(350, 0.15, 0.05, 'sine'), 150);
  setTimeout(() => se.tone(260, 0.25, 0.04, 'sine'), 300);
}
