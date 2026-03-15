'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { loadStats, saveStats, updateStats } from './stats';
import type { FruitNinjaStats } from './stats';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const W = 800;
const H = 600;

type Phase = 'menu' | 'playing' | 'paused' | 'ended';
type Difficulty = 'easy' | 'medium' | 'hard';

interface DiffConfig {
  fruitInterval: number;   // ms between waves
  minFruits: number;       // min fruits per wave
  maxFruits: number;       // max fruits per wave
  bombChance: number;      // 0..1
  gravity: number;         // pixels/frame^2
  throwSpeed: number;      // base upward velocity
}

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { fruitInterval: 1800, minFruits: 1, maxFruits: 3, bombChance: 0.05, gravity: 0.25, throwSpeed: 13 },
  medium: { fruitInterval: 1400, minFruits: 1, maxFruits: 3, bombChance: 0.12, gravity: 0.28, throwSpeed: 14 },
  hard:   { fruitInterval: 1000, minFruits: 2, maxFruits: 4, bombChance: 0.20, gravity: 0.30, throwSpeed: 15 },
};

// ── Fruit definitions ────────────────────────────────────────────────────────

interface FruitDef {
  name: string;
  color: string;
  innerColor: string;
  radius: number;
  leafColor: string;
}

const FRUIT_DEFS: FruitDef[] = [
  { name: 'apple',      color: '#dc2626', innerColor: '#fef9c3', radius: 34, leafColor: '#16a34a' },
  { name: 'orange',     color: '#f97316', innerColor: '#fef3c7', radius: 36, leafColor: '#15803d' },
  { name: 'watermelon', color: '#16a34a', innerColor: '#ef4444', radius: 42, leafColor: '#166534' },
  { name: 'banana',     color: '#facc15', innerColor: '#fef9c3', radius: 33, leafColor: '#a16207' },
  { name: 'strawberry', color: '#ec4899', innerColor: '#fce7f3', radius: 30, leafColor: '#15803d' },
  { name: 'pineapple',  color: '#d97706', innerColor: '#fef3c7', radius: 38, leafColor: '#16a34a' },
];

// ── Entity interfaces ────────────────────────────────────────────────────────

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  def: FruitDef;
  isBomb: boolean;
  sliced: boolean;
  rotation: number;
  rotSpeed: number;
  missed: boolean;
}

interface FruitHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  innerColor: string;
  rotation: number;
  rotSpeed: number;
  life: number;
  side: -1 | 1; // left or right half
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

interface GameState {
  fruits: Fruit[];
  halves: FruitHalf[];
  particles: Particle[];
  popups: ScorePopup[];
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  totalSliced: number;
  waveTimer: number;
  waveCount: number;
  slashActive: boolean;
  trail: TrailPoint[];
  bombHit: boolean;
  bombFlash: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function spawnFruit(diff: DiffConfig, isBomb: boolean): Fruit {
  const def = FRUIT_DEFS[Math.floor(Math.random() * FRUIT_DEFS.length)];
  const x = 100 + Math.random() * (W - 200);
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  const speed = diff.throwSpeed + Math.random() * 4;
  return {
    x,
    y: H + 40,
    vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.5,
    vy: -speed - Math.random() * 2,
    radius: isBomb ? 26 : def.radius,
    def,
    isBomb,
    sliced: false,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.1,
    missed: false,
  };
}

function createHalves(f: Fruit): FruitHalf[] {
  const baseVx = f.vx;
  return [
    {
      x: f.x, y: f.y, vx: baseVx - 2 - Math.random() * 2, vy: f.vy - 1,
      radius: f.radius, color: f.def.color, innerColor: f.def.innerColor,
      rotation: f.rotation, rotSpeed: -0.08 - Math.random() * 0.05, life: 60, side: -1,
    },
    {
      x: f.x, y: f.y, vx: baseVx + 2 + Math.random() * 2, vy: f.vy - 1,
      radius: f.radius, color: f.def.color, innerColor: f.def.innerColor,
      rotation: f.rotation, rotSpeed: 0.08 + Math.random() * 0.05, life: 60, side: 1,
    },
  ];
}

function createSplashParticles(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    const maxLife = 30 + Math.random() * 30;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: maxLife,
      maxLife,
      size: 2 + Math.random() * 4,
    });
  }
  return particles;
}

function createBombParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#ef4444', '#f97316', '#fbbf24', '#ffffff', '#6b7280'];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    const maxLife = 40 + Math.random() * 40;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: maxLife,
      maxLife,
      size: 3 + Math.random() * 5,
    });
  }
  return particles;
}

function initGame(diff: DiffConfig): GameState {
  return {
    fruits: [],
    halves: [],
    particles: [],
    popups: [],
    score: 0,
    lives: 3,
    combo: 0,
    maxCombo: 0,
    totalSliced: 0,
    waveTimer: 0,
    waveCount: 0,
    slashActive: false,
    trail: [],
    bombHit: false,
    bombFlash: 0,
  };
}

// ── Rendering helpers ────────────────────────────────────────────────────────

function drawFruit(ctx: CanvasRenderingContext2D, f: Fruit) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.rotation);

  if (f.isBomb) {
    // Bomb body
    ctx.beginPath();
    ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1f1f1f';
    ctx.fill();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner highlight
    ctx.beginPath();
    ctx.arc(-f.radius * 0.2, -f.radius * 0.2, f.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    // Fuse
    ctx.beginPath();
    ctx.moveTo(0, -f.radius);
    ctx.quadraticCurveTo(8, -f.radius - 12, 4, -f.radius - 18);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Spark
    ctx.beginPath();
    ctx.arc(4, -f.radius - 18, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    // X marks
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -4); ctx.lineTo(6, 4);
    ctx.moveTo(6, -4); ctx.lineTo(-6, 4);
    ctx.stroke();
  } else {
    const d = f.def;
    // Main body
    ctx.beginPath();
    ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    // Highlight
    ctx.beginPath();
    ctx.arc(-f.radius * 0.25, -f.radius * 0.25, f.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    // Leaf / stem
    ctx.beginPath();
    ctx.ellipse(0, -f.radius - 4, 6, 10, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = d.leafColor;
    ctx.fill();
    // Stem line
    ctx.beginPath();
    ctx.moveTo(0, -f.radius + 2);
    ctx.lineTo(0, -f.radius - 6);
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawHalf(ctx: CanvasRenderingContext2D, h: FruitHalf) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.rotation);

  // Clip to show only one half
  ctx.beginPath();
  if (h.side === -1) {
    ctx.rect(-h.radius - 2, -h.radius - 2, h.radius + 2, (h.radius + 2) * 2);
  } else {
    ctx.rect(0, -h.radius - 2, h.radius + 2, (h.radius + 2) * 2);
  }
  ctx.clip();

  // Outer
  ctx.beginPath();
  ctx.arc(0, 0, h.radius, 0, Math.PI * 2);
  ctx.fillStyle = h.color;
  ctx.fill();

  // Inner flesh
  ctx.beginPath();
  ctx.arc(0, 0, h.radius * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = h.innerColor;
  ctx.fill();

  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: TrailPoint[]) {
  if (trail.length < 2) return;
  for (let i = 1; i < trail.length; i++) {
    const p0 = trail[i - 1];
    const p1 = trail[i];
    const alpha = Math.max(0, 1 - p1.age / 12);
    const width = Math.max(1, (1 - p1.age / 12) * 5);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glow
    ctx.strokeStyle = `rgba(100, 160, 255, ${alpha * 0.5})`;
    ctx.lineWidth = width + 4;
    ctx.stroke();
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function FruitNinjaGame() {
  const { t } = useI18n();
  const ach = useAchievements('fruitninja');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>(initGame(DIFF_CONFIG.medium));
  const phaseRef = useRef<Phase>('menu');
  const diffRef = useRef<Difficulty>('medium');
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const savedRef = useRef(false);
  const mouseRef = useRef<{ x: number; y: number; prevX: number; prevY: number; down: boolean }>({
    x: 0, y: 0, prevX: 0, prevY: 0, down: false,
  });
  const comboTimerRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [muted, setMutedState] = useState(false);
  const [stats, setStats] = useState<FruitNinjaStats | null>(null);

  // Load stats on mount
  useEffect(() => {
    setStats(loadStats());
    setMutedState(sfx.isMuted());
  }, []);

  // ── Start game ───────────────────────────────────────────────────────────────

  const startGame = useCallback((diff: Difficulty) => {
    diffRef.current = diff;
    setDifficulty(diff);
    const g = initGame(DIFF_CONFIG[diff]);
    gameRef.current = g;
    savedRef.current = false;
    comboTimerRef.current = 0;
    setScore(0);
    setLives(3);
    setPhase('playing');
    phaseRef.current = 'playing';
    lastTimeRef.current = 0;
  }, []);

  // ── Toggle pause ──────────────────────────────────────────────────────────

  const togglePause = useCallback(() => {
    setPhase((p) => {
      if (p === 'playing') { phaseRef.current = 'paused'; return 'paused'; }
      if (p === 'paused') { phaseRef.current = 'playing'; return 'playing'; }
      return p;
    });
  }, []);

  useVisibilityPause(phase === 'playing', togglePause);

  const toggleMute = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      sfx.setMuted(next);
      return next;
    });
  }, []);

  // ── Save result ────────────────────────────────────────────────────────────

  const saveResult = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const g = gameRef.current;

    setStats((prev) => {
      const base = prev ?? { games: 0, bestScore: 0, bestCombo: 0, totalSliced: 0 };
      const next = updateStats(base, g.score, g.maxCombo, g.totalSliced);
      saveStats(next);
      return next;
    });
    ach.trackWin();
    sfx.loseSound();
  }, [ach]);

  // ── Game loop ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d')!;

    function tick(timestamp: number) {
      rafRef.current = requestAnimationFrame(tick);

      if (phaseRef.current !== 'playing' && phaseRef.current !== 'ended') {
        // Still draw in menu/paused/ended
        draw(ctx2d);
        return;
      }

      if (phaseRef.current === 'ended') {
        // Animate remaining halves/particles
        updatePhysicsOnly();
        draw(ctx2d);
        return;
      }

      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const dt = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      update(dt);
      draw(ctx2d);
    }

    function update(dt: number) {
      const g = gameRef.current;
      const diff = DIFF_CONFIG[diffRef.current];
      const mouse = mouseRef.current;

      // Wave spawning
      g.waveTimer += dt;
      // Accelerate spawn rate over time
      const speedupFactor = Math.max(0.5, 1 - g.waveCount * 0.008);
      const interval = diff.fruitInterval * speedupFactor;
      if (g.waveTimer >= interval) {
        g.waveTimer = 0;
        g.waveCount++;
        const count = diff.minFruits + Math.floor(Math.random() * (diff.maxFruits - diff.minFruits + 1));
        for (let i = 0; i < count; i++) {
          const isBomb = Math.random() < diff.bombChance;
          g.fruits.push(spawnFruit(diff, isBomb));
        }
      }

      // Update fruits
      for (const f of g.fruits) {
        if (f.sliced) continue;
        f.x += f.vx;
        f.y += f.vy;
        f.vy += diff.gravity;
        f.rotation += f.rotSpeed;

        // Check if missed (fell below screen)
        if (f.y > H + 60 && !f.missed && !f.isBomb) {
          f.missed = true;
          g.lives--;
          setLives(g.lives);
          sfx.missSound();
          if (g.lives <= 0) {
            endGame();
            return;
          }
        }
      }

      // Slash detection
      const speed = Math.hypot(mouse.x - mouse.prevX, mouse.y - mouse.prevY);
      if (mouse.down && speed > 4) {
        let slicedThisFrame = 0;

        for (const f of g.fruits) {
          if (f.sliced || f.y > H + 40) continue;
          const dist = distToSegment(f.x, f.y, mouse.prevX, mouse.prevY, mouse.x, mouse.y);
          if (dist < f.radius + 5) {
            f.sliced = true;

            if (f.isBomb) {
              // Bomb hit - game over
              g.bombHit = true;
              g.bombFlash = 20;
              g.particles.push(...createBombParticles(f.x, f.y));
              sfx.bombSound();
              endGame();
              return;
            }

            // Fruit sliced
            slicedThisFrame++;
            g.totalSliced++;
            g.halves.push(...createHalves(f));
            g.particles.push(...createSplashParticles(f.x, f.y, f.def.color, 12));
            sfx.sliceSound();
            sfx.splashSound();
          }
        }

        if (slicedThisFrame > 0) {
          // Combo logic
          g.combo += slicedThisFrame;
          comboTimerRef.current = 20; // frames to reset combo

          let points = slicedThisFrame;
          if (g.combo >= 3) {
            const multiplier = Math.min(g.combo, 8);
            points = slicedThisFrame * multiplier;
            sfx.comboSound();
          }
          g.score += points;
          g.maxCombo = Math.max(g.maxCombo, g.combo);
          setScore(g.score);

          // Score popup
          const text = g.combo >= 3
            ? `+${points} ${g.combo}x COMBO!`
            : `+${slicedThisFrame}`;
          const color = g.combo >= 3 ? '#fbbf24' : '#ffffff';
          g.popups.push({
            x: mouse.x,
            y: mouse.y - 20,
            text,
            color,
            life: 50,
            vy: -1.5,
          });
        }
      }

      // Combo timer
      if (comboTimerRef.current > 0) {
        comboTimerRef.current--;
        if (comboTimerRef.current <= 0) {
          g.combo = 0;
        }
      }

      // Update trail
      if (mouse.down) {
        g.trail.push({ x: mouse.x, y: mouse.y, age: 0 });
      }
      for (const tp of g.trail) tp.age++;
      g.trail = g.trail.filter((tp) => tp.age < 12);
      if (g.trail.length > 30) g.trail = g.trail.slice(-30);

      // Update halves
      for (const h of g.halves) {
        h.x += h.vx;
        h.y += h.vy;
        h.vy += diff.gravity;
        h.rotation += h.rotSpeed;
        h.life--;
      }
      g.halves = g.halves.filter((h) => h.life > 0 && h.y < H + 100);

      // Update particles
      for (const p of g.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      // Update popups
      for (const p of g.popups) {
        p.y += p.vy;
        p.life--;
      }
      g.popups = g.popups.filter((p) => p.life > 0);

      // Cleanup off-screen fruits
      g.fruits = g.fruits.filter((f) => f.y < H + 100 || !f.sliced);
      g.fruits = g.fruits.filter((f) => !(f.y > H + 100 && (f.missed || f.sliced)));

      // Bomb flash
      if (g.bombFlash > 0) g.bombFlash--;

      // Store prev mouse
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }

    function updatePhysicsOnly() {
      const g = gameRef.current;
      const diff = DIFF_CONFIG[diffRef.current];
      for (const h of g.halves) {
        h.x += h.vx; h.y += h.vy; h.vy += diff.gravity; h.rotation += h.rotSpeed; h.life--;
      }
      g.halves = g.halves.filter((h) => h.life > 0);
      for (const p of g.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
      }
      g.particles = g.particles.filter((p) => p.life > 0);
      for (const p of g.popups) { p.y += p.vy; p.life--; }
      g.popups = g.popups.filter((p) => p.life > 0);
      for (const tp of g.trail) tp.age++;
      g.trail = g.trail.filter((tp) => tp.age < 12);
      if (g.bombFlash > 0) g.bombFlash--;
    }

    function endGame() {
      phaseRef.current = 'ended';
      setPhase('ended');
      saveResultRef.current();
    }

    function draw(ctx: CanvasRenderingContext2D) {
      const g = gameRef.current;

      // Background - zen wooden gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1a1206');
      grad.addColorStop(0.5, '#1c1510');
      grad.addColorStop(1, '#0f0a06');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle wood grain lines
      ctx.strokeStyle = 'rgba(139, 92, 42, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const y = i * 32 + 10;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(W * 0.3, y + 3, W * 0.7, y - 2, W, y + 1);
        ctx.stroke();
      }

      // Bomb flash overlay
      if (g.bombFlash > 0) {
        ctx.fillStyle = `rgba(255, 60, 30, ${g.bombFlash / 20 * 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Draw fruits
      for (const f of g.fruits) {
        if (!f.sliced) drawFruit(ctx, f);
      }

      // Draw halves
      for (const h of g.halves) {
        ctx.globalAlpha = Math.min(1, h.life / 15);
        drawHalf(ctx, h);
        ctx.globalAlpha = 1;
      }

      // Draw particles
      for (const p of g.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw trail
      drawTrail(ctx, g.trail);

      // Draw score popups
      for (const p of g.popups) {
        const alpha = Math.min(1, p.life / 15);
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.text, p.x, p.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // HUD - Score
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.3)';
      ctx.shadowBlur = 10;
      ctx.fillText(`${g.score}`, 20, 40);
      ctx.shadowBlur = 0;

      // HUD - Lives
      ctx.textAlign = 'right';
      ctx.font = '24px system-ui, sans-serif';
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < g.lives ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
        ctx.fillText('\u2764', W - 20 - i * 32, 38);
      }

      // HUD - Combo indicator
      if (g.combo >= 3) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
        ctx.shadowBlur = 8;
        ctx.fillText(`${g.combo}x COMBO`, W / 2, 36);
        ctx.shadowBlur = 0;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref wrapper for saveResult so the game loop can call it
  const saveResultRef = useRef(saveResult);
  saveResultRef.current = saveResult;

  // ── Mouse / Touch ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getPos(e: MouseEvent | Touch): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    }

    function onMouseDown(e: MouseEvent) {
      const pos = getPos(e);
      const m = mouseRef.current;
      m.x = pos.x; m.y = pos.y;
      m.prevX = pos.x; m.prevY = pos.y;
      m.down = true;
    }
    function onMouseMove(e: MouseEvent) {
      const pos = getPos(e);
      const m = mouseRef.current;
      m.prevX = m.x; m.prevY = m.y;
      m.x = pos.x; m.y = pos.y;
    }
    function onMouseUp() {
      mouseRef.current.down = false;
      const g = gameRef.current;
      g.combo = 0;
      comboTimerRef.current = 0;
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const pos = getPos(e.touches[0]);
      const m = mouseRef.current;
      m.x = pos.x; m.y = pos.y;
      m.prevX = pos.x; m.prevY = pos.y;
      m.down = true;
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const pos = getPos(e.touches[0]);
      const m = mouseRef.current;
      m.prevX = m.x; m.prevY = m.y;
      m.x = pos.x; m.y = pos.y;
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      mouseRef.current.down = false;
      const g = gameRef.current;
      g.combo = 0;
      comboTimerRef.current = 0;
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') &&
          (phaseRef.current === 'playing' || phaseRef.current === 'paused')) {
        e.preventDefault();
        togglePause();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause]);

  // ── Render ────────────────────────────────────────────────────────────────

  const diffLabels: Record<Difficulty, string> = {
    easy:   t('fruitninja.easy'),
    medium: t('fruitninja.medium'),
    hard:   t('fruitninja.hard'),
  };

  return (
    <div className="flex flex-col items-center gap-4 flex-1">
      {/* Canvas */}
      <div className="relative w-full max-w-[800px] aspect-[4/3]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full rounded-xl border border-zinc-800 bg-zinc-950 cursor-crosshair"
        />

        {/* Menu overlay */}
        {phase === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl backdrop-blur-sm">
            <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-linear-to-r from-red-400 via-orange-400 to-yellow-400">
              Fruit Ninja
            </h2>
            <p className="text-zinc-400 text-sm mb-8">{t('fruitninja.subtitle')}</p>

            {/* Stats */}
            {stats && stats.games > 0 && (
              <div className="flex gap-6 mb-8 text-center text-xs text-zinc-400">
                <div>
                  <div className="text-lg font-bold text-zinc-200 tabular-nums">{stats.games}</div>
                  {t('fruitninja.stats.games')}
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400 tabular-nums">{stats.bestScore}</div>
                  {t('fruitninja.stats.bestScore')}
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-400 tabular-nums">{stats.bestCombo}x</div>
                  {t('fruitninja.stats.bestCombo')}
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400 tabular-nums">{stats.totalSliced}</div>
                  {t('fruitninja.stats.totalSliced')}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-3">{t('fruitninja.difficulty')}</p>
            <div className="flex gap-2 mb-6">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => startGame(d)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    d === 'easy'   ? 'bg-emerald-600 hover:bg-emerald-500 text-white' :
                    d === 'medium' ? 'bg-amber-600 hover:bg-amber-500 text-white' :
                                     'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  {diffLabels[d]}
                </button>
              ))}
            </div>

            <p className="text-zinc-600 text-xs">{t('fruitninja.controlsHint')}</p>
          </div>
        )}

        {/* Paused overlay */}
        {phase === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black mb-3 text-zinc-100">{t('fruitninja.paused')}</h2>
            <p className="text-zinc-400 text-sm mb-6">{t('fruitninja.pauseHint')}</p>
            <button
              onClick={togglePause}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              {t('fruitninja.resume')}
            </button>
          </div>
        )}

        {/* Game Over overlay */}
        {phase === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl backdrop-blur-sm">
            <h2 className="text-3xl font-black mb-2 text-red-400">{t('fruitninja.gameOver')}</h2>
            <div className="flex gap-8 mb-6 text-center">
              <div>
                <div className="text-3xl font-black text-amber-400 tabular-nums">{score}</div>
                <div className="text-xs text-zinc-400">{t('fruitninja.score')}</div>
              </div>
              <div>
                <div className="text-3xl font-black text-orange-400 tabular-nums">{gameRef.current.maxCombo}x</div>
                <div className="text-xs text-zinc-400">{t('fruitninja.bestCombo')}</div>
              </div>
              <div>
                <div className="text-3xl font-black text-green-400 tabular-nums">{gameRef.current.totalSliced}</div>
                <div className="text-xs text-zinc-400">{t('fruitninja.sliced')}</div>
              </div>
            </div>
            {stats && score >= stats.bestScore && stats.games > 1 && (
              <p className="text-amber-400 text-sm font-bold mb-4">{t('fruitninja.newRecord')}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => startGame(diffRef.current)}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                {t('fruitninja.playAgain')}
              </button>
              <button
                onClick={() => { setPhase('menu'); phaseRef.current = 'menu'; }}
                className="px-6 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm transition-colors"
              >
                {t('fruitninja.backToMenu')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      {phase === 'playing' && (
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <button
            onClick={toggleMute}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title={muted ? t('fruitninja.unmute') : t('fruitninja.mute')}
          >
            {muted ? '\u{1F507}' : '\u{1F50A}'}
          </button>
          <span className="text-zinc-600">|</span>
          <span className="text-xs text-zinc-600">P {t('fruitninja.toPause')}</span>
        </div>
      )}
    </div>
  );
}
