import { isGloballyMuted } from '@/lib/globalMute';

const AC = () => {
  if (typeof window === 'undefined') return null;
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
};

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) ctx = AC();
  return ctx;
};

let _muted = false;
export function isMuted() { return _muted; }
export function setMuted(v: boolean) { _muted = v; }

function play(fn: (c: AudioContext) => void) {
  if (_muted || isGloballyMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  try { fn(c); } catch { /* */ }
}

export function kickSound() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.15);
    g.gain.setValueAtTime(0.4, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.2);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.2);
  });
}

export function saveSound() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(300, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.3);
    g.gain.setValueAtTime(0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.3);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.3);
  });
}

export function goalSound() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(440, c.currentTime);
    o.frequency.setValueAtTime(550, c.currentTime + 0.1);
    o.frequency.setValueAtTime(660, c.currentTime + 0.2);
    g.gain.setValueAtTime(0.25, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.4);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.4);
  });
}

export function missSound() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.3);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.3);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.3);
  });
}

export function whistleSound() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(800, c.currentTime);
    o.frequency.setValueAtTime(600, c.currentTime + 0.15);
    o.frequency.setValueAtTime(800, c.currentTime + 0.3);
    g.gain.setValueAtTime(0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.5);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.5);
  });
}

export function crowdCheer() {
  play(c => {
    // White noise burst for crowd cheer
    const bufferSize = c.sampleRate * 0.6;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1200;
    filt.Q.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.6);
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
  });
}

export function countdownBeep() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 600;
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.15);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.15);
  });
}

export function countdownGo() {
  play(c => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 900;
    g.gain.setValueAtTime(0.25, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.2);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.2);
  });
}

export function winSound() {
  play(c => {
    [440, 550, 660, 880].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + i * 0.12);
      g.gain.linearRampToValueAtTime(0.2, c.currentTime + i * 0.12 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + i * 0.12 + 0.3);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + i * 0.12);
      o.stop(c.currentTime + i * 0.12 + 0.3);
    });
  });
}

export function loseSound() {
  play(c => {
    [300, 250, 200].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + i * 0.2);
      g.gain.linearRampToValueAtTime(0.2, c.currentTime + i * 0.2 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + i * 0.2 + 0.4);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + i * 0.2);
      o.stop(c.currentTime + i * 0.2 + 0.4);
    });
  });
}
