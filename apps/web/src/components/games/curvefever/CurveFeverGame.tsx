'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { CurveFeverState, CfDeathEvent, CfKillFeedEntry, CfPowerUpType, CfSpeedSetting, CfPowerUpDensity, CfThickness, CfArenaShape, CfMapSize, CfBotDifficulty, RoomVisibility } from 'shared';
import { isBotToken } from 'shared';
import { ReconnectBanner } from '@/components/ui/ReconnectBanner';
import { useAchievements } from '@/hooks/useAchievements';
import { NicknameEditor } from '@/components/NicknameEditor';
import { ChatPanelWithProfile as ChatPanel } from '@/components/chat/ChatPanelWithProfile';
import { SpectatorBanner } from '@/components/ui/SpectatorBanner';
import { WaitingForConnectionOverlay } from '@/components/WaitingForConnectionOverlay';
import { saveLastConfig, loadLastConfig, hasLastConfig } from '@/lib/lobbyPresets';
import { ReplayControls } from '@/components/ui/ReplayControls';
import { useReplay } from '@/hooks/useReplay';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

const ARENA_W = 800;
const ARENA_H = 600;
const PLAYER_RADIUS = 3;
const TICKS_PER_SEC = 30;
const TICK_MS = 33; // 1000/30
const POWERUP_PICKUP_RADIUS = 12;

// ── Power-up visuals ─────────────────────────────────────────────────────────

const POWERUP_COLORS: Record<CfPowerUpType, string> = {
  speed: '#f39c12',   // amber
  shield: '#3498db',  // blue
  phase: '#9b59b6',   // purple
  slow: '#1abc9c',    // teal
  thin: '#e91e63',    // pink
  reverse: '#ff5722', // deep orange
  big: '#8bc34a',     // light green
  warp: '#e74c3c',    // red
};

const POWERUP_ICONS: Record<CfPowerUpType, string> = {
  speed: '⚡',
  shield: '🛡',
  phase: '👻',
  slow: '🐢',
  thin: '📍',
  reverse: '🔄',
  big: '💪',
  warp: '🌀',
};

// ── Death particle system (client-only) ──────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;    // 0..1, decreases each frame
  size: number;
}

function spawnDeathParticles(x: number, y: number, color: string): Particle[] {
  const count = 18 + Math.floor(Math.random() * 8);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1,
      size: 1.5 + Math.random() * 2.5,
    });
  }
  return particles;
}

// ── Pickup sparkle particles ─────────────────────────────────────────────────

function spawnPickupParticles(x: number, y: number, color: string): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      life: 1,
      size: 1 + Math.random() * 2,
    });
  }
  return particles;
}

// ── Trail accumulation (client-side) ─────────────────────────────────────────

interface ClientTrails {
  segments: Array<Array<{ x: number; y: number }[]>>;
  round: number;
}

// ── Screen shake state ───────────────────────────────────────────────────────

interface ShakeState {
  intensity: number;
  decay: number;
}

// ── Kill feed entry with client timestamp ────────────────────────────────────

interface KillFeedDisplay {
  entry: CfKillFeedEntry;
  addedAt: number;  // Date.now()
}

const KILL_FEED_DISPLAY_MS = 4000;

// ── Arena shape rendering helpers ──────────────────────────────────────────────

const SQRT3_2 = Math.sqrt(3) / 2;

/** Trace a shape path on the canvas context (does NOT call beginPath — caller does). */
function traceShapePath(ctx: CanvasRenderingContext2D, shape: CfArenaShape, inset: number, aW: number, aH: number) {
  const cx = aW / 2;
  const cy = aH / 2;
  const circleR = Math.min(aW, aH) / 2 - 10;
  const hexR = circleR - 5;
  switch (shape) {
    case 'rectangle': {
      const m = inset;
      ctx.rect(m + 1, m + 1, aW - 2 * m - 2, aH - 2 * m - 2);
      break;
    }
    case 'circle': {
      const r = circleR - inset;
      if (r > 0) ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    }
    case 'hexagon': {
      const R = hexR - inset;
      if (R <= 0) break;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const vx = cx + R * Math.cos(angle);
        const vy = cy + R * Math.sin(angle);
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      break;
    }
    case 'diamond': {
      const hw = aW / 2 - 10 - inset;
      const hh = aH / 2 - 10 - inset;
      if (hw <= 0 || hh <= 0) break;
      ctx.moveTo(cx, cy - hh);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx, cy + hh);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      break;
    }
  }
}

/** Max duration for each power-up effect (for countdown ring rendering). */
function effectMaxDuration(type: CfPowerUpType): number {
  switch (type) {
    case 'speed': return 60;
    case 'shield': return 300;
    case 'phase': return 60;
    case 'slow': return 90;
    case 'thin': return 120;
    case 'reverse': return 90;
    case 'big': return 90;
    case 'warp': return 90;
  }
}

export function CurveFeverGame({ wsUrl, gameId, initialRoomCode, quickPlay: autoQuickPlay }: GameComponentProps) {
  const mp = useMultiplayer<CurveFeverState>(wsUrl, gameId);
  const { t } = useI18n();
  const ach = useAchievements('curvefever', mp.roomCode);
  const replay = useReplay<CurveFeverState>(mp.stateHistory as CurveFeverState[]);
  const liveGs = mp.gameState;
  const gs = replay.displayState ?? liveGs;

  // Lobby config
  const [bestOf, setBestOf] = useState(5);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibility>('private');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [cfSpeed, setCfSpeed] = useState<CfSpeedSetting>('normal');
  const [cfPowerUps, setCfPowerUps] = useState<CfPowerUpDensity>('normal');
  const [cfThickness, setCfThickness] = useState<CfThickness>('normal');
  const [cfNoGaps, setCfNoGaps] = useState(false);
  const [cfShrinking, setCfShrinking] = useState(false);
  const [cfSuddenDeath, setCfSuddenDeath] = useState(false);
  const [cfDisabledPUs, setCfDisabledPUs] = useState<CfPowerUpType[]>([]);
  const [cfObstacles, setCfObstacles] = useState(false);
  const [cfTeamMode, setCfTeamMode] = useState(false);
  const [cfArenaShape, setCfArenaShape] = useState<CfArenaShape>('rectangle');
  const [cfMapSize, setCfMapSize] = useState<CfMapSize>('normal');

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Client-side trail accumulation
  const trailsRef = useRef<ClientTrails>({ segments: [], round: 0 });
  const lastSteerRef = useRef<'left' | 'right' | 'none'>('none');

  // Particle system
  const particlesRef = useRef<Particle[]>([]);

  // Screen shake
  const shakeRef = useRef<ShakeState>({ intensity: 0, decay: 0 });

  // Interpolation: track when last server state arrived
  const lastStateTimeRef = useRef(0);

  // Track which death events we already spawned particles for
  const processedDeathsRef = useRef<Set<string>>(new Set());

  // Kill feed display
  const [killFeedItems, setKillFeedItems] = useState<KillFeedDisplay[]>([]);
  const lastKillFeedLenRef = useRef(0);

  // Track power-up IDs for pickup sparkles
  const knownPowerUpsRef = useRef<Set<number>>(new Set());

  const myToken = typeof window !== 'undefined' ? localStorage.getItem('wg_player_token') ?? '' : '';

  // Track when server state arrives (for interpolation)
  useEffect(() => {
    if (gs?.phase === 'playing') lastStateTimeRef.current = performance.now();
  }, [gs?.ticksElapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-join logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mp.connection !== 'connected') return;
    if (mp.phase !== 'lobby') return;
    if (initialRoomCode) {
      mp.joinRoom(initialRoomCode);
    } else if (autoQuickPlay) {
      mp.quickPlay();
    }
  }, [mp.connection, mp.phase, initialRoomCode, autoQuickPlay, mp.joinRoom, mp.quickPlay]);

  // ── Achievement tracking ────────────────────────────────────────────────
  const prevPhaseRef = useRef(mp.phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'ended' && mp.phase !== 'ended') ach.reset();
    prevPhaseRef.current = mp.phase;
  }, [mp.phase, ach]);

  useEffect(() => {
    if (gs?.phase === 'playing' && !mp.isSpectator) ach.trackPlay();
  }, [gs?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gs?.phase === 'finished' && gs.winner && !mp.isSpectator) {
      if (gs.winner === myToken) ach.trackWin();
      else ach.trackLoss();
    }
  }, [gs?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard input ───────────────────────────────────────────────────────
  const sendSteer = useCallback((dir: 'left' | 'right' | 'none') => {
    if (dir === lastSteerRef.current) return;
    lastSteerRef.current = dir;
    mp.sendAction({ type: 'CF_STEER', direction: dir });
  }, [mp.sendAction]);

  useEffect(() => {
    if (!gs || gs.phase !== 'playing') return;
    if (mp.isSpectator || replay.isReplaying) return;

    // Reset steer ref so held keys re-send after round transitions
    lastSteerRef.current = 'none';

    const pressed = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        pressed.add('left');
        sendSteer('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        pressed.add('right');
        sendSteer('right');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') pressed.delete('left');
      else if (e.key === 'ArrowRight' || e.key === 'd') pressed.delete('right');

      if (pressed.has('left')) sendSteer('left');
      else if (pressed.has('right')) sendSteer('right');
      else sendSteer('none');
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gs?.phase, mp.isSpectator, sendSteer, gs?.round]);

  // ── Process death events → particles ──────────────────────────────────
  useEffect(() => {
    if (!gs?.deaths?.length) return;
    const processed = processedDeathsRef.current;

    for (const d of gs.deaths) {
      const key = `${d.token}-${gs.round}-${gs.ticksElapsed}`;
      if (processed.has(key)) continue;
      processed.add(key);
      particlesRef.current.push(...spawnDeathParticles(d.x, d.y, d.color));

      // Screen shake if it's our death
      if (d.token === myToken) {
        shakeRef.current = { intensity: 6, decay: 0.88 };
      }
    }

    // Prevent processed set from growing forever
    if (processed.size > 200) processed.clear();
  }, [gs?.deaths, gs?.round, gs?.ticksElapsed, myToken]);

  // ── Kill feed from server state ───────────────────────────────────────
  useEffect(() => {
    if (!gs?.killFeed) return;
    const feedLen = gs.killFeed.length;
    if (feedLen > lastKillFeedLenRef.current) {
      const newEntries = gs.killFeed.slice(lastKillFeedLenRef.current);
      const now = Date.now();
      setKillFeedItems(prev => [
        ...newEntries.map(entry => ({ entry, addedAt: now })),
        ...prev,
      ].slice(0, 8));
    }
    lastKillFeedLenRef.current = feedLen;
  }, [gs?.killFeed]);

  // Reset kill feed on new round
  useEffect(() => {
    if (gs?.phase === 'countdown') {
      setKillFeedItems([]);
      lastKillFeedLenRef.current = 0;
    }
  }, [gs?.phase]);

  // Auto-expire kill feed items
  useEffect(() => {
    if (killFeedItems.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setKillFeedItems(prev => prev.filter(item => now - item.addedAt < KILL_FEED_DISPLAY_MS));
    }, 500);
    return () => clearInterval(timer);
  }, [killFeedItems.length]);

  // ── Power-up pickup sparkle tracking ──────────────────────────────────
  useEffect(() => {
    if (!gs?.powerUps) return;
    const currentIds = new Set(gs.powerUps.map(pu => pu.id));
    const known = knownPowerUpsRef.current;

    // Detect removed power-ups (picked up or expired) — spawn sparkle at last known position
    // We only track IDs, so we can't get position after removal. Instead, track on addition.
    for (const pu of gs.powerUps) {
      known.add(pu.id);
    }
    // Clean up IDs no longer present
    for (const id of known) {
      if (!currentIds.has(id)) known.delete(id);
    }
  }, [gs?.powerUps]);

  // ── Reset trails when entering countdown (new round or game start) ───────
  useEffect(() => {
    if (!gs || gs.phase !== 'countdown') return;
    const tr = trailsRef.current;
    tr.segments = gs.players.map(() => []);
    tr.round = gs.round;
  }, [gs?.phase === 'countdown' ? gs.round : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trail accumulation from server state ─────────────────────────────────
  useEffect(() => {
    if (!gs) return;
    // Only accumulate trails during active gameplay
    if (gs.phase !== 'playing') return;
    const tr = trailsRef.current;

    // Reset trails on new round (safety check)
    if (gs.round !== tr.round) {
      tr.segments = gs.players.map(() => []);
      tr.round = gs.round;
    }

    while (tr.segments.length < gs.players.length) {
      tr.segments.push([]);
    }

    for (let i = 0; i < gs.players.length; i++) {
      const p = gs.players[i];
      if (!p.alive) continue;

      const segs = tr.segments[i];
      if (p.inGap) {
        if (segs.length > 0 && segs[segs.length - 1].length > 0) {
          segs.push([]);
        }
      } else {
        if (segs.length === 0) segs.push([]);
        const curSeg = segs[segs.length - 1];
        // Detect wall teleport: if the position jumped more than half the arena, start a new segment
        if (curSeg.length > 0) {
          const last = curSeg[curSeg.length - 1];
          const dx = Math.abs(p.x - last.x);
          const dy = Math.abs(p.y - last.y);
          const arenaW = gs.arenaWidth ?? 800;
          const arenaH = gs.arenaHeight ?? 600;
          if (dx > arenaW * 0.4 || dy > arenaH * 0.4) {
            // Wall warp — break the segment so no line is drawn across the arena
            segs.push([]);
          }
        }
        segs[segs.length - 1].push({ x: p.x, y: p.y });
      }
    }
  }, [gs]);

  // ── Canvas rendering ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;

    const draw = () => {
      animFrame = requestAnimationFrame(draw);
      const state = gs;
      if (!state) return;
      if (state.phase === 'lobby') return;

      // Size canvas to fill its CSS dimensions at native resolution
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW === 0 || cssH === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const bufW = Math.round(cssW * dpr);
      const bufH = Math.round(cssH * dpr);
      if (canvas.width !== bufW) canvas.width = bufW;
      if (canvas.height !== bufH) canvas.height = bufH;

      // Dynamic arena dimensions from server state
      const aW = state.arenaWidth || ARENA_W;
      const aH = state.arenaHeight || ARENA_H;

      // Scale all drawing from arena coords to actual pixel buffer
      const sx = bufW / aW;
      const sy = bufH / aH;
      ctx.setTransform(sx, 0, 0, sy, 0, 0);

      // Screen shake offset
      const shake = shakeRef.current;
      let shakeX = 0, shakeY = 0;
      if (shake.intensity > 0.5) {
        shakeX = (Math.random() - 0.5) * shake.intensity * 2;
        shakeY = (Math.random() - 0.5) * shake.intensity * 2;
        shake.intensity *= shake.decay;
        if (shake.intensity < 0.5) shake.intensity = 0;
      }
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(-10, -10, aW + 20, aH + 20);

      const arenaShape = state.cfArenaShape ?? 'rectangle';

      // Grid — clip to arena shape for non-rect
      ctx.save();
      if (arenaShape !== 'rectangle') {
        ctx.beginPath();
        traceShapePath(ctx, arenaShape, 0, aW, aH);
        ctx.clip();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < aW; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, aH); ctx.stroke();
      }
      for (let gy = 0; gy < aH; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(aW, gy); ctx.stroke();
      }
      ctx.restore();

      // Arena border
      ctx.beginPath();
      traceShapePath(ctx, arenaShape, 0, aW, aH);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Darken area outside non-rectangular arenas
      if (arenaShape !== 'rectangle') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, aW, aH);
        traceShapePath(ctx, arenaShape, 0, aW, aH);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        // Even-odd fill: fills outside shape but inside rect
        (ctx as CanvasRenderingContext2D).fill('evenodd');
        ctx.restore();
      }

      // Shrinking arena boundary
      const shrink = state.shrinkInset ?? 0;
      if (shrink > 0.5) {
        // Fill deadly zone between outer and inner shape
        ctx.save();
        ctx.beginPath();
        traceShapePath(ctx, arenaShape, 0, aW, aH);
        traceShapePath(ctx, arenaShape, shrink, aW, aH);
        ctx.fillStyle = 'rgba(220,38,38,0.08)';
        (ctx as CanvasRenderingContext2D).fill('evenodd');
        ctx.restore();

        // Inner boundary line (dashed)
        ctx.beginPath();
        traceShapePath(ctx, arenaShape, shrink, aW, aH);
        ctx.strokeStyle = 'rgba(239,68,68,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Draw obstacles ──────────────────────────────────────────────────
      if (state.obstacles?.length) {
        for (const ob of state.obstacles) {
          // Dark block with subtle border
          ctx.fillStyle = 'rgba(120,120,140,0.35)';
          ctx.beginPath();
          ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(160,160,180,0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Diagonal hatch lines for texture
          ctx.save();
          ctx.beginPath();
          ctx.rect(ob.x, ob.y, ob.w, ob.h);
          ctx.clip();
          ctx.strokeStyle = 'rgba(180,180,200,0.12)';
          ctx.lineWidth = 1;
          for (let d = -ob.h; d < ob.w; d += 8) {
            ctx.beginPath();
            ctx.moveTo(ob.x + d, ob.y);
            ctx.lineTo(ob.x + d + ob.h, ob.y + ob.h);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // ── Draw trails ─────────────────────────────────────────────────────
      const trails = trailsRef.current.segments;
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        const segments = trails[i] ?? [];
        const isDead = !p.alive;

        const trailRadius = state.cfThickness === 'thin' ? 2 : state.cfThickness === 'thick' ? 5 : PLAYER_RADIUS;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = trailRadius * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = isDead ? 0.3 : 1;
        ctx.shadowColor = isDead ? 'transparent' : p.color;
        ctx.shadowBlur = isDead ? 0 : 6;

        for (const seg of segments) {
          if (seg.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(seg[0].x, seg[0].y);
          for (let j = 1; j < seg.length; j++) {
            ctx.lineTo(seg[j].x, seg[j].y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ── Draw power-ups ────────────────────────────────────────────────
      ctx.shadowBlur = 0;
      const now = performance.now();
      for (const pu of state.powerUps) {
        const puColor = POWERUP_COLORS[pu.type];
        const floatY = Math.sin(now / 400 + pu.id * 2) * 3;

        // Outer glow circle
        ctx.beginPath();
        ctx.arc(pu.x, pu.y + floatY, POWERUP_PICKUP_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = puColor + '30';
        ctx.shadowColor = puColor;
        ctx.shadowBlur = 12;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(pu.x, pu.y + floatY, 8, 0, Math.PI * 2);
        ctx.fillStyle = puColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Icon
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWERUP_ICONS[pu.type], pu.x, pu.y + floatY);
      }

      // ── Draw player heads (alive only) with client-side interpolation ──
      ctx.shadowBlur = 0;

      // Compute interpolation factor: how far ahead of the last server tick we are
      const lastStateT = lastStateTimeRef.current;
      const elapsed = lastStateT > 0 ? performance.now() - lastStateT : 0;
      // Clamp to one tick interval max to avoid overshooting
      const interpFrac = Math.min(elapsed / TICK_MS, 1);
      // Estimate speed from ticksElapsed (same formula as server)
      const speedPresets: Record<string, { base: number; inc: number; max: number }> = {
        slow:   { base: 1.0, inc: 0.033, max: 2.3 },
        normal: { base: 1.5, inc: 0.07,  max: 3.7 },
        fast:   { base: 2.1, inc: 0.1,   max: 5.0 },
      };
      const sp = speedPresets[state.cfSpeed] ?? speedPresets.normal;
      const estSpeed = Math.min(sp.base + (state.ticksElapsed / TICKS_PER_SEC) * sp.inc, sp.max);

      for (const p of state.players) {
        if (!p.alive) continue;

        // Interpolated position: extrapolate forward based on angle and speed
        let pSpeed = estSpeed;
        if (p.effects.some(e => e.type === 'speed')) pSpeed *= 1.5;
        if (p.effects.some(e => e.type === 'slow')) pSpeed *= 0.5;
        const px = p.x + Math.cos(p.angle) * pSpeed * interpFrac;
        const py = p.y + Math.sin(p.angle) * pSpeed * interpFrac;

        const hasPhase = p.effects.some(e => e.type === 'phase');
        const hasShield = p.hasShield;
        const hasSpeed = p.effects.some(e => e.type === 'speed');
        const hasSlow = p.effects.some(e => e.type === 'slow');
        const hasReverse = p.effects.some(e => e.type === 'reverse');
        const hasThin = p.effects.some(e => e.type === 'thin');
        const hasBig = p.effects.some(e => e.type === 'big');

        // Effective head size
        let headRadius = PLAYER_RADIUS + 2;
        if (hasThin) headRadius = Math.max(2, headRadius * 0.5);
        if (hasBig) headRadius *= 1.8;

        // Shield ring
        if (hasShield) {
          ctx.beginPath();
          ctx.arc(px, py, headRadius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = POWERUP_COLORS.shield + '80';
          ctx.lineWidth = 2;
          ctx.shadowColor = POWERUP_COLORS.shield;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Phase: ghostly transparency
        ctx.globalAlpha = hasPhase ? 0.5 : 1;

        // Head color: priority speed > slow > reverse > thin > normal
        const headColor = hasSpeed ? POWERUP_COLORS.speed
          : hasSlow ? POWERUP_COLORS.slow
          : hasReverse ? POWERUP_COLORS.reverse
          : hasThin ? POWERUP_COLORS.thin
          : p.color;
        const headGlow = (hasSpeed || hasSlow || hasReverse || hasThin) ? 20 : 14;

        ctx.beginPath();
        ctx.arc(px, py, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = headGlow;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // ── Effect countdown rings ──────────────────────────────────────
        const timedEffects = p.effects.filter(e => e.type !== 'shield');
        if (timedEffects.length > 0) {
          const ringBase = PLAYER_RADIUS + 9;
          for (let ei = 0; ei < timedEffects.length; ei++) {
            const eff = timedEffects[ei];
            const maxDur = effectMaxDuration(eff.type);
            const pct = eff.remainingTicks / maxDur;
            const ringR = ringBase + ei * 4;
            const effColor = POWERUP_COLORS[eff.type];
            // Background track
            ctx.beginPath();
            ctx.arc(px, py, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = effColor + '20';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Progress arc
            ctx.beginPath();
            ctx.arc(px, py, ringR, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
            ctx.strokeStyle = effColor + '90';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }
      }

      // ── Draw & update particles ─────────────────────────────────────────
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pr = particles[i];
        pr.x += pr.vx;
        pr.y += pr.vy;
        pr.vx *= 0.96;
        pr.vy *= 0.96;
        pr.life -= 0.025;

        if (pr.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = pr.life;
        ctx.fillStyle = pr.color;
        ctx.shadowColor = pr.color;
        ctx.shadowBlur = 8 * pr.life;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.size * pr.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // ── Overlays ────────────────────────────────────────────────────────
      const cx = aW / 2;
      const cy = aH / 2;

      // Speed indicator (subtle, bottom-center during play)
      if (state.phase === 'playing') {
        const seconds = state.ticksElapsed / TICKS_PER_SEC;
        const presets = { slow: [1.5, 0.05, 3.5], normal: [2.2, 0.1, 5.5], fast: [3.2, 0.15, 7.5] } as const;
        const [baseSpd, spdInc, maxSpd] = presets[state.cfSpeed] ?? presets.normal;
        const spd = Math.min(baseSpd + seconds * spdInc, maxSpd);
        const pct = (spd - baseSpd) / (maxSpd - baseSpd);
        const barW = 120;
        const barH = 3;
        const barX = cx - barW / 2;
        const barY = aH - 18;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        const r = Math.round(80 + pct * 175);
        const g = Math.round(180 - pct * 140);
        ctx.fillStyle = `rgb(${r},${g},50)`;
        ctx.fillRect(barX, barY, barW * pct, barH);
        ctx.globalAlpha = 1;
      }

      // Countdown
      if (state.phase === 'countdown') {
        const secondsLeft = Math.ceil(state.countdownTimer / TICKS_PER_SEC);
        const text = secondsLeft > 0 ? String(secondsLeft) : 'GO';
        const progress = 1 - state.countdownTimer / 60; // 0→1

        const isLast = state.round === state.bestOf;
        const roundLabel = isLast
          ? t('curvefever.finalRound')
          : `${t('curvefever.round')} ${state.round}`;

        // Darkening vignette
        const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 400);
        grad.addColorStop(0, 'rgba(0,0,0,0.3)');
        grad.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, aW, aH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Round label
        ctx.fillStyle = isLast ? 'rgba(241,196,15,0.8)' : 'rgba(255,255,255,0.5)';
        ctx.font = `bold ${isLast ? 28 : 22}px system-ui, sans-serif`;
        ctx.fillText(roundLabel, cx, cy - 80);

        // Score bar under round label
        if (state.players.length > 0) {
          const sorted = state.players.slice().sort((a, b) => b.score - a.score);
          ctx.font = '14px system-ui, sans-serif';
          const scoreY = cy - 52;
          sorted.forEach((p, idx) => {
            const totalW = sorted.length * 70;
            const px = cx - totalW / 2 + idx * 70 + 35;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(px - 20, scoreY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(`${p.score}`, px, scoreY);
            ctx.globalAlpha = 1;
          });
        }

        // Big countdown number
        const countSize = 100 + (1 - progress) * 20;
        ctx.fillStyle = text === 'GO' ? '#2ecc71' : '#fff';
        ctx.font = `bold ${countSize}px system-ui, sans-serif`;
        ctx.shadowColor = text === 'GO' ? '#2ecc71' : '#fff';
        ctx.shadowBlur = 30;
        ctx.fillText(text, cx, cy + 20);
        ctx.shadowBlur = 0;

        // Circular progress ring
        const ringR = 70;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(cx, cy + 20, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = text === 'GO' ? '#2ecc71' : 'rgba(255,255,255,0.6)';
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy + 20, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
      }

      // Round end overlay
      if (state.phase === 'round_end') {
        const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, 400);
        grad.addColorStop(0, 'rgba(0,0,0,0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, aW, aH);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (state.roundWinner) {
          const rw = state.players.find(p => p.token === state.roundWinner);
          if (rw) {
            // Winner color glow
            const winGrad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 200);
            winGrad.addColorStop(0, rw.color + '15');
            winGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = winGrad;
            ctx.fillRect(0, 0, aW, aH);

            ctx.fillStyle = rw.color;
            ctx.font = 'bold 44px system-ui, sans-serif';
            ctx.shadowColor = rw.color;
            ctx.shadowBlur = 20;
            ctx.fillText(rw.nickname, cx, cy - 30);
            ctx.shadowBlur = 0;

            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '20px system-ui, sans-serif';
            ctx.fillText(t('curvefever.winsRound'), cx, cy + 10);
          }
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 36px system-ui, sans-serif';
          ctx.fillText(t('curvefever.roundEnd'), cx, cy - 20);
        }

        // Scoreboard
        const sorted = state.players.slice().sort((a, b) => b.score - a.score);
        const rowH = 28;
        const startY = cy + 50;
        sorted.forEach((p, idx) => {
          const y = startY + idx * rowH;
          // Bar background
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.beginPath();
          ctx.roundRect(cx - 100, y - 10, 200, 24, 6);
          ctx.fill();
          // Color dot
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(cx - 80, y + 2, 5, 0, Math.PI * 2);
          ctx.fill();
          // Name
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '14px system-ui, sans-serif';
          ctx.textAlign = 'left';
          const name1 = p.nickname || 'Player';
          ctx.fillText(name1, cx - 68, y + 5);
          // Bot tag
          if (isBotToken(p.token)) {
            const nameW = ctx.measureText(name1).width;
            ctx.fillStyle = 'rgba(34,211,238,0.7)';
            ctx.font = '8px system-ui, sans-serif';
            ctx.fillText('BOT', cx - 68 + nameW + 4, y + 4);
          }
          // Score
          ctx.textAlign = 'right';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.fillStyle = p.color;
          ctx.fillText(String(p.score), cx + 88, y + 5);
          ctx.textAlign = 'center';
        });

        // Round stats (below scoreboard)
        if (state.roundStats?.length > 0) {
          const statsY = startY + sorted.length * rowH + 12;
          // Sort by survival time descending
          const sortedStats = [...state.roundStats].sort((a, b) => b.survivalTicks - a.survivalTicks);
          ctx.font = '9px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.textAlign = 'center';
          // Header
          ctx.fillText(`⏱  ${t('curvefever.stats.time')}    📏  ${t('curvefever.stats.dist')}    ⚡  PU    💀  Kills`, cx, statsY);
          sortedStats.forEach((st, si) => {
            const sy = statsY + 14 + si * 16;
            const timeSec = (st.survivalTicks / TICKS_PER_SEC).toFixed(1);
            ctx.fillStyle = st.color;
            ctx.textAlign = 'left';
            ctx.fillText(st.nickname, cx - 140, sy);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.textAlign = 'right';
            ctx.fillText(`${timeSec}s`, cx - 30, sy);
            ctx.fillText(`${st.distance}px`, cx + 30, sy);
            ctx.fillText(`${st.powerUpsCollected}`, cx + 75, sy);
            ctx.fillText(`${st.kills}`, cx + 120, sy);
          });
          ctx.textAlign = 'center';
        }
      }

      // Match end overlay
      if (state.phase === 'finished') {
        // Dark overlay with winner color accent
        const wp = state.winner ? state.players.find(p => p.token === state.winner) : null;
        const winColor = wp?.color ?? '#f1c40f';

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, aW, aH);

        // Winner color radial glow
        const winGrad = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy - 40, 300);
        winGrad.addColorStop(0, winColor + '20');
        winGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = winGrad;
        ctx.fillRect(0, 0, aW, aH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Crown
        ctx.font = '56px system-ui, sans-serif';
        ctx.fillText('\u{1F451}', cx, cy - 100);

        // "Match End" title
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText(t('curvefever.matchEnd').toUpperCase(), cx, cy - 60);

        // Winner name
        if (wp) {
          ctx.fillStyle = wp.color;
          ctx.font = 'bold 48px system-ui, sans-serif';
          ctx.shadowColor = wp.color;
          ctx.shadowBlur = 30;
          ctx.fillText(wp.nickname, cx, cy - 15);
          ctx.shadowBlur = 0;
        }

        // Final scoreboard
        const sorted = state.players.slice().sort((a, b) => b.score - a.score);
        const rowH = 32;
        const startY = cy + 40;
        sorted.forEach((p, idx) => {
          const y = startY + idx * rowH;
          const isWin = p.token === state.winner;
          // Row bg
          ctx.fillStyle = isWin ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
          ctx.beginPath();
          ctx.roundRect(cx - 120, y - 12, 240, 28, 6);
          ctx.fill();
          if (isWin) {
            ctx.strokeStyle = winColor + '40';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          // Color dot
          ctx.fillStyle = p.color;
          ctx.shadowColor = isWin ? p.color : 'transparent';
          ctx.shadowBlur = isWin ? 8 : 0;
          ctx.beginPath();
          ctx.arc(cx - 100, y + 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Rank
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.font = '12px system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`#${idx + 1}`, cx - 112, y + 4);
          // Name
          ctx.fillStyle = isWin ? '#fff' : 'rgba(255,255,255,0.7)';
          ctx.font = `${isWin ? 'bold ' : ''}15px system-ui, sans-serif`;
          const name2 = p.nickname || 'Player';
          ctx.fillText(name2, cx - 80, y + 5);
          // Bot tag
          if (isBotToken(p.token)) {
            const nameW = ctx.measureText(name2).width;
            ctx.fillStyle = 'rgba(34,211,238,0.7)';
            ctx.font = '8px system-ui, sans-serif';
            ctx.fillText('BOT', cx - 80 + nameW + 4, y + 4);
          }
          // Score
          ctx.textAlign = 'right';
          ctx.font = 'bold 17px system-ui, sans-serif';
          ctx.fillStyle = p.color;
          ctx.fillText(String(p.score), cx + 108, y + 5);
          ctx.textAlign = 'center';
        });
      }

      ctx.restore(); // end shake transform
    };

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [gs, t, myToken]);

  // Canvas sizing is handled inside the draw loop now (no separate effect needed)

  // ── Helpers ─────────────────────────────────────────────────────────────
  const getNickname = (token: string) => {
    if (gs) {
      const cfP = gs.players.find(p => p.token === token);
      if (cfP) return cfP.nickname;
    }
    return mp.players[0]?.nickname ?? 'Player';
  };

  const isHost = mp.playerIndex === 0;
  const winsNeeded = gs ? gs.winsNeeded : bestOf;

  // Chat state
  const { chatOpen, setChatOpen, unread } = useUnreadMessages(mp);

  // ── Lobby UI ─────────────────────────────────────────────────────────────
  const showLobby = mp.phase === 'lobby' || (gs?.phase === 'lobby') || (mp.phase === 'waiting' && !gs);
  if (showLobby) {
    const inRoom = !!mp.roomCode;

    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] w-full items-start max-w-5xl mx-auto px-4 py-2">
        {/* ── Main area ── */}
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold text-zinc-100">Curve Fever</h1>

          {!inRoom ? (
            <>
              {/* Create room */}
              <div className="w-full max-w-xl bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
                <h2 className="text-lg font-semibold text-zinc-200">{t('game.lobby.createRoom')}</h2>

                <NicknameEditor
                  nickname={mp.myNickname}
                  onSave={(nick) => mp.setNickname(nick)}
                />

                {/* Visibility */}
                <div className="flex gap-1 p-1 rounded-lg bg-zinc-800">
                  {(['private', 'public'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setRoomVisibility(v)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        roomVisibility === v ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {t(`game.lobby.${v}`)}
                    </button>
                  ))}
                </div>

                {roomVisibility === 'public' && (
                  <input
                    type="text"
                    placeholder={t('game.lobby.roomName')}
                    maxLength={24}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm border border-zinc-700 placeholder:text-zinc-500"
                  />
                )}

                {/* Best of */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Best of</span>
                  <div className="flex gap-1">
                    {[3, 5, 7].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBestOf(n)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                          bestOf === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-600 ml-1">
                    {t('curvefever.firstTo')} {bestOf}
                  </span>
                </div>

                {/* Max players */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">{t('liarsbar.players')}</span>
                  <div className="flex gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxPlayers(n)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                          maxPlayers === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game config */}
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{t('curvefever.settings')}</span>

                  {/* Speed */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">{t('curvefever.speed')}</span>
                    <div className="flex gap-1 flex-1">
                      {(['slow', 'normal', 'fast'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCfSpeed(v)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            cfSpeed === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t(`curvefever.speed.${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Power-ups */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">Power-Ups</span>
                    <div className="flex gap-1 flex-1">
                      {(['none', 'few', 'normal', 'chaos'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCfPowerUps(v)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            cfPowerUps === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t(`curvefever.pu.${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Per-power-up toggles */}
                  {cfPowerUps !== 'none' && (
                    <div className="flex flex-col gap-1.5 pl-1">
                      {(['speed', 'shield', 'phase', 'slow', 'thin', 'reverse', 'big', 'warp'] as CfPowerUpType[]).map((puType) => {
                        const disabled = cfDisabledPUs.includes(puType);
                        return (
                          <label key={puType} className="flex items-start gap-2 cursor-pointer group">
                            <button
                              type="button"
                              onClick={() => setCfDisabledPUs(prev =>
                                prev.includes(puType) ? prev.filter(t => t !== puType) : [...prev, puType]
                              )}
                              className="relative shrink-0 cursor-pointer mt-0.5"
                              style={{
                                width: 28, height: 15, borderRadius: 8,
                                background: disabled ? '#3f3f46' : '#4f46e5',
                                border: `1px solid ${disabled ? 'rgba(63,63,70,0.5)' : 'rgba(99,102,241,0.4)'}`,
                                transition: 'background 0.15s, border-color 0.15s',
                              }}
                            >
                              <span style={{
                                position: 'absolute', top: 1.5, left: disabled ? 1.5 : 13,
                                width: 10, height: 10, borderRadius: 5,
                                background: disabled ? '#71717a' : '#c7d2fe',
                                transition: 'left 0.15s, background 0.15s',
                              }} />
                            </button>
                            <div className="flex flex-col gap-0">
                              <span className={`text-xs font-semibold flex items-center gap-1.5 ${disabled ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                <span>{POWERUP_ICONS[puType]}</span>
                                {t(`curvefever.powerup.${puType}`)}
                              </span>
                              <span className="text-[10px] text-zinc-500 leading-tight">{t(`curvefever.powerup.${puType}.desc`)}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Thickness */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">{t('curvefever.thickness')}</span>
                    <div className="flex gap-1 flex-1">
                      {(['thin', 'normal', 'thick'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCfThickness(v)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            cfThickness === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t(`curvefever.thickness.${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Arena Shape */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">{t('curvefever.arenaShape')}</span>
                    <div className="flex gap-1 flex-1">
                      {(['rectangle', 'circle', 'hexagon', 'diamond'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCfArenaShape(v)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            cfArenaShape === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t(`curvefever.shape.${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Map Size */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-20 shrink-0">{t('curvefever.mapSize')}</span>
                    <div className="flex gap-1 flex-1">
                      {(['small', 'normal', 'large', 'huge'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCfMapSize(v)}
                          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            cfMapSize === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t(`curvefever.mapSize.${v}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggle options */}
                  {([
                    [cfNoGaps, setCfNoGaps, 'curvefever.noGaps'] as const,
                    [cfShrinking, setCfShrinking, 'curvefever.shrinking'] as const,
                    [cfSuddenDeath, setCfSuddenDeath, 'curvefever.suddenDeath'] as const,
                    [cfObstacles, setCfObstacles, 'curvefever.obstacles'] as const,
                    [cfTeamMode, setCfTeamMode, 'curvefever.teamMode'] as const,
                  ]).map(([val, setter, key]) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-xs text-zinc-300 group-hover:text-zinc-100 transition-colors select-none">{t(key)}</span>
                      <button
                        type="button"
                        onClick={() => (setter as (v: boolean) => void)(!val)}
                        className="relative shrink-0 cursor-pointer"
                        style={{
                          width: 34,
                          height: 18,
                          borderRadius: 9,
                          background: val ? '#4f46e5' : '#3f3f46',
                          border: `1px solid ${val ? 'rgba(99,102,241,0.4)' : 'rgba(63,63,70,0.5)'}`,
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            left: val ? 17 : 2,
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            background: val ? '#c7d2fe' : '#71717a',
                            transition: 'left 0.15s, background 0.15s',
                          }}
                        />
                      </button>
                    </label>
                  ))}
                </div>

                {hasLastConfig('curvefever') && (
                  <button
                    onClick={() => {
                      const c = loadLastConfig<Record<string, unknown>>('curvefever');
                      if (!c) return;
                      if (c.bestOf != null) setBestOf(c.bestOf as number);
                      if (c.maxPlayers != null) setMaxPlayers(c.maxPlayers as number);
                      if (c.speed != null) setCfSpeed(c.speed as CfSpeedSetting);
                      if (c.powerUpDensity != null) setCfPowerUps(c.powerUpDensity as CfPowerUpDensity);
                      if (c.thickness != null) setCfThickness(c.thickness as CfThickness);
                      if (c.noGaps != null) setCfNoGaps(c.noGaps as boolean);
                      if (c.shrinkingArena != null) setCfShrinking(c.shrinkingArena as boolean);
                      if (c.suddenDeath != null) setCfSuddenDeath(c.suddenDeath as boolean);
                      if (c.disabledPowerUps != null) setCfDisabledPUs(c.disabledPowerUps as CfPowerUpType[]);
                      if (c.obstacles != null) setCfObstacles(c.obstacles as boolean);
                      if (c.teamMode != null) setCfTeamMode(c.teamMode as boolean);
                      if (c.arenaShape != null) setCfArenaShape(c.arenaShape as CfArenaShape);
                      if (c.mapSize != null) setCfMapSize(c.mapSize as CfMapSize);
                    }}
                    className="w-full py-1.5 rounded-xl border border-zinc-700 hover:border-indigo-600 text-zinc-400 hover:text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('game.lobby.lastSettings')}
                  </button>
                )}

                <button
                  onClick={() => {
                    saveLastConfig('curvefever', {
                      bestOf, maxPlayers, speed: cfSpeed, powerUpDensity: cfPowerUps, thickness: cfThickness,
                      noGaps: cfNoGaps, shrinkingArena: cfShrinking, suddenDeath: cfSuddenDeath,
                      disabledPowerUps: cfDisabledPUs, obstacles: cfObstacles, teamMode: cfTeamMode,
                      arenaShape: cfArenaShape, mapSize: cfMapSize,
                    });
                    mp.createRoom({
                      visibility: roomVisibility,
                      roomName: roomName || undefined,
                      cfConfig: {
                        bestOf: cfSuddenDeath ? 1 : bestOf,
                        speed: cfSpeed,
                        powerUpDensity: cfPowerUps,
                        thickness: cfThickness,
                        noGaps: cfNoGaps,
                        shrinkingArena: cfShrinking,
                        suddenDeath: cfSuddenDeath,
                        disabledPowerUps: cfDisabledPUs.length > 0 ? cfDisabledPUs : undefined,
                        obstacles: cfObstacles || undefined,
                        teamMode: cfTeamMode || undefined,
                        arenaShape: cfArenaShape !== 'rectangle' ? cfArenaShape : undefined,
                        mapSize: cfMapSize !== 'normal' ? cfMapSize : undefined,
                      },
                      maxPlayers,
                    });
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer active:scale-[0.98]"
                >
                  {t('game.lobby.createRoom')}
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-zinc-700" />
                  <span className="text-xs text-zinc-500">{t('uno.or')}</span>
                  <div className="flex-1 h-px bg-zinc-700" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('game.lobby.roomCode')}
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-mono tracking-widest border border-zinc-700 placeholder:text-zinc-500 uppercase"
                  />
                  <button
                    onClick={() => joinCode.length === 6 && mp.joinRoom(joinCode)}
                    disabled={joinCode.length !== 6}
                    className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {t('game.lobby.join')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* In-room lobby */
            <div className="w-full max-w-xl bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('game.room.title')}</span>
                  <p className="font-mono text-xl font-black tracking-widest text-zinc-100">{mp.roomCode}</p>
                </div>
                <span className="text-sm text-zinc-500">{mp.playerCount}/{mp.roomMaxPlayers}</span>
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/games/curvefever?room=${mp.roomCode}`)}
                className="w-full py-1.5 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                {t('game.room.copyInvite')}
              </button>

              {gs && (
                <div className="text-xs text-zinc-500 bg-zinc-800/50 px-3 py-2 rounded-lg space-y-1">
                  <div>
                    {gs.cfSuddenDeath ? t('curvefever.suddenDeath') : `Best of ${gs.bestOf} · ${t('curvefever.firstTo')} ${gs.winsNeeded}`}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-600">
                    <span>{t('curvefever.speed')}: {t(`curvefever.speed.${gs.cfSpeed}`)}</span>
                    <span>Power-Ups: {t(`curvefever.pu.${gs.cfPowerUpDensity}`)}</span>
                    <span>{t('curvefever.thickness')}: {t(`curvefever.thickness.${gs.cfThickness}`)}</span>
                    {gs.cfNoGaps && <span className="text-amber-500">{t('curvefever.noGaps')}</span>}
                    {gs.cfShrinkingArena && <span className="text-red-400">{t('curvefever.shrinking')}</span>}
                    {gs.cfObstacles && <span className="text-orange-400">{t('curvefever.obstacles')}</span>}
                    {gs.cfTeamMode && <span className="text-cyan-400">{t('curvefever.teamMode')}</span>}
                    {gs.cfArenaShape !== 'rectangle' && <span className="text-violet-400">{t(`curvefever.shape.${gs.cfArenaShape}`)}</span>}
                    {gs.arenaWidth !== 800 && <span className="text-teal-400">{t(`curvefever.mapSize.${gs.arenaWidth <= 600 ? 'small' : gs.arenaWidth <= 1000 ? 'large' : 'huge'}`)}</span>}
                    {gs.cfDisabledPowerUps?.length > 0 && (
                      <span className="text-zinc-500">
                        {t('curvefever.disabled')}: {gs.cfDisabledPowerUps.map(pu => t(`curvefever.powerup.${pu}`)).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Player list */}
              <div className="space-y-1.5">
                {gs?.players.map((p, i) => {
                  const isBot = isBotToken(p.token);
                  const botSlot = isBot ? gs.bots?.find(b => b.token === p.token) : null;
                  return (
                    <div key={p.token} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/30">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-zinc-200 font-medium text-sm truncate flex-1">
                        {p.nickname || getNickname(p.token)}
                      </span>
                      {isBot && botSlot && (
                        <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">
                          {t('curvefever.botBadge')} · {t(`curvefever.botDifficulty.${botSlot.difficulty}`)}
                        </span>
                      )}
                      {!isBot && i === 0 && (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Host</span>
                      )}
                      {isBot && isHost && gs.phase === 'lobby' && (
                        <button
                          onClick={() => mp.sendAction({ type: 'CF_REMOVE_BOT', botToken: p.token })}
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title={t('curvefever.removeBot')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bot controls (host only, lobby phase) */}
              {isHost && gs && gs.phase === 'lobby' && gs.players.length < 6 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 shrink-0">{t('curvefever.addBot')}:</span>
                  {(['easy', 'medium', 'hard'] as CfBotDifficulty[]).map(diff => (
                    <button
                      key={diff}
                      onClick={() => mp.sendAction({ type: 'CF_ADD_BOT', difficulty: diff })}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 hover:border-cyan-600 text-zinc-300 hover:text-cyan-300 bg-zinc-800/50 hover:bg-cyan-950/30 transition-colors cursor-pointer"
                    >
                      {t(`curvefever.botDifficulty.${diff}`)}
                    </button>
                  ))}
                </div>
              )}

              {isHost ? (
                <button
                  onClick={() => mp.sendAction({ type: 'CF_START' })}
                  disabled={!gs || gs.players.length < 2}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold transition-colors cursor-pointer active:scale-[0.98]"
                >
                  {t('liarsbar.startGame')}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-4 h-4 rounded-full animate-spin border-2 border-zinc-600 border-t-indigo-400" />
                  <p className="text-zinc-500 text-sm">{t('curvefever.waiting')}</p>
                </div>
              )}

              <button
                onClick={() => mp.leaveRoom()}
                className="w-full py-2 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
              >
                {t('game.actions.leaveRoom')}
              </button>
            </div>
          )}

          {mp.error && (
            <div className="text-red-400 text-sm bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50 w-full max-w-xl">
              {mp.error}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: mp.connection === 'connected' ? '#34d399'
                  : mp.connection === 'connecting' ? '#fbbf24'
                  : '#f43f5e',
              }}
            />
            <span className="text-zinc-400">{t(`status.${mp.connection}`)}</span>
          </div>

          {/* Game info */}
          <div className="text-xs px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 text-zinc-500">
            {t('curvefever.controls')}
          </div>

          {/* Chat */}
          {inRoom && (
            <ChatPanel
              mode="both"
              roomCode={mp.roomCode}
              roomMessages={mp.roomMessages}
              globalMessages={mp.globalMessages}
              chatError={mp.chatError}
              onSend={mp.sendChat}
              collapsible
              open={chatOpen}
              onOpenChange={setChatOpen}
              showUnreadBadge={unread > 0}
            />
          )}
        </aside>
      </div>
    );
  }

  // ── Scoreboard helper ───────────────────────────────────────────────────
  const sortedPlayers = (gs?.players ?? []).slice().sort((a, b) => b.score - a.score);
  const topScore = sortedPlayers[0]?.score ?? 0;
  const isMatchWinner = gs?.phase === 'finished' && gs.winner;

  // Check if local player is behind the scoreboard overlay (top-left region)
  const myPlayer = gs?.players.find(p => p.token === myToken);
  const arenaW = gs?.arenaWidth || ARENA_W;
  const arenaH = gs?.arenaHeight || ARENA_H;
  const isPlayerNearScoreboard = myPlayer && myPlayer.alive && gs?.phase === 'playing'
    && myPlayer.x < arenaW * 0.25 && myPlayer.y < arenaH * 0.35;

  // ── Game UI ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full px-4 py-2">
      <ReconnectBanner mp={mp} />
      <WaitingForConnectionOverlay
        show={mp.phase === 'waiting' && mp.playerCount < (mp.roomMaxPlayers ?? 2) && !mp.gameState}
        label={t('game.status.waiting')}
      />
      {mp.isSpectator && <SpectatorBanner spectatorCount={mp.spectatorCount} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px] w-full items-start">
        {/* ── Main arena area ── */}
        <div className="flex flex-col items-center gap-2 min-w-0">
          {/* Arena — fills viewport height, centered */}
          <div className="flex justify-center w-full">
            <div
              ref={containerRef}
              className="relative bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800"
              style={{
                width: `min(100%, calc((100vh - 120px) * ${(gs?.arenaWidth || ARENA_W) / (gs?.arenaHeight || ARENA_H)}))`,
                height: `min(calc(100vw * ${(gs?.arenaHeight || ARENA_H) / (gs?.arenaWidth || ARENA_W)}), calc(100vh - 120px))`,
                maxWidth: '100%',
              }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
              />

              {/* Scoreboard overlay (top-left) — fades when local player is behind it */}
          <div
            className="absolute top-3 left-3 z-10 pointer-events-none"
            style={{
              opacity: isPlayerNearScoreboard ? 0.2 : 1,
              transition: 'opacity 0.3s ease',
            }}
          >
            <div
              className="rounded-xl p-3 space-y-1.5 pointer-events-auto"
              style={{
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                minWidth: 160,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{t('curvefever.scoreboard')}</span>
                {gs && (
                  <span className="text-[9px] text-zinc-500">
                    {gs.round === gs.bestOf
                      ? t('curvefever.finalRound')
                      : `${t('curvefever.round')} ${gs.round}`
                    } · Bo{gs.bestOf}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {sortedPlayers.map((p) => {
                  const isLeader = p.score > 0 && p.score === topScore && gs?.phase === 'playing';
                  const isDead = !p.alive && gs?.phase === 'playing';
                  const isMe = p.token === myToken;
                  const isWinner = isMatchWinner && p.token === gs?.winner;
                  const pIdx = gs?.playerIds.indexOf(p.token) ?? -1;
                  const teamIdx = gs?.teams?.length ? gs.teams[pIdx] : -1;

                  return (
                    <div
                      key={p.token}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                      style={{
                        opacity: isDead ? 0.4 : 1,
                        background: isMe ? 'rgba(255,255,255,0.06)' : isWinner ? 'rgba(245,158,11,0.1)' : 'transparent',
                        borderLeft: teamIdx >= 0 ? `2px solid ${teamIdx === 0 ? '#3b82f6' : '#ef4444'}` : 'none',
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: p.color,
                          boxShadow: (isLeader || isWinner) ? `0 0 6px ${p.color}` : 'none',
                        }}
                      />
                      {(isWinner || isLeader) && (
                        <span className="text-[9px] shrink-0">{'\u{1F451}'}</span>
                      )}
                      <span className={`truncate flex-1 ${isWinner ? 'text-amber-300 font-semibold' : 'text-zinc-300'}`}>
                        {p.nickname || 'Player'}
                        {isBotToken(p.token) && <span className="text-[8px] text-cyan-500 ml-1">BOT</span>}
                      </span>
                      <div className="flex gap-0.5 shrink-0">
                        {Array.from({ length: winsNeeded }).map((_, wi) => (
                          <div
                            key={wi}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: wi < p.score ? p.color : 'rgba(113,113,122,0.5)' }}
                          />
                        ))}
                      </div>
                      {isDead && <span className="text-red-500 text-[9px]">{'\u2715'}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active effects overlay (bottom-left) */}
          {gs && gs.phase === 'playing' && (() => {
            const me = gs.players.find(p => p.token === myToken);
            if (!me || me.effects.length === 0) return null;
            return (
              <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
                <div
                  className="rounded-lg p-2 space-y-1"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {me.effects.map((eff, ei) => (
                    <div
                      key={`${eff.type}-${ei}`}
                      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px]"
                    >
                      <span>{POWERUP_ICONS[eff.type]}</span>
                      <span style={{ color: POWERUP_COLORS[eff.type] }}>
                        {t(`curvefever.powerup.${eff.type}`)}
                      </span>
                      <span className="text-zinc-500 ml-1">
                        {(eff.remainingTicks / TICKS_PER_SEC).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Kill feed overlay (top-right) */}
          {killFeedItems.length > 0 && (
            <div className="absolute top-3 right-3 flex flex-col gap-1 pointer-events-none z-10 max-w-[280px]">
              {killFeedItems.map((item, idx) => {
                const age = Date.now() - item.addedAt;
                const opacity = Math.max(0, 1 - age / KILL_FEED_DISPLAY_MS);
                const entry = item.entry;

                return (
                  <div
                    key={`${entry.victim}-${entry.tick}-${idx}`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium backdrop-blur-sm"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      opacity,
                      transition: 'opacity 0.3s',
                    }}
                  >
                    {entry.cause === 'wall' && (
                      <>
                        <span style={{ color: entry.victimColor }}>{entry.victim}</span>
                        <span className="text-zinc-400">{t('curvefever.kill.wall')}</span>
                      </>
                    )}
                    {entry.cause === 'self' && (
                      <>
                        <span style={{ color: entry.victimColor }}>{entry.victim}</span>
                        <span className="text-zinc-400">{'→'}</span>
                        <span className="text-zinc-400">{t('curvefever.kill.self')}</span>
                      </>
                    )}
                    {entry.cause === 'other' && entry.killer && (
                      <>
                        <span style={{ color: entry.victimColor }}>{entry.victim}</span>
                        <span className="text-zinc-400">{'→'}</span>
                        <span className="text-zinc-400">{t('curvefever.kill.trail')}</span>
                        <span style={{ color: entry.killerColor }}>{entry.killer}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Room code overlay (bottom-right) */}
          {mp.roomCode && (
            <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
              <span
                className="text-[10px] font-mono px-2 py-1 rounded-md"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: '#818cf8',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {mp.roomCode}
              </span>
            </div>
          )}
            </div>
          </div>

          {/* Replay */}
          <ReplayControls<CurveFeverState>
            replay={replay}
            gameEnded={mp.phase === 'ended'}
          />

          {/* Bottom bar: controls hint + rematch + leave */}
          <div className="flex flex-col items-center gap-1 mt-1">
            <div className="flex items-center justify-center gap-4">
              <p className="text-xs text-zinc-600">{t('curvefever.controls')}</p>
              {(gs?.phase === 'finished' || mp.phase === 'ended') && !replay.isReplaying && (
                <>
                  <button
                    onClick={() => mp.requestRematch()}
                    disabled={mp.myVotedRematch}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${mp.myVotedRematch ? 'bg-indigo-800 text-indigo-300' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                  >
                    {mp.myVotedRematch ? `Rematch (${mp.rematchVotes}/${mp.playerCount})` : 'Rematch'}
                  </button>
                  <button
                    onClick={() => mp.returnToLobby()}
                    className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Lobby
                  </button>
                </>
              )}
              <button
                onClick={mp.leaveRoom}
                className="px-4 py-1.5 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                {t('game.actions.leaveRoom')}
              </button>
            </div>
            {mp.rematchError && (
              <p className="text-xs text-red-400">{mp.rematchError}</p>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: mp.connection === 'connected' ? '#34d399'
                  : mp.connection === 'connecting' ? '#fbbf24'
                  : '#f43f5e',
              }}
            />
            <span className="text-zinc-400">{t(`status.${mp.connection}`)}</span>
          </div>

          {/* Error */}
          {mp.error && (
            <div className="text-sm px-4 py-3 rounded-xl bg-red-950/20 border border-red-900/30 text-red-300">
              {mp.error}
            </div>
          )}

          {/* Room info */}
          {mp.roomCode && (
            <div className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{t('game.room.title')}</span>
                <span className="font-mono text-lg font-black tracking-widest text-zinc-100">{mp.roomCode}</span>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/games/curvefever?room=${mp.roomCode}`)}
                className="w-full py-1.5 rounded-lg border border-zinc-700 hover:border-indigo-600 text-sm text-zinc-300 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              >
                {t('game.room.copyInvite')}
              </button>
            </div>
          )}

          {/* Game info */}
          <div className="text-xs px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/50 text-zinc-500">
            {t('curvefever.controls')}
          </div>

          {/* Chat */}
          <ChatPanel
            mode="both"
            roomCode={mp.roomCode}
            roomMessages={mp.roomMessages}
            globalMessages={mp.globalMessages}
            chatError={mp.chatError}
            onSend={mp.sendChat}
            collapsible
            open={chatOpen}
            onOpenChange={setChatOpen}
            showUnreadBadge={unread > 0}
          />
        </aside>
      </div>
    </div>
  );
}

export default CurveFeverGame;
