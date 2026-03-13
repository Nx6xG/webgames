'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
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
  // Occasional coin
  if (Math.random() < 0.15) {
    const col = randInt(0, COLS - 1);
    if (!usedCols.has(col)) {
      coins.push({ col, collected: false });
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

  // Load best
  useEffect(() => {
    const b = loadBest();
    setBest(b);
    bestRef.current = b;
  }, []);

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
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(px + PLAYER_SIZE / 2 + 2, py + PLAYER_SIZE + 2, PLAYER_SIZE / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = PLAYER_COLOR;
    roundRect(ctx, px, py, PLAYER_SIZE, PLAYER_SIZE, 6);

    // Darker bottom half
    ctx.fillStyle = PLAYER_DARK;
    roundRect(ctx, px, py + PLAYER_SIZE * 0.6, PLAYER_SIZE, PLAYER_SIZE * 0.4, 6);

    // Body highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(px + 4, py + 3, PLAYER_SIZE - 8, 3);

    // Eyes
    ctx.fillStyle = '#1f2937';
    const eyeY = py + PLAYER_SIZE * 0.32;
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.32, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.68, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.35, eyeY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE * 0.71, eyeY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(px + PLAYER_SIZE * 0.4, py + PLAYER_SIZE * 0.52);
    ctx.lineTo(px + PLAYER_SIZE * 0.6, py + PLAYER_SIZE * 0.52);
    ctx.lineTo(px + PLAYER_SIZE * 0.5, py + PLAYER_SIZE * 0.65);
    ctx.closePath();
    ctx.fill();
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
    <div className="flex flex-col items-center gap-2 w-full mx-auto select-none" style={{ height: 'calc(100dvh - 4rem)' }}>
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
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-xl">
            <div className="text-6xl mb-4 select-none">🐔</div>
            <h2 className="text-2xl font-black text-white mb-2">Crossy Road</h2>
            <p className="text-zinc-400 text-sm mb-6">{t('crossyroad.tapToStart')}</p>
            <button
              onClick={startGame}
              className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
            >
              {t('crossyroad.start')}
            </button>
            {best > 0 && (
              <p className="mt-4 text-zinc-500 text-sm">
                {t('crossyroad.best')}: {best}
              </p>
            )}
          </div>
        )}

        {/* Game over overlay */}
        {phase === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
            <h2 className="text-3xl font-black text-white mb-2">{t('crossyroad.gameOver')}</h2>
            <p className="text-5xl font-black text-white mb-1">{score}</p>
            {pb.isNewBest && (
              <p className="text-amber-400 text-sm font-bold mb-2">NEW BEST!</p>
            )}
            <p className="text-zinc-500 text-sm mb-5">
              {t('crossyroad.best')}: {best}
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
            >
              {t('crossyroad.retry')}
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Scoreboard — below the game, always readable */}
      {phase === 'over' && (
        <div className="shrink-0 w-full max-w-md pb-4">
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
  );
}
