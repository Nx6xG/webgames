'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { loadStats, saveStats, updateStats } from './stats';
import type { WhackAMoleStats } from './stats';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const W = 700;
const H = 600;
const COLS = 3;
const ROWS = 3;
const HOLE_COUNT = COLS * ROWS;
const GAME_DURATION = 60; // seconds

const HOLE_RX = 52;
const HOLE_RY = 22;
const MOLE_RADIUS = 34;

type Phase = 'menu' | 'countdown' | 'playing' | 'ended';
type Difficulty = 'easy' | 'medium' | 'hard';
type MoleType = 'normal' | 'golden' | 'bomb';

interface DiffConfig {
  /** Base time a mole stays up (seconds) */
  popDuration: number;
  /** Min pop duration at end of game */
  minPopDuration: number;
  /** Base interval between spawns (seconds) */
  spawnInterval: number;
  /** Min spawn interval at end of game */
  minSpawnInterval: number;
  /** Max simultaneous moles */
  maxSimultaneous: number;
  /** Golden mole chance (0-1) */
  goldenChance: number;
  /** Bomb mole chance (0-1) */
  bombChance: number;
}

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy: {
    popDuration: 1.6, minPopDuration: 0.9,
    spawnInterval: 1.2, minSpawnInterval: 0.7,
    maxSimultaneous: 2, goldenChance: 0.08, bombChance: 0.05,
  },
  medium: {
    popDuration: 1.2, minPopDuration: 0.6,
    spawnInterval: 0.9, minSpawnInterval: 0.45,
    maxSimultaneous: 3, goldenChance: 0.10, bombChance: 0.10,
  },
  hard: {
    popDuration: 0.9, minPopDuration: 0.4,
    spawnInterval: 0.6, minSpawnInterval: 0.30,
    maxSimultaneous: 4, goldenChance: 0.12, bombChance: 0.15,
  },
};

const POINTS_NORMAL = 10;
const POINTS_GOLDEN = 50;
const POINTS_BOMB = -30;

// ── Mole state ───────────────────────────────────────────────────────────────

interface Mole {
  holeIndex: number;
  type: MoleType;
  /** 0 = fully hidden, 1 = fully up */
  progress: number;
  /** 'rising' | 'up' | 'falling' | 'whacked' */
  state: 'rising' | 'up' | 'falling' | 'whacked';
  upTimer: number;     // seconds remaining at top
  whackTimer: number;  // for whacked animation
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  kind?: 'circle' | 'star' | 'ring' | 'spark' | 'dirt';
  rotation?: number;
  rotSpeed?: number;
}

interface MissMarker {
  x: number; y: number;
  life: number;
}

// ── Ambient decoration seed (stable per session) ────────────────────────────
interface FlowerDeco { x: number; y: number; color: string; size: number; petalCount: number; rotation: number; }
interface GrassBlade { x: number; y: number; h: number; lean: number; color: string; }

const FLOWERS: FlowerDeco[] = [];
const GRASS_BLADES: GrassBlade[] = [];
const DIRT_CLUMPS: { x: number; y: number; rx: number; ry: number; rot: number; shade: string }[] = [];

// Generate once
(function initDecorations() {
  // Random flowers scattered
  const flowerColors = ['#f472b6', '#fb923c', '#a78bfa', '#fbbf24', '#f87171', '#38bdf8'];
  for (let i = 0; i < 18; i++) {
    FLOWERS.push({
      x: 20 + Math.random() * (W - 40),
      y: 80 + Math.random() * (H - 100),
      color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
      size: 3 + Math.random() * 4,
      petalCount: 4 + Math.floor(Math.random() * 3),
      rotation: Math.random() * Math.PI * 2,
    });
  }
  // Grass blades
  const grassColors = ['#3a7a2a', '#4a8a3a', '#2e6e1e', '#5a9a4a'];
  for (let i = 0; i < 60; i++) {
    GRASS_BLADES.push({
      x: 15 + Math.random() * (W - 30),
      y: 80 + Math.random() * (H - 100),
      h: 8 + Math.random() * 14,
      lean: (Math.random() - 0.5) * 0.6,
      color: grassColors[Math.floor(Math.random() * grassColors.length)],
    });
  }
  // Dirt clumps around holes
  for (let hi = 0; hi < HOLE_COUNT; hi++) {
    const hc = getHoleCenter(hi);
    for (let j = 0; j < 6; j++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = HOLE_RX + 4 + Math.random() * 16;
      DIRT_CLUMPS.push({
        x: hc.x + Math.cos(angle) * dist,
        y: hc.y + Math.sin(angle) * dist * 0.5 + 8,
        rx: 3 + Math.random() * 5,
        ry: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        shade: `rgb(${70 + Math.random() * 30}, ${40 + Math.random() * 20}, ${15 + Math.random() * 15})`,
      });
    }
  }
})();

// ── Hole positions ───────────────────────────────────────────────────────────

function getHoleCenter(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const spacingX = W / (COLS + 1);
  const spacingY = (H - 120) / (ROWS + 1);
  return {
    x: spacingX * (col + 1),
    y: 140 + spacingY * (row + 1),
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function WhackAMoleGame() {
  const { t } = useI18n();
  const { trackPlay } = useAchievements('whackamole');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<WhackAMoleStats | null>(null);

  // Game state refs (mutated in rAF loop)
  const gameRef = useRef({
    moles: [] as Mole[],
    particles: [] as Particle[],
    missMarkers: [] as MissMarker[],
    score: 0,
    hits: 0,
    totalClicks: 0,
    timeLeft: GAME_DURATION,
    lastSpawn: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    combo: 0,
    comboTimer: 0,
    lastHitTime: 0,
    phase: 'menu' as Phase,
    diffConfig: DIFF_CONFIG.medium,
    lastTimestamp: 0,
  });

  // Load stats on mount
  useEffect(() => { setStats(loadStats()); }, []);

  // ── Visibility pause ───────────────────────────────────────────────────────

  const handlePause = useCallback(() => {
    // No pause in whack-a-mole, just let the timer keep going
    // (visibility pause would be unfair)
  }, []);
  useVisibilityPause(phase === 'playing', handlePause);

  // ── Countdown ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      sfx.countdownGo();
      setPhase('playing');
      gameRef.current.phase = 'playing';
      gameRef.current.lastTimestamp = performance.now();
      return;
    }
    sfx.countdownBeep();
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // ── Start game ─────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const dc = DIFF_CONFIG[difficulty];
    const g = gameRef.current;
    g.moles = [];
    g.particles = [];
    g.missMarkers = [];
    g.score = 0;
    g.hits = 0;
    g.totalClicks = 0;
    g.timeLeft = GAME_DURATION;
    g.lastSpawn = 0;
    g.shakeTimer = 0;
    g.shakeIntensity = 0;
    g.combo = 0;
    g.comboTimer = 0;
    g.lastHitTime = 0;
    g.diffConfig = dc;
    g.lastTimestamp = 0;

    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCountdown(3);
    setPhase('countdown');
    gameRef.current.phase = 'countdown';
  }, [difficulty]);

  // ── End game ───────────────────────────────────────────────────────────────

  const endGame = useCallback(() => {
    const g = gameRef.current;
    g.phase = 'ended';
    setPhase('ended');
    setScore(g.score);

    const accuracy = g.totalClicks > 0
      ? Math.round((g.hits / g.totalClicks) * 100)
      : 0;

    if (g.score >= 200) {
      sfx.winSound();
    } else {
      sfx.loseSound();
    }

    const prev = loadStats();
    const next = updateStats(prev, g.score, g.hits, accuracy);
    saveStats(next);
    setStats(next);

    trackPlay();
  }, [difficulty, trackPlay]);

  // ── Spawn logic ────────────────────────────────────────────────────────────

  function spawnMole(g: typeof gameRef.current) {
    const dc = g.diffConfig;
    const activeMoles = g.moles.filter((m) => m.state !== 'falling' || m.progress > 0);
    if (activeMoles.length >= dc.maxSimultaneous) return;

    // Find available holes
    const occupied = new Set(activeMoles.map((m) => m.holeIndex));
    const available: number[] = [];
    for (let i = 0; i < HOLE_COUNT; i++) {
      if (!occupied.has(i)) available.push(i);
    }
    if (available.length === 0) return;

    const holeIndex = available[Math.floor(Math.random() * available.length)];

    // Determine mole type
    const r = Math.random();
    let type: MoleType = 'normal';
    if (r < dc.goldenChance) type = 'golden';
    else if (r < dc.goldenChance + dc.bombChance) type = 'bomb';

    // Pop duration decreases as game progresses
    const elapsed = GAME_DURATION - g.timeLeft;
    const progress01 = elapsed / GAME_DURATION;
    const popDuration = dc.popDuration - (dc.popDuration - dc.minPopDuration) * progress01;

    sfx.popUpSound();

    g.moles.push({
      holeIndex,
      type,
      progress: 0,
      state: 'rising',
      upTimer: popDuration,
      whackTimer: 0,
    });
  }

  // ── Click/tap handling ─────────────────────────────────────────────────────

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (g.phase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    g.totalClicks++;

    // Check if we hit any mole (top-most first = last in array)
    let hitMole = false;
    for (let i = g.moles.length - 1; i >= 0; i--) {
      const mole = g.moles[i];
      if (mole.state === 'whacked' || mole.state === 'falling') continue;

      const hole = getHoleCenter(mole.holeIndex);
      const moleY = hole.y - MOLE_RADIUS * mole.progress;
      const dx = cx - hole.x;
      const dy = cy - moleY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MOLE_RADIUS + 10) {
        // Hit!
        hitMole = true;
        mole.state = 'whacked';
        mole.whackTimer = 0.4;

        // Combo tracking
        const now = performance.now();
        if (mole.type !== 'bomb') {
          if (now - g.lastHitTime < 1500) {
            g.combo++;
          } else {
            g.combo = 1;
          }
          g.lastHitTime = now;
          g.comboTimer = 1.5;
        }

        if (mole.type === 'normal') {
          const comboBonus = Math.max(0, g.combo - 1) * 5;
          g.score += POINTS_NORMAL + comboBonus;
          sfx.whackSound();
          spawnHitEffects(g, hole.x, moleY, 'normal');
        } else if (mole.type === 'golden') {
          const comboBonus = Math.max(0, g.combo - 1) * 10;
          g.score += POINTS_GOLDEN + comboBonus;
          sfx.goldenSound();
          spawnHitEffects(g, hole.x, moleY, 'golden');
        } else {
          g.score += POINTS_BOMB;
          g.combo = 0;
          g.comboTimer = 0;
          sfx.bombSound();
          g.shakeTimer = 0.4;
          g.shakeIntensity = 12;
          spawnHitEffects(g, hole.x, moleY, 'bomb');
        }

        g.hits++;
        setScore(g.score);
        break;
      }
    }

    if (!hitMole) {
      sfx.missSound();
      g.missMarkers.push({ x: cx, y: cy, life: 0.4 });
    }
  }, []);

  // ── Particle spawner ───────────────────────────────────────────────────────

  function spawnParticles(g: typeof gameRef.current, x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 120;
      g.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  function spawnHitEffects(g: typeof gameRef.current, x: number, y: number, type: MoleType) {
    if (type === 'normal') {
      // Stars that rotate
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        const speed = 60 + Math.random() * 80;
        g.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 50,
          life: 0.7, maxLife: 0.7, color: '#a3e635', size: 6 + Math.random() * 3,
          kind: 'star', rotation: Math.random() * Math.PI * 2, rotSpeed: 4 + Math.random() * 4,
        });
      }
      // Expanding ring
      g.particles.push({
        x, y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: '#a3e635', size: 10, kind: 'ring',
      });
      // Dirt particles
      for (let i = 0; i < 4; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const speed = 40 + Math.random() * 60;
        g.particles.push({
          x: x + (Math.random() - 0.5) * 30, y: y + 10,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 0.5, maxLife: 0.5, color: '#8B6914', size: 3 + Math.random() * 3, kind: 'dirt',
        });
      }
    } else if (type === 'golden') {
      // Golden burst with stars and sparkles
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const speed = 80 + Math.random() * 100;
        g.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60,
          life: 0.9, maxLife: 0.9, color: i % 2 === 0 ? '#FFD700' : '#FFF8DC', size: 7 + Math.random() * 4,
          kind: 'star', rotation: Math.random() * Math.PI * 2, rotSpeed: 5 + Math.random() * 5,
        });
      }
      // Multiple expanding rings
      for (let i = 0; i < 3; i++) {
        g.particles.push({
          x, y, vx: 0, vy: 0, life: 0.5 + i * 0.15, maxLife: 0.5 + i * 0.15,
          color: '#FFD700', size: 10, kind: 'ring',
        });
      }
      // Sparkle cloud
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 80;
        g.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
          life: 0.6 + Math.random() * 0.4, maxLife: 0.6 + Math.random() * 0.4,
          color: '#FFF8DC', size: 2 + Math.random() * 3, kind: 'spark',
        });
      }
    } else {
      // Bomb explosion
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.3;
        const speed = 100 + Math.random() * 140;
        const colors = ['#ef4444', '#f97316', '#fbbf24', '#dc2626'];
        g.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
          life: 0.7, maxLife: 0.7, color: colors[Math.floor(Math.random() * colors.length)],
          size: 5 + Math.random() * 6,
        });
      }
      // Explosion rings
      for (let i = 0; i < 3; i++) {
        g.particles.push({
          x, y, vx: 0, vy: 0, life: 0.4 + i * 0.1, maxLife: 0.4 + i * 0.1,
          color: i === 0 ? '#ef4444' : '#f97316', size: 15, kind: 'ring',
        });
      }
      // Smoke particles
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 40;
        g.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: -30 - Math.random() * 40,
          life: 0.8, maxLife: 0.8, color: '#555', size: 8 + Math.random() * 6, kind: 'circle',
        });
      }
    }
  }

  function spawnDirtPop(g: typeof gameRef.current, x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 30 + Math.random() * 50;
      g.particles.push({
        x: x + (Math.random() - 0.5) * 40, y: y + 5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.4, maxLife: 0.4, color: '#6b4423', size: 2 + Math.random() * 3, kind: 'dirt',
      });
    }
  }

  // ── Render loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    function update(timestamp: number) {
      const g = gameRef.current;
      if (g.lastTimestamp === 0) g.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - g.lastTimestamp) / 1000, 0.05);
      g.lastTimestamp = timestamp;

      if (g.phase === 'playing') {
        // Update time
        g.timeLeft -= dt;
        if (g.timeLeft <= 0) {
          g.timeLeft = 0;
          setTimeLeft(0);
          endGame();
        } else {
          setTimeLeft(Math.ceil(g.timeLeft));
        }

        // Spawn moles
        g.lastSpawn -= dt;
        if (g.lastSpawn <= 0) {
          spawnMole(g);
          const elapsed = GAME_DURATION - g.timeLeft;
          const progress01 = elapsed / GAME_DURATION;
          const dc = g.diffConfig;
          const interval = dc.spawnInterval - (dc.spawnInterval - dc.minSpawnInterval) * progress01;
          g.lastSpawn = interval * (0.7 + Math.random() * 0.6);
        }

        // Update moles
        for (let i = g.moles.length - 1; i >= 0; i--) {
          const mole = g.moles[i];
          const riseSpeed = 4.0;
          const fallSpeed = 3.0;

          if (mole.state === 'rising') {
            const prevProg = mole.progress;
            mole.progress = Math.min(1, mole.progress + riseSpeed * dt);
            // Dirt pop at start of rise
            if (prevProg < 0.15 && mole.progress >= 0.15) {
              const hc = getHoleCenter(mole.holeIndex);
              spawnDirtPop(g, hc.x, hc.y);
            }
            if (mole.progress >= 1) {
              mole.state = 'up';
            }
          } else if (mole.state === 'up') {
            mole.upTimer -= dt;
            if (mole.upTimer <= 0) {
              mole.state = 'falling';
            }
          } else if (mole.state === 'falling') {
            mole.progress = Math.max(0, mole.progress - fallSpeed * dt);
            if (mole.progress <= 0) {
              g.moles.splice(i, 1);
            }
          } else if (mole.state === 'whacked') {
            mole.whackTimer -= dt;
            if (mole.whackTimer <= 0) {
              mole.state = 'falling';
            }
          }
        }

        // Screen shake
        if (g.shakeTimer > 0) {
          g.shakeTimer -= dt;
        }

        // Combo timer
        if (g.comboTimer > 0) {
          g.comboTimer -= dt;
          if (g.comboTimer <= 0) {
            g.combo = 0;
          }
        }
      }

      // Update particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
        p.life -= dt;
        if (p.life <= 0) g.particles.splice(i, 1);
      }

      // Update miss markers
      for (let i = g.missMarkers.length - 1; i >= 0; i--) {
        g.missMarkers[i].life -= dt;
        if (g.missMarkers[i].life <= 0) g.missMarkers.splice(i, 1);
      }

      // ── Draw ─────────────────────────────────────────────────────────────

      ctx.save();

      // Screen shake offset
      if (g.shakeTimer > 0) {
        const shakeX = (Math.random() - 0.5) * g.shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * g.shakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
      }

      // ── Rich grass background ──────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#3a7a2a');
      bgGrad.addColorStop(0.3, '#2d6a1e');
      bgGrad.addColorStop(0.7, '#256016');
      bgGrad.addColorStop(1, '#1e5010');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Subtle grass texture with variation
      for (let gy = 0; gy < H; gy += 16) {
        for (let gx = 0; gx < W; gx += 24) {
          const noise = Math.sin(gx * 0.1 + gy * 0.15) * 0.02 + Math.cos(gx * 0.08 - gy * 0.12) * 0.015;
          ctx.globalAlpha = 0.15 + noise;
          ctx.fillStyle = (gx + gy) % 48 < 24 ? '#4a9a3a' : '#2e6e1e';
          ctx.fillRect(gx, gy, 24, 16);
        }
      }
      ctx.globalAlpha = 1;

      // Draw grass blades (behind everything)
      for (const blade of GRASS_BLADES) {
        const sway = Math.sin(timestamp / 800 + blade.x * 0.05) * 2;
        ctx.strokeStyle = blade.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(blade.x, blade.y);
        ctx.quadraticCurveTo(blade.x + blade.lean * blade.h + sway, blade.y - blade.h * 0.6, blade.x + sway * 1.5, blade.y - blade.h);
        ctx.stroke();
      }

      // Draw flowers
      for (const flower of FLOWERS) {
        ctx.save();
        ctx.translate(flower.x, flower.y);
        ctx.rotate(flower.rotation);
        // Petals
        for (let p = 0; p < flower.petalCount; p++) {
          const angle = (Math.PI * 2 * p) / flower.petalCount;
          ctx.fillStyle = flower.color;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(angle) * flower.size * 0.6,
            Math.sin(angle) * flower.size * 0.6,
            flower.size * 0.5, flower.size * 0.3,
            angle, 0, Math.PI * 2
          );
          ctx.fill();
        }
        // Center
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, flower.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Wooden border with wood-grain texture
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 14;
      ctx.strokeRect(5, 5, W - 10, H - 10);
      // Inner highlight
      ctx.strokeStyle = '#A0622D';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, W - 24, H - 24);
      // Outer shadow
      ctx.strokeStyle = '#5a2d0a';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      // ── HUD ────────────────────────────────────────────────────────────
      // HUD background with slight emboss
      const hudGrad = ctx.createLinearGradient(14, 14, 14, 68);
      hudGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
      hudGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = hudGrad;
      roundRect(ctx, 14, 14, W - 28, 54, 4);
      ctx.fill();
      // Top highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(18, 15); ctx.lineTo(W - 18, 15);
      ctx.stroke();

      // Score with emboss
      ctx.textAlign = 'left';
      ctx.font = 'bold 26px system-ui, sans-serif';
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(`${t('game.score')}: ${g.score}`, 31, 50);
      // Main
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${t('game.score')}: ${g.score}`, 30, 49);

      // Timer bar
      const timerBarX = W - 200;
      const timerBarW = 160;
      const timerBarH = 12;
      const timerBarY = 30;
      const timeFrac = g.timeLeft / GAME_DURATION;
      // Bar background
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, timerBarX, timerBarY, timerBarW, timerBarH, 6);
      ctx.fill();
      // Bar fill
      const timerBarColor = g.timeLeft <= 10 ? '#ef4444' : g.timeLeft <= 20 ? '#f59e0b' : '#22c55e';
      const barGrad = ctx.createLinearGradient(timerBarX, timerBarY, timerBarX, timerBarY + timerBarH);
      barGrad.addColorStop(0, timerBarColor);
      barGrad.addColorStop(1, shadeColor(timerBarColor, -30));
      ctx.fillStyle = barGrad;
      roundRect(ctx, timerBarX, timerBarY, timerBarW * timeFrac, timerBarH, 6);
      ctx.fill();
      // Timer text
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.ceil(g.timeLeft)}s`, timerBarX + timerBarW / 2, timerBarY + 10);

      // Timer label
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = g.timeLeft <= 10 ? '#ef4444' : '#ccc';
      ctx.fillText(t('whackamole.time'), timerBarX - 8, timerBarY + 10);

      // Accuracy
      if (g.totalClicks > 0) {
        const acc = Math.round((g.hits / g.totalClicks) * 100);
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(`${t('whackamole.accuracy')}: ${acc}%`, W / 2 + 1, 58);
        ctx.fillStyle = acc >= 80 ? '#a3e635' : acc >= 50 ? '#fbbf24' : '#f87171';
        ctx.fillText(`${t('whackamole.accuracy')}: ${acc}%`, W / 2, 57);
      }

      // Combo counter
      if (g.combo >= 2 && g.comboTimer > 0) {
        const comboAlpha = Math.min(1, g.comboTimer);
        const comboScale = 1 + Math.sin(timestamp / 100) * 0.08;
        ctx.save();
        ctx.globalAlpha = comboAlpha;
        ctx.translate(W / 2, 90);
        ctx.scale(comboScale, comboScale);
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        // Glow
        ctx.shadowColor = g.combo >= 5 ? '#fbbf24' : '#a3e635';
        ctx.shadowBlur = 12;
        ctx.fillStyle = g.combo >= 5 ? '#fbbf24' : '#a3e635';
        ctx.fillText(`COMBO x${g.combo}!`, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // ── Dirt clumps around holes ───────────────────────────────────────
      for (const clump of DIRT_CLUMPS) {
        ctx.fillStyle = clump.shade;
        ctx.save();
        ctx.translate(clump.x, clump.y);
        ctx.rotate(clump.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, clump.rx, clump.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Draw holes and moles ──────────────────────────────────────────
      for (let i = 0; i < HOLE_COUNT; i++) {
        const { x, y } = getHoleCenter(i);

        // Dirt mound behind hole (richer 3D look)
        const dirtGrad = ctx.createRadialGradient(x, y + 10, 5, x, y + 14, HOLE_RX + 14);
        dirtGrad.addColorStop(0, '#7a5a2a');
        dirtGrad.addColorStop(0.5, '#5a3a1a');
        dirtGrad.addColorStop(1, '#3a2510');
        ctx.fillStyle = dirtGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 12, HOLE_RX + 12, 20, 0, 0, Math.PI);
        ctx.fill();

        // 3D hole with depth gradient
        const holeGrad = ctx.createRadialGradient(x, y, 2, x, y, HOLE_RX);
        holeGrad.addColorStop(0, '#050200');
        holeGrad.addColorStop(0.5, '#0a0503');
        holeGrad.addColorStop(0.85, '#1a0e05');
        holeGrad.addColorStop(1, '#2d1a0a');

        // Hole back half
        ctx.fillStyle = holeGrad;
        ctx.beginPath();
        ctx.ellipse(x, y, HOLE_RX, HOLE_RY, 0, Math.PI, 0);
        ctx.fill();

        // Shadow under mole
        const mole = g.moles.find((m) => m.holeIndex === i);
        if (mole && mole.progress > 0.1) {
          ctx.globalAlpha = 0.3 * mole.progress;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(x, y + 2, 24 * mole.progress, 6 * mole.progress, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (mole && mole.progress > 0) {
          const moleY = y - MOLE_RADIUS * mole.progress;
          const clipBottom = y;

          ctx.save();
          ctx.beginPath();
          ctx.rect(x - HOLE_RX - 5, 0, (HOLE_RX + 5) * 2, clipBottom);
          ctx.clip();

          drawMole(ctx, x, moleY, mole, timestamp);

          ctx.restore();
        }

        // Hole front half (3D)
        ctx.fillStyle = holeGrad;
        ctx.beginPath();
        ctx.ellipse(x, y, HOLE_RX, HOLE_RY, 0, 0, Math.PI);
        ctx.fill();

        // Hole rim with gradient
        const rimGrad = ctx.createLinearGradient(x - HOLE_RX, y - HOLE_RY, x + HOLE_RX, y + HOLE_RY);
        rimGrad.addColorStop(0, '#5a3a1a');
        rimGrad.addColorStop(0.5, '#3d2810');
        rimGrad.addColorStop(1, '#2a1a08');
        ctx.strokeStyle = rimGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, HOLE_RX, HOLE_RY, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Inner rim highlight
        ctx.strokeStyle = 'rgba(255,200,100,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y - 1, HOLE_RX - 2, HOLE_RY - 1, 0, Math.PI, 0);
        ctx.stroke();

        // Front dirt mound (layered for depth)
        const frontDirtGrad = ctx.createLinearGradient(x, y + 6, x, y + 28);
        frontDirtGrad.addColorStop(0, '#7a5a30');
        frontDirtGrad.addColorStop(1, '#4a2a12');
        ctx.fillStyle = frontDirtGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + 14, HOLE_RX + 8, 14, 0, 0, Math.PI);
        ctx.fill();
      }

      // ── Draw particles ─────────────────────────────────────────────────
      for (const p of g.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;

        if (p.kind === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation ?? 0) + (p.rotSpeed ?? 0) * (1 - p.life / p.maxLife) * Math.PI * 2);
          ctx.fillStyle = p.color;
          drawStar(ctx, 0, 0, p.size * alpha, 5);
          ctx.restore();
        } else if (p.kind === 'ring') {
          const ringProgress = 1 - p.life / p.maxLife;
          const ringRadius = p.size + ringProgress * 40;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.5, 3 * (1 - ringProgress));
          ctx.beginPath();
          ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'spark') {
          const sparkSize = p.size * (0.5 + Math.sin(p.life * 20) * 0.5);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, sparkSize, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'dirt') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 1.2, p.size * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Draw miss markers (improved with ring)
      for (const m of g.missMarkers) {
        const alpha = m.life / 0.4;
        const expand = (1 - alpha) * 8;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        const sz = 10 + expand;
        ctx.beginPath();
        ctx.moveTo(m.x - sz, m.y - sz);
        ctx.lineTo(m.x + sz, m.y + sz);
        ctx.moveTo(m.x + sz, m.y - sz);
        ctx.lineTo(m.x - sz, m.y + sz);
        ctx.stroke();
        // Ring
        ctx.strokeStyle = 'rgba(239,68,68,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y, sz * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      rafRef.current = requestAnimationFrame(update);
    }

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [t, endGame]);

  // ── Helper: draw a 5-point star ──────────────────────────────────────────
  function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      const sx = cx + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Helper: rounded rect ───────────────────────────────────────────────
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Helper: darken/lighten color ────────────────────────────────────────
  function shadeColor(color: string, amount: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `rgb(${r},${g},${b})`;
  }

  // ── Draw mole helper ───────────────────────────────────────────────────────

  function drawMole(ctx: CanvasRenderingContext2D, x: number, y: number, mole: Mole, timestamp: number) {
    const isWhacked = mole.state === 'whacked';
    const R = MOLE_RADIUS;

    // Wobble when up
    let wobble = 0;
    if (mole.state === 'up') {
      wobble = Math.sin(timestamp / 100) * 3;
    }

    ctx.save();
    ctx.translate(x + wobble, y);

    if (isWhacked) {
      ctx.rotate(Math.sin(timestamp / 50) * 0.35);
    }

    // ── Paws gripping the hole edge ──────────────────────────────────────
    const pawY = R * 0.7;
    const pawColor = mole.type === 'golden' ? '#DAA520' : mole.type === 'bomb' ? '#991B1B' : '#7a5a14';
    ctx.fillStyle = pawColor;
    // Left paw
    ctx.beginPath();
    ctx.ellipse(-R * 0.7, pawY, 10, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Paw fingers
    for (let f = 0; f < 3; f++) {
      ctx.beginPath();
      ctx.arc(-R * 0.7 - 6 + f * 6, pawY + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Right paw
    ctx.beginPath();
    ctx.ellipse(R * 0.7, pawY, 10, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    for (let f = 0; f < 3; f++) {
      ctx.beginPath();
      ctx.arc(R * 0.7 - 6 + f * 6, pawY + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mole.type === 'bomb') {
      // ── BOMB MOLE ──────────────────────────────────────────────────────
      // Body - dark menacing sphere with gradient
      const bombGrad = ctx.createRadialGradient(-5, -8, 3, 0, 0, R);
      bombGrad.addColorStop(0, '#4a4a4a');
      bombGrad.addColorStop(0.4, '#2a2a2a');
      bombGrad.addColorStop(0.8, '#1a1a1a');
      bombGrad.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = bombGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();

      // Metallic sheen
      ctx.globalAlpha = 0.3;
      const sheenGrad = ctx.createRadialGradient(-10, -12, 2, 0, 0, R);
      sheenGrad.addColorStop(0, '#888');
      sheenGrad.addColorStop(0.3, '#555');
      sheenGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sheenGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Skull/warning symbol
      ctx.fillStyle = '#555';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u2620', 0, R * 0.8); // skull crossbones

      // Fuse (curvy, thicker)
      ctx.strokeStyle = '#8a7a6a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -R + 2);
      const fuseWobble = Math.sin(timestamp / 60) * 3;
      ctx.bezierCurveTo(6 + fuseWobble, -R - 6, 10 + fuseWobble, -R - 12, 5, -R - 20);
      ctx.stroke();
      // Fuse core
      ctx.strokeStyle = '#b0a090';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -R + 2);
      ctx.bezierCurveTo(6 + fuseWobble, -R - 6, 10 + fuseWobble, -R - 12, 5, -R - 20);
      ctx.stroke();

      // Animated spark with trailing particles
      const sparkPhase = (timestamp / 60) % (Math.PI * 2);
      const sparkX = 5;
      const sparkY = -R - 20;
      // Spark glow
      ctx.globalAlpha = 0.4;
      const sparkGlow = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 14);
      sparkGlow.addColorStop(0, '#fff');
      sparkGlow.addColorStop(0.3, '#ffaa00');
      sparkGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = sparkGlow;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Spark core
      const sparkSize = 3 + Math.sin(sparkPhase * 3) * 1.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sparkSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
      ctx.fill();
      // Spark particles
      for (let sp = 0; sp < 4; sp++) {
        const spAngle = sparkPhase + sp * 1.5;
        const spDist = 4 + Math.sin(spAngle * 2) * 3;
        ctx.globalAlpha = 0.6 + Math.sin(spAngle) * 0.4;
        ctx.fillStyle = sp % 2 === 0 ? '#ff6600' : '#ffcc00';
        ctx.beginPath();
        ctx.arc(sparkX + Math.cos(spAngle) * spDist, sparkY + Math.sin(spAngle) * spDist, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Glowing red eyes
      const eyeGlow = 0.6 + Math.sin(timestamp / 100) * 0.4;
      // Eye sockets
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-11, -6, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(11, -6, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Red glow
      ctx.globalAlpha = eyeGlow;
      const eyeGlowGrad = ctx.createRadialGradient(-11, -6, 1, -11, -6, 7);
      eyeGlowGrad.addColorStop(0, '#ff0000');
      eyeGlowGrad.addColorStop(0.5, '#cc0000');
      eyeGlowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = eyeGlowGrad;
      ctx.beginPath();
      ctx.ellipse(-11, -6, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const eyeGlowGrad2 = ctx.createRadialGradient(11, -6, 1, 11, -6, 7);
      eyeGlowGrad2.addColorStop(0, '#ff0000');
      eyeGlowGrad2.addColorStop(0.5, '#cc0000');
      eyeGlowGrad2.addColorStop(1, 'transparent');
      ctx.fillStyle = eyeGlowGrad2;
      ctx.beginPath();
      ctx.ellipse(11, -6, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Bright pupil points
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-11, -7, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(11, -7, 2, 0, Math.PI * 2);
      ctx.fill();

      // Angry eyebrows
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -14); ctx.lineTo(-6, -11);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -14); ctx.lineTo(6, -11);
      ctx.stroke();

      // Menacing mouth
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 12);
      ctx.lineTo(-6, 8); ctx.lineTo(-2, 12); ctx.lineTo(2, 8); ctx.lineTo(6, 12);
      ctx.stroke();

    } else {
      // ── NORMAL / GOLDEN MOLE ───────────────────────────────────────────

      // Body color based on type
      let bodyColor = '#8B6914';
      let bodyLight = '#a08020';
      let bellyColor = '#c4a04e';
      if (mole.type === 'golden') {
        bodyColor = '#DAA520';
        bodyLight = '#FFD700';
        bellyColor = '#FFF8DC';
      }

      // Body (rounded shape, slightly taller than wide)
      const bodyGrad = ctx.createRadialGradient(-5, -8, 3, 0, 5, R + 4);
      bodyGrad.addColorStop(0, bodyLight);
      bodyGrad.addColorStop(0.6, bodyColor);
      bodyGrad.addColorStop(1, shadeColor(bodyColor, -30));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 2, R, R + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Belly (lighter oval)
      ctx.fillStyle = bellyColor;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 8, R * 0.5, R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Fuzzy ears
      const earColor = mole.type === 'golden' ? '#B8860B' : '#6B4F10';
      const earInner = mole.type === 'golden' ? '#FFB347' : '#D2691E';
      // Left ear
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.ellipse(-18, -R + 2, 9, 11, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(-18, -R + 3, 5, 7, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Right ear
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.ellipse(18, -R + 2, 9, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earInner;
      ctx.beginPath();
      ctx.ellipse(18, -R + 3, 5, 7, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      if (isWhacked) {
        // Spiral dizzy eyes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        for (const ex of [-12, 12]) {
          ctx.beginPath();
          const spiralPhase = timestamp / 100;
          for (let a = 0; a < Math.PI * 4; a += 0.2) {
            const sr = a * 1.2;
            const sx = ex + Math.cos(a + spiralPhase) * sr;
            const sy = -8 + Math.sin(a + spiralPhase) * sr;
            if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        // Stars around head when whacked
        ctx.fillStyle = '#fbbf24';
        for (let si = 0; si < 5; si++) {
          const starAngle = (Math.PI * 2 * si) / 5 + timestamp / 200;
          const starDist = R + 6;
          ctx.save();
          ctx.translate(Math.cos(starAngle) * starDist, -5 + Math.sin(starAngle) * (starDist * 0.4));
          ctx.rotate(starAngle);
          drawStar(ctx, 0, 0, 4, 5);
          ctx.restore();
        }
      } else {
        // Round eyes with pupils and highlights
        for (const ex of [-12, 12]) {
          // Eye white
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.ellipse(ex, -8, 8, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          // Eye outline
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(ex, -8, 8, 9, 0, 0, Math.PI * 2);
          ctx.stroke();
          // Pupil
          const lookX = Math.sin(timestamp / 2000) * 1.5;
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(ex + lookX, -7, 4, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(ex + lookX + 1.5, -9, 1.8, 0, Math.PI * 2);
          ctx.fill();
          // Small secondary highlight
          ctx.beginPath();
          ctx.arc(ex + lookX - 1, -5, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Nose (pink oval)
      const noseGrad = ctx.createRadialGradient(-1, 1, 1, 0, 2, 8);
      noseGrad.addColorStop(0, mole.type === 'golden' ? '#FFB347' : '#ff9999');
      noseGrad.addColorStop(1, mole.type === 'golden' ? '#B8860B' : '#cc6666');
      ctx.fillStyle = noseGrad;
      ctx.beginPath();
      ctx.ellipse(0, 3, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Nose highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(-2, 1, 3, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Whiskers
      ctx.strokeStyle = mole.type === 'golden' ? '#B8860B' : '#555';
      ctx.lineWidth = 1;
      const whiskerWobble = Math.sin(timestamp / 200) * 2;
      // Left whiskers
      ctx.beginPath();
      ctx.moveTo(-8, 2); ctx.lineTo(-26, -2 + whiskerWobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 4); ctx.lineTo(-25, 6 + whiskerWobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 6); ctx.lineTo(-24, 12 + whiskerWobble);
      ctx.stroke();
      // Right whiskers
      ctx.beginPath();
      ctx.moveTo(8, 2); ctx.lineTo(26, -2 - whiskerWobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 4); ctx.lineTo(25, 6 - whiskerWobble);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 6); ctx.lineTo(24, 12 - whiskerWobble);
      ctx.stroke();

      // Buck teeth (slightly rounded)
      ctx.fillStyle = '#fffff0';
      roundRect(ctx, -5.5, 10, 5, 8, 1.5);
      ctx.fill();
      roundRect(ctx, 0.5, 10, 5, 8, 1.5);
      ctx.fill();
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 0.5;
      roundRect(ctx, -5.5, 10, 5, 8, 1.5);
      ctx.stroke();
      roundRect(ctx, 0.5, 10, 5, 8, 1.5);
      ctx.stroke();
      // Tooth line
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 10); ctx.lineTo(0, 18);
      ctx.stroke();

      // ── Golden mole special effects ────────────────────────────────────
      if (mole.type === 'golden') {
        // Golden glow aura
        ctx.globalAlpha = 0.15 + Math.sin(timestamp / 200) * 0.08;
        const auraGrad = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.5);
        auraGrad.addColorStop(0, '#FFD700');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Crown
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(-14, -R - 4);
        ctx.lineTo(-16, -R - 16);
        ctx.lineTo(-8, -R - 10);
        ctx.lineTo(0, -R - 18);
        ctx.lineTo(8, -R - 10);
        ctx.lineTo(16, -R - 16);
        ctx.lineTo(14, -R - 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Crown jewels
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -R - 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(-10, -R - 9, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -R - 9, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Sparkle particles orbiting
        const sparkleCount = 8;
        for (let si = 0; si < sparkleCount; si++) {
          const sAngle = (Math.PI * 2 * si) / sparkleCount + timestamp / 400;
          const sDist = R + 4 + Math.sin(timestamp / 300 + si) * 4;
          const sAlpha = 0.4 + Math.sin(timestamp / 150 + si * 1.5) * 0.4;
          ctx.globalAlpha = sAlpha;
          ctx.fillStyle = si % 2 === 0 ? '#FFF8DC' : '#FFD700';
          drawStar(ctx, Math.cos(sAngle) * sDist, Math.sin(sAngle) * sDist * 0.7, 3, 4);
        }
        ctx.globalAlpha = 1;

        // Shimmer line
        const shimmerPhase = (timestamp / 300) % 1;
        const shimmerX = -R + shimmerPhase * R * 2;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#FFF8DC';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shimmerX, -R); ctx.lineTo(shimmerX + 4, R);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  // ── Cursor style ───────────────────────────────────────────────────────────

  const cursorStyle = phase === 'playing'
    ? 'cursor-crosshair'
    : 'cursor-default';

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-h-0" ref={wrapperRef}>
      {/* Stats bar */}
      {stats && stats.games > 0 && (
        <div className="flex gap-6 text-xs text-zinc-500 tabular-nums">
          <span>{t('whackamole.stats.games')}: <b className="text-zinc-300">{stats.games}</b></span>
          <span>{t('whackamole.stats.best')}: <b className="text-amber-400">{stats.bestScore}</b></span>
          <span>{t('whackamole.stats.whacked')}: <b className="text-emerald-400">{stats.totalWhacked}</b></span>
          {stats.bestAccuracy > 0 && (
            <span>{t('whackamole.stats.accuracy')}: <b className="text-indigo-400">{stats.bestAccuracy}%</b></span>
          )}
        </div>
      )}

      {/* Canvas container */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div
          className="relative h-full overflow-hidden rounded-xl border border-zinc-800"
          style={{ aspectRatio: `${W} / ${H}`, maxWidth: '100%' }}
        >
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full touch-none ${cursorStyle}`}
            onClick={handleCanvasClick}
            onTouchEnd={handleCanvasClick}
          />

          {/* Menu overlay */}
          {phase === 'menu' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl">
              <h2 className="text-4xl font-black mb-1 text-white">Whack-a-Mole</h2>
              <p className="text-zinc-400 text-sm mb-6">{t('lobby.games.whackamole.desc')}</p>

              {/* Difficulty selector */}
              <div className="mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 text-center">
                  {t('whackamole.difficulty')}
                </p>
                <div className="flex gap-1 p-1 bg-zinc-800/80 rounded-lg">
                  {(['easy', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                        difficulty === d ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t(`whackamole.${d}`)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 text-center mt-1.5">
                  {t(`whackamole.${difficulty}.hint`)}
                </p>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-colors"
              >
                {t('whackamole.start')}
              </button>
            </div>
          )}

          {/* Countdown overlay */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
              <span className="text-8xl font-black text-white animate-ping">
                {countdown > 0 ? countdown : t('whackamole.go')}
              </span>
            </div>
          )}

          {/* End overlay */}
          {phase === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl">
              <h2 className="text-4xl font-black mb-2 text-amber-400">
                {t('game.over')}
              </h2>
              <div className="flex flex-col items-center gap-1 text-zinc-300 text-lg mb-4">
                <span>{t('game.score')}: <b className="text-2xl">{score}</b></span>
                {gameRef.current.totalClicks > 0 && (
                  <span className="text-sm text-zinc-400">
                    {t('whackamole.accuracy')}: {Math.round((gameRef.current.hits / gameRef.current.totalClicks) * 100)}%
                    {' · '}{gameRef.current.hits} {t('whackamole.molesHit')}
                  </span>
                )}
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-colors"
              >
                {t('game.playAgain')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
