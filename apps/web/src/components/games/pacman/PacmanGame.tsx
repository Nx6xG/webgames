'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useSwipe } from '@/hooks/useSwipe';
import TouchControls from '@/components/ui/TouchControls';
import { loadStats, saveStats, updateStats } from './stats';
import * as sfx from './sound';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'dying' | 'ended';
type Direction = 'up' | 'down' | 'left' | 'right';
type Difficulty = 'easy' | 'medium' | 'hard';
type CellType = 0 | 1 | 2 | 3; // 0=wall, 1=dot, 2=power pellet, 3=empty

interface Pos { x: number; y: number }

interface Ghost {
  pos: Pos;
  dir: Direction;
  color: string;
  scared: boolean;
  eaten: boolean;
  scatterTarget: Pos;
  name: string;
}

interface GameState {
  maze: CellType[][];
  pacman: Pos;
  pacDir: Direction;
  nextDir: Direction;
  ghosts: Ghost[];
  score: number;
  lives: number;
  level: number;
  dotsLeft: number;
  powerTimer: number;
  ghostsEatenCombo: number;
  mouthOpen: boolean;
  mouthTimer: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const COLS = 21;
const ROWS = 23;
const CELL_SIZE = 20; // pixels per cell
const CANVAS_W = COLS * CELL_SIZE;
const CANVAS_H = ROWS * CELL_SIZE;

const POWER_DURATION = 360; // frames (~6 sec at 60fps)
const GHOST_SCORE = [200, 400, 800, 1600];

const DIFFICULTY_SPEED: Record<Difficulty, { pacSpeed: number; ghostSpeed: number; ghostSpeedScale: number }> = {
  easy:   { pacSpeed: 1.7, ghostSpeed: 1.2, ghostSpeedScale: 0.06 },
  medium: { pacSpeed: 2.0, ghostSpeed: 1.6, ghostSpeedScale: 0.08 },
  hard:   { pacSpeed: 2.4, ghostSpeed: 2.0, ghostSpeedScale: 0.10 },
};

// Classic-inspired maze layout (21 x 23)
// 0=wall, 1=dot, 2=power pellet, 3=empty (ghost house, tunnels)
const BASE_MAZE: CellType[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0],
  [0,2,0,0,1,0,0,0,0,1,0,1,0,0,0,0,1,0,0,2,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,0,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0],
  [0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0,0,0],
  [0,0,0,0,1,0,1,0,0,3,3,3,0,0,1,0,1,0,0,0,0],
  [3,3,3,3,1,1,1,0,3,3,3,3,3,0,1,1,1,3,3,3,3],
  [0,0,0,0,1,0,1,0,3,3,3,3,3,0,1,0,1,0,0,0,0],
  [0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0],
  [0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1,0],
  [0,2,1,0,1,1,1,1,1,1,3,1,1,1,1,1,1,0,1,2,0],
  [0,0,1,0,1,0,1,0,0,0,0,0,0,0,1,0,1,0,1,0,0],
  [0,1,1,1,1,0,1,1,1,0,0,0,1,1,1,0,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Two extra rows for symmetry padding
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const PACMAN_START: Pos = { x: 10, y: 15 };
const GHOST_HOME: Pos = { x: 10, y: 9 };

function createGhosts(): Ghost[] {
  return [
    { pos: { x: 9, y: 9 },  dir: 'up',    color: '#ef4444', scared: false, eaten: false, scatterTarget: { x: COLS - 2, y: 0 },       name: 'blinky' },
    { pos: { x: 10, y: 9 }, dir: 'up',    color: '#f472b6', scared: false, eaten: false, scatterTarget: { x: 1, y: 0 },              name: 'pinky' },
    { pos: { x: 11, y: 9 }, dir: 'down',  color: '#22d3ee', scared: false, eaten: false, scatterTarget: { x: COLS - 2, y: ROWS - 2 }, name: 'inky' },
    { pos: { x: 10, y: 10 },dir: 'up',    color: '#f97316', scared: false, eaten: false, scatterTarget: { x: 1, y: ROWS - 2 },       name: 'clyde' },
  ];
}

function cloneMaze(): CellType[][] {
  return BASE_MAZE.map(row => [...row]);
}

function countDots(maze: CellType[][]): number {
  let count = 0;
  for (const row of maze) for (const c of row) if (c === 1 || c === 2) count++;
  return count;
}

function createInitialState(level: number = 1): GameState {
  const maze = cloneMaze();
  return {
    maze,
    pacman: { ...PACMAN_START },
    pacDir: 'left',
    nextDir: 'left',
    ghosts: createGhosts(),
    score: 0,
    lives: 3,
    level,
    dotsLeft: countDots(maze),
    powerTimer: 0,
    ghostsEatenCombo: 0,
    mouthOpen: true,
    mouthTimer: 0,
  };
}

// ── Movement helpers ─────────────────────────────────────────────────────────

const DIR_DELTA: Record<Direction, Pos> = {
  up:    { x: 0,  y: -1 },
  down:  { x: 0,  y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1,  y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down', down: 'up', left: 'right', right: 'left',
};

function isWalkable(maze: CellType[][], x: number, y: number): boolean {
  // Tunnel wrap
  if (y >= 0 && y < ROWS && (x < 0 || x >= COLS)) return true;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return maze[y][x] !== 0;
}

function wrapX(x: number): number {
  if (x < 0) return COLS - 1;
  if (x >= COLS) return 0;
  return x;
}

function canMove(maze: CellType[][], pos: Pos, dir: Direction): boolean {
  const d = DIR_DELTA[dir];
  return isWalkable(maze, pos.x + d.x, pos.y + d.y);
}

function dist(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getAvailableDirs(maze: CellType[][], pos: Pos, currentDir: Direction): Direction[] {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const opp = OPPOSITE[currentDir];
  return dirs.filter(d => d !== opp && canMove(maze, pos, d));
}

// ── Ghost AI ─────────────────────────────────────────────────────────────────

function chooseGhostDir(ghost: Ghost, maze: CellType[][], target: Pos): Direction {
  const available = getAvailableDirs(maze, ghost.pos, ghost.dir);
  if (available.length === 0) {
    // Allow reversing as last resort
    if (canMove(maze, ghost.pos, OPPOSITE[ghost.dir])) return OPPOSITE[ghost.dir];
    return ghost.dir;
  }
  if (available.length === 1) return available[0];

  // Pick direction closest to target
  let bestDir = available[0];
  let bestDist = Infinity;
  for (const d of available) {
    const delta = DIR_DELTA[d];
    const nx = ghost.pos.x + delta.x;
    const ny = ghost.pos.y + delta.y;
    const dd = dist({ x: nx, y: ny }, target);
    if (dd < bestDist) {
      bestDist = dd;
      bestDir = d;
    }
  }
  return bestDir;
}

function getGhostTarget(ghost: Ghost, pacPos: Pos, pacDir: Direction, blinkyPos: Pos, scared: boolean): Pos {
  if (scared) {
    // Random scatter
    return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  }
  if (ghost.eaten) return GHOST_HOME;

  switch (ghost.name) {
    case 'blinky':
      // Chase directly
      return pacPos;
    case 'pinky': {
      // Target 4 tiles ahead of pac-man
      const d = DIR_DELTA[pacDir];
      return { x: pacPos.x + d.x * 4, y: pacPos.y + d.y * 4 };
    }
    case 'inky': {
      // Flanking: double the vector from blinky to 2-ahead-of-pac
      const d = DIR_DELTA[pacDir];
      const ahead = { x: pacPos.x + d.x * 2, y: pacPos.y + d.y * 2 };
      return { x: ahead.x + (ahead.x - blinkyPos.x), y: ahead.y + (ahead.y - blinkyPos.y) };
    }
    case 'clyde': {
      // If far, chase; if close, scatter
      if (dist(ghost.pos, pacPos) > 8) return pacPos;
      return ghost.scatterTarget;
    }
    default:
      return pacPos;
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────

const WALL_COLOR = '#1e3a5f';
const WALL_BORDER_COLOR = '#3b82f6';
const DOT_COLOR = '#fbbf24';
const POWER_COLOR = '#fbbf24';
const PACMAN_COLOR = '#facc15';
const SCARED_COLOR = '#3b82f6';
const EATEN_COLOR = '#ffffff';
const BG_COLOR = '#09090b';

function drawGame(ctx: CanvasRenderingContext2D, state: GameState, animFrame: number) {
  const cs = CELL_SIZE;

  // Clear
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const { maze, pacman, pacDir, ghosts, powerTimer, mouthOpen } = state;

  // Draw maze
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = maze[y][x];
      const px = x * cs;
      const py = y * cs;

      if (cell === 0) {
        // Wall
        ctx.fillStyle = WALL_COLOR;
        ctx.fillRect(px, py, cs, cs);
        // Draw borders where adjacent to non-wall
        ctx.strokeStyle = WALL_BORDER_COLOR;
        ctx.lineWidth = 1.5;
        if (y > 0 && maze[y - 1][x] !== 0) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cs, py); ctx.stroke(); }
        if (y < ROWS - 1 && maze[y + 1][x] !== 0) { ctx.beginPath(); ctx.moveTo(px, py + cs); ctx.lineTo(px + cs, py + cs); ctx.stroke(); }
        if (x > 0 && maze[y][x - 1] !== 0) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + cs); ctx.stroke(); }
        if (x < COLS - 1 && maze[y][x + 1] !== 0) { ctx.beginPath(); ctx.moveTo(px + cs, py); ctx.lineTo(px + cs, py + cs); ctx.stroke(); }
      } else if (cell === 1) {
        // Dot
        ctx.fillStyle = DOT_COLOR;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === 2) {
        // Power pellet (pulsing)
        const pulse = 3 + Math.sin(animFrame * 0.1) * 1.5;
        ctx.fillStyle = POWER_COLOR;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw ghosts
  for (const ghost of ghosts) {
    const gx = ghost.pos.x * cs + cs / 2;
    const gy = ghost.pos.y * cs + cs / 2;
    const gr = cs * 0.45;

    if (ghost.eaten) {
      // Just eyes
      drawGhostEyes(ctx, gx, gy, gr, ghost.dir);
      continue;
    }

    let ghostColor: string;
    if (ghost.scared) {
      // Flashing when about to end
      if (powerTimer < 90 && animFrame % 20 < 10) {
        ghostColor = EATEN_COLOR;
      } else {
        ghostColor = SCARED_COLOR;
      }
    } else {
      ghostColor = ghost.color;
    }

    // Ghost body
    ctx.fillStyle = ghostColor;
    ctx.beginPath();
    ctx.arc(gx, gy - gr * 0.15, gr, Math.PI, 0, false);
    ctx.lineTo(gx + gr, gy + gr * 0.7);
    // Wavy bottom
    const waveCount = 3;
    const waveWidth = (gr * 2) / waveCount;
    for (let i = 0; i < waveCount; i++) {
      const wx = gx + gr - i * waveWidth;
      const waveOffset = (animFrame % 20 < 10) ? 3 : -3;
      ctx.quadraticCurveTo(wx - waveWidth * 0.5, gy + gr * 0.7 + waveOffset, wx - waveWidth, gy + gr * 0.7);
    }
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (!ghost.scared) {
      drawGhostEyes(ctx, gx, gy, gr, ghost.dir);
    } else {
      // Scared face - simple dots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(gx - gr * 0.3, gy - gr * 0.2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + gr * 0.3, gy - gr * 0.2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Pac-Man
  const px = pacman.x * cs + cs / 2;
  const py = pacman.y * cs + cs / 2;
  const pr = cs * 0.45;

  const mouthAngle = mouthOpen ? 0.25 : 0.02;
  const dirAngle: Record<Direction, number> = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2,
  };
  const angle = dirAngle[pacDir];

  // Glow
  ctx.save();
  ctx.shadowColor = PACMAN_COLOR;
  ctx.shadowBlur = 8;
  ctx.fillStyle = PACMAN_COLOR;
  ctx.beginPath();
  ctx.arc(px, py, pr, angle + Math.PI * mouthAngle, angle - Math.PI * mouthAngle, false);
  ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // HUD - score, lives, level at bottom
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 6, CANVAS_H - 5);

  // Lives as small pac-men
  for (let i = 0; i < state.lives; i++) {
    ctx.fillStyle = PACMAN_COLOR;
    ctx.beginPath();
    ctx.arc(CANVAS_W - 20 - i * 18, CANVAS_H - 10, 6, 0.2 * Math.PI, -0.2 * Math.PI, false);
    ctx.lineTo(CANVAS_W - 20 - i * 18, CANVAS_H - 10);
    ctx.closePath();
    ctx.fill();
  }

  // Level
  ctx.fillStyle = '#a1a1aa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`L${state.level}`, CANVAS_W / 2, CANVAS_H - 12);
}

function drawGhostEyes(ctx: CanvasRenderingContext2D, gx: number, gy: number, gr: number, dir: Direction) {
  const eyeR = gr * 0.25;
  const pupilR = gr * 0.12;
  const eyeOffY = -gr * 0.15;
  const eyeOffX = gr * 0.3;

  // Eye direction offset
  const dd: Record<Direction, Pos> = {
    right: { x: pupilR * 0.6, y: 0 },
    left: { x: -pupilR * 0.6, y: 0 },
    up: { x: 0, y: -pupilR * 0.6 },
    down: { x: 0, y: pupilR * 0.6 },
  };
  const d = dd[dir];

  for (const xOff of [-eyeOffX, eyeOffX]) {
    // White
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(gx + xOff, gy + eyeOffY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(gx + xOff + d.x, gy + eyeOffY + d.y, pupilR, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function PacmanGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('pacman');
  const pb = usePersonalScores('pacman', user ? { userId: user.id, nickname } : undefined);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cdNum, setCdNum] = useState(3);
  const [bestScore, setBestScore] = useState(0);
  const [hudScore, setHudScore] = useState(0);
  const [hudLevel, setHudLevel] = useState(1);
  const [hudLives, setHudLives] = useState(3);

  const phaseRef = useRef<Phase>('menu');
  const stateRef = useRef<GameState>(createInitialState());
  const animFrameRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const savedRef = useRef(false);
  const difficultyRef = useRef<Difficulty>('medium');
  const moveAccRef = useRef(0);
  const ghostMoveAccRef = useRef(0);
  const scoreDisplayRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  // Load best score
  useEffect(() => {
    const stats = loadStats();
    setBestScore(stats.bestScore);
  }, []);

  const togglePause = useCallback(() => {
    setPhase(p => {
      if (p === 'playing') { phaseRef.current = 'paused'; return 'paused'; }
      if (p === 'paused') { phaseRef.current = 'playing'; return 'playing'; }
      return p;
    });
  }, []);

  useVisibilityPause(phase === 'playing', togglePause);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      if (phaseRef.current !== 'playing') return;
      stateRef.current.nextDir = dir;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause]);

  // ── Swipe (mobile) ─────────────────────────────────────────────────────────
  const swipeHandlers = useSwipe({
    onSwipe: useCallback((dir: Direction) => {
      if (phaseRef.current !== 'playing') return;
      stateRef.current.nextDir = dir;
    }, []),
  });

  // ── Start game ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    stateRef.current = createInitialState();
    scoreDisplayRef.current = 0;
    moveAccRef.current = 0;
    ghostMoveAccRef.current = 0;
    savedRef.current = false;
    setHudScore(0);
    setHudLevel(1);
    setHudLives(3);
    setCdNum(3);
    setPhase('countdown');
  }, []);

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCdNum(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n >= 0) {
        setCdNum(n);
      } else {
        clearInterval(id);
        setPhase('playing');
        ach.trackPlay();
      }
    }, 800);
    return () => clearInterval(id);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown' && phase !== 'dying') return;

    let lastTime = 0;
    const FPS = 60;
    const frameDuration = 1000 / FPS;

    function gameLoop(timestamp: number) {
      if (phaseRef.current === 'paused') {
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const delta = timestamp - lastTime;
      if (delta < frameDuration) {
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      lastTime = timestamp - (delta % frameDuration);

      animFrameRef.current++;
      const gs = stateRef.current;

      if (phaseRef.current === 'dying') {
        // Death animation - just render for a bit then respawn or game over
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) drawGame(ctx, gs, animFrameRef.current);
        }
        rafRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (phaseRef.current === 'playing') {
        const diff = DIFFICULTY_SPEED[difficultyRef.current];
        const levelScale = 1 + (gs.level - 1) * diff.ghostSpeedScale;
        const pacPixelSpeed = diff.pacSpeed;
        const ghostPixelSpeed = diff.ghostSpeed * Math.min(levelScale, 2.0);

        // Pac-Man movement accumulator (move every N frames based on speed)
        moveAccRef.current += pacPixelSpeed;
        if (moveAccRef.current >= CELL_SIZE) {
          moveAccRef.current -= CELL_SIZE;

          // Mouth animation
          gs.mouthTimer++;
          if (gs.mouthTimer >= 3) {
            gs.mouthOpen = !gs.mouthOpen;
            gs.mouthTimer = 0;
          }

          // Try nextDir first, fall back to current dir
          if (canMove(gs.maze, gs.pacman, gs.nextDir)) {
            gs.pacDir = gs.nextDir;
          }
          if (canMove(gs.maze, gs.pacman, gs.pacDir)) {
            const d = DIR_DELTA[gs.pacDir];
            gs.pacman.x = wrapX(gs.pacman.x + d.x);
            gs.pacman.y = gs.pacman.y + d.y;
          }

          // Eat dot / power pellet
          const cell = gs.maze[gs.pacman.y]?.[gs.pacman.x];
          if (cell === 1) {
            gs.maze[gs.pacman.y][gs.pacman.x] = 3;
            gs.score += 10;
            gs.dotsLeft--;
            sfx.dotSound();
          } else if (cell === 2) {
            gs.maze[gs.pacman.y][gs.pacman.x] = 3;
            gs.score += 50;
            gs.dotsLeft--;
            gs.powerTimer = POWER_DURATION;
            gs.ghostsEatenCombo = 0;
            for (const g of gs.ghosts) {
              if (!g.eaten) g.scared = true;
            }
            sfx.powerSound();
          }

          // Power timer
          if (gs.powerTimer > 0) {
            gs.powerTimer--;
            if (gs.powerTimer <= 0) {
              for (const g of gs.ghosts) {
                g.scared = false;
              }
            }
          }

          // Check level clear
          if (gs.dotsLeft <= 0) {
            sfx.levelUpSound();
            gs.level++;
            gs.maze = cloneMaze();
            gs.dotsLeft = countDots(gs.maze);
            gs.pacman = { ...PACMAN_START };
            gs.pacDir = 'left';
            gs.nextDir = 'left';
            gs.ghosts = createGhosts();
            gs.powerTimer = 0;
            gs.ghostsEatenCombo = 0;
            moveAccRef.current = 0;
            ghostMoveAccRef.current = 0;
          }
        }

        // Ghost movement accumulator
        ghostMoveAccRef.current += ghostPixelSpeed;
        if (ghostMoveAccRef.current >= CELL_SIZE) {
          ghostMoveAccRef.current -= CELL_SIZE;

          const blinkyPos = gs.ghosts[0].pos;

          for (const ghost of gs.ghosts) {
            const target = getGhostTarget(ghost, gs.pacman, gs.pacDir, blinkyPos, ghost.scared);
            ghost.dir = chooseGhostDir(ghost, gs.maze, target);

            if (canMove(gs.maze, ghost.pos, ghost.dir)) {
              const d = DIR_DELTA[ghost.dir];
              ghost.pos.x = wrapX(ghost.pos.x + d.x);
              ghost.pos.y = ghost.pos.y + d.y;
            }

            // Eaten ghost returned home
            if (ghost.eaten && ghost.pos.x === GHOST_HOME.x && ghost.pos.y === GHOST_HOME.y) {
              ghost.eaten = false;
              ghost.scared = false;
            }
          }
        }

        // Collision detection (check every frame)
        for (const ghost of gs.ghosts) {
          if (ghost.pos.x === gs.pacman.x && ghost.pos.y === gs.pacman.y) {
            if (ghost.scared && !ghost.eaten) {
              // Eat ghost
              ghost.eaten = true;
              ghost.scared = false;
              const bonus = GHOST_SCORE[Math.min(gs.ghostsEatenCombo, 3)];
              gs.score += bonus;
              gs.ghostsEatenCombo++;
              sfx.eatGhostSound();
            } else if (!ghost.eaten) {
              // Pac-Man dies
              gs.lives--;
              sfx.deathSound();

              if (gs.lives <= 0) {
                // Game over
                phaseRef.current = 'ended';
                setPhase('ended');
                sfx.gameOverSound();
                scoreDisplayRef.current = gs.score;

                // Save stats
                if (!savedRef.current) {
                  savedRef.current = true;
                  const stats = loadStats();
                  const updated = updateStats(stats, gs.score, gs.level);
                  saveStats(updated);
                  setBestScore(updated.bestScore);
                  pb.submit(gs.score, { level: gs.level });
                }
              } else {
                // Reset positions
                gs.pacman = { ...PACMAN_START };
                gs.pacDir = 'left';
                gs.nextDir = 'left';
                gs.ghosts = createGhosts();
                gs.powerTimer = 0;
                gs.ghostsEatenCombo = 0;
                moveAccRef.current = 0;
                ghostMoveAccRef.current = 0;
              }
              break;
            }
          }
        }

        scoreDisplayRef.current = gs.score;

        // Update React HUD state when values change
        setHudScore(prev => prev !== gs.score ? gs.score : prev);
        setHudLevel(prev => prev !== gs.level ? gs.level : prev);
        setHudLives(prev => prev !== gs.lives ? gs.lives : prev);
      }

      // Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawGame(ctx, gs, animFrameRef.current);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    }

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restart ─────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setPhase('menu');
  }, []);

  // ── Difficulty i18n keys ────────────────────────────────────────────────────
  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
  const diffKeys: Record<Difficulty, string> = {
    easy: 'pacman.easy',
    medium: 'pacman.medium',
    hard: 'pacman.hard',
  };

  // ── Menu screen ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="relative w-full flex-1 min-h-0">
        <div className="flex flex-col items-center gap-3 py-2 px-4 flex-1 min-w-0">
          {/* Header */}
          <div className="w-full max-w-[440px] flex items-center gap-3">
            <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">Pac-Man</span>
            <ScoreBox label={t('game.best')} value={bestScore} />
          </div>

          {/* Config card */}
          <div className="w-full max-w-[440px] rounded-xl bg-zinc-800 border border-zinc-700/60 shadow-lg shadow-black/30 p-6 flex flex-col gap-6">
            {/* Difficulty */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{t('pacman.difficulty')}</span>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      difficulty === d
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {t(diffKeys[d])}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls info */}
            <p className="text-xs text-zinc-500 text-center">{t('pacman.controls')}</p>

            {/* Start button */}
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-zinc-900 text-lg font-bold transition-colors"
            >
              {t('pacman.start')}
            </button>
          </div>

          {/* Scoreboard — mobile/tablet only */}
          <div className="lg:hidden">
            <ScoreboardPanel
              gameId="pacman"
              scores={pb.scores}
              lastInsertId={pb.lastInsertId}
              isNewBest={pb.isNewBest}
              onClear={pb.clear}
            />
          </div>
        </div>

        <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
          <div className="flex flex-col gap-3">
            <ScoreboardPanel
              gameId="pacman"
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

  // ── Game screen ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full flex-1 min-h-0">
      <div className="flex flex-col items-center gap-3 py-2 px-4 flex-1 min-w-0">
        {/* Header */}
        <div className="w-full max-w-[440px] flex items-center gap-3">
          <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">Pac-Man</span>
          <ScoreBox label={t('pacman.score')} value={hudScore} />
          <ScoreBox label={t('pacman.level')} value={hudLevel} />
          <ScoreBox label={t('pacman.lives')} value={hudLives} />
          <button
            onClick={handleRestart}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
          >
            {t('game.new')}
          </button>
        </div>

        {/* Canvas container */}
        <div className="relative touch-none" {...swipeHandlers}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-xl border border-zinc-700/60 shadow-lg shadow-black/30"
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Countdown overlay */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/75 flex items-center justify-center z-20 backdrop-blur-[1px]">
              <span
                key={cdNum}
                className={`font-black select-none ${
                  cdNum === 0 ? 'text-5xl text-emerald-400' : 'text-7xl text-zinc-100'
                }`}
              >
                {cdNum === 0 ? t('game.go') : cdNum}
              </span>
            </div>
          )}

          {/* Pause overlay */}
          {phase === 'paused' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/80 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
              <p className="text-2xl font-black text-zinc-100">{t('game.paused')}</p>
              <p className="text-sm text-zinc-500">{t('pacman.controls')}</p>
              <button
                onClick={togglePause}
                className="mt-1 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Game over overlay */}
          {phase === 'ended' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/85 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
              <p className="text-2xl font-black text-zinc-100">{t('game.over')}</p>
              <p className="text-sm text-zinc-400">{t('pacman.score')}: {hudScore}</p>
              <p className="text-sm text-zinc-500">{t('pacman.level')}: {hudLevel}</p>
              <button
                onClick={handleRestart}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                {t('game.playAgain')}
              </button>
            </div>
          )}
        </div>

        {/* Mobile touch controls */}
        <TouchControls
          layout="dpad"
          disabled={phase !== 'playing'}
          extraButtons={[{ label: phase === 'paused' ? t('game.resume') : t('game.paused'), onPress: togglePause }]}
        />

        {/* Controls hint */}
        <p className="text-xs text-zinc-600 text-center max-w-[320px] max-sm:hidden">
          {t('pacman.controls')}
        </p>

        {/* Scoreboard — mobile/tablet only */}
        <div className="lg:hidden">
          <ScoreboardPanel
            gameId="pacman"
            scores={pb.scores}
            lastInsertId={pb.lastInsertId}
            isNewBest={pb.isNewBest}
            onClear={pb.clear}
          />
        </div>
      </div>

      <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
        <div className="flex flex-col gap-3">
          <ScoreboardPanel
            gameId="pacman"
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

// ── Sub-components ───────────────────────────────────────────────────────────

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center min-w-[52px] px-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
      <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase leading-none mb-0.5">
        {label}
      </span>
      <span className="text-lg font-black text-zinc-100 tabular-nums leading-tight">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
