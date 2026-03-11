'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { loadStats, saveStats, updateStats } from './stats';
import type { BreakoutStats } from './stats';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const W = 800;
const H = 600;
const PADDLE_H = 14;
const PADDLE_R = 7;
const PADDLE_Y = H - 40;
const BALL_R = 7;
const COLS = 10;
const ROWS = 8;
const BRICK_GAP = 4;
const BRICK_TOP = 60;
const TRAIL_LENGTH = 8;
const MAX_PARTICLES = 60;
const PLAYER_SPEED = 7;

const BRICK_W = (W - (COLS + 1) * BRICK_GAP) / COLS;
const BRICK_H = 20;

const ROW_COLORS = ['#ef4444', '#f97316', '#eab308', '#a3e635', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

type Phase = 'menu' | 'playing' | 'paused' | 'level_transition' | 'ended';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameMode = 'classic' | 'random' | 'endless';

interface DiffConfig {
  ballSpeed: number;
  paddleW: number;
  lives: number;
  speedInc: number;
}

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { ballSpeed: 4.0, paddleW: 130, lives: 4, speedInc: 0.15 },
  medium: { ballSpeed: 5.0, paddleW: 100, lives: 3, speedInc: 0.25 },
  hard:   { ballSpeed: 6.0, paddleW: 80,  lives: 2, speedInc: 0.35 },
};

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' ', 'p', 'P', 'Escape']);

const LEVEL_TRANSITION_MS = 1800;

// ── Powerup system ──────────────────────────────────────────────────────────

type PowerupKind = 'expand' | 'slow' | 'multi' | 'life';

const POWERUP_DROP_CHANCE = 0.13;
const POWERUP_SIZE = 14;
const POWERUP_FALL_SPEED = 2;
const MAX_EXTRA_BALLS = 6;
const COMBO_MAX = 10;

const POWERUP_DEFS: Record<PowerupKind, { icon: string; color: string; glow: string }> = {
  expand: { icon: '⇔',  color: '#818cf8', glow: '#6366f1' },
  slow:   { icon: '⏳', color: '#22d3ee', glow: '#06b6d4' },
  multi:  { icon: '⊕',  color: '#f59e0b', glow: '#d97706' },
  life:   { icon: '♥',  color: '#f43f5e', glow: '#e11d48' },
};

const POWERUP_KINDS: PowerupKind[] = ['expand', 'slow', 'multi', 'life'];
const POWERUP_WEIGHTS: number[] = [35, 30, 25, 10]; // weighted random

function randomPowerupKind(): PowerupKind {
  const total = POWERUP_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < POWERUP_KINDS.length; i++) {
    r -= POWERUP_WEIGHTS[i];
    if (r <= 0) return POWERUP_KINDS[i];
  }
  return 'expand';
}

interface FallingPowerup {
  x: number; y: number;
  kind: PowerupKind;
  pulse: number; // animation counter
}

interface ActiveEffect {
  kind: 'expand' | 'slow';
  remaining: number; // seconds left
  duration: number;   // total duration
}

interface FloatingText {
  x: number; y: number;
  text: string;
  color: string;
  age: number; // 0..1
}

// ── Extra ball for multi-ball ────────────────────────────────────────────────

interface ExtraBall {
  x: number; y: number;
  vx: number; vy: number;
}

// ── Combo system ────────────────────────────────────────────────────────────

interface ComboState {
  count: number;
  displayAge: number; // 0..1, for fade out
  lastX: number;
  lastY: number;
}

// ── Level patterns ───────────────────────────────────────────────────────────

type PatternFn = (rows: number, cols: number) => boolean[][];

const PATTERNS: { name: string; fn: PatternFn }[] = [
  {
    name: 'full',
    fn: (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(true) as boolean[]),
  },
  {
    name: 'pyramid',
    fn: (rows, cols) => {
      const grid: boolean[][] = [];
      for (let r = 0; r < rows; r++) {
        const width = Math.min(cols, Math.round(cols * ((r + 1) / rows)));
        const start = Math.floor((cols - width) / 2);
        const row = Array(cols).fill(false) as boolean[];
        for (let c = start; c < start + width; c++) row[c] = true;
        grid.push(row);
      }
      return grid;
    },
  },
  {
    name: 'diamond',
    fn: (rows, cols) => {
      const grid: boolean[][] = [];
      const mid = (rows - 1) / 2;
      for (let r = 0; r < rows; r++) {
        const dist = Math.abs(r - mid) / mid;
        const width = Math.max(2, Math.round(cols * (1 - dist)));
        const start = Math.floor((cols - width) / 2);
        const row = Array(cols).fill(false) as boolean[];
        for (let c = start; c < start + width; c++) row[c] = true;
        grid.push(row);
      }
      return grid;
    },
  },
  {
    name: 'checkerboard',
    fn: (rows, cols) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (r + c) % 2 === 0),
      ),
  },
  {
    name: 'tunnel',
    fn: (rows, cols) =>
      Array.from({ length: rows }, () => {
        const row = Array(cols).fill(true) as boolean[];
        const gap = Math.floor(cols / 3);
        const start = Math.floor((cols - gap) / 2);
        for (let c = start; c < start + gap; c++) row[c] = false;
        return row;
      }),
  },
  {
    name: 'frame',
    fn: (rows, cols) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
          r === 0 || r === rows - 1 || c === 0 || c === cols - 1,
        ),
      ),
  },
  {
    name: 'wave',
    fn: (rows, cols) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const wave = Math.sin((c / cols) * Math.PI * 2 + r * 0.8);
          return wave > -0.3;
        }),
      ),
  },
  {
    name: 'cross',
    fn: (rows, cols) => {
      const midR = Math.floor(rows / 2);
      const midC = Math.floor(cols / 2);
      return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
          Math.abs(r - midR) <= 1 || Math.abs(c - midC) <= 1,
        ),
      );
    },
  },
  {
    name: 'zigzag',
    fn: (rows, cols) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const shift = (r % 2 === 0) ? 0 : 2;
          return (c + shift) % 4 < 3;
        }),
      ),
  },
  {
    name: 'stripes',
    fn: (rows, cols) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, () => r % 2 === 0),
      ),
  },
];

const CLASSIC_ORDER = [0, 3, 1, 6, 4, 2, 8, 5, 7, 9];

// ── Run objectives ──────────────────────────────────────────────────────────

type ObjectiveKind =
  | 'bricks'      // Destroy N bricks
  | 'score'       // Reach N score
  | 'combo'       // Reach combo x N
  | 'powerups'    // Catch N powerups
  | 'no_life'     // Clear a level without losing a life
  | 'boss'        // Beat a boss level
  | 'hard_win';   // Win on hard difficulty

interface ObjectiveDef {
  kind: ObjectiveKind;
  target: number;       // target value (0 for boolean objectives)
  i18nKey: string;      // i18n key suffix for description
  i18nVal?: number;     // value to display in description
  bonus: number;        // bonus points on completion
}

interface RunObjective extends ObjectiveDef {
  progress: number;
  done: boolean;
  justCompleted: number; // animation timer (0 = none, >0 = glow)
}

function buildObjectivePool(diff: Difficulty, mode: GameMode): ObjectiveDef[] {
  const pool: ObjectiveDef[] = [
    { kind: 'bricks',   target: 30,  i18nKey: 'bricks',   i18nVal: 30,  bonus: 200 },
    { kind: 'bricks',   target: 60,  i18nKey: 'bricks',   i18nVal: 60,  bonus: 400 },
    { kind: 'bricks',   target: 100, i18nKey: 'bricks',   i18nVal: 100, bonus: 600 },
    { kind: 'score',    target: 500, i18nKey: 'score',     i18nVal: 500, bonus: 300 },
    { kind: 'score',    target: 1500,i18nKey: 'score',     i18nVal: 1500,bonus: 500 },
    { kind: 'combo',    target: 5,   i18nKey: 'combo',     i18nVal: 5,   bonus: 300 },
    { kind: 'combo',    target: 8,   i18nKey: 'combo',     i18nVal: 8,   bonus: 500 },
    { kind: 'powerups', target: 3,   i18nKey: 'powerups',  i18nVal: 3,   bonus: 250 },
    { kind: 'powerups', target: 6,   i18nKey: 'powerups',  i18nVal: 6,   bonus: 450 },
    { kind: 'no_life',  target: 0,   i18nKey: 'noLife',    bonus: 400 },
  ];

  // Boss objective only if mode allows enough levels
  if (mode !== 'classic' || CLASSIC_ORDER.length >= 5) {
    pool.push({ kind: 'boss', target: 0, i18nKey: 'boss', bonus: 500 });
  }

  // Hard-win only on hard difficulty
  if (diff === 'hard') {
    pool.push({ kind: 'hard_win', target: 0, i18nKey: 'hardWin', bonus: 800 });
  }

  return pool;
}

function pickObjectives(diff: Difficulty, mode: GameMode): RunObjective[] {
  const pool = buildObjectivePool(diff, mode);
  // Pick 2 unique objectives by kind
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const picked: RunObjective[] = [];
  const usedKinds = new Set<ObjectiveKind>();
  for (const def of shuffled) {
    if (usedKinds.has(def.kind)) continue;
    usedKinds.add(def.kind);
    picked.push({ ...def, progress: 0, done: false, justCompleted: 0 });
    if (picked.length >= 2) break;
  }
  return picked;
}

// ── FX types ─────────────────────────────────────────────────────────────────

interface TrailPoint { x: number; y: number }

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  r: number;
  color: string;
}

// ── Brick builder ────────────────────────────────────────────────────────────

interface Brick {
  x: number; y: number; w: number; h: number;
  color: string; alive: boolean;
  hp: number;     // hits remaining (1 = normal, 2-3 = boss)
  maxHp: number;  // original hp for crack rendering
  boss: boolean;  // is this a boss brick?
}

function isBossLevel(levelIdx: number): boolean {
  // Every 5th level (0-indexed: 4, 9, 14, ...) is a boss level
  return (levelIdx + 1) % 5 === 0;
}

function buildBricks(patternIndex: number, levelIdx: number): Brick[] {
  const pat = PATTERNS[patternIndex % PATTERNS.length];
  const grid = pat.fn(ROWS, COLS);
  const boss = isBossLevel(levelIdx);
  const bricks: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r]?.[c]) {
        // Boss levels: inner bricks get extra hp
        let hp = 1;
        if (boss) {
          const isEdge = r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
          hp = isEdge ? 2 : 3;
        }
        bricks.push({
          x: BRICK_GAP + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true,
          hp,
          maxHp: hp,
          boss: hp > 1,
        });
      }
    }
  }
  return bricks;
}

function getPatternForLevel(level: number, mode: GameMode): number {
  if (mode === 'classic') {
    return CLASSIC_ORDER[level % CLASSIC_ORDER.length];
  }
  if (mode === 'random' || mode === 'endless') {
    return Math.floor(Math.random() * PATTERNS.length);
  }
  return level % PATTERNS.length;
}

function getTotalClassicLevels(): number {
  return CLASSIC_ORDER.length;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BreakoutGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('breakout');
  const pb = usePersonalScores('breakout', user ? { userId: user.id, nickname } : undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [winner, setWinner] = useState<'player' | 'none' | null>(null);
  const [stats, setStats] = useState<BreakoutStats | null>(null);
  const [muted, setMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameMode, setGameMode] = useState<GameMode>('classic');

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const diffRef = useRef(difficulty);
  diffRef.current = difficulty;
  const modeRef = useRef(gameMode);
  modeRef.current = gameMode;
  const savedRef = useRef(false);

  // Visual FX state
  const trailRef = useRef<TrailPoint[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scorePulseRef = useRef(0);
  const transitionRef = useRef({ timer: 0, nextLevel: 0 });

  // Powerup state
  const powerupsRef = useRef<FallingPowerup[]>([]);
  const effectsRef = useRef<ActiveEffect[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const extraBallsRef = useRef<ExtraBall[]>([]);

  // Combo state
  const comboRef = useRef<ComboState>({ count: 0, displayAge: 0, lastX: 0, lastY: 0 });

  // Objectives state
  const objectivesRef = useRef<RunObjective[]>([]);
  const objTrackRef = useRef({ powerupsCaught: 0, livesLostThisLevel: 0, bossBeaten: false, peakCombo: 0 });

  // Load stats + mute state
  useEffect(() => {
    setStats(loadStats());
    setMuted(sfx.isMuted());
  }, []);

  // Game state refs
  const gameRef = useRef({
    paddleX: W / 2 - 50,
    paddleW: 100,
    basePaddleW: 100, // original paddle width (before expand)
    ballX: W / 2,
    ballY: PADDLE_Y - BALL_R - 1,
    ballVX: 5 * 0.7,
    ballVY: -5 * 0.7,
    ballSpeed: 5,
    baseBallSpeed: 5, // original ball speed (before slow)
    bricks: [] as Brick[],
    lives: 3,
    score: 0,
    level: 0,
    bricksDestroyed: 0,
    launched: false,
  });

  const keysRef = useRef(new Set<string>());
  const mouseXRef = useRef(W / 2);
  const useMouseRef = useRef(false);

  function spawnParticles(x: number, y: number, color: string, count: number) {
    const particles = particlesRef.current;
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.4 + Math.random() * 0.4,
        r: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function addFloatingText(x: number, y: number, text: string, color: string) {
    floatingTextsRef.current.push({ x, y, text, color, age: 0 });
  }

  function checkObjectives(g: typeof gameRef.current) {
    const objs = objectivesRef.current;
    const track = objTrackRef.current;
    for (const obj of objs) {
      if (obj.done) continue;
      let current = 0;
      let completed = false;
      switch (obj.kind) {
        case 'bricks':   current = g.bricksDestroyed; completed = current >= obj.target; break;
        case 'score':    current = g.score; completed = current >= obj.target; break;
        case 'combo':    current = track.peakCombo; completed = current >= obj.target; break;
        case 'powerups': current = track.powerupsCaught; completed = current >= obj.target; break;
        case 'no_life':  completed = track.livesLostThisLevel === 0 && g.launched && g.bricks.every((b) => !b.alive); break;
        case 'boss':     completed = track.bossBeaten; break;
        case 'hard_win': break; // checked at end
      }
      obj.progress = obj.target > 0 ? current : (completed ? 1 : 0);
      if (completed && !obj.done) {
        obj.done = true;
        obj.justCompleted = 1;
        g.score += obj.bonus;
        setScore(g.score);
        addFloatingText(W - 100, 80, `+${obj.bonus}`, '#fbbf24');
      }
    }
  }

  function resetBall(g: typeof gameRef.current) {
    g.ballX = g.paddleX + g.paddleW / 2;
    g.ballY = PADDLE_Y - BALL_R - 1;
    const spd = g.ballSpeed;
    g.ballVX = spd * (Math.random() > 0.5 ? 0.7 : -0.7);
    g.ballVY = -spd * 0.7;
    g.launched = false;
  }

  // ── Apply / remove powerup effects ─────────────────────────────────────────

  function applyPowerup(kind: PowerupKind, g: typeof gameRef.current) {
    sfx.powerupCollect();
    objTrackRef.current.powerupsCaught++;

    if (kind === 'expand') {
      // Remove existing expand effect and restart timer
      effectsRef.current = effectsRef.current.filter((e) => e.kind !== 'expand');
      g.paddleW = Math.round(g.basePaddleW * 1.3);
      effectsRef.current.push({ kind: 'expand', remaining: 10, duration: 10 });
    } else if (kind === 'slow') {
      effectsRef.current = effectsRef.current.filter((e) => e.kind !== 'slow');
      g.ballSpeed = g.baseBallSpeed * 0.75;
      // Rescale current velocity
      const cur = Math.sqrt(g.ballVX * g.ballVX + g.ballVY * g.ballVY);
      if (cur > 0) {
        const factor = g.ballSpeed / cur;
        g.ballVX *= factor;
        g.ballVY *= factor;
      }
      // Also slow extra balls
      for (const eb of extraBallsRef.current) {
        const ecur = Math.sqrt(eb.vx * eb.vx + eb.vy * eb.vy);
        if (ecur > 0) {
          const ef = g.ballSpeed / ecur;
          eb.vx *= ef;
          eb.vy *= ef;
        }
      }
      effectsRef.current.push({ kind: 'slow', remaining: 8, duration: 8 });
    } else if (kind === 'multi') {
      if (extraBallsRef.current.length < MAX_EXTRA_BALLS) {
        const spd = g.ballSpeed;
        for (let i = 0; i < 2; i++) {
          if (extraBallsRef.current.length >= MAX_EXTRA_BALLS) break;
          const angle = (Math.random() - 0.5) * Math.PI * 0.5;
          extraBallsRef.current.push({
            x: g.ballX,
            y: g.ballY,
            vx: Math.sin(angle) * spd * (i === 0 ? 1 : -1),
            vy: -Math.abs(Math.cos(angle) * spd),
          });
        }
      }
    } else if (kind === 'life') {
      g.lives++;
      setLives(g.lives);
      sfx.extraLife();
      addFloatingText(g.paddleX + g.paddleW / 2, PADDLE_Y - 20, '+1', '#f43f5e');
    }
  }

  function tickEffects(dtSec: number, g: typeof gameRef.current) {
    const effects = effectsRef.current;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].remaining -= dtSec;
      if (effects[i].remaining <= 0) {
        const kind = effects[i].kind;
        effects.splice(i, 1);
        if (kind === 'expand') {
          g.paddleW = g.basePaddleW;
          // Clamp paddle position
          g.paddleX = Math.min(g.paddleX, W - g.paddleW);
        } else if (kind === 'slow') {
          g.ballSpeed = g.baseBallSpeed;
          // Rescale velocity back
          const cur = Math.sqrt(g.ballVX * g.ballVX + g.ballVY * g.ballVY);
          if (cur > 0) {
            const factor = g.ballSpeed / cur;
            g.ballVX *= factor;
            g.ballVY *= factor;
          }
          for (const eb of extraBallsRef.current) {
            const ecur = Math.sqrt(eb.vx * eb.vx + eb.vy * eb.vy);
            if (ecur > 0) {
              const ef = g.ballSpeed / ecur;
              eb.vx *= ef;
              eb.vy *= ef;
            }
          }
        }
      }
    }
  }

  function clearPowerupState(g: typeof gameRef.current) {
    powerupsRef.current = [];
    effectsRef.current = [];
    floatingTextsRef.current = [];
    extraBallsRef.current = [];
    g.paddleW = g.basePaddleW;
    g.ballSpeed = g.baseBallSpeed;
  }

  // ── Start / restart ─────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const diff = DIFF_CONFIG[diffRef.current];
    const g = gameRef.current;
    g.basePaddleW = diff.paddleW;
    g.paddleW = diff.paddleW;
    g.paddleX = W / 2 - diff.paddleW / 2;
    g.baseBallSpeed = diff.ballSpeed;
    g.ballSpeed = diff.ballSpeed;
    g.level = 0;
    g.bricks = buildBricks(getPatternForLevel(0, modeRef.current), 0);
    g.lives = diff.lives;
    g.score = 0;
    g.bricksDestroyed = 0;
    resetBall(g);

    trailRef.current = [];
    particlesRef.current = [];
    scorePulseRef.current = 0;
    transitionRef.current = { timer: 0, nextLevel: 0 };
    comboRef.current = { count: 0, displayAge: 0, lastX: 0, lastY: 0 };
    clearPowerupState(g);
    savedRef.current = false;
    objectivesRef.current = pickObjectives(diffRef.current, modeRef.current);
    objTrackRef.current = { powerupsCaught: 0, livesLostThisLevel: 0, bossBeaten: false, peakCombo: 0 };

    setScore(0);
    setLives(diff.lives);
    setLevel(1);
    setWinner(null);
    setPhase('playing');
  }, []);

  // ── Level advance ───────────────────────────────────────────────────────────

  function advanceLevel(g: typeof gameRef.current) {
    const nextLevelIdx = g.level + 1;
    const diff = DIFF_CONFIG[diffRef.current];
    const mode = modeRef.current;

    if (mode === 'classic' && nextLevelIdx >= getTotalClassicLevels()) {
      setWinner('player');
      setPhase('ended');
      saveResult(true);
      return;
    }

    transitionRef.current = { timer: LEVEL_TRANSITION_MS, nextLevel: nextLevelIdx };
    sfx.levelUp();
    setPhase('level_transition');

    setTimeout(() => {
      g.level = nextLevelIdx;
      g.baseBallSpeed = diff.ballSpeed + nextLevelIdx * diff.speedInc;
      g.ballSpeed = g.baseBallSpeed;
      g.bricks = buildBricks(getPatternForLevel(nextLevelIdx, mode), nextLevelIdx);
      clearPowerupState(g);
      resetBall(g);
      trailRef.current = [];
      comboRef.current = { count: 0, displayAge: 0, lastX: 0, lastY: 0 };

      setLevel(nextLevelIdx + 1);
      setPhase('playing');
    }, LEVEL_TRANSITION_MS);
  }

  // ── Toggle pause ────────────────────────────────────────────────────────────

  const togglePause = useCallback(() => {
    setPhase((p) => {
      if (p === 'playing') return 'paused';
      if (p === 'paused') return 'playing';
      return p;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sfx.setMuted(next);
      return next;
    });
  }, []);

  // ── Save result ─────────────────────────────────────────────────────────────

  const saveResult = useCallback((won: boolean) => {
    if (savedRef.current) return;
    savedRef.current = true;
    const g = gameRef.current;

    // Check hard_win objective
    if (won && diffRef.current === 'hard') {
      for (const obj of objectivesRef.current) {
        if (obj.kind === 'hard_win' && !obj.done) {
          obj.done = true;
          obj.progress = 1;
          obj.justCompleted = 1;
          g.score += obj.bonus;
          setScore(g.score);
        }
      }
    }

    setStats((prev) => {
      const base = prev ?? { games: 0, wins: 0, losses: 0, bestScore: 0, bestLevel: 0, totalBricks: 0 };
      const next = updateStats(base, won, g.score, g.level + 1, g.bricksDestroyed);
      saveStats(next);
      return next;
    });
    ach.trackPlay();
    if (won) { ach.trackWin(); sfx.winSound(); } else { sfx.loseSound(); }
    pb.submit(g.score, { level: g.level + 1 });
  }, [ach]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!GAME_KEYS.has(e.key)) return;
      e.preventDefault();
      keysRef.current.add(e.key);
      useMouseRef.current = false;

      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (phaseRef.current === 'playing' || phaseRef.current === 'paused')) {
        togglePause();
      }
      if (e.key === ' ' && phaseRef.current === 'playing') {
        gameRef.current.launched = true;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [togglePause]);

  // ── Mouse / touch ───────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseXRef.current = ((e.clientX - rect.left) / rect.width) * W;
      useMouseRef.current = true;
    }
    function onClick() {
      if (phaseRef.current === 'playing') {
        gameRef.current.launched = true;
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      mouseXRef.current = ((e.touches[0].clientX - rect.left) / rect.width) * W;
      useMouseRef.current = true;
      // Tap to launch ball
      if (phaseRef.current === 'playing') {
        gameRef.current.launched = true;
      }
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      mouseXRef.current = ((e.touches[0].clientX - rect.left) / rect.width) * W;
      useMouseRef.current = true;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // ── Brick collision helper (shared between main ball & extra balls) ────────

  function collideBricks(
    bx: number, by: number,
    g: typeof gameRef.current,
    reflectMainBall: boolean,
  ): { hit: boolean; hitX: number; hitY: number } {
    for (const brick of g.bricks) {
      if (!brick.alive) continue;

      const closestX = Math.max(brick.x, Math.min(bx, brick.x + brick.w));
      const closestY = Math.max(brick.y, Math.min(by, brick.y + brick.h));
      const ddx = bx - closestX;
      const ddy = by - closestY;

      if (ddx * ddx + ddy * ddy <= BALL_R * BALL_R) {
        brick.hp--;

        if (brick.hp <= 0) {
          brick.alive = false;
          g.bricksDestroyed++;

          // Combo: increment
          const combo = comboRef.current;
          combo.count = Math.min(combo.count + 1, COMBO_MAX);
          combo.displayAge = 0;
          combo.lastX = closestX;
          combo.lastY = closestY;

          const multiplier = combo.count;
          const base = 10 + g.level * 2;
          const points = base * multiplier;
          g.score += points;
          setScore(g.score);
          scorePulseRef.current = 1;

          // Track peak combo for objectives
          if (combo.count > objTrackRef.current.peakCombo) {
            objTrackRef.current.peakCombo = combo.count;
          }
          checkObjectives(g);

          sfx.brickHit();
          spawnParticles(closestX, closestY, brick.color, 6);

          // Maybe spawn powerup
          if (Math.random() < POWERUP_DROP_CHANCE) {
            powerupsRef.current.push({
              x: brick.x + brick.w / 2,
              y: brick.y + brick.h / 2,
              kind: randomPowerupKind(),
              pulse: 0,
            });
          }
        } else {
          // Boss brick damaged
          if (brick.hp === 1) sfx.bossCrack(); else sfx.bossHit();
          spawnParticles(closestX, closestY, 'rgba(255,255,255,0.6)', 3);
        }

        if (reflectMainBall) {
          const overlapLeft = (bx + BALL_R) - brick.x;
          const overlapRight = (brick.x + brick.w) - (bx - BALL_R);
          const overlapTop = (by + BALL_R) - brick.y;
          const overlapBottom = (brick.y + brick.h) - (by - BALL_R);
          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            g.ballVX = -g.ballVX;
          } else {
            g.ballVY = -g.ballVY;
          }
        }

        return { hit: true, hitX: closestX, hitY: closestY };
      }
    }
    return { hit: false, hitX: 0, hitY: 0 };
  }

  // ── Game loop ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d')!;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    let lastTime = 0;

    function frame(time: number) {
      rafRef.current = requestAnimationFrame(frame);
      const dt = lastTime ? Math.min((time - lastTime) / 16.667, 2) : 1;
      const dtSec = dt * 16.667 / 1000;
      lastTime = time;

      const g = gameRef.current;
      const currentPhase = phaseRef.current;
      const pw = g.paddleW;

      // ── Update ─────────────────────────────────────────────────────────

      if (currentPhase === 'playing') {
        // Tick powerup effect timers
        tickEffects(dtSec, g);

        // Paddle movement
        if (useMouseRef.current) {
          g.paddleX = Math.max(0, Math.min(W - pw, mouseXRef.current - pw / 2));
        } else {
          const keys = keysRef.current;
          if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
            g.paddleX = Math.max(0, g.paddleX - PLAYER_SPEED * dt);
          }
          if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
            g.paddleX = Math.min(W - pw, g.paddleX + PLAYER_SPEED * dt);
          }
        }

        // Ball sticks to paddle before launch
        if (!g.launched) {
          g.ballX = g.paddleX + pw / 2;
          g.ballY = PADDLE_Y - BALL_R - 1;
        } else {
          // Move main ball
          g.ballX += g.ballVX * dt;
          g.ballY += g.ballVY * dt;

          // Wall collisions
          if (g.ballX - BALL_R <= 0) {
            g.ballX = BALL_R;
            g.ballVX = Math.abs(g.ballVX);
            sfx.wallHit();
          } else if (g.ballX + BALL_R >= W) {
            g.ballX = W - BALL_R;
            g.ballVX = -Math.abs(g.ballVX);
            sfx.wallHit();
          }
          if (g.ballY - BALL_R <= 0) {
            g.ballY = BALL_R;
            g.ballVY = Math.abs(g.ballVY);
            sfx.wallHit();
          }

          // Paddle collision (main ball)
          if (
            g.ballVY > 0 &&
            g.ballY + BALL_R >= PADDLE_Y &&
            g.ballY + BALL_R <= PADDLE_Y + PADDLE_H &&
            g.ballX >= g.paddleX - BALL_R &&
            g.ballX <= g.paddleX + pw + BALL_R
          ) {
            g.ballY = PADDLE_Y - BALL_R;
            const hitPos = (g.ballX - g.paddleX) / pw;
            const angle = (hitPos - 0.5) * Math.PI * 0.7;
            const speed = Math.sqrt(g.ballVX * g.ballVX + g.ballVY * g.ballVY);
            g.ballVX = Math.sin(angle) * speed;
            g.ballVY = -Math.cos(angle) * speed;
            sfx.paddleHit();
            spawnParticles(g.ballX, PADDLE_Y, '#818cf8', 4);

            // Combo resets on paddle hit
            comboRef.current.count = 0;
          }

          // Brick collision (main ball)
          collideBricks(g.ballX, g.ballY, g, true);

          // Ball falls below
          if (g.ballY - BALL_R > H) {
            // If extra balls exist, just lose main ball and promote one
            if (extraBallsRef.current.length > 0) {
              const promoted = extraBallsRef.current.shift()!;
              g.ballX = promoted.x;
              g.ballY = promoted.y;
              g.ballVX = promoted.vx;
              g.ballVY = promoted.vy;
            } else {
              g.lives--;
              setLives(g.lives);
              sfx.loseLife();
              comboRef.current.count = 0;
              objTrackRef.current.livesLostThisLevel++;

              if (g.lives <= 0) {
                setWinner('none');
                setPhase('ended');
                saveResult(false);
              } else {
                resetBall(g);
              }
            }
          }

          // ── Extra balls update ──────────────────────────────────────────
          const extras = extraBallsRef.current;
          for (let i = extras.length - 1; i >= 0; i--) {
            const eb = extras[i];
            eb.x += eb.vx * dt;
            eb.y += eb.vy * dt;

            // Wall collisions
            if (eb.x - BALL_R <= 0) { eb.x = BALL_R; eb.vx = Math.abs(eb.vx); }
            else if (eb.x + BALL_R >= W) { eb.x = W - BALL_R; eb.vx = -Math.abs(eb.vx); }
            if (eb.y - BALL_R <= 0) { eb.y = BALL_R; eb.vy = Math.abs(eb.vy); }

            // Paddle collision
            if (
              eb.vy > 0 &&
              eb.y + BALL_R >= PADDLE_Y &&
              eb.y + BALL_R <= PADDLE_Y + PADDLE_H &&
              eb.x >= g.paddleX - BALL_R &&
              eb.x <= g.paddleX + pw + BALL_R
            ) {
              eb.y = PADDLE_Y - BALL_R;
              const hitPos = (eb.x - g.paddleX) / pw;
              const angle = (hitPos - 0.5) * Math.PI * 0.7;
              const speed = Math.sqrt(eb.vx * eb.vx + eb.vy * eb.vy);
              eb.vx = Math.sin(angle) * speed;
              eb.vy = -Math.cos(angle) * speed;
            }

            // Brick collision (extra ball) — reflect by simple negate
            const result = collideBricks(eb.x, eb.y, g, false);
            if (result.hit) {
              // Simple reflection for extra balls
              eb.vy = -eb.vy;
            }

            // Falls below → remove
            if (eb.y - BALL_R > H) {
              extras.splice(i, 1);
            }
          }

          // Level clear check
          if (g.bricks.every((b) => !b.alive)) {
            // Track boss beat + no-life objective before advancing
            if (isBossLevel(g.level)) objTrackRef.current.bossBeaten = true;
            checkObjectives(g);
            objTrackRef.current.livesLostThisLevel = 0; // reset for next level
            advanceLevel(g);
          }
        }

        // ── Falling powerups update ────────────────────────────────────────
        const pups = powerupsRef.current;
        for (let i = pups.length - 1; i >= 0; i--) {
          const pu = pups[i];
          pu.y += POWERUP_FALL_SPEED * dt;
          pu.pulse += dtSec * 3;

          // Paddle catch
          if (
            pu.y + POWERUP_SIZE >= PADDLE_Y &&
            pu.y - POWERUP_SIZE <= PADDLE_Y + PADDLE_H &&
            pu.x >= g.paddleX - POWERUP_SIZE &&
            pu.x <= g.paddleX + pw + POWERUP_SIZE
          ) {
            applyPowerup(pu.kind, g);
            spawnParticles(pu.x, pu.y, POWERUP_DEFS[pu.kind].color, 8);
            pups.splice(i, 1);
            checkObjectives(g);
            continue;
          }

          // Falls below
          if (pu.y > H + POWERUP_SIZE) {
            pups.splice(i, 1);
          }
        }

        // Trail (main ball only)
        const trail = trailRef.current;
        if (g.launched) {
          trail.push({ x: g.ballX, y: g.ballY });
          if (trail.length > TRAIL_LENGTH) trail.shift();
        }
      }

      // Update particles (always)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt / (p.maxLife * 60);
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Update floating texts
      const fts = floatingTextsRef.current;
      for (let i = fts.length - 1; i >= 0; i--) {
        fts[i].age += dtSec;
        fts[i].y -= 1.2 * dt;
        if (fts[i].age > 1.2) fts.splice(i, 1);
      }

      // Combo display age
      const combo = comboRef.current;
      if (combo.count > 0 && combo.displayAge < 1) {
        combo.displayAge += dtSec * 0.8;
      }

      if (scorePulseRef.current > 0) {
        scorePulseRef.current = Math.max(0, scorePulseRef.current - 0.03 * dt);
      }

      // ── Draw ───────────────────────────────────────────────────────────

      // Background
      c.fillStyle = '#0f0f1a';
      c.fillRect(0, 0, W, H);

      const vg = c.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.7);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.4)');
      c.fillStyle = vg;
      c.fillRect(0, 0, W, H);

      // Bricks
      for (const brick of g.bricks) {
        if (!brick.alive) continue;

        // Boss bricks: darken based on hp remaining
        if (brick.boss && brick.maxHp > 1) {
          const hpRatio = brick.hp / brick.maxHp;
          // Darken the color for higher hp
          c.fillStyle = brick.color;
          c.globalAlpha = 0.5 + hpRatio * 0.5;
          c.beginPath();
          c.roundRect(brick.x, brick.y, brick.w, brick.h, 3);
          c.fill();
          c.globalAlpha = 1;

          // Thicker border for boss bricks
          c.strokeStyle = 'rgba(255,255,255,0.3)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.roundRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1, 3);
          c.stroke();

          // Crack lines when damaged
          if (brick.hp < brick.maxHp) {
            c.strokeStyle = 'rgba(0,0,0,0.5)';
            c.lineWidth = 1.5;
            c.beginPath();
            const cx = brick.x + brick.w / 2;
            const cy = brick.y + brick.h / 2;
            // Crack pattern
            c.moveTo(cx - 4, cy - 3);
            c.lineTo(cx + 2, cy);
            c.lineTo(cx - 1, cy + 4);
            if (brick.hp === 1 && brick.maxHp >= 3) {
              // Extra crack for heavily damaged
              c.moveTo(cx + 5, cy - 4);
              c.lineTo(cx + 1, cy + 1);
              c.lineTo(cx + 6, cy + 3);
            }
            c.stroke();
          }

          // HP indicator dot
          c.fillStyle = 'rgba(255,255,255,0.7)';
          c.font = 'bold 10px system-ui, sans-serif';
          c.textAlign = 'center';
          c.fillText(`${brick.hp}`, brick.x + brick.w / 2, brick.y + brick.h / 2 + 4);
        } else {
          // Normal brick
          c.fillStyle = brick.color;
          c.beginPath();
          c.roundRect(brick.x, brick.y, brick.w, brick.h, 3);
          c.fill();

          const brickGrad = c.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
          brickGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
          brickGrad.addColorStop(1, 'transparent');
          c.fillStyle = brickGrad;
          c.beginPath();
          c.roundRect(brick.x, brick.y, brick.w, brick.h, 3);
          c.fill();
        }
      }

      // Falling powerups
      for (const pu of powerupsRef.current) {
        const def = POWERUP_DEFS[pu.kind];
        const pulseScale = 1 + Math.sin(pu.pulse) * 0.12;
        const sz = POWERUP_SIZE * pulseScale;

        // Glow
        c.shadowColor = def.glow;
        c.shadowBlur = 14;
        c.fillStyle = def.color;
        c.beginPath();
        c.arc(pu.x, pu.y, sz, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;

        // Icon
        c.font = `bold ${Math.round(sz * 0.9)}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = '#fff';
        c.fillText(def.icon, pu.x, pu.y + sz * 0.3);
      }

      // Paddle
      const paddleGrad = c.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
      paddleGrad.addColorStop(0, '#818cf8');
      paddleGrad.addColorStop(1, '#6366f1');

      // Tint paddle when expand is active
      const hasExpand = effectsRef.current.some((e) => e.kind === 'expand');
      if (hasExpand) {
        paddleGrad.addColorStop(0, '#a5b4fc');
        paddleGrad.addColorStop(1, '#818cf8');
      }

      c.fillStyle = paddleGrad;
      c.beginPath();
      c.roundRect(g.paddleX, PADDLE_Y, pw, PADDLE_H, PADDLE_R);
      c.fill();

      c.shadowColor = hasExpand ? '#a5b4fc' : '#818cf8';
      c.shadowBlur = hasExpand ? 18 : 12;
      c.fillStyle = 'transparent';
      c.beginPath();
      c.roundRect(g.paddleX, PADDLE_Y, pw, PADDLE_H, PADDLE_R);
      c.fill();
      c.shadowBlur = 0;

      // Ball trail (main ball)
      const trail = trailRef.current;
      const hasSlow = effectsRef.current.some((e) => e.kind === 'slow');
      const trailColor = hasSlow ? '#67e8f9' : '#c7d2fe';
      for (let i = 0; i < trail.length; i++) {
        const alpha = ((i + 1) / trail.length) * 0.3;
        const size = BALL_R * ((i + 1) / trail.length) * 0.8;
        c.globalAlpha = alpha;
        c.fillStyle = trailColor;
        c.beginPath();
        c.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // Main ball
      c.shadowColor = hasSlow ? '#22d3ee' : '#a5b4fc';
      c.shadowBlur = 16;
      c.fillStyle = hasSlow ? '#cffafe' : '#e0e7ff';
      c.beginPath();
      c.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;

      // Extra balls
      for (const eb of extraBallsRef.current) {
        c.shadowColor = '#f59e0b';
        c.shadowBlur = 10;
        c.fillStyle = '#fef3c7';
        c.beginPath();
        c.arc(eb.x, eb.y, BALL_R * 0.85, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }

      // Particles
      for (const p of particles) {
        c.globalAlpha = p.life;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // Floating texts
      for (const ft of fts) {
        c.globalAlpha = Math.max(0, 1 - ft.age / 1.2);
        c.font = 'bold 16px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = ft.color;
        c.fillText(ft.text, ft.x, ft.y);
      }
      c.globalAlpha = 1;

      // ── HUD ────────────────────────────────────────────────────────────

      // Score (left)
      const pulse = scorePulseRef.current;
      const fontSize = 20 + pulse * 6;
      c.font = `bold ${fontSize}px system-ui, sans-serif`;
      c.textAlign = 'left';
      c.fillStyle = pulse > 0 ? `rgba(253,224,71,${0.7 + pulse * 0.3})` : 'rgba(255,255,255,0.7)';
      c.fillText(`${g.score}`, 16, 32);

      // Level (center)
      c.font = 'bold 14px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = isBossLevel(g.level) ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.4)';
      const levelLabel = isBossLevel(g.level) ? `BOSS ${g.level + 1}` : `Level ${g.level + 1}`;
      c.fillText(levelLabel, W / 2, 30);

      // Lives (right)
      c.font = 'bold 16px system-ui, sans-serif';
      c.textAlign = 'right';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillText('\u2764\uFE0F'.repeat(g.lives), W - 16, 30);

      // Combo display (near score)
      if (combo.count >= 2 && combo.displayAge < 1) {
        const comboAlpha = Math.max(0, 1 - combo.displayAge);
        c.globalAlpha = comboAlpha;
        c.font = 'bold 14px system-ui, sans-serif';
        c.textAlign = 'left';

        // Color ramps with combo
        const comboHue = combo.count >= 8 ? '#f43f5e' : combo.count >= 5 ? '#f59e0b' : '#22d3ee';
        c.fillStyle = comboHue;
        c.fillText(`COMBO x${combo.count}`, 16, 52);
        c.globalAlpha = 1;
      }

      // Active effects indicator (bottom-left, above paddle area)
      const activeEffects = effectsRef.current;
      if (activeEffects.length > 0) {
        let ex = 16;
        const ey = H - 12;
        c.font = '11px system-ui, sans-serif';
        c.textAlign = 'left';
        for (const eff of activeEffects) {
          const pct = eff.remaining / eff.duration;
          const icon = eff.kind === 'expand' ? '⇔' : '⏳';
          c.fillStyle = `rgba(255,255,255,${0.3 + pct * 0.5})`;
          c.fillText(`${icon} ${Math.ceil(eff.remaining)}s`, ex, ey);
          ex += 60;
        }
      }

      // Extra balls count indicator
      if (extraBallsRef.current.length > 0) {
        c.font = '11px system-ui, sans-serif';
        c.textAlign = 'right';
        c.fillStyle = 'rgba(245,158,11,0.7)';
        c.fillText(`⊕ x${extraBallsRef.current.length + 1}`, W - 16, H - 12);
      }

      // Objectives panel (top-right)
      const objs = objectivesRef.current;
      if (objs.length > 0 && (currentPhase === 'playing' || currentPhase === 'paused' || currentPhase === 'level_transition')) {
        let oy = 50;
        for (const obj of objs) {
          // Glow animation on completion
          if (obj.justCompleted > 0) {
            obj.justCompleted = Math.max(0, obj.justCompleted - dtSec * 1.5);
            c.shadowColor = '#fbbf24';
            c.shadowBlur = 12 * obj.justCompleted;
          }

          const done = obj.done;
          const icon = done ? '✓' : '○';
          const label = obj.i18nVal != null
            ? t(`breakout.obj.${obj.i18nKey}`).replace('{n}', `${obj.i18nVal}`)
            : t(`breakout.obj.${obj.i18nKey}`);

          // Progress text
          let progText = '';
          if (obj.target > 0 && !done) {
            progText = ` ${Math.min(obj.progress, obj.target)}/${obj.target}`;
          }

          c.font = '11px system-ui, sans-serif';
          c.textAlign = 'right';
          c.fillStyle = done ? 'rgba(74,222,128,0.8)' : 'rgba(255,255,255,0.45)';
          c.fillText(`${icon} ${label}${progText}`, W - 16, oy);

          c.shadowBlur = 0;
          oy += 16;
        }
      }

      // Launch hint
      if (currentPhase === 'playing' && !g.launched) {
        c.font = '14px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillText(t('breakout.launchHint'), W / 2, PADDLE_Y - 30);
      }

      // Pause overlay
      if (currentPhase === 'paused') {
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(0, 0, W, H);
        c.font = 'bold 40px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#fff';
        c.fillText(t('breakout.paused'), W / 2, H / 2 - 10);
        c.font = '16px system-ui, sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.fillText(t('breakout.pauseHint'), W / 2, H / 2 + 25);
      }

      // Level transition overlay
      if (currentPhase === 'level_transition') {
        const tr = transitionRef.current;
        const progress = 1 - tr.timer / LEVEL_TRANSITION_MS;
        const alpha = progress < 0.5 ? progress * 2 : 2 - progress * 2;

        c.fillStyle = `rgba(0,0,0,${0.7 * alpha})`;
        c.fillRect(0, 0, W, H);

        c.globalAlpha = alpha;

        const nextIsBoss = isBossLevel(tr.nextLevel);
        c.font = 'bold 48px system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = nextIsBoss ? '#ef4444' : '#a5b4fc';
        const transLabel = nextIsBoss
          ? `BOSS ${tr.nextLevel + 1}`
          : `Level ${tr.nextLevel + 1}`;
        c.fillText(transLabel, W / 2, H / 2 - 10);

        c.font = '18px system-ui, sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fillText(t('breakout.getReady'), W / 2, H / 2 + 30);
        c.globalAlpha = 1;

        tr.timer = Math.max(0, tr.timer - (dt * 16.667));
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, t, saveResult]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const diffConfig = DIFF_CONFIG[difficulty];

  return (
    <div className="flex flex-col items-center gap-4" ref={wrapperRef}>
      {/* Stats bar */}
      {stats && (
        <div className="flex gap-6 text-xs text-zinc-500 tabular-nums">
          <span>{t('breakout.stats.games')}: <b className="text-zinc-300">{stats.games}</b></span>
          <span>{t('breakout.stats.wins')}: <b className="text-emerald-400">{stats.wins}</b></span>
          <span>{t('breakout.stats.losses')}: <b className="text-rose-400">{stats.losses}</b></span>
          {stats.bestScore > 0 && (
            <span>{t('breakout.stats.bestScore')}: <b className="text-amber-400">{stats.bestScore}</b></span>
          )}
          {stats.bestLevel > 0 && (
            <span>{t('breakout.stats.bestLevel')}: <b className="text-indigo-400">{stats.bestLevel}</b></span>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H }}
          className="rounded-xl border border-zinc-800 bg-[#0f0f1a] max-w-full h-auto touch-none"
        />

        {/* Menu overlay */}
        {phase === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl">
            <h2 className="text-4xl font-black mb-1 text-white">Breakout</h2>
            <p className="text-zinc-400 text-sm mb-6">{t('breakout.subtitle')}</p>

            {/* Mode selector */}
            <div className="mb-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 text-center">
                {t('breakout.mode')}
              </p>
              <div className="flex gap-1 p-1 bg-zinc-800/80 rounded-lg">
                {(['classic', 'random', 'endless'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setGameMode(m)}
                    className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      gameMode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t(`breakout.mode.${m}`)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 text-center mt-1.5">
                {t(`breakout.mode.${gameMode}.hint`)}
              </p>
            </div>

            {/* Difficulty selector */}
            <div className="mb-6">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2 text-center">
                {t('breakout.difficulty')}
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
                    {t(`breakout.diff.${d}`)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 text-center mt-1.5 tabular-nums">
                {diffConfig.lives} {t('breakout.livesLabel')}
              </p>
            </div>

            <button
              onClick={startGame}
              className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
            >
              {t('breakout.start')}
            </button>
          </div>
        )}

        {/* End overlay */}
        {phase === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-xl">
            <h2 className={`text-4xl font-black mb-2 ${winner === 'player' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {winner === 'player' ? t('breakout.win') : t('breakout.lose')}
            </h2>
            <div className="flex flex-col items-center gap-1 text-zinc-300 text-lg mb-1">
              <span>{t('breakout.finalScore')}: <b>{score}</b></span>
              <span className="text-sm text-zinc-400">
                Level {level} · {gameRef.current.bricksDestroyed} {t('breakout.bricksLabel')}
              </span>
            </div>

            {/* Objectives summary */}
            {objectivesRef.current.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5 text-sm">
                <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold text-center">{t('breakout.obj.title')}</p>
                {objectivesRef.current.map((obj, i) => {
                  const label = obj.i18nVal != null
                    ? t(`breakout.obj.${obj.i18nKey}`).replace('{n}', `${obj.i18nVal}`)
                    : t(`breakout.obj.${obj.i18nKey}`);
                  return (
                    <div key={i} className="flex items-center gap-2 justify-center">
                      <span className={obj.done ? 'text-emerald-400' : 'text-zinc-600'}>
                        {obj.done ? '✓' : '✗'}
                      </span>
                      <span className={obj.done ? 'text-zinc-200' : 'text-zinc-500'}>
                        {label}
                      </span>
                      {obj.done && (
                        <span className="text-amber-400 text-xs">+{obj.bonus}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={startGame}
              className="mt-4 px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
            >
              {t('breakout.playAgain')}
            </button>
            <button
              onClick={() => setPhase('menu')}
              className="mt-2 px-6 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t('breakout.backToMenu')}
            </button>
          </div>
        )}
      </div>

      {/* Controls hint + mute */}
      <div className="flex items-center gap-4 text-xs text-zinc-600">
        <span>{t('breakout.controlsHint')}</span>
        <span className="text-zinc-700">|</span>
        <span>P / Esc {t('breakout.toPause')}</span>
        <span className="text-zinc-700">|</span>
        <button onClick={toggleMute} className="hover:text-zinc-400 transition-colors">
          {muted ? t('breakout.unmute') : t('breakout.mute')}
        </button>
      </div>

      {/* Personal best list */}
      <ScoreboardPanel
        gameId="breakout"
        scores={pb.scores}
        lastInsertId={pb.lastInsertId}
        isNewBest={pb.isNewBest}
        onClear={pb.clear}
      />
    </div>
  );
}
