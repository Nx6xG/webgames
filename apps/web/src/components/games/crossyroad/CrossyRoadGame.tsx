'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import TouchControls from '@/components/ui/TouchControls';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { getSupabase } from '@/lib/supabaseClient';
import {
  loadGameProgress,
  saveGameProgress,
  fetchCloudGameProgress,
  saveCloudGameProgress,
} from '@/lib/cloudSync';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const GAME_W = 480;
const GAME_H = 640;
const TILE = 40;
const COLS = 12; // 12 * 40 = 480
const VISIBLE_ROWS = 16; // 16 * 40 = 640

const PLAYER_SIZE = 30;
const PLAYER_OFFSET = (TILE - PLAYER_SIZE) / 2;

const HOP_FRAMES = 7;
const IDLE_TIMEOUT_MS = 3500;
const DEATH_LINE_SPEED = 0.6; // px per frame

const BEST_KEY = 'webgames.crossyroad.bestScore';
// ── Skin system ─────────────────────────────────────────────────────────────

interface SkinDef {
  id: string;
  price: number; // 0 = free (default)
  body: string;
  dark: string;
  eyes: string;
  beak: string;
  accent?: string; // optional extra (hat, accessory)
}

interface CrossyProgress {
  wallet: number;
  owned: string[];
  activeSkin: string;
}

const SKINS: SkinDef[] = [
  { id: 'chicken',  price: 0,   body: '#fbbf24', dark: '#d97706', eyes: '#1f2937', beak: '#f97316' },
  { id: 'penguin',  price: 25,  body: '#1f2937', dark: '#111827', eyes: '#ffffff', beak: '#f97316', accent: '#ffffff' },
  { id: 'frog',     price: 30,  body: '#22c55e', dark: '#15803d', eyes: '#1f2937', beak: '#86efac' },
  { id: 'pig',      price: 30,  body: '#fda4af', dark: '#e11d48', eyes: '#1f2937', beak: '#fb7185' },
  { id: 'ghost',    price: 50,  body: '#e2e8f0', dark: '#94a3b8', eyes: '#1e293b', beak: '#cbd5e1' },
  { id: 'robot',    price: 75,  body: '#60a5fa', dark: '#2563eb', eyes: '#fef08a', beak: '#93c5fd', accent: '#1e40af' },
  { id: 'ninja',    price: 100, body: '#18181b', dark: '#09090b', eyes: '#ef4444', beak: '#71717a', accent: '#ef4444' },
  { id: 'lava',     price: 150, body: '#ef4444', dark: '#991b1b', eyes: '#fef08a', beak: '#f97316', accent: '#fbbf24' },
  { id: 'galaxy',   price: 200, body: '#7c3aed', dark: '#4c1d95', eyes: '#e0e7ff', beak: '#a78bfa', accent: '#c4b5fd' },
  { id: 'diamond',  price: 300, body: '#67e8f9', dark: '#06b6d4', eyes: '#ffffff', beak: '#a5f3fc', accent: '#ecfeff' },
  { id: 'golden',   price: 500, body: '#fbbf24', dark: '#b45309', eyes: '#1f2937', beak: '#f59e0b', accent: '#fef3c7' },
];

function loadCrossyProgress(): CrossyProgress {
  const data = loadGameProgress();
  const raw = data.crossyroad as CrossyProgress | undefined;
  if (raw && typeof raw === 'object' && 'wallet' in raw) {
    return { wallet: raw.wallet ?? 0, owned: raw.owned ?? ['chicken'], activeSkin: raw.activeSkin ?? 'chicken' };
  }
  return { wallet: 0, owned: ['chicken'], activeSkin: 'chicken' };
}

function saveCrossyProgress(p: CrossyProgress) {
  const data = loadGameProgress();
  data.crossyroad = p;
  saveGameProgress(data);
}

// ── Lane types & generation ──────────────────────────────────────────────────

type LaneType = 'grass' | 'road' | 'water' | 'railroad';
type Phase = 'idle' | 'countdown' | 'playing' | 'paused' | 'over';

interface TreeObj {
  col: number;
}

interface VehicleObj {
  x: number;
  width: number;
  speed: number;
  color: string;
}

interface LogObj {
  x: number;
  width: number;
  speed: number;
}

interface TrainObj {
  x: number;
  width: number;
  speed: number;
  warning: boolean; // flash before coming
  warningTimer: number;
  active: boolean; // actually moving
}

interface CoinObj {
  col: number;
  collected: boolean;
}

interface Lane {
  type: LaneType;
  row: number; // absolute row index (0 = starting row)
  trees: TreeObj[];
  vehicles: VehicleObj[];
  logs: LogObj[];
  trains: TrainObj[];
  coins: CoinObj[];
  direction: 1 | -1;
}

// Colors
const VEHICLE_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#f8fafc', '#a855f7', '#f97316'];
const GRASS_COLOR = '#166534';
const GRASS_DARK = '#14532d';
const ROAD_COLOR = '#374151';
const ROAD_MARKING = '#9ca3af';
const WATER_COLOR = '#1e3a5f';
const WATER_LIGHT = '#2563eb';
const RAILROAD_COLOR = '#1f2937';
const RAIL_COLOR = '#6b7280';
const LOG_COLOR = '#92400e';
const LOG_LIGHT = '#a16207';
const PLAYER_COLOR = '#fbbf24';
const PLAYER_DARK = '#d97706';
const COIN_COLOR = '#fbbf24';
const COIN_SPARKLE = '#fef3c7';
const TRAIN_COLOR = '#374151';
const TRAIN_FRONT = '#eab308';

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadBest(): number {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(BEST_KEY);
  return v ? Number(v) || 0 : 0;
}

function saveBest(score: number) {
  localStorage.setItem(BEST_KEY, String(score));
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Generate a lane at a given row index. Difficulty increases with row. */
function generateLane(row: number): Lane {
  const difficulty = Math.min(row / 80, 1); // 0..1 over 80 rows
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  // First 2 rows are always grass (safe start)
  if (row <= 1) {
    return makeGrassLane(row, dir, 0);
  }

  // Weighted random lane type — more dangerous lanes at higher rows
  const r = Math.random();
  const grassChance = 0.35 - difficulty * 0.15; // 0.35 → 0.20
  const roadChance = 0.35 + difficulty * 0.05;  // 0.35 → 0.40
  const waterChance = 0.20 + difficulty * 0.05; // 0.20 → 0.25
  // railroad = remainder                        // 0.10 → 0.15

  if (r < grassChance) {
    return makeGrassLane(row, dir, difficulty);
  } else if (r < grassChance + roadChance) {
    return makeRoadLane(row, dir, difficulty);
  } else if (r < grassChance + roadChance + waterChance) {
    return makeWaterLane(row, dir, difficulty);
  } else {
    return makeRailroadLane(row, dir, difficulty);
  }
}

function makeGrassLane(row: number, dir: 1 | -1, difficulty: number): Lane {
  const trees: TreeObj[] = [];
  const coins: CoinObj[] = [];
  // Random trees (0-3)
  const numTrees = randInt(0, Math.min(3, Math.floor(1 + difficulty * 3)));
  const usedCols = new Set<number>();
  for (let i = 0; i < numTrees; i++) {
    const col = randInt(0, COLS - 1);
    if (!usedCols.has(col)) {
      usedCols.add(col);
      trees.push({ col });
    }
  }
  // Coins — spawn 1-2 per grass lane fairly often
  const coinChance = 0.35;
  if (Math.random() < coinChance) {
    const numCoins = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < numCoins; i++) {
      const col = randInt(0, COLS - 1);
      if (!usedCols.has(col)) {
        usedCols.add(col);
        coins.push({ col, collected: false });
      }
    }
  }
  return { type: 'grass', row, trees, vehicles: [], logs: [], trains: [], coins, direction: dir };
}

function makeRoadLane(row: number, dir: 1 | -1, difficulty: number): Lane {
  const vehicles: VehicleObj[] = [];
  const numVehicles = randInt(2, 3 + Math.floor(difficulty * 2));
  const baseSpeed = 1.0 + difficulty * 1.5;
  const speed = (baseSpeed + Math.random() * 0.5) * dir;
  const vehWidth = randInt(1, 2) * TILE;

  const totalSpace = GAME_W + 200;
  const spacing = totalSpace / numVehicles;
  for (let i = 0; i < numVehicles; i++) {
    vehicles.push({
      x: i * spacing + randInt(-20, 20),
      width: vehWidth,
      speed,
      color: pick(VEHICLE_COLORS),
    });
  }

  return { type: 'road', row, trees: [], vehicles, logs: [], trains: [], coins: [], direction: dir };
}

function makeWaterLane(row: number, dir: 1 | -1, difficulty: number): Lane {
  const logs: LogObj[] = [];
  const numLogs = randInt(2, 4 - Math.floor(difficulty * 1.5));
  const clampedLogs = Math.max(numLogs, 2);
  const speed = (0.6 + difficulty * 0.8) * dir; // same speed for all logs in lane
  const logWidth = randInt(2, 4) * TILE;

  const totalSpace = GAME_W + 300;
  const spacing = totalSpace / clampedLogs;
  for (let i = 0; i < clampedLogs; i++) {
    logs.push({
      x: i * spacing + randInt(-15, 15),
      width: logWidth,
      speed, // all logs move together — no overlap
    });
  }

  return { type: 'water', row, trees: [], vehicles: [], logs, trains: [], coins: [], direction: dir };
}

function makeRailroadLane(row: number, dir: 1 | -1, _difficulty: number): Lane {
  // Train starts off-screen, with warning phase
  const trainSpeed = (3.5 + Math.random() * 2) * dir;
  const startX = dir === 1 ? -600 : GAME_W + 600;
  const trains: TrainObj[] = [{
    x: startX,
    width: 400,
    speed: trainSpeed,
    warning: false,
    warningTimer: randInt(120, 300), // frames until warning starts
    active: false,
  }];

  return { type: 'railroad', row, trees: [], vehicles: [], logs: [], trains, coins: [], direction: dir };
}

// ── Component ────────────────────────────────────────────────────────────────

export function CrossyRoadGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('crossyroad');
  const pb = usePersonalScores('crossyroad', user ? { userId: user.id, nickname } : undefined);

  // ── React state (for display) ──────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [coinCount, setCoinCount] = useState(0);
  const [best, setBest] = useState(0);
  const [countdownNum, setCountdownNum] = useState(0);
  const [showShop, setShowShop] = useState(false);
  const [wallet, setWallet] = useState(0);
  const [ownedSkins, setOwnedSkins] = useState<Set<string>>(new Set(['chicken']));
  const [activeSkin, setActiveSkinState] = useState('chicken');
  const activeSkinRef = useRef('chicken');
  const cloudSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const userIdRef = useRef<string | null>(null);

  // ── Refs (game loop truth) ─────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const coinCountRef = useRef(0);
  const bestRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Player state
  const playerColRef = useRef(Math.floor(COLS / 2)); // grid column
  const playerRowRef = useRef(0); // grid row (absolute)
  const playerPxXRef = useRef(0); // pixel position for rendering
  const playerPxYRef = useRef(0);
  const hopProgressRef = useRef(0); // 0 = not hopping, 1..HOP_FRAMES = animating
  const hopFromXRef = useRef(0);
  const hopFromYRef = useRef(0);
  const hopToXRef = useRef(0);
  const hopToYRef = useRef(0);
  const playerAliveRef = useRef(true);
  const onLogSpeedRef = useRef(0); // if standing on a log, its speed
  const logDriftXRef = useRef(0); // accumulated pixel offset from log movement

  // Camera — smooth interpolation (pixel-level, not tile-snapping)
  const cameraTargetRef = useRef(0); // target camera row (integer)
  const cameraYRef = useRef(0); // smoothed camera Y position in pixels
  const maxRowRef = useRef(0);

  // Lanes
  const lanesRef = useRef<Lane[]>([]);
  const generatedUpToRef = useRef(0);

  // Idle / death-line
  const lastForwardTimeRef = useRef(0);
  const deathLineYRef = useRef(GAME_H + 50); // starts off-screen

  // Frame counter + delta time
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Death animation
  const deathFrameRef = useRef(0);
  const deathTypeRef = useRef<'hit' | 'splash' | 'crushed' | 'edge'>('hit');

  // Input queue
  const inputQueueRef = useRef<Array<'up' | 'down' | 'left' | 'right'>>([]);

  // Sync phase ref
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Achievement tracking
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'idle') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track user id
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);

  // Load best + skin state + generate idle preview scene
  useEffect(() => {
    const b = loadBest();
    setBest(b);
    bestRef.current = b;
    const cp = loadCrossyProgress();
    setWallet(cp.wallet);
    setOwnedSkins(new Set(cp.owned));
    setActiveSkinState(cp.activeSkin);
    activeSkinRef.current = cp.activeSkin;

    // Generate preview lanes so the idle screen has a world behind it
    if (lanesRef.current.length === 0) {
      generatedUpToRef.current = -1;
      ensureLanes(VISIBLE_ROWS + 5);
      const startCol = Math.floor(COLS / 2);
      playerColRef.current = startCol;
      playerRowRef.current = 0;
      playerPxXRef.current = colToScreenX(startCol);
      playerPxYRef.current = rowToScreenY(0);
      playerAliveRef.current = true;
    }
  }, []);

  // Cloud merge on auth
  useEffect(() => {
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    fetchCloudGameProgress(sb, user.id)
      .then(cloud => {
        if (!cloud) return;
        const raw = cloud.crossyroad as CrossyProgress | undefined;
        if (!raw || typeof raw !== 'object' || !('wallet' in raw)) return;
        const local = loadCrossyProgress();
        const merged: CrossyProgress = {
          wallet: Math.max(local.wallet, raw.wallet ?? 0),
          owned: [...new Set([...local.owned, ...(raw.owned ?? [])])],
          activeSkin: local.activeSkin || raw.activeSkin || 'chicken',
        };
        saveCrossyProgress(merged);
        setWallet(merged.wallet);
        setOwnedSkins(new Set(merged.owned));
        setActiveSkinState(merged.activeSkin);
        activeSkinRef.current = merged.activeSkin;
      })
      .catch(err => console.error('[crossyroad] cloud load error:', err));
  }, [user]);

  // Visibility pause
  const handlePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
    }
  }, []);
  useVisibilityPause(phase === 'playing', handlePause);

  // ── Lane management ────────────────────────────────────────────────────
  function ensureLanes(upToRow: number) {
    while (generatedUpToRef.current <= upToRow + 5) {
      generatedUpToRef.current += 1;
      lanesRef.current.push(generateLane(generatedUpToRef.current));
    }
  }

  function getLane(row: number): Lane | undefined {
    return lanesRef.current.find(l => l.row === row);
  }

  // ── Coordinate helpers ─────────────────────────────────────────────────
  function rowToScreenY(row: number): number {
    // Use smooth pixel camera for rendering
    return GAME_H - TILE - row * TILE + cameraYRef.current;
  }

  function colToScreenX(col: number): number {
    return col * TILE;
  }

  // ── Reset ──────────────────────────────────────────────────────────────
  // ── Debounced cloud save helper ──────────────────────────────────────
  function debouncedCloudSave() {
    if (!userIdRef.current) return;
    clearTimeout(cloudSyncRef.current);
    const uid = userIdRef.current;
    cloudSyncRef.current = setTimeout(() => {
      const sb = getSupabase();
      if (sb && uid) {
        const data = loadGameProgress();
        saveCloudGameProgress(sb, uid, data).catch(err =>
          console.error('[crossyroad] cloud save error:', err),
        );
      }
    }, 1000);
  }

  function resetGame() {
    const startCol = Math.floor(COLS / 2);
    playerColRef.current = startCol;
    playerRowRef.current = 0;
    playerPxXRef.current = colToScreenX(startCol);
    playerPxYRef.current = rowToScreenY(0);
    hopProgressRef.current = 0;
    playerAliveRef.current = true;
    onLogSpeedRef.current = 0;
    logDriftXRef.current = 0;

    cameraTargetRef.current = 0;
    cameraYRef.current = 0;
    maxRowRef.current = 0;
    scoreRef.current = 0;
    coinCountRef.current = 0;
    setScore(0);
    setCoinCount(0);

    lanesRef.current = [];
    generatedUpToRef.current = -1;
    ensureLanes(VISIBLE_ROWS + 5);

    lastForwardTimeRef.current = performance.now();
    deathLineYRef.current = GAME_H + 50;
    frameRef.current = 0;
    deathFrameRef.current = 0;
    savedRef.current = false;
    inputQueueRef.current = [];
  }

  // ── Start game ─────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (phaseRef.current === 'countdown') return;

    resetGame();
    phaseRef.current = 'countdown';
    setPhase('countdown');
    setCountdownNum(3);

    let step = 3;
    const doStep = () => {
      step -= 1;
      if (step > 0) {
        setCountdownNum(step);
        countdownTimerRef.current = setTimeout(doStep, 600);
      } else {
        setCountdownNum(0);
        phaseRef.current = 'playing';
        setPhase('playing');
        lastForwardTimeRef.current = performance.now();
      }
    };
    countdownTimerRef.current = setTimeout(doStep, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumeGame = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    phaseRef.current = 'playing';
    setPhase('playing');
    lastForwardTimeRef.current = performance.now();
  }, []);

  // ── Input handling ─────────────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          startGame();
          return;
        }
      }
      if (phaseRef.current === 'paused') {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          resumeGame();
          return;
        }
      }
      if (phaseRef.current !== 'playing') return;

      let dir: 'up' | 'down' | 'left' | 'right' | null = null;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
        case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
        case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
        case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
        case 'Escape':
          e.preventDefault();
          phaseRef.current = 'paused';
          setPhase('paused');
          return;
      }
      if (dir) {
        e.preventDefault();
        inputQueueRef.current.push(dir);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [startGame, resumeGame]);

  // Touch/swipe support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchHandled = false;

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
        startGame();
        e.preventDefault();
        return;
      }
      if (phaseRef.current === 'paused') {
        resumeGame();
        e.preventDefault();
        return;
      }
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchHandled = false;
    }

    function onTouchEnd(e: TouchEvent) {
      if (phaseRef.current !== 'playing') return;
      if (touchHandled) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Tap (no significant swipe) = hop forward
      if (absDx < 15 && absDy < 15) {
        inputQueueRef.current.push('up');
        touchHandled = true;
        return;
      }

      const minSwipe = 20;
      if (absDx > absDy && absDx > minSwipe) {
        inputQueueRef.current.push(dx > 0 ? 'right' : 'left');
      } else if (absDy > minSwipe) {
        inputQueueRef.current.push(dy > 0 ? 'down' : 'up');
      }
      touchHandled = true;
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [startGame, resumeGame]);

  // ── Game loop (delta-time based — consistent across all refresh rates) ──
  const tick = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return;

    // Calculate delta-time factor (1.0 = 60fps)
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const rawDt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    const dt = Math.min(rawDt, 50) / 16.667;

    frameRef.current += dt;
    const now = performance.now();

    // ── Process input (only while alive) ─────────────────────────────
    if (playerAliveRef.current && hopProgressRef.current === 0 && inputQueueRef.current.length > 0) {
      const dir = inputQueueRef.current.shift()!;
      let targetCol = playerColRef.current;
      let targetRow = playerRowRef.current;

      switch (dir) {
        case 'up': targetRow += 1; break;
        case 'down': targetRow = Math.max(0, targetRow - 1); break;
        case 'left': targetCol -= 1; break;
        case 'right': targetCol += 1; break;
      }

      // Clamp columns
      if (targetCol < 0 || targetCol >= COLS) {
        // Out of bounds — don't move
      } else {
        // Check for tree collision at target
        const targetLane = getLane(targetRow);
        const hasTree = targetLane?.trees.some(tr => tr.col === targetCol) ?? false;

        if (!hasTree) {
          // Start hop animation
          hopFromXRef.current = playerPxXRef.current;
          hopFromYRef.current = playerPxYRef.current;
          hopToXRef.current = colToScreenX(targetCol);
          hopToYRef.current = rowToScreenY(targetRow);
          hopProgressRef.current = 1;

          playerColRef.current = targetCol;
          playerRowRef.current = targetRow;
          logDriftXRef.current = 0; // reset drift when hopping

          sfx.hopSound();

          if (dir === 'up') {
            lastForwardTimeRef.current = now;
            deathLineYRef.current = GAME_H + 50; // reset death line
          }

          // Update max row / score
          if (targetRow > maxRowRef.current) {
            maxRowRef.current = targetRow;
            scoreRef.current = targetRow;
            setScore(targetRow);
          }

          // Update camera target (smooth interpolation happens in tick)
          const desiredCamRow = targetRow - Math.floor(VISIBLE_ROWS * 0.65);
          if (desiredCamRow > cameraTargetRef.current) {
            cameraTargetRef.current = desiredCamRow;
          }

          ensureLanes(targetRow + VISIBLE_ROWS);
        }
      }
    }

    // ── Hop animation ────────────────────────────────────────────────
    if (hopProgressRef.current > 0) {
      hopProgressRef.current += dt;
      if (hopProgressRef.current > HOP_FRAMES) {
        hopProgressRef.current = 0;
        playerPxXRef.current = hopToXRef.current;
        playerPxYRef.current = hopToYRef.current;
      } else {
        const t = hopProgressRef.current / HOP_FRAMES;
        playerPxXRef.current = lerp(hopFromXRef.current, hopToXRef.current, t);
        playerPxYRef.current = lerp(hopFromYRef.current, hopToYRef.current, t);
      }
    } else {
      // Not hopping — update position based on camera + log movement
      playerPxXRef.current = colToScreenX(playerColRef.current) + logDriftXRef.current;
      playerPxYRef.current = rowToScreenY(playerRowRef.current);
    }

    // ── Smooth camera interpolation ────────────────────────────────
    const targetCamY = cameraTargetRef.current * TILE;
    const diff = targetCamY - cameraYRef.current;
    if (Math.abs(diff) < 0.5) {
      cameraYRef.current = targetCamY;
    } else {
      cameraYRef.current += diff * (1 - Math.pow(1 - 0.15, dt)); // frame-rate independent lerp
    }

    // ── Update lanes (vehicles, logs, trains) ────────────────────────
    onLogSpeedRef.current = 0;
    // Reset log drift if not on a water lane
    const currentLane = getLane(playerRowRef.current);
    if (!currentLane || currentLane.type !== 'water') {
      logDriftXRef.current = 0;
    }
    const camRow = Math.floor(cameraYRef.current / TILE);
    const visibleMin = camRow - 2;
    const visibleMax = camRow + VISIBLE_ROWS + 3;

    for (const lane of lanesRef.current) {
      if (lane.row < visibleMin || lane.row > visibleMax) continue;

      // Vehicles
      for (const v of lane.vehicles) {
        v.x += v.speed * dt;
        // Wrap
        if (v.speed > 0 && v.x > GAME_W + 50) v.x = -v.width - 50;
        if (v.speed < 0 && v.x + v.width < -50) v.x = GAME_W + 50;
      }

      // Logs
      for (const log of lane.logs) {
        log.x += log.speed * dt;
        if (log.speed > 0 && log.x > GAME_W + 50) log.x = -log.width - 50;
        if (log.speed < 0 && log.x + log.width < -50) log.x = GAME_W + 50;
      }

      // Trains
      for (const train of lane.trains) {
        if (!train.active) {
          train.warningTimer -= dt;
          if (train.warningTimer <= 0 && !train.warning) {
            train.warning = true;
            train.warningTimer = 90; // warning duration in frames
            sfx.trainWarningSound();
          }
          if (train.warning) {
            train.warningTimer -= dt;
            if (train.warningTimer <= 0) {
              train.active = true;
            }
          }
        } else {
          train.x += train.speed * dt;
          // Respawn
          if (train.speed > 0 && train.x > GAME_W + 200) {
            train.x = -train.width - randInt(200, 600);
            train.active = false;
            train.warning = false;
            train.warningTimer = randInt(180, 400);
          }
          if (train.speed < 0 && train.x + train.width < -200) {
            train.x = GAME_W + randInt(200, 600);
            train.active = false;
            train.warning = false;
            train.warningTimer = randInt(180, 400);
          }
        }
      }
    }

    // ── Collision detection ──────────────────────────────────────────
    if (playerAliveRef.current && hopProgressRef.current === 0) {
      const pRow = playerRowRef.current;
      const pCol = playerColRef.current;
      const lane = getLane(pRow);

      if (lane) {
        const pScreenY = rowToScreenY(pRow);
        const pLeft = colToScreenX(pCol) + PLAYER_OFFSET;
        const pRight = pLeft + PLAYER_SIZE;
        const pTop = pScreenY + PLAYER_OFFSET;
        const pBottom = pTop + PLAYER_SIZE;

        // Road — vehicle collision
        if (lane.type === 'road') {
          for (const v of lane.vehicles) {
            const vLeft = v.x;
            const vRight = v.x + v.width;
            const vTop = pScreenY + 4;
            const vBottom = pScreenY + TILE - 4;
            if (pRight > vLeft && pLeft < vRight && pBottom > vTop && pTop < vBottom) {
              die('hit');
              break;
            }
          }
        }

        // Water — must be on a log; player drifts with it
        if (lane.type === 'water') {
          let onLog = false;
          const playerCenterX = colToScreenX(pCol) + logDriftXRef.current + TILE / 2;
          for (const log of lane.logs) {
            if (playerCenterX >= log.x && playerCenterX <= log.x + log.width) {
              onLog = true;
              onLogSpeedRef.current = log.speed;
              // Accumulate drift from log movement
              logDriftXRef.current += log.speed * dt;
              // Snap to new column when drift exceeds half a tile
              if (Math.abs(logDriftXRef.current) >= TILE / 2) {
                const colShift = Math.round(logDriftXRef.current / TILE);
                playerColRef.current += colShift;
                logDriftXRef.current -= colShift * TILE;
              }
              // Die if carried off screen
              if (playerColRef.current < -1 || playerColRef.current >= COLS + 1) {
                die('splash');
              }
              break;
            }
          }
          if (!onLog && playerAliveRef.current) {
            die('splash');
          }
        }

        // Railroad — train collision
        if (lane.type === 'railroad') {
          for (const train of lane.trains) {
            if (!train.active) continue;
            const tLeft = train.x;
            const tRight = train.x + train.width;
            if (pRight > tLeft && pLeft < tRight) {
              die('crushed');
              break;
            }
          }
        }

        // Coin collection
        for (const coin of lane.coins) {
          if (!coin.collected && coin.col === pCol) {
            coin.collected = true;
            coinCountRef.current += 1;
            setCoinCount(coinCountRef.current);
            sfx.coinSound();
          }
        }
      }
    }

    // ── Idle death line ──────────────────────────────────────────────
    if (playerAliveRef.current) {
      const timeSinceForward = now - lastForwardTimeRef.current;
      if (timeSinceForward > IDLE_TIMEOUT_MS) {
        deathLineYRef.current -= DEATH_LINE_SPEED * dt;
      }
      // Check if player is below death line
      const pScreenY = playerPxYRef.current + PLAYER_OFFSET + PLAYER_SIZE;
      if (pScreenY > deathLineYRef.current) {
        die('edge');
      }
    }

    // ── Death animation ──────────────────────────────────────────────
    if (!playerAliveRef.current) {
      deathFrameRef.current += dt;
      if (deathFrameRef.current > 40) {
        endGame();
        return;
      }
    }

    // ── Cull off-screen lanes ────────────────────────────────────────
    lanesRef.current = lanesRef.current.filter(l => l.row >= camRow - 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function die(type: 'hit' | 'splash' | 'crushed' | 'edge') {
    if (!playerAliveRef.current) return;
    playerAliveRef.current = false;
    deathTypeRef.current = type;
    deathFrameRef.current = 0;
    if (type === 'splash') sfx.splashSound();
    else sfx.hitSound();
  }

  function endGame() {
    sfx.gameOverSound();
    phaseRef.current = 'over';
    setPhase('over');

    const finalScore = scoreRef.current;
    if (finalScore > bestRef.current) {
      bestRef.current = finalScore;
      setBest(finalScore);
      saveBest(finalScore);
    }

    // Add collected coins to persistent wallet
    if (coinCountRef.current > 0) {
      const cp = loadCrossyProgress();
      cp.wallet += coinCountRef.current;
      saveCrossyProgress(cp);
      setWallet(cp.wallet);
      debouncedCloudSave();
    }

    if (!savedRef.current) {
      savedRef.current = true;
      pb.submit(finalScore, { coins: coinCountRef.current });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_W, GAME_H);

    // Draw lanes (bottom to top)
    for (const lane of lanesRef.current) {
      const screenY = rowToScreenY(lane.row);
      if (screenY > GAME_H + TILE || screenY < -TILE * 2) continue;

      switch (lane.type) {
        case 'grass':
          drawGrassLane(ctx, lane, screenY);
          break;
        case 'road':
          drawRoadLane(ctx, lane, screenY);
          break;
        case 'water':
          drawWaterLane(ctx, lane, screenY);
          break;
        case 'railroad':
          drawRailroadLane(ctx, lane, screenY);
          break;
      }
    }

    // Death line (creeping red)
    const deathY = deathLineYRef.current;
    if (deathY < GAME_H) {
      const grad = ctx.createLinearGradient(0, deathY - 20, 0, GAME_H);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      grad.addColorStop(0.15, 'rgba(239, 68, 68, 0.3)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, deathY - 20, GAME_W, GAME_H - deathY + 20);
    }

    // Player
    drawPlayer(ctx);

    // Score
    ctx.save();
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(String(scoreRef.current), GAME_W / 2 + 2, 50 + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(scoreRef.current), GAME_W / 2, 50);
    ctx.restore();

    // Coin counter
    if (coinCountRef.current > 0) {
      ctx.save();
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = COIN_COLOR;
      ctx.fillText(`● ${coinCountRef.current}`, 12, 32);
      ctx.restore();
    }

    // Countdown overlay
    if (phaseRef.current === 'countdown') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.font = 'bold 72px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      const num = countdownNum;
      if (num > 0) ctx.fillText(String(num), GAME_W / 2, GAME_H / 2);
      ctx.restore();
    }

    // Paused overlay
    if (phaseRef.current === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PAUSED', GAME_W / 2, GAME_H / 2);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Press Space to resume', GAME_W / 2, GAME_H / 2 + 40);
      ctx.restore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownNum]);

  // ── Draw helpers ───────────────────────────────────────────────────

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
    ctx.fill();
  }

  function drawGrassLane(ctx: CanvasRenderingContext2D, lane: Lane, y: number) {
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, y, GAME_W, TILE);

    // Grass texture patches
    ctx.fillStyle = GRASS_DARK;
    const seed = lane.row * 7;
    for (let i = 0; i < 8; i++) {
      const px = ((seed + i * 73) % GAME_W);
      const py = y + ((seed + i * 31) % (TILE - 6)) + 3;
      ctx.fillRect(px, py, 6, 3);
    }

    // Trees
    for (const tree of lane.trees) {
      const tx = tree.col * TILE + TILE / 2;
      const ty = y + TILE / 2;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(tx + 2, ty + 4, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      ctx.fillStyle = '#92400e';
      ctx.fillRect(tx - 3, ty - 2, 6, 12);
      // Foliage layers
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(tx, ty - 4, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(tx - 3, ty - 2, 9, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(tx - 2, ty - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coins
    for (const coin of lane.coins) {
      if (coin.collected) continue;
      const cx = coin.col * TILE + TILE / 2;
      const cy = y + TILE / 2;
      const sparkle = Math.sin(frameRef.current * 0.1 + lane.row) * 2;
      ctx.fillStyle = COIN_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, 7 + sparkle * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COIN_SPARKLE;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRoadLane(ctx: CanvasRenderingContext2D, lane: Lane, y: number) {
    ctx.fillStyle = ROAD_COLOR;
    ctx.fillRect(0, y, GAME_W, TILE);

    // Dashed center line
    ctx.strokeStyle = ROAD_MARKING;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y + TILE / 2);
    ctx.lineTo(GAME_W, y + TILE / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_W, y);
    ctx.moveTo(0, y + TILE);
    ctx.lineTo(GAME_W, y + TILE);
    ctx.stroke();

    // Vehicles
    for (const v of lane.vehicles) {
      const vx = v.x;
      const vy = y + 4;
      const vh = TILE - 8;
      const vw = v.width;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(ctx, vx + 2, vy + 3, vw, vh, 4);

      // Body
      ctx.fillStyle = v.color;
      roundRect(ctx, vx, vy, vw, vh, 4);

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(vx + 3, vy + 2, vw - 6, 3);

      // Windshield
      ctx.fillStyle = 'rgba(100,180,255,0.4)';
      const windshieldX = v.speed > 0 ? vx + vw - 14 : vx + 4;
      ctx.fillRect(windshieldX, vy + 4, 10, vh - 8);

      // Headlights
      ctx.fillStyle = '#fef08a';
      const hlX = v.speed > 0 ? vx + vw - 3 : vx;
      ctx.fillRect(hlX, vy + 5, 3, 5);
      ctx.fillRect(hlX, vy + vh - 10, 3, 5);

      // Tail lights
      ctx.fillStyle = '#ef4444';
      const tlX = v.speed > 0 ? vx + 1 : vx + vw - 4;
      ctx.fillRect(tlX, vy + 6, 3, 4);
      ctx.fillRect(tlX, vy + vh - 10, 3, 4);
    }
  }

  function drawWaterLane(ctx: CanvasRenderingContext2D, lane: Lane, y: number) {
    ctx.fillStyle = WATER_COLOR;
    ctx.fillRect(0, y, GAME_W, TILE);

    // Wave pattern
    ctx.strokeStyle = WATER_LIGHT;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.3;
    for (let wx = 0; wx < GAME_W; wx += 30) {
      const waveOffset = Math.sin((frameRef.current * 0.03) + wx * 0.05 + lane.row) * 3;
      ctx.beginPath();
      ctx.moveTo(wx, y + TILE / 2 + waveOffset);
      ctx.quadraticCurveTo(wx + 15, y + TILE / 2 + waveOffset + 4, wx + 30, y + TILE / 2 + waveOffset);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Logs
    for (const log of lane.logs) {
      const lx = log.x;
      const ly = y + 6;
      const lh = TILE - 12;
      const lw = log.width;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      roundRect(ctx, lx + 2, ly + 3, lw, lh, 6);

      // Log body
      ctx.fillStyle = LOG_COLOR;
      roundRect(ctx, lx, ly, lw, lh, 6);

      // Wood grain
      ctx.strokeStyle = LOG_LIGHT;
      ctx.lineWidth = 1;
      for (let gx = lx + 10; gx < lx + lw - 10; gx += 18) {
        ctx.beginPath();
        ctx.moveTo(gx, ly + 3);
        ctx.lineTo(gx, ly + lh - 3);
        ctx.stroke();
      }

      // Top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(lx + 6, ly + 2, lw - 12, 2);
    }
  }

  function drawRailroadLane(ctx: CanvasRenderingContext2D, lane: Lane, y: number) {
    ctx.fillStyle = RAILROAD_COLOR;
    ctx.fillRect(0, y, GAME_W, TILE);

    // Rails
    ctx.strokeStyle = RAIL_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y + 12);
    ctx.lineTo(GAME_W, y + 12);
    ctx.moveTo(0, y + TILE - 12);
    ctx.lineTo(GAME_W, y + TILE - 12);
    ctx.stroke();

    // Ties
    ctx.fillStyle = '#4b3621';
    for (let tx = 5; tx < GAME_W; tx += 25) {
      ctx.fillRect(tx, y + 8, 8, TILE - 16);
    }

    for (const train of lane.trains) {
      if (train.warning && !train.active) {
        const flash = Math.sin(frameRef.current * 0.3) > 0;
        if (flash) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fillRect(0, y, GAME_W, TILE);
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(20, y + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(GAME_W - 20, y + TILE / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (train.active) {
        const tx = train.x;
        const ty = y + 2;
        const th = TILE - 4;
        const tw = train.width;

        // Body
        ctx.fillStyle = TRAIN_COLOR;
        ctx.fillRect(tx, ty, tw, th);

        // Front
        const frontX = train.speed > 0 ? tx + tw - 20 : tx;
        ctx.fillStyle = TRAIN_FRONT;
        ctx.fillRect(frontX, ty, 20, th);

        // Windows
        ctx.fillStyle = '#93c5fd';
        const windowStart = train.speed > 0 ? tx + 10 : tx + 30;
        for (let wx = windowStart; wx < tx + tw - 30; wx += 30) {
          ctx.fillRect(wx, ty + 6, 15, th - 12);
        }

        // Wheels
        ctx.fillStyle = '#1f2937';
        for (let wx = tx + 15; wx < tx + tw - 10; wx += 40) {
          ctx.beginPath();
          ctx.arc(wx, ty + th, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPlayer(ctx: CanvasRenderingContext2D) {
    const px = playerPxXRef.current + PLAYER_OFFSET;
    let py = playerPxYRef.current + PLAYER_OFFSET;

    // Hop bounce
    if (hopProgressRef.current > 0) {
      const hp = hopProgressRef.current / HOP_FRAMES;
      const bounce = Math.sin(hp * Math.PI) * 8;
      py -= bounce;
    }

    // Death animation
    if (!playerAliveRef.current) {
      const df = deathFrameRef.current;
      const type = deathTypeRef.current;

      ctx.save();
      if (type === 'splash') {
        const sinkOffset = Math.min(df * 1.5, 20);
        py += sinkOffset;
        ctx.globalAlpha = Math.max(0, 1 - df / 35);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 3; r++) {
          const radius = df * 1.5 + r * 8;
          ctx.globalAlpha = Math.max(0, 0.6 - radius / 60);
          ctx.beginPath();
          ctx.arc(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = Math.max(0, 1 - df / 30);
      } else if (type === 'hit' || type === 'crushed') {
        ctx.globalAlpha = Math.max(0, 1 - df / 35);
        const squish = Math.min(df * 0.5, 10);
        py += squish / 2;
        if (df < 10 && df % 4 < 2) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(px - 4, py - 4, PLAYER_SIZE + 8, PLAYER_SIZE + 8);
        }
      } else {
        ctx.globalAlpha = Math.max(0, 1 - df / 30);
      }

      drawPlayerBody(ctx, px, py);
      ctx.restore();
      return;
    }

    drawPlayerBody(ctx, px, py);
  }

  function drawPlayerBody(ctx: CanvasRenderingContext2D, px: number, py: number) {
    const skin = SKINS.find(s => s.id === activeSkinRef.current) ?? SKINS[0];

    // Ghost hover offset + transparency
    if (skin.id === 'ghost') {
      py += Math.sin(frameRef.current * 0.08) * 3;
      ctx.globalAlpha = 0.75 + Math.sin(frameRef.current * 0.06) * 0.15;
    }

    // Shadow (smaller for ghost)
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    const shadowScale = skin.id === 'ghost' ? 0.35 : 0.5;
    ctx.ellipse(px + PLAYER_SIZE / 2 + 2, py + PLAYER_SIZE + 2, PLAYER_SIZE * shadowScale, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = skin.body;
    roundRect(ctx, px, py, PLAYER_SIZE, PLAYER_SIZE, 6);

    // Ghost: wavy bottom instead of flat dark
    if (skin.id === 'ghost') {
      ctx.fillStyle = skin.dark;
      ctx.beginPath();
      ctx.moveTo(px, py + PLAYER_SIZE * 0.6);
      ctx.lineTo(px + PLAYER_SIZE, py + PLAYER_SIZE * 0.6);
      for (let i = PLAYER_SIZE; i >= 0; i -= 5) {
        const wave = Math.sin(i * 0.5 + frameRef.current * 0.1) * 3;
        ctx.lineTo(px + i, py + PLAYER_SIZE + wave);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      // Darker bottom half
      ctx.fillStyle = skin.dark;
      roundRect(ctx, px, py + PLAYER_SIZE * 0.6, PLAYER_SIZE, PLAYER_SIZE * 0.4, 6);
    }

    // Penguin belly
    if (skin.id === 'penguin' && skin.accent) {
      ctx.fillStyle = skin.accent;
      roundRect(ctx, px + 6, py + 8, PLAYER_SIZE - 12, PLAYER_SIZE - 12, 4);
    }

    // Robot antenna
    if (skin.id === 'robot' && skin.accent) {
      ctx.fillStyle = skin.accent;
      ctx.fillRect(px + PLAYER_SIZE / 2 - 1, py - 6, 2, 7);
      ctx.beginPath();
      ctx.arc(px + PLAYER_SIZE / 2, py - 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lava glow + dripping particles
    if (skin.id === 'lava' && skin.accent) {
      // Outer glow
      ctx.fillStyle = '#ef4444';
      ctx.globalAlpha = 0.2 + Math.sin(frameRef.current * 0.12) * 0.12;
      roundRect(ctx, px - 4, py - 4, PLAYER_SIZE + 8, PLAYER_SIZE + 8, 10);
      ctx.globalAlpha = 1;
      // Inner glow
      ctx.fillStyle = skin.accent;
      ctx.globalAlpha = 0.35 + Math.sin(frameRef.current * 0.18) * 0.15;
      roundRect(ctx, px - 1, py - 1, PLAYER_SIZE + 2, PLAYER_SIZE + 2, 7);
      ctx.globalAlpha = 1;
      // Lava cracks
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + 5, py + PLAYER_SIZE * 0.7);
      ctx.lineTo(px + PLAYER_SIZE / 2, py + PLAYER_SIZE * 0.5);
      ctx.lineTo(px + PLAYER_SIZE - 5, py + PLAYER_SIZE * 0.75);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Rising embers
      for (let i = 0; i < 3; i++) {
        const t = (frameRef.current * 0.04 + i * 1.2) % 3;
        const ex = px + 5 + (i * 11 % PLAYER_SIZE);
        const ey = py - t * 8;
        ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#ef4444';
        ctx.globalAlpha = Math.max(0, 1 - t / 3) * 0.7;
        ctx.beginPath();
        ctx.arc(ex, ey, 2 - t * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Galaxy nebula + orbiting stars
    if (skin.id === 'galaxy' && skin.accent) {
      // Nebula overlay
      ctx.save();
      const nebHue = (frameRef.current * 0.5) % 360;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = `hsl(${nebHue}, 70%, 60%)`;
      roundRect(ctx, px, py, PLAYER_SIZE, PLAYER_SIZE, 6);
      ctx.globalAlpha = 1;
      ctx.restore();
      // Orbiting stars
      for (let i = 0; i < 5; i++) {
        const angle = frameRef.current * 0.05 + i * (Math.PI * 2 / 5);
        const orbitR = PLAYER_SIZE * 0.35 + Math.sin(frameRef.current * 0.03 + i) * 3;
        const sx = px + PLAYER_SIZE / 2 + Math.cos(angle) * orbitR;
        const sy = py + PLAYER_SIZE / 2 + Math.sin(angle) * orbitR;
        ctx.fillStyle = i % 2 === 0 ? skin.accent : '#e0e7ff';
        ctx.globalAlpha = 0.6 + Math.sin(frameRef.current * 0.1 + i * 2) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Star trail
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const r = PLAYER_SIZE * 0.35 + Math.sin(a * 3 + frameRef.current * 0.03) * 3;
        const x = px + PLAYER_SIZE / 2 + Math.cos(a) * r;
        const y = py + PLAYER_SIZE / 2 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Ninja headband
    if (skin.id === 'ninja' && skin.accent) {
      ctx.fillStyle = skin.accent;
      ctx.fillRect(px, py + PLAYER_SIZE * 0.22, PLAYER_SIZE, 4);
      // Headband tails
      ctx.fillRect(px + PLAYER_SIZE - 2, py + PLAYER_SIZE * 0.18, 8, 3);
      ctx.fillRect(px + PLAYER_SIZE - 1, py + PLAYER_SIZE * 0.26, 7, 2);
      // Shurikens floating around (animated)
      ctx.save();
      const angle = frameRef.current * 0.12;
      const orbitR = PLAYER_SIZE * 0.7;
      const sx = px + PLAYER_SIZE / 2 + Math.cos(angle) * orbitR;
      const sy = py + PLAYER_SIZE / 2 + Math.sin(angle) * orbitR * 0.5;
      ctx.translate(sx, sy);
      ctx.rotate(frameRef.current * 0.3);
      ctx.fillStyle = '#a1a1aa';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-1, -4, 2, 8);
      }
      ctx.restore();
    }

    // Diamond shimmer
    if (skin.id === 'diamond' && skin.accent) {
      // Prismatic edge glow
      const shimmer = Math.sin(frameRef.current * 0.08);
      ctx.save();
      ctx.globalAlpha = 0.2 + shimmer * 0.15;
      ctx.strokeStyle = skin.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - 2, py - 2, PLAYER_SIZE + 4, PLAYER_SIZE + 4, 8);
      ctx.stroke();
      ctx.restore();
      // Sparkle particles
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        const phase = frameRef.current * 0.06 + i * 2.1;
        const sx = px + PLAYER_SIZE / 2 + Math.cos(phase * 1.3 + i) * (PLAYER_SIZE * 0.6);
        const sy = py + PLAYER_SIZE / 2 + Math.sin(phase * 0.9 + i * 1.5) * (PLAYER_SIZE * 0.6);
        const sparkSize = 1 + Math.sin(phase * 2) * 0.8;
        ctx.globalAlpha = 0.4 + Math.sin(phase * 3) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ★ GOLDEN — royal treatment ★
    if (skin.id === 'golden' && skin.accent) {
      const cx = px + PLAYER_SIZE / 2;
      const cy = py + PLAYER_SIZE / 2;
      const f = frameRef.current;

      // Outer golden aura (large pulsing ring)
      ctx.save();
      ctx.globalAlpha = 0.12 + Math.sin(f * 0.06) * 0.06;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, cy, PLAYER_SIZE * 0.9 + Math.sin(f * 0.08) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Radial light rays
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f * 0.01);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fef3c7';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(0, -PLAYER_SIZE * 1.1);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Metallic body sheen (diagonal moving highlight)
      const sheenX = ((f * 0.8) % (PLAYER_SIZE + 20)) - 10;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, PLAYER_SIZE, PLAYER_SIZE, 6);
      ctx.clip();
      ctx.globalAlpha = 0.3;
      const sheenGrad = ctx.createLinearGradient(px + sheenX - 6, py, px + sheenX + 6, py + PLAYER_SIZE);
      sheenGrad.addColorStop(0, 'transparent');
      sheenGrad.addColorStop(0.4, '#fef3c7');
      sheenGrad.addColorStop(0.5, '#ffffff');
      sheenGrad.addColorStop(0.6, '#fef3c7');
      sheenGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(px, py, PLAYER_SIZE, PLAYER_SIZE);
      ctx.restore();

      // Royal cape (behind body — drawn on sides)
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(px - 3, py + PLAYER_SIZE * 0.3);
      ctx.quadraticCurveTo(px - 7, py + PLAYER_SIZE * 0.8, px - 4, py + PLAYER_SIZE + 4);
      ctx.lineTo(px, py + PLAYER_SIZE);
      ctx.lineTo(px, py + PLAYER_SIZE * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + PLAYER_SIZE + 3, py + PLAYER_SIZE * 0.3);
      ctx.quadraticCurveTo(px + PLAYER_SIZE + 7, py + PLAYER_SIZE * 0.8, px + PLAYER_SIZE + 4, py + PLAYER_SIZE + 4);
      ctx.lineTo(px + PLAYER_SIZE, py + PLAYER_SIZE);
      ctx.lineTo(px + PLAYER_SIZE, py + PLAYER_SIZE * 0.3);
      ctx.closePath();
      ctx.fill();
      // Cape fur trim
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(px - 3, py + PLAYER_SIZE * 0.28, 3, 5);
      ctx.fillRect(px + PLAYER_SIZE, py + PLAYER_SIZE * 0.28, 3, 5);

      // Crown — bigger and more detailed
      const crownY = py - 10;
      // Crown base
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(px + 1, crownY + 10);
      ctx.lineTo(px + 1, crownY + 4);
      ctx.lineTo(px + 6, crownY + 6);
      ctx.lineTo(px + 10, crownY + 1);
      ctx.lineTo(px + PLAYER_SIZE / 2, crownY + 5);
      ctx.lineTo(px + PLAYER_SIZE - 10, crownY + 1);
      ctx.lineTo(px + PLAYER_SIZE - 6, crownY + 6);
      ctx.lineTo(px + PLAYER_SIZE - 1, crownY + 4);
      ctx.lineTo(px + PLAYER_SIZE - 1, crownY + 10);
      ctx.closePath();
      ctx.fill();
      // Crown gold band
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px + 2, crownY + 7, PLAYER_SIZE - 4, 3);
      // Crown gems
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(px + PLAYER_SIZE / 2, crownY + 3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(px + 7, crownY + 5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + PLAYER_SIZE - 7, crownY + 5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(px + 11, crownY + 7, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + PLAYER_SIZE - 11, crownY + 7, 1.5, 0, Math.PI * 2); ctx.fill();
      // Crown tip sparkles
      for (const tipX of [10, PLAYER_SIZE / 2, PLAYER_SIZE - 10]) {
        const sparkle = Math.sin(f * 0.15 + tipX) * 0.5 + 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = sparkle * 0.8;
        ctx.beginPath();
        ctx.arc(px + tipX, crownY + 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Orbiting sparkle particles
      for (let i = 0; i < 6; i++) {
        const angle = f * 0.04 + i * (Math.PI * 2 / 6);
        const orbitR = PLAYER_SIZE * 0.75 + Math.sin(f * 0.06 + i * 2) * 4;
        const sx = cx + Math.cos(angle) * orbitR;
        const sy = cy + Math.sin(angle) * orbitR * 0.7;
        const sparkSize = 1.5 + Math.sin(f * 0.12 + i * 1.5) * 1;
        ctx.fillStyle = i % 3 === 0 ? '#fef3c7' : i % 3 === 1 ? '#fbbf24' : '#ffffff';
        ctx.globalAlpha = 0.5 + Math.sin(f * 0.1 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Body highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(px + 4, py + 3, PLAYER_SIZE - 8, 3);

    // Eyes
    ctx.fillStyle = skin.eyes;
    const eyeY = py + PLAYER_SIZE * 0.32;
    const eyeR = skin.id === 'robot' ? 4 : 3;
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.32, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.68, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = skin.eyes === '#ffffff' ? '#60a5fa' : '#ffffff';
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.35, eyeY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.71, eyeY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak / mouth
    ctx.fillStyle = skin.beak;
    if (skin.id === 'ghost') {
      // Ghost mouth: wavy line
      ctx.strokeStyle = skin.beak;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + PLAYER_SIZE * 0.3, py + PLAYER_SIZE * 0.58);
      ctx.quadraticCurveTo(px + PLAYER_SIZE * 0.4, py + PLAYER_SIZE * 0.65, px + PLAYER_SIZE * 0.5, py + PLAYER_SIZE * 0.58);
      ctx.quadraticCurveTo(px + PLAYER_SIZE * 0.6, py + PLAYER_SIZE * 0.51, px + PLAYER_SIZE * 0.7, py + PLAYER_SIZE * 0.58);
      ctx.stroke();
    } else if (skin.id === 'robot') {
      // Robot mouth: rectangle
      ctx.fillRect(px + PLAYER_SIZE * 0.3, py + PLAYER_SIZE * 0.55, PLAYER_SIZE * 0.4, 3);
    } else if (skin.id === 'pig') {
      // Pig snout: oval with dots
      ctx.beginPath();
      ctx.ellipse(px + PLAYER_SIZE * 0.5, py + PLAYER_SIZE * 0.55, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.dark;
      ctx.beginPath();
      ctx.arc(px + PLAYER_SIZE * 0.44, py + PLAYER_SIZE * 0.55, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + PLAYER_SIZE * 0.56, py + PLAYER_SIZE * 0.55, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default beak triangle
      ctx.beginPath();
      ctx.moveTo(px + PLAYER_SIZE * 0.4, py + PLAYER_SIZE * 0.52);
      ctx.lineTo(px + PLAYER_SIZE * 0.6, py + PLAYER_SIZE * 0.52);
      ctx.lineTo(px + PLAYER_SIZE * 0.5, py + PLAYER_SIZE * 0.65);
      ctx.closePath();
      ctx.fill();
    }

    // Reset ghost transparency
    if (skin.id === 'ghost') ctx.globalAlpha = 1;
  }

  // ── RAF loop ───────────────────────────────────────────────────────
  useEffect(() => {
    lastTimeRef.current = 0; // reset so first frame gets dt=0
    function loop(timestamp: number) {
      tick(timestamp);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [tick, draw]);

  // Cleanup countdown timer
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // ── JSX ────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full flex-1 min-h-0">
    <div className="flex flex-col items-center gap-2 w-full mx-auto select-none flex-1 min-w-0 min-h-0">
      {/* Game area */}
      <div className="flex-1 min-h-0 w-full flex justify-center">
        <div
          className="relative h-full overflow-hidden rounded-2xl border-2 border-zinc-800"
          style={{ aspectRatio: `${GAME_W} / ${GAME_H}`, maxWidth: '100%' }}
        >
          <canvas
            ref={canvasRef}
            width={GAME_W}
            height={GAME_H}
            className="absolute inset-0 w-full h-full bg-zinc-950 block touch-none"
          />

        {/* Idle overlay */}
        {phase === 'idle' && !showShop && (
          <div className="absolute inset-0 flex flex-col items-center justify-end rounded-xl overflow-hidden">
            {/* Top gradient fade over the game world */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90 pointer-events-none" />

            {/* Title area */}
            <div className="absolute top-[12%] left-0 right-0 flex flex-col items-center z-10">
              <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">CROSSY ROAD</h2>
              {best > 0 && (
                <p className="text-zinc-400 text-sm mt-1 font-semibold">{t('crossyroad.best')}: {best}</p>
              )}
            </div>

            {/* Skin preview — large centered character */}
            <div className="absolute top-[32%] left-0 right-0 flex justify-center z-10">
              <SkinPreview skin={SKINS.find(s => s.id === activeSkin) ?? SKINS[0]} size={80} />
            </div>

            {/* Bottom buttons */}
            <div className="relative z-10 flex flex-col items-center gap-3 pb-[15%]">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                <span className="text-base">●</span> {wallet}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={startGame}
                  className="px-10 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-900/40"
                >
                  {t('crossyroad.start')}
                </button>
                <button
                  onClick={() => setShowShop(true)}
                  className="px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-lg transition-all hover:scale-105 shadow-lg shadow-amber-900/40"
                >
                  {t('crossyroad.shop')}
                </button>
              </div>
              <p className="text-zinc-500 text-xs">{t('crossyroad.tapToStart')}</p>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'over' && !showShop && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/70 via-black/80 to-black/90 rounded-xl">
            <h2 className="text-2xl font-black text-zinc-400 mb-1 uppercase tracking-wider">{t('crossyroad.gameOver')}</h2>
            <p className="text-6xl font-black text-white mb-1">{score}</p>
            {pb.isNewBest && (
              <p className="text-amber-400 text-sm font-black mb-1 uppercase tracking-widest animate-pulse">NEW BEST!</p>
            )}
            {coinCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 text-sm font-bold mb-2 px-3 py-1 rounded-full bg-amber-950/40">
                +{coinCount} ●
              </div>
            )}
            <p className="text-zinc-500 text-sm mb-6">
              {t('crossyroad.best')}: {best}
            </p>
            <div className="flex gap-3">
              <button
                onClick={startGame}
                className="px-10 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg transition-all hover:scale-105 shadow-lg"
              >
                {t('crossyroad.retry')}
              </button>
              <button
                onClick={() => setShowShop(true)}
                className="px-6 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-lg transition-all hover:scale-105 shadow-lg"
              >
                {t('crossyroad.shop')}
              </button>
            </div>
          </div>
        )}

        {/* Shop overlay */}
        {showShop && (
          <div className="absolute inset-0 flex flex-col bg-zinc-950 rounded-xl overflow-auto scrollbar-none">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-xl font-black text-white tracking-tight">{t('crossyroad.shop')}</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-800/30">
                  <span className="text-base">●</span> {wallet}
                </div>
                <button onClick={() => setShowShop(false)} className="text-zinc-500 hover:text-white text-2xl leading-none transition-colors">&times;</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 px-4 pb-5">
              {SKINS.map(skin => {
                const owned = ownedSkins.has(skin.id);
                const active = activeSkin === skin.id;
                const allOthersOwned = SKINS.filter(s => s.id !== 'golden').every(s => ownedSkins.has(s.id));
                const locked = skin.id === 'golden' && !owned && !allOthersOwned;
                const canAfford = !locked && wallet >= skin.price;
                const rarityBorder = active
                  ? 'border-amber-400 shadow-amber-500/20 shadow-lg'
                  : skin.price <= 0 ? 'border-zinc-700'
                  : skin.price <= 30 ? 'border-emerald-800/50'
                  : skin.price <= 75 ? 'border-blue-800/50'
                  : skin.price <= 200 ? 'border-purple-800/50'
                  : 'border-amber-700/50';
                return (
                  <button
                    key={skin.id}
                    onClick={() => {
                      if (owned) {
                        setActiveSkinState(skin.id);
                        activeSkinRef.current = skin.id;
                        const cp = loadCrossyProgress();
                        cp.activeSkin = skin.id;
                        saveCrossyProgress(cp);
                        debouncedCloudSave();
                      } else if (canAfford) {
                        const cp = loadCrossyProgress();
                        cp.wallet -= skin.price;
                        cp.owned = [...new Set([...cp.owned, skin.id])];
                        cp.activeSkin = skin.id;
                        saveCrossyProgress(cp);
                        setWallet(cp.wallet);
                        setOwnedSkins(new Set(cp.owned));
                        setActiveSkinState(skin.id);
                        activeSkinRef.current = skin.id;
                        debouncedCloudSave();
                      }
                    }}
                    disabled={!owned && (!canAfford || locked)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${rarityBorder} ${
                      active
                        ? 'bg-amber-950/60'
                        : owned
                          ? 'bg-zinc-800/80 hover:bg-zinc-700/80'
                          : canAfford && !locked
                            ? 'bg-zinc-800/60 hover:bg-zinc-700/60 hover:scale-105'
                            : 'bg-zinc-900/60 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <SkinPreview skin={skin} size={48} />
                    <span className="text-[11px] font-bold text-zinc-200">{t(`crossyroad.skin.${skin.id}`)}</span>
                    {active && (
                      <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">{t('crossyroad.equipped')}</span>
                    )}
                    {owned && !active && (
                      <span className="text-[10px] text-emerald-500 font-semibold">{t('crossyroad.owned')}</span>
                    )}
                    {!owned && locked && (
                      <span className="text-[9px] font-semibold text-zinc-500 text-center leading-tight">
                        {t('crossyroad.goldenLocked')}
                      </span>
                    )}
                    {!owned && !locked && (
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${canAfford ? 'text-amber-400' : 'text-zinc-600'}`}>
                        ● {skin.price}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Mobile touch controls */}
      <TouchControls
        layout="dpad"
        disabled={phase !== 'playing'}
      />

      {/* Scoreboard — below the game, mobile/tablet only */}
      {phase === 'over' && (
        <div className="shrink-0 w-full max-w-md pb-4 lg:hidden">
          <ScoreboardPanel
            gameId="crossyroad"
            scores={pb.scores}
            lastInsertId={pb.lastInsertId}
            isNewBest={pb.isNewBest}
            onClear={pb.clear}
          />
        </div>
      )}
    </div>

    <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
      <div className="flex flex-col gap-3">
        <ScoreboardPanel
          gameId="crossyroad"
          scores={pb.scores}
          lastInsertId={pb.lastInsertId}
          isNewBest={pb.isNewBest}
          onClear={pb.clear}
        />
      </div>
    </aside>
    </div>
  );
}

// ── Skin preview (mini canvas for shop) ────────────────────────────────────

function SkinPreview({ skin, size }: { skin: SkinDef; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = size;
    const p = 4; // padding
    const bs = s - p * 2; // body size

    ctx.clearRect(0, 0, s, s);

    // Body
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.roundRect(p, p, bs, bs, 5);
    ctx.fill();

    // Dark bottom
    ctx.fillStyle = skin.dark;
    ctx.beginPath();
    ctx.roundRect(p, p + bs * 0.6, bs, bs * 0.4, 5);
    ctx.fill();

    // Penguin belly
    if (skin.id === 'penguin' && skin.accent) {
      ctx.fillStyle = skin.accent;
      ctx.beginPath();
      ctx.roundRect(p + 5, p + 6, bs - 10, bs - 10, 3);
      ctx.fill();
    }

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(p + 3, p + 2, bs - 6, 3);

    // Eyes
    ctx.fillStyle = skin.eyes;
    const ey = p + bs * 0.32;
    ctx.beginPath();
    ctx.arc(p + bs * 0.32, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p + bs * 0.68, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = skin.eyes === '#ffffff' ? '#60a5fa' : '#ffffff';
    ctx.beginPath();
    ctx.arc(p + bs * 0.35, ey - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p + bs * 0.71, ey - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = skin.beak;
    ctx.beginPath();
    ctx.moveTo(p + bs * 0.4, p + bs * 0.52);
    ctx.lineTo(p + bs * 0.6, p + bs * 0.52);
    ctx.lineTo(p + bs * 0.5, p + bs * 0.65);
    ctx.closePath();
    ctx.fill();

    // Golden extras: aura + crown
    if (skin.id === 'golden') {
      const cx = s / 2;
      const cy = s / 2;

      // Outer glow
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, cy, bs * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Metallic sheen
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(p, p, bs, bs, 5);
      ctx.clip();
      ctx.globalAlpha = 0.25;
      const sheenGrad = ctx.createLinearGradient(p, p, p + bs, p + bs);
      sheenGrad.addColorStop(0, 'transparent');
      sheenGrad.addColorStop(0.4, '#fef3c7');
      sheenGrad.addColorStop(0.5, '#ffffff');
      sheenGrad.addColorStop(0.6, '#fef3c7');
      sheenGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(p, p, bs, bs);
      ctx.restore();

      // Crown
      const crownY = p - 4;
      const crownW = bs * 0.8;
      const crownX = p + (bs - crownW) / 2;
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(crownX, crownY + 7);
      ctx.lineTo(crownX, crownY + 3);
      ctx.lineTo(crownX + crownW * 0.2, crownY + 5);
      ctx.lineTo(crownX + crownW * 0.35, crownY);
      ctx.lineTo(crownX + crownW * 0.5, crownY + 4);
      ctx.lineTo(crownX + crownW * 0.65, crownY);
      ctx.lineTo(crownX + crownW * 0.8, crownY + 5);
      ctx.lineTo(crownX + crownW, crownY + 3);
      ctx.lineTo(crownX + crownW, crownY + 7);
      ctx.closePath();
      ctx.fill();
      // Gold band
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(crownX + 1, crownY + 5, crownW - 2, 2);
      // Gem
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(crownX + crownW * 0.5, crownY + 2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [skin, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="block" />;
}
