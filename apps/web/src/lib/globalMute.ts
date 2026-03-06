'use client';

/**
 * Global mute toggle for all game sound effects.
 * Individual game mute states defer to this — if globally muted, no sound plays.
 */

const GLOBAL_MUTE_KEY = 'webgames.globalMuted';

export function isGloballyMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(GLOBAL_MUTE_KEY) === '1'; } catch { return false; }
}

export function setGlobalMuted(v: boolean): void {
  try { localStorage.setItem(GLOBAL_MUTE_KEY, v ? '1' : '0'); } catch {}
}
