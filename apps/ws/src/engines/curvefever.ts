import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type { CurveFeverState, CurveFeverAction, CurveFeverPlayer, TrailSegment, CurveFeverConfig, CfDeathEvent, CfKillFeedEntry, CfPowerUp, CfPowerUpType, CfActiveEffect, CfSpeedSetting, CfPowerUpDensity, CfThickness, CfObstacle, CfRoundStats, CfArenaShape, CfBotDifficulty, CfBotSlot, CfMapSize } from 'shared';
import { isBotToken, BOT_TOKEN_PREFIX, MAP_SIZE_PRESETS } from 'shared';

// Constants (mirrored from shared to avoid CJS import issues)
const DEFAULT_ARENA_W = 800;
const DEFAULT_ARENA_H = 600;
const TURN_RATE = 0.042;
const COUNTDOWN_TICKS = 90;
const TICK_INTERVAL = 33;
const ROUND_END_TICKS = 120;
const TICKS_PER_SEC = 30;
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

// Power-up constants (base values)
const POWERUP_LIFETIME = 300;
const POWERUP_PICKUP_RADIUS = 12;
const POWERUP_SPEED_DURATION = 60;
const POWERUP_SPEED_MULTIPLIER = 1.5;
const POWERUP_SHIELD_DURATION = 300;
const POWERUP_PHASE_DURATION = 60;
const POWERUP_SLOW_DURATION = 90;
const POWERUP_SLOW_MULTIPLIER = 0.5;
const POWERUP_THIN_DURATION = 120;
const POWERUP_REVERSE_DURATION = 90;
const POWERUP_BIG_DURATION = 90;
const POWERUP_BIG_MULTIPLIER = 1.8;
const POWERUP_WARP_DURATION = 90;
const KILL_FEED_MAX = 5;

// ── Speed presets ──────────────────────────────────────────────────────────

interface SpeedPreset {
  baseSpeed: number;
  speedIncrease: number;
  maxSpeed: number;
}

const SPEED_PRESETS: Record<CfSpeedSetting, SpeedPreset> = {
  slow:   { baseSpeed: 1.0, speedIncrease: 0.033, maxSpeed: 2.3 },
  normal: { baseSpeed: 1.5, speedIncrease: 0.07,  maxSpeed: 3.7 },
  fast:   { baseSpeed: 2.1, speedIncrease: 0.1,   maxSpeed: 5.0 },
};

// ── Power-up density presets ─────────────────────────────────────────────

interface PuDensityPreset {
  spawnMin: number;
  spawnMax: number;
  maxActive: number;
}

const PU_DENSITY_PRESETS: Record<CfPowerUpDensity, PuDensityPreset | null> = {
  none:   null,
  few:    { spawnMin: 210, spawnMax: 420, maxActive: 2 },
  normal: { spawnMin: 105, spawnMax: 225, maxActive: 4 },
  chaos:  { spawnMin: 38,  spawnMax: 90,  maxActive: 8 },
};

// ── Thickness presets ────────────────────────────────────────────────────

const THICKNESS_RADIUS: Record<CfThickness, number> = {
  thin:   2,
  normal: 3,
  thick:  5,
};

// ── Shrinking arena ──────────────────────────────────────────────────────
const SHRINK_DELAY_TICKS = 150; // 5s before shrinking starts (30 tps)
const SHRINK_RATE = 0.013;       // px inset per tick (0.4 px/s at 30 tps)

// ── Gap intervals ───────────────────────────────────────────────────────
const GAP_INTERVAL_MIN = 90;
const GAP_INTERVAL_MAX = 210;
const GAP_DURATION_MIN = 9;
const GAP_DURATION_MAX = 18;

// ── Obstacles ────────────────────────────────────────────────────────────
const OBSTACLE_COUNT_MIN = 3;
const OBSTACLE_COUNT_MAX = 6;
const OBSTACLE_SIZE_MIN = 30;
const OBSTACLE_SIZE_MAX = 70;
const OBSTACLE_MARGIN = 60; // keep away from edges

// ── Bot AI parameters ──────────────────────────────────────────────────────

interface BotParams {
  lookahead: number;      // how far ahead to check (px)
  rays: number;           // number of feeler rays
  reactionDelay: number;  // ticks between steering updates
  jitter: number;         // probability of random steering per tick
  angleSpread: number;    // total angle spread of feeler cone (radians)
  seekPowerUps: boolean;  // whether bot will steer toward power-ups
  dangerThreshold: number; // min distance before emergency steering (multiplier of lookahead)
}

const BOT_PARAMS: Record<CfBotDifficulty, BotParams> = {
  easy:   { lookahead: 100, rays: 7,  reactionDelay: 1, jitter: 0.06, angleSpread: 0.8,  seekPowerUps: false, dangerThreshold: 0.45 },
  medium: { lookahead: 180, rays: 11, reactionDelay: 0, jitter: 0.01, angleSpread: 1.2,  seekPowerUps: true,  dangerThreshold: 0.2 },
  hard:   { lookahead: 260, rays: 17, reactionDelay: 0, jitter: 0.002, angleSpread: 1.6, seekPowerUps: true,  dangerThreshold: 0.12 },
};

const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

/** Check if a position is safe (no collision). */
function isSafePosition(
  x: number, y: number,
  pRadius: number, collDistSq: number,
  trails: TrailSegment[][], botIdx: number,
  obstacles: CfObstacle[],
  shrinkInset: number, shape: CfArenaShape,
  aW: number, aH: number,
): boolean {
  if (!isInsideArena(x, y, pRadius, shrinkInset, shape, aW, aH)) return false;
  if (collidesWithTrails(x, y, trails, botIdx, 8, collDistSq)) return false;
  if (obstacles.length > 0 && collidesWithObstacles(x, y, obstacles, pRadius)) return false;
  return true;
}

/** Cast a single ray and return distance to first collision. */
function castRay(
  startX: number, startY: number, angle: number,
  maxDist: number, step: number,
  pRadius: number, collDistSq: number,
  trails: TrailSegment[][], botIdx: number,
  obstacles: CfObstacle[],
  shrinkInset: number, shape: CfArenaShape,
  aW: number, aH: number,
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    if (!isSafePosition(
      startX + cos * d, startY + sin * d,
      pRadius, collDistSq, trails, botIdx, obstacles, shrinkInset, shape, aW, aH,
    )) return d;
  }
  return maxDist;
}

/** Ray-casting AI: find best steering direction to avoid collisions. */
function computeBotSteering(
  bot: CurveFeverPlayer,
  botIdx: number,
  state: CurveFeverState,
  difficulty: CfBotDifficulty,
  basePlayerRadius: number,
  speed: number,
  _skipTeamIndices?: number[],
): 'left' | 'right' | 'none' {
  const params = BOT_PARAMS[difficulty];

  // Random jitter: occasionally make a random move (makes easy bots worse)
  if (Math.random() < params.jitter) {
    return Math.random() < 0.5 ? 'left' : 'right';
  }

  const pRadius = getPlayerRadius(bot, basePlayerRadius);
  const collDist = pRadius * 2 + 1; // slight buffer
  const collDistSq = collDist * collDist;
  const aW = state.arenaWidth;
  const aH = state.arenaHeight;
  const shrinkInset = state.shrinkInset;
  // Scale lookahead with speed so bots react earlier at higher speeds
  const effectiveLookahead = Math.max(params.lookahead, params.lookahead * (speed / 1.5));
  const step = Math.max(1.5, pRadius); // finer steps for better detection

  // WALL PROXIMITY: direct distance check to arena boundaries (rectangle arenas)
  // For non-rectangle shapes, the ray-casting via isSafePosition handles walls.
  // This pre-check gives bots an earlier, more reliable wall warning.
  const wallMargin = effectiveLookahead * params.dangerThreshold;
  const distToLeft = bot.x - pRadius - shrinkInset;
  const distToRight = (aW - shrinkInset) - bot.x - pRadius;
  const distToTop = bot.y - pRadius - shrinkInset;
  const distToBottom = (aH - shrinkInset) - bot.y - pRadius;
  const minWallDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  if (state.cfArenaShape === 'rectangle' && minWallDist < wallMargin && minWallDist >= 0) {
    // Heading toward the nearest wall? Steer away from it.
    const cos = Math.cos(bot.angle);
    const sin = Math.sin(bot.angle);
    const headingTowardWall =
      (distToLeft === minWallDist && cos < -0.1) ||
      (distToRight === minWallDist && cos > 0.1) ||
      (distToTop === minWallDist && sin < -0.1) ||
      (distToBottom === minWallDist && sin > 0.1);

    if (headingTowardWall) {
      // Steer away from the closest wall by turning toward arena center
      const centerAngle = Math.atan2(aH / 2 - bot.y, aW / 2 - bot.x);
      let diff = centerAngle - bot.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      return diff > 0 ? 'right' : 'left';
    }
  }

  // Cast rays across the feeler cone
  const rayDistances: number[] = [];
  const halfSpread = params.angleSpread / 2;
  for (let r = 0; r < params.rays; r++) {
    const t = params.rays === 1 ? 0 : (r / (params.rays - 1)) * 2 - 1; // -1 to 1
    const rayAngle = bot.angle + t * halfSpread;
    rayDistances.push(castRay(
      bot.x, bot.y, rayAngle, effectiveLookahead, step,
      pRadius, collDistSq, state.trails, botIdx,
      state.obstacles, state.shrinkInset, state.cfArenaShape, aW, aH,
    ));
  }

  const centerIdx = Math.floor(params.rays / 2);
  const centerDist = rayDistances[centerIdx];
  const dangerDist = effectiveLookahead * params.dangerThreshold;

  // EMERGENCY: immediate danger straight ahead — must turn NOW
  if (centerDist < dangerDist) {
    // Find the ray with the most space on each side
    let bestLeft = 0, bestRight = 0;
    for (let r = 0; r < centerIdx; r++) bestLeft = Math.max(bestLeft, rayDistances[r]);
    for (let r = centerIdx + 1; r < params.rays; r++) bestRight = Math.max(bestRight, rayDistances[r]);

    // If both sides are equally blocked, try a hard turn toward whichever has more space
    if (bestLeft > bestRight + 5) return 'left';
    if (bestRight > bestLeft + 5) return 'right';

    // Both sides roughly equal — commit to current turn direction or pick one
    if (bot.steering !== 'none') return bot.steering;
    return Math.random() < 0.5 ? 'left' : 'right';
  }

  // SEEKING: if safe enough ahead, try to seek power-ups
  if (centerDist >= effectiveLookahead * 0.6 && params.seekPowerUps && state.powerUps.length > 0) {
    let nearestPu: typeof state.powerUps[0] | null = null;
    let nearestDist = Infinity;
    for (const pu of state.powerUps) {
      const dx = pu.x - bot.x;
      const dy = pu.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist && d < 250) {
        nearestDist = d;
        nearestPu = pu;
      }
    }
    if (nearestPu) {
      const targetAngle = Math.atan2(nearestPu.y - bot.y, nearestPu.x - bot.x);
      let diff = targetAngle - bot.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.08) {
        // Only seek if the path toward the power-up is safe
        const seekDist = castRay(
          bot.x, bot.y, targetAngle, Math.min(nearestDist, effectiveLookahead), step,
          pRadius, collDistSq, state.trails, botIdx,
          state.obstacles, state.shrinkInset, state.cfArenaShape, aW, aH,
        );
        if (seekDist > nearestDist * 0.8) {
          return diff > 0 ? 'right' : 'left';
        }
      }
    }
  }

  // NORMAL: if center is clear, go straight
  if (centerDist >= effectiveLookahead * 0.5) return 'none';

  // AVOIDANCE: compute weighted score for left vs right — weight closer rays more
  let leftScore = 0, rightScore = 0;
  for (let r = 0; r < params.rays; r++) {
    const distFromCenter = Math.abs(r - centerIdx);
    const weight = 1 + distFromCenter * 0.5; // outer rays weighted slightly more
    if (r < centerIdx) leftScore += rayDistances[r] * weight;
    else if (r > centerIdx) rightScore += rayDistances[r] * weight;
  }

  if (leftScore > rightScore + 2) return 'left';
  if (rightScore > leftScore + 2) return 'right';

  // Tie-break: maintain current turn direction for smoother pathing
  if (bot.steering !== 'none') return bot.steering;
  return Math.random() < 0.5 ? 'left' : 'right';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function newGapCounter(): number {
  return randRange(GAP_INTERVAL_MIN, GAP_INTERVAL_MAX);
}

function newGapDuration(): number {
  return randRange(GAP_DURATION_MIN, GAP_DURATION_MAX);
}

function newPowerUpSpawnCounter(density: CfPowerUpDensity): number {
  const preset = PU_DENSITY_PRESETS[density];
  if (!preset) return 99999;
  return randRange(preset.spawnMin, preset.spawnMax);
}

const ALL_POWERUP_TYPES: CfPowerUpType[] = ['speed', 'shield', 'phase', 'slow', 'thin', 'reverse', 'big', 'warp'];

function randomPowerUpType(disabled: CfPowerUpType[]): CfPowerUpType {
  const available = disabled.length > 0
    ? ALL_POWERUP_TYPES.filter(t => !disabled.includes(t))
    : ALL_POWERUP_TYPES;
  if (available.length === 0) return 'speed'; // fallback — shouldn't happen
  return available[Math.floor(Math.random() * available.length)];
}

/** Compute current movement speed based on ticks elapsed this round. */
function currentSpeed(ticksElapsed: number, preset: SpeedPreset): number {
  const seconds = ticksElapsed / TICKS_PER_SEC;
  return Math.min(preset.baseSpeed + seconds * preset.speedIncrease, preset.maxSpeed);
}

/** Compute turn rate that scales slightly with speed so steering stays responsive. */
function currentTurnRate(speed: number, baseSpeed: number): number {
  return TURN_RATE * (0.7 + 0.3 * (speed / baseSpeed));
}

/** Gap intervals get shorter as speed increases — tighter play. */
function scaledGapCounter(ticksElapsed: number): number {
  const seconds = ticksElapsed / TICKS_PER_SEC;
  const factor = Math.max(0.5, 1 - seconds * 0.008);
  return randRange(
    Math.round(GAP_INTERVAL_MIN * factor),
    Math.round(GAP_INTERVAL_MAX * factor),
  );
}

function emptyEffects(): CfActiveEffect[] { return []; }

/** Generate random obstacles that don't overlap player spawn positions. */
function generateObstacles(playerPositions: { x: number; y: number }[], shrinkInset: number, shape: CfArenaShape, aW: number, aH: number): CfObstacle[] {
  const count = randRange(OBSTACLE_COUNT_MIN, OBSTACLE_COUNT_MAX);
  const obstacles: CfObstacle[] = [];
  const margin = OBSTACLE_MARGIN;

  for (let attempt = 0; attempt < count * 10 && obstacles.length < count; attempt++) {
    const w = randRange(OBSTACLE_SIZE_MIN, OBSTACLE_SIZE_MAX);
    const h = randRange(OBSTACLE_SIZE_MIN, OBSTACLE_SIZE_MAX);
    const x = margin + Math.random() * (aW - 2 * margin - w);
    const y = margin + Math.random() * (aH - 2 * margin - h);

    // Check all 4 corners are inside the arena shape
    if (!isInsideArena(x, y, 0, shrinkInset, shape, aW, aH)) continue;
    if (!isInsideArena(x + w, y, 0, shrinkInset, shape, aW, aH)) continue;
    if (!isInsideArena(x, y + h, 0, shrinkInset, shape, aW, aH)) continue;
    if (!isInsideArena(x + w, y + h, 0, shrinkInset, shape, aW, aH)) continue;

    // Don't overlap player spawns (check center + buffer)
    const buf = 50;
    let overlapsPlayer = false;
    for (const pp of playerPositions) {
      if (pp.x > x - buf && pp.x < x + w + buf && pp.y > y - buf && pp.y < y + h + buf) {
        overlapsPlayer = true;
        break;
      }
    }
    if (overlapsPlayer) continue;

    // Don't overlap other obstacles
    let overlapsOther = false;
    for (const ob of obstacles) {
      if (x < ob.x + ob.w + 10 && x + w + 10 > ob.x && y < ob.y + ob.h + 10 && y + h + 10 > ob.y) {
        overlapsOther = true;
        break;
      }
    }
    if (overlapsOther) continue;

    obstacles.push({ x, y, w, h });
  }

  return obstacles;
}

/** Check if a point collides with any obstacle. */
function collidesWithObstacles(px: number, py: number, obstacles: CfObstacle[], radius: number): boolean {
  for (const ob of obstacles) {
    if (px + radius > ob.x && px - radius < ob.x + ob.w &&
        py + radius > ob.y && py - radius < ob.y + ob.h) {
      return true;
    }
  }
  return false;
}

/** Place players in a circle facing the center. */
function placePlayers(playerIds: string[], nicknames: string[], scores: number[], aW: number, aH: number): {
  players: CurveFeverPlayer[];
  trails: TrailSegment[][];
  gapCounters: number[];
  gapRemaining: number[];
} {
  const cx = aW / 2;
  const cy = aH / 2;
  const radius = Math.min(aW, aH) * 0.3;
  const n = playerIds.length;

  const players: CurveFeverPlayer[] = [];
  const trails: TrailSegment[][] = [];
  const gapCounters: number[] = [];
  const gapRemaining: number[] = [];

  for (let i = 0; i < n; i++) {
    const angleOnCircle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + radius * Math.cos(angleOnCircle);
    const y = cy + radius * Math.sin(angleOnCircle);
    const facingAngle = Math.atan2(cy - y, cx - x);

    players.push({
      token: playerIds[i],
      nickname: nicknames[i],
      x, y,
      angle: facingAngle,
      alive: true,
      score: scores[i],
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      inGap: false,
      steering: 'none',
      effects: emptyEffects(),
      hasShield: false,
    });
    trails.push([{ x, y }]);
    gapCounters.push(newGapCounter());
    gapRemaining.push(0);
  }

  return { players, trails, gapCounters, gapRemaining };
}

function firstAliveToken(players: CurveFeverPlayer[]): string {
  return players.find(p => p.alive)?.token ?? players[0].token;
}

/** Assign teams: alternate players into team 0 and team 1. */
function assignTeams(playerCount: number): number[] {
  return Array.from({ length: playerCount }, (_, i) => i % 2);
}

// ── Collision detection ─────────────────────────────────────────────────────

function collisionDist(thickness: CfThickness): number {
  return THICKNESS_RADIUS[thickness] * 2;
}

/** Returns the trail index that caused collision, or -1 if no collision. */
function collidesWithTrailsDetailed(
  px: number, py: number,
  trails: TrailSegment[][],
  skipTrailIdx: number,
  skipLast: number,
  distSq: number,
  skipTeamIndices?: number[],
): number {
  for (let ti = 0; ti < trails.length; ti++) {
    if (skipTeamIndices && skipTeamIndices.includes(ti)) continue;
    const trail = trails[ti];
    const end = ti === skipTrailIdx ? trail.length - skipLast : trail.length;
    for (let s = 0; s < end; s++) {
      const seg = trail[s];
      const dx = px - seg.x;
      const dy = py - seg.y;
      if (dx * dx + dy * dy < distSq) return ti;
    }
  }
  return -1;
}

function collidesWithTrails(
  px: number, py: number,
  trails: TrailSegment[][],
  skipTrailIdx: number,
  skipLast: number,
  distSq: number,
): boolean {
  for (let ti = 0; ti < trails.length; ti++) {
    const trail = trails[ti];
    const end = ti === skipTrailIdx ? trail.length - skipLast : trail.length;
    for (let s = 0; s < end; s++) {
      const seg = trail[s];
      const dx = px - seg.x;
      const dy = py - seg.y;
      if (dx * dx + dy * dy < distSq) return true;
    }
  }
  return false;
}

// ── Arena shape geometry ──────────────────────────────────────────────────────

const SQRT3_2 = Math.sqrt(3) / 2; // ≈ 0.866

/** Derived arena geometry from width/height. */
function arenaGeom(aW: number, aH: number) {
  const cx = aW / 2;
  const cy = aH / 2;
  const circleR = Math.min(aW, aH) / 2 - 10; // fits within the smaller dimension
  const hexR = circleR - 5;
  const diamondHW = aW / 2 - 10;
  const diamondHH = aH / 2 - 10;
  return { cx, cy, circleR, hexR, diamondHW, diamondHH };
}

/** Check if a point is inside the arena shape (with shrink and player radius). */
function isInsideArena(x: number, y: number, r: number, shrinkInset: number, shape: CfArenaShape, aW: number, aH: number): boolean {
  const g = arenaGeom(aW, aH);
  switch (shape) {
    case 'rectangle': {
      const left = r + shrinkInset;
      const top = r + shrinkInset;
      const right = aW - r - shrinkInset;
      const bottom = aH - r - shrinkInset;
      return x >= left && x <= right && y >= top && y <= bottom;
    }
    case 'circle': {
      const effR = g.circleR - shrinkInset - r;
      if (effR <= 0) return false;
      const dx = x - g.cx;
      const dy = y - g.cy;
      return dx * dx + dy * dy <= effR * effR;
    }
    case 'hexagon': {
      const R = g.hexR - shrinkInset - r;
      if (R <= 0) return false;
      const dx = Math.abs(x - g.cx);
      const dy = Math.abs(y - g.cy);
      return dy <= R * SQRT3_2 && dx * SQRT3_2 + dy * 0.5 <= R * SQRT3_2;
    }
    case 'diamond': {
      const hw = g.diamondHW - shrinkInset;
      const hh = g.diamondHH - shrinkInset;
      if (hw <= r || hh <= r) return false;
      const dx = Math.abs(x - g.cx);
      const dy = Math.abs(y - g.cy);
      return (dx / (hw - r)) + (dy / (hh - r)) <= 1;
    }
  }
}

function isOutOfBounds(x: number, y: number, playerRadius: number, shrinkInset: number, shape: CfArenaShape, aW: number, aH: number): boolean {
  return !isInsideArena(x, y, playerRadius, shrinkInset, shape, aW, aH);
}

/** Max shrink inset before arena collapses per shape. */
function maxShrinkInset(shape: CfArenaShape, playerRadius: number, aW: number, aH: number): number {
  const g = arenaGeom(aW, aH);
  switch (shape) {
    case 'rectangle': return Math.min(aW, aH) / 2 - playerRadius - 5;
    case 'circle': return g.circleR - playerRadius - 5;
    case 'hexagon': return g.hexR - playerRadius - 5;
    case 'diamond': return g.diamondHH - playerRadius - 5;
  }
}

// ── Power-up helpers ────────────────────────────────────────────────────────

function hasEffect(p: CurveFeverPlayer, type: CfPowerUpType): boolean {
  return p.effects.some(e => e.type === type);
}

function getPlayerSpeed(p: CurveFeverPlayer, baseSpeed: number): number {
  let spd = baseSpeed;
  if (hasEffect(p, 'speed')) spd *= POWERUP_SPEED_MULTIPLIER;
  if (hasEffect(p, 'slow')) spd *= POWERUP_SLOW_MULTIPLIER;
  return spd;
}

/** Get effective trail radius for a player (considers thin/big effects). */
function getPlayerRadius(p: CurveFeverPlayer, baseRadius: number): number {
  let r = baseRadius;
  if (hasEffect(p, 'thin')) r = Math.max(1, r * 0.5);
  if (hasEffect(p, 'big')) r *= POWERUP_BIG_MULTIPLIER;
  return r;
}

function spawnPowerUp(state: CurveFeverState, ticks: number, maxActive: number, playerRadius: number): CfPowerUp | null {
  if (state.powerUps.length >= maxActive) return null;
  const cd = playerRadius * 2;
  const cdSq = cd * cd;
  const aW = state.arenaWidth;
  const aH = state.arenaHeight;

  // Rejection sampling: generate within bounding rect, check shape bounds
  for (let attempt = 0; attempt < 10; attempt++) {
    const margin = 40;
    const x = margin + Math.random() * (aW - 2 * margin);
    const y = margin + Math.random() * (aH - 2 * margin);

    if (!isInsideArena(x, y, POWERUP_PICKUP_RADIUS, state.shrinkInset, state.cfArenaShape, aW, aH)) continue;
    if (collidesWithTrails(x, y, state.trails, -1, 0, cdSq)) continue;
    if (collidesWithObstacles(x, y, state.obstacles, POWERUP_PICKUP_RADIUS)) continue;

    return {
      id: state.powerUpNextId,
      type: randomPowerUpType(state.cfDisabledPowerUps),
      x, y,
      spawnTick: ticks,
    };
  }
  return null;
}

function effectDuration(type: CfPowerUpType): number {
  switch (type) {
    case 'speed': return POWERUP_SPEED_DURATION;
    case 'shield': return POWERUP_SHIELD_DURATION;
    case 'phase': return POWERUP_PHASE_DURATION;
    case 'slow': return POWERUP_SLOW_DURATION;
    case 'thin': return POWERUP_THIN_DURATION;
    case 'reverse': return POWERUP_REVERSE_DURATION;
    case 'big': return POWERUP_BIG_DURATION;
    case 'warp': return POWERUP_WARP_DURATION;
  }
}

/** Apply a picked-up power-up: some are self-targeting, some target all opponents. */
function applyPowerUpPickup(
  picker: CurveFeverPlayer,
  pickerIdx: number,
  puType: CfPowerUpType,
  allPlayers: CurveFeverPlayer[],
  teams: number[],
): void {
  const dur = effectDuration(puType);

  // Self-targeting power-ups
  if (puType === 'speed' || puType === 'shield' || puType === 'phase' || puType === 'thin' || puType === 'warp') {
    picker.effects.push({ type: puType, remainingTicks: dur });
    if (puType === 'shield') picker.hasShield = true;
    return;
  }

  // Opponent-targeting power-ups: slow, reverse, big
  for (let j = 0; j < allPlayers.length; j++) {
    if (j === pickerIdx) continue;
    if (!allPlayers[j].alive) continue;
    // In team mode, don't target teammates
    if (teams.length > 0 && teams[j] === teams[pickerIdx]) continue;
    allPlayers[j].effects.push({ type: puType, remainingTicks: dur });
  }
}

// ── Round stats tracking ────────────────────────────────────────────────────

interface StatsAccum {
  deathTick: number;  // 0 = still alive
  distance: number;
  powerUpsCollected: number;
  kills: number;
}

function buildRoundStats(
  players: CurveFeverPlayer[],
  accum: StatsAccum[],
  totalTicks: number,
): CfRoundStats[] {
  return players.map((p, i) => ({
    token: p.token,
    nickname: p.nickname,
    color: p.color,
    survivalTicks: accum[i].deathTick > 0 ? accum[i].deathTick : totalTicks,
    distance: Math.round(accum[i].distance),
    powerUpsCollected: accum[i].powerUpsCollected,
    kills: accum[i].kills,
  }));
}

// ── Engine ──────────────────────────────────────────────────────────────────

export const curveFeverEngine: GameEngine<CurveFeverState, CurveFeverAction> & {
  tick: (state: CurveFeverState) => CurveFeverState;
  tickInterval: number;
  simultaneousInput: boolean;
} = {
  tickInterval: TICK_INTERVAL,
  simultaneousInput: true,

  initialState(playerIds: string[], _startingPlayerIndex?: number, config?: unknown): CurveFeverState {
    const cfg = (config ?? {}) as CurveFeverConfig;
    const suddenDeath = cfg.suddenDeath ?? false;
    const bestOf = suddenDeath ? 1 : (cfg.bestOf ?? 5);
    const winsNeeded = suddenDeath ? 1 : bestOf;
    const cfMapSize: CfMapSize = (['small', 'normal', 'large', 'huge'] as const).includes(cfg.mapSize as CfMapSize)
      ? (cfg.mapSize as CfMapSize) : 'normal';
    const mapDims = MAP_SIZE_PRESETS[cfMapSize];
    const ARENA_W = mapDims.w;
    const ARENA_H = mapDims.h;

    const nicknames = playerIds.map((_, i) => `Player ${i + 1}`);
    const scores = playerIds.map(() => 0);
    const { players, trails, gapCounters, gapRemaining } = placePlayers(playerIds, nicknames, scores, ARENA_W, ARENA_H);

    const cfSpeed = cfg.speed ?? 'normal';
    const cfPowerUpDensity = cfg.powerUpDensity ?? 'normal';
    const cfThickness = cfg.thickness ?? 'normal';
    const cfNoGaps = cfg.noGaps ?? false;
    const cfShrinkingArena = cfg.shrinkingArena ?? false;
    const cfSuddenDeath = suddenDeath;
    const cfDisabledPowerUps = (cfg.disabledPowerUps ?? []).filter(
      (t): t is CfPowerUpType => ALL_POWERUP_TYPES.includes(t as CfPowerUpType),
    );
    const cfObstacles = cfg.obstacles ?? false;
    const cfTeamMode = cfg.teamMode ?? false;
    const cfArenaShape: CfArenaShape = (['rectangle', 'circle', 'hexagon', 'diamond'] as const).includes(cfg.arenaShape as CfArenaShape)
      ? (cfg.arenaShape as CfArenaShape) : 'rectangle';
    const teams = cfTeamMode ? assignTeams(playerIds.length) : [];

    // Restore bots from config (rematch support)
    const cfBots: CfBotSlot[] = cfg.bots ?? [];

    const state: CurveFeverState = {
      phase: 'lobby',
      players,
      playerIds: [...playerIds],
      currentTurn: playerIds[0],
      arenaWidth: mapDims.w,
      arenaHeight: mapDims.h,
      round: 1,
      bestOf,
      winsNeeded,
      countdownTimer: COUNTDOWN_TICKS,
      winner: null,
      roundWinner: null,
      status: 'ongoing',
      ticksElapsed: 0,
      deaths: [],
      killFeed: [],
      powerUps: [],
      cfSpeed,
      cfPowerUpDensity,
      cfThickness,
      cfNoGaps,
      cfShrinkingArena,
      cfSuddenDeath,
      cfDisabledPowerUps,
      cfObstacles,
      cfTeamMode,
      cfArenaShape,
      obstacles: [],
      teams,
      roundStats: [],
      bots: [],
      shrinkInset: 0,
      trails,
      gapCounters,
      gapRemaining,
      roundEndTimer: 0,
      powerUpSpawnCounter: newPowerUpSpawnCounter(cfPowerUpDensity),
      powerUpNextId: 1,
      botReactionCounters: playerIds.map(() => 0),
    };

    // Re-add bots from config (rematch)
    for (const bot of cfBots) {
      if (state.players.length >= 6) break;
      const colors = PLAYER_COLORS;
      state.bots.push(bot);
      state.playerIds.push(bot.token);
      state.players.push({
        token: bot.token, nickname: bot.nickname,
        x: 0, y: 0, angle: 0,
        alive: true, score: 0,
        color: colors[state.players.length % colors.length],
        inGap: false, steering: 'none',
        effects: emptyEffects(), hasShield: false,
      });
      state.trails.push([]);
      state.gapCounters.push(0);
      state.gapRemaining.push(0);
      state.botReactionCounters.push(0);
    }

    return state;
  },

  applyAction(state: CurveFeverState, action: CurveFeverAction, ctx: ActionContext): CurveFeverState {
    if (action.type === 'CF_START') {
      if (ctx.playerIndex !== 0 || state.phase !== 'lobby') return state;
      if (state.players.length < 2) return state;

      const nicknames = state.players.map(p => p.nickname);
      const scores = state.players.map(() => 0);
      const placed = placePlayers(state.playerIds, nicknames, scores, state.arenaWidth, state.arenaHeight);
      const obstacles = state.cfObstacles
        ? generateObstacles(placed.players.map(p => ({ x: p.x, y: p.y })), 0, state.cfArenaShape, state.arenaWidth, state.arenaHeight)
        : [];
      const teams = state.cfTeamMode ? assignTeams(state.playerIds.length) : [];

      return {
        ...state,
        phase: 'countdown',
        players: placed.players,
        trails: placed.trails,
        gapCounters: placed.gapCounters,
        gapRemaining: placed.gapRemaining,
        countdownTimer: COUNTDOWN_TICKS,
        currentTurn: state.playerIds[0],
        ticksElapsed: 0,
        deaths: [],
        killFeed: [],
        powerUps: [],
        roundWinner: null,
        shrinkInset: 0,
        obstacles,
        teams,
        roundStats: [],
        powerUpSpawnCounter: newPowerUpSpawnCounter(state.cfPowerUpDensity),
        powerUpNextId: 1,
      };
    }

    if (action.type === 'CF_ADD_BOT') {
      if (state.phase !== 'lobby' || ctx.playerIndex !== 0) return state;
      if (state.players.length >= 6) return state; // max 6 players total
      const botIdx = state.bots.length;
      const token = `${BOT_TOKEN_PREFIX}${botIdx}`;
      const nickname = `Bot ${BOT_NAMES[botIdx % BOT_NAMES.length]}`;
      const colors = PLAYER_COLORS;
      const newBot: CfBotSlot = { token, difficulty: action.difficulty, nickname };
      const newPlayer: CurveFeverPlayer = {
        token, nickname,
        x: 0, y: 0, angle: 0,
        alive: true, score: 0,
        color: colors[state.players.length % colors.length],
        inGap: false, steering: 'none',
        effects: emptyEffects(), hasShield: false,
      };
      return {
        ...state,
        bots: [...state.bots, newBot],
        playerIds: [...state.playerIds, token],
        players: [...state.players, newPlayer],
        trails: [...state.trails, []],
        gapCounters: [...state.gapCounters, 0],
        gapRemaining: [...state.gapRemaining, 0],
        botReactionCounters: [...state.botReactionCounters, 0],
      };
    }

    if (action.type === 'CF_REMOVE_BOT') {
      if (state.phase !== 'lobby' || ctx.playerIndex !== 0) return state;
      const rmIdx = state.playerIds.indexOf(action.botToken);
      if (rmIdx === -1 || !isBotToken(action.botToken)) return state;
      const keep = (arr: unknown[]) => arr.filter((_, i) => i !== rmIdx);
      return {
        ...state,
        bots: state.bots.filter(b => b.token !== action.botToken),
        playerIds: keep(state.playerIds) as string[],
        players: keep(state.players) as CurveFeverPlayer[],
        trails: keep(state.trails) as TrailSegment[][],
        gapCounters: keep(state.gapCounters) as number[],
        gapRemaining: keep(state.gapRemaining) as number[],
        botReactionCounters: keep(state.botReactionCounters) as number[],
      };
    }

    if (action.type === 'CF_STEER') {
      const pIdx = state.players.findIndex(p => p.token === ctx.playerId);
      if (pIdx === -1) return state;

      const newPlayers = [...state.players];
      newPlayers[pIdx] = { ...newPlayers[pIdx], steering: action.direction };
      return { ...state, players: newPlayers };
    }

    return state;
  },

  tick(state: CurveFeverState): CurveFeverState {
    if (state.phase === 'lobby') return state;

    // Countdown phase
    if (state.phase === 'countdown') {
      const timer = state.countdownTimer - 1;
      if (timer <= 0) {
        return {
          ...state,
          phase: 'playing',
          countdownTimer: 0,
          ticksElapsed: 0,
          deaths: [],
          killFeed: [],
          powerUps: [],
          roundWinner: null,
          shrinkInset: 0,
          roundStats: [],
          powerUpSpawnCounter: newPowerUpSpawnCounter(state.cfPowerUpDensity),
          powerUpNextId: 1,
        };
      }
      return { ...state, countdownTimer: timer, deaths: [] };
    }

    // Round end pause
    if (state.phase === 'round_end') {
      const timer = state.roundEndTimer - 1;
      if (timer <= 0) {
        // Team mode: check team wins
        const matchWinner = state.cfTeamMode
          ? findTeamMatchWinner(state)
          : state.players.find(p => p.score >= state.winsNeeded)?.token ?? null;

        if (matchWinner) {
          return {
            ...state,
            phase: 'finished',
            winner: matchWinner,
            status: 'win',
            roundEndTimer: 0,
            deaths: [],
            currentTurn: matchWinner,
          };
        }
        const nicknames = state.players.map(p => p.nickname);
        const scores = state.players.map(p => p.score);
        const { players, trails, gapCounters, gapRemaining } = placePlayers(state.playerIds, nicknames, scores, state.arenaWidth, state.arenaHeight);
        const obstacles = state.cfObstacles
          ? generateObstacles(players.map(p => ({ x: p.x, y: p.y })), 0, state.cfArenaShape, state.arenaWidth, state.arenaHeight)
          : [];
        return {
          ...state,
          phase: 'countdown',
          players,
          trails,
          gapCounters,
          gapRemaining,
          round: state.round + 1,
          countdownTimer: COUNTDOWN_TICKS,
          roundEndTimer: 0,
          ticksElapsed: 0,
          deaths: [],
          killFeed: [],
          powerUps: [],
          roundWinner: null,
          shrinkInset: 0,
          obstacles,
          roundStats: [],
          currentTurn: firstAliveToken(players),
          powerUpSpawnCounter: newPowerUpSpawnCounter(state.cfPowerUpDensity),
          powerUpNextId: 1,
        };
      }
      return { ...state, roundEndTimer: timer, deaths: [] };
    }

    if (state.phase === 'finished') return state;

    // ── Playing phase: simulate one tick ─────────────────────────────────
    const ticks = state.ticksElapsed + 1;
    const speedPreset = SPEED_PRESETS[state.cfSpeed];
    const speed = currentSpeed(ticks, speedPreset);
    const turnRate = currentTurnRate(speed, speedPreset.baseSpeed);
    const basePlayerRadius = THICKNESS_RADIUS[state.cfThickness];
    const baseCollDist = collisionDist(state.cfThickness);
    const baseCollDistSq = baseCollDist * baseCollDist;
    const puDensity = PU_DENSITY_PRESETS[state.cfPowerUpDensity];

    // Shrinking arena
    let shrinkInset = state.shrinkInset;
    if (state.cfShrinkingArena && ticks > SHRINK_DELAY_TICKS) {
      shrinkInset = (ticks - SHRINK_DELAY_TICKS) * SHRINK_RATE;
      // Cap: don't shrink beyond playable area
      const mxInset = maxShrinkInset(state.cfArenaShape, basePlayerRadius, state.arenaWidth, state.arenaHeight);
      if (shrinkInset > mxInset) shrinkInset = mxInset;
    }

    const newPlayers = state.players.map(p => ({ ...p, effects: p.effects.map(e => ({ ...e })) }));
    const newTrails = state.trails.map(tr => [...tr]);
    const newGapCounters = [...state.gapCounters];
    const newGapRemaining = [...state.gapRemaining];
    const deaths: CfDeathEvent[] = [];
    const newKillFeed = [...state.killFeed];
    let newPowerUps = [...state.powerUps];
    let spawnCounter = state.powerUpSpawnCounter;
    let nextPuId = state.powerUpNextId;

    // Stats accumulators (carried from previous tick via roundStats, or init fresh)
    const statsAccum: StatsAccum[] = newPlayers.map((p, i) => {
      const existing = state.roundStats[i];
      return existing ? {
        deathTick: existing.survivalTicks < state.ticksElapsed && !p.alive ? existing.survivalTicks : 0,
        distance: existing.distance,
        powerUpsCollected: existing.powerUpsCollected,
        kills: existing.kills,
      } : { deathTick: 0, distance: 0, powerUpsCollected: 0, kills: 0 };
    });

    // ── Tick down active effects ────────────────────────────────────────
    for (const p of newPlayers) {
      p.effects = p.effects
        .map(e => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
        .filter(e => e.remainingTicks > 0);
      p.hasShield = hasEffect(p, 'shield');
    }

    // Team mode: build skip lists per player (skip teammate trails for collision)
    const teams = state.teams;
    const teamSkipLists: (number[] | undefined)[] = newPlayers.map((_, i) => {
      if (!state.cfTeamMode || teams.length === 0) return undefined;
      const myTeam = teams[i];
      const teammates: number[] = [];
      for (let j = 0; j < newPlayers.length; j++) {
        if (j !== i && teams[j] === myTeam) teammates.push(j);
      }
      return teammates.length > 0 ? teammates : undefined;
    });

    // ── Bot AI steering ────────────────────────────────────────────────
    const newBotCounters = [...state.botReactionCounters];
    for (let i = 0; i < newPlayers.length; i++) {
      const p = newPlayers[i];
      if (!p.alive || !isBotToken(p.token)) continue;
      const botSlot = state.bots.find(b => b.token === p.token);
      if (!botSlot) continue;
      const params = BOT_PARAMS[botSlot.difficulty];
      // Only update steering when reaction counter hits 0
      if (newBotCounters[i] <= 0) {
        p.steering = computeBotSteering(p, i, { ...state, trails: newTrails }, botSlot.difficulty, basePlayerRadius, speed, teamSkipLists[i]);
        newBotCounters[i] = params.reactionDelay;
      } else {
        newBotCounters[i]--;
      }
    }

    // ── Move players ────────────────────────────────────────────────────
    for (let i = 0; i < newPlayers.length; i++) {
      const p = newPlayers[i];
      if (!p.alive) continue;

      // Effective player radius (thin/big effects)
      const pRadius = getPlayerRadius(p, basePlayerRadius);
      const pCollDist = pRadius * 2;
      const pCollDistSq = pCollDist * pCollDist;

      // Steering (reverse effect inverts direction)
      const reversed = hasEffect(p, 'reverse');
      if (p.steering === 'left') p.angle -= turnRate * (reversed ? -1 : 1);
      else if (p.steering === 'right') p.angle += turnRate * (reversed ? -1 : 1);

      // Movement with per-player speed (speed/slow effects)
      const pSpeed = getPlayerSpeed(p, speed);
      let newX = p.x + Math.cos(p.angle) * pSpeed;
      let newY = p.y + Math.sin(p.angle) * pSpeed;

      // Track distance
      const dx = newX - p.x;
      const dy = newY - p.y;
      statsAccum[i].distance += Math.sqrt(dx * dx + dy * dy);

      // Wall collision (shield does NOT protect from walls)
      if (isOutOfBounds(newX, newY, pRadius, shrinkInset, state.cfArenaShape, state.arenaWidth, state.arenaHeight)) {
        if (hasEffect(p, 'warp') && state.cfArenaShape === 'rectangle') {
          // Warp: wrap to opposite side of arena
          const margin = pRadius + shrinkInset;
          if (newX < margin) newX = state.arenaWidth - margin - 1;
          else if (newX > state.arenaWidth - margin) newX = margin + 1;
          if (newY < margin) newY = state.arenaHeight - margin - 1;
          else if (newY > state.arenaHeight - margin) newY = margin + 1;
        } else if (hasEffect(p, 'warp')) {
          // Non-rectangle arenas: warp behaves like phase (pass through walls)
          // Just skip the death — position stays out of bounds briefly
        } else {
          p.alive = false;
          statsAccum[i].deathTick = ticks;
          deaths.push({
            token: p.token, nickname: p.nickname,
            x: p.x, y: p.y, color: p.color,
            cause: 'wall',
          });
          newKillFeed.push({
            victim: p.nickname, victimColor: p.color,
            cause: 'wall', tick: ticks,
          });
          continue;
        }
      }

      // Obstacle collision
      if (state.obstacles.length > 0 && collidesWithObstacles(newX, newY, state.obstacles, pRadius)) {
        if (p.hasShield) {
          p.effects = p.effects.filter(e => e.type !== 'shield');
          p.hasShield = false;
        } else if (!hasEffect(p, 'phase')) {
          p.alive = false;
          statsAccum[i].deathTick = ticks;
          deaths.push({
            token: p.token, nickname: p.nickname,
            x: newX, y: newY, color: p.color,
            cause: 'wall',
          });
          newKillFeed.push({
            victim: p.nickname, victimColor: p.color,
            cause: 'wall', tick: ticks,
          });
          continue;
        }
      }

      // Trail collision (skip last 5 own segments for self-collision grace)
      // Phase effect: skip trail collision entirely
      // Note: inGap only controls trail drawing, NOT collision immunity
      if (!hasEffect(p, 'phase')) {
        const hitTrailIdx = collidesWithTrailsDetailed(newX, newY, newTrails, i, 5, pCollDistSq, teamSkipLists[i]);
        if (hitTrailIdx !== -1) {
          // Shield absorbs one trail collision
          if (p.hasShield) {
            p.effects = p.effects.filter(e => e.type !== 'shield');
            p.hasShield = false;
          } else {
            p.alive = false;
            statsAccum[i].deathTick = ticks;
            const cause: 'self' | 'other' = hitTrailIdx === i ? 'self' : 'other';
            const killer = cause === 'other' ? newPlayers[hitTrailIdx] : undefined;
            if (killer) {
              const killerIdx = newPlayers.indexOf(killer);
              if (killerIdx !== -1) statsAccum[killerIdx].kills++;
            }
            deaths.push({
              token: p.token, nickname: p.nickname,
              x: newX, y: newY, color: p.color,
              cause,
              killerToken: killer?.token,
              killerNickname: killer?.nickname,
              killerColor: killer?.color,
            });
            newKillFeed.push({
              victim: p.nickname, victimColor: p.color,
              cause,
              killer: killer?.nickname,
              killerColor: killer?.color,
              tick: ticks,
            });
            continue;
          }
        }
      }

      p.x = newX;
      p.y = newY;

      // ── Power-up pickup ───────────────────────────────────────────────
      if (puDensity) {
        const pickupDistSq = POWERUP_PICKUP_RADIUS * POWERUP_PICKUP_RADIUS;
        newPowerUps = newPowerUps.filter(pu => {
          const pdx = p.x - pu.x;
          const pdy = p.y - pu.y;
          if (pdx * pdx + pdy * pdy < pickupDistSq) {
            applyPowerUpPickup(p, i, pu.type, newPlayers, teams);
            statsAccum[i].powerUpsCollected++;
            return false;
          }
          return true;
        });
      }

      // Gap management
      if (state.cfNoGaps) {
        p.inGap = false;
      } else if (newGapRemaining[i] > 0) {
        newGapRemaining[i]--;
        p.inGap = true;
        if (newGapRemaining[i] <= 0) {
          p.inGap = false;
          newGapCounters[i] = scaledGapCounter(ticks);
        }
      } else {
        p.inGap = false;
        newGapCounters[i]--;
        if (newGapCounters[i] <= 0) {
          newGapRemaining[i] = newGapDuration();
          p.inGap = true;
        }
      }

      // Append trail segment only when not in gap
      if (!p.inGap) {
        newTrails[i].push({ x: newX, y: newY });
      }
    }

    // ── Power-up spawning & expiry ──────────────────────────────────────
    const allPuDisabled = state.cfDisabledPowerUps.length >= ALL_POWERUP_TYPES.length;
    if (puDensity && !allPuDisabled) {
      // Despawn expired
      newPowerUps = newPowerUps.filter(pu => ticks - pu.spawnTick < POWERUP_LIFETIME);

      // Spawn new
      spawnCounter--;
      if (spawnCounter <= 0) {
        const pu = spawnPowerUp({ ...state, powerUps: newPowerUps, trails: newTrails, powerUpNextId: nextPuId, shrinkInset }, ticks, puDensity.maxActive, basePlayerRadius);
        if (pu) {
          newPowerUps.push(pu);
          nextPuId++;
        }
        spawnCounter = newPowerUpSpawnCounter(state.cfPowerUpDensity);
      }
    }

    // Trim kill feed
    while (newKillFeed.length > KILL_FEED_MAX) newKillFeed.shift();

    // Build running round stats
    const roundStats = buildRoundStats(newPlayers, statsAccum, ticks);

    // Check if round should end
    const aliveCount = newPlayers.filter(p => p.alive).length;
    const shouldEnd = state.cfTeamMode
      ? shouldTeamRoundEnd(newPlayers, teams)
      : aliveCount <= 1 && newPlayers.length > 1;

    if (shouldEnd) {
      if (state.cfTeamMode) {
        // Award score to all surviving team members
        const aliveTeam = getAliveTeam(newPlayers, teams);
        if (aliveTeam !== -1) {
          for (let j = 0; j < newPlayers.length; j++) {
            if (teams[j] === aliveTeam) newPlayers[j].score += 1;
          }
        }
      } else {
        for (const p of newPlayers) {
          if (p.alive) p.score += 1;
        }
      }

      let roundWinner: string | null = null;
      for (const p of newPlayers) {
        if (p.alive) { roundWinner = p.token; break; }
      }

      return {
        ...state,
        phase: 'round_end',
        players: newPlayers,
        trails: newTrails,
        gapCounters: newGapCounters,
        gapRemaining: newGapRemaining,
        roundEndTimer: ROUND_END_TICKS,
        ticksElapsed: ticks,
        deaths,
        killFeed: newKillFeed,
        powerUps: [],
        roundWinner,
        roundStats,
        shrinkInset,
        currentTurn: firstAliveToken(newPlayers),
        powerUpSpawnCounter: spawnCounter,
        powerUpNextId: nextPuId,
        botReactionCounters: newBotCounters,
      };
    }

    return {
      ...state,
      players: newPlayers,
      trails: newTrails,
      gapCounters: newGapCounters,
      gapRemaining: newGapRemaining,
      ticksElapsed: ticks,
      deaths,
      killFeed: newKillFeed,
      powerUps: newPowerUps,
      roundStats,
      shrinkInset,
      currentTurn: firstAliveToken(newPlayers),
      powerUpSpawnCounter: spawnCounter,
      powerUpNextId: nextPuId,
      botReactionCounters: newBotCounters,
    };
  },

  getStatus(state: CurveFeverState): StatusResult {
    if (state.phase === 'finished' && state.winner) {
      return { status: 'win', winner: state.winner };
    }
    return { status: 'ongoing' };
  },
};

// ── Team mode helpers ────────────────────────────────────────────────────────

function shouldTeamRoundEnd(players: CurveFeverPlayer[], teams: number[]): boolean {
  if (teams.length === 0) return false;
  const aliveTeams = new Set<number>();
  for (let i = 0; i < players.length; i++) {
    if (players[i].alive) aliveTeams.add(teams[i]);
  }
  return aliveTeams.size <= 1;
}

function getAliveTeam(players: CurveFeverPlayer[], teams: number[]): number {
  for (let i = 0; i < players.length; i++) {
    if (players[i].alive) return teams[i];
  }
  return -1;
}

function findTeamMatchWinner(state: CurveFeverState): string | null {
  if (state.teams.length === 0) return null;
  // Check if any team's total score >= winsNeeded
  const teamScores: Record<number, number> = {};
  for (let i = 0; i < state.players.length; i++) {
    const team = state.teams[i];
    teamScores[team] = (teamScores[team] ?? 0) + state.players[i].score;
  }
  // In team mode, use per-player score (each round gives +1 to all team members)
  // So check max individual score against winsNeeded
  for (const p of state.players) {
    if (p.score >= state.winsNeeded) return p.token;
  }
  return null;
}
