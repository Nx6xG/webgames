'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useSkinShop } from '@/hooks/useSkinShop';
import { SkinShopOverlay } from '@/components/ui/SkinShopOverlay';
import type { SkinDef } from '@/lib/skinShop';
import * as sfx from './sound';

// ── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 400;
const CANVAS_H = 600;

const DOODLER_W = 32;
const DOODLER_H = 40;

const PLATFORM_W = 60;
const PLATFORM_H = 12;

const SPRING_W = 12;
const SPRING_H = 16;

const GRAVITY = 0.3;
const JUMP_VEL = 9;
const SPRING_VEL = 14;
const MAX_FALL_VEL = 10;

const MOVE_SPEED = 3.5;
const FRICTION = 0.85;

const COUNTDOWN_STEPS = 3;
const COUNTDOWN_STEP_MS = 700;

const BEST_KEY = 'webgames.doodlejump.bestScore';

// ── Doodler skins ───────────────────────────────────────────────────────────

const DOODLE_SKINS: SkinDef[] = [
  { id: 'doodler',   price: 0,   nameKey: 'doodlejump.skin.doodler',   colors: { body: '#8b5cf6', bodyDark: '#6d28d9', eyes: '#1f2937', mouth: '#ec4899', feet: '#7c3aed' } },
  { id: 'alien',     price: 20,  nameKey: 'doodlejump.skin.alien',     colors: { body: '#22c55e', bodyDark: '#15803d', eyes: '#000000', mouth: '#4ade80', feet: '#16a34a' } },
  { id: 'snowman',   price: 20,  nameKey: 'doodlejump.skin.snowman',   colors: { body: '#e2e8f0', bodyDark: '#94a3b8', eyes: '#1f2937', mouth: '#f97316', feet: '#64748b' } },
  { id: 'pumpkin',   price: 30,  nameKey: 'doodlejump.skin.pumpkin',   colors: { body: '#fb923c', bodyDark: '#c2410c', eyes: '#fef08a', mouth: '#fef08a', feet: '#92400e' } },
  { id: 'robot',     price: 40,  nameKey: 'doodlejump.skin.robot',     colors: { body: '#94a3b8', bodyDark: '#475569', eyes: '#22d3ee', mouth: '#22d3ee', feet: '#334155' } },
  { id: 'astronaut', price: 60,  nameKey: 'doodlejump.skin.astronaut', colors: { body: '#f8fafc', bodyDark: '#cbd5e1', eyes: '#3b82f6', mouth: '#60a5fa', feet: '#64748b' } },
  { id: 'wizard',    price: 80,  nameKey: 'doodlejump.skin.wizard',    colors: { body: '#7c3aed', bodyDark: '#5b21b6', eyes: '#fbbf24', mouth: '#c084fc', feet: '#6d28d9' } },
  { id: 'phoenix',   price: 120, nameKey: 'doodlejump.skin.phoenix',   colors: { body: '#ef4444', bodyDark: '#991b1b', eyes: '#fef08a', mouth: '#fbbf24', feet: '#dc2626' } },
  { id: 'crystal',   price: 200, nameKey: 'doodlejump.skin.crystal',   colors: { body: '#67e8f9', bodyDark: '#06b6d4', eyes: '#ecfeff', mouth: '#a5f3fc', feet: '#0891b2' }, requireAll: true },
];

// ── Platform types ──────────────────────────────────────────────────────────

type PlatformKind = 'normal' | 'moving' | 'breakable' | 'spring';

interface Platform {
  x: number;
  y: number; // in world coordinates (y increases upward)
  w: number;
  kind: PlatformKind;
  // moving platform state
  moveDir?: number;
  moveSpeed?: number;
  moveMin?: number;
  moveMax?: number;
  // breakable state
  broken?: boolean;
  breakTimer?: number;
  // spring state
  hasSpring?: boolean;
  springBounced?: boolean;
}

// ── Game state (stored in ref) ──────────────────────────────────────────────

interface GameState {
  doodlerX: number;
  doodlerY: number; // world coords (y up)
  velX: number;
  velY: number; // positive = moving up in world
  cameraY: number; // the world y coordinate of the bottom of the viewport
  platforms: Platform[];
  score: number;
  maxHeight: number;
  lastScoredY: number; // only score when landing higher than this
  nextPlatformY: number;
  platformIdCounter: number;
}

// ── Phase ───────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'countdown' | 'playing' | 'paused' | 'over';

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadBest(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {}
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Choose a platform kind based on score-driven difficulty. */
function choosePlatformKind(score: number): PlatformKind {
  // difficulty ramps slowly: 0 at start, 0.5 at score 50, ~0.8 at 100, caps at 1.0 at 150+
  const difficulty = Math.min(score / 150, 1);
  const r = Math.random();

  // Early game (score < 10): almost all normal
  if (score < 10) {
    if (r < 0.05) return 'spring';
    return 'normal';
  }

  // Mid game: gradually introduce moving, then breakable
  const breakChance = difficulty * 0.18;        // 0% → 18%
  const movingChance = 0.05 + difficulty * 0.15; // 5% → 20%
  const springChance = 0.04;                     // constant 4%

  if (r < breakChance) return 'breakable';
  if (r < breakChance + movingChance) return 'moving';
  if (r < breakChance + movingChance + springChance) return 'spring';
  return 'normal';
}

/** Generate the initial set of platforms — easy, tight spacing. */
function generateInitialPlatforms(): Platform[] {
  const platforms: Platform[] = [];
  // Ground platform — extra wide
  platforms.push({
    x: CANVAS_W / 2 - (PLATFORM_W + 20) / 2,
    y: 0,
    w: PLATFORM_W + 20,
    kind: 'normal',
  });

  let y = 50;
  while (y < CANVAS_H + 200) {
    const gap = randomRange(30, 50); // very easy initial gaps
    const x = randomRange(10, CANVAS_W - PLATFORM_W - 10);
    platforms.push(createPlatform(x, y, 'normal'));
    y += gap;
  }
  return platforms;
}

function createPlatform(x: number, y: number, kind: PlatformKind): Platform {
  const p: Platform = { x, y, w: PLATFORM_W, kind };
  if (kind === 'moving') {
    p.moveDir = Math.random() < 0.5 ? 1 : -1;
    p.moveSpeed = randomRange(0.8, 2.0);
    p.moveMin = Math.max(0, x - 80);
    p.moveMax = Math.min(CANVAS_W - PLATFORM_W, x + 80);
  }
  if (kind === 'spring') {
    p.hasSpring = true;
    p.kind = 'normal'; // spring is visually a normal platform + spring on top
  }
  return p;
}

function createInitialState(): GameState {
  const platforms = generateInitialPlatforms();
  return {
    doodlerX: CANVAS_W / 2 - DOODLER_W / 2,
    doodlerY: 50,
    velX: 0,
    velY: 0,
    cameraY: 0,
    platforms,
    score: 0,
    maxHeight: 0,
    lastScoredY: -1,
    nextPlatformY: platforms[platforms.length - 1].y + randomRange(28, 45),
    platformIdCounter: platforms.length,
  };
}

// ── Drawing helpers ─────────────────────────────────────────────────────────

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, screenY: number) {
  const { x, w, kind, broken, hasSpring, springBounced } = p;

  if (broken) {
    const bt = p.breakTimer ?? 0;
    if (bt < 0) {
      // Delay phase — still looks normal but shakes slightly
      const shake = Math.sin(bt * 3) * 2;
      // Draw normal platform with shake
      const grad = ctx.createLinearGradient(x, screenY, x, screenY + PLATFORM_H);
      grad.addColorStop(0, '#d97706');
      grad.addColorStop(1, '#b45309');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, x + shake, screenY, w, PLATFORM_H, 4);
      ctx.fill();
      return;
    }
    // Break animation — halves falling apart
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - bt / 30);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - bt * 0.5, screenY + bt * 2, w / 2 - 2, PLATFORM_H);
    ctx.fillRect(x + w / 2 + 2 + bt * 0.5, screenY + bt * 3, w / 2 - 2, PLATFORM_H);
    ctx.restore();
    return;
  }

  // Platform body
  let color1: string;
  let color2: string;
  switch (kind) {
    case 'normal':
      color1 = '#22c55e';
      color2 = '#16a34a';
      break;
    case 'moving':
      color1 = '#3b82f6';
      color2 = '#2563eb';
      break;
    case 'breakable':
      color1 = '#d97706';
      color2 = '#b45309';
      break;
    default:
      color1 = '#22c55e';
      color2 = '#16a34a';
  }

  // Gradient
  const grad = ctx.createLinearGradient(x, screenY, x, screenY + PLATFORM_H);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, x, screenY, w, PLATFORM_H, 4);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x + 4, screenY + 2, w - 8, 3);

  // Crack lines on breakable
  if (kind === 'breakable') {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, screenY + 2);
    ctx.lineTo(x + w * 0.4, screenY + PLATFORM_H - 2);
    ctx.moveTo(x + w * 0.6, screenY + 3);
    ctx.lineTo(x + w * 0.7, screenY + PLATFORM_H - 3);
    ctx.stroke();
  }

  // Spring
  if (hasSpring) {
    const sx = x + w / 2 - SPRING_W / 2;
    const sy = screenY - SPRING_H + 2;
    const bounced = springBounced;

    ctx.strokeStyle = bounced ? '#facc15' : '#a3a3a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Coil shape
    const coils = 3;
    const coilH = SPRING_H / coils;
    for (let i = 0; i < coils; i++) {
      const top = sy + i * coilH;
      ctx.moveTo(sx + 1, top);
      ctx.lineTo(sx + SPRING_W - 1, top + coilH * 0.5);
      ctx.lineTo(sx + 1, top + coilH);
    }
    ctx.stroke();

    // Base
    ctx.fillStyle = bounced ? '#facc15' : '#737373';
    ctx.fillRect(sx - 1, screenY - 2, SPRING_W + 2, 4);
  }
}

/** Helper: get a prismatic rainbow color cycling through hue at a given speed. */
function prismaticColor(time: number, offset: number = 0, saturation: number = 100, lightness: number = 70): string {
  const hue = ((time * 0.1) + offset) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Draw dramatic crystal effects around the doodler. */
function drawCrystalEffects(ctx: CanvasRenderingContext2D, x: number, screenY: number, velY: number) {
  const now = performance.now();
  const cx = x + DOODLER_W / 2;
  const cy = screenY + DOODLER_H / 2;

  // ── 1. Prismatic aura glow ──────────────────────────────────────────
  ctx.save();
  const auraRadius = 28 + Math.sin(now * 0.004) * 4;
  const auraGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, auraRadius);
  const hue1 = (now * 0.08) % 360;
  const hue2 = (hue1 + 120) % 360;
  const hue3 = (hue1 + 240) % 360;
  auraGrad.addColorStop(0, `hsla(${hue1}, 100%, 80%, 0.35)`);
  auraGrad.addColorStop(0.4, `hsla(${hue2}, 100%, 70%, 0.18)`);
  auraGrad.addColorStop(0.7, `hsla(${hue3}, 100%, 70%, 0.08)`);
  auraGrad.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 2. Orbiting sparkle particles (6 of them) ──────────────────────
  ctx.save();
  const orbitCount = 6;
  const orbitRadius = 22 + Math.sin(now * 0.003) * 3;
  for (let i = 0; i < orbitCount; i++) {
    const angle = (now * 0.003) + (i * Math.PI * 2 / orbitCount);
    const ox = cx + Math.cos(angle) * orbitRadius;
    const oy = cy + Math.sin(angle) * (orbitRadius * 0.7); // slightly elliptical
    const sparkleSize = 2 + Math.sin(now * 0.01 + i * 1.5) * 1;
    const color = prismaticColor(now, i * 60, 100, 85);

    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox, oy, sparkleSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw a tiny 4-point star shape
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ox - sparkleSize * 1.5, oy);
    ctx.lineTo(ox + sparkleSize * 1.5, oy);
    ctx.moveTo(ox, oy - sparkleSize * 1.5);
    ctx.lineTo(ox, oy + sparkleSize * 1.5);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── 3. Crystalline shimmer (diagonal highlight sweeping across body) ─
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, x, screenY, DOODLER_W, DOODLER_H, 8);
  ctx.clip();

  const shimmerX = ((now * 0.06) % (DOODLER_W + 30)) - 15;
  const shimmerGrad = ctx.createLinearGradient(
    x + shimmerX - 8, screenY,
    x + shimmerX + 8, screenY + DOODLER_H
  );
  shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
  shimmerGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
  shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  shimmerGrad.addColorStop(0.7, 'rgba(255,255,255,0)');
  shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shimmerGrad;
  ctx.fillRect(x, screenY, DOODLER_W, DOODLER_H);
  ctx.restore();

  // ── 4. Floating crystal fragments drifting upward ──────────────────
  ctx.save();
  const fragmentCount = 8;
  for (let i = 0; i < fragmentCount; i++) {
    // Each fragment has a unique cycle based on index
    const cycle = ((now * 0.001 + i * 1.7) % 2.5); // 0..2.5 seconds per cycle
    const progress = cycle / 2.5; // 0..1
    const alpha = progress < 0.1 ? progress * 10 : progress > 0.7 ? (1 - progress) / 0.3 : 1;

    const fx = cx + Math.sin(now * 0.002 + i * 2.1) * 14 + (i % 2 === 0 ? -6 : 6);
    const fy = screenY + DOODLER_H - progress * 60 - (velY > 0 ? 10 : 0);
    const fSize = 1.5 + Math.sin(i * 0.7) * 0.8;
    const fColor = prismaticColor(now, i * 45, 90, 80);

    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = fColor;

    // Draw tiny diamond shape
    ctx.beginPath();
    ctx.moveTo(fx, fy - fSize * 1.5);
    ctx.lineTo(fx + fSize, fy);
    ctx.lineTo(fx, fy + fSize * 1.5);
    ctx.lineTo(fx - fSize, fy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Draw glowing/pulsing eyes for the crystal skin. */
function drawCrystalEyes(ctx: CanvasRenderingContext2D, x: number, screenY: number, velY: number) {
  const now = performance.now();
  const eyeY = screenY + 10;
  const eyeR = 4;
  const pulse = 0.6 + Math.sin(now * 0.006) * 0.4; // 0.2..1.0

  const glowColor = prismaticColor(now, 180, 100, 90);

  for (const ex of [x + 10, x + 22]) {
    // Glow behind eye
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8 * pulse;
    ctx.fillStyle = `rgba(255,255,255,${0.6 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Iris with prismatic color
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(ex, eyeY + (velY > 0 ? -1 : 1), 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Bright center dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, eyeY + (velY > 0 ? -1 : 1), 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDoodler(ctx: CanvasRenderingContext2D, x: number, screenY: number, velY: number, skinColors?: Record<string, string>, skinId?: string) {
  const isCrystal = skinId === 'crystal';
  const bodyColor = skinColors?.body ?? '#8b5cf6';
  const bodyDark = skinColors?.bodyDark ?? '#6d28d9';
  const mouthColor = skinColors?.mouth ?? '#ec4899';
  const feetColor = skinColors?.feet ?? '#7c3aed';

  // Crystal: draw aura + orbiting sparkles BEFORE the body
  if (isCrystal) {
    drawCrystalEffects(ctx, x, screenY, velY);
  }

  // Body gradient — crystal gets a subtle prismatic tint
  const grad = ctx.createLinearGradient(x, screenY, x, screenY + DOODLER_H);
  if (isCrystal) {
    const now = performance.now();
    const h1 = (now * 0.05) % 360;
    const h2 = (h1 + 60) % 360;
    grad.addColorStop(0, `hsl(${h1}, 70%, 80%)`);
    grad.addColorStop(0.5, bodyColor);
    grad.addColorStop(1, `hsl(${h2}, 60%, 45%)`);
  } else {
    grad.addColorStop(0, bodyColor);
    grad.addColorStop(1, bodyDark);
  }
  ctx.fillStyle = grad;

  // Crystal: add outer glow via shadow
  if (isCrystal) {
    ctx.save();
    const now = performance.now();
    ctx.shadowColor = prismaticColor(now, 0, 100, 75);
    ctx.shadowBlur = 12 + Math.sin(now * 0.005) * 4;
    drawRoundedRect(ctx, x, screenY, DOODLER_W, DOODLER_H, 8);
    ctx.fill();
    ctx.restore();
  } else {
    drawRoundedRect(ctx, x, screenY, DOODLER_W, DOODLER_H, 8);
    ctx.fill();
  }

  // Outline
  if (isCrystal) {
    const now = performance.now();
    ctx.strokeStyle = prismaticColor(now, 120, 80, 70);
  } else {
    ctx.strokeStyle = bodyDark;
  }
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, screenY, DOODLER_W, DOODLER_H, 8);
  ctx.stroke();

  // Eyes — crystal gets special glowing eyes
  if (isCrystal) {
    drawCrystalEyes(ctx, x, screenY, velY);
  } else {
    const eyesColor = skinColors?.eyes ?? '#1f2937';
    const eyeY = screenY + 10;
    const eyeR = 4;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 10, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = eyesColor;
    ctx.beginPath();
    ctx.arc(x + 10, eyeY + (velY > 0 ? -1 : 1), 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 22, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = eyesColor;
    ctx.beginPath();
    ctx.arc(x + 22, eyeY + (velY > 0 ? -1 : 1), 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth — smile when going up, open mouth when falling
  if (velY < 0) {
    ctx.fillStyle = mouthColor;
    ctx.beginPath();
    ctx.ellipse(x + DOODLER_W / 2, screenY + 26, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = mouthColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + DOODLER_W / 2, screenY + 24, 5, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  // Feet — little stubs when falling
  if (velY < 0) {
    if (isCrystal) {
      const now = performance.now();
      ctx.fillStyle = prismaticColor(now, 200, 70, 60);
    } else {
      ctx.fillStyle = feetColor;
    }
    ctx.fillRect(x + 6, screenY + DOODLER_H, 6, 4);
    ctx.fillRect(x + DOODLER_W - 12, screenY + DOODLER_H, 6, 4);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, cameraY: number) {
  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0f0b25');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  const starSeed = [17, 53, 97, 149, 211, 263, 307, 359, 401, 443, 487, 521, 563, 607, 641, 683];
  for (let i = 0; i < starSeed.length; i++) {
    const sx = (starSeed[i] * 7 + i * 31) % CANVAS_W;
    const sy = ((starSeed[i] * 13 + i * 47 + Math.floor(cameraY * 0.05)) % (CANVAS_H + 40)) - 20;
    const size = (i % 3 === 0) ? 2 : 1;
    ctx.fillRect(sx, sy, size, size);
  }

  // Larger dim stars
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let i = 0; i < 8; i++) {
    const sx = (starSeed[i] * 11 + 200) % CANVAS_W;
    const sy = ((starSeed[i] * 23 + Math.floor(cameraY * 0.02)) % (CANVAS_H + 60)) - 30;
    ctx.fillRect(sx, sy, 3, 3);
  }
}

function drawScore(ctx: CanvasRenderingContext2D, score: number) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(score), 12, 28);
}

// ── Skin preview for shop ───────────────────────────────────────────────────

function renderSkinPreview(ctx: CanvasRenderingContext2D, skin: SkinDef, size: number) {
  const c = skin.colors;
  const cx = size / 2;
  const cy = size / 2;
  const bodyW = size * 0.6;
  const bodyH = size * 0.7;
  const bx = cx - bodyW / 2;
  const by = size * 0.12;
  const isCrystal = skin.id === 'crystal';

  // Crystal: rainbow aura glow behind the body
  if (isCrystal) {
    const now = performance.now();
    const auraR = size * 0.48;
    const auraGrad = ctx.createRadialGradient(cx, cy, size * 0.15, cx, cy, auraR);
    const h1 = (now * 0.08) % 360;
    const h2 = (h1 + 120) % 360;
    const h3 = (h1 + 240) % 360;
    auraGrad.addColorStop(0, `hsla(${h1}, 100%, 80%, 0.3)`);
    auraGrad.addColorStop(0.4, `hsla(${h2}, 100%, 70%, 0.15)`);
    auraGrad.addColorStop(0.7, `hsla(${h3}, 100%, 70%, 0.07)`);
    auraGrad.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle dots around the body
    const sparkleCount = 6;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (now * 0.002) + (i * Math.PI * 2 / sparkleCount);
      const sr = size * 0.4;
      const sx = cx + Math.cos(angle) * sr;
      const sy = cy + Math.sin(angle) * (sr * 0.7);
      const sSize = size * 0.03 + Math.sin(now * 0.008 + i) * size * 0.01;
      const sColor = prismaticColor(now, i * 60, 100, 85);

      ctx.save();
      ctx.shadowColor = sColor;
      ctx.shadowBlur = 4;
      ctx.fillStyle = sColor;
      ctx.beginPath();
      ctx.arc(sx, sy, sSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Body
  const grad = ctx.createLinearGradient(bx, by, bx, by + bodyH);
  if (isCrystal) {
    const now = performance.now();
    const h1 = (now * 0.05) % 360;
    const h2 = (h1 + 60) % 360;
    grad.addColorStop(0, `hsl(${h1}, 70%, 80%)`);
    grad.addColorStop(0.5, c.body);
    grad.addColorStop(1, `hsl(${h2}, 60%, 45%)`);
  } else {
    grad.addColorStop(0, c.body);
    grad.addColorStop(1, c.bodyDark);
  }
  ctx.fillStyle = grad;

  if (isCrystal) {
    ctx.save();
    const now = performance.now();
    ctx.shadowColor = prismaticColor(now, 0, 100, 75);
    ctx.shadowBlur = 10;
    drawRoundedRect(ctx, bx, by, bodyW, bodyH, bodyW * 0.25);
    ctx.fill();
    ctx.restore();
  } else {
    drawRoundedRect(ctx, bx, by, bodyW, bodyH, bodyW * 0.25);
    ctx.fill();
  }

  // Crystal: shimmer sweep across body
  if (isCrystal) {
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(ctx, bx, by, bodyW, bodyH, bodyW * 0.25);
    ctx.clip();
    const now = performance.now();
    const shimmerX = ((now * 0.04) % (bodyW + 20)) - 10;
    const shimmerGrad = ctx.createLinearGradient(
      bx + shimmerX - 6, by,
      bx + shimmerX + 6, by + bodyH
    );
    shimmerGrad.addColorStop(0, 'rgba(255,255,255,0)');
    shimmerGrad.addColorStop(0.4, 'rgba(255,255,255,0)');
    shimmerGrad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    shimmerGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
    shimmerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(bx, by, bodyW, bodyH);
    ctx.restore();
  }

  // Eyes
  const eyeR = size * 0.06;
  const eyeY = by + bodyH * 0.28;
  const eyeSpread = bodyW * 0.22;

  if (isCrystal) {
    const now = performance.now();
    const glowColor = prismaticColor(now, 180, 100, 90);
    const pulse = 0.6 + Math.sin(now * 0.006) * 0.4;
    for (const ex of [cx - eyeSpread, cx + eyeSpread]) {
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6 * pulse;
      ctx.fillStyle = `rgba(255,255,255,${0.6 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - eyeSpread, eyeY, eyeR * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eyes;
    ctx.beginPath();
    ctx.arc(cx - eyeSpread, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + eyeSpread, eyeY, eyeR * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.eyes;
    ctx.beginPath();
    ctx.arc(cx + eyeSpread, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth — small smile arc
  ctx.strokeStyle = c.mouth;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, by + bodyH * 0.55, size * 0.08, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

// ── Component ───────────────────────────────────────────────────────────────

export function DoodleJumpGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('doodlejump');
  const pb = usePersonalScores('doodlejump', user ? { userId: user.id, nickname } : undefined);
  const shop = useSkinShop('doodlejump', DOODLE_SKINS);

  // ── React state (for overlays) ──────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [countdownNum, setCountdownNum] = useState(0);

  // ── Refs ──────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const gsRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const bestRef = useRef(0);
  const savedRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScoreMilestone = useRef(0);
  const lastTimeRef = useRef<number>(0);

  // Sync phase ref
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Load best
  useEffect(() => {
    const b = loadBest();
    setBest(b);
    bestRef.current = b;
  }, []);

  // Achievement tracking
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'idle') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas resize (DPI-aware) ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // ── Render a single frame to canvas ───────────────────────────────────
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gs = gsRef.current;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    drawBackground(ctx, gs.cameraY);

    // Platforms
    for (const p of gs.platforms) {
      const screenY = CANVAS_H - (p.y - gs.cameraY) - PLATFORM_H;
      if (screenY > CANVAS_H + 20 || screenY < -40) continue;
      drawPlatform(ctx, p, screenY);
    }

    // Doodler — use activeSkinRef to avoid stale closure in RAF
    const doodlerScreenY = CANVAS_H - (gs.doodlerY - gs.cameraY) - DOODLER_H;
    const currentSkinId = shop.activeSkinRef.current;
    const currentSkinDef = DOODLE_SKINS.find((s) => s.id === currentSkinId) ?? DOODLE_SKINS[0];
    drawDoodler(ctx, gs.doodlerX, doodlerScreenY, gs.velY, currentSkinDef.colors, currentSkinId);

    // Score
    drawScore(ctx, gs.score);

    ctx.restore();
  }, [shop.activeSkinRef]);

  // ── Game tick (delta-time based — consistent across all refresh rates) ──
  const tick = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return;

    // Calculate delta-time factor (1.0 = 60fps, 2.0 = 30fps, 0.5 = 120fps)
    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const rawDt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    // Clamp dt to avoid huge jumps after tab switch or lag spike (max ~3 frames at 60fps)
    const dt = Math.min(rawDt, 50) / 16.667;

    const gs = gsRef.current;
    const keys = keysRef.current;

    // ── Input ─────────────────────────────────────────────────────────
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) {
      gs.velX -= MOVE_SPEED * 0.2 * dt;
    }
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) {
      gs.velX += MOVE_SPEED * 0.2 * dt;
    }
    gs.velX *= Math.pow(FRICTION, dt);
    if (Math.abs(gs.velX) < 0.1) gs.velX = 0;

    // Clamp horizontal speed
    if (gs.velX > MOVE_SPEED) gs.velX = MOVE_SPEED;
    if (gs.velX < -MOVE_SPEED) gs.velX = -MOVE_SPEED;

    // ── Physics ───────────────────────────────────────────────────────
    gs.velY -= GRAVITY * dt;
    if (gs.velY < -MAX_FALL_VEL) gs.velY = -MAX_FALL_VEL;

    gs.doodlerX += gs.velX * dt;
    gs.doodlerY += gs.velY * dt;

    // Screen wrap
    if (gs.doodlerX + DOODLER_W < 0) {
      gs.doodlerX = CANVAS_W;
    } else if (gs.doodlerX > CANVAS_W) {
      gs.doodlerX = -DOODLER_W;
    }

    // ── Platform collision (only when falling) ────────────────────────
    if (gs.velY < 0) {
      const doodlerBottom = gs.doodlerY;
      const doodlerLeft = gs.doodlerX + 4;
      const doodlerRight = gs.doodlerX + DOODLER_W - 4;

      for (const p of gs.platforms) {
        if (p.broken) continue;

        const platTop = p.y + PLATFORM_H;
        const platLeft = p.x;
        const platRight = p.x + p.w;

        // Horizontal overlap + doodler's bottom is within platform range
        if (
          doodlerRight > platLeft &&
          doodlerLeft < platRight &&
          doodlerBottom >= p.y - 4 &&
          doodlerBottom <= platTop + 10
        ) {
          if (p.kind === 'breakable') {
            // Full bounce, then break — penalty is losing the platform, not jump height
            gs.velY = JUMP_VEL;
            gs.doodlerY = platTop;
            sfx.jumpSound();
            // Schedule break after the bounce launches the player
            p.broken = true;
            p.breakTimer = -8; // negative = delay before visible break animation starts
            sfx.breakSound();
            break;
          }

          // +1 score only when bouncing on a higher platform
          if (p.y > gs.lastScoredY) {
            gs.score += 1;
            gs.lastScoredY = p.y;
          }

          if (p.hasSpring && !p.springBounced) {
            gs.velY = SPRING_VEL;
            p.springBounced = true;
            sfx.springSound();
          } else {
            gs.velY = JUMP_VEL;
            sfx.jumpSound();
          }
          gs.doodlerY = platTop;
          break;
        }
      }
    }

    // ── Move moving platforms ─────────────────────────────────────────
    for (const p of gs.platforms) {
      if (p.kind === 'moving' && !p.broken) {
        p.x += (p.moveDir ?? 1) * (p.moveSpeed ?? 1) * dt;
        if (p.x <= (p.moveMin ?? 0)) {
          p.x = p.moveMin ?? 0;
          p.moveDir = 1;
        }
        if (p.x >= (p.moveMax ?? CANVAS_W - PLATFORM_W)) {
          p.x = p.moveMax ?? CANVAS_W - PLATFORM_W;
          p.moveDir = -1;
        }
      }
      // Animate broken platforms
      if (p.broken && p.breakTimer !== undefined) {
        p.breakTimer += 1 * dt;
      }
    }

    // ── Camera ────────────────────────────────────────────────────────
    const targetCam = gs.doodlerY - CANVAS_H * 0.4;
    if (targetCam > gs.cameraY) {
      gs.cameraY = targetCam;
    }

    // ── Score sync + milestones ──────────────────────────────────────
    // Score milestone sounds (every 25 bounces)
    const milestone = Math.floor(gs.score / 25);
    if (milestone > lastScoreMilestone.current) {
      lastScoreMilestone.current = milestone;
      sfx.scoreSound();
    }

    // ── Generate new platforms ────────────────────────────────────────
    // Max jump height ≈ v²/(2g) = 9²/(2*0.3) = 135px
    // Gaps must always be reachable: cap at ~85px (leaves ~50px margin for dt variance)
    const topOfView = gs.cameraY + CANVAS_H + 100;
    while (gs.nextPlatformY < topOfView) {
      const difficulty = Math.min(gs.score / 150, 1); // slow ramp over 150 bounces
      const minGap = 28 + difficulty * 17;  // 28 → 45
      const maxGap = 45 + difficulty * 40;  // 45 → 85
      const gap = randomRange(minGap, maxGap);

      gs.nextPlatformY += gap;
      const x = randomRange(10, CANVAS_W - PLATFORM_W - 10);
      const kind = choosePlatformKind(gs.score);
      const plat = createPlatform(x, gs.nextPlatformY, kind);
      gs.platforms.push(plat);

      // After a breakable platform, always place a reachable normal platform nearby
      if (kind === 'breakable') {
        const safeGap = randomRange(28, 50);
        gs.nextPlatformY += safeGap;
        const safeX = randomRange(10, CANVAS_W - PLATFORM_W - 10);
        gs.platforms.push(createPlatform(safeX, gs.nextPlatformY, 'normal'));
      }
    }

    // ── Cull platforms below camera ──────────────────────────────────
    gs.platforms = gs.platforms.filter((p) => {
      if (p.broken && (p.breakTimer ?? 0) > 30) return false;
      return p.y > gs.cameraY - 100;
    });

    // ── Sync React state ─────────────────────────────────────────────
    setScore(gs.score);

    // ── Game over check ──────────────────────────────────────────────
    if (gs.doodlerY < gs.cameraY - DOODLER_H - 20) {
      sfx.gameOverSound();
      phaseRef.current = 'over';
      setPhase('over');

      if (gs.score > bestRef.current) {
        bestRef.current = gs.score;
        setBest(gs.score);
        saveBest(gs.score);
      }

      if (!savedRef.current) {
        savedRef.current = true;
        pb.submit(gs.score);
        shop.addCoins(gs.score);
      }

      // Render one last frame
      renderFrame();
      return;
    }

    // ── Render ────────────────────────────────────────────────────────
    renderFrame();

    rafRef.current = requestAnimationFrame(tick);
  }, [renderFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start/stop loop based on phase ────────────────────────────────────
  const startLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = 0; // reset so first frame gets dt=0
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    if (phase === 'playing') {
      startLoop();
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Render the current state when paused/idle so canvas isn't blank
      renderFrame();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, startLoop, renderFrame]);

  // ── Countdown ─────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);

    // Reset game state
    gsRef.current = createInitialState();
    savedRef.current = false;
    lastScoreMilestone.current = 0;
    setScore(0);

    setPhase('countdown');
    phaseRef.current = 'countdown';
    setCountdownNum(COUNTDOWN_STEPS);
    sfx.countdownBeep();

    let step = COUNTDOWN_STEPS;
    const advance = () => {
      step -= 1;
      if (step > 0) {
        sfx.countdownBeep();
        setCountdownNum(step);
        countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
      } else {
        sfx.countdownGo();
        setCountdownNum(0);
        countdownTimerRef.current = null;
        // Give initial upward velocity
        gsRef.current.velY = JUMP_VEL;
        phaseRef.current = 'playing';
        setPhase('playing');
      }
    };
    countdownTimerRef.current = setTimeout(advance, COUNTDOWN_STEP_MS);
  }, []);

  // Clean up countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
      startCountdown();
    }
  }, [startCountdown]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      phaseRef.current = 'paused';
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      phaseRef.current = 'playing';
      setPhase('playing');
    }
  }, []);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing', togglePause);

  // ── Keyboard input ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.key);

      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
          start();
        }
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (phaseRef.current === 'over') start();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
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
  }, [start, togglePause]);

  // ── Touch controls ────────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
        start();
        return;
      }
      const touch = e.touches[0];
      if (touch) touchStartX.current = touch.clientX;
    }

    function onTouchMove(e: TouchEvent) {
      if (phaseRef.current !== 'playing') return;
      const touch = e.touches[0];
      if (!touch || touchStartX.current === null) return;

      const dx = touch.clientX - touchStartX.current;
      const gs = gsRef.current;
      // Use tilt-like control: position relative to center determines speed
      gs.velX = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, dx * 0.05));
    }

    function onTouchEnd() {
      touchStartX.current = null;
      if (phaseRef.current === 'playing') {
        gsRef.current.velX *= 0.5;
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [start]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-2 w-full mx-auto select-none flex-1 min-h-0">
      {/* Game viewport — fills available space */}
      <div className="flex-1 min-h-0 w-full flex justify-center" ref={containerRef}>
        <div
          className="relative h-full overflow-hidden rounded-2xl border-2 border-zinc-800"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}`, maxWidth: '100%' }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ imageRendering: 'auto' }}
            width={CANVAS_W}
            height={CANVAS_H}
          />

          {/* ── Overlays ── */}

          {/* Idle */}
          {phase === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
              <div className="text-3xl font-black text-violet-400 mb-2 drop-shadow-lg">Doodle Jump</div>
              <p className="text-sm text-zinc-300 mb-4 text-center px-4">
                {t('doodlejump.desc') !== 'doodlejump.desc' ? t('doodlejump.desc') : 'Jump from platform to platform and climb as high as you can!'}
              </p>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs mb-4 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/30">
                <span className="text-sm">●</span> {shop.wallet}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={(e) => { e.stopPropagation(); start(); }}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-900/40"
                >
                  {t('flappy.startButton') !== 'flappy.startButton' ? t('flappy.startButton') : 'Start'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); shop.setShowShop(true); }}
                  className="px-4 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-900/40"
                >
                  {t('skinShop.title') !== 'skinShop.title' ? t('skinShop.title') : 'Shop'}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 mt-3">
                {t('doodlejump.hint') !== 'doodlejump.hint' ? t('doodlejump.hint') : 'Arrow keys / A,D to move'}
              </p>
            </div>
          )}

          {/* Countdown */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] z-20">
              <span className="text-7xl font-black text-white drop-shadow-lg tabular-nums animate-pulse">
                {countdownNum}
              </span>
            </div>
          )}

          {/* Paused */}
          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
              <div className="text-2xl font-black text-zinc-100 mb-4">{t('game.paused')}</div>
              <button
                onClick={(e) => { e.stopPropagation(); togglePause(); }}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Game Over */}
          {phase === 'over' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20 overflow-y-auto py-4">
              <div className="text-2xl font-black text-rose-400 mb-1">{t('game.over')}</div>
              <div className="text-4xl font-black text-zinc-100 mb-1 tabular-nums">{score}</div>
              {score >= best && score > 0 && (
                <span className="text-xs font-bold text-amber-400 mb-1">{t('game.newBest')}</span>
              )}
              <div className="text-xs text-zinc-400 mb-1">
                {t('game.best')}: <span className="text-zinc-200 font-bold tabular-nums">{best}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs mb-3 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-800/30">
                <span className="text-sm">●</span> {shop.wallet} <span className="text-amber-600 text-[10px]">(+{score})</span>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={(e) => { e.stopPropagation(); start(); }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('game.restart')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); shop.setShowShop(true); }}
                  className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {t('skinShop.title') !== 'skinShop.title' ? t('skinShop.title') : 'Shop'}
                </button>
              </div>
              <div className="w-full max-w-[280px]">
                <ScoreboardPanel
                  gameId="doodlejump"
                  scores={pb.scores}
                  lastInsertId={pb.lastInsertId}
                  isNewBest={pb.isNewBest}
                  onClear={pb.clear}
                />
              </div>
            </div>
          )}

          {/* Skin Shop */}
          {shop.showShop && (
            <SkinShopOverlay
              skins={DOODLE_SKINS}
              wallet={shop.wallet}
              owned={shop.owned}
              activeSkin={shop.activeSkin}
              onBuy={shop.buy}
              onEquip={shop.equip}
              onClose={() => shop.setShowShop(false)}
              renderPreview={renderSkinPreview}
            />
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="shrink-0 flex gap-2 w-full max-w-md sm:hidden">
        <button
          onPointerDown={(e) => { e.preventDefault(); keysRef.current.add('ArrowLeft'); }}
          onPointerUp={() => { keysRef.current.delete('ArrowLeft'); }}
          onPointerLeave={() => { keysRef.current.delete('ArrowLeft'); }}
          className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg active:scale-[0.97] transition-all"
        >
          ←
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); togglePause(); }}
          className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 font-semibold text-sm active:scale-[0.97] transition-all"
        >
          ⏸
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); keysRef.current.add('ArrowRight'); }}
          onPointerUp={() => { keysRef.current.delete('ArrowRight'); }}
          onPointerLeave={() => { keysRef.current.delete('ArrowRight'); }}
          className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg active:scale-[0.97] transition-all"
        >
          →
        </button>
      </div>
    </div>
  );
}
