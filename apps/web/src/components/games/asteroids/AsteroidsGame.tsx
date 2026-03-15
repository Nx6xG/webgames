'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { loadStats, updateStats } from './stats';
import type { AsteroidsStats } from './stats';
import * as sfx from './sound';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'ended';
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
}

interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  activePower: ActivePower | null;
  hasShield: boolean;
  score: number;
  lives: number;
  wave: number;
  asteroidsDestroyed: number;
  boss: Boss | null;
  bossBullets: BossBullet[];
  bossDefeatedTimer: number; // ms remaining for "Boss defeated!" flash
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
  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<AsteroidsStats | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayWave, setDisplayWave] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const starsRef = useRef<ReturnType<typeof generateStars>>([]);
  const savedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;

  // Load stats on mount
  useEffect(() => {
    setStats(loadStats());
    starsRef.current = generateStars();
  }, []);

  // ── Auto-pause on tab switch ─────────────────────────────────────────────
  const handlePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setPhase('paused');
    }
  }, []);
  useVisibilityPause(phase === 'playing', handlePause);

  // ── Init game state ──────────────────────────────────────────────────────
  const initGame = useCallback((diff: Difficulty): GameState => {
    const config = DIFF_CONFIG[diff];
    const shipPos = { x: W / 2, y: H / 2 };
    return {
      ship: {
        pos: { ...shipPos },
        vel: { x: 0, y: 0 },
        angle: -Math.PI / 2,
        thrusting: false,
        invulnerable: INVULN_TIME,
      },
      bullets: [],
      asteroids: spawnWaveAsteroids(config.startCount, shipPos, config.speedMult),
      particles: [],
      powerUps: [],
      activePower: null,
      hasShield: false,
      score: 0,
      lives: 3,
      wave: 1,
      asteroidsDestroyed: 0,
      boss: null,
      bossBullets: [],
      bossDefeatedTimer: 0,
    };
  }, []);

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
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'w', 'W', 'a', 'A', 'd', 'D'].includes(key)) {
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
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Shoot helper ─────────────────────────────────────────────────────────
  const shootCooldownRef = useRef(0);

  // ── Game loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Still draw the canvas when paused/ended so it's not blank
      if (phase === 'paused' || phase === 'ended') {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && gameRef.current) drawGame(ctx, gameRef.current, starsRef.current);
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
      const config = DIFF_CONFIG[difficulty];

      // ── Ship rotation ──
      if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
        game.ship.angle -= SHIP_TURN_SPEED;
      }
      if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
        game.ship.angle += SHIP_TURN_SPEED;
      }

      // ── Ship thrust ──
      game.ship.thrusting = keys.has('ArrowUp') || keys.has('w') || keys.has('W');
      if (game.ship.thrusting) {
        game.ship.vel.x += Math.cos(game.ship.angle) * SHIP_ACCEL;
        game.ship.vel.y += Math.sin(game.ship.angle) * SHIP_ACCEL;
        if (Math.random() < 0.3) sfx.thrustSound();
      }

      // ── Ship movement ──
      game.ship.vel.x *= SHIP_FRICTION;
      game.ship.vel.y *= SHIP_FRICTION;
      game.ship.pos.x += game.ship.vel.x;
      game.ship.pos.y += game.ship.vel.y;
      game.ship.pos = wrap(game.ship.pos);

      // ── Invulnerability ──
      if (game.ship.invulnerable > 0) {
        game.ship.invulnerable -= dt;
      }

      // ── Active power-up timer ──
      if (game.activePower) {
        game.activePower.timeLeft -= dt;
        if (game.activePower.timeLeft <= 0) {
          // Shield wears off too
          if (game.activePower.type === 'shield') game.hasShield = false;
          game.activePower = null;
        }
      }

      // ── Shooting ──
      const activeType = game.activePower?.type;
      const cooldown = activeType === 'rapid' ? 60 : 150;
      const maxBullets = activeType === 'rapid' ? 10 : MAX_BULLETS;
      shootCooldownRef.current -= dt;
      if (keys.has(' ') && game.bullets.length < maxBullets && shootCooldownRef.current <= 0) {
        shootCooldownRef.current = cooldown;
        const baseAngle = game.ship.angle;
        const shipVelFactor = 0.5;

        if (activeType === 'multishot') {
          // 5 bullets in a spread: -30, -15, 0, +15, +30 degrees
          const offsets = [-0.524, -0.262, 0, 0.262, 0.524]; // radians
          for (const off of offsets) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * BULLET_SPEED + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * BULLET_SPEED + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE,
            });
          }
        } else if (activeType === 'double') {
          const spread = 0.08; // ~4.5 degrees
          for (const off of [-spread, spread]) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * BULLET_SPEED + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * BULLET_SPEED + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE,
            });
          }
        } else if (activeType === 'triple') {
          const spread = 0.15; // ~8.6 degrees
          for (const off of [-spread, 0, spread]) {
            const a = baseAngle + off;
            game.bullets.push({
              pos: { ...game.ship.pos },
              vel: {
                x: Math.cos(a) * BULLET_SPEED + game.ship.vel.x * shipVelFactor,
                y: Math.sin(a) * BULLET_SPEED + game.ship.vel.y * shipVelFactor,
              },
              life: BULLET_LIFE,
            });
          }
        } else {
          game.bullets.push({
            pos: { ...game.ship.pos },
            vel: {
              x: Math.cos(baseAngle) * BULLET_SPEED + game.ship.vel.x * shipVelFactor,
              y: Math.sin(baseAngle) * BULLET_SPEED + game.ship.vel.y * shipVelFactor,
            },
            life: BULLET_LIFE,
          });
        }
        sfx.shootSound();
      }

      // ── Update bullets ──
      game.bullets = game.bullets.filter(b => {
        // Homing: steer toward nearest asteroid (or boss)
        if (activeType === 'homing' && (game.asteroids.length > 0 || (game.boss && game.boss.alive))) {
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
            let diff = targetAngle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turnRate = 0.06; // radians per frame
            const steer = Math.max(-turnRate, Math.min(turnRate, diff));
            const newAngle = currentAngle + steer;
            const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y);
            b.vel.x = Math.cos(newAngle) * speed;
            b.vel.y = Math.sin(newAngle) * speed;
          }
        }
        b.pos.x += b.vel.x;
        b.pos.y += b.vel.y;
        b.pos = wrap(b.pos);
        b.life -= dt;
        return b.life > 0;
      });

      // ── Update asteroids ──
      const timeSlowMult = activeType === 'timeslow' ? 0.3 : 1;
      for (const a of game.asteroids) {
        a.pos.x += a.vel.x * timeSlowMult;
        a.pos.y += a.vel.y * timeSlowMult;
        a.pos = wrap(a.pos);
        a.rotation += a.rotSpeed * timeSlowMult;
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
          // Activate power-up (replaces current)
          if (game.activePower?.type === 'shield') game.hasShield = false;
          game.activePower = { type: pu.type, timeLeft: POWERUP_ACTIVE_DURATION };
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
      const bulletHitRadius = activeType === 'bigbullet' ? 6 : 2;

      for (let ai = game.asteroids.length - 1; ai >= 0; ai--) {
        const a = game.asteroids[ai];
        let hit = false;
        for (let bi = 0; bi < game.bullets.length; bi++) {
          if (bulletsToRemove.has(bi)) continue;
          if (dist(game.bullets[bi].pos, a.pos) < a.radius + bulletHitRadius) {
            hit = true;
            bulletsToRemove.add(bi);
            break;
          }
        }
        if (hit) {
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

      // ── Ship-asteroid collision ──
      if (game.ship.invulnerable <= 0) {
        for (const a of game.asteroids) {
          if (dist(game.ship.pos, a.pos) < a.radius + SHIP_SIZE * 0.6) {
            // Shield absorbs the hit
            if (game.hasShield) {
              game.hasShield = false;
              game.activePower = null;
              game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
              game.ship.invulnerable = 500; // brief invuln after shield break
              break;
            }

            game.lives--;
            game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
            sfx.deathSound();

            // Lose active power on death
            game.activePower = null;
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
              return;
            }

            // Reset ship position
            game.ship.pos = { x: W / 2, y: H / 2 };
            game.ship.vel = { x: 0, y: 0 };
            game.ship.angle = -Math.PI / 2;
            game.ship.invulnerable = INVULN_TIME;
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

        // Fire at player
        boss.fireTimer--;
        if (boss.fireTimer <= 0) {
          boss.fireTimer = BOSS_FIRE_INTERVAL;
          const dx = game.ship.pos.x - boss.x;
          const dy = game.ship.pos.y - boss.y;
          const angle = Math.atan2(dy, dx);
          game.bossBullets.push({
            pos: { x: boss.x, y: boss.y },
            vel: { x: Math.cos(angle) * BOSS_BULLET_SPEED, y: Math.sin(angle) * BOSS_BULLET_SPEED },
            life: BOSS_BULLET_LIFE,
          });
        }

        // Check player bullets hitting boss
        for (let bi = game.bullets.length - 1; bi >= 0; bi--) {
          if (dist(game.bullets[bi].pos, { x: boss.x, y: boss.y }) < BOSS_RADIUS) {
            game.bullets.splice(bi, 1);
            boss.hp--;
            game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 5, '#ef4444'));
            sfx.explosionSound();
            if (boss.hp <= 0) {
              boss.alive = false;
              game.score += BOSS_POINTS;
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 40, '#f97316'));
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 30, '#ef4444'));
              game.particles.push(...makeParticles({ x: boss.x, y: boss.y }, 20, '#eab308'));
              sfx.bigExplosionSound();
              game.boss = null;
              game.bossBullets = [];
              game.bossDefeatedTimer = 2000;
              // Proceed to next wave after boss
              game.wave++;
              const count = config.startCount + (game.wave - 1) * config.countIncrement;
              game.asteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult);
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
          if (dist(game.bossBullets[bi].pos, game.ship.pos) < SHIP_SIZE * 0.8) {
            game.bossBullets.splice(bi, 1);
            if (game.hasShield) {
              game.hasShield = false;
              game.activePower = null;
              game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
              game.ship.invulnerable = 500;
            } else {
              game.lives--;
              game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
              sfx.deathSound();
              game.activePower = null;
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

      // ── Ship-boss collision ──
      if (game.boss && game.boss.alive && game.ship.invulnerable <= 0) {
        if (dist(game.ship.pos, { x: game.boss.x, y: game.boss.y }) < BOSS_RADIUS + SHIP_SIZE * 0.6) {
          if (game.hasShield) {
            game.hasShield = false;
            game.activePower = null;
            game.particles.push(...makeParticles(game.ship.pos, 15, '#06b6d4'));
            game.ship.invulnerable = 500;
          } else {
            game.lives--;
            game.particles.push(...makeParticles(game.ship.pos, 20, '#f87171'));
            sfx.deathSound();
            game.activePower = null;
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
      if (game.asteroids.length === 0 && !game.boss) {
        game.wave++;
        sfx.levelUpSound();
        if (isBossWave(game.wave)) {
          // Boss wave: no asteroids, spawn boss
          game.boss = createBoss();
          game.bossBullets = [];
        } else {
          const count = config.startCount + (game.wave - 1) * config.countIncrement;
          game.asteroids = spawnWaveAsteroids(count, game.ship.pos, config.speedMult);
        }
        game.ship.invulnerable = Math.max(game.ship.invulnerable, 1500);
      }

      // ── Update display state ──
      setDisplayScore(game.score);
      setDisplayLives(game.lives);
      setDisplayWave(game.wave);

      // ── Draw ──
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawGame(ctx, game, starsRef.current);

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

  // ── Start game ───────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    savedRef.current = false;
    gameRef.current = initGame(difficulty);
    setDisplayScore(0);
    setDisplayLives(3);
    setDisplayWave(1);
    setPhase('countdown');
  }, [difficulty, initGame]);

  const handleRestart = useCallback(() => {
    savedRef.current = false;
    gameRef.current = initGame(difficulty);
    setDisplayScore(0);
    setDisplayLives(3);
    setDisplayWave(1);
    setPhase('countdown');
  }, [difficulty, initGame]);

  const handleResume = useCallback(() => {
    setPhase('playing');
  }, []);

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

          {/* Difficulty selector */}
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

          <button
            onClick={handleStart}
            className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
          >
            {t('asteroids.start')}
          </button>

          <p className="text-xs max-sm:hidden" style={{ color: 'var(--muted)' }}>
            Arrow Keys / WASD + Space + P
          </p>

          {/* Stats */}
          {stats && stats.games > 0 && (
            <div className="text-xs space-y-1 text-center" style={{ color: 'var(--muted)' }}>
              <p>{t('game.score')}: {stats.bestScore.toLocaleString()} (best)</p>
              <p>{t('asteroids.wave')}: {stats.bestWave} (best)</p>
              <p>{stats.totalAsteroids.toLocaleString()} {t('asteroids.totalDestroyed')}</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Game area ──────────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-2 flex-1 min-h-0">
          {/* HUD */}
          <div className="flex gap-4 w-full max-w-[800px] justify-between text-sm font-bold">
            <div style={{ color: 'var(--fg)' }}>
              {t('game.score')}: <span className="tabular-nums">{displayScore.toLocaleString()}</span>
            </div>
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

            {/* Game over overlay */}
            {phase === 'ended' && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                <div className="text-center space-y-3">
                  <p className="text-3xl font-bold text-white">{t('game.over')}</p>
                  <p className="text-zinc-300">
                    {t('game.score')}: <span className="font-bold text-white">{displayScore.toLocaleString()}</span>
                  </p>
                  <p className="text-zinc-400 text-sm">
                    {t('asteroids.wave')}: {displayWave}
                  </p>
                  <div className="flex gap-3 justify-center pt-2">
                    <button
                      onClick={handleRestart}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('game.playAgain')}
                    </button>
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

          {/* Mobile controls */}
          <div className="shrink-0 flex sm:hidden flex-col gap-1.5 w-full max-w-[400px]">
            <div className="flex gap-1.5 justify-center">
              <MobileBtn label="<" onPress={() => keysRef.current.add('ArrowLeft')} onRelease={() => keysRef.current.delete('ArrowLeft')} />
              <MobileBtn label="^" onPress={() => keysRef.current.add('ArrowUp')} onRelease={() => keysRef.current.delete('ArrowUp')} />
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
) {
  const { ship, bullets, asteroids, particles, powerUps, activePower, hasShield } = game;

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

  // Asteroids
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 1.5;
  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.pos.x, a.pos.y);
    ctx.rotate(a.rotation);
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
    ctx.restore();
  }

  // Ship
  const blink = ship.invulnerable > 0 && Math.floor(ship.invulnerable / 100) % 2 === 0;
  if (!blink || ship.invulnerable <= 0) {
    ctx.save();
    ctx.translate(ship.pos.x, ship.pos.y);
    ctx.rotate(ship.angle);

    // Ship body
    ctx.strokeStyle = '#e4e4e7';
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
  }

  // Bullets (player)
  const isHomingBullet = activePower?.type === 'homing';
  const isBigBullet = activePower?.type === 'bigbullet';
  const bulletRadius = isBigBullet ? 5 : 2;
  if (isBigBullet) {
    ctx.fillStyle = '#fb923c'; // orange tint
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 6;
  } else if (isHomingBullet) {
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
    ctx.fillText('BOSS', boss.x, hpBarY - 2);
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
  if (activePower?.type === 'timeslow') {
    ctx.fillStyle = 'rgba(200, 200, 255, 0.04)';
    ctx.fillRect(0, 0, W, H);
  }

  // Active power-up HUD indicator (top center)
  if (activePower) {
    const barW = 100;
    const barH = 6;
    const barX = W / 2 - barW / 2;
    const barY = 12;
    const fraction = activePower.timeLeft / POWERUP_ACTIVE_DURATION;
    const color = POWERUP_COLORS[activePower.type];
    const label = POWERUP_LABELS[activePower.type];

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
      className={`
        select-none touch-manipulation
        bg-zinc-800 active:bg-zinc-700 border border-zinc-700
        text-zinc-200 text-sm font-medium rounded-lg
        py-2.5
        ${full ? 'flex-1' : 'px-6'}
        transition-colors
      `}
    >
      {label}
    </button>
  );
}
