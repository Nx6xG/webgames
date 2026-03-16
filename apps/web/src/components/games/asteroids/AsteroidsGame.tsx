'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { useCloudSync } from '@/hooks/useCloudSync';
import { loadStats, updateStats } from './stats';
import type { AsteroidsStats } from './stats';
import * as sfx from './sound';

// Roguelite imports
import type { AsteroidVariant, BossVariant, ScrapDrop, ActiveBuff, Drone, TempBuffDef, ArtifactId, EliteModifier, WaveEvent, MidWaveEvent, MidWaveEventType, RunStats, ShipId, CurseId, MilestoneId, MegaBossData, MegaBossPhase, DailyModifierId } from './roguelite-types';
import type { PermanentUpgradeId, MilestoneDef } from './roguelite-types';
import {
  PERMANENT_UPGRADES,
  ASTEROID_VARIANT_CONFIG,
  BOSS_VARIANT_CONFIG,
  BASE_SCRAP_VALUES,
  getAppliedStats,
  getBossVariantForWave,
  getSpecialAsteroidChance,
  pickSpecialVariant,
  TEMP_BUFF_MAP,
  ARTIFACTS,
  pickRandomArtifacts,
  ELITE_MODIFIER_CONFIG,
  getEliteChance,
  pickEliteModifier,
  WAVE_EVENT_CONFIG,
  rollWaveEvent,
  MID_WAVE_EVENT_CONFIG,
  rollMidWaveEvent,
  getAscensionScrapBonus,
  defaultRunStats,
  SHIPS,
  SHIP_MAP,
  MILESTONES,
  CURSES,
  getCurseScrapMultiplier,
  MEGA_BOSS_CONFIG,
  isMegaBossWave,
  getDailyModifiers,
  getBossWaveHpScale,
  getEventWaveScale,
  getPowerupDropScale,
  getMegaBossHpScale,
} from './roguelite-data';
import type { AppliedStats } from './roguelite-data';
import type { ArtifactDef } from './roguelite-types';
import { loadRogueliteSave, saveRogueliteSave, buyUpgrade, addScrap, pickRandomBuffs, performAscension, selectShip, isShipUnlocked, checkMilestones, applyMilestones, recordBestiaryEncounter, hasDailyRunToday, loadDailyRun, saveDailyRun, getDailyRunDate } from './roguelite-state';
import type { RogueliteSave, DailyRunResult } from './roguelite-types';
import BuffChoice from './BuffChoice';
import ArtifactChoice from './ArtifactChoice';
import RunStatsScreen from './RunStatsScreen';
import RogueliteUpgrades from './RogueliteUpgrades';
import ShipSelect from './ShipSelect';
import CurseSelect from './CurseSelect';
import Bestiary from './Bestiary';
import MilestoneNotification from './MilestoneNotification';
import MilestoneOverview from './MilestoneOverview';
import ContentGuide from './ContentGuide';
import DailyPreview from './DailyPreview';

// ── Types ────────────────────────────────────────────────────────────────────

type GameMode = 'endless' | 'roguelite';
type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'ended' | 'buff_choice' | 'artifact_choice' | 'wave_event_announce' | 'run_stats' | 'upgrades' | 'ship_select' | 'curse_select' | 'bestiary' | 'milestones' | 'milestone_overview' | 'content_guide' | 'daily_preview';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Vec2 { x: number; y: number }

interface Ship {
  pos: Vec2;
  vel: Vec2;
  angle: number;       // radians
  thrusting: boolean;
  invulnerable: number; // ms remaining
}

interface Bullet {
  pos: Vec2;
  vel: Vec2;
  life: number; // ms remaining
}

interface Asteroid {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  vertices: number[]; // offsets from radius for irregular shape
  rotation: number;
  rotSpeed: number;
  // Roguelite extensions (only present in roguelite mode):
  rlHp?: number;
  rlMaxHp?: number;
  rlVariant?: AsteroidVariant;
  rlScrapValue?: number;
  rlElite?: EliteModifier | null;
  rlEliteShieldHit?: boolean;
  rlTeleportTimer?: number;
  rlEventAsteroid?: boolean; // wave event asteroid (non-damaging in scrap bonus)
}

interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
}

type PowerUpType = 'double' | 'triple' | 'rapid' | 'shield' | 'bigbullet' | 'homing' | 'multishot' | 'timeslow';

interface PowerUp {
  pos: Vec2;
  vx: number;
  vy: number;
  type: PowerUpType;
  age: number; // ms alive
  rotation: number;
}

interface ActivePower {
  type: PowerUpType;
  timeLeft: number; // ms remaining
}

function hasPower(powers: ActivePower[], type: PowerUpType): boolean {
  return powers.some(p => p.type === type);
}

interface BossBullet {
  pos: Vec2;
  vel: Vec2;
  life: number;
}

interface Boss {
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  fireTimer: number;
  alive: boolean;
  // Roguelite extensions:
  rlVariant?: BossVariant;
  rlShieldHp?: number;
  rlShieldMaxHp?: number;
  rlShieldRegenTimer?: number;
  rlSpawnTimer?: number;
}

interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  activePowers: ActivePower[];
  hasShield: boolean;
  score: number;
  lives: number;
  wave: number;
  asteroidsDestroyed: number;
  boss: Boss | null;
  bossBullets: BossBullet[];
  bossDefeatedTimer: number; // ms remaining for "Boss defeated!" flash
  // Roguelite-only fields:
  rlScrap?: number;
  rlScrapDrops?: ScrapDrop[];
  rlActiveBuffs?: ActiveBuff[];
  rlDrone?: Drone | null;
  rlShieldCooldown?: number;
  rlCritPopups?: Array<{ x: number; y: number; life: number }>;
  rlRegenCounter?: number;
  rlArtifacts?: ArtifactId[];
  rlScrapHealCounter?: number;
  rlWaveEvent?: WaveEvent | null;
  rlRunStats?: RunStats;
  rlCurses?: CurseId[];
  rlMegaBoss?: MegaBossData | null;
  rlMegaBossDefeated?: boolean;
  rlNoDamageBoss?: boolean;
  rlAllBuffsUsed?: Set<string>;
  rlShipColor?: string;
  rlBestiaryEncounters?: Set<string>;
  rlIsDaily?: boolean;
  rlDailyModifiers?: DailyModifierId[];
  rlMidWaveEvent?: MidWaveEvent | null;
  rlMidWaveTimer?: number; // ms until next mid-wave event roll
}

// ── Constants ────────────────────────────────────────────────────────────────

const W = 800;
const H = 600;
const SHIP_SIZE = 15;
const SHIP_ACCEL = 0.12;
const SHIP_FRICTION = 0.985;
const SHIP_TURN_SPEED = 0.065;
const BULLET_SPEED = 7;
const BULLET_LIFE = 800; // ms
const MAX_BULLETS = 5;
const INVULN_TIME = 2500; // ms
const STAR_COUNT = 120;
const POWERUP_SPAWN_CHANCE = 0.15; // 15% from large asteroids
const POWERUP_MEDIUM_CHANCE = 0.10; // 10% from medium asteroids
const POWERUP_SMALL_CHANCE = 0.04; // 4% from small asteroids
const POWERUP_LIFETIME = 8000; // ms before despawn
const POWERUP_ACTIVE_DURATION = 10000; // ms active
const POWERUP_RADIUS = 14;
const POWERUP_TYPES: PowerUpType[] = ['double', 'triple', 'rapid', 'shield', 'bigbullet', 'homing', 'multishot', 'timeslow'];
const POWERUP_COLORS: Record<PowerUpType, string> = {
  double: '#3b82f6',    // blue
  triple: '#22c55e',    // green
  rapid: '#eab308',     // yellow
  shield: '#06b6d4',    // cyan
  bigbullet: '#f97316', // orange
  homing: '#a855f7',    // purple
  multishot: '#ec4899', // pink
  timeslow: '#f5f5f5',  // white
};
const POWERUP_LABELS: Record<PowerUpType, string> = {
  double: '2x',
  triple: '3x',
  rapid: 'RF',
  shield: 'SH',
  bigbullet: 'BG',
  homing: 'HM',
  multishot: 'MS',
  timeslow: 'TS',
};

// ── Boss constants ──
const BOSS_RADIUS = 60;
const BOSS_HP = 10;
const BOSS_POINTS = 500;
const BOSS_FIRE_INTERVAL = 120; // frames (~2s at 60fps)
const BOSS_BULLET_SPEED = 3;
const BOSS_BULLET_LIFE = 3000; // ms

const DIFF_CONFIG: Record<Difficulty, { speedMult: number; startCount: number; countIncrement: number }> = {
  easy:   { speedMult: 0.7,  startCount: 3, countIncrement: 1 },
  medium: { speedMult: 1.0,  startCount: 4, countIncrement: 1 },
  hard:   { speedMult: 1.4,  startCount: 5, countIncrement: 2 },
};

const ASTEROID_SIZES: { radius: number; points: number; speed: [number, number] }[] = [
  { radius: 40, points: 20,  speed: [0.5, 1.2] },
  { radius: 20, points: 50,  speed: [1.0, 2.0] },
  { radius: 10, points: 100, speed: [1.5, 3.0] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function wrap(v: Vec2): Vec2 {
  let { x, y } = v;
  if (x < 0) x += W;
  if (x > W) x -= W;
  if (y < 0) y += H;
  if (y > H) y -= H;
  return { x, y };
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function makeAsteroidVertices(count: number): number[] {
  const verts: number[] = [];
  for (let i = 0; i < count; i++) {
    verts.push(0.7 + Math.random() * 0.6); // 0.7..1.3 multiplier
  }
  return verts;
}

function createAsteroid(sizeIdx: number, pos: Vec2, speedMult: number): Asteroid {
  const size = ASTEROID_SIZES[sizeIdx];
  const angle = Math.random() * Math.PI * 2;
  const speed = randomBetween(size.speed[0], size.speed[1]) * speedMult;
  return {
    pos,
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: size.radius,
    vertices: makeAsteroidVertices(10 + Math.floor(Math.random() * 5)),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.03,
  };
}

function spawnWaveAsteroids(count: number, shipPos: Vec2, speedMult: number): Asteroid[] {
  const asteroids: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    let pos: Vec2;
    do {
      pos = { x: Math.random() * W, y: Math.random() * H };
    } while (dist(pos, shipPos) < 150);
    asteroids.push(createAsteroid(0, pos, speedMult));
  }
  return asteroids;
}

function sizeIndex(radius: number): number {
  if (radius >= 35) return 0; // large
  if (radius >= 15) return 1; // medium
  return 2;                   // small
}

function makeParticles(pos: Vec2, count: number, color: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(0.5, 3);
    const life = randomBetween(200, 600);
    particles.push({
      pos: { ...pos },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      life,
      maxLife: life,
      color,
    });
  }
  return particles;
}

function isBossWave(wave: number): boolean {
  return wave > 0 && wave % 5 === 0;
}

function createBoss(): Boss {
  return {
    x: W / 2,
    y: 60,
    vx: randomBetween(-0.3, 0.3),
    vy: randomBetween(0.1, 0.3),
    hp: BOSS_HP,
    maxHp: BOSS_HP,
    fireTimer: BOSS_FIRE_INTERVAL,
    alive: true,
  };
}

function spawnPowerUp(pos: Vec2): PowerUp {
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  const angle = Math.random() * Math.PI * 2;
  const speed = randomBetween(0.2, 0.6);
  return {
    pos: { ...pos },
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    type,
    age: 0,
    rotation: 0,
  };
}

// ── Roguelite helper ─────────────────────────────────────────────────────────

function assignRogueliteAsteroidData(a: Asteroid, wave: number, dMods?: DailyModifierId[]): void {
  const chance = getSpecialAsteroidChance(wave);
  const variant: AsteroidVariant = Math.random() < chance ? pickSpecialVariant() : 'normal';
  const cfg = ASTEROID_VARIANT_CONFIG[variant];
  const si = sizeIndex(a.radius);
  const baseHp = si === 0 ? 3 : si === 1 ? 2 : 1;
  const hpMult = dMods?.includes('titanAsteroids') ? 2 : 1;
  a.rlVariant = variant;
  a.rlHp = Math.ceil(baseHp * cfg.hpMultiplier * hpMult);
  a.rlMaxHp = a.rlHp;
  const baseScrap = si === 0 ? BASE_SCRAP_VALUES.large : si === 1 ? BASE_SCRAP_VALUES.medium : BASE_SCRAP_VALUES.small;
  a.rlScrapValue = Math.ceil(baseScrap * cfg.scrapMultiplier);
  if (dMods?.includes('fastAsteroids')) { a.vel.x *= 1.5; a.vel.y *= 1.5; }

  // Elite modifier (wave 10+)
  let eliteChance = getEliteChance(wave);
  if (dMods?.includes('eliteSwarm')) eliteChance = Math.min(eliteChance * 3, 0.9);
  if (eliteChance > 0 && Math.random() < eliteChance) {
    const elite = pickEliteModifier();
    a.rlElite = elite;
    a.rlScrapValue = Math.ceil(a.rlScrapValue * ELITE_MODIFIER_CONFIG[elite].scrapMultiplier);
    if (elite === 'fast') {
      a.vel.x *= 1.8; a.vel.y *= 1.8;
      a.radius *= 0.8;
    } else if (elite === 'tiny') {
      a.radius *= 0.6;
      a.vel.x *= 1.3; a.vel.y *= 1.3;
    } else if (elite === 'shielded') {
      a.rlEliteShieldHit = false;
    } else if (elite === 'teleporter') {
      a.rlTeleportTimer = 3000;
    }
  } else {
    a.rlElite = null;
  }
}

function assignChildRogueliteData(child: Asteroid, parentVariant: AsteroidVariant, wave: number): void {
  // Children of 'splitting' variant become 'normal', others keep parent variant
  const variant: AsteroidVariant = parentVariant === 'splitting' ? 'normal' : parentVariant;
  const cfg = ASTEROID_VARIANT_CONFIG[variant];
  const si = sizeIndex(child.radius);
  const baseHp = si === 0 ? 3 : si === 1 ? 2 : 1;
  child.rlVariant = variant;
  child.rlHp = Math.ceil(baseHp * cfg.hpMultiplier);
  child.rlMaxHp = child.rlHp;
  const baseScrap = si === 0 ? BASE_SCRAP_VALUES.large : si === 1 ? BASE_SCRAP_VALUES.medium : BASE_SCRAP_VALUES.small;
  child.rlScrapValue = Math.ceil(baseScrap * cfg.scrapMultiplier);
}

// ── Stars (static background) ────────────────────────────────────────────────

function generateStars(): { x: number; y: number; r: number; brightness: number }[] {
  const stars: { x: number; y: number; r: number; brightness: number }[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      brightness: Math.random() * 0.5 + 0.3,
    });
  }
  return stars;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AsteroidsGame() {
  const { t } = useI18n();
  const ach = useAchievements('asteroids');
  const { isActive: cloudActive, syncRogueliteSave } = useCloudSync();
  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<AsteroidsStats | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayWave, setDisplayWave] = useState(1);

  // Roguelite state
  const [mode, setMode] = useState<GameMode>('roguelite');
  const [rlSave, setRlSave] = useState<RogueliteSave | null>(null);
  const [buffChoices, setBuffChoices] = useState<TempBuffDef[] | null>(null);
  const [artifactChoices, setArtifactChoices] = useState<ArtifactDef[] | null>(null);
  const [showRunStats, setShowRunStats] = useState(false);
  const [waveEventAnnounce, setWaveEventAnnounce] = useState<{ nameKey: string; descKey: string } | null>(null);
  const [displayScrap, setDisplayScrap] = useState(0);
  const [activeCurses, setActiveCurses] = useState<CurseId[]>([]);
  const [newMilestones, setNewMilestones] = useState<MilestoneDef[]>([]);
  const [isDailyRun, setIsDailyRun] = useState(false);
  const [dailyResult, setDailyResult] = useState<DailyRunResult | null>(null);
  const [dailyModifiers, setDailyModifiers] = useState<DailyModifierId[]>([]);
  const dailyModifiersRef = useRef<DailyModifierId[]>([]);
  dailyModifiersRef.current = dailyModifiers;
  const activeCursesRef = useRef<CurseId[]>([]);
  const isDailyRef = useRef(false);
  isDailyRef.current = isDailyRun;
  activeCursesRef.current = activeCurses;
  const modeRef = useRef<GameMode>('roguelite');
  modeRef.current = mode;
  const effectiveDiff = mode === 'roguelite' ? 'medium' as Difficulty : difficulty;
  const diffRef = useRef<Difficulty>(effectiveDiff);
  diffRef.current = effectiveDiff;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const starsRef = useRef<ReturnType<typeof generateStars>>([]);
  const savedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const rlSaveRef = useRef<RogueliteSave | null>(null);
  rlSaveRef.current = rlSave;

  // Load stats + roguelite save on mount
  useEffect(() => {
    setStats(loadStats());
    starsRef.current = generateStars();
    setRlSave(loadRogueliteSave());
    setDailyResult(loadDailyRun());
  }, []);

  // ── Auto-pause on tab switch ─────────────────────────────────────────────
  const handlePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setPhase('paused');
    }
  }, []);
  useVisibilityPause(phase === 'playing', handlePause);

  // ── Init game state ──────────────────────────────────────────────────────
  const initGame = useCallback((diff: Difficulty, gameMode: GameMode): GameState => {
    const config = DIFF_CONFIG[diff];
    const shipPos = { x: W / 2, y: H / 2 };

    let lives = 3;
    let shieldCooldown: number | undefined;
    const curses = activeCursesRef.current;
    const dMods = dailyModifiersRef.current;
    const isDaily = isDailyRef.current;
    if (gameMode === 'roguelite' && rlSave) {
      const rlStats = getAppliedStats(rlSave.upgrades, rlSave.selectedShip);
      lives = curses.includes('glassCannon') ? 1 : rlStats.maxLives;
      if (isDaily && dMods.includes('forcedGlassCannon')) lives = 1;
      shieldCooldown = rlStats.shieldRechargeMs;
    }

    let startCount = config.startCount;
    if (gameMode === 'roguelite' && curses.includes('swarm')) startCount = Math.ceil(startCount * 1.5);
    const asteroids = spawnWaveAsteroids(startCount, shipPos, config.speedMult);

    // In roguelite, assign HP and variants
    if (gameMode === 'roguelite') {
      for (const a of asteroids) {
        assignRogueliteAsteroidData(a, 1, isDaily ? dMods : undefined);
      }
    }

    return {
      ship: {
        pos: { ...shipPos },
        vel: { x: 0, y: 0 },
        angle: -Math.PI / 2,
        thrusting: false,
        invulnerable: INVULN_TIME,
      },
      bullets: [],
      asteroids,
      particles: [],
      powerUps: [],
      activePowers: [],
      hasShield: false,
      score: 0,
      lives,
      wave: 1,
      asteroidsDestroyed: 0,
      boss: null,
      bossBullets: [],
      bossDefeatedTimer: 0,
      // Roguelite fields
      rlScrap: gameMode === 'roguelite' ? 0 : undefined,
      rlScrapDrops: gameMode === 'roguelite' ? [] : undefined,
      rlActiveBuffs: gameMode === 'roguelite' ? [] : undefined,
      rlDrone: null,
      rlShieldCooldown: gameMode === 'roguelite' ? shieldCooldown : undefined,
      rlCritPopups: gameMode === 'roguelite' ? [] : undefined,
      rlRegenCounter: 0,
      rlArtifacts: gameMode === 'roguelite' ? [] : undefined,
      rlScrapHealCounter: 0,
      rlWaveEvent: null,
      rlRunStats: gameMode === 'roguelite' ? defaultRunStats() : undefined,
      rlCurses: gameMode === 'roguelite' ? [...curses] : undefined,
      rlMegaBoss: null,
      rlMegaBossDefeated: false,
      rlNoDamageBoss: true,
      rlAllBuffsUsed: gameMode === 'roguelite' ? new Set<string>() : undefined,
      rlShipColor: gameMode === 'roguelite' && rlSave ? SHIP_MAP[rlSave.selectedShip].color : undefined,
      rlBestiaryEncounters: gameMode === 'roguelite' ? new Set<string>() : undefined,
      rlIsDaily: gameMode === 'roguelite' ? isDailyRef.current : undefined,
      rlDailyModifiers: gameMode === 'roguelite' && isDailyRef.current ? [...dailyModifiersRef.current] : undefined,
    };
  }, [rlSave]);

  // ── Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    sfx.countdownBeep();
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          sfx.countdownGo();
          setPhase('playing');
          return 0;
        }
        sfx.countdownBeep();
        return prev - 1;
      });
    }, 700);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'W', 'a', 'A', 'd', 'D', 's', 'S'].includes(key)) {
        e.preventDefault();
      }
      keysRef.current.add(key);

      // Pause toggle
      if ((key === 'p' || key === 'P' || key === 'Escape') && phaseRef.current === 'playing') {
        setPhase('paused');
        return;
      }
      if ((key === 'p' || key === 'P' || key === 'Escape') && phaseRef.current === 'paused') {
        setPhase('playing');
        return;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    function onMouseMove(e: MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    }
    function onMouseDown(e: MouseEvent) {
      if (e.button === 0) mouseDownRef.current = true;
    }
    function onMouseUp(e: MouseEvent) {
      if (e.button === 0) mouseDownRef.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ── Shoot helper ─────────────────────────────────────────────────────────
  const shootCooldownRef = useRef(0);

  // ── Buff choice handler ────────────────────────────────────────────────
  const handleBuffSelect = useCallback((index: number) => {
    if (!buffChoices || !gameRef.current) return;
    const chosen = buffChoices[index];
    const game = gameRef.current;

    if (chosen.duration === -1) {
      // Instant effect
      if (chosen.id === 'emp') {
        // Destroy all small asteroids
        game.asteroids = game.asteroids.filter(a => {
          if (sizeIndex(a.radius) === 2) {
            game.particles.push(...makeParticles(a.pos, 5, '#f87171'));
            game.score += ASTEROID_SIZES[2].points;
            game.asteroidsDestroyed++;
            return false;
          }
          return true;
        });
      } else if (chosen.id === 'extraLife') {
        game.lives += 1; // can exceed max lives
      }
    } else {
      // Add to active buffs
      game.rlActiveBuffs = game.rlActiveBuffs ?? [];
      const existing = game.rlActiveBuffs.find(b => b.id === chosen.id);
      if (existing) {
        existing.wavesRemaining = chosen.duration; // refresh
      } else {
        game.rlActiveBuffs.push({
          id: chosen.id,
          wavesRemaining: chosen.duration, // 0 = permanent
        });
      }
    }

    // Track buff choice in run stats
    if (game.rlRunStats) game.rlRunStats.buffsChosen++;

    setBuffChoices(null);
    setPhase('playing');
  }, [buffChoices, rlSave]);

  // ── Artifact choice handler ────────────────────────────────────────────
  const handleArtifactSelect = useCallback((index: number) => {
    if (!artifactChoices || !gameRef.current) return;
    const chosen = artifactChoices[index];
    const game = gameRef.current;
    game.rlArtifacts = game.rlArtifacts ?? [];
    game.rlArtifacts.push(chosen.id);
    if (game.rlRunStats) game.rlRunStats.artifactsCollected++;
    setArtifactChoices(null);
    setPhase('playing');
  }, [artifactChoices]);

  // ── Game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Still draw the canvas when paused/ended so it's not blank
      if (phase === 'paused' || phase === 'ended' || phase === 'wave_event_announce') {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && gameRef.current) drawGame(ctx, gameRef.current, starsRef.current, modeRef.current);
      }
      return;
    }

    lastTimeRef.current = performance.now();

    function tick(now: number) {
      const dt = Math.min(now - lastTimeRef.current, 50); // cap delta
      lastTimeRef.current = now;

      const game = gameRef.current;
      if (!game) { rafRef.current = requestAnimationFrame(tick); return; }

      const keys = keysRef.current;
      const config = DIFF_CONFIG[diffRef.current];

      // ── Roguelite stats ──
      const isRL = modeRef.current === 'roguelite';
      const rlStats: AppliedStats | null = isRL && rlSaveRef.current
        ? getAppliedStats(rlSaveRef.current.upgrades, rlSaveRef.current.selectedShip)
        : null;
      const dm = game.rlDailyModifiers ?? [];
      const hasDM = (id: DailyModifierId) => dm.includes(id);
      let shipAccel = rlStats ? rlStats.accel : SHIP_ACCEL;
      const turnSpeed = rlStats ? rlStats.turnSpeed : SHIP_TURN_SPEED;
      const bulletSpd = rlStats ? rlStats.bulletSpeed : BULLET_SPEED;
      let fireCool = rlStats ? rlStats.fireCooldown : 150;
      let bulletDmgMult = 1;
      let bulletLifeMult = rlStats ? rlStats.bulletLifeMult : 1;
      let dailyScrapMult = 1;
      let shipHitboxMult = 1;
      if (hasDM('speedDemon')) shipAccel *= 1.5;
      if (hasDM('bulletHell')) { fireCool *= 0.5; bulletLifeMult = 0.5; }
      if (hasDM('heavyHitter')) { bulletDmgMult = 3; fireCool *= 2; }
      if (hasDM('forcedGlassCannon')) bulletDmgMult = Math.max(bulletDmgMult, 2);
      if (hasDM('scrapFrenzy')) dailyScrapMult = 3;
      if (hasDM('miniShip')) shipHitboxMult = 0.6;
      const hasArt = (id: ArtifactId) => isRL && game.rlArtifacts?.includes(id);

      // Track time played
      if (isRL && game.rlRunStats) game.rlRunStats.timePlayed += dt;

      // Wave event timer
      if (isRL && game.rlWaveEvent) {
        game.rlWaveEvent.timer -= dt;
        // Mini boss rush: end early when all enemies are dead
        const eventEnemiesDead = game.rlWaveEvent.type === 'miniBossRush'
          && !game.boss
          && game.asteroids.filter(a => a.rlEventAsteroid).length === 0;
        if (game.rlWaveEvent.timer <= 0 || eventEnemiesDead) {
          // Event expired or completed — clear event asteroids
          game.asteroids = game.asteroids.filter(a => !a.rlEventAsteroid);
          game.rlWaveEvent = null;
        }
      }

      // ── Mid-wave events (roguelite, wave 8+) ──
      if (isRL && !game.rlWaveEvent && !game.rlMegaBoss) {
        // Roll timer: check every ~5s
        game.rlMidWaveTimer = (game.rlMidWaveTimer ?? 5000) - dt;
        if (game.rlMidWaveTimer <= 0) {
          game.rlMidWaveTimer = 4000 + Math.random() * 3000;
          if (!game.rlMidWaveEvent) {
            const midEvt = rollMidWaveEvent(game.wave);
            if (midEvt) {
              const cfg = MID_WAVE_EVENT_CONFIG[midEvt];
              game.rlMidWaveEvent = {
                type: midEvt,
                timer: cfg.duration,
                ...(midEvt === 'gravityWell' ? { x: Math.random() * W * 0.6 + W * 0.2, y: Math.random() * H * 0.6 + H * 0.2 } : {}),
              };
            }
          }
        }

        // Process active mid-wave event
        if (game.rlMidWaveEvent) {
          const mwe = game.rlMidWaveEvent;
          mwe.timer -= dt;

          if (mwe.type === 'gravityWell' && mwe.x != null && mwe.y != null) {
            const gx = mwe.x, gy = mwe.y;
            const pull = 0.02;
            // Pull asteroids toward center
            for (const a of game.asteroids) {
              const dx = gx - a.pos.x, dy = gy - a.pos.y;
              const d = Math.sqrt(dx * dx + dy * dy) || 1;
              a.vel.x += (dx / d) * pull;
              a.vel.y += (dy / d) * pull;
            }
            // Pull ship slightly
            const sdx = gx - game.ship.pos.x, sdy = gy - game.ship.pos.y;
            const sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
            game.ship.vel.x += (sdx / sd) * pull * 0.3;
            game.ship.vel.y += (sdy / sd) * pull * 0.3;
          }

          if (mwe.type === 'asteroidSwarm' && !mwe.spawned) {
            mwe.spawned = true;
            const swarmCount = Math.ceil(5 + game.wave * 0.5);
            const swarmAsteroids = spawnWaveAsteroids(swarmCount, game.ship.pos, config.speedMult * 1.3);
            for (const a of swarmAsteroids) {
              assignRogueliteAsteroidData(a, game.wave, game.rlDailyModifiers);
            }
            game.asteroids.push(...swarmAsteroids);
          }

          if (mwe.timer <= 0) {
            game.rlMidWaveEvent = null;
          }
        }
      }

      // ── Ship rotation ──
      const pilotCurse = isRL && game.rlCurses?.includes('pilot');

      if (pilotCurse) {
        // ── Pilot curse: WASD direct movement, ship faces mouse, slower speed ──
        const pilotAccel = shipAccel * 0.7;
        let mx = 0, my = 0;
        if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) mx -= 1;
        if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) mx += 1;
        if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) my -= 1;
        if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) my += 1;
        game.ship.thrusting = mx !== 0 || my !== 0;
        if (game.ship.thrusting) {
          const moveAngle = Math.atan2(my, mx);
          game.ship.vel.x += Math.cos(moveAngle) * pilotAccel;
          game.ship.vel.y += Math.sin(moveAngle) * pilotAccel;
          if (Math.random() < 0.3) sfx.thrustSound();
        }
        // Ship always faces mouse cursor
        if (mouseRef.current) {
          game.ship.angle = Math.atan2(
            mouseRef.current.y - game.ship.pos.y,
            mouseRef.current.x - game.ship.pos.x,
          );
        }
      } else {
        // ── Normal rotation controls ──
        if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
          game.ship.angle -= turnSpeed;
        }
        if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
          game.ship.angle += turnSpeed;
        }

        // ── Ship thrust ──
        game.ship.thrusting = keys.has('ArrowUp') || keys.has('w') || keys.has('W');
        if (game.ship.thrusting) {
          game.ship.vel.x += Math.cos(game.ship.angle) * shipAccel;
          game.ship.vel.y += Math.sin(game.ship.angle) * shipAccel;
          if (Math.random() < 0.3) sfx.thrustSound();
        }
      }

      // ── Ship brake (S / ArrowDown) — requires retroThruster upgrade in roguelite, always in classic ──
      const canBrake = !isRL || (rlStats?.hasBrake ?? false);
      const braking = canBrake && !pilotCurse && (keys.has('ArrowDown') || keys.has('s') || keys.has('S'));
      const brakeFriction = braking ? 0.93 : SHIP_FRICTION;

      // ── Ship movement ──
      game.ship.vel.x *= brakeFriction;
      game.ship.vel.y *= brakeFriction;
      game.ship.pos.x += game.ship.vel.x;
      game.ship.pos.y += game.ship.vel.y;
      game.ship.pos = wrap(game.ship.pos);

      // ── Invulnerability ──
      if (game.ship.invulnerable > 0) {
        game.ship.invulnerable -= dt;
      }

      // ── Active power-up timers ──
      for (let i = game.activePowers.length - 1; i >= 0; i--) {
        game.activePowers[i].timeLeft -= dt;
        if (game.activePowers[i].timeLeft <= 0) {
          if (game.activePowers[i].type === 'shield') game.hasShield = false;
          game.activePowers.splice(i, 1);
        }
      }

      // ── Shooting ──
      const isRapid = hasPower(game.activePowers, 'rapid');
      const hasOverdrive = isRL && game.rlActiveBuffs?.some(b => b.id === 'overdrive');
      const hasPowerSurge = game.rlMidWaveEvent?.type === 'powerSurge';
      const cooldown = (isRapid || hasOverdrive || hasPowerSurge) ? Math.min(fireCool * 0.5, 60) : fireCool;
      const maxBullets = isRapid ? 10 : MAX_BULLETS;
      shootCooldownRef.current -= dt;
      const shooting = keys.has(' ') || mouseDownRef.current;
      if (shooting && game.bullets.length < maxBullets && shootCooldownRef.current <= 0) {
        shootCooldownRef.current = cooldown;
        const baseAngle = game.ship.angle;
        const shipVelFactor = 0.5;

        if (hasPower(game.activePowers, 'multishot')) {
          // 5 bullets in a spread: -30, -15, 0, +15, +30 degrees
          const offsets = [-0.524, -0.262, 0, 0.262, 0.524]; // radians
          for (const off of offsets) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * bulletSpd + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * bulletSpd + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE * bulletLifeMult,
            });
          }
        } else if (hasPower(game.activePowers, 'double')) {
          const spread = 0.08; // ~4.5 degrees
          for (const off of [-spread, spread]) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * bulletSpd + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * bulletSpd + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE * bulletLifeMult,
            });
          }
        } else if (hasPower(game.activePowers, 'triple')) {
          const spread = 0.15; // ~8.6 degrees
          for (const off of [-spread, 0, spread]) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * bulletSpd + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * bulletSpd + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE * bulletLifeMult,
            });
          }
        } else {
          game.bullets.push({
            pos: { ...game.ship.pos },
            vel: {
              x: Math.cos(baseAngle) * bulletSpd + game.ship.vel.x * shipVelFactor,
              y: Math.sin(baseAngle) * bulletSpd + game.ship.vel.y * shipVelFactor,
            },
            life: BULLET_LIFE * bulletLifeMult,
          });
        }

        // Rear gun buff: also fire backward
        if (isRL && game.rlActiveBuffs?.some(b => b.id === 'rearGun')) {
          const rearAngle = baseAngle + Math.PI;
          game.bullets.push({
            pos: { ...game.ship.pos },
            vel: {
              x: Math.cos(rearAngle) * bulletSpd + game.ship.vel.x * 0.5,
              y: Math.sin(rearAngle) * bulletSpd + game.ship.vel.y * 0.5,
            },
            life: BULLET_LIFE * bulletLifeMult,
          });
        }

        sfx.shootSound();
      }

      // ── Update bullets ──
      const hasHomingPower = hasPower(game.activePowers, 'homing') || (isRL && game.rlActiveBuffs?.some(b => b.id === 'homingBullets'));
      game.bullets = game.bullets.filter(b => {
        // Homing: steer toward nearest asteroid (or boss)
        if (hasHomingPower && (game.asteroids.length > 0 || (game.boss && game.boss.alive))) {
          let nearestDist = Infinity;
          let nearestPos: Vec2 | null = null;
          for (const a of game.asteroids) {
            const d = dist(b.pos, a.pos);
            if (d < nearestDist) { nearestDist = d; nearestPos = a.pos; }
          }
          if (game.boss && game.boss.alive) {
            const d = dist(b.pos, { x: game.boss.x, y: game.boss.y });
            if (d < nearestDist) { nearestPos = { x: game.boss.x, y: game.boss.y }; }
          }
          if (nearestPos) {
            const dx = nearestPos.x - b.pos.x;
            const dy = nearestPos.y - b.pos.y;
            const targetAngle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(b.vel.y, b.vel.x);
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const turnRate = 0.06; // radians per frame
            const steer = Math.max(-turnRate, Math.min(turnRate, angleDiff));
            const newAngle = currentAngle + steer;
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            b.vel.x = Math.cos(newAngle) * speed;
            b.vel.y = Math.sin(newAngle) * speed;
          }
        }
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;
        // Bouncing bullets artifact: reflect off walls instead of wrapping
        if (hasArt('bouncingBullets')) {
          if (b.pos.x < 0) { b.pos.x = 0; b.vel.x = Math.abs(b.vel.x); }
          if (b.pos.x > W) { b.pos.x = W; b.vel.x = -Math.abs(b.vel.x); }
          if (b.pos.y < 0) { b.pos.y = 0; b.vel.y = Math.abs(b.vel.y); }
          if (b.pos.y > H) { b.pos.y = H; b.vel.y = -Math.abs(b.vel.y); }
        } else {
          b.pos = wrap(b.pos);
        }
        b.life -= dt;
        return b.life > 0;
      });

      // ── Time slow ──
      const hasTimeSlow = hasPower(game.activePowers, 'timeslow') || (isRL && game.rlActiveBuffs?.some(b => b.id === 'timeSlow'));
      const timeSlowMult = hasTimeSlow ? 0.3 : 1;

      // ── Update asteroids ──
      const velocityCurseMult = isRL && game.rlCurses?.includes('velocity') ? 1.4 : 1;
      for (const a of game.asteroids) {
        a.pos.x += a.vel.x * timeSlowMult * velocityCurseMult;
        a.pos.y += a.vel.y * timeSlowMult * velocityCurseMult;
        a.pos = wrap(a.pos);
        a.rotation += a.rotSpeed * timeSlowMult;
      }

      // ── Homing asteroids (roguelite) ──
      if (isRL) {
        for (const a of game.asteroids) {
          if (a.rlVariant === 'homing') {
            const dx = game.ship.pos.x - a.pos.x;
            const dy = game.ship.pos.y - a.pos.y;
            const targetAngle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(a.vel.y, a.vel.x);
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            const steerAmt = Math.max(-0.015, Math.min(0.015, angleDiff));
            const speed = Math.sqrt(a.vel.x * a.vel.x + a.vel.y * a.vel.y);
            const newAngle = currentAngle + steerAmt;
            a.vel.x = Math.cos(newAngle) * speed;
            a.vel.y = Math.sin(newAngle) * speed;
          }

          // Elite: teleporter — randomly teleport every 3s
          if (a.rlElite === 'teleporter') {
            a.rlTeleportTimer = (a.rlTeleportTimer ?? 3000) - dt;
            if (a.rlTeleportTimer <= 0) {
              a.rlTeleportTimer = 3000;
              a.pos.x = Math.random() * W;
              a.pos.y = Math.random() * H;
              game.particles.push(...makeParticles(a.pos, 6, ELITE_MODIFIER_CONFIG.teleporter.color));
            }
          }

          // Elite: magnetic — pulls scrap drops toward itself
          if (a.rlElite === 'magnetic' && game.rlScrapDrops) {
            for (const s of game.rlScrapDrops) {
              const d = dist(a.pos, { x: s.x, y: s.y });
              if (d < 120 && d > 5) {
                const pull = 0.05;
                s.vx += (a.pos.x - s.x) / d * pull * 2;
                s.vy += (a.pos.y - s.y) / d * pull * 2;
              }
            }
          }

          // Artifact: asteroidFear — slow nearby asteroids
          if (hasArt('asteroidFear')) {
            const d = dist(game.ship.pos, a.pos);
            if (d < 100 && d > 0) {
              const slow = 0.97;
              a.vel.x *= slow;
              a.vel.y *= slow;
            }
          }
        }
      }

      // ── Update particles ──
      game.particles = game.particles.filter(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.life -= dt;
        return p.life > 0;
      });

      // ── Update power-ups ──
      game.powerUps = game.powerUps.filter(pu => {
        pu.pos.x += pu.vx;
        pu.pos.y += pu.vy;
        pu.pos = wrap(pu.pos);
        pu.rotation += 0.02;
        pu.age += dt;
        if (pu.age > POWERUP_LIFETIME) return false;

        // Collision with ship
        if (dist(game.ship.pos, pu.pos) < POWERUP_RADIUS + SHIP_SIZE * 0.6) {
          // Activate power-up (stacks with existing)
          const existing = game.activePowers.find(p => p.type === pu.type);
          if (existing) {
            existing.timeLeft = POWERUP_ACTIVE_DURATION; // refresh timer
          } else {
            game.activePowers.push({ type: pu.type, timeLeft: POWERUP_ACTIVE_DURATION });
          }
          if (pu.type === 'shield') game.hasShield = true;
          // Collect particles
          game.particles.push(...makeParticles(pu.pos, 8, POWERUP_COLORS[pu.type]));
          return false;
        }
        return true;
      });

      // ── Bullet-asteroid collision ──
      const newAsteroids: Asteroid[] = [];
      const bulletsToRemove = new Set<number>();
      const bulletHitRadius = hasPower(game.activePowers, 'bigbullet') ? 6 : 2;
      const hasPiercingBuff = isRL && game.rlActiveBuffs?.some(b => b.id === 'piercing');
      const hasExplosiveBullets = isRL && game.rlActiveBuffs?.some(b => b.id === 'explosiveBullets');

      for (let ai = game.asteroids.length - 1; ai >= 0; ai--) {
        const a = game.asteroids[ai];
        let hit = false;
        for (let bi = 0; bi < game.bullets.length; bi++) {
          if (bulletsToRemove.has(bi)) continue;
          if (dist(game.bullets[bi].pos, a.pos) < a.radius + bulletHitRadius) {
            if (isRL && a.rlHp !== undefined && rlStats) {
              // Elite: reflective — bounce bullet back
              if (a.rlElite === 'reflective') {
                const b = game.bullets[bi];
                b.vel.x = -b.vel.x + (Math.random() - 0.5) * 0.5;
                b.vel.y = -b.vel.y + (Math.random() - 0.5) * 0.5;
                b.life = Math.min(b.life, 400);
                game.particles.push(...makeParticles(a.pos, 3, ELITE_MODIFIER_CONFIG.reflective.color));
                a.rlElite = null; // only reflects once
                break;
              }
              // Elite: shielded — first hit absorbed
              if (a.rlElite === 'shielded' && !a.rlEliteShieldHit) {
                a.rlEliteShieldHit = true;
                bulletsToRemove.add(bi);
                game.particles.push(...makeParticles(a.pos, 5, ELITE_MODIFIER_CONFIG.shielded.color));
                break;
              }
              // Roguelite HP system
              let dmg = Math.ceil(rlStats.bulletDamage * bulletDmgMult);
              let isCrit = false;
              if (Math.random() < rlStats.critChance) {
                dmg *= hasArt('overcharge') ? 5 : 3;
                isCrit = true;
              }
              a.rlHp -= dmg;
              if (isCrit && game.rlCritPopups) {
                game.rlCritPopups.push({ x: a.pos.x, y: a.pos.y, life: 600 });
              }
              // Piercing: don't remove bullet
              if (!hasPiercingBuff) bulletsToRemove.add(bi);

              if (a.rlHp <= 0) {
                // Destroy asteroid
                hit = true;
                const si = sizeIndex(a.radius);
                game.score += ASTEROID_SIZES[si].points;
                game.asteroidsDestroyed++;
                if (game.rlRunStats) {
                  game.rlRunStats.asteroidsDestroyed++;
                  if (a.rlElite) game.rlRunStats.eliteAsteroidsDestroyed++;
                }
                if (game.rlBestiaryEncounters) {
                  game.rlBestiaryEncounters.add(`asteroid_${a.rlVariant || 'normal'}`);
                  if (a.rlElite) game.rlBestiaryEncounters.add(`elite_${a.rlElite}`);
                }

                // Particles
                const particleColor = ASTEROID_VARIANT_CONFIG[a.rlVariant || 'normal'].color;
                game.particles.push(...makeParticles(a.pos, si === 0 ? 12 : si === 1 ? 8 : 5, particleColor));

                // Sound
                if (si === 0) sfx.bigExplosionSound();
                else sfx.explosionSound();

                // Power-up spawn (famine curse disables, scales down in late game)
                const famineCurse = isRL && (game.rlCurses?.includes('famine') || hasDM('noPowerups'));
                const puChance = hasArt('killSpawnPowerup') ? 0.05 : 0;
                const puScale = isRL ? getPowerupDropScale(game.wave) : 1;
                if (!famineCurse && si === 0 && Math.random() < POWERUP_SPAWN_CHANCE * puScale) {
                  game.powerUps.push(spawnPowerUp(a.pos));
                } else if (!famineCurse && si === 1 && Math.random() < POWERUP_MEDIUM_CHANCE * puScale) {
                  game.powerUps.push(spawnPowerUp(a.pos));
                } else if (!famineCurse && si === 2 && Math.random() < POWERUP_SMALL_CHANCE * puScale) {
                  game.powerUps.push(spawnPowerUp(a.pos));
                } else if (puChance > 0 && Math.random() < puChance) {
                  game.powerUps.push(spawnPowerUp(a.pos));
                }

                // Spawn scrap drop (with ascension bonus)
                if (game.rlScrapDrops && a.rlScrapValue) {
                  const ascBonus = rlSaveRef.current ? getAscensionScrapBonus(rlSaveRef.current.ascensionLevel ?? 0) : 1;
                  const curseMult = game.rlCurses?.length ? getCurseScrapMultiplier(game.rlCurses) : 1;
                  const scrapMult = rlStats.scrapMultiplier * ascBonus * curseMult * dailyScrapMult * (game.rlActiveBuffs?.some(b => b.id === 'doubleScrap') ? 2 : 1);
                  const val = Math.ceil(a.rlScrapValue * scrapMult);
                  game.rlScrapDrops.push({
                    x: a.pos.x, y: a.pos.y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    value: val,
                    life: 5000,
                  });
                }

                // Artifact: shrapnelBurst — destroyed asteroids fire shrapnel
                if (hasArt('shrapnelBurst')) {
                  for (let s = 0; s < 3; s++) {
                    const sAngle = Math.random() * Math.PI * 2;
                    game.bullets.push({
                      pos: { ...a.pos },
                      vel: { x: Math.cos(sAngle) * 4, y: Math.sin(sAngle) * 4 },
                      life: 300,
                    });
                  }
                }

                // Explosive variant: damage nearby asteroids
                if (a.rlVariant === 'explosive') {
                  for (const other of game.asteroids) {
                    if (other === a) continue;
                    if (dist(a.pos, other.pos) < 80 && other.rlHp) {
                      other.rlHp -= 2;
                    }
                  }
                  game.particles.push(...makeParticles(a.pos, 25, '#ef4444'));
                  // Artifact: explosionHeal
                  if (hasArt('explosionHeal') && rlStats) {
                    const maxLives = rlStats.maxLives;
                    if (game.lives < maxLives) {
                      game.lives++;
                      game.particles.push(...makeParticles(game.ship.pos, 8, '#f87171'));
                    }
                  }
                }

                // Explosive bullets AoE
                if (hasExplosiveBullets) {
                  for (const other of game.asteroids) {
                    if (other === a) continue;
                    if (dist(a.pos, other.pos) < 60 && other.rlHp) {
                      other.rlHp -= 1;
                      game.particles.push(...makeParticles(other.pos, 3, '#f97316'));
                    }
                  }
                }

                // Split into smaller asteroids
                if (si < 2) {
                  const childSize = si + 1;
                  const childCount = a.rlVariant === 'splitting' ? 3 : 2;
                  for (let c = 0; c < childCount; c++) {
                    const child = createAsteroid(childSize, { ...a.pos }, config.speedMult);
                    assignChildRogueliteData(child, a.rlVariant || 'normal', game.wave);
                    newAsteroids.push(child);
                  }
                }

                game.asteroids.splice(ai, 1);
              } else {
                // Not destroyed yet, show hit particles
                game.particles.push(...makeParticles(a.pos, 3, ASTEROID_VARIANT_CONFIG[a.rlVariant || 'normal'].color));
              }
              break; // one bullet per asteroid per frame
            } else {
              // Endless mode: instant kill (existing behavior)
              hit = true;
              bulletsToRemove.add(bi);
              break;
            }
          }
        }
        if (hit && !(isRL && a.rlHp !== undefined)) {
          // Endless mode destruction
          const si = sizeIndex(a.radius);
          game.score += ASTEROID_SIZES[si].points;
          game.asteroidsDestroyed++;

          // Particles
          const particleColor = si === 0 ? '#a1a1aa' : si === 1 ? '#d4d4d8' : '#fafafa';
          game.particles.push(...makeParticles(a.pos, si === 0 ? 12 : si === 1 ? 8 : 5, particleColor));

          // Sound
          if (si === 0) sfx.bigExplosionSound();
          else sfx.explosionSound();

          // Power-up spawn (15% from large, 10% from medium, 4% from small asteroids)
          if (si === 0 && Math.random() < POWERUP_SPAWN_CHANCE) {
            game.powerUps.push(spawnPowerUp(a.pos));
          } else if (si === 1 && Math.random() < POWERUP_MEDIUM_CHANCE) {
            game.powerUps.push(spawnPowerUp(a.pos));
          } else if (si === 2 && Math.random() < POWERUP_SMALL_CHANCE) {
            game.powerUps.push(spawnPowerUp(a.pos));
          }

          // Split into smaller asteroids
          if (si < 2) {
            const childSize = si + 1;
            for (let c = 0; c < 2; c++) {
              newAsteroids.push(createAsteroid(childSize, { ...a.pos }, config.speedMult));
            }
          }

          game.asteroids.splice(ai, 1);
        }
      }

      game.bullets = game.bullets.filter((_, i) => !bulletsToRemove.has(i));
      game.asteroids.push(...newAsteroids);

      // ── Scrap drops (roguelite) ──
      if (isRL && game.rlScrapDrops && rlStats) {
        const magnetRange = rlStats.magnetRange + (game.rlActiveBuffs?.some(b => b.id === 'scrapMagnet') ? 300 : 0);

        game.rlScrapDrops = game.rlScrapDrops.filter(s => {
          // Magnet pull
          if (magnetRange > 0) {
            const d = dist(game.ship.pos, { x: s.x, y: s.y });
            if (d < magnetRange) {
              const pull = 0.1 * (1 - d / magnetRange);
              s.vx += (game.ship.pos.x - s.x) * pull;
              s.vy += (game.ship.pos.y - s.y) * pull;
            }
          }

          s.x += s.vx;
          s.y += s.vy;
          s.vx *= 0.98;
          s.vy *= 0.98;
          s.life -= dt;

          // Collection
          if (dist(game.ship.pos, { x: s.x, y: s.y }) < 25) {
            game.rlScrap = (game.rlScrap ?? 0) + s.value;
            if (game.rlRunStats) game.rlRunStats.scrapEarned += s.value;
            // Artifact: scrapVampire — heal 1 HP per 500 scrap
            if (hasArt('scrapVampire') && rlStats) {
              game.rlScrapHealCounter = (game.rlScrapHealCounter ?? 0) + s.value;
              if (game.rlScrapHealCounter >= 500) {
                game.rlScrapHealCounter -= 500;
                if (game.lives < rlStats.maxLives) {
                  game.lives++;
                  game.particles.push(...makeParticles(game.ship.pos, 8, '#a78bfa'));
                }
              }
            }
            return false;
          }

          return s.life > 0;
        });
      }

      // ── Drone companion (roguelite) ──
      if (isRL && game.rlActiveBuffs?.some(b => b.id === 'drone')) {
        if (!game.rlDrone) game.rlDrone = { angle: 0, fireTimer: 0 };
        const drone = game.rlDrone;
        drone.angle += 0.03;
        const droneX = game.ship.pos.x + Math.cos(drone.angle) * 40;
        const droneY = game.ship.pos.y + Math.sin(drone.angle) * 40;

        drone.fireTimer -= dt;
        if (drone.fireTimer <= 0 && game.asteroids.length > 0) {
          drone.fireTimer = 400; // fire every 400ms
          // Find nearest asteroid
          let nearest = game.asteroids[0];
          let nearestD = Infinity;
          for (const ast of game.asteroids) {
            const d = dist({ x: droneX, y: droneY }, ast.pos);
            if (d < nearestD) { nearestD = d; nearest = ast; }
          }
          const angle = Math.atan2(nearest.pos.y - droneY, nearest.pos.x - droneX);
          game.bullets.push({
            pos: { x: droneX, y: droneY },
            vel: { x: Math.cos(angle) * BULLET_SPEED, y: Math.sin(angle) * BULLET_SPEED },
            life: BULLET_LIFE * bulletLifeMult,
          });
        }
      } else if (isRL) {
        game.rlDrone = null;
      }

      // ── Shield auto-recharge (roguelite) ──
      if (isRL && rlStats && rlStats.shieldRechargeMs < Infinity) {
        if (!game.hasShield && game.rlShieldCooldown !== undefined) {
          game.rlShieldCooldown -= dt;
          if (game.rlShieldCooldown <= 0) {
            game.hasShield = true;
            game.rlShieldCooldown = rlStats.shieldRechargeMs;
            game.particles.push(...makeParticles(game.ship.pos, 10, '#06b6d4'));
          }
        }
      }

      // ── Crit popups update (roguelite) ──
      if (isRL && game.rlCritPopups) {
        game.rlCritPopups = game.rlCritPopups.filter(p => {
          p.life -= dt;
          p.y -= 0.5; // float up
          return p.life > 0;
        });
      }

      // ── Ship-asteroid collision ──
      if (game.ship.invulnerable <= 0) {
        for (const a of game.asteroids) {
          // Scrap bonus event asteroids don't damage
          if (a.rlEventAsteroid && game.rlWaveEvent?.type === 'scrapBonus') continue;
          if (dist(game.ship.pos, a.pos) < a.radius + SHIP_SIZE * 0.6 * shipHitboxMult) {
            // Ship passive: phantom phase-through
            if (isRL && rlSaveRef.current?.selectedShip === 'phantom' && Math.random() < (SHIP_MAP['phantom'].phaseChance)) {
              game.particles.push(...makeParticles(game.ship.pos, 5, SHIP_MAP['phantom'].color));
              game.ship.invulnerable = 200;
              break;
            }
            // Artifact: ghostShip — 20% phase through
            if (hasArt('ghostShip') && Math.random() < 0.2) {
              game.particles.push(...makeParticles(game.ship.pos, 5, '#e2e8f0'));
              game.ship.invulnerable = 200;
              break;
            }
            // Shield absorbs the hit
            if (game.hasShield) {
              game.hasShield = false;
              game.activePowers = game.activePowers.filter(p => p.type !== 'shield');
              game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
              game.ship.invulnerable = 500; // brief invuln after shield break
              // Reset shield cooldown in roguelite
              if (isRL && rlStats && rlStats.shieldRechargeMs < Infinity) {
                game.rlShieldCooldown = rlStats.shieldRechargeMs;
              }
              break;
            }

            game.lives--;
            if (game.rlRunStats) game.rlRunStats.damageTaken++;
            game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
            sfx.deathSound();

            // Lose all active powers on death
            game.activePowers = [];
            game.hasShield = false;

            if (game.lives <= 0) {
              // Game over
              sfx.gameOverSound();
              setDisplayScore(game.score);
              setDisplayLives(0);
              setPhase('ended');

              if (!savedRef.current) {
                savedRef.current = true;
                const updated = updateStats(game.score, game.wave, game.asteroidsDestroyed);
                setStats(updated);
              }

              // Save roguelite scrap + check milestones
              if (isRL && rlSaveRef.current) {
                const earned = game.rlScrap ?? 0;
                let updatedSave = addScrap(rlSaveRef.current, earned);
                updatedSave = {
                  ...updatedSave,
                  totalRuns: updatedSave.totalRuns + 1,
                  bestWave: Math.max(updatedSave.bestWave, game.wave),
                  bestScore: Math.max(updatedSave.bestScore, game.score),
                  totalAsteroidsKilled: updatedSave.totalAsteroidsKilled + (game.rlRunStats?.asteroidsDestroyed ?? 0),
                  totalBossesKilled: updatedSave.totalBossesKilled + (game.rlRunStats?.bossesKilled ?? 0),
                  bestRunScrap: Math.max(updatedSave.bestRunScrap, earned),
                };
                // Persist bestiary encounters
                if (game.rlBestiaryEncounters) {
                  for (const key of game.rlBestiaryEncounters) {
                    updatedSave = recordBestiaryEncounter(updatedSave, key, game.wave);
                  }
                }
                // Check milestones
                const newMs = checkMilestones(updatedSave, game.rlRunStats ?? defaultRunStats(), game.wave, game.rlMegaBossDefeated ?? false, game.rlNoDamageBoss ?? false, false);
                if (newMs.length > 0) {
                  updatedSave = applyMilestones(updatedSave, newMs);
                  setNewMilestones(newMs.map(id => MILESTONES.find(m => m.id === id)!).filter(Boolean));
                }
                saveRogueliteSave(updatedSave);
                if (cloudActive) syncRogueliteSave(updatedSave as unknown as Record<string, unknown>);
                setRlSave(updatedSave);
                setDisplayScrap(earned);
                // Save daily run result
                if (game.rlIsDaily) {
                  const dr: DailyRunResult = { date: getDailyRunDate(), wave: game.wave, score: game.score, scrap: earned };
                  saveDailyRun(dr);
                  setDailyResult(dr);
                  setIsDailyRun(false);
                }
              }
              return;
            }

            // Reset ship position
            game.ship.pos = { x: W / 2, y: H / 2 };
            game.ship.vel = { x: 0, y: 0 };
            game.ship.angle = -Math.PI / 2;
            game.ship.invulnerable = INVULN_TIME;
            game.rlNoDamageBoss = false;
            break;
          }
        }
      }

      // ── Boss update ──
      if (game.boss && game.boss.alive) {
        const boss = game.boss;
        // Movement: drift around, bounce off edges
        boss.x += boss.vx * timeSlowMult;
        boss.y += boss.vy * timeSlowMult;
        if (boss.x < BOSS_RADIUS) { boss.x = BOSS_RADIUS; boss.vx = Math.abs(boss.vx); }
        if (boss.x > W - BOSS_RADIUS) { boss.x = W - BOSS_RADIUS; boss.vx = -Math.abs(boss.vx); }
        if (boss.y < BOSS_RADIUS) { boss.y = BOSS_RADIUS; boss.vy = Math.abs(boss.vy); }
        if (boss.y > H - BOSS_RADIUS) { boss.y = H - BOSS_RADIUS; boss.vy = -Math.abs(boss.vy); }

        // Boss carrier spawns (roguelite)
        if (isRL && boss.rlVariant === 'carrier') {
          boss.rlSpawnTimer = (boss.rlSpawnTimer ?? 0) - 1;
          if (boss.rlSpawnTimer <= 0) {
            boss.rlSpawnTimer = BOSS_VARIANT_CONFIG.carrier.spawnInterval!;
            // Spawn 2 small asteroids near boss
            for (let i = 0; i < 2; i++) {
              const ast = createAsteroid(2, { x: boss.x + (Math.random() - 0.5) * 40, y: boss.y + 30 }, config.speedMult);
              assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
              game.asteroids.push(ast);
            }
          }
        }

        // Boss shield regeneration (roguelite)
        if (isRL && boss.rlVariant === 'shield' && boss.rlShieldHp !== undefined && boss.rlShieldMaxHp !== undefined) {
          if (boss.rlShieldHp < boss.rlShieldMaxHp) {
            boss.rlShieldRegenTimer = (boss.rlShieldRegenTimer ?? 0) + 1;
            if (boss.rlShieldRegenTimer >= 150) {
              boss.rlShieldHp = Math.min(boss.rlShieldHp + 1, boss.rlShieldMaxHp);
              boss.rlShieldRegenTimer = 0;
            }
          }
        }

        // Fire at player
        boss.fireTimer--;
        if (boss.fireTimer <= 0) {
          boss.fireTimer = isRL && boss.rlVariant
            ? BOSS_VARIANT_CONFIG[boss.rlVariant].fireInterval
            : BOSS_FIRE_INTERVAL;
          const dx = game.ship.pos.x - boss.x;
          const dy = game.ship.pos.y - boss.y;
          const angle = Math.atan2(dy, dx);
          game.bossBullets.push({
            pos: { x: boss.x, y: boss.y },
            vel: { x: Math.cos(angle) * BOSS_BULLET_SPEED, y: Math.sin(angle) * BOSS_BULLET_SPEED },
            life: BOSS_BULLET_LIFE,
          });
          // Twin fires extra bullet at offset angle
          if (isRL && boss.rlVariant === 'twin') {
            const offAngle = angle + 0.3;
            game.bossBullets.push({
              pos: { x: boss.x, y: boss.y },
              vel: { x: Math.cos(offAngle) * BOSS_BULLET_SPEED, y: Math.sin(offAngle) * BOSS_BULLET_SPEED },
              life: BOSS_BULLET_LIFE,
            });
          }
        }

        // Check player bullets hitting boss
        for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
          if (dist(game.bullets[bi].pos, { x: boss.x, y: boss.y }) < BOSS_RADIUS) {
            game.bullets.splice(bi, 1);

            // Boss shield absorbs damage first (roguelite)
            if (isRL && boss.rlVariant === 'shield' && boss.rlShieldHp !== undefined && boss.rlShieldHp > 0) {
              boss.rlShieldHp--;
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 5, '#06b6d4'));
              sfx.explosionSound();
              continue;
            }

            const dmg = (isRL && rlStats) ? Math.ceil(rlStats.bulletDamage * bulletDmgMult) : 1;
            boss.hp -= dmg;
            game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 5, '#ef4444'));
            sfx.explosionSound();
            if (boss.hp <= 0) {
              boss.alive = false;
              game.score += BOSS_POINTS;
              if (game.rlRunStats) game.rlRunStats.bossesKilled++;
              if (game.rlBestiaryEncounters) game.rlBestiaryEncounters.add(`boss_${boss.rlVariant || 'standard'}`);
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 40, '#f97316'));
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 30, '#ef4444'));
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 20, '#eab308'));
              sfx.bigExplosionSound();

              // Scrap drop from boss (roguelite, with ascension bonus)
              if (isRL && game.rlScrapDrops && rlStats) {
                const ascBonus = rlSaveRef.current ? getAscensionScrapBonus(rlSaveRef.current.ascensionLevel ?? 0) : 1;
                const curseMult = game.rlCurses?.length ? getCurseScrapMultiplier(game.rlCurses) : 1;
                const scrapMult = rlStats.scrapMultiplier * ascBonus * curseMult * dailyScrapMult * (hasDM('richBosses') ? 5 : 1) * (game.rlActiveBuffs?.some(b => b.id === 'doubleScrap') ? 2 : 1);
                const val = Math.ceil(BASE_SCRAP_VALUES.boss * scrapMult);
                game.rlScrapDrops.push({
                  x: boss.x, y: boss.y,
                  vx: (Math.random() - 0.5) * 2,
                  vy: (Math.random() - 0.5) * 2,
                  value: val,
                  life: 8000,
                });
              }

              // Artifact drop: offer 2 random artifacts after boss kill
              if (isRL && game.rlArtifacts && game.rlArtifacts.length < ARTIFACTS.length) {
                const artChoices = pickRandomArtifacts(2, game.rlArtifacts);
                if (artChoices.length > 0) {
                  setArtifactChoices(artChoices);
                  setPhase('artifact_choice');
                  const ctx2 = canvasRef.current?.getContext('2d');
                  if (ctx2) drawGame(ctx2, game, starsRef.current, modeRef.current);
                  // Don't proceed with wave — will resume when artifact is chosen
                  game.boss = null;
                  game.bossBullets = [];
                  game.bossDefeatedTimer = 2000;
                  game.wave++;
                  if (game.rlRunStats) game.rlRunStats.wavesCleared++;
                  break;
                }
              }

              game.boss = null;
              game.bossBullets = [];
              game.bossDefeatedTimer = 2000;
              // Proceed to next wave after boss
              game.wave++;

              // Buff decrement + regen on wave clear (roguelite)
              if (isRL && game.rlActiveBuffs) {
                game.rlActiveBuffs = game.rlActiveBuffs.filter(b => {
                  if (b.wavesRemaining === 0) return true;
                  b.wavesRemaining--;
                  return b.wavesRemaining > 0;
                });
                if (game.rlActiveBuffs.some(b => b.id === 'regeneration')) {
                  game.rlRegenCounter = (game.rlRegenCounter ?? 0) + 1;
                  if (game.rlRegenCounter >= 5) {
                    game.rlRegenCounter = 0;
                    const maxLives = rlStats ? rlStats.maxLives : 3;
                    if (game.lives < maxLives) {
                      game.lives++;
                      game.particles.push(...makeParticles(game.ship.pos, 10, '#4ade80'));
                    }
                  }
                }
              }

              const count = config.startCount + (game.wave - 1) * config.countIncrement;
              const newWaveAsteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult);
              if (isRL) {
                for (const ast of newWaveAsteroids) {
                  assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
                }
              }
              game.asteroids = newWaveAsteroids;
              game.ship.invulnerable = Math.max(game.ship.invulnerable, 1500);
              break;
            }
          }
        }
      }

      // ── Update boss bullets ──
      game.bossBullets = game.bossBullets.filter(b => {
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;
        b.life -= dt;
        return b.life > 0 && b.pos.x > -10 && b.pos.x < W + 10 && b.pos.y > -10 && b.pos.y < H + 10;
      });

      // ── Boss bullet hitting ship ──
      if (game.ship.invulnerable <= 0) {
        for (let bi = game.bossBullets.length - 1; bi >= 0; bi--) {
          if (dist(game.bossBullets[bi].pos, game.ship.pos) < SHIP_SIZE * 0.8 * shipHitboxMult) {
            game.bossBullets.splice(bi, 1);
            if (game.hasShield) {
              game.hasShield = false;
              game.activePowers = game.activePowers.filter(p => p.type !== 'shield');
              game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
              game.ship.invulnerable = 500;
              if (isRL && rlStats && rlStats.shieldRechargeMs < Infinity) {
                game.rlShieldCooldown = rlStats.shieldRechargeMs;
              }
            } else {
              game.lives--;
              game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
              sfx.deathSound();
              game.activePowers = [];
              game.hasShield = false;
              if (game.lives <= 0) {
                sfx.gameOverSound();
                setDisplayScore(game.score);
                setDisplayLives(0);
                setPhase('ended');
                if (!savedRef.current) {
                  savedRef.current = true;
                  const updated = updateStats(game.score, game.wave, game.asteroidsDestroyed);
                  setStats(updated);
                }
                // Save roguelite scrap + check milestones
                if (isRL && rlSaveRef.current) {
                  const earned = game.rlScrap ?? 0;
                  let updatedSave = addScrap(rlSaveRef.current, earned);
                  updatedSave = { ...updatedSave, totalRuns: updatedSave.totalRuns + 1, bestWave: Math.max(updatedSave.bestWave, game.wave), bestScore: Math.max(updatedSave.bestScore, game.score), totalAsteroidsKilled: updatedSave.totalAsteroidsKilled + (game.rlRunStats?.asteroidsDestroyed ?? 0), totalBossesKilled: updatedSave.totalBossesKilled + (game.rlRunStats?.bossesKilled ?? 0), bestRunScrap: Math.max(updatedSave.bestRunScrap, earned) };
                  if (game.rlBestiaryEncounters) { for (const key of game.rlBestiaryEncounters) { updatedSave = recordBestiaryEncounter(updatedSave, key, game.wave); } }
                  const newMs = checkMilestones(updatedSave, game.rlRunStats ?? defaultRunStats(), game.wave, game.rlMegaBossDefeated ?? false, game.rlNoDamageBoss ?? false, false);
                  if (newMs.length > 0) { updatedSave = applyMilestones(updatedSave, newMs); setNewMilestones(newMs.map(id => MILESTONES.find(m => m.id === id)!).filter(Boolean)); }
                  saveRogueliteSave(updatedSave);
                  if (cloudActive) syncRogueliteSave(updatedSave as unknown as Record<string, unknown>);
                  setRlSave(updatedSave);
                  setDisplayScrap(earned);
                  if (game.rlIsDaily) { const dr: DailyRunResult = { date: getDailyRunDate(), wave: game.wave, score: game.score, scrap: earned }; saveDailyRun(dr); setDailyResult(dr); setIsDailyRun(false); }
                }
                return;
              }
              game.ship.pos = { x: W / 2, y: H / 2 };
              game.ship.vel = { x: 0, y: 0 };
              game.ship.angle = -Math.PI / 2;
              game.ship.invulnerable = INVULN_TIME;
            }
            break;
          }
        }
      }

      // ── Boss defeated timer ──
      if (game.bossDefeatedTimer > 0) {
        game.bossDefeatedTimer -= dt;
      }

      // ── Mega-boss update (roguelite) ──
      if (isRL && game.rlMegaBoss && !game.rlMegaBoss.defeated) {
        const mb = game.rlMegaBoss;
        const mbR = MEGA_BOSS_CONFIG.radius;

        // Movement: slow drift, bounce off edges
        const mbSpeed = 0.4;
        if (!mb.x) mb.x = W / 2;
        if (!mb.y) mb.y = 120;
        mb.x += Math.sin(now * 0.0005) * mbSpeed;
        mb.y += Math.cos(now * 0.0003) * mbSpeed * 0.5;
        mb.x = Math.max(mbR, Math.min(W - mbR, mb.x));
        mb.y = Math.max(mbR, Math.min(H * 0.5, mb.y));

        // Phase: shield — rotating shield segments, fire at player
        if (mb.phase === 'shield') {
          mb.shieldRotation += 0.01;
          // Fire bullets
          mb.teleportTimer -= dt;
          if (mb.teleportTimer <= 0) {
            mb.teleportTimer = MEGA_BOSS_CONFIG.phases.shield.fireInterval * 16;
            const dx = game.ship.pos.x - mb.x;
            const dy = game.ship.pos.y - mb.y;
            const angle = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) {
              game.bossBullets.push({
                pos: { x: mb.x, y: mb.y },
                vel: { x: Math.cos(angle + i * 0.2) * 3, y: Math.sin(angle + i * 0.2) * 3 },
                life: 3000,
              });
            }
          }

          // Check bullets hitting shield segments
          for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
            const b = game.bullets[bi];
            const d = dist(b.pos, { x: mb.x, y: mb.y });
            if (d < mbR + 10) {
              const bAngle = Math.atan2(b.pos.y - mb.y, b.pos.x - mb.x);
              const segAngle = ((bAngle - mb.shieldRotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
              const segIdx = Math.floor(segAngle / (Math.PI * 2 / mb.shieldSegments.length));
              if (mb.shieldSegments[segIdx]) {
                mb.shieldSegments[segIdx] = false;
                game.bullets.splice(bi, 1);
                game.particles.push(...makeParticles(b.pos, 5, '#38bdf8'));
              } else if (d < mbR - 10) {
                // Hit core through destroyed segment
                mb.phaseHp -= (rlStats?.bulletDamage ?? 1);
                game.bullets.splice(bi, 1);
                game.particles.push(...makeParticles(b.pos, 5, '#ef4444'));
              }
            }
          }
        }

        // Phase: swarm — spawn homing missiles
        if (mb.phase === 'swarm') {
          mb.teleportTimer -= dt;
          if (mb.teleportTimer <= 0) {
            mb.teleportTimer = MEGA_BOSS_CONFIG.phases.swarm.spawnInterval * 16;
            const angle = Math.random() * Math.PI * 2;
            mb.homingMissiles.push({
              x: mb.x + Math.cos(angle) * mbR,
              y: mb.y + Math.sin(angle) * mbR,
              vx: Math.cos(angle) * MEGA_BOSS_CONFIG.phases.swarm.missileSpeed,
              vy: Math.sin(angle) * MEGA_BOSS_CONFIG.phases.swarm.missileSpeed,
              life: 5000,
            });
          }

          // Update missiles
          mb.homingMissiles = mb.homingMissiles.filter(m => {
            const dx = game.ship.pos.x - m.x;
            const dy = game.ship.pos.y - m.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 5) {
              m.vx += (dx / d) * 0.05;
              m.vy += (dy / d) * 0.05;
            }
            m.x += m.vx;
            m.y += m.vy;
            m.life -= dt;

            // Hit player
            if (game.ship.invulnerable <= 0 && dist(game.ship.pos, { x: m.x, y: m.y }) < 15) {
              if (game.hasShield) {
                game.hasShield = false;
                game.activePowers = game.activePowers.filter(p => p.type !== 'shield');
                game.ship.invulnerable = 500;
              } else {
                game.lives--;
                if (game.rlRunStats) game.rlRunStats.damageTaken++;
                game.rlNoDamageBoss = false;
                game.particles.push(...makeParticles(game.ship.pos, 15, '#f87171'));
                sfx.deathSound();
                game.ship.invulnerable = INVULN_TIME;
              }
              return false;
            }
            return m.life > 0;
          });

          // Check bullets hitting mega-boss core in swarm phase
          for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
            if (dist(game.bullets[bi].pos, { x: mb.x, y: mb.y }) < mbR * 0.6) {
              mb.phaseHp -= (rlStats?.bulletDamage ?? 1);
              game.particles.push(...makeParticles(game.bullets[bi].pos, 3, '#ef4444'));
              game.bullets.splice(bi, 1);
            }
          }
        }

        // Phase: core — teleports, rapid fire
        if (mb.phase === 'core') {
          mb.teleportTimer -= dt;
          if (mb.teleportTimer <= 0) {
            mb.teleportTimer = MEGA_BOSS_CONFIG.phases.core.teleportInterval;
            mb.x = 100 + Math.random() * (W - 200);
            mb.y = 80 + Math.random() * (H * 0.4);
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 10, '#f59e0b'));
          }

          // Rapid fire
          if (Math.floor(now / (MEGA_BOSS_CONFIG.phases.core.fireInterval * 16)) !== Math.floor((now - dt) / (MEGA_BOSS_CONFIG.phases.core.fireInterval * 16))) {
            const angle = Math.atan2(game.ship.pos.y - mb.y, game.ship.pos.x - mb.x);
            game.bossBullets.push({
              pos: { x: mb.x, y: mb.y },
              vel: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 },
              life: 2000,
            });
          }

          // Check bullets hitting core
          for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
            if (dist(game.bullets[bi].pos, { x: mb.x, y: mb.y }) < mbR * 0.5) {
              mb.phaseHp -= (rlStats?.bulletDamage ?? 1);
              game.particles.push(...makeParticles(game.bullets[bi].pos, 3, '#ef4444'));
              game.bullets.splice(bi, 1);
            }
          }
        }

        // Phase transition
        if (mb.phaseHp <= 0 && !mb.defeated) {
          if (mb.phase === 'shield') {
            mb.phase = 'swarm';
            const swarmHp = Math.ceil(MEGA_BOSS_CONFIG.phases.swarm.hp * (mb.hpScale ?? 1));
            mb.phaseHp = swarmHp;
            mb.phaseMaxHp = swarmHp;
            mb.teleportTimer = MEGA_BOSS_CONFIG.phases.swarm.spawnInterval * 16;
            mb.homingMissiles = [];
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 30, '#38bdf8'));
          } else if (mb.phase === 'swarm') {
            mb.phase = 'core';
            const coreHp = Math.ceil(MEGA_BOSS_CONFIG.phases.core.hp * (mb.hpScale ?? 1));
            mb.phaseHp = coreHp;
            mb.phaseMaxHp = coreHp;
            mb.teleportTimer = MEGA_BOSS_CONFIG.phases.core.teleportInterval;
            mb.homingMissiles = [];
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 30, '#f59e0b'));
          } else {
            // Defeated!
            mb.defeated = true;
            game.rlMegaBossDefeated = true;
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 60, '#f59e0b'));
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 40, '#ef4444'));
            game.particles.push(...makeParticles({ x: mb.x, y: mb.y }, 30, '#fbbf24'));
            sfx.bigExplosionSound();
            if (game.rlRunStats) game.rlRunStats.bossesKilled++;
            if (game.rlBestiaryEncounters) game.rlBestiaryEncounters.add('megaboss');

            // Mega scrap reward
            if (game.rlScrapDrops && rlStats) {
              const ascBonus = rlSaveRef.current ? getAscensionScrapBonus(rlSaveRef.current.ascensionLevel ?? 0) : 1;
              const curseMult = game.rlCurses?.length ? getCurseScrapMultiplier(game.rlCurses) : 1;
              const val = Math.ceil(MEGA_BOSS_CONFIG.scrapReward * rlStats.scrapMultiplier * ascBonus * curseMult * dailyScrapMult * (hasDM('richBosses') ? 5 : 1));
              for (let i = 0; i < 5; i++) {
                game.rlScrapDrops.push({
                  x: mb.x + (Math.random() - 0.5) * 60, y: mb.y + (Math.random() - 0.5) * 60,
                  vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                  value: Math.ceil(val / 5), life: 10000,
                });
              }
            }

            // Artifact drop
            if (game.rlArtifacts && game.rlArtifacts.length < ARTIFACTS.length) {
              const artChoices = pickRandomArtifacts(2, game.rlArtifacts);
              if (artChoices.length > 0) {
                setArtifactChoices(artChoices);
                setPhase('artifact_choice');
                const ctx2 = canvasRef.current?.getContext('2d');
                if (ctx2) drawGame(ctx2, game, starsRef.current, modeRef.current);
              }
            }

            game.bossDefeatedTimer = 3000;
            game.wave++;
            if (game.rlRunStats) game.rlRunStats.wavesCleared++;
            game.rlMegaBoss = null;

            // Spawn next wave
            const nextCount = config.startCount + (game.wave - 1) * config.countIncrement;
            const newWaveAsteroids = spawnWaveAsteroids(nextCount, game.ship.pos, config.speedMult);
            for (const ast of newWaveAsteroids) assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
            game.asteroids = newWaveAsteroids;
            game.ship.invulnerable = Math.max(game.ship.invulnerable, 2000);
          }
        }

        // Mega-boss ship collision
        if (game.ship.invulnerable <= 0 && !mb.defeated) {
          if (dist(game.ship.pos, { x: mb.x, y: mb.y }) < mbR + SHIP_SIZE) {
            game.rlNoDamageBoss = false;
            if (game.hasShield) {
              game.hasShield = false;
              game.activePowers = game.activePowers.filter(p => p.type !== 'shield');
              game.ship.invulnerable = 500;
            } else {
              game.lives--;
              if (game.rlRunStats) game.rlRunStats.damageTaken++;
              game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
              sfx.deathSound();
              game.activePowers = [];
              game.hasShield = false;
              if (game.lives <= 0) {
                sfx.gameOverSound();
                setDisplayScore(game.score);
                setDisplayLives(0);
                setPhase('ended');
                if (!savedRef.current) { savedRef.current = true; const updated = updateStats(game.score, game.wave, game.asteroidsDestroyed); setStats(updated); }
                if (rlSaveRef.current) {
                  const earned = game.rlScrap ?? 0;
                  let updatedSave = addScrap(rlSaveRef.current, earned);
                  updatedSave = { ...updatedSave, totalRuns: updatedSave.totalRuns + 1, bestWave: Math.max(updatedSave.bestWave, game.wave), bestScore: Math.max(updatedSave.bestScore, game.score), totalAsteroidsKilled: updatedSave.totalAsteroidsKilled + (game.rlRunStats?.asteroidsDestroyed ?? 0), totalBossesKilled: updatedSave.totalBossesKilled + (game.rlRunStats?.bossesKilled ?? 0), bestRunScrap: Math.max(updatedSave.bestRunScrap, earned) };
                  if (game.rlBestiaryEncounters) { for (const key of game.rlBestiaryEncounters) { updatedSave = recordBestiaryEncounter(updatedSave, key, game.wave); } }
                  const newMs = checkMilestones(updatedSave, game.rlRunStats ?? defaultRunStats(), game.wave, game.rlMegaBossDefeated ?? false, game.rlNoDamageBoss ?? false, false);
                  if (newMs.length > 0) { updatedSave = applyMilestones(updatedSave, newMs); setNewMilestones(newMs.map(id => MILESTONES.find(m => m.id === id)!).filter(Boolean)); }
                  saveRogueliteSave(updatedSave);
                  if (cloudActive) syncRogueliteSave(updatedSave as unknown as Record<string, unknown>);
                  setRlSave(updatedSave);
                  setDisplayScrap(earned);
                  if (game.rlIsDaily) { const dr: DailyRunResult = { date: getDailyRunDate(), wave: game.wave, score: game.score, scrap: earned }; saveDailyRun(dr); setDailyResult(dr); setIsDailyRun(false); }
                }
                return;
              }
              game.ship.pos = { x: W / 2, y: H / 2 };
              game.ship.vel = { x: 0, y: 0 };
              game.ship.angle = -Math.PI / 2;
              game.ship.invulnerable = INVULN_TIME;
            }
          }
        }
      }

      // ── Ship-boss collision ──
      if (game.boss && game.boss.alive && game.ship.invulnerable <= 0) {
        if (dist(game.ship.pos, { x: game.boss.x, y: game.boss.y }) < BOSS_RADIUS + SHIP_SIZE * 0.6 * shipHitboxMult) {
          if (game.hasShield) {
            game.hasShield = false;
            game.activePowers = game.activePowers.filter(p => p.type !== 'shield');
            game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
            game.ship.invulnerable = 500;
            if (isRL && rlStats && rlStats.shieldRechargeMs < Infinity) {
              game.rlShieldCooldown = rlStats.shieldRechargeMs;
            }
          } else {
            game.lives--;
            if (game.rlRunStats) game.rlRunStats.damageTaken++;
            game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
            sfx.deathSound();
            game.activePowers = [];
            game.hasShield = false;
            if (game.lives <= 0) {
              sfx.gameOverSound();
              setDisplayScore(game.score);
              setDisplayLives(0);
              setPhase('ended');
              if (!savedRef.current) {
                savedRef.current = true;
                const updated = updateStats(game.score, game.wave, game.asteroidsDestroyed);
                setStats(updated);
              }
              // Save roguelite scrap + bestiary + milestones
              if (isRL && rlSaveRef.current) {
                const earned = game.rlScrap ?? 0;
                let updatedSave = addScrap(rlSaveRef.current, earned);
                updatedSave = { ...updatedSave, totalRuns: updatedSave.totalRuns + 1, bestWave: Math.max(updatedSave.bestWave, game.wave), bestScore: Math.max(updatedSave.bestScore, game.score), totalAsteroidsKilled: updatedSave.totalAsteroidsKilled + (game.rlRunStats?.asteroidsDestroyed ?? 0), totalBossesKilled: updatedSave.totalBossesKilled + (game.rlRunStats?.bossesKilled ?? 0), bestRunScrap: Math.max(updatedSave.bestRunScrap, earned) };
                if (game.rlBestiaryEncounters) { for (const key of game.rlBestiaryEncounters) { updatedSave = recordBestiaryEncounter(updatedSave, key, game.wave); } }
                const newMs = checkMilestones(updatedSave, game.rlRunStats ?? defaultRunStats(), game.wave, game.rlMegaBossDefeated ?? false, game.rlNoDamageBoss ?? false, false);
                if (newMs.length > 0) { updatedSave = applyMilestones(updatedSave, newMs); setNewMilestones(newMs.map(id => MILESTONES.find(m => m.id === id)!).filter(Boolean)); }
                saveRogueliteSave(updatedSave);
                if (cloudActive) syncRogueliteSave(updatedSave as unknown as Record<string, unknown>);
                setRlSave(updatedSave);
                setDisplayScrap(earned);
                if (game.rlIsDaily) { const dr: DailyRunResult = { date: getDailyRunDate(), wave: game.wave, score: game.score, scrap: earned }; saveDailyRun(dr); setDailyResult(dr); setIsDailyRun(false); }
              }
              return;
            }
            game.ship.pos = { x: W / 2, y: H / 2 };
            game.ship.vel = { x: 0, y: 0 };
            game.ship.angle = -Math.PI / 2;
            game.ship.invulnerable = INVULN_TIME;
          }
        }
      }

      // ── Wave cleared ──
      if (game.asteroids.length === 0 && !game.boss && !game.rlWaveEvent) {
        game.wave++;
        if (isRL && game.rlRunStats) game.rlRunStats.wavesCleared++;
        sfx.levelUpSound();

        // Buff wave decrement (roguelite)
        if (isRL && game.rlActiveBuffs) {
          game.rlActiveBuffs = game.rlActiveBuffs.filter(b => {
            if (b.wavesRemaining === 0) return true; // permanent for run
            b.wavesRemaining--;
            return b.wavesRemaining > 0;
          });

          // Regeneration check
          if (game.rlActiveBuffs.some(b => b.id === 'regeneration')) {
            game.rlRegenCounter = (game.rlRegenCounter ?? 0) + 1;
            if (game.rlRegenCounter >= 5) {
              game.rlRegenCounter = 0;
              const maxLives = rlStats ? rlStats.maxLives : 3;
              if (game.lives < maxLives) {
                game.lives++;
                game.particles.push(...makeParticles(game.ship.pos, 10, '#4ade80'));
              }
            }
          }
        }

        // Buff choice every 3 waves in roguelite (not on boss waves)
        if (isRL && game.wave > 1 && (game.wave - 1) % 3 === 0 && !isBossWave(game.wave)) {
          const choices = pickRandomBuffs(3, game.rlActiveBuffs ?? []);
          setBuffChoices(choices);
          setPhase('buff_choice');
          // Draw current frame before pausing
          const ctx2 = canvasRef.current?.getContext('2d');
          if (ctx2) drawGame(ctx2, game, starsRef.current, modeRef.current);
          return; // pause game loop; wave spawning happens when buff is chosen
        }

        // Wave event (roguelite, 20% chance, not on boss waves)
        if (isRL && !isBossWave(game.wave)) {
          const eventType = rollWaveEvent(game.wave);
          if (eventType) {
            const evtCfg = WAVE_EVENT_CONFIG[eventType];
            game.rlWaveEvent = { type: eventType, timer: evtCfg.duration };
            setWaveEventAnnounce({ nameKey: evtCfg.nameKey, descKey: evtCfg.descKey });
            setPhase('wave_event_announce');
            const ctx2 = canvasRef.current?.getContext('2d');
            if (ctx2) drawGame(ctx2, game, starsRef.current, modeRef.current);
            return;
          }
        }

        // Mega-boss at wave 25, 50, 75... (scales with each encounter)
        if (isRL && isMegaBossWave(game.wave)) {
          const megaScale = getMegaBossHpScale(game.wave);
          const megaShieldHp = Math.ceil(MEGA_BOSS_CONFIG.phases.shield.hp * megaScale);
          game.rlMegaBoss = {
            phase: 'shield',
            phaseHp: megaShieldHp,
            phaseMaxHp: megaShieldHp,
            hpScale: megaScale,
            shieldRotation: 0,
            shieldSegments: Array(MEGA_BOSS_CONFIG.phases.shield.segments).fill(true),
            homingMissiles: [],
            teleportTimer: MEGA_BOSS_CONFIG.phases.core.teleportInterval,
            transitionTimer: 0,
            x: W / 2,
            y: 120,
            defeated: false,
          };
          game.rlNoDamageBoss = true;
          game.asteroids = [];
          game.bossBullets = [];
        } else if (isBossWave(game.wave)) {
          // Boss wave
          if (isRL) {
            const variant = getBossVariantForWave(game.wave);
            const cfg = BOSS_VARIANT_CONFIG[variant];
            const berserker = game.rlCurses?.includes('berserker');
            const waveScale = getBossWaveHpScale(game.wave);
            const hpMult = waveScale * (berserker ? 1.5 : 1) * (hasDM('bossRush') ? 2 : 1);
            const fireMult = berserker ? 0.7 : 1;
            game.boss = {
              ...createBoss(),
              hp: Math.ceil(cfg.hp * hpMult),
              maxHp: Math.ceil(cfg.hp * hpMult),
              rlVariant: variant,
              rlShieldHp: cfg.shieldHp ?? 0,
              rlShieldMaxHp: cfg.shieldHp ?? 0,
              rlShieldRegenTimer: 0,
              rlSpawnTimer: cfg.spawnInterval ?? 0,
            };
            game.boss.fireTimer = Math.ceil((isRL ? cfg.fireInterval : BOSS_FIRE_INTERVAL) * fireMult);
            game.boss.vx = randomBetween(-cfg.speed, cfg.speed);
            game.boss.vy = randomBetween(cfg.speed * 0.3, cfg.speed);
            game.rlNoDamageBoss = true;
          } else {
            game.boss = createBoss();
          }
          game.bossBullets = [];
        } else {
          let count = config.startCount + (game.wave - 1) * config.countIncrement;
          if (isRL && game.rlCurses?.includes('swarm')) count = Math.ceil(count * 1.5);
          const newWaveAsteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult);
          if (isRL) {
            for (const ast of newWaveAsteroids) {
              assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
            }
          }
          game.asteroids = newWaveAsteroids;
        }
        game.ship.invulnerable = Math.max(game.ship.invulnerable, 1500);
      }

      // ── Update display state ──
      setDisplayScore(game.score);
      setDisplayLives(game.lives);
      setDisplayWave(game.wave);
      if (isRL) setDisplayScrap(game.rlScrap ?? 0);

      // ── Draw ──
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawGame(ctx, game, starsRef.current, modeRef.current);

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, difficulty]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Achievement tracking ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'countdown') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // When buff choice phase ends and we return to playing, spawn the next wave
  useEffect(() => {
    if (phase === 'playing' && gameRef.current && buffChoices === null) {
      const game = gameRef.current;
      // If asteroids are empty and no boss, spawn next wave (post-buff-choice)
      if (game.asteroids.length === 0 && !game.boss) {
        const config = DIFF_CONFIG[diffRef.current];
        if (isBossWave(game.wave)) {
          if (modeRef.current === 'roguelite') {
            const variant = getBossVariantForWave(game.wave);
            const cfg = BOSS_VARIANT_CONFIG[variant];
            const waveScale2 = getBossWaveHpScale(game.wave);
            const bossHpMult2 = waveScale2 * ((game.rlDailyModifiers ?? []).includes('bossRush') ? 2 : 1);
            game.boss = {
              ...createBoss(),
              hp: Math.ceil(cfg.hp * bossHpMult2),
              maxHp: Math.ceil(cfg.hp * bossHpMult2),
              rlVariant: variant,
              rlShieldHp: cfg.shieldHp ?? 0,
              rlShieldMaxHp: cfg.shieldHp ?? 0,
              rlShieldRegenTimer: 0,
              rlSpawnTimer: cfg.spawnInterval ?? 0,
            };
            game.boss.vx = randomBetween(-cfg.speed, cfg.speed);
            game.boss.vy = randomBetween(cfg.speed * 0.3, cfg.speed);
          } else {
            game.boss = createBoss();
          }
          game.bossBullets = [];
        } else {
          const count = config.startCount + (game.wave - 1) * config.countIncrement;
          const newWaveAsteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult);
          if (modeRef.current === 'roguelite') {
            for (const ast of newWaveAsteroids) {
              assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
            }
          }
          game.asteroids = newWaveAsteroids;
        }
        game.ship.invulnerable = Math.max(game.ship.invulnerable, 1500);
      }
    }
  }, [phase, buffChoices, difficulty]);

  // Wave event announcement → spawn event asteroids and resume
  useEffect(() => {
    if (phase !== 'wave_event_announce') return;
    const timer = setTimeout(() => {
      setWaveEventAnnounce(null);
      const game = gameRef.current;
      if (game && game.rlWaveEvent) {
        const config = DIFF_CONFIG[diffRef.current];
        const evtType = game.rlWaveEvent.type;
        const evtScale = getEventWaveScale(game.wave);
        if (evtType === 'scrapBonus') {
          // Spawn scrap-only asteroids (scales with wave)
          const count = Math.ceil(15 * evtScale);
          const asteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult * 0.6);
          for (const a of asteroids) {
            assignRogueliteAsteroidData(a, game.wave, game.rlDailyModifiers);
            a.rlScrapValue = Math.ceil((a.rlScrapValue ?? 5) * 3 * evtScale);
            a.rlEventAsteroid = true;
          }
          game.asteroids = asteroids;
        } else if (evtType === 'asteroidSprint') {
          // Dense field — 2x count (reduced from 3x), speed scales gently
          const count = Math.ceil((config.startCount + (game.wave - 1) * config.countIncrement) * 2);
          const asteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult * 1.25);
          for (const a of asteroids) {
            assignRogueliteAsteroidData(a, game.wave, game.rlDailyModifiers);
            a.rlEventAsteroid = true;
          }
          game.asteroids = asteroids;
        } else if (evtType === 'miniBossRush') {
          // Mini-bosses scale with wave
          const mbHp = Math.ceil(5 * evtScale);
          const mbAstHp = Math.ceil(8 * evtScale);
          const mbScrap = Math.ceil(100 * evtScale);
          game.asteroids = [];
          for (let i = 0; i < 3; i++) {
            if (i === 0) {
              const mb = createBoss();
              mb.hp = mbHp;
              mb.maxHp = mbHp;
              mb.x = 100 + i * 300;
              game.boss = mb;
            } else {
              const bigAst = createAsteroid(0, { x: 100 + i * 300, y: 80 }, config.speedMult);
              assignRogueliteAsteroidData(bigAst, game.wave);
              bigAst.rlHp = mbAstHp;
              bigAst.rlMaxHp = mbAstHp;
              bigAst.rlScrapValue = mbScrap;
              bigAst.rlEventAsteroid = true;
              game.asteroids.push(bigAst);
            }
          }
        } else if (evtType === 'meteorShower') {
          // Fast asteroids rain from the top
          const count = Math.ceil(20 * evtScale);
          for (let i = 0; i < count; i++) {
            const x = Math.random() * W;
            const ast = createAsteroid(Math.random() < 0.5 ? 1 : 2, { x, y: -20 }, config.speedMult * 2);
            ast.vel.y = Math.abs(ast.vel.y) + 2; // force downward
            ast.vel.x *= 0.3; // mostly vertical
            assignRogueliteAsteroidData(ast, game.wave, game.rlDailyModifiers);
            ast.rlScrapValue = Math.ceil((ast.rlScrapValue ?? 5) * 2);
            ast.rlEventAsteroid = true;
            game.asteroids.push(ast);
          }
        } else if (evtType === 'repairStation') {
          // Instant: heal 1 life + grant shield
          game.lives += 1;
          game.hasShield = true;
          game.rlWaveEvent = null; // instant, no timer
        }
      }
      setPhase('playing');
    }, 2000);
    return () => clearTimeout(timer);
  }, [phase]);

  // ── Start game ───────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setIsDailyRun(false);
    isDailyRef.current = false;
    setDailyModifiers([]);
    dailyModifiersRef.current = [];
    savedRef.current = false;
    const diff = mode === 'roguelite' ? 'medium' as Difficulty : difficulty;
    gameRef.current = initGame(diff, mode);
    setDisplayScore(0);
    const curses = activeCursesRef.current;
    const lives = mode === 'roguelite' && rlSave ? (curses.includes('glassCannon') ? 1 : getAppliedStats(rlSave.upgrades, rlSave.selectedShip).maxLives) : 3;
    setDisplayLives(lives);
    setDisplayWave(1);
    setDisplayScrap(0);
    setShowRunStats(false);
    setArtifactChoices(null);
    setWaveEventAnnounce(null);
    setNewMilestones([]);
    setPhase('countdown');
  }, [difficulty, mode, initGame, rlSave]);

  const handleStartDaily = useCallback(() => {
    if (hasDailyRunToday()) return;
    const mods = getDailyModifiers();
    const modIds = mods.map(m => m.id);
    setDailyModifiers(modIds);
    dailyModifiersRef.current = modIds;
    setIsDailyRun(true);
    isDailyRef.current = true;
    setActiveCurses([]);
    activeCursesRef.current = [];
    savedRef.current = false;
    gameRef.current = initGame('medium' as Difficulty, 'roguelite');
    setDisplayScore(0);
    const dmLives = modIds.includes('forcedGlassCannon') ? 1 : (rlSave ? getAppliedStats(rlSave.upgrades, rlSave.selectedShip).maxLives : 3);
    setDisplayLives(dmLives);
    setDisplayWave(1);
    setDisplayScrap(0);
    setShowRunStats(false);
    setArtifactChoices(null);
    setWaveEventAnnounce(null);
    setNewMilestones([]);
    setPhase('countdown');
  }, [initGame, rlSave]);

  const handleRestart = useCallback(() => {
    savedRef.current = false;
    const diff = mode === 'roguelite' ? 'medium' as Difficulty : difficulty;
    gameRef.current = initGame(diff, mode);
    setDisplayScore(0);
    const curses2 = activeCursesRef.current;
    const lives2 = mode === 'roguelite' && rlSave ? (curses2.includes('glassCannon') ? 1 : getAppliedStats(rlSave.upgrades, rlSave.selectedShip).maxLives) : 3;
    setDisplayLives(lives2);
    setDisplayWave(1);
    setDisplayScrap(0);
    setShowRunStats(false);
    setArtifactChoices(null);
    setWaveEventAnnounce(null);
    setNewMilestones([]);
    setPhase('countdown');
  }, [difficulty, mode, initGame, rlSave]);

  const handleResume = useCallback(() => {
    setPhase('playing');
  }, []);

  // Show run stats when game ends in roguelite mode
  useEffect(() => {
    if (phase === 'ended' && mode === 'roguelite' && gameRef.current?.rlRunStats) {
      setShowRunStats(true);
    }
  }, [phase, mode]);

  // ── Render ───────────────────────────────────────────────────────────────

  const diffLabels: Record<Difficulty, string> = {
    easy:   t('asteroids.easy'),
    medium: t('asteroids.medium'),
    hard:   t('asteroids.hard'),
  };

  return (
    <div className="flex flex-col items-center gap-3 flex-1 min-h-0">
      {phase === 'menu' ? (
        /* ── Menu ────────────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <h2 className="text-5xl font-black tracking-tight" style={{ color: 'var(--fg)' }}>
            Asteroids
          </h2>

          {/* Mode selector */}
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
              {t('asteroids.rl.selectMode')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('endless')}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors border ${
                  mode === 'endless'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                }`}
              >
                {t('asteroids.rl.endless')}
              </button>
              <button
                onClick={() => setMode('roguelite')}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors border ${
                  mode === 'roguelite'
                    ? 'bg-yellow-600 border-yellow-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                }`}
              >
                {t('asteroids.rl.mode')}
              </button>
            </div>
          </div>

          {/* Difficulty selector (endless only — roguelite uses fixed medium) */}
          {mode === 'endless' && (
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                {t('asteroids.difficulty')}
              </p>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-colors border ${
                      difficulty === d
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
                    }`}
                  >
                    {diffLabels[d]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start buttons — own row */}
          <div className="flex gap-3 items-center">
            <button onClick={handleStart} disabled={mode === 'roguelite' && !rlSave} className="px-10 py-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors disabled:opacity-50 cursor-pointer">{t('asteroids.start')}</button>
            {mode === 'roguelite' && rlSave && (
              <button onClick={() => setPhase('daily_preview')} className="px-6 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors cursor-pointer">🗓 {t('asteroids.rl.daily')}</button>
            )}
          </div>

          {/* Roguelite menu buttons — separate row below start */}
          {mode === 'roguelite' && rlSave && (
            <div className="flex gap-2 flex-wrap justify-center">
              <button onClick={() => setPhase('upgrades')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-yellow-600/90 hover:bg-yellow-500 text-white font-bold text-sm transition-colors cursor-pointer">⬆ {t('asteroids.rl.upgrades')}</button>
              <button onClick={() => setPhase('ship_select')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-sm transition-colors cursor-pointer">🚀 {t('asteroids.rl.ship.select')}</button>
              <button onClick={() => setPhase('curse_select')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-800/60 hover:border-red-600 text-red-400 hover:text-red-300 font-bold text-sm transition-colors cursor-pointer">🔥 {t('asteroids.rl.curses')}</button>
              <button onClick={() => setPhase('milestone_overview')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-700/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 font-bold text-sm transition-colors cursor-pointer">🏆 {t('asteroids.rl.milestones')}</button>
              <button onClick={() => setPhase('bestiary')} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-bold text-sm transition-colors cursor-pointer">📖 {t('asteroids.rl.bestiary')}</button>
            </div>
          )}

          <p className="text-xs max-sm:hidden" style={{ color: 'var(--muted)' }}>
            Arrow Keys / WASD + Space + P
          </p>

          {/* Stats */}
          {mode === 'endless' && stats && stats.games > 0 && (
            <div className="text-xs space-y-1 text-center" style={{ color: 'var(--muted)' }}>
              <p>{t('game.score')}: {stats.bestScore.toLocaleString()} (best)</p>
              <p>{t('asteroids.wave')}: {stats.bestWave} (best)</p>
              <p>{stats.totalAsteroids.toLocaleString()} {t('asteroids.totalDestroyed')}</p>
            </div>
          )}

          {/* Roguelite info overview */}
          {mode === 'roguelite' && rlSave && (
            <div className="w-full max-w-xl space-y-3">
              {/* Scrap + Ascension */}
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="text-yellow-400 font-bold">[S] {rlSave.scrap.toLocaleString()}</span>
                {(rlSave.ascensionLevel ?? 0) > 0 && <span className="text-amber-400 font-bold">⭐ {t('asteroids.rl.ascend.level')} {rlSave.ascensionLevel}</span>}
              </div>

              {/* Current ship + curses */}
              <div className="flex items-center justify-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                <span style={{ color: SHIP_MAP[rlSave.selectedShip].color }}>{SHIP_MAP[rlSave.selectedShip].icon} {t(SHIP_MAP[rlSave.selectedShip].nameKey)}</span>
                {activeCurses.length > 0 && <span className="text-red-400">{activeCurses.map(c => CURSES.find(cc => cc.id === c)?.icon).join(' ')} x{getCurseScrapMultiplier(activeCurses).toFixed(1)}</span>}
              </div>

              {/* Content guide button */}
              <button onClick={() => setPhase('content_guide')} className="w-full rounded-lg border border-zinc-700 hover:border-zinc-500 bg-zinc-800/40 hover:bg-zinc-800/70 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2">📋 {t('asteroids.rl.guide.open')}</button>

              {/* Run stats */}
              {rlSave.totalRuns > 0 && (
                <div className="flex items-center justify-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>{t('asteroids.rl.bestRun')}: {t('asteroids.wave')} {rlSave.bestWave} / {rlSave.bestScore.toLocaleString()}</span>
                  <span>{t('asteroids.rl.totalRuns')}: {rlSave.totalRuns}</span>
                </div>
              )}

              {/* Daily run result */}
              {dailyResult && dailyResult.date === getDailyRunDate() && (
                <div className="flex items-center justify-center gap-3 text-xs rounded-lg border border-emerald-700/40 bg-emerald-500/5 px-3 py-2">
                  <span className="text-emerald-400 font-bold">🗓 {t('asteroids.rl.daily.today')}</span>
                  <span style={{ color: 'var(--muted)' }}>{t('asteroids.wave')} {dailyResult.wave}</span>
                  <span style={{ color: 'var(--muted)' }}>{t('game.score')}: {dailyResult.score.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : phase === 'upgrades' ? (
        rlSave && (
          <RogueliteUpgrades scrap={rlSave.scrap} upgrades={rlSave.upgrades} upgradeList={PERMANENT_UPGRADES} ascensionLevel={rlSave.ascensionLevel ?? 0} onBuy={(id) => { const updated = buyUpgrade(rlSave, id as PermanentUpgradeId); if (updated) { saveRogueliteSave(updated); setRlSave(updated); } }} onAscend={() => { const ascended = performAscension(rlSave); saveRogueliteSave(ascended); setRlSave(ascended); }} onClose={() => setPhase('menu')} />
        )
      ) : phase === 'ship_select' ? (
        rlSave && (
          <ShipSelect ships={SHIPS} selectedShip={rlSave.selectedShip} isUnlocked={(id) => isShipUnlocked(rlSave, id)} milestones={MILESTONES} unlockedMilestones={rlSave.unlockedMilestones} onSelect={(id) => { const updated = selectShip(rlSave, id); saveRogueliteSave(updated); setRlSave(updated); }} onClose={() => setPhase('menu')} />
        )
      ) : phase === 'curse_select' ? (
        <CurseSelect curses={CURSES} activeCurses={activeCurses} curseScrapMultiplier={getCurseScrapMultiplier(activeCurses)} onToggle={(id) => setActiveCurses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])} onClose={() => setPhase('menu')} />
      ) : phase === 'bestiary' ? (
        rlSave && (
          <Bestiary entries={rlSave.bestiary} onClose={() => setPhase('menu')} />
        )
      ) : phase === 'milestone_overview' ? (
        rlSave && (
          <MilestoneOverview milestones={MILESTONES} unlockedMilestones={rlSave.unlockedMilestones} onClose={() => setPhase('menu')} />
        )
      ) : phase === 'content_guide' ? (
        rlSave && (
          <ContentGuide save={rlSave} onClose={() => setPhase('menu')} />
        )
      ) : phase === 'daily_preview' ? (
        <DailyPreview modifiers={getDailyModifiers()} previousResult={dailyResult} alreadyPlayed={hasDailyRunToday()} onStart={handleStartDaily} onClose={() => setPhase('menu')} />
      ) : phase === 'milestones' ? (
        <MilestoneNotification milestones={newMilestones} onClose={() => { setNewMilestones([]); setPhase('menu'); }} />
      ) : (
        /* ── Game area ──────────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-2 flex-1 min-h-0">
          {/* HUD */}
          <div className="flex gap-4 w-full max-w-[800px] justify-between text-sm font-bold">
            <div style={{ color: 'var(--fg)' }}>
              {t('game.score')}: <span className="tabular-nums">{displayScore.toLocaleString()}</span>
            </div>
            {modeRef.current === 'roguelite' && (
              <div className="text-yellow-400">
                [S] <span className="tabular-nums">{displayScrap.toLocaleString()}</span>
                {isDailyRun && <span className="text-emerald-400 ml-2 text-xs">🗓</span>}
              </div>
            )}
            <div style={{ color: gameRef.current?.boss ? '#ef4444' : 'var(--fg)' }}>
              {gameRef.current?.boss
                ? <><span className="text-red-500 font-black">{t('asteroids.boss')}</span> <span className="tabular-nums">{displayWave}</span></>
                : <>{t('asteroids.wave')}: <span className="tabular-nums">{displayWave}</span></>
              }
            </div>
            <div style={{ color: 'var(--fg)' }}>
              {t('asteroids.lives')}: <span className="tabular-nums">{displayLives}</span>
            </div>
          </div>

          {/* Canvas */}
          <div className="relative flex-1 min-h-0 w-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="rounded-lg border max-w-full max-h-full"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: '#09090b',
                aspectRatio: `${W} / ${H}`,
              }}
            />

            {/* Countdown overlay */}
            {phase === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl font-black text-white tabular-nums animate-bounce">
                  {countdown}
                </span>
              </div>
            )}

            {/* Pause overlay */}
            {phase === 'paused' && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                <div className="text-center">
                  <span className="text-3xl font-bold text-white">{t('game.paused')}</span>
                  <p className="text-zinc-400 text-sm mt-3">
                    <button
                      onClick={handleResume}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('game.resume')}
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Buff choice overlay */}
            {phase === 'buff_choice' && buffChoices && (
              <BuffChoice
                buffs={buffChoices}
                wave={displayWave}
                onSelect={handleBuffSelect}
              />
            )}

            {/* Artifact choice overlay */}
            {phase === 'artifact_choice' && artifactChoices && (
              <ArtifactChoice
                artifacts={artifactChoices}
                onSelect={handleArtifactSelect}
              />
            )}

            {/* Wave event announcement overlay */}
            {phase === 'wave_event_announce' && waveEventAnnounce && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                <div className="text-center" style={{ animation: 'slideUp 0.4s ease-out' }}>
                  <p className="text-4xl font-black text-amber-400 tracking-wider uppercase">{t(waveEventAnnounce.nameKey)}</p>
                  <p className="text-lg text-zinc-300 mt-2">{t(waveEventAnnounce.descKey)}</p>
                </div>
              </div>
            )}

            {/* Milestone notification (roguelite, after run stats) */}
            {phase === 'ended' && newMilestones.length > 0 && !showRunStats && (
              <MilestoneNotification milestones={newMilestones} onClose={() => setNewMilestones([])} />
            )}

            {/* Run stats overlay (roguelite, before game over) */}
            {phase === 'ended' && showRunStats && gameRef.current?.rlRunStats && (
              <RunStatsScreen stats={gameRef.current.rlRunStats} wave={displayWave} score={displayScore} onContinue={() => setShowRunStats(false)} />
            )}

            {/* Game over overlay */}
            {phase === 'ended' && !showRunStats && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                <div className="text-center space-y-3">
                  <p className="text-3xl font-bold text-white">{t('game.over')}</p>
                  <p className="text-zinc-300">
                    {t('game.score')}: <span className="font-bold text-white">{displayScore.toLocaleString()}</span>
                  </p>
                  <p className="text-zinc-400 text-sm">
                    {t('asteroids.wave')}: {displayWave}
                  </p>
                  {modeRef.current === 'roguelite' && (
                    <p className="text-yellow-400 text-sm font-bold">
                      {t('asteroids.rl.scrapEarned')}: {displayScrap.toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-3 justify-center pt-2">
                    <button
                      onClick={handleRestart}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('game.playAgain')}
                    </button>
                    {modeRef.current === 'roguelite' && rlSave && (
                      <button
                        onClick={() => setPhase('upgrades')}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {t('asteroids.rl.upgrades')}
                      </button>
                    )}
                    <a
                      href="/"
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('nav.games')}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active buffs display (roguelite) */}
          {modeRef.current === 'roguelite' && gameRef.current?.rlActiveBuffs && gameRef.current.rlActiveBuffs.length > 0 && (
            <div className="shrink-0 flex gap-1.5 flex-wrap justify-center max-w-[800px]">
              {gameRef.current.rlActiveBuffs.map(buff => {
                const def = TEMP_BUFF_MAP[buff.id];
                return (
                  <div
                    key={buff.id}
                    className="flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: def.color + '22',
                      color: def.color,
                      border: `1px solid ${def.color}44`,
                    }}
                  >
                    <span>{def.icon}</span>
                    <span className="text-[11px]">{t(def.nameKey)}</span>
                    {buff.wavesRemaining > 0 && <span className="tabular-nums opacity-70">{buff.wavesRemaining}W</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile controls */}
          <div className="shrink-0 flex sm:hidden flex-col gap-1.5 w-full max-w-[400px]">
            <div className="flex gap-1.5 justify-center">
              <MobileBtn label="<" onPress={() => keysRef.current.add('ArrowLeft')} onRelease={() => keysRef.current.delete('ArrowLeft')} />
              <MobileBtn label="^" onPress={() => keysRef.current.add('ArrowUp')} onRelease={() => keysRef.current.delete('ArrowUp')} />
              {(mode !== 'roguelite' || (rlSave && getAppliedStats(rlSave.upgrades, rlSave.selectedShip).hasBrake)) && (
                <MobileBtn label="v" onPress={() => keysRef.current.add('ArrowDown')} onRelease={() => keysRef.current.delete('ArrowDown')} />
              )}
              <MobileBtn label=">" onPress={() => keysRef.current.add('ArrowRight')} onRelease={() => keysRef.current.delete('ArrowRight')} />
            </div>
            <div className="flex gap-1.5 justify-center">
              <MobileBtn
                label={t('asteroids.fire')}
                onPress={() => keysRef.current.add(' ')}
                onRelease={() => keysRef.current.delete(' ')}
                full
              />
            </div>
            <div className="flex gap-1.5 justify-center">
              <MobileBtn
                label={phase === 'paused' ? t('game.resume') : t('game.paused')}
                onPress={() => {
                  if (phaseRef.current === 'playing') setPhase('paused');
                  else if (phaseRef.current === 'paused') setPhase('playing');
                }}
                full
              />
            </div>
          </div>

          {/* Controls hint */}
          <div className="shrink-0 hidden sm:block text-center text-[11px] space-x-3" style={{ color: 'var(--muted)' }}>
            <span>Arrow/WASD: {t('asteroids.move')}</span>
            {(mode !== 'roguelite' || (rlSave && getAppliedStats(rlSave.upgrades, rlSave.selectedShip).hasBrake)) && (
              <span>S/↓: {t('asteroids.brake')}</span>
            )}
            <span>Space: {t('asteroids.fire')}</span>
            <span>P/Esc: {t('game.paused')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drawing ──────────────────────────────────────────────────────────────────

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawGame(
  ctx: CanvasRenderingContext2D,
  game: GameState,
  stars: ReturnType<typeof generateStars>,
  gameMode: GameMode,
) {
  const { ship, bullets, asteroids, particles, powerUps, activePowers, hasShield } = game;
  const isRL = gameMode === 'roguelite';

  // Clear
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power-ups
  for (const pu of powerUps) {
    const color = POWERUP_COLORS[pu.type];
    const pulse = 0.8 + 0.2 * Math.sin(pu.age * 0.005); // pulsing scale
    const glowAlpha = 0.3 + 0.2 * Math.sin(pu.age * 0.004);
    const r = POWERUP_RADIUS * pulse;

    ctx.save();
    ctx.translate(pu.pos.x, pu.pos.y);
    ctx.rotate(pu.rotation);

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    // Hexagon outline
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    drawHexagon(ctx, 0, 0, r);
    ctx.stroke();

    // Fill with translucent color
    ctx.fillStyle = color + Math.round(glowAlpha * 255).toString(16).padStart(2, '0');
    drawHexagon(ctx, 0, 0, r);
    ctx.fill();

    // Label inside
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_LABELS[pu.type], 0, 0);

    ctx.restore();
  }

  // Scrap drops (roguelite)
  if (isRL && game.rlScrapDrops) {
    for (const s of game.rlScrapDrops) {
      const alpha = Math.min(1, s.life / 1000);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Date.now() * 0.003); // spin

      ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`; // yellow
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Asteroids
  for (const a of asteroids) {
    const variantColor = (isRL && a.rlVariant) ? ASTEROID_VARIANT_CONFIG[a.rlVariant].color : '#a1a1aa';
    const glowColor = (isRL && a.rlVariant) ? ASTEROID_VARIANT_CONFIG[a.rlVariant].glowColor : null;

    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.rotation);

    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
    }

    ctx.strokeStyle = variantColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const vertCount = a.vertices.length;
    for (let i = 0; i <= vertCount; i++) {
      const angle = (i / vertCount) * Math.PI * 2;
      const rv = a.radius * a.vertices[i % vertCount];
      const ax = Math.cos(angle) * rv;
      const ay = Math.sin(angle) * rv;
      if (i === 0) ctx.moveTo(ax, ay);
      else ctx.lineTo(ax, ay);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Elite modifier ring (roguelite)
    if (isRL && a.rlElite) {
      const eliteCfg = ELITE_MODIFIER_CONFIG[a.rlElite];
      ctx.save();
      ctx.strokeStyle = eliteCfg.glowColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = eliteCfg.glowColor;
      ctx.shadowBlur = 10;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(a.pos.x, a.pos.y, a.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // HP bar for roguelite asteroids with max HP > 1
    if (isRL && a.rlHp !== undefined && a.rlMaxHp !== undefined && a.rlMaxHp > 1) {
      const hpFraction = a.rlHp / a.rlMaxHp;
      const barW = a.radius * 1.5;
      const barH = 3;
      const barX = a.pos.x - barW / 2;
      const barY = a.pos.y - a.radius - 8;

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpFraction > 0.5 ? variantColor : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpFraction, barH);
    }
  }

  // Ship
  const blink = ship.invulnerable > 0 && Math.floor(ship.invulnerable / 100) % 2 === 0;
  if (!blink || ship.invulnerable <= 0) {
    ctx.save();
    ctx.translate(ship.pos.x, ship.pos.y);
    ctx.rotate(ship.angle);

    // Ship body (colored by ship type in roguelite)
    ctx.strokeStyle = game.rlShipColor ?? '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, -SHIP_SIZE * 0.6);
    ctx.lineTo(-SHIP_SIZE * 0.4, 0);
    ctx.lineTo(-SHIP_SIZE * 0.7, SHIP_SIZE * 0.6);
    ctx.closePath();
    ctx.stroke();

    // Thrust flame
    if (ship.thrusting) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.3);
      ctx.lineTo(-SHIP_SIZE * (0.9 + Math.random() * 0.5), 0);
      ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.3);
      ctx.stroke();
    }

    ctx.restore();

    // Shield circle (drawn after restore so it's not rotated with ship)
    if (hasShield) {
      ctx.save();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ship.pos.x, ship.pos.y, SHIP_SIZE * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }

    // Drone companion (roguelite)
    if (isRL && game.rlDrone) {
      const drone = game.rlDrone;
      const droneX = ship.pos.x + Math.cos(drone.angle) * 40;
      const droneY = ship.pos.y + Math.sin(drone.angle) * 40;

      ctx.save();
      ctx.fillStyle = '#34d399';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(droneX, droneY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Bullets (player)
  const hasHomingPower = hasPower(activePowers, 'homing') || (isRL && game.rlActiveBuffs?.some(b => b.id === 'homingBullets'));
  const isBigBullet = hasPower(activePowers, 'bigbullet');
  const bulletRadius = isBigBullet ? 5 : 2;
  if (isBigBullet) {
    ctx.fillStyle = '#fb923c'; // orange tint
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 6;
  } else if (hasHomingPower) {
    ctx.fillStyle = '#c084fc'; // purple tint for homing
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 6;
  } else {
    ctx.fillStyle = '#fafafa';
  }
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, bulletRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Boss bullets (red)
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 4;
  for (const b of game.bossBullets) {
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Boss
  if (game.boss && game.boss.alive) {
    const boss = game.boss;
    ctx.save();
    ctx.translate(boss.x, boss.y);

    // Boss body: large diamond/ship shape
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -BOSS_RADIUS * 0.8); // top
    ctx.lineTo(BOSS_RADIUS * 0.6, -BOSS_RADIUS * 0.2);
    ctx.lineTo(BOSS_RADIUS * 0.5, BOSS_RADIUS * 0.3);
    ctx.lineTo(BOSS_RADIUS * 0.15, BOSS_RADIUS * 0.6);
    ctx.lineTo(-BOSS_RADIUS * 0.15, BOSS_RADIUS * 0.6);
    ctx.lineTo(-BOSS_RADIUS * 0.5, BOSS_RADIUS * 0.3);
    ctx.lineTo(-BOSS_RADIUS * 0.6, -BOSS_RADIUS * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner detail lines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(-BOSS_RADIUS * 0.3, 0);
    ctx.lineTo(BOSS_RADIUS * 0.3, 0);
    ctx.moveTo(0, -BOSS_RADIUS * 0.4);
    ctx.lineTo(0, BOSS_RADIUS * 0.3);
    ctx.stroke();

    // Wings
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(BOSS_RADIUS * 0.6, -BOSS_RADIUS * 0.2);
    ctx.lineTo(BOSS_RADIUS * 0.9, -BOSS_RADIUS * 0.1);
    ctx.lineTo(BOSS_RADIUS * 0.7, BOSS_RADIUS * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-BOSS_RADIUS * 0.6, -BOSS_RADIUS * 0.2);
    ctx.lineTo(-BOSS_RADIUS * 0.9, -BOSS_RADIUS * 0.1);
    ctx.lineTo(-BOSS_RADIUS * 0.7, BOSS_RADIUS * 0.2);
    ctx.stroke();

    ctx.restore();

    // Boss shield arc (roguelite)
    if (isRL && boss.rlVariant === 'shield' && boss.rlShieldHp !== undefined && boss.rlShieldMaxHp !== undefined && boss.rlShieldMaxHp > 0) {
      const shieldFraction = boss.rlShieldHp / boss.rlShieldMaxHp;
      if (shieldFraction > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 + shieldFraction * 0.4})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, BOSS_RADIUS + 8, -Math.PI, -Math.PI + Math.PI * 2 * shieldFraction);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // HP bar above boss
    const hpBarW = 80;
    const hpBarH = 6;
    const hpBarX = boss.x - hpBarW / 2;
    const hpBarY = boss.y - BOSS_RADIUS - 15;
    const hpFraction = boss.hp / boss.maxHp;

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
    ctx.fillStyle = hpFraction > 0.3 ? '#ef4444' : '#f97316';
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpFraction, hpBarH);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

    // BOSS label
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const bossLabel = (isRL && boss.rlVariant && boss.rlVariant !== 'standard')
      ? `BOSS [${boss.rlVariant.toUpperCase()}]`
      : 'BOSS';
    ctx.fillText(bossLabel, boss.x, hpBarY - 2);
  }

  // "Boss defeated!" flash
  if (game.bossDefeatedTimer > 0) {
    const alpha = Math.min(1, game.bossDefeatedTimer / 500);
    ctx.save();
    ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 15;
    ctx.fillText('BOSS DEFEATED!', W / 2, H / 2 - 40);
    ctx.restore();
  }

  // Time slow visual effect (subtle vignette tint)
  const hasTimeSlow = hasPower(activePowers, 'timeslow') || (isRL && game.rlActiveBuffs?.some(b => b.id === 'timeSlow'));
  if (hasTimeSlow) {
    ctx.fillStyle = 'rgba(200, 200, 255, 0.04)';
    ctx.fillRect(0, 0, W, H);
  }

  // Crit popups (roguelite)
  if (isRL && game.rlCritPopups) {
    for (const cp of game.rlCritPopups) {
      const alpha = Math.min(1, cp.life / 300);
      ctx.save();
      ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 4;
      ctx.fillText('CRIT!', cp.x, cp.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Active power-up HUD indicators (top center, stacked)
  if (activePowers.length > 0) {
    const barW = 100;
    const barH = 6;
    const rowHeight = 22;
    const startY = 12;

    for (let pi = 0; pi < activePowers.length; pi++) {
      const ap = activePowers[pi];
      const barX = W / 2 - barW / 2;
      const barY = startY + pi * rowHeight;
      const fraction = ap.timeLeft / POWERUP_ACTIVE_DURATION;
      const color = POWERUP_COLORS[ap.type];
      const label = POWERUP_LABELS[ap.type];

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, W / 2, barY - 1);

      // Bar background
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(barX, barY + 14, barW, barH);

      // Bar fill
      ctx.fillStyle = color;
      ctx.fillRect(barX, barY + 14, barW * fraction, barH);
    }
  }

  // Scrap counter in-canvas (roguelite, top-left)
  if (isRL) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`[S] ${(game.rlScrap ?? 0)}`, 12, 12);
  }

  // Lives indicators
  for (let i = 0; i < game.lives; i++) {
    ctx.save();
    ctx.translate(25 + i * 25, H - 25);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Artifact icons (roguelite, bottom-right above minimap)
  if (isRL && game.rlArtifacts && game.rlArtifacts.length > 0) {
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < game.rlArtifacts.length; i++) {
      const artDef = ARTIFACTS.find(a => a.id === game.rlArtifacts![i]);
      if (artDef) {
        ctx.fillStyle = artDef.color + 'cc';
        ctx.fillText(artDef.icon, W - 12 - i * 22, H - 110);
      }
    }
  }

  // Wave event timer bar (roguelite)
  if (isRL && game.rlWaveEvent) {
    const evtCfg = WAVE_EVENT_CONFIG[game.rlWaveEvent.type];
    const fraction = game.rlWaveEvent.timer / evtCfg.duration;
    const barW = 200;
    const barH = 4;
    const barX = W / 2 - barW / 2;
    const barY = H - 12;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    const evtColorMap: Record<string, string> = { scrapBonus: '#fbbf24', asteroidSprint: '#ef4444', miniBossRush: '#a78bfa', meteorShower: '#f97316' };
    const evtColor = evtColorMap[game.rlWaveEvent.type] ?? '#a78bfa';
    ctx.fillStyle = evtColor;
    ctx.fillRect(barX, barY, barW * fraction, barH);
  }

  // Mid-wave event rendering (roguelite)
  if (isRL && game.rlMidWaveEvent) {
    const mwe = game.rlMidWaveEvent;
    const mweCfg = MID_WAVE_EVENT_CONFIG[mwe.type];

    if (mwe.type === 'solarFlare') {
      // Bright overlay that flickers
      const intensity = 0.15 + Math.sin(Date.now() * 0.005) * 0.08;
      ctx.fillStyle = `rgba(255, 200, 50, ${intensity})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (mwe.type === 'gravityWell' && mwe.x != null && mwe.y != null) {
      // Swirling vortex
      ctx.save();
      ctx.translate(mwe.x, mwe.y);
      const pulse = 30 + Math.sin(Date.now() * 0.003) * 10;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pulse * 3);
      grad.addColorStop(0, 'rgba(167, 139, 250, 0.4)');
      grad.addColorStop(0.5, 'rgba(167, 139, 250, 0.15)');
      grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      // Spiral lines
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
      ctx.lineWidth = 1.5;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        const baseAngle = Date.now() * 0.002 + (arm * Math.PI * 2 / 3);
        for (let r = 5; r < pulse * 2.5; r += 2) {
          const a = baseAngle + r * 0.08;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    if (mwe.type === 'powerSurge') {
      // Green border glow
      ctx.save();
      ctx.strokeStyle = `rgba(74, 222, 128, ${0.3 + Math.sin(Date.now() * 0.006) * 0.15})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      ctx.restore();
    }

    // Event name + timer bar at top
    if (mweCfg.duration > 1) {
      const fraction = mwe.timer / mweCfg.duration;
      const midNames: Record<string, string> = { solarFlare: 'SOLAR FLARE', gravityWell: 'GRAVITY WELL', powerSurge: 'POWER SURGE', asteroidSwarm: 'ASTEROID SWARM' };
      ctx.save();
      ctx.fillStyle = mweCfg.color + 'cc';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(midNames[mwe.type] ?? mwe.type, W / 2, 6);
      // Timer bar
      const bw = 120, bh = 3, bx = W / 2 - bw / 2, by = 20;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = mweCfg.color;
      ctx.fillRect(bx, by, bw * fraction, bh);
      ctx.restore();
    }
  }

  // Mega-boss drawing (roguelite)
  if (isRL && game.rlMegaBoss && !game.rlMegaBoss.defeated) {
    const mb = game.rlMegaBoss;
    const mbR = MEGA_BOSS_CONFIG.radius;

    ctx.save();
    ctx.translate(mb.x, mb.y);

    // Core body
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, mbR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Phase-specific drawing
    if (mb.phase === 'shield') {
      // Rotating shield segments
      const segCount = mb.shieldSegments.length;
      const segAngle = (Math.PI * 2) / segCount;
      for (let i = 0; i < segCount; i++) {
        if (!mb.shieldSegments[i]) continue;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, mbR, mb.shieldRotation + i * segAngle + 0.1, mb.shieldRotation + (i + 1) * segAngle - 0.1);
        ctx.stroke();
      }
    } else if (mb.phase === 'swarm') {
      // Pulsing aura
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, mbR * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (mb.phase === 'core') {
      // Glowing core
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, mbR * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // Homing missiles
    for (const m of mb.homingMissiles) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // HP bar
    const hpFrac = mb.phaseHp / mb.phaseMaxHp;
    const barW = 120;
    const barH = 6;
    const barX = mb.x - barW / 2;
    const barY = mb.y - mbR - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    const phaseColors: Record<MegaBossPhase, string> = { shield: '#38bdf8', swarm: '#ef4444', core: '#f59e0b' };
    ctx.fillStyle = phaseColors[mb.phase];
    ctx.fillRect(barX, barY, barW * hpFrac, barH);

    // Phase label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MEGA-BOSS', mb.x, barY - 6);
  }

  // Darkness curse overlay (roguelite)
  if (isRL && game.rlCurses?.includes('darkness')) {
    const grad = ctx.createRadialGradient(ship.pos.x, ship.pos.y, 80, ship.pos.x, ship.pos.y, 250);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Mini-map / radar (roguelite, bottom-right corner)
  if (isRL) {
    const mmW = 120;
    const mmH = 90;
    const mmX = W - mmW - 8;
    const mmY = H - mmH - 8;
    const scaleX = mmW / W;
    const scaleY = mmH / H;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX, mmY, mmW, mmH);

    // Asteroids
    for (const a of game.asteroids) {
      const eliteCol = a.rlElite ? ELITE_MODIFIER_CONFIG[a.rlElite].color : null;
      const varCol = a.rlVariant ? ASTEROID_VARIANT_CONFIG[a.rlVariant].color : '#a1a1aa';
      ctx.fillStyle = eliteCol || varCol;
      ctx.fillRect(mmX + a.pos.x * scaleX - 1, mmY + a.pos.y * scaleY - 1, 2, 2);
    }

    // Boss
    if (game.boss && game.boss.alive) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mmX + game.boss.x * scaleX, mmY + game.boss.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mega-boss
    if (game.rlMegaBoss && !game.rlMegaBoss.defeated) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(mmX + game.rlMegaBoss.x * scaleX, mmY + game.rlMegaBoss.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scrap drops
    if (game.rlScrapDrops) {
      ctx.fillStyle = '#fbbf24';
      for (const s of game.rlScrapDrops) {
        ctx.fillRect(mmX + s.x * scaleX, mmY + s.y * scaleY, 1, 1);
      }
    }

    // Player
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(mmX + ship.pos.x * scaleX, mmY + ship.pos.y * scaleY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Mobile button ────────────────────────────────────────────────────────────

function MobileBtn({
  label,
  onPress,
  onRelease,
  full,
}: {
  label: string;
  onPress: () => void;
  onRelease?: () => void;
  full?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      onPointerUp={() => onRelease?.()}
      onPointerLeave={() => onRelease?.()}
      className={`select-none touch-manipulation bg-zinc-800 active:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium rounded-lg py-2.5 ${full ? 'flex-1' : 'px-6'} transition-colors`}
    >
      {label}
    </button>
  );
}
