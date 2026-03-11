import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type { CurveFeverState, CurveFeverAction, CurveFeverPlayer, TrailSegment, CurveFeverConfig, CfDeathEvent, CfKillFeedEntry, CfPowerUp, CfPowerUpType, CfActiveEffect } from 'shared';

// Constants (mirrored from shared to avoid CJS import issues)
const ARENA_W = 800;
const ARENA_H = 600;
const BASE_SPEED = 2;
const SPEED_INCREASE_PER_SEC = 0.06;
const MAX_SPEED = 4.5;
const TURN_RATE = 0.05;
const PLAYER_RADIUS = 3;
const GAP_INTERVAL_MIN = 80;
const GAP_INTERVAL_MAX = 160;
const GAP_DURATION_MIN = 8;
const GAP_DURATION_MAX = 14;
const COUNTDOWN_TICKS = 60;
const TICK_INTERVAL = 50;
const ROUND_END_TICKS = 80;
const TICKS_PER_SEC = 20;
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

// Power-up constants
const POWERUP_SPAWN_INTERVAL_MIN = 100;
const POWERUP_SPAWN_INTERVAL_MAX = 200;
const POWERUP_MAX_ACTIVE = 3;
const POWERUP_LIFETIME = 200;
const POWERUP_PICKUP_RADIUS = 12;
const POWERUP_SPEED_DURATION = 40;
const POWERUP_SPEED_MULTIPLIER = 1.5;
const POWERUP_SHIELD_DURATION = 200;
const POWERUP_PHASE_DURATION = 20;
const KILL_FEED_MAX = 5;

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

function newPowerUpSpawnCounter(): number {
  return randRange(POWERUP_SPAWN_INTERVAL_MIN, POWERUP_SPAWN_INTERVAL_MAX);
}

const POWERUP_TYPES: CfPowerUpType[] = ['speed', 'shield', 'phase'];

function randomPowerUpType(): CfPowerUpType {
  return POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
}

/** Compute current movement speed based on ticks elapsed this round. */
function currentSpeed(ticksElapsed: number): number {
  const seconds = ticksElapsed / TICKS_PER_SEC;
  return Math.min(BASE_SPEED + seconds * SPEED_INCREASE_PER_SEC, MAX_SPEED);
}

/** Compute turn rate that scales slightly with speed so steering stays responsive. */
function currentTurnRate(speed: number): number {
  return TURN_RATE * (0.7 + 0.3 * (speed / BASE_SPEED));
}

function emptyEffects(): CfActiveEffect[] { return []; }

/** Place players in a circle facing the center. */
function placePlayers(playerIds: string[], nicknames: string[], scores: number[]): {
  players: CurveFeverPlayer[];
  trails: TrailSegment[][];
  gapCounters: number[];
  gapRemaining: number[];
} {
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  const radius = Math.min(ARENA_W, ARENA_H) * 0.3;
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

// ── Collision detection ─────────────────────────────────────────────────────

const COLLISION_DIST = PLAYER_RADIUS * 2;
const COLLISION_DIST_SQ = COLLISION_DIST * COLLISION_DIST;

/** Returns the trail index that caused collision, or -1 if no collision. */
function collidesWithTrailsDetailed(
  px: number, py: number,
  trails: TrailSegment[][],
  skipTrailIdx: number,
  skipLast: number,
): number {
  for (let ti = 0; ti < trails.length; ti++) {
    const trail = trails[ti];
    const end = ti === skipTrailIdx ? trail.length - skipLast : trail.length;
    for (let s = 0; s < end; s++) {
      const seg = trail[s];
      const dx = px - seg.x;
      const dy = py - seg.y;
      if (dx * dx + dy * dy < COLLISION_DIST_SQ) return ti;
    }
  }
  return -1;
}

function collidesWithTrails(
  px: number, py: number,
  trails: TrailSegment[][],
  skipTrailIdx: number,
  skipLast: number,
): boolean {
  for (let ti = 0; ti < trails.length; ti++) {
    const trail = trails[ti];
    const end = ti === skipTrailIdx ? trail.length - skipLast : trail.length;
    for (let s = 0; s < end; s++) {
      const seg = trail[s];
      const dx = px - seg.x;
      const dy = py - seg.y;
      if (dx * dx + dy * dy < COLLISION_DIST_SQ) return true;
    }
  }
  return false;
}

function isOutOfBounds(x: number, y: number): boolean {
  return x < PLAYER_RADIUS || x > ARENA_W - PLAYER_RADIUS ||
         y < PLAYER_RADIUS || y > ARENA_H - PLAYER_RADIUS;
}

// ── Power-up helpers ────────────────────────────────────────────────────────

function hasEffect(p: CurveFeverPlayer, type: CfPowerUpType): boolean {
  return p.effects.some(e => e.type === type);
}

function getPlayerSpeed(p: CurveFeverPlayer, baseSpeed: number): number {
  if (hasEffect(p, 'speed')) return baseSpeed * POWERUP_SPEED_MULTIPLIER;
  return baseSpeed;
}

function spawnPowerUp(state: CurveFeverState, ticks: number): CfPowerUp | null {
  if (state.powerUps.length >= POWERUP_MAX_ACTIVE) return null;

  // Random position with margin from walls
  const margin = 40;
  const x = margin + Math.random() * (ARENA_W - 2 * margin);
  const y = margin + Math.random() * (ARENA_H - 2 * margin);

  // Avoid spawning on existing trails (rough check)
  if (collidesWithTrails(x, y, state.trails, -1, 0)) return null;

  return {
    id: state.powerUpNextId,
    type: randomPowerUpType(),
    x, y,
    spawnTick: ticks,
  };
}

function effectDuration(type: CfPowerUpType): number {
  switch (type) {
    case 'speed': return POWERUP_SPEED_DURATION;
    case 'shield': return POWERUP_SHIELD_DURATION;
    case 'phase': return POWERUP_PHASE_DURATION;
  }
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
    const bestOf = cfg.bestOf ?? 5;
    const winsNeeded = Math.ceil(bestOf / 2);
    const nicknames = playerIds.map((_, i) => `Player ${i + 1}`);
    const scores = playerIds.map(() => 0);
    const { players, trails, gapCounters, gapRemaining } = placePlayers(playerIds, nicknames, scores);

    return {
      phase: 'lobby',
      players,
      playerIds: [...playerIds],
      currentTurn: playerIds[0],
      arenaWidth: ARENA_W,
      arenaHeight: ARENA_H,
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
      trails,
      gapCounters,
      gapRemaining,
      roundEndTimer: 0,
      powerUpSpawnCounter: newPowerUpSpawnCounter(),
      powerUpNextId: 1,
    };
  },

  applyAction(state: CurveFeverState, action: CurveFeverAction, ctx: ActionContext): CurveFeverState {
    if (action.type === 'CF_START') {
      if (ctx.playerIndex !== 0 || state.phase !== 'lobby') return state;
      if (state.players.length < 2) return state;

      const nicknames = state.players.map(p => p.nickname);
      const scores = state.players.map(() => 0);
      const placed = placePlayers(state.playerIds, nicknames, scores);

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
        powerUpSpawnCounter: newPowerUpSpawnCounter(),
        powerUpNextId: 1,
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
          powerUpSpawnCounter: newPowerUpSpawnCounter(),
          powerUpNextId: 1,
        };
      }
      return { ...state, countdownTimer: timer, deaths: [] };
    }

    // Round end pause
    if (state.phase === 'round_end') {
      const timer = state.roundEndTimer - 1;
      if (timer <= 0) {
        const matchWinner = state.players.find(p => p.score >= state.winsNeeded);
        if (matchWinner) {
          return {
            ...state,
            phase: 'finished',
            winner: matchWinner.token,
            status: 'win',
            roundEndTimer: 0,
            deaths: [],
            currentTurn: matchWinner.token,
          };
        }
        const nicknames = state.players.map(p => p.nickname);
        const scores = state.players.map(p => p.score);
        const { players, trails, gapCounters, gapRemaining } = placePlayers(state.playerIds, nicknames, scores);
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
          currentTurn: firstAliveToken(players),
          powerUpSpawnCounter: newPowerUpSpawnCounter(),
          powerUpNextId: 1,
        };
      }
      return { ...state, roundEndTimer: timer, deaths: [] };
    }

    if (state.phase === 'finished') return state;

    // ── Playing phase: simulate one tick ─────────────────────────────────
    const ticks = state.ticksElapsed + 1;
    const speed = currentSpeed(ticks);
    const turnRate = currentTurnRate(speed);

    const newPlayers = state.players.map(p => ({ ...p, effects: p.effects.map(e => ({ ...e })) }));
    const newTrails = state.trails.map(tr => [...tr]);
    const newGapCounters = [...state.gapCounters];
    const newGapRemaining = [...state.gapRemaining];
    const deaths: CfDeathEvent[] = [];
    const newKillFeed = [...state.killFeed];
    let newPowerUps = [...state.powerUps];
    let spawnCounter = state.powerUpSpawnCounter;
    let nextPuId = state.powerUpNextId;

    // ── Tick down active effects ────────────────────────────────────────
    for (const p of newPlayers) {
      p.effects = p.effects
        .map(e => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
        .filter(e => e.remainingTicks > 0);
      p.hasShield = hasEffect(p, 'shield');
    }

    // ── Move players ────────────────────────────────────────────────────
    for (let i = 0; i < newPlayers.length; i++) {
      const p = newPlayers[i];
      if (!p.alive) continue;

      // Steering
      if (p.steering === 'left') p.angle -= turnRate;
      else if (p.steering === 'right') p.angle += turnRate;

      // Movement with per-player speed (speed boost)
      const pSpeed = getPlayerSpeed(p, speed);
      const newX = p.x + Math.cos(p.angle) * pSpeed;
      const newY = p.y + Math.sin(p.angle) * pSpeed;

      // Wall collision (shield does NOT protect from walls)
      if (isOutOfBounds(newX, newY)) {
        p.alive = false;
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

      // Trail collision (skip last 5 own segments for self-collision grace)
      // Phase effect: skip trail collision entirely
      if (!p.inGap && !hasEffect(p, 'phase')) {
        const hitTrailIdx = collidesWithTrailsDetailed(newX, newY, newTrails, i, 5);
        if (hitTrailIdx !== -1) {
          // Shield absorbs one trail collision
          if (p.hasShield) {
            p.effects = p.effects.filter(e => e.type !== 'shield');
            p.hasShield = false;
          } else {
            p.alive = false;
            const cause: 'self' | 'other' = hitTrailIdx === i ? 'self' : 'other';
            const killer = cause === 'other' ? newPlayers[hitTrailIdx] : undefined;
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
      const pickupDistSq = POWERUP_PICKUP_RADIUS * POWERUP_PICKUP_RADIUS;
      newPowerUps = newPowerUps.filter(pu => {
        const dx = p.x - pu.x;
        const dy = p.y - pu.y;
        if (dx * dx + dy * dy < pickupDistSq) {
          // Apply effect
          p.effects.push({ type: pu.type, remainingTicks: effectDuration(pu.type) });
          if (pu.type === 'shield') p.hasShield = true;
          return false; // remove from arena
        }
        return true;
      });

      // Gap management
      if (newGapRemaining[i] > 0) {
        newGapRemaining[i]--;
        p.inGap = true;
        if (newGapRemaining[i] <= 0) {
          p.inGap = false;
          newGapCounters[i] = newGapCounter();
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
    // Despawn expired
    newPowerUps = newPowerUps.filter(pu => ticks - pu.spawnTick < POWERUP_LIFETIME);

    // Spawn new
    spawnCounter--;
    if (spawnCounter <= 0) {
      const pu = spawnPowerUp({ ...state, powerUps: newPowerUps, trails: newTrails, powerUpNextId: nextPuId }, ticks);
      if (pu) {
        newPowerUps.push(pu);
        nextPuId++;
      }
      spawnCounter = newPowerUpSpawnCounter();
    }

    // Trim kill feed
    while (newKillFeed.length > KILL_FEED_MAX) newKillFeed.shift();

    // Check if round should end (≤1 alive)
    const aliveCount = newPlayers.filter(p => p.alive).length;
    if (aliveCount <= 1 && newPlayers.length > 1) {
      let roundWinner: string | null = null;
      for (const p of newPlayers) {
        if (p.alive) {
          p.score += 1;
          roundWinner = p.token;
        }
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
        currentTurn: firstAliveToken(newPlayers),
        powerUpSpawnCounter: spawnCounter,
        powerUpNextId: nextPuId,
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
      currentTurn: firstAliveToken(newPlayers),
      powerUpSpawnCounter: spawnCounter,
      powerUpNextId: nextPuId,
    };
  },

  getStatus(state: CurveFeverState): StatusResult {
    if (state.phase === 'finished' && state.winner) {
      return { status: 'win', winner: state.winner };
    }
    return { status: 'ongoing' };
  },
};
