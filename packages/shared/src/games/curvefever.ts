// ── Curve Fever (Achtung die Kurve) ──────────────────────────────────────────

export type CurveFeverPhase = 'lobby' | 'countdown' | 'playing' | 'round_end' | 'finished';

export interface CurveFeverPlayer {
  token: string;
  nickname: string;
  x: number;
  y: number;
  angle: number;        // radians
  alive: boolean;
  score: number;        // round wins (best-of)
  color: string;
  inGap: boolean;
  steering: 'left' | 'right' | 'none';
  /** Active power-up effects on this player. */
  effects: CfActiveEffect[];
  /** Whether player currently has shield (derived from effects, for quick check). */
  hasShield: boolean;
}

export interface TrailSegment {
  x: number;
  y: number;
}

/** Death event sent to clients for particle rendering + kill feed. */
export interface CfDeathEvent {
  token: string;
  nickname: string;
  x: number;
  y: number;
  color: string;
  /** What killed the player. */
  cause: 'wall' | 'self' | 'other';
  /** Token of the trail owner that killed this player (only when cause === 'other'). */
  killerToken?: string;
  killerNickname?: string;
  killerColor?: string;
}

// ── Kill feed ─────────────────────────────────────────────────────────────────

export interface CfKillFeedEntry {
  victim: string;         // nickname
  victimColor: string;
  cause: 'wall' | 'self' | 'other';
  killer?: string;        // nickname
  killerColor?: string;
  tick: number;           // ticksElapsed when it happened
}

// ── Power-ups ─────────────────────────────────────────────────────────────────

export type CfPowerUpType = 'speed' | 'shield' | 'phase';

/** A spawned power-up sitting on the arena. */
export interface CfPowerUp {
  id: number;
  type: CfPowerUpType;
  x: number;
  y: number;
  spawnTick: number;      // tick when spawned (for lifetime expiry)
}

/** An active power-up effect on a player. */
export interface CfActiveEffect {
  type: CfPowerUpType;
  remainingTicks: number;
}

export interface CurveFeverState {
  phase: CurveFeverPhase;
  players: CurveFeverPlayer[];
  playerIds: string[];
  currentTurn: string;        // first alive player token (sanity guard compat)
  arenaWidth: number;
  arenaHeight: number;
  round: number;
  bestOf: number;             // e.g. 3, 5, 7 — first to ceil(bestOf/2) wins
  winsNeeded: number;         // ceil(bestOf / 2)
  countdownTimer: number;     // ticks remaining
  winner: string | null;      // overall match winner token
  roundWinner: string | null; // winner of the current/last round
  status: 'ongoing' | 'win';
  ticksElapsed: number;       // ticks since round started (for speed scaling)
  /** Recent deaths this tick — client uses for particles, stripped next tick. */
  deaths: CfDeathEvent[];
  /** Kill feed entries (last ~5). */
  killFeed: CfKillFeedEntry[];
  /** Power-ups currently on the arena. */
  powerUps: CfPowerUp[];
  // Server-only fields (stripped by projection before broadcast)
  trails: TrailSegment[][];
  gapCounters: number[];
  gapRemaining: number[];
  roundEndTimer: number;
  /** Server-only: ticks until next power-up spawn. */
  powerUpSpawnCounter: number;
  /** Server-only: incrementing ID for power-ups. */
  powerUpNextId: number;
}

export type CurveFeverAction =
  | { type: 'CF_STEER'; direction: 'left' | 'right' | 'none' }
  | { type: 'CF_START' };

export interface CurveFeverConfig {
  bestOf?: number;
}

// ── Arena ────────────────────────────────────────────────────────────────────
export const ARENA_W = 800;
export const ARENA_H = 600;

// ── Movement / steering ──────────────────────────────────────────────────────
export const BASE_SPEED = 2.2;             // px per tick at round start
export const SPEED_INCREASE_PER_SEC = 0.1; // px/tick gained per second of gameplay
export const MAX_SPEED = 5.5;              // hard cap
export const TURN_RATE = 0.055;            // radians per tick (base)
export const PLAYER_RADIUS = 3;

// ── Gaps ─────────────────────────────────────────────────────────────────────
// Intervals / durations expressed in ticks (20 tps).
// Gaps come more frequently as speed increases (handled in engine).
export const GAP_INTERVAL_MIN = 60;   // 3s
export const GAP_INTERVAL_MAX = 140;  // 7s
export const GAP_DURATION_MIN = 6;    // 0.3s
export const GAP_DURATION_MAX = 12;   // 0.6s

// ── Timing ───────────────────────────────────────────────────────────────────
export const COUNTDOWN_TICKS = 60;     // 3s at 20 tps
export const TICK_INTERVAL = 50;       // 20 tps
export const ROUND_END_TICKS = 80;     // 4s pause between rounds
export const TICKS_PER_SEC = 20;

// ── Power-ups ───────────────────────────────────────────────────────────────
export const POWERUP_SPAWN_INTERVAL_MIN = 70;   // 3.5s at 20 tps
export const POWERUP_SPAWN_INTERVAL_MAX = 150;  // 7.5s
export const POWERUP_MAX_ACTIVE = 4;            // max items on arena
export const POWERUP_LIFETIME = 200;            // 10s before despawn
export const POWERUP_PICKUP_RADIUS = 12;        // px from center
export const POWERUP_SPEED_DURATION = 40;       // 2s at 20 tps
export const POWERUP_SPEED_MULTIPLIER = 1.5;
export const POWERUP_SHIELD_DURATION = 200;     // 10s — but consumed on hit
export const POWERUP_PHASE_DURATION = 20;       // 1s at 20 tps

// ── Kill feed ───────────────────────────────────────────────────────────────
export const KILL_FEED_MAX = 5;

// ── Visuals ──────────────────────────────────────────────────────────────────
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
