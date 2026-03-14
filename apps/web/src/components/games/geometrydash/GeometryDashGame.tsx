'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import * as sfx from './sound';
import { getStats, recordRun } from './stats';
import type { GdStats } from './stats';

// ── Constants ────────────────────────────────────────────────────────────────

const GAME_W = 800;
const GAME_H = 400;
const GROUND_Y = 340;
const GROUND_H = GAME_H - GROUND_Y;
const CUBE_SIZE = 34;
const CUBE_X = 120;
const GRAVITY = 0.65;
const JUMP_VEL = -11.5;
const LEVEL_LENGTH = 3200; // distance units per level segment

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 600;

// ── Difficulty ───────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

interface DiffConfig {
  baseSpeed: number;
  speedInc: number;    // per level
  maxSpeed: number;
  obstacleDensity: number; // 0-1, chance per segment slot
  gapMin: number;      // min gap between obstacles
}

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { baseSpeed: 4.0, speedInc: 0.3, maxSpeed: 7,  obstacleDensity: 0.30, gapMin: 220 },
  medium: { baseSpeed: 5.0, speedInc: 0.4, maxSpeed: 9,  obstacleDensity: 0.42, gapMin: 170 },
  hard:   { baseSpeed: 6.0, speedInc: 0.5, maxSpeed: 11, obstacleDensity: 0.55, gapMin: 140 },
};

// ── Obstacle types ───────────────────────────────────────────────────────────

interface Obstacle {
  x: number;         // world x position
  type: 'spike' | 'block' | 'gap';
  width: number;
  height: number;
  id: number;
}

// ── Trail particle ───────────────────────────────────────────────────────────

interface TrailParticle {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

// ── Color themes per level ───────────────────────────────────────────────────

const LEVEL_COLORS = [
  { bg1: '#0f0f23', bg2: '#1a1a3e', ground: '#1e3a5f', cube: '#00ff88', accent: '#00ff88', grid: 'rgba(0,255,136,0.06)' },
  { bg1: '#1a0a2e', bg2: '#2d1b4e', ground: '#4a1a6b', cube: '#ff44cc', accent: '#ff44cc', grid: 'rgba(255,68,204,0.06)' },
  { bg1: '#1e0a0a', bg2: '#3a1515', ground: '#6b2020', cube: '#ff6644', accent: '#ff6644', grid: 'rgba(255,102,68,0.06)' },
  { bg1: '#0a1e1e', bg2: '#153a3a', ground: '#1a5f5f', cube: '#44ddff', accent: '#44ddff', grid: 'rgba(68,221,255,0.06)' },
  { bg1: '#1e1e0a', bg2: '#3a3a15', ground: '#5f5f1a', cube: '#ffee44', accent: '#ffee44', grid: 'rgba(255,238,68,0.06)' },
];

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'ended';

// ── Procedural generation ────────────────────────────────────────────────────

let obstacleIdCounter = 0;

function generateSegment(startX: number, cfg: DiffConfig, level: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const slotSize = 80;
  const slots = Math.floor(LEVEL_LENGTH / slotSize);
  let lastObsEnd = startX;

  for (let i = 2; i < slots - 1; i++) {
    const sx = startX + i * slotSize;
    if (sx - lastObsEnd < cfg.gapMin) continue;
    if (Math.random() > cfg.obstacleDensity) continue;

    const r = Math.random();
    const diff = Math.min(level, 4);

    if (r < 0.45) {
      // Single spike
      obstacles.push({ x: sx, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      lastObsEnd = sx + 30;
    } else if (r < 0.65) {
      // Double spike
      obstacles.push({ x: sx, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      obstacles.push({ x: sx + 34, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      lastObsEnd = sx + 64;
    } else if (r < 0.80) {
      // Block (platform obstacle to jump onto or over)
      const bh = 34 + diff * 6;
      obstacles.push({ x: sx, type: 'block', width: 50 + Math.random() * 40, height: bh, id: ++obstacleIdCounter });
      lastObsEnd = sx + 60;
    } else {
      // Gap in the ground
      const gw = 60 + diff * 10 + Math.random() * 30;
      obstacles.push({ x: sx, type: 'gap', width: gw, height: GROUND_H + 40, id: ++obstacleIdCounter });
      lastObsEnd = sx + gw;
    }
  }

  return obstacles;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GeometryDashGame() {
  const { t } = useI18n();
  const ach = useAchievements('geometrydash');

  // ── State ────────────────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [phase, setPhase] = useState<Phase>('menu');
  const [percent, setPercent] = useState(0);
  const [level, setLevel] = useState(1);
  const [stats, setStats] = useState<GdStats>(() => {
    if (typeof window === 'undefined') return { games: 0, bestPercent: 0, bestLevel: 0, attempts: 0 };
    return getStats();
  });
  const [countdownNum, setCountdownNum] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('menu');
  const diffRef = useRef<Difficulty>('medium');
  const rafRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  // Game state refs (avoid stale closures in rAF loop)
  const cubeYRef = useRef(GROUND_Y - CUBE_SIZE);
  const velYRef = useRef(0);
  const onGroundRef = useRef(true);
  const distRef = useRef(0);
  const levelRef = useRef(1);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextSegmentXRef = useRef(LEVEL_LENGTH);
  const rotationRef = useRef(0);
  const trailRef = useRef<TrailParticle[]>([]);
  const deathAnimRef = useRef(0);
  const gridOffsetRef = useRef(0);
  const lastCheckpointRef = useRef(0);

  // Sync refs
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Achievement tracking
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'menu') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render function ──────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dist = distRef.current;
    const lvl = levelRef.current;
    const colors = LEVEL_COLORS[(lvl - 1) % LEVEL_COLORS.length];
    const cubeY = cubeYRef.current;
    const rotation = rotationRef.current;
    const obstacles = obstaclesRef.current;
    const trail = trailRef.current;
    const camera = dist - CUBE_X;

    // ── Background gradient ────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    bgGrad.addColorStop(0, colors.bg1);
    bgGrad.addColorStop(1, colors.bg2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // ── Scrolling grid lines ───────────────────────────────────────────
    const gridSpacing = 60;
    const gridOff = gridOffsetRef.current % gridSpacing;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    // Vertical lines
    for (let gx = -gridOff; gx < GAME_W; gx += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, GROUND_Y);
      ctx.stroke();
    }
    // Horizontal lines
    for (let gy = gridSpacing; gy < GROUND_Y; gy += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(GAME_W, gy);
      ctx.stroke();
    }

    // ── Ground ─────────────────────────────────────────────────────────
    // Draw ground with gaps
    ctx.fillStyle = colors.ground;
    // Build ground segments (skip gaps)
    const groundSegments: { x1: number; x2: number }[] = [];
    let gStart = 0;
    const gaps = obstacles.filter(o => o.type === 'gap');
    for (const gap of gaps) {
      const gapScreenX = gap.x - camera;
      const gapEnd = gapScreenX + gap.width;
      if (gapEnd < 0 || gapScreenX > GAME_W) continue;
      if (gapScreenX > gStart) {
        groundSegments.push({ x1: gStart, x2: gapScreenX });
      }
      gStart = gapEnd;
    }
    if (gStart < GAME_W) {
      groundSegments.push({ x1: gStart, x2: GAME_W });
    }
    for (const seg of groundSegments) {
      ctx.fillRect(seg.x1, GROUND_Y, seg.x2 - seg.x1, GROUND_H);
    }

    // Ground grid pattern
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const groundGridSpacing = 30;
    const groundGridOff = gridOffsetRef.current % groundGridSpacing;
    for (const seg of groundSegments) {
      for (let gx = seg.x1 - groundGridOff; gx < seg.x2; gx += groundGridSpacing) {
        if (gx < seg.x1) continue;
        ctx.beginPath();
        ctx.moveTo(gx, GROUND_Y);
        ctx.lineTo(gx, GAME_H);
        ctx.stroke();
      }
    }

    // ── Obstacles ──────────────────────────────────────────────────────
    for (const obs of obstacles) {
      const ox = obs.x - camera;
      if (ox + obs.width < -50 || ox > GAME_W + 50) continue;

      if (obs.type === 'spike') {
        // Triangle spike
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.moveTo(ox, GROUND_Y);
        ctx.lineTo(ox + obs.width / 2, GROUND_Y - obs.height);
        ctx.lineTo(ox + obs.width, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        // Outline
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (obs.type === 'block') {
        // Block obstacle
        ctx.fillStyle = colors.ground;
        ctx.fillRect(ox, GROUND_Y - obs.height, obs.width, obs.height);
        // Border
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, GROUND_Y - obs.height, obs.width, obs.height);
        // Inner cross pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, GROUND_Y - obs.height);
        ctx.lineTo(ox + obs.width, GROUND_Y);
        ctx.moveTo(ox + obs.width, GROUND_Y - obs.height);
        ctx.lineTo(ox, GROUND_Y);
        ctx.stroke();
      }
      // gap type: we already skipped it in ground rendering
    }

    // ── Trail particles ────────────────────────────────────────────────
    for (const pt of trail) {
      const px = pt.x - camera + CUBE_X;
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = colors.cube;
      ctx.fillRect(px - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // ── Cube (player) ──────────────────────────────────────────────────
    if (deathAnimRef.current <= 0) {
      ctx.save();
      const cx = CUBE_X + CUBE_SIZE / 2;
      const cy = cubeY + CUBE_SIZE / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      // Glow
      ctx.shadowColor = colors.cube;
      ctx.shadowBlur = 12;

      // Cube body
      ctx.fillStyle = colors.cube;
      ctx.fillRect(-CUBE_SIZE / 2, -CUBE_SIZE / 2, CUBE_SIZE, CUBE_SIZE);

      // Inner square
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const inner = CUBE_SIZE * 0.55;
      ctx.fillRect(-inner / 2, -inner / 2, inner, inner);

      // Reset shadow
      ctx.shadowBlur = 0;

      // Outline
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-CUBE_SIZE / 2, -CUBE_SIZE / 2, CUBE_SIZE, CUBE_SIZE);

      ctx.restore();
    } else {
      // Death shatter animation — particles flying out
      const t = deathAnimRef.current;
      const shards = 8;
      for (let i = 0; i < shards; i++) {
        const angle = (Math.PI * 2 * i) / shards;
        const dist2 = t * 3;
        const sx = CUBE_X + CUBE_SIZE / 2 + Math.cos(angle) * dist2;
        const sy = cubeY + CUBE_SIZE / 2 + Math.sin(angle) * dist2 + t * 0.5;
        const alpha = Math.max(0, 1 - t / 40);
        const sz = CUBE_SIZE * 0.3 * (1 - t / 60);
        if (sz <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors.cube;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.1 * (i % 2 === 0 ? 1 : -1));
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ── Progress bar ───────────────────────────────────────────────────
    const barW = GAME_W - 100;
    const barH = 6;
    const barX = 50;
    const barY = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.min(distRef.current / (LEVEL_LENGTH * levelRef.current) * 100, 100);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(barX, barY, barW * (pct / 100), barH);
    // Percentage text
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(pct)}%`, barX + barW + 2, barY + barH + 12);

    // Level indicator
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`LVL ${levelRef.current}`, barX, barY + barH + 12);
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    const cfg = DIFF_CONFIG[diffRef.current];
    const lvl = levelRef.current;
    const speed = Math.min(cfg.baseSpeed + (lvl - 1) * cfg.speedInc, cfg.maxSpeed);

    // Move forward
    distRef.current += speed;
    gridOffsetRef.current += speed;

    // Calculate level and percent
    const totalDist = distRef.current;
    const currentLevel = Math.floor(totalDist / LEVEL_LENGTH) + 1;
    const levelDist = totalDist % LEVEL_LENGTH;
    const pct = Math.floor((levelDist / LEVEL_LENGTH) * 100);

    if (currentLevel !== levelRef.current) {
      levelRef.current = currentLevel;
      setLevel(currentLevel);
      sfx.checkpointSound();
    }

    // Check for 10% checkpoints
    const checkpoint10 = Math.floor(pct / 10) * 10;
    if (checkpoint10 > 0 && checkpoint10 > lastCheckpointRef.current) {
      lastCheckpointRef.current = checkpoint10;
      // Small beep every 10%
    }

    setPercent(pct);

    // Generate new obstacles as needed
    while (distRef.current + GAME_W > nextSegmentXRef.current) {
      const segLevel = Math.floor(nextSegmentXRef.current / LEVEL_LENGTH) + 1;
      const newObs = generateSegment(nextSegmentXRef.current, cfg, segLevel);
      obstaclesRef.current = [...obstaclesRef.current, ...newObs];
      nextSegmentXRef.current += LEVEL_LENGTH;
    }

    // Cull old obstacles
    const camera = distRef.current - CUBE_X;
    obstaclesRef.current = obstaclesRef.current.filter(o => o.x + o.width > camera - 100);

    // Physics
    let cubeY = cubeYRef.current;
    let velY = velYRef.current;
    let onGround = false;

    velY += GRAVITY;
    cubeY += velY;

    // Check if cube is on a block
    let onBlock = false;
    for (const obs of obstaclesRef.current) {
      if (obs.type === 'block') {
        const ox = obs.x - camera;
        const cubeLeft = CUBE_X;
        const cubeRight = CUBE_X + CUBE_SIZE;
        const blockLeft = ox;
        const blockRight = ox + obs.width;
        const blockTop = GROUND_Y - obs.height;

        // Landing on top of block
        if (cubeRight > blockLeft + 4 && cubeLeft < blockRight - 4) {
          if (cubeY + CUBE_SIZE >= blockTop && cubeY + CUBE_SIZE <= blockTop + velY + 8 && velY >= 0) {
            cubeY = blockTop - CUBE_SIZE;
            velY = 0;
            onBlock = true;
            onGround = true;
          }
        }
      }
    }

    // Check if over a gap
    let overGap = false;
    for (const obs of obstaclesRef.current) {
      if (obs.type === 'gap') {
        const ox = obs.x - camera;
        const cubeCenter = CUBE_X + CUBE_SIZE / 2;
        if (cubeCenter > ox && cubeCenter < ox + obs.width) {
          overGap = true;
          break;
        }
      }
    }

    // Ground collision (only if not over a gap)
    if (!onBlock && !overGap && cubeY + CUBE_SIZE >= GROUND_Y) {
      cubeY = GROUND_Y - CUBE_SIZE;
      velY = 0;
      onGround = true;
    }

    // Fell into a gap
    if (overGap && cubeY > GAME_H + 50) {
      die();
      return;
    }

    // Rotation — spin while in the air
    if (!onGround) {
      rotationRef.current += speed * 0.04;
    } else {
      // Snap rotation to nearest 90 deg
      const snap = Math.PI / 2;
      rotationRef.current = Math.round(rotationRef.current / snap) * snap;
    }

    cubeYRef.current = cubeY;
    velYRef.current = velY;
    onGroundRef.current = onGround;

    // Trail particles
    if (onGround) {
      trailRef.current.push({
        x: distRef.current - CUBE_X,
        y: cubeY + CUBE_SIZE,
        alpha: 0.5,
        size: 4 + Math.random() * 4,
      });
    }
    // Update trail
    trailRef.current = trailRef.current
      .map(p => ({ ...p, alpha: p.alpha - 0.02, size: p.size * 0.97 }))
      .filter(p => p.alpha > 0);

    // Collision with spikes / blocks (side collision)
    for (const obs of obstaclesRef.current) {
      const ox = obs.x - camera;

      if (obs.type === 'spike') {
        // Triangle hitbox (simplified as smaller rect)
        const spikeLeft = ox + 5;
        const spikeRight = ox + obs.width - 5;
        const spikeTop = GROUND_Y - obs.height + 6;
        const cubeLeft = CUBE_X;
        const cubeRight = CUBE_X + CUBE_SIZE;
        const cubeTop = cubeY;
        const cubeBottom = cubeY + CUBE_SIZE;

        if (cubeRight > spikeLeft && cubeLeft < spikeRight &&
            cubeBottom > spikeTop && cubeTop < GROUND_Y) {
          die();
          return;
        }
      } else if (obs.type === 'block') {
        // Side collision with blocks (not top — that is handled above)
        const blockLeft = ox;
        const blockRight = ox + obs.width;
        const blockTop = GROUND_Y - obs.height;
        const cubeLeft = CUBE_X;
        const cubeRight = CUBE_X + CUBE_SIZE;
        const cubeTop = cubeY;
        const cubeBottom = cubeY + CUBE_SIZE;

        // Only collide from the side (not top, which is landing)
        if (cubeRight > blockLeft && cubeLeft < blockRight &&
            cubeBottom > blockTop + 4 && cubeTop < GROUND_Y) {
          // Check if it's a side hit (cube's right edge hitting block's left edge)
          if (cubeRight - blockLeft < speed + 6 && cubeBottom > blockTop + 8) {
            die();
            return;
          }
        }
      }
    }

    render();
    rafRef.current = requestAnimationFrame(tick);
  }, [render]);

  // ── Die helper ─────────────────────────────────────────────────────────
  const die = useCallback(() => {
    sfx.deathSound();
    phaseRef.current = 'ended';
    setPhase('ended');

    // Death animation
    deathAnimRef.current = 1;
    const animLoop = () => {
      deathAnimRef.current += 1.5;
      render();
      if (deathAnimRef.current < 45) {
        requestAnimationFrame(animLoop);
      }
    };
    requestAnimationFrame(animLoop);

    // Save stats
    if (!savedRef.current) {
      savedRef.current = true;
      const totalPct = Math.floor(
        ((distRef.current % LEVEL_LENGTH) / LEVEL_LENGTH) * 100
      );
      const newStats = recordRun(totalPct, levelRef.current);
      setStats(newStats);
    }
  }, [render]);

  // ── Start / stop loop ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, tick]);

  // ── Countdown ────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);

    // Reset game state
    cubeYRef.current = GROUND_Y - CUBE_SIZE;
    velYRef.current = 0;
    onGroundRef.current = true;
    distRef.current = 0;
    levelRef.current = 1;
    obstacleIdCounter = 0;
    const cfg = DIFF_CONFIG[diffRef.current];
    obstaclesRef.current = generateSegment(0, cfg, 1);
    nextSegmentXRef.current = LEVEL_LENGTH;
    rotationRef.current = 0;
    trailRef.current = [];
    deathAnimRef.current = 0;
    gridOffsetRef.current = 0;
    lastCheckpointRef.current = 0;
    savedRef.current = false;
    setPercent(0);
    setLevel(1);

    setPhase('countdown');
    phaseRef.current = 'countdown';
    setCountdownNum(COUNTDOWN_STEPS);
    sfx.countdownBeep();

    // Render the initial frame
    render();

    let step = COUNTDOWN_STEPS;
    const advance = () => {
      step -= 1;
      if (step > 0) {
        sfx.countdownBeep();
        setCountdownNum(step);
        countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
      } else {
        sfx.countdownGo();
        setCountdownNum(0);
        countdownTimerRef.current = null;
        phaseRef.current = 'playing';
        setPhase('playing');
      }
    };
    countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
  }, [render]);

  // Cleanup countdown timer
  useEffect(() => {
    return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (phaseRef.current === 'menu' || phaseRef.current === 'ended') {
      startCountdown();
      return;
    }
    if (phaseRef.current === 'playing' && onGroundRef.current) {
      sfx.jumpSound();
      velYRef.current = JUMP_VEL;
      onGroundRef.current = false;
    }
  }, [startCountdown]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
    }
  }, []);

  // ── Auto-pause on tab switch ─────────────────────────────────────────
  useVisibilityPause(phase === 'playing', togglePause);

  // ── Input ────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        jump();
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, togglePause]);

  // Load stats on mount
  useEffect(() => {
    setStats(getStats());
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full mx-auto select-none flex-1 min-h-0">
      {/* Score bar */}
      <div className="shrink-0 flex items-center justify-between w-full max-w-[850px] px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            {t('lobby.games.geometrydash.title')}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400 text-xs">
            {t('geometrydash.progress')}: <span className="font-bold text-zinc-200 tabular-nums">{percent}%</span>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 text-xs">
            LVL <span className="font-bold text-zinc-200 tabular-nums">{level}</span>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 text-xs">
            {t('game.best')}: <span className="font-bold text-zinc-200 tabular-nums">{stats.bestPercent}%</span>
          </span>
        </div>
      </div>

      {/* Game viewport */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div
          className="relative h-full overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-950"
          style={{ aspectRatio: `${GAME_W} / ${GAME_H}`, maxWidth: '100%' }}
          onClick={() => { if (phase !== 'ended') jump(); }}
          onPointerDown={(e) => { if (phase !== 'ended') { e.preventDefault(); } }}
        >
          {/* Canvas */}
          <canvas
            ref={canvasRef}
            width={GAME_W}
            height={GAME_H}
            className="absolute inset-0 w-full h-full"
          />

          {/* ── Overlays ──────────────────────────────────────────────── */}

          {/* Menu */}
          {phase === 'menu' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
              <div className="text-3xl font-black text-emerald-400 mb-2 drop-shadow-lg">
                {t('lobby.games.geometrydash.title')}
              </div>
              <p className="text-sm text-zinc-300 mb-5">
                {t('lobby.games.geometrydash.desc')}
              </p>

              {/* Difficulty selector */}
              <div className="flex flex-col items-center gap-1.5 mb-5">
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                  {t('geometrydash.difficulty')}
                </span>
                <div className="flex gap-1.5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={(e) => { e.stopPropagation(); setDifficulty(d); diffRef.current = d; }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        difficulty === d
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {t(`geometrydash.${d}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-[11px] text-zinc-400 mb-5">
                <span>{t('geometrydash.attempts')}: <span className="text-zinc-200 font-bold">{stats.attempts}</span></span>
                <span>{t('game.best')}: <span className="text-zinc-200 font-bold">{stats.bestPercent}%</span></span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); jump(); }}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-emerald-900/40"
              >
                {t('geometrydash.start')}
              </button>

              <p className="text-[11px] text-zinc-500 mt-3">
                Space / W / Click
              </p>
            </div>
          )}

          {/* Countdown */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-20">
              <span className="text-7xl font-black text-white drop-shadow-lg tabular-nums animate-pulse">
                {countdownNum}
              </span>
            </div>
          )}

          {/* Paused */}
          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
              <div className="text-2xl font-black text-zinc-100 mb-4">{t('game.paused')}</div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePause(); }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Game Over */}
          {phase === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
              <div className="text-2xl font-black text-rose-400 mb-1">{t('game.over')}</div>
              <div className="text-4xl font-black text-zinc-100 mb-1 tabular-nums">{percent}%</div>
              <div className="text-xs text-zinc-400 mb-1">
                LVL {level}
              </div>
              {percent >= stats.bestPercent && percent > 0 && (
                <span className="text-xs font-bold text-amber-400 mb-2">{t('game.newBest')}</span>
              )}
              <div className="text-xs text-zinc-400 mb-4">
                {t('game.best')}: <span className="text-zinc-200 font-bold tabular-nums">{stats.bestPercent}%</span>
                <span className="text-zinc-600 mx-2">|</span>
                {t('geometrydash.attempts')}: <span className="text-zinc-200 font-bold tabular-nums">{stats.attempts}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); jump(); }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95"
              >
                {t('game.restart')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="shrink-0 flex gap-2 w-full max-w-[850px] sm:hidden">
        <button
          onPointerDown={(e) => { e.preventDefault(); jump(); }}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm active:scale-[0.97] transition-all"
        >
          {t('geometrydash.jump')}
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); togglePause(); }}
          className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-semibold text-sm active:scale-[0.97] transition-all"
        >
          ||
        </button>
      </div>

      {/* Controls legend (desktop) */}
      <div className="shrink-0 hidden sm:flex items-center gap-4 text-[11px] text-zinc-600">
        <span>Space / W / Click = {t('geometrydash.jump')}</span>
        <span>P / Esc = {t('game.paused')}</span>
      </div>
    </div>
  );
}
