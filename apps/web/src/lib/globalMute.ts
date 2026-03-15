'use client';

/**
 * Global audio settings for all game sound effects.
 * Supports both a volume slider (0-100) and a mute toggle.
 * Individual game mute states defer to this — if globally muted, no sound plays.
 */

const VOLUME_KEY = 'webgames.globalVolume';
const MUTE_KEY = 'webgames.globalMuted';

export function getGlobalVolume(): number {
  if (typeof window === 'undefined') return 80;
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    return v !== null ? Number(v) : 80;
  } catch { return 80; }
}

export function setGlobalVolume(v: number): void {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(v))))); } catch {}
}

export function isGloballyMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setGlobalMuted(v: boolean): void {
  try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch {}
}
