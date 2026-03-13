'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '@/lib/gameRegistry';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useI18n } from '@/components/providers/LanguageProvider';
import type { CurveFeverState, CfDeathEvent, CfKillFeedEntry, CfPowerUpType, RoomVisibility } from 'shared';
import { ReconnectBanner } from '@/components/ui/ReconnectBanner';
import { useAchievements } from '@/hooks/useAchievements';

const ARENA_W = 800;
const ARENA_H = 600;
const PLAYER_RADIUS = 3;
const TICKS_PER_SEC = 20;
const POWERUP_PICKUP_RADIUS = 12;

// ── Power-up visuals ─────────────────────────────────────────────────────────

const POWERUP_COLORS: Record<CfPowerUpType, string> = {
  speed: '#f39c12',   // amber
  shield: '#3498db',  // blue
  phase: '#9b59b6',   // purple
};

const POWERUP_ICONS: Record<CfPowerUpType, string> = {
  speed: '⚡',
  shield: '🛡',
  phase: '👻',
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

export function CurveFeverGame({ wsUrl, gameId, initialRoomCode, quickPlay: autoQuickPlay }: GameComponentProps) {
  const mp = useMultiplayer<CurveFeverState>(wsUrl, gameId);
  const { t } = useI18n();
  const ach = useAchievements('curvefever', mp.roomCode);
  const gs = mp.gameState;

  // Lobby config
  const [bestOf, setBestOf] = useState(5);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [roomVisibility, setRoomVisibility] = useState<RoomVisibility>('private');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');

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

  // Track which death events we already spawned particles for
  const processedDeathsRef = useRef<Set<string>>(new Set());

  // Kill feed display
  const [killFeedItems, setKillFeedItems] = useState<KillFeedDisplay[]>([]);
  const lastKillFeedLenRef = useRef(0);

  // Track power-up IDs for pickup sparkles
  const knownPowerUpsRef = useRef<Set<number>>(new Set());

  const myToken = typeof window !== 'undefined' ? localStorage.getItem('wg_player_token') ?? '' : '';

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
    if (mp.isSpectator) return;

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
  }, [gs?.phase, mp.isSpectator, sendSteer]);

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

  // ── Trail accumulation from server state ─────────────────────────────────
  useEffect(() => {
    if (!gs) return;
    const tr = trailsRef.current;

    // Reset trails on new round
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

      // Scale all drawing from arena coords (800x600) to actual pixel buffer
      const sx = bufW / ARENA_W;
      const sy = bufH / ARENA_H;
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
      ctx.fillRect(-10, -10, ARENA_W + 20, ARENA_H + 20);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < ARENA_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
      }
      for (let y = 0; y < ARENA_H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
      }

      // Arena border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, ARENA_W - 2, ARENA_H - 2);

      // ── Draw trails ─────────────────────────────────────────────────────
      const trails = trailsRef.current.segments;
      for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        const segments = trails[i] ?? [];
        const isDead = !p.alive;

        ctx.strokeStyle = p.color;
        ctx.lineWidth = PLAYER_RADIUS * 2;
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

      // ── Draw player heads (alive only) ──────────────────────────────────
      ctx.shadowBlur = 0;
      for (const p of state.players) {
        if (!p.alive) continue;

        const hasPhase = p.effects.some(e => e.type === 'phase');
        const hasShield = p.hasShield;
        const hasSpeed = p.effects.some(e => e.type === 'speed');

        // Shield ring
        if (hasShield) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
          ctx.strokeStyle = POWERUP_COLORS.shield + '80';
          ctx.lineWidth = 2;
          ctx.shadowColor = POWERUP_COLORS.shield;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Phase: ghostly transparency
        ctx.globalAlpha = hasPhase ? 0.5 : 1;

        // Speed: extra glow
        const headGlow = hasSpeed ? 20 : 14;
        const headColor = hasSpeed ? POWERUP_COLORS.speed : p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS + 2, 0, Math.PI * 2);
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = headGlow;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
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
      const cx = ARENA_W / 2;
      const cy = ARENA_H / 2;

      // Speed indicator (subtle, bottom-center during play)
      if (state.phase === 'playing') {
        const seconds = state.ticksElapsed / TICKS_PER_SEC;
        const spd = Math.min(2.2 + seconds * 0.1, 5.5);
        const pct = (spd - 2.2) / (5.5 - 2.2);
        const barW = 120;
        const barH = 3;
        const barX = cx - barW / 2;
        const barY = ARENA_H - 18;
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
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);

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
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
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
            ctx.fillRect(0, 0, ARENA_W, ARENA_H);

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
          ctx.fillText(p.nickname || 'Player', cx - 68, y + 5);
          // Score
          ctx.textAlign = 'right';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.fillStyle = p.color;
          ctx.fillText(String(p.score), cx + 88, y + 5);
          ctx.textAlign = 'center';
        });
      }

      // Match end overlay
      if (state.phase === 'finished') {
        // Dark overlay with winner color accent
        const wp = state.winner ? state.players.find(p => p.token === state.winner) : null;
        const winColor = wp?.color ?? '#f1c40f';

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);

        // Winner color radial glow
        const winGrad = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy - 40, 300);
        winGrad.addColorStop(0, winColor + '20');
        winGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = winGrad;
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);

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
          ctx.fillText(p.nickname || 'Player', cx - 80, y + 5);
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
  const winsNeeded = gs ? gs.winsNeeded : Math.ceil(bestOf / 2);

  // ── Lobby UI ─────────────────────────────────────────────────────────────
  const showLobby = mp.phase === 'lobby' || (gs?.phase === 'lobby');
  if (showLobby) {
    const inRoom = !!mp.roomCode;

    return (
      <div className="flex flex-col items-center gap-6 p-4 max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-100">Curve Fever</h1>

        {!inRoom ? (
          <>
            {/* Create room */}
            <div className="w-full bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-200">{t('game.lobby.createRoom')}</h2>

              {/* Visibility */}
              <div className="flex gap-2">
                {(['private', 'public'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setRoomVisibility(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      roomVisibility === v ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm border border-zinc-700"
                />
              )}

              {/* Best of */}
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Best of</label>
                <div className="flex gap-2">
                  {[3, 5, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBestOf(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        bestOf === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      Bo{n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  {t('curvefever.firstTo')} {Math.ceil(bestOf / 2)} {t('curvefever.winsMatch')}
                </p>
              </div>

              {/* Max players */}
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">{t('liarsbar.players')}</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxPlayers(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        maxPlayers === n ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => mp.createRoom({
                  visibility: roomVisibility,
                  roomName: roomName || undefined,
                  cfConfig: { bestOf },
                  maxPlayers,
                })}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
              >
                {t('game.lobby.createRoom')}
              </button>
            </div>

            {/* Join room */}
            <div className="w-full bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
              <h2 className="text-lg font-semibold text-zinc-200">{t('game.lobby.join')}</h2>
              <input
                type="text"
                placeholder={t('game.lobby.roomCode')}
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-center font-mono text-lg tracking-widest border border-zinc-700"
              />
              <button
                onClick={() => joinCode.length === 6 && mp.joinRoom(joinCode)}
                disabled={joinCode.length !== 6}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold transition-colors"
              >
                {t('game.lobby.join')}
              </button>
            </div>
          </>
        ) : (
          /* In-room lobby */
          <div className="w-full bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-200">
                {t('game.lobby.roomCode')}: <span className="font-mono text-indigo-400">{mp.roomCode}</span>
              </h2>
              <span className="text-sm text-zinc-500">{mp.playerCount}/{mp.roomMaxPlayers}</span>
            </div>

            {gs && (
              <div className="text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                Best of {gs.bestOf} · {t('curvefever.firstTo')} {gs.winsNeeded}
              </div>
            )}

            {/* Player list */}
            <div className="space-y-2">
              {gs?.players.map((p, i) => (
                <div key={p.token} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-zinc-200 font-medium">
                    {p.nickname || getNickname(p.token)}
                    {i === 0 && <span className="ml-2 text-xs text-amber-400">(Host)</span>}
                  </span>
                </div>
              ))}
            </div>

            {isHost ? (
              <button
                onClick={() => mp.sendAction({ type: 'CF_START' })}
                disabled={!gs || gs.players.length < 2}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold transition-colors"
              >
                {t('liarsbar.startGame')}
              </button>
            ) : (
              <p className="text-center text-zinc-500 text-sm">{t('curvefever.waiting')}</p>
            )}

            <button
              onClick={() => mp.leaveRoom()}
              className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition-colors"
            >
              {t('game.actions.leaveRoom')}
            </button>
          </div>
        )}

        {mp.error && (
          <div className="text-red-400 text-sm bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50">
            {mp.error}
          </div>
        )}
      </div>
    );
  }

  // ── Scoreboard helper ───────────────────────────────────────────────────
  const sortedPlayers = (gs?.players ?? []).slice().sort((a, b) => b.score - a.score);
  const topScore = sortedPlayers[0]?.score ?? 0;
  const isMatchWinner = gs?.phase === 'finished' && gs.winner;

  // ── Game UI ─────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full px-4 py-2">
      <ReconnectBanner mp={mp} />

      {/* Arena — fills viewport height, centered */}
      <div className="flex justify-center">
        <div
          ref={containerRef}
          className="relative bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800"
          style={{
            width: `min(100%, calc((100vh - 120px) * ${ARENA_W / ARENA_H}))`,
            height: `min(calc(100vw * ${ARENA_H / ARENA_W}), calc(100vh - 120px))`,
            maxWidth: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Scoreboard overlay (top-left) */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
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

                  return (
                    <div
                      key={p.token}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                      style={{
                        opacity: isDead ? 0.4 : 1,
                        background: isMe ? 'rgba(255,255,255,0.06)' : isWinner ? 'rgba(245,158,11,0.1)' : 'transparent',
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

      {/* Bottom bar: controls hint + rematch */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <p className="text-xs text-zinc-600">{t('curvefever.controls')}</p>
        {gs?.phase === 'finished' && (
          <button
            onClick={() => mp.requestRematch()}
            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Rematch
          </button>
        )}
      </div>
    </div>
  );
}

export default CurveFeverGame;
