'use client';

// Procedural sound synthesis for Nexus Clash using Web Audio API
// No audio files needed — all sounds are generated on the fly

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, detune = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function playNoise(duration: number, volume = 0.05) {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  source.start();
}

export const ncAudio = {
  /** Card placed on lane */
  cardPlace() {
    playTone(220, 0.12, 'triangle', 0.1);
    playTone(330, 0.08, 'sine', 0.05);
  },

  /** Card removed / undo */
  cardUndo() {
    playTone(330, 0.1, 'triangle', 0.08);
    playTone(220, 0.12, 'sine', 0.05);
  },

  /** Confirm button pressed */
  confirm() {
    playTone(440, 0.15, 'sine', 0.1);
    setTimeout(() => playTone(660, 0.15, 'sine', 0.1), 80);
  },

  /** Card revealed during resolution */
  cardReveal() {
    playTone(523, 0.2, 'triangle', 0.08);
    playNoise(0.05, 0.03);
  },

  /** Legendary card revealed */
  legendaryReveal() {
    playTone(440, 0.5, 'sine', 0.12);
    setTimeout(() => playTone(554, 0.4, 'sine', 0.1), 100);
    setTimeout(() => playTone(660, 0.5, 'sine', 0.12), 200);
    setTimeout(() => playTone(880, 0.6, 'sine', 0.15), 350);
    playNoise(0.15, 0.04);
  },

  /** Epic card revealed */
  epicReveal() {
    playTone(440, 0.3, 'sine', 0.1);
    setTimeout(() => playTone(554, 0.3, 'sine', 0.1), 120);
    setTimeout(() => playTone(660, 0.4, 'sine', 0.1), 240);
  },

  /** Card destroyed */
  cardDestroy() {
    playTone(200, 0.3, 'sawtooth', 0.06);
    playTone(120, 0.4, 'sawtooth', 0.04);
    playNoise(0.15, 0.06);
  },

  /** Breakthrough achieved */
  breakthrough() {
    playTone(330, 0.15, 'square', 0.08);
    setTimeout(() => playTone(440, 0.15, 'square', 0.08), 100);
    setTimeout(() => playTone(554, 0.2, 'square', 0.08), 200);
    setTimeout(() => playTone(660, 0.3, 'sine', 0.12), 300);
    setTimeout(() => playTone(880, 0.5, 'sine', 0.15), 450);
    playNoise(0.2, 0.05);
  },

  /** Victory fanfare */
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.4, 'sine', 0.12), i * 150);
      setTimeout(() => playTone(freq * 1.5, 0.3, 'triangle', 0.06), i * 150 + 50);
    });
    setTimeout(() => playNoise(0.3, 0.04), 600);
  },

  /** Defeat sound */
  defeat() {
    playTone(440, 0.4, 'sine', 0.1);
    setTimeout(() => playTone(370, 0.4, 'sine', 0.1), 200);
    setTimeout(() => playTone(330, 0.5, 'sine', 0.1), 400);
    setTimeout(() => playTone(262, 0.7, 'sine', 0.08), 600);
  },

  /** Round start chime */
  roundStart() {
    playTone(523, 0.15, 'sine', 0.08);
    setTimeout(() => playTone(659, 0.2, 'sine', 0.1), 100);
  },

  /** Tug bar moving */
  tugMove() {
    playTone(180 + Math.random() * 100, 0.15, 'triangle', 0.04);
  },

  /** UI click */
  uiClick() {
    playTone(800, 0.05, 'square', 0.04);
  },

  /** Pack opened */
  packOpen() {
    playNoise(0.1, 0.06);
    setTimeout(() => playTone(440, 0.2, 'sine', 0.08), 50);
    setTimeout(() => playTone(554, 0.2, 'sine', 0.08), 150);
    setTimeout(() => playTone(660, 0.3, 'sine', 0.1), 250);
  },

  /** Mulligan / redraw */
  mulligan() {
    playTone(440, 0.15, 'triangle', 0.08);
    setTimeout(() => playTone(330, 0.15, 'triangle', 0.08), 100);
    setTimeout(() => playTone(440, 0.15, 'triangle', 0.08), 200);
  },

  /** Mana boost effect */
  manaBoost() {
    playTone(600, 0.2, 'sine', 0.08);
    setTimeout(() => playTone(750, 0.2, 'sine', 0.08), 80);
    setTimeout(() => playTone(900, 0.15, 'sine', 0.06), 160);
  },

  /** Shield applied */
  shield() {
    playTone(500, 0.2, 'triangle', 0.06);
    playTone(750, 0.15, 'sine', 0.04);
  },
};
