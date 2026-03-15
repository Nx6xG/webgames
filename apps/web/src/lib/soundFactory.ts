/**
 * Shared Web Audio API sound infrastructure.
 * Each game creates its own SoundEngine instance with a unique mute key.
 */

import { isGloballyMuted, getGlobalVolume } from '@/lib/globalMute';

export interface SoundEngine {
  /** Check if this game's sounds are muted (per-game or global). */
  isMuted(): boolean;
  /** Set per-game mute state. */
  setMuted(v: boolean): void;
  /** Play a single tone. Returns immediately if muted. */
  tone(freq: number, duration: number, volume: number, type?: OscillatorType): void;
  /** Get AudioContext (for multi-tone sounds that need setTimeout). Null if muted. */
  getCtx(): AudioContext | null;
}

export function createSoundEngine(muteKey: string): SoundEngine {
  let ctx: AudioContext | null = null;
  let muted = false;

  function isMutedFn(): boolean {
    if (typeof window === 'undefined') return false;
    try { muted = localStorage.getItem(muteKey) === '1'; } catch {}
    return muted;
  }

  function setMutedFn(v: boolean): void {
    muted = v;
    try { localStorage.setItem(muteKey, v ? '1' : '0'); } catch {}
  }

  function getCtxFn(): AudioContext | null {
    if (muted || isGloballyMuted()) return null;
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function toneFn(freq: number, duration: number, volume: number, type: OscillatorType = 'square') {
    const ac = getCtxFn();
    if (!ac) return;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const masterVolume = getGlobalVolume() / 100;
    gain.gain.setValueAtTime(volume * masterVolume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  }

  return {
    isMuted: isMutedFn,
    setMuted: setMutedFn,
    tone: toneFn,
    getCtx: getCtxFn,
  };
}
