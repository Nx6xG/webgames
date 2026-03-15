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

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 600;

const PROGRESS_KEY = 'webgames.geometrydash.levelProgress';

// ── Obstacle types ───────────────────────────────────────────────────────────

interface Obstacle {
  x: number;
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
  { bg1: '#0f1a0f', bg2: '#1a3a1a', ground: '#2a5f2a', cube: '#66ff66', accent: '#66ff66', grid: 'rgba(102,255,102,0.06)' },
  { bg1: '#1a0f1e', bg2: '#3a1a3a', ground: '#5f2a5f', cube: '#cc66ff', accent: '#cc66ff', grid: 'rgba(204,102,255,0.06)' },
  { bg1: '#1e1a0a', bg2: '#3a2d15', ground: '#5f4a1a', cube: '#ffaa44', accent: '#ffaa44', grid: 'rgba(255,170,68,0.06)' },
  { bg1: '#0a0f1e', bg2: '#152a3a', ground: '#1a3a6b', cube: '#4488ff', accent: '#4488ff', grid: 'rgba(68,136,255,0.06)' },
  { bg1: '#1e0a10', bg2: '#3a1520', ground: '#6b2040', cube: '#ff4466', accent: '#ff4466', grid: 'rgba(255,68,102,0.06)' },
];

// ── Level definitions ────────────────────────────────────────────────────────

interface LevelObstacleDef {
  type: 'spike' | 'spike2' | 'block' | 'gap';
  offset: number;
  width?: number;
  height?: number;
}

interface LevelDef {
  nameKey: string;
  speed: number;
  obstacles: LevelObstacleDef[];
  length: number;
  theme: number;
  difficulty: number; // 1-10 stars
}

const LEVELS: LevelDef[] = [
  // Level 1: Stereo Madness — gentle intro
  {
    nameKey: 'geometrydash.level.1',
    speed: 4.5,
    theme: 0,
    length: 2600,
    difficulty: 1,
    obstacles: [
      { type: 'spike', offset: 500 },
      { type: 'spike', offset: 750 },
      { type: 'spike', offset: 1000 },
      { type: 'block', offset: 1250, width: 60 },
      { type: 'spike', offset: 1500 },
      { type: 'spike2', offset: 1700 },
      { type: 'gap', offset: 1900, width: 70 },
      { type: 'spike', offset: 2150 },
      { type: 'block', offset: 2300, width: 50 },
    ],
  },
  // Level 2: Back on Track — tighter spacing
  {
    nameKey: 'geometrydash.level.2',
    speed: 5.0,
    theme: 1,
    length: 3000,
    difficulty: 2,
    obstacles: [
      { type: 'spike', offset: 450 },
      { type: 'spike2', offset: 650 },
      { type: 'spike', offset: 830 },
      { type: 'block', offset: 1000, width: 70, height: 40 },
      { type: 'gap', offset: 1200, width: 80 },
      { type: 'spike2', offset: 1400 },
      { type: 'spike', offset: 1580 },
      { type: 'spike2', offset: 1750 },
      { type: 'block', offset: 1920, width: 50 },
      { type: 'spike', offset: 2100 },
      { type: 'gap', offset: 2280, width: 70 },
      { type: 'spike2', offset: 2480 },
      { type: 'spike', offset: 2660 },
      { type: 'block', offset: 2830, width: 80 },
    ],
  },
  // Level 3: Polargeist — gaps and blocks
  {
    nameKey: 'geometrydash.level.3',
    speed: 5.5,
    theme: 2,
    length: 3200,
    difficulty: 3,
    obstacles: [
      { type: 'spike', offset: 420 },
      { type: 'gap', offset: 600, width: 75 },
      { type: 'spike2', offset: 800 },
      { type: 'block', offset: 980, width: 60, height: 45 },
      { type: 'spike', offset: 1160 },
      { type: 'spike', offset: 1300 },
      { type: 'gap', offset: 1480, width: 85 },
      { type: 'spike2', offset: 1700 },
      { type: 'block', offset: 1860, width: 70, height: 50 },
      { type: 'spike', offset: 2050 },
      { type: 'spike2', offset: 2200 },
      { type: 'gap', offset: 2380, width: 80 },
      { type: 'spike', offset: 2580 },
      { type: 'block', offset: 2740, width: 60 },
      { type: 'spike2', offset: 2920 },
      { type: 'spike', offset: 3080 },
    ],
  },
  // Level 4: Dry Out — block + spike combos
  {
    nameKey: 'geometrydash.level.4',
    speed: 6.0,
    theme: 3,
    length: 3400,
    difficulty: 4,
    obstacles: [
      { type: 'spike', offset: 400 },
      { type: 'block', offset: 580, width: 50, height: 34 },
      { type: 'spike', offset: 720 },
      { type: 'spike2', offset: 880 },
      { type: 'gap', offset: 1050, width: 75 },
      { type: 'spike', offset: 1230 },
      { type: 'block', offset: 1380, width: 80, height: 50 },
      { type: 'spike2', offset: 1580 },
      { type: 'spike', offset: 1720 },
      { type: 'gap', offset: 1880, width: 90 },
      { type: 'block', offset: 2080, width: 60, height: 40 },
      { type: 'spike', offset: 2250 },
      { type: 'spike2', offset: 2400 },
      { type: 'spike', offset: 2550 },
      { type: 'block', offset: 2710, width: 70, height: 55 },
      { type: 'gap', offset: 2900, width: 80 },
      { type: 'spike2', offset: 3100 },
      { type: 'spike', offset: 3250 },
    ],
  },
  // Level 5: Base After Base — dense obstacle sections
  {
    nameKey: 'geometrydash.level.5',
    speed: 6.5,
    theme: 4,
    length: 3600,
    difficulty: 5,
    obstacles: [
      { type: 'spike', offset: 400 },
      { type: 'spike', offset: 560 },
      { type: 'spike2', offset: 720 },
      { type: 'block', offset: 900, width: 55, height: 40 },
      { type: 'gap', offset: 1070, width: 80 },
      { type: 'spike', offset: 1260 },
      { type: 'spike2', offset: 1400 },
      { type: 'spike', offset: 1540 },
      { type: 'block', offset: 1700, width: 70, height: 50 },
      { type: 'spike', offset: 1880 },
      { type: 'gap', offset: 2040, width: 85 },
      { type: 'spike2', offset: 2240 },
      { type: 'spike', offset: 2380 },
      { type: 'spike2', offset: 2520 },
      { type: 'block', offset: 2680, width: 60, height: 45 },
      { type: 'spike', offset: 2850 },
      { type: 'gap', offset: 3010, width: 75 },
      { type: 'spike', offset: 3190 },
      { type: 'spike2', offset: 3330 },
      { type: 'spike', offset: 3460 },
    ],
  },
  // Level 6: Can't Let Go — alternating patterns
  {
    nameKey: 'geometrydash.level.6',
    speed: 7.0,
    theme: 5,
    length: 3800,
    difficulty: 6,
    obstacles: [
      { type: 'spike', offset: 380 },
      { type: 'gap', offset: 540, width: 80 },
      { type: 'spike2', offset: 720 },
      { type: 'spike', offset: 860 },
      { type: 'block', offset: 1020, width: 65, height: 50 },
      { type: 'spike2', offset: 1190 },
      { type: 'gap', offset: 1340, width: 90 },
      { type: 'spike', offset: 1540 },
      { type: 'spike', offset: 1670 },
      { type: 'spike2', offset: 1800 },
      { type: 'block', offset: 1960, width: 55, height: 40 },
      { type: 'spike', offset: 2130 },
      { type: 'gap', offset: 2280, width: 85 },
      { type: 'spike2', offset: 2470 },
      { type: 'spike', offset: 2600 },
      { type: 'block', offset: 2760, width: 80, height: 55 },
      { type: 'spike', offset: 2950 },
      { type: 'spike2', offset: 3080 },
      { type: 'gap', offset: 3240, width: 80 },
      { type: 'spike', offset: 3430 },
      { type: 'spike2', offset: 3570 },
      { type: 'spike', offset: 3700 },
    ],
  },
  // Level 7: Jumper — rapid-fire spikes
  {
    nameKey: 'geometrydash.level.7',
    speed: 7.5,
    theme: 6,
    length: 4000,
    difficulty: 7,
    obstacles: [
      { type: 'spike', offset: 370 },
      { type: 'spike', offset: 530 },
      { type: 'spike2', offset: 690 },
      { type: 'spike', offset: 840 },
      { type: 'gap', offset: 1000, width: 85 },
      { type: 'spike2', offset: 1190 },
      { type: 'spike', offset: 1330 },
      { type: 'spike', offset: 1470 },
      { type: 'block', offset: 1620, width: 60, height: 45 },
      { type: 'spike2', offset: 1790 },
      { type: 'spike', offset: 1920 },
      { type: 'gap', offset: 2070, width: 90 },
      { type: 'spike', offset: 2270 },
      { type: 'spike2', offset: 2400 },
      { type: 'spike', offset: 2530 },
      { type: 'block', offset: 2680, width: 70, height: 55 },
      { type: 'spike', offset: 2860 },
      { type: 'spike2', offset: 2990 },
      { type: 'gap', offset: 3140, width: 80 },
      { type: 'spike', offset: 3330 },
      { type: 'spike', offset: 3460 },
      { type: 'spike2', offset: 3590 },
      { type: 'block', offset: 3740, width: 50, height: 40 },
      { type: 'spike', offset: 3900 },
    ],
  },
  // Level 8: Time Machine — complex patterns
  {
    nameKey: 'geometrydash.level.8',
    speed: 8.0,
    theme: 7,
    length: 4200,
    difficulty: 8,
    obstacles: [
      { type: 'spike2', offset: 360 },
      { type: 'spike', offset: 510 },
      { type: 'block', offset: 660, width: 70, height: 50 },
      { type: 'gap', offset: 840, width: 90 },
      { type: 'spike', offset: 1040 },
      { type: 'spike2', offset: 1170 },
      { type: 'spike', offset: 1300 },
      { type: 'spike2', offset: 1430 },
      { type: 'block', offset: 1580, width: 55, height: 40 },
      { type: 'spike', offset: 1740 },
      { type: 'gap', offset: 1880, width: 95 },
      { type: 'spike2', offset: 2090 },
      { type: 'spike', offset: 2220 },
      { type: 'spike', offset: 2350 },
      { type: 'block', offset: 2500, width: 80, height: 60 },
      { type: 'spike2', offset: 2690 },
      { type: 'gap', offset: 2840, width: 85 },
      { type: 'spike', offset: 3030 },
      { type: 'spike2', offset: 3160 },
      { type: 'spike', offset: 3290 },
      { type: 'spike', offset: 3420 },
      { type: 'block', offset: 3570, width: 60, height: 45 },
      { type: 'gap', offset: 3740, width: 80 },
      { type: 'spike2', offset: 3920 },
      { type: 'spike', offset: 4060 },
    ],
  },
  // Level 9: Cycles — extreme density
  {
    nameKey: 'geometrydash.level.9',
    speed: 8.5,
    theme: 8,
    length: 4400,
    difficulty: 9,
    obstacles: [
      { type: 'spike', offset: 350 },
      { type: 'spike2', offset: 490 },
      { type: 'spike', offset: 630 },
      { type: 'gap', offset: 780, width: 85 },
      { type: 'spike2', offset: 970 },
      { type: 'spike', offset: 1100 },
      { type: 'block', offset: 1240, width: 60, height: 50 },
      { type: 'spike', offset: 1410 },
      { type: 'spike2', offset: 1540 },
      { type: 'spike', offset: 1670 },
      { type: 'gap', offset: 1820, width: 90 },
      { type: 'spike', offset: 2020 },
      { type: 'spike2', offset: 2150 },
      { type: 'block', offset: 2290, width: 70, height: 55 },
      { type: 'spike', offset: 2470 },
      { type: 'spike', offset: 2600 },
      { type: 'spike2', offset: 2730 },
      { type: 'gap', offset: 2880, width: 85 },
      { type: 'spike', offset: 3070 },
      { type: 'block', offset: 3210, width: 55, height: 45 },
      { type: 'spike2', offset: 3380 },
      { type: 'spike', offset: 3510 },
      { type: 'spike', offset: 3640 },
      { type: 'gap', offset: 3790, width: 90 },
      { type: 'spike2', offset: 3990 },
      { type: 'spike', offset: 4120 },
      { type: 'block', offset: 4260, width: 65, height: 50 },
    ],
  },
  // Level 10: xStep — ultimate challenge
  {
    nameKey: 'geometrydash.level.10',
    speed: 9.0,
    theme: 9,
    length: 4700,
    difficulty: 10,
    obstacles: [
      { type: 'spike2', offset: 340 },
      { type: 'spike', offset: 470 },
      { type: 'spike', offset: 600 },
      { type: 'block', offset: 740, width: 65, height: 50 },
      { type: 'gap', offset: 910, width: 90 },
      { type: 'spike2', offset: 1100 },
      { type: 'spike', offset: 1230 },
      { type: 'spike2', offset: 1360 },
      { type: 'spike', offset: 1490 },
      { type: 'block', offset: 1630, width: 75, height: 55 },
      { type: 'spike', offset: 1810 },
      { type: 'gap', offset: 1950, width: 95 },
      { type: 'spike2', offset: 2150 },
      { type: 'spike', offset: 2280 },
      { type: 'spike', offset: 2410 },
      { type: 'spike2', offset: 2540 },
      { type: 'block', offset: 2680, width: 60, height: 45 },
      { type: 'spike', offset: 2850 },
      { type: 'gap', offset: 3000, width: 90 },
      { type: 'spike', offset: 3200 },
      { type: 'spike2', offset: 3330 },
      { type: 'spike', offset: 3460 },
      { type: 'block', offset: 3600, width: 70, height: 60 },
      { type: 'spike2', offset: 3780 },
      { type: 'spike', offset: 3910 },
      { type: 'gap', offset: 4060, width: 85 },
      { type: 'spike', offset: 4250 },
      { type: 'spike2', offset: 4380 },
      { type: 'spike', offset: 4510 },
    ],
  },
];

// ── Endless mode procedural generation ───────────────────────────────────────

const ENDLESS_LEVEL_LENGTH = 3200;

interface EndlessDiffConfig {
  baseSpeed: number;
  speedInc: number;
  maxSpeed: number;
  obstacleDensity: number;
  gapMin: number;
}

const ENDLESS_CONFIG: EndlessDiffConfig = {
  baseSpeed: 6.0, speedInc: 0.4, maxSpeed: 12, obstacleDensity: 0.45, gapMin: 160,
};

let obstacleIdCounter = 0;

function generateEndlessSegment(startX: number, segLevel: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const slotSize = 80;
  const slots = Math.floor(ENDLESS_LEVEL_LENGTH / slotSize);
  let lastObsEnd = startX;
  const cfg = ENDLESS_CONFIG;

  for (let i = 2; i < slots - 1; i++) {
    const sx = startX + i * slotSize;
    if (sx - lastObsEnd < cfg.gapMin) continue;
    if (Math.random() > cfg.obstacleDensity) continue;

    const r = Math.random();
    const diff = Math.min(segLevel, 6);

    if (r < 0.45) {
      obstacles.push({ x: sx, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      lastObsEnd = sx + 30;
    } else if (r < 0.65) {
      obstacles.push({ x: sx, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      obstacles.push({ x: sx + 34, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      lastObsEnd = sx + 64;
    } else if (r < 0.80) {
      const bh = 34 + diff * 6;
      obstacles.push({ x: sx, type: 'block', width: 50 + Math.random() * 40, height: bh, id: ++obstacleIdCounter });
      lastObsEnd = sx + 60;
    } else {
      const gw = 60 + diff * 10 + Math.random() * 30;
      obstacles.push({ x: sx, type: 'gap', width: gw, height: GROUND_H + 40, id: ++obstacleIdCounter });
      lastObsEnd = sx + gw;
    }
  }

  return obstacles;
}

// ── Generate obstacles from a level definition ──────────────────────────────

function generateLevelObstaclesFull(levelDef: LevelDef): Obstacle[] {
  obstacleIdCounter = 0;
  const obstacles: Obstacle[] = [];
  for (const o of levelDef.obstacles) {
    if (o.type === 'spike') {
      obstacles.push({ x: o.offset, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
    } else if (o.type === 'spike2') {
      obstacles.push({ x: o.offset, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
      obstacles.push({ x: o.offset + 34, type: 'spike', width: 30, height: 34, id: ++obstacleIdCounter });
    } else if (o.type === 'block') {
      obstacles.push({ x: o.offset, type: 'block', width: o.width ?? 60, height: o.height ?? 40, id: ++obstacleIdCounter });
    } else {
      obstacles.push({ x: o.offset, type: 'gap', width: o.width ?? 70, height: GROUND_H + 40, id: ++obstacleIdCounter });
    }
  }
  return obstacles;
}

// ── Level progress persistence ──────────────────────────────────────────────

interface LevelProgress {
  bestPercent: number;
  stars: number; // 0-3
  attempts: number;
}

function getLevelProgress(): Record<number, LevelProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, LevelProgress>;
  } catch { return {}; }
}

function saveLevelProgress(progress: Record<number, LevelProgress>): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* noop */ }
}

function isLevelUnlocked(levelIndex: number, progress: Record<number, LevelProgress>): boolean {
  if (levelIndex === 0) return true;
  const prev = progress[levelIndex - 1];
  return prev !== undefined && prev.bestPercent >= 80;
}

// ── Phase ────────────────────────────────────────────────────────────────────

type Phase = 'levelSelect' | 'countdown' | 'playing' | 'paused' | 'ended' | 'complete';

// ── Component ────────────────────────────────────────────────────────────────

export function GeometryDashGame() {
  const { t } = useI18n();
  const ach = useAchievements('geometrydash');

  // ── State ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('levelSelect');
  const [percent, setPercent] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(0); // index into LEVELS, or -1 for endless
  const [levelAttempts, setLevelAttempts] = useState(0);
  const [stats, setStats] = useState<GdStats>(() => {
    if (typeof window === 'undefined') return { games: 0, bestPercent: 0, bestLevel: 0, attempts: 0 };
    return getStats();
  });
  const [levelProgress, setLevelProgress] = useState<Record<number, LevelProgress>>(() => {
    if (typeof window === 'undefined') return {};
    return getLevelProgress();
  });
  const [countdownNum, setCountdownNum] = useState(0);
  const [completionStars, setCompletionStars] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('levelSelect');
  const rafRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  // Game state refs
  const cubeYRef = useRef(GROUND_Y - CUBE_SIZE);
  const velYRef = useRef(0);
  const onGroundRef = useRef(true);
  const distRef = useRef(0);
  const selectedLevelRef = useRef(0);
  const levelAttemptsRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextSegmentXRef = useRef(0);
  const rotationRef = useRef(0);
  const trailRef = useRef<TrailParticle[]>([]);
  const deathAnimRef = useRef(0);
  const gridOffsetRef = useRef(0);

  // Sync refs
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { selectedLevelRef.current = selectedLevel; }, [selectedLevel]);
  useEffect(() => { levelAttemptsRef.current = levelAttempts; }, [levelAttempts]);

  // Achievement tracking
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'levelSelect') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Get current level info ────────────────────────────────────────────
  const isEndless = selectedLevel === -1;
  const currentLevelDef = isEndless ? null : LEVELS[selectedLevel];
  const currentColors = isEndless
    ? LEVEL_COLORS[0]
    : LEVEL_COLORS[currentLevelDef!.theme % LEVEL_COLORS.length];

  // ── Render function ───────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dist = distRef.current;
    const lvlIdx = selectedLevelRef.current;
    const isEndlessMode = lvlIdx === -1;
    const levelDef = isEndlessMode ? null : LEVELS[lvlIdx];
    const colors = isEndlessMode
      ? LEVEL_COLORS[Math.floor(dist / ENDLESS_LEVEL_LENGTH) % LEVEL_COLORS.length]
      : LEVEL_COLORS[levelDef!.theme % LEVEL_COLORS.length];
    const cubeY = cubeYRef.current;
    const rotation = rotationRef.current;
    const obstacles = obstaclesRef.current;
    const trail = trailRef.current;
    const camera = dist - CUBE_X;

    // ── Background gradient ─────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    bgGrad.addColorStop(0, colors.bg1);
    bgGrad.addColorStop(1, colors.bg2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // ── Scrolling grid lines ────────────────────────────────────────
    const gridSpacing = 60;
    const gridOff = gridOffsetRef.current % gridSpacing;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let gx = -gridOff; gx < GAME_W; gx += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, GROUND_Y); ctx.stroke();
    }
    for (let gy = gridSpacing; gy < GROUND_Y; gy += gridSpacing) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(GAME_W, gy); ctx.stroke();
    }

    // ── Ground ──────────────────────────────────────────────────────
    ctx.fillStyle = colors.ground;
    const groundSegments: { x1: number; x2: number }[] = [];
    let gStart = 0;
    const gaps = obstacles.filter(o => o.type === 'gap');
    for (const gap of gaps) {
      const gapScreenX = gap.x - camera;
      const gapEnd = gapScreenX + gap.width;
      if (gapEnd < 0 || gapScreenX > GAME_W) continue;
      if (gapScreenX > gStart) groundSegments.push({ x1: gStart, x2: gapScreenX });
      gStart = gapEnd;
    }
    if (gStart < GAME_W) groundSegments.push({ x1: gStart, x2: GAME_W });
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
        ctx.beginPath(); ctx.moveTo(gx, GROUND_Y); ctx.lineTo(gx, GAME_H); ctx.stroke();
      }
    }

    // ── Obstacles ───────────────────────────────────────────────────
    for (const obs of obstacles) {
      const ox = obs.x - camera;
      if (ox + obs.width < -50 || ox > GAME_W + 50) continue;

      if (obs.type === 'spike') {
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.moveTo(ox, GROUND_Y);
        ctx.lineTo(ox + obs.width / 2, GROUND_Y - obs.height);
        ctx.lineTo(ox + obs.width, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (obs.type === 'block') {
        ctx.fillStyle = colors.ground;
        ctx.fillRect(ox, GROUND_Y - obs.height, obs.width, obs.height);
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, GROUND_Y - obs.height, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, GROUND_Y - obs.height);
        ctx.lineTo(ox + obs.width, GROUND_Y);
        ctx.moveTo(ox + obs.width, GROUND_Y - obs.height);
        ctx.lineTo(ox, GROUND_Y);
        ctx.stroke();
      }
    }

    // ── Trail particles ─────────────────────────────────────────────
    for (const pt of trail) {
      const px = pt.x - camera + CUBE_X;
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = colors.cube;
      ctx.fillRect(px - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // ── Cube (player) ───────────────────────────────────────────────
    ctx.globalAlpha = 1; // ensure full opacity after trail particles
    if (deathAnimRef.current <= 0) {
      ctx.save();
      ctx.globalAlpha = 1;
      const cx = CUBE_X + CUBE_SIZE / 2;
      const cy = cubeY + CUBE_SIZE / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.shadowColor = colors.cube;
      ctx.shadowBlur = 12;
      ctx.fillStyle = colors.cube;
      ctx.fillRect(-CUBE_SIZE / 2, -CUBE_SIZE / 2, CUBE_SIZE, CUBE_SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      const inner = CUBE_SIZE * 0.55;
      ctx.fillRect(-inner / 2, -inner / 2, inner, inner);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-CUBE_SIZE / 2, -CUBE_SIZE / 2, CUBE_SIZE, CUBE_SIZE);
      ctx.restore();
    } else {
      const animT = deathAnimRef.current;
      const shards = 8;
      for (let i = 0; i < shards; i++) {
        const angle = (Math.PI * 2 * i) / shards;
        const dist2 = animT * 3;
        const sx = CUBE_X + CUBE_SIZE / 2 + Math.cos(angle) * dist2;
        const sy = cubeY + CUBE_SIZE / 2 + Math.sin(angle) * dist2 + animT * 0.5;
        const alpha = Math.max(0, 1 - animT / 40);
        const sz = CUBE_SIZE * 0.3 * (1 - animT / 60);
        if (sz <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors.cube;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(animT * 0.1 * (i % 2 === 0 ? 1 : -1));
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ── Progress bar ────────────────────────────────────────────────
    const barW = GAME_W - 100;
    const barH = 6;
    const barX = 50;
    const barY = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);

    let pct: number;
    if (isEndlessMode) {
      const endlessLvl = Math.floor(dist / ENDLESS_LEVEL_LENGTH) + 1;
      pct = Math.min(((dist % ENDLESS_LEVEL_LENGTH) / ENDLESS_LEVEL_LENGTH) * 100, 100);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(barX, barY, barW * (pct / 100), barH);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(pct)}%`, barX + barW + 2, barY + barH + 12);
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`ENDLESS LVL ${endlessLvl}`, barX, barY + barH + 12);
    } else {
      pct = Math.min((dist / levelDef!.length) * 100, 100);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(barX, barY, barW * (pct / 100), barH);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(pct)}%`, barX + barW + 2, barY + barH + 12);
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`LVL ${lvlIdx + 1}`, barX, barY + barH + 12);
    }
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    const lvlIdx = selectedLevelRef.current;
    const isEndlessMode = lvlIdx === -1;
    const levelDef = isEndlessMode ? null : LEVELS[lvlIdx];
    const speed = isEndlessMode
      ? Math.min(ENDLESS_CONFIG.baseSpeed + (Math.floor(distRef.current / ENDLESS_LEVEL_LENGTH)) * ENDLESS_CONFIG.speedInc, ENDLESS_CONFIG.maxSpeed)
      : levelDef!.speed;

    // Move forward
    distRef.current += speed;
    gridOffsetRef.current += speed;

    // Check level completion (non-endless)
    if (!isEndlessMode && distRef.current >= levelDef!.length) {
      distRef.current = levelDef!.length;
      setPercent(100);

      // Save completion
      if (!savedRef.current) {
        savedRef.current = true;
        const attempts = levelAttemptsRef.current;
        const stars = attempts <= 1 ? 3 : attempts <= 3 ? 2 : 1;
        setCompletionStars(stars);

        // Update progress
        const prog = getLevelProgress();
        const existing = prog[lvlIdx];
        prog[lvlIdx] = {
          bestPercent: 100,
          stars: Math.max(stars, existing?.stars ?? 0),
          attempts: (existing?.attempts ?? 0) + attempts,
        };
        saveLevelProgress(prog);
        setLevelProgress({ ...prog });

        // Update global stats
        const newStats = recordRun(100, lvlIdx + 1);
        setStats(newStats);
      }

      phaseRef.current = 'complete';
      setPhase('complete');
      render();
      return;
    }

    // Calculate percent
    const pct = isEndlessMode
      ? Math.floor(((distRef.current % ENDLESS_LEVEL_LENGTH) / ENDLESS_LEVEL_LENGTH) * 100)
      : Math.floor((distRef.current / levelDef!.length) * 100);
    setPercent(pct);

    // Endless mode: generate segments as needed
    if (isEndlessMode) {
      while (distRef.current + GAME_W > nextSegmentXRef.current) {
        const segLevel = Math.floor(nextSegmentXRef.current / ENDLESS_LEVEL_LENGTH) + 1;
        const newObs = generateEndlessSegment(nextSegmentXRef.current, segLevel);
        obstaclesRef.current = [...obstaclesRef.current, ...newObs];
        nextSegmentXRef.current += ENDLESS_LEVEL_LENGTH;
      }
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

    // Check block landing
    let onBlock = false;
    for (const obs of obstaclesRef.current) {
      if (obs.type === 'block') {
        const ox = obs.x - camera;
        const cubeLeft = CUBE_X;
        const cubeRight = CUBE_X + CUBE_SIZE;
        const blockLeft = ox;
        const blockRight = ox + obs.width;
        const blockTop = GROUND_Y - obs.height;

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

    // Check gap
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

    // Ground collision
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

    // Rotation
    if (!onGround) {
      rotationRef.current += speed * 0.04;
    } else {
      const snap = Math.PI / 2;
      rotationRef.current = Math.round(rotationRef.current / snap) * snap;
    }

    cubeYRef.current = cubeY;
    velYRef.current = velY;
    onGroundRef.current = onGround;

    // Trail
    if (onGround) {
      trailRef.current.push({
        x: distRef.current - CUBE_X,
        y: cubeY + CUBE_SIZE,
        alpha: 0.5,
        size: 4 + Math.random() * 4,
      });
    }
    trailRef.current = trailRef.current
      .map(p => ({ ...p, alpha: p.alpha - 0.02, size: p.size * 0.97 }))
      .filter(p => p.alpha > 0);

    // Collision
    for (const obs of obstaclesRef.current) {
      const ox = obs.x - camera;

      if (obs.type === 'spike') {
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
        const blockLeft = ox;
        const blockRight = ox + obs.width;
        const blockTop = GROUND_Y - obs.height;
        const cubeLeft = CUBE_X;
        const cubeRight = CUBE_X + CUBE_SIZE;
        const cubeTop = cubeY;
        const cubeBottom = cubeY + CUBE_SIZE;

        if (cubeRight > blockLeft && cubeLeft < blockRight &&
            cubeBottom > blockTop + 4 && cubeTop < GROUND_Y) {
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

  // ── Die helper ────────────────────────────────────────────────────────
  const die = useCallback(() => {
    sfx.deathSound();
    phaseRef.current = 'ended';
    setPhase('ended');

    deathAnimRef.current = 1;
    const animLoop = () => {
      deathAnimRef.current += 1.5;
      render();
      if (deathAnimRef.current < 45) {
        requestAnimationFrame(animLoop);
      }
    };
    requestAnimationFrame(animLoop);

    if (!savedRef.current) {
      savedRef.current = true;
      const lvlIdx = selectedLevelRef.current;
      const isEndlessMode = lvlIdx === -1;
      const levelDef = isEndlessMode ? null : LEVELS[lvlIdx];

      const pct = isEndlessMode
        ? Math.floor(((distRef.current % ENDLESS_LEVEL_LENGTH) / ENDLESS_LEVEL_LENGTH) * 100)
        : Math.floor((distRef.current / levelDef!.length) * 100);

      // Update level progress for non-endless
      if (!isEndlessMode) {
        const prog = getLevelProgress();
        const existing = prog[lvlIdx];
        prog[lvlIdx] = {
          bestPercent: Math.max(pct, existing?.bestPercent ?? 0),
          stars: existing?.stars ?? 0,
          attempts: (existing?.attempts ?? 0) + 1,
        };
        saveLevelProgress(prog);
        setLevelProgress({ ...prog });
      }

      const newStats = recordRun(pct, lvlIdx + 1);
      setStats(newStats);
    }
  }, [render]);

  // ── Start / stop loop ─────────────────────────────────────────────────
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

  // ── Countdown ─────────────────────────────────────────────────────────
  const startCountdown = useCallback((lvlIdx: number, addAttempt: boolean) => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);

    const isEndlessMode = lvlIdx === -1;

    // Reset game state
    cubeYRef.current = GROUND_Y - CUBE_SIZE;
    velYRef.current = 0;
    onGroundRef.current = true;
    distRef.current = 0;
    obstacleIdCounter = 0;
    rotationRef.current = 0;
    trailRef.current = [];
    deathAnimRef.current = 0;
    gridOffsetRef.current = 0;
    savedRef.current = false;
    setPercent(0);

    if (addAttempt) {
      setLevelAttempts(prev => {
        const next = prev + 1;
        levelAttemptsRef.current = next;
        return next;
      });
    }

    if (isEndlessMode) {
      obstaclesRef.current = generateEndlessSegment(0, 1);
      nextSegmentXRef.current = ENDLESS_LEVEL_LENGTH;
    } else {
      const levelDef = LEVELS[lvlIdx];
      obstaclesRef.current = generateLevelObstaclesFull(levelDef);
      nextSegmentXRef.current = levelDef.length + 1000; // no extra segments for designed levels
    }

    setPhase('countdown');
    phaseRef.current = 'countdown';
    setCountdownNum(COUNTDOWN_STEPS);
    sfx.countdownBeep();
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

  // ── Start a level ─────────────────────────────────────────────────────
  const startLevel = useCallback((lvlIdx: number) => {
    setSelectedLevel(lvlIdx);
    selectedLevelRef.current = lvlIdx;
    setLevelAttempts(1);
    levelAttemptsRef.current = 1;
    startCountdown(lvlIdx, false);
  }, [startCountdown]);

  // ── Actions ───────────────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (phaseRef.current === 'ended') {
      startCountdown(selectedLevelRef.current, true);
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

  const goToLevelSelect = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    phaseRef.current = 'levelSelect';
    setPhase('levelSelect');
  }, []);

  const goToNextLevel = useCallback(() => {
    const nextIdx = selectedLevelRef.current + 1;
    if (nextIdx < LEVELS.length) {
      startLevel(nextIdx);
    } else {
      goToLevelSelect();
    }
  }, [startLevel, goToLevelSelect]);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing', togglePause);

  // ── Input ─────────────────────────────────────────────────────────────
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
        if (phaseRef.current === 'paused' || phaseRef.current === 'ended' || phaseRef.current === 'complete') {
          goToLevelSelect();
        } else {
          togglePause();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump, togglePause, goToLevelSelect]);

  // Load stats on mount
  useEffect(() => {
    setStats(getStats());
    setLevelProgress(getLevelProgress());
  }, []);

  // ── Level Select Screen ───────────────────────────────────────────────
  if (phase === 'levelSelect') {
    return (
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full mx-auto select-none flex-1 min-h-0">
        {/* Title */}
        <div className="shrink-0 flex items-center justify-between w-full max-w-[850px] px-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            {t('lobby.games.geometrydash.title')}
          </span>
          <span className="text-xs text-zinc-400">
            {t('geometrydash.selectLevel')}
          </span>
        </div>

        {/* Level grid */}
        <div className="flex-1 min-h-0 w-full flex justify-center overflow-y-auto">
          <div className="w-full max-w-[850px] px-2 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {LEVELS.map((levelDef, idx) => {
                const unlocked = isLevelUnlocked(idx, levelProgress);
                const prog = levelProgress[idx];
                const colors = LEVEL_COLORS[levelDef.theme % LEVEL_COLORS.length];
                const bestPct = prog?.bestPercent ?? 0;
                const starCount = prog?.stars ?? 0;

                return (
                  <button
                    key={idx}
                    disabled={!unlocked}
                    onClick={() => unlocked && startLevel(idx)}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-[0.97] ${
                      unlocked
                        ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 cursor-pointer'
                        : 'border-zinc-800 bg-zinc-950 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {/* Level number badge */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-lg"
                      style={{
                        backgroundColor: unlocked ? colors.accent + '22' : 'transparent',
                        color: unlocked ? colors.accent : '#666',
                        border: `2px solid ${unlocked ? colors.accent + '44' : '#333'}`,
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Level name */}
                    <span className={`text-[11px] font-bold text-center leading-tight ${unlocked ? 'text-zinc-200' : 'text-zinc-600'}`}>
                      {t(levelDef.nameKey)}
                    </span>

                    {/* Difficulty stars */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: i < levelDef.difficulty
                              ? (unlocked ? colors.accent : '#555')
                              : '#333',
                          }}
                        />
                      ))}
                    </div>

                    {/* Progress / locked */}
                    {unlocked ? (
                      <div className="w-full mt-1">
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${bestPct}%`,
                              backgroundColor: bestPct >= 100 ? colors.accent : colors.accent + '88',
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] text-zinc-500 tabular-nums">{bestPct}%</span>
                          {/* Earned stars */}
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map(s => (
                              <span
                                key={s}
                                className="text-[10px]"
                                style={{ color: s <= starCount ? '#fbbf24' : '#555' }}
                              >
                                &#9733;
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[9px] text-zinc-600 mt-1">
                        {t('geometrydash.locked')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Endless mode button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => startLevel(-1)}
                className="px-6 py-3 rounded-xl border-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-500 text-zinc-200 font-bold text-sm transition-all active:scale-[0.97]"
              >
                {t('geometrydash.endless')}
              </button>
            </div>

            {/* Global stats */}
            <div className="mt-4 flex justify-center gap-4 text-[11px] text-zinc-500">
              <span>{t('geometrydash.attempts')}: <span className="text-zinc-300 font-bold">{stats.attempts}</span></span>
              <span>{t('geometrydash.best')}: <span className="text-zinc-300 font-bold">{stats.bestPercent}%</span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Gameplay Screen ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3 w-full mx-auto select-none flex-1 min-h-0">
      {/* Score bar */}
      <div className="shrink-0 flex items-center justify-between w-full max-w-[850px] px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={goToLevelSelect}
            className="text-xs text-zinc-500 hover:text-zinc-300 uppercase tracking-wider font-semibold transition-colors"
          >
            &larr; {t('geometrydash.backToLevels')}
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-400 text-xs">
            {t('geometrydash.progress')}: <span className="font-bold text-zinc-200 tabular-nums">{percent}%</span>
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 text-xs">
            {isEndless ? t('geometrydash.endless') : t(currentLevelDef!.nameKey)}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 text-xs">
            {t('geometrydash.attempts')}: <span className="font-bold text-zinc-200 tabular-nums">{levelAttempts}</span>
          </span>
        </div>
      </div>

      {/* Game viewport */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div
          className="relative h-full overflow-hidden rounded-2xl border-2 border-zinc-800 bg-zinc-950"
          style={{ aspectRatio: `${GAME_W} / ${GAME_H}`, maxWidth: '100%' }}
          onClick={() => { if (phase !== 'ended' && phase !== 'complete') jump(); }}
          onPointerDown={(e) => { if (phase !== 'ended' && phase !== 'complete') { e.preventDefault(); } }}
        >
          <canvas
            ref={canvasRef}
            width={GAME_W}
            height={GAME_H}
            className="absolute inset-0 w-full h-full"
          />

          {/* ── Overlays ──────────────────────────────────────────────── */}

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
              <div className="flex gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePause(); }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('game.resume')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToLevelSelect(); }}
                  className="px-6 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:border-zinc-400 font-bold text-sm transition-all active:scale-95"
                >
                  {t('geometrydash.backToLevels')}
                </button>
              </div>
            </div>
          )}

          {/* Game Over */}
          {phase === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
              <div className="text-2xl font-black text-rose-400 mb-1">{t('game.over')}</div>
              <div className="text-4xl font-black text-zinc-100 mb-1 tabular-nums">{percent}%</div>
              <div className="text-xs text-zinc-400 mb-1">
                {isEndless ? t('geometrydash.endless') : t(currentLevelDef!.nameKey)}
              </div>
              <div className="text-xs text-zinc-400 mb-4">
                {t('geometrydash.attempts')}: <span className="text-zinc-200 font-bold tabular-nums">{levelAttempts}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); jump(); }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('game.restart')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToLevelSelect(); }}
                  className="px-5 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:border-zinc-400 font-bold text-sm transition-all active:scale-95"
                >
                  {t('geometrydash.backToLevels')}
                </button>
              </div>
            </div>
          )}

          {/* Level Complete */}
          {phase === 'complete' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
              <div className="text-3xl font-black text-emerald-400 mb-2">{t('geometrydash.levelComplete')}</div>
              <div className="text-lg font-bold text-zinc-200 mb-3">
                {t(currentLevelDef!.nameKey)}
              </div>
              {/* Stars */}
              <div className="flex gap-2 mb-4">
                {[1, 2, 3].map(s => (
                  <span
                    key={s}
                    className="text-4xl"
                    style={{ color: s <= completionStars ? '#fbbf24' : '#555' }}
                  >
                    &#9733;
                  </span>
                ))}
              </div>
              <div className="text-xs text-zinc-400 mb-4">
                {t('geometrydash.attempts')}: <span className="text-zinc-200 font-bold tabular-nums">{levelAttempts}</span>
              </div>
              <div className="flex gap-3">
                {selectedLevel < LEVELS.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); goToNextLevel(); }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all active:scale-95"
                  >
                    {t('geometrydash.nextLevel')}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); goToLevelSelect(); }}
                  className="px-6 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:border-zinc-400 font-bold text-sm transition-all active:scale-95"
                >
                  {t('geometrydash.backToLevels')}
                </button>
              </div>
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
