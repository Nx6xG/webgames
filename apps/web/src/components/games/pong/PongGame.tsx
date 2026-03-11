'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { loadStats, saveStats, updateStats } from './stats';
import type { PongStats } from './stats';
import * as sfx from './sound';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';

// ── Constants ────────────────────────────────────────────────────────────────

const W = 800;
const H = 500;
const PADDLE_W = 14;
const PADDLE_H = 80;
const PADDLE_R = 5;
const PADDLE_OFFSET = 20;
const BALL_R = 8;
const WIN_SCORE = 5;
const BALL_BASE_SPEED = 5;
const BALL_SPEED_INC = 0.25;
const PLAYER_SPEED = 6;
const RESET_DELAY = 400;
const TRAIL_LENGTH = 10;
const MAX_PARTICLES = 40;

type Phase = 'menu' | 'countdown' | 'playing' | 'paused' | 'ended';
type Difficulty = 'easy' | 'medium' | 'hard';

const BOT_CONFIG: Record<Difficulty, { speed: number; offset: number; driftFactor: number }> = {
  easy:   { speed: 2.5, offset: 50, driftFactor: 0.2 },
  medium: { speed: 3.5, offset: 30, driftFactor: 0.3 },
  hard:   { speed: 5.0, offset: 12, driftFactor: 0.5 },
};

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', ' ', 'p', 'P', 'Escape']);

// ── FX types ─────────────────────────────────────────────────────────────────

interface TrailPoint { x: number; y: number }

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  r: number;
  color: string;
}

interface ImpactFlash {
  x: number; y: number;
  age: number;
  kind: 'paddle' | 'wall' | 'goal';
  color: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PongGame() {
  const { t } = useI18n();
  const ach = useAchievements('pong');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('menu');
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [winner, setWinner] = useState<'player' | 'bot' | null>(null);
  const [stats, setStats] = useState<PongStats | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [countdownNum, setCountdownNum] = useState(3);
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const diffRef = useRef(difficulty);
  diffRef.current = difficulty;
  const savedRef = useRef(false);
  const rallyRef = useRef(0);

  // Visual FX state (mutated per-frame)
  const trailRef = useRef<TrailPoint[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const flashesRef = useRef<ImpactFlash[]>([]);
  const shakeRef = useRef({ x: 0, y: 0, decay: 0 });
  const scoreFlashRef = useRef({ side: '' as 'left' | 'right' | '', age: 0 });

  // Load stats + mute state on mount
  useEffect(() => {
    setStats(loadStats());
    setMuted(sfx.isMuted());
  }, []);

  // Game state refs (mutated each frame)
  const gameRef = useRef({
    playerY: H / 2 - PADDLE_H / 2,
    botY: H / 2 - PADDLE_H / 2,
    ballX: W / 2,
    ballY: H / 2,
    ballVx: 0,
    ballVy: 0,
    speed: BALL_BASE_SPEED,
    pScore: 0,
    bScore: 0,
    resetTimer: 0,
    botTargetOffset: 0,
    playerHit: 0,
    botHit: 0,
  });

  const keysRef = useRef(new Set<string>());
  const touchYRef = useRef<number | null>(null);

  // ── Touch controls (mobile) ──────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getCanvasY(e: TouchEvent): number {
      const rect = canvas!.getBoundingClientRect();
      return ((e.touches[0].clientY - rect.top) / rect.height) * H;
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      touchYRef.current = getCanvasY(e);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      touchYRef.current = getCanvasY(e);
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      touchYRef.current = null;
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // ── Mute toggle ────────────────────────────────────────────────────────

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    sfx.setMuted(next);
  }

  // ── Prevent page scroll for game keys ──────────────────────────────────

  useEffect(() => {
    const prevent = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.key)) e.preventDefault();
    };
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      const ph = phaseRef.current;
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && ph === 'playing') {
        setPhase('paused');
      } else if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && ph === 'paused') {
        setPhase('playing');
      }
    };
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };

    window.addEventListener('keydown', prevent, { passive: false });
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', prevent);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing', useCallback(() => setPhase('paused'), []));

  // ── Achievement tracking ───────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'countdown') ach.trackPlay();
  }, [phase, ach]);

  useEffect(() => {
    if (phase !== 'ended') return;
    if (savedRef.current) return;
    savedRef.current = true;
    const won = winner === 'player';
    if (won) {
      ach.trackWin();
      ach.trackEvent({ type: 'flag', key: `pong_win_${diffRef.current}` });
      sfx.winSound();
    } else {
      sfx.loseSound();
    }
    const s = loadStats();
    const updated = updateStats(s, won);
    saveStats(updated);
    setStats(updated);
  }, [phase, winner, ach]);

  // ── FX helpers ─────────────────────────────────────────────────────────

  function spawnParticles(x: number, y: number, count: number, color: string, spread: number) {
    const parts = particlesRef.current;
    for (let i = 0; i < count && parts.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * spread;
      parts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 12 + Math.random() * 10,
        r: 1.5 + Math.random() * 2,
        color,
      });
    }
  }

  function triggerShake(intensity: number) {
    shakeRef.current = {
      x: (Math.random() - 0.5) * intensity,
      y: (Math.random() - 0.5) * intensity,
      decay: intensity,
    };
  }

  // ── Reset ball helper ──────────────────────────────────────────────────

  const resetBall = useCallback((direction: 1 | -1) => {
    const g = gameRef.current;
    g.ballX = W / 2;
    g.ballY = H / 2;
    const angle = (Math.random() * 0.8 - 0.4);
    g.speed = BALL_BASE_SPEED;
    g.ballVx = direction * g.speed * Math.cos(angle);
    g.ballVy = g.speed * Math.sin(angle);
    g.resetTimer = RESET_DELAY;
    const cfg = BOT_CONFIG[diffRef.current];
    g.botTargetOffset = (Math.random() - 0.5) * cfg.offset;
    trailRef.current = [];
    rallyRef.current = 0;
  }, []);

  // ── Countdown ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return;
    draw(gameRef.current);

    let step = 3;
    setCountdownNum(step);
    sfx.countdownBeep();

    const interval = setInterval(() => {
      step--;
      if (step <= 0) {
        clearInterval(interval);
        setCountdownNum(0);
        sfx.countdownGo();
        resetBall(1);
        gameRef.current.resetTimer = 0;
        setPhase('playing');
      } else {
        setCountdownNum(step);
        sfx.countdownBeep();
      }
    }, 700);

    return () => clearInterval(interval);
  }, [phase, resetBall]);

  // ── Start / restart game ───────────────────────────────────────────────

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.playerY = H / 2 - PADDLE_H / 2;
    g.botY = H / 2 - PADDLE_H / 2;
    g.ballX = W / 2;
    g.ballY = H / 2;
    g.ballVx = 0;
    g.ballVy = 0;
    g.speed = BALL_BASE_SPEED;
    g.pScore = 0;
    g.bScore = 0;
    g.resetTimer = 0;
    g.botTargetOffset = 0;
    g.playerHit = 0;
    g.botHit = 0;
    trailRef.current = [];
    particlesRef.current = [];
    flashesRef.current = [];
    shakeRef.current = { x: 0, y: 0, decay: 0 };
    scoreFlashRef.current = { side: '', age: 0 };
    savedRef.current = false;
    rallyRef.current = 0;
    setPlayerScore(0);
    setBotScore(0);
    setWinner(null);
    ach.reset();
    setPhase('countdown');
    wrapperRef.current?.focus();
  }, [ach]);

  // ── Game loop ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = 0;

    const loop = (time: number) => {
      if (!lastTime) lastTime = time;
      const dt = Math.min(time - lastTime, 32);
      lastTime = time;

      const g = gameRef.current;
      const keys = keysRef.current;
      const cfg = BOT_CONFIG[diffRef.current];

      // Decay hit flash timers
      if (g.playerHit > 0) g.playerHit--;
      if (g.botHit > 0) g.botHit--;

      // Age and prune impact flashes
      const flashes = flashesRef.current;
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].age++;
        if (flashes[i].age > 16) flashes.splice(i, 1);
      }

      // Age particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life++;
        if (p.life >= p.maxLife) parts.splice(i, 1);
      }

      // Decay shake
      const shake = shakeRef.current;
      if (shake.decay > 0) {
        shake.decay *= 0.85;
        shake.x = (Math.random() - 0.5) * shake.decay;
        shake.y = (Math.random() - 0.5) * shake.decay;
        if (shake.decay < 0.3) { shake.x = 0; shake.y = 0; shake.decay = 0; }
      }

      // Score flash age
      if (scoreFlashRef.current.side) {
        scoreFlashRef.current.age++;
        if (scoreFlashRef.current.age > 20) scoreFlashRef.current = { side: '', age: 0 };
      }

      // Reset delay countdown (after scoring)
      if (g.resetTimer > 0) {
        g.resetTimer -= dt;
        draw(g);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Player movement ──────────────────────────────────────────────
      const ty = touchYRef.current;
      if (ty !== null) {
        // Touch: snap paddle center to touch Y
        g.playerY = Math.max(0, Math.min(H - PADDLE_H, ty - PADDLE_H / 2));
      } else {
        if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) {
          g.playerY = Math.max(0, g.playerY - PLAYER_SPEED);
        }
        if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) {
          g.playerY = Math.min(H - PADDLE_H, g.playerY + PLAYER_SPEED);
        }
      }

      // ── Bot movement ─────────────────────────────────────────────────
      const botTarget = g.ballY - PADDLE_H / 2 + g.botTargetOffset;
      if (g.ballVx > 0) {
        if (g.botY < botTarget - 2) g.botY = Math.min(H - PADDLE_H, g.botY + cfg.speed);
        else if (g.botY > botTarget + 2) g.botY = Math.max(0, g.botY - cfg.speed);
      } else {
        const center = H / 2 - PADDLE_H / 2;
        if (g.botY < center - 2) g.botY += cfg.speed * cfg.driftFactor;
        else if (g.botY > center + 2) g.botY -= cfg.speed * cfg.driftFactor;
      }

      // ── Ball movement ────────────────────────────────────────────────
      const trail = trailRef.current;
      trail.push({ x: g.ballX, y: g.ballY });
      if (trail.length > TRAIL_LENGTH) trail.shift();

      g.ballX += g.ballVx;
      g.ballY += g.ballVy;

      // Top/bottom wall bounce
      if (g.ballY - BALL_R <= 0) {
        g.ballY = BALL_R;
        g.ballVy = Math.abs(g.ballVy);
        flashes.push({ x: g.ballX, y: 0, age: 0, kind: 'wall', color: '#8b9cf7' });
        spawnParticles(g.ballX, 2, 4, '#8b9cf7', 2);
        sfx.wallHit();
      } else if (g.ballY + BALL_R >= H) {
        g.ballY = H - BALL_R;
        g.ballVy = -Math.abs(g.ballVy);
        flashes.push({ x: g.ballX, y: H, age: 0, kind: 'wall', color: '#8b9cf7' });
        spawnParticles(g.ballX, H - 2, 4, '#8b9cf7', 2);
        sfx.wallHit();
      }

      // ── Paddle collisions ────────────────────────────────────────────
      const plX = PADDLE_OFFSET;
      if (
        g.ballVx < 0 &&
        g.ballX - BALL_R <= plX + PADDLE_W &&
        g.ballX - BALL_R >= plX - 4 &&
        g.ballY >= g.playerY &&
        g.ballY <= g.playerY + PADDLE_H
      ) {
        g.speed += BALL_SPEED_INC;
        const offset = (g.ballY - (g.playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
        const angle = offset * 1.1;
        g.ballVx = g.speed * Math.cos(angle);
        g.ballVy = g.speed * Math.sin(angle);
        g.ballX = plX + PADDLE_W + BALL_R;
        g.botTargetOffset = (Math.random() - 0.5) * cfg.offset;
        g.playerHit = 10;
        flashes.push({ x: plX + PADDLE_W, y: g.ballY, age: 0, kind: 'paddle', color: '#818cf8' });
        spawnParticles(plX + PADDLE_W + 4, g.ballY, 6, '#818cf8', 3);
        triggerShake(1.5);
        sfx.paddleHit();
        rallyRef.current++;
      }

      const brX = W - PADDLE_OFFSET - PADDLE_W;
      if (
        g.ballVx > 0 &&
        g.ballX + BALL_R >= brX &&
        g.ballX + BALL_R <= brX + PADDLE_W + 4 &&
        g.ballY >= g.botY &&
        g.ballY <= g.botY + PADDLE_H
      ) {
        g.speed += BALL_SPEED_INC;
        const offset = (g.ballY - (g.botY + PADDLE_H / 2)) / (PADDLE_H / 2);
        const angle = offset * 1.1;
        g.ballVx = -(g.speed * Math.cos(angle));
        g.ballVy = g.speed * Math.sin(angle);
        g.ballX = brX - BALL_R;
        g.botTargetOffset = (Math.random() - 0.5) * cfg.offset;
        g.botHit = 10;
        flashes.push({ x: brX, y: g.ballY, age: 0, kind: 'paddle', color: '#fb7185' });
        spawnParticles(brX - 4, g.ballY, 6, '#fb7185', 3);
        triggerShake(1.5);
        sfx.paddleHit();
        rallyRef.current++;
      }

      // ── Scoring ──────────────────────────────────────────────────────
      let scored = false;
      if (g.ballX + BALL_R < 0) {
        spawnParticles(BALL_R, g.ballY, 12, '#fb7185', 4);
        flashes.push({ x: 0, y: g.ballY, age: 0, kind: 'goal', color: '#fb7185' });
        triggerShake(4);
        scoreFlashRef.current = { side: 'right', age: 0 };
        sfx.goalScored();
        g.bScore++;
        setBotScore(g.bScore);
        scored = true;
        resetBall(-1);
      } else if (g.ballX - BALL_R > W) {
        spawnParticles(W - BALL_R, g.ballY, 12, '#818cf8', 4);
        flashes.push({ x: W, y: g.ballY, age: 0, kind: 'goal', color: '#818cf8' });
        triggerShake(4);
        scoreFlashRef.current = { side: 'left', age: 0 };
        sfx.goalScored();
        g.pScore++;
        setPlayerScore(g.pScore);
        scored = true;
        resetBall(1);
      }

      if (scored && (g.pScore >= WIN_SCORE || g.bScore >= WIN_SCORE)) {
        const won = g.pScore >= WIN_SCORE;
        setWinner(won ? 'player' : 'bot');
        setPhase('ended');
        draw(g);
        return;
      }

      draw(g);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, resetBall]);

  // ── Draw ───────────────────────────────────────────────────────────────

  function draw(g: typeof gameRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    }

    const shake = shakeRef.current;
    ctx.save();
    if (shake.decay > 0) ctx.translate(shake.x, shake.y);

    // ── Background ─────────────────────────────────────────────────────
    ctx.fillStyle = '#08080e';
    ctx.fillRect(-4, -4, W + 8, H + 8);

    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.72);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── Arena lines ────────────────────────────────────────────────────

    const edgeGlow = ctx.createLinearGradient(0, 0, 0, 6);
    edgeGlow.addColorStop(0, 'rgba(99,102,241,0.12)');
    edgeGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGlow;
    ctx.fillRect(0, 0, W, 6);
    const edgeGlowB = ctx.createLinearGradient(0, H, 0, H - 6);
    edgeGlowB.addColorStop(0, 'rgba(99,102,241,0.12)');
    edgeGlowB.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGlowB;
    ctx.fillRect(0, H - 6, W, 6);

    ctx.fillStyle = 'rgba(99,102,241,0.08)';
    ctx.fillRect(0, 0, W, 1);
    ctx.fillRect(0, H - 1, W, 1);

    const clGlow = ctx.createLinearGradient(W / 2 - 8, 0, W / 2 + 8, 0);
    clGlow.addColorStop(0, 'transparent');
    clGlow.addColorStop(0.5, 'rgba(99,102,241,0.06)');
    clGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = clGlow;
    ctx.fillRect(W / 2 - 8, 0, 16, H);

    ctx.fillStyle = '#1c1c2e';
    for (let yy = 6; yy < H - 6; yy += 18) {
      ctx.fillRect(W / 2 - 1, yy, 2, 9);
    }

    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
    ctx.strokeStyle = '#18182a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1c2e';
    ctx.fill();

    // ── Score (in-arena) ──────────────────────────────────────────────
    const sf = scoreFlashRef.current;
    ctx.font = '600 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const pScoreAlpha = sf.side === 'left' ? Math.max(0.08, 0.4 * (1 - sf.age / 20)) : 0.08;
    ctx.fillStyle = `rgba(129,140,248,${pScoreAlpha})`;
    ctx.fillText(`${g.pScore}`, W / 2 - 80, 18);

    const bScoreAlpha = sf.side === 'right' ? Math.max(0.08, 0.4 * (1 - sf.age / 20)) : 0.08;
    ctx.fillStyle = `rgba(251,113,133,${bScoreAlpha})`;
    ctx.fillText(`${g.bScore}`, W / 2 + 80, 18);

    // ── Impact flashes ───────────────────────────────────────────────
    const flashes = flashesRef.current;
    for (const flash of flashes) {
      const t01 = flash.age / 16;
      const alpha = Math.max(0, 1 - t01);

      if (flash.kind === 'wall') {
        const spread = 30 + flash.age * 6;
        const lineGrad = ctx.createLinearGradient(flash.x - spread, flash.y, flash.x + spread, flash.y);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.3, `rgba(139,156,247,${alpha * 0.25})`);
        lineGrad.addColorStop(0.5, `rgba(139,156,247,${alpha * 0.5})`);
        lineGrad.addColorStop(0.7, `rgba(139,156,247,${alpha * 0.25})`);
        lineGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lineGrad;
        ctx.fillRect(flash.x - spread, flash.y - 3, spread * 2, 6);
      } else if (flash.kind === 'paddle') {
        const radius = 12 + flash.age * 4;
        const grad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
        grad.addColorStop(0, flash.color + hexAlpha(alpha * 0.6));
        grad.addColorStop(0.5, flash.color + hexAlpha(alpha * 0.2));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (flash.kind === 'goal') {
        const goalR = 60 + flash.age * 10;
        const goalGrad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, goalR);
        goalGrad.addColorStop(0, flash.color + hexAlpha(alpha * 0.35));
        goalGrad.addColorStop(0.6, flash.color + hexAlpha(alpha * 0.1));
        goalGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = goalGrad;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, goalR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Particles ────────────────────────────────────────────────────
    const parts = particlesRef.current;
    for (const p of parts) {
      const alpha = 1 - p.life / p.maxLife;
      const size = p.r * alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = p.color + hexAlpha(alpha * 0.7);
      ctx.fill();
    }

    // ── Ball trail ──────────────────────────────────────────────────
    const trail = trailRef.current;
    const showBall = phaseRef.current !== 'countdown';
    if (showBall && trail.length > 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const frac = i / trail.length;
        const alpha = frac * 0.35;
        const width = BALL_R * 2 * frac * 0.6;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(139,156,247,${alpha})`;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }

    // ── Paddles ──────────────────────────────────────────────────────
    drawPaddle(ctx, PADDLE_OFFSET, g.playerY, g.playerHit, '#818cf8', '#6366f1');
    drawPaddle(ctx, W - PADDLE_OFFSET - PADDLE_W, g.botY, g.botHit, '#fb7185', '#f43f5e');

    // ── Ball ─────────────────────────────────────────────────────────
    if (showBall) {
      const speedFrac = Math.min((g.speed - BALL_BASE_SPEED) / 4, 1);

      const glowR = BALL_R * (3 + speedFrac * 2);
      const glowGrad = ctx.createRadialGradient(g.ballX, g.ballY, 0, g.ballX, g.ballY, glowR);
      glowGrad.addColorStop(0, `rgba(180,190,255,${0.12 + speedFrac * 0.08})`);
      glowGrad.addColorStop(0.5, `rgba(139,156,247,${0.04 + speedFrac * 0.03})`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, glowR, 0, Math.PI * 2);
      ctx.fill();

      const ballGrad = ctx.createRadialGradient(
        g.ballX - 2, g.ballY - 2, 0,
        g.ballX, g.ballY, BALL_R,
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.6, '#e0e4ff');
      ballGrad.addColorStop(1, '#b4bfff');
      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(g.ballX, g.ballY, BALL_R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawPaddle(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    hitTimer: number,
    lightColor: string, darkColor: string,
  ) {
    const hit = hitTimer > 0;
    const hitFrac = hit ? hitTimer / 10 : 0;

    const scaleX = hit ? 1 + hitFrac * 0.3 : 1;
    const drawX = x - (PADDLE_W * (scaleX - 1)) / 2;
    const drawW = PADDLE_W * scaleX;

    const ambientR = PADDLE_H * 0.5;
    const ambientGrad = ctx.createRadialGradient(
      drawX + drawW / 2, y + PADDLE_H / 2, 0,
      drawX + drawW / 2, y + PADDLE_H / 2, ambientR,
    );
    const ambientAlpha = hit ? 0.15 + hitFrac * 0.2 : 0.06;
    ambientGrad.addColorStop(0, darkColor + hexAlpha(ambientAlpha));
    ambientGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(drawX - ambientR, y + PADDLE_H / 2 - ambientR, drawW + ambientR * 2, ambientR * 2);

    if (hit) {
      const flashR = PADDLE_H * 0.7 * (1 + hitFrac * 0.5);
      const flashGrad = ctx.createRadialGradient(
        drawX + drawW / 2, y + PADDLE_H / 2, 0,
        drawX + drawW / 2, y + PADDLE_H / 2, flashR,
      );
      flashGrad.addColorStop(0, lightColor + hexAlpha(hitFrac * 0.4));
      flashGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flashGrad;
      ctx.fillRect(drawX - flashR, y + PADDLE_H / 2 - flashR, drawW + flashR * 2, flashR * 2);
    }

    ctx.beginPath();
    ctx.roundRect(drawX, y, drawW, PADDLE_H, PADDLE_R);
    const bodyGrad = ctx.createLinearGradient(drawX, y, drawX, y + PADDLE_H);
    if (hit) {
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.4, lightColor);
      bodyGrad.addColorStop(1, darkColor);
    } else {
      bodyGrad.addColorStop(0, '#d4d4d8');
      bodyGrad.addColorStop(0.5, '#a1a1aa');
      bodyGrad.addColorStop(1, '#71717a');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(drawX, y, drawW, PADDLE_H, PADDLE_R);
    ctx.strokeStyle = hit ? lightColor + '90' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = hit ? 1.5 : 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(drawX + 1, y + 1, drawW - 2, PADDLE_H / 3, [PADDLE_R, PADDLE_R, 1, 1]);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
  }

  // ── Draw on static phases ──────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'menu' || phase === 'paused' || phase === 'ended') {
      draw(gameRef.current);
    }
  }, [phase]);

  // ── Render ─────────────────────────────────────────────────────────────

  const isActive = phase === 'playing' || phase === 'paused' || phase === 'countdown';

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center gap-6 outline-none"
      tabIndex={-1}
    >
      {/* Score bar */}
      {isActive && (
        <div className="flex items-center gap-6 text-lg font-bold tabular-nums">
          <span className="text-indigo-400">{t('pong.you')}</span>
          <span className="text-2xl">{playerScore} – {botScore}</span>
          <span className="text-rose-400">{t('pong.bot')}</span>
        </div>
      )}

      {/* Canvas wrapper */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H }}
          className="rounded-xl border border-zinc-800 max-w-full h-auto touch-none"
        />

        {/* Mute toggle — always visible in top-right */}
        {phase !== 'menu' && (
          <button
            onClick={toggleMute}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-sm transition-colors"
            title={muted ? t('pong.unmute') : t('pong.mute')}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        )}

        {/* Menu overlay */}
        {phase === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <h2 className="text-5xl font-black mb-2 tracking-tight">Pong</h2>
            <p className="text-zinc-400 text-sm mb-1">
              {t('pong.firstTo')} {WIN_SCORE}
            </p>
            <p className="text-zinc-500 text-xs mb-6 max-sm:hidden">W/S · Arrow Up/Down</p>
            <p className="text-zinc-500 text-xs mb-6 sm:hidden">{t('pong.touchHint')}</p>

            {/* Difficulty selector */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                {t('pong.difficulty')}
              </p>
              <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                      difficulty === d
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t(`pong.diff.${d}`)}
                  </button>
                ))}
              </div>
            </div>

            {stats && stats.games > 0 && (
              <p className="text-zinc-500 text-xs mb-4">
                {t('pong.stats.games')}: {stats.games} · {t('pong.stats.wins')}: {stats.wins} · {t('pong.stats.losses')}: {stats.losses}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
              >
                {t('pong.start')}
              </button>
              <button
                onClick={toggleMute}
                className="px-3 py-3 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 transition-colors"
                title={muted ? t('pong.unmute') : t('pong.mute')}
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none">
            <span
              key={countdownNum}
              className="text-7xl font-black text-white/90 drop-shadow-lg animate-[ping_0.5s_ease-out]"
              style={{ animationFillMode: 'forwards' }}
            >
              {countdownNum > 0 ? countdownNum : 'GO'}
            </span>
          </div>
        )}

        {/* Paused overlay */}
        {phase === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <h2 className="text-3xl font-bold mb-3">{t('pong.paused')}</h2>
            <p className="text-zinc-500 text-sm mb-6">{t('pong.pauseHint')}</p>
            <button
              onClick={() => setPhase('playing')}
              className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
            >
              {t('pong.resume')}
            </button>
          </div>
        )}

        {/* End overlay */}
        {phase === 'ended' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <h2 className={`text-4xl font-black mb-2 ${winner === 'player' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {winner === 'player' ? t('pong.win') : t('pong.lose')}
            </h2>
            <p className="text-zinc-400 text-lg mb-8 tabular-nums">
              {playerScore} – {botScore}
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
            >
              {t('pong.playAgain')}
            </button>
          </div>
        )}
      </div>

      {/* Controls hint */}
      {phase === 'playing' && (
        <p className="text-zinc-600 text-xs">P / ESC {t('pong.toPause')}</p>
      )}
    </div>
  );
}

// ── Utility ──────────────────────────────────────────────────────────────────

function hexAlpha(a: number): string {
  return Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
}
