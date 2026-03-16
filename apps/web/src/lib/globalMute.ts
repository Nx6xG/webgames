'use client';

/**
 * Global audio volume control for all game sound effects.
 * Volume is stored as an integer 0-100.  "Muted" simply means volume === 0.
 *
 * Backward compat: if the old `webgames.globalMuted` key is set to '1' and no
 * volume key exists yet, we initialise volume to 0 and clean up the old key.
 */

const VOLUME_KEY = 'webgames.volume';
const OLD_MUTE_KEY = 'webgames.globalMuted';
const OLD_VOLUME_KEY = 'webgames.globalVolume';
const DEFAULT_VOLUME = 80;

/** One-time migration from the old mute/volume keys. */
function migrate(): void {
  if (typeof window === 'undefined') return;
  try {
    const alreadyMigrated = localStorage.getItem(VOLUME_KEY) !== null;
    if (alreadyMigrated) return;

    const oldMuted = localStorage.getItem(OLD_MUTE_KEY);
    const oldVol = localStorage.getItem(OLD_VOLUME_KEY);

    if (oldMuted === '1') {
      localStorage.setItem(VOLUME_KEY, '0');
    } else if (oldVol !== null) {
      localStorage.setItem(VOLUME_KEY, oldVol);
    }
    // Clean up old keys
    localStorage.removeItem(OLD_MUTE_KEY);
    localStorage.removeItem(OLD_VOLUME_KEY);
  } catch { /* localStorage unavailable */ }
}

let migrated = false;
function ensureMigrated() {
  if (!migrated) { migrate(); migrated = true; }
}

/** Get current global volume (0-100). */
export function getGlobalVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  ensureMigrated();
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    return v !== null ? Number(v) : DEFAULT_VOLUME;
  } catch { return DEFAULT_VOLUME; }
}

/** Set global volume (0-100). Clamped and rounded. */
export function setGlobalVolume(v: number): void {
  ensureMigrated();
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(v)))));
  } catch { /* */ }
}

/** Returns true when volume is 0. */
export function isGloballyMuted(): boolean {
  return getGlobalVolume() === 0;
}

/**
 * @deprecated Use setGlobalVolume(0) to mute, setGlobalVolume(v) to unmute.
 * Kept for backward compat — sets volume to 0 when muted.
 */
export function setGlobalMuted(v: boolean): void {
  if (v) {
    setGlobalVolume(0);
  }
  // When unmuting via this legacy API, restore to default if currently 0
  if (!v && getGlobalVolume() === 0) {
    setGlobalVolume(DEFAULT_VOLUME);
  }
}
