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

export type CfPowerUpType = 'speed' | 'shield' | 'phase' | 'slow' | 'thin' | 'reverse' | 'big' | 'warp';

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

/** A static obstacle on the arena. */
export interface CfObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Per-player round statistics. */
export interface CfRoundStats {
  token: string;
  nickname: string;
  color: string;
  survivalTicks: number;
  distance: number;
  powerUpsCollected: number;
  kills: number;
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
  // ── Config echoed to clients ──────────────────────────────────────────
  cfSpeed: CfSpeedSetting;
  cfPowerUpDensity: CfPowerUpDensity;
  cfThickness: CfThickness;
  cfNoGaps: boolean;
  cfShrinkingArena: boolean;
  cfSuddenDeath: boolean;
  /** Power-up types that are disabled. */
  cfDisabledPowerUps: CfPowerUpType[];
  cfObstacles: boolean;
  cfTeamMode: boolean;
  cfArenaShape: CfArenaShape;
  /** Static obstacles on the arena. */
  obstacles: CfObstacle[];
  /** Team assignments: index per player (0 or 1), empty if no team mode. */
  teams: number[];
  /** Round statistics (populated at round_end). */
  roundStats: CfRoundStats[];
  /** Bot slots (persisted across rounds). */
  bots: CfBotSlot[];
  /** Current shrink boundary (pixels inset from each edge). 0 = no shrink yet. */
  shrinkInset: number;
  // Server-only fields (stripped by projection before broadcast)
  trails: TrailSegment[][];
  gapCounters: number[];
  gapRemaining: number[];
  roundEndTimer: number;
  /** Server-only: ticks until next power-up spawn. */
  powerUpSpawnCounter: number;
  /** Server-only: incrementing ID for power-ups. */
  powerUpNextId: number;
  /** Server-only: bot AI reaction cooldown counters (per player index). */
  botReactionCounters: number[];
}

export type CfBotDifficulty = 'easy' | 'medium' | 'hard';

export interface CfBotSlot {
  token: string;
  difficulty: CfBotDifficulty;
  nickname: string;
}

export const BOT_TOKEN_PREFIX = 'bot-';
export function isBotToken(token: string): boolean {
  return token.startsWith(BOT_TOKEN_PREFIX);
}

export type CurveFeverAction =
  | { type: 'CF_STEER'; direction: 'left' | 'right' | 'none' }
  | { type: 'CF_START' }
  | { type: 'CF_ADD_BOT'; difficulty: CfBotDifficulty }
  | { type: 'CF_REMOVE_BOT'; botToken: string };

export type CfSpeedSetting = 'slow' | 'normal' | 'fast';
export type CfPowerUpDensity = 'none' | 'few' | 'normal' | 'chaos';
export type CfThickness = 'thin' | 'normal' | 'thick';
export type CfArenaShape = 'rectangle' | 'circle' | 'hexagon' | 'diamond';
export type CfMapSize = 'small' | 'normal' | 'large' | 'huge';

export const MAP_SIZE_PRESETS: Record<CfMapSize, { w: number; h: number }> = {
  small:  { w: 600, h: 450 },
  normal: { w: 800, h: 600 },
  large:  { w: 1000, h: 750 },
  huge:   { w: 1200, h: 900 },
};

export interface CurveFeverConfig {
  bestOf?: number;
  /** Starting speed preset. */
  speed?: CfSpeedSetting;
  /** Power-up spawn frequency. */
  powerUpDensity?: CfPowerUpDensity;
  /** Trail thickness. */
  thickness?: CfThickness;
  /** When true, gaps in trails are disabled. */
  noGaps?: boolean;
  /** When true, the arena shrinks over time. */
  shrinkingArena?: boolean;
  /** When true, single round — last alive wins the match. */
  suddenDeath?: boolean;
  /** Power-up types that are disabled (won't spawn). */
  disabledPowerUps?: CfPowerUpType[];
  /** When true, random obstacles spawn on the arena each round. */
  obstacles?: boolean;
  /** When true, team mode is enabled (players split into 2 teams). */
  teamMode?: boolean;
  /** Arena shape. */
  arenaShape?: CfArenaShape;
  /** Arena size preset. */
  mapSize?: CfMapSize;
  /** Bot slots to restore on rematch. */
  bots?: CfBotSlot[];
}

// ── Arena ────────────────────────────────────────────────────────────────────
export const ARENA_W = 800;
export const ARENA_H = 600;

// ── Movement / steering ──────────────────────────────────────────────────────
export const BASE_SPEED = 1.5;             // px per tick at round start (30 tps)
export const SPEED_INCREASE_PER_SEC = 0.07; // px/tick gained per second of gameplay
export const MAX_SPEED = 3.7;              // hard cap
export const TURN_RATE = 0.042;            // radians per tick (base) — 1.26 rad/s at 30 tps
export const PLAYER_RADIUS = 3;

// ── Gaps ─────────────────────────────────────────────────────────────────────
// Intervals / durations expressed in ticks (30 tps).
// Gaps come more frequently as speed increases (handled in engine).
export const GAP_INTERVAL_MIN = 90;   // 3s
export const GAP_INTERVAL_MAX = 210;  // 7s
export const GAP_DURATION_MIN = 9;    // 0.3s
export const GAP_DURATION_MAX = 18;   // 0.6s

// ── Timing ───────────────────────────────────────────────────────────────────
export const COUNTDOWN_TICKS = 90;     // 3s at 30 tps
export const TICK_INTERVAL = 33;       // 30 tps
export const ROUND_END_TICKS = 120;    // 4s pause between rounds
export const TICKS_PER_SEC = 30;

// ── Power-ups ───────────────────────────────────────────────────────────────
export const POWERUP_SPAWN_INTERVAL_MIN = 105;  // 3.5s at 30 tps
export const POWERUP_SPAWN_INTERVAL_MAX = 225;  // 7.5s
export const POWERUP_MAX_ACTIVE = 4;            // max items on arena
export const POWERUP_LIFETIME = 300;            // 10s before despawn
export const POWERUP_PICKUP_RADIUS = 12;        // px from center
export const POWERUP_SPEED_DURATION = 60;       // 2s at 30 tps
export const POWERUP_SPEED_MULTIPLIER = 1.5;
export const POWERUP_SHIELD_DURATION = 300;     // 10s — but consumed on hit
export const POWERUP_PHASE_DURATION = 30;       // 1s at 30 tps
export const POWERUP_SLOW_DURATION = 90;        // 3s at 30 tps
export const POWERUP_SLOW_MULTIPLIER = 0.5;
export const POWERUP_THIN_DURATION = 120;       // 4s
export const POWERUP_REVERSE_DURATION = 90;     // 3s
export const POWERUP_BIG_DURATION = 90;         // 3s
export const POWERUP_BIG_MULTIPLIER = 1.8;

// ── Kill feed ───────────────────────────────────────────────────────────────
export const KILL_FEED_MAX = 5;

// ── Visuals ──────────────────────────────────────────────────────────────────
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];
