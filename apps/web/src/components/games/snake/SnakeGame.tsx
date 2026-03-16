'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, changeDirection, step, TICK_MS, GRID_SIZES } from './engine';
import type { Direction, GameState, GridSize, SnakeMode } from './types';
import { useAchievements } from '@/hooks/useAchievements';
import { useI18n } from '@/components/providers/LanguageProvider';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useSwipe } from '@/hooks/useSwipe';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import TouchControls from '@/components/ui/TouchControls';
import { useSkinShop } from '@/hooks/useSkinShop';
import { SkinShopOverlay } from '@/components/ui/SkinShopOverlay';
import type { SkinDef } from '@/lib/skinShop';
import * as sfx from './sound';

// ── Cosmic skin CSS animations ──────────────────────────────────────────────────

const COSMIC_STYLES = `
@keyframes cosmic-head-pulse {
  0%, 100% { box-shadow: 0 0 8px #818cf8, 0 0 16px #6366f1, 0 0 28px #7c3aed88, 0 0 40px #4f46e544; }
  50% { box-shadow: 0 0 12px #a78bfa, 0 0 24px #818cf8, 0 0 36px #7c3aedaa, 0 0 52px #4f46e566; }
}
@keyframes cosmic-body-shimmer {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes cosmic-food-glow {
  0%, 100% { box-shadow: 0 0 6px #fbbf24, 0 0 14px #f59e0b88, 0 0 22px #d9770644; }
  50% { box-shadow: 0 0 10px #fde68a, 0 0 20px #fbbf24aa, 0 0 30px #f59e0b66; }
}
`;

// Cosmic body colors for multi-color shimmer
const COSMIC_BODY_COLORS = ['#6366f1', '#7c3aed', '#818cf8', '#a78bfa', '#6366f1'];
const COSMIC_BODY_GRADIENT = `linear-gradient(90deg, ${COSMIC_BODY_COLORS.join(', ')})`;

// ── Snake skins ─────────────────────────────────────────────────────────────────

const SNAKE_SKINS: SkinDef[] = [
  { id: 'classic',  price: 0,   nameKey: 'snake.skin.classic',  colors: { head: '#34d399', body: '#059669', bodyAlt: '#047857', food: '#f43f5e', glow: '#34d399' } },
  { id: 'ice',      price: 15,  nameKey: 'snake.skin.ice',      colors: { head: '#67e8f9', body: '#06b6d4', bodyAlt: '#0891b2', food: '#f97316', glow: '#67e8f9' } },
  { id: 'berry',    price: 15,  nameKey: 'snake.skin.berry',    colors: { head: '#f472b6', body: '#db2777', bodyAlt: '#be185d', food: '#a3e635', glow: '#f472b6' } },
  { id: 'ocean',    price: 25,  nameKey: 'snake.skin.ocean',    colors: { head: '#60a5fa', body: '#2563eb', bodyAlt: '#1d4ed8', food: '#fbbf24', glow: '#60a5fa' } },
  { id: 'sunset',   price: 30,  nameKey: 'snake.skin.sunset',   colors: { head: '#fb923c', body: '#ea580c', bodyAlt: '#c2410c', food: '#818cf8', glow: '#fb923c' } },
  { id: 'neon',     price: 40,  nameKey: 'snake.skin.neon',     colors: { head: '#a3e635', body: '#65a30d', bodyAlt: '#4d7c0f', food: '#e879f9', glow: '#a3e635' } },
  { id: 'venom',    price: 60,  nameKey: 'snake.skin.venom',    colors: { head: '#c084fc', body: '#9333ea', bodyAlt: '#7e22ce', food: '#fbbf24', glow: '#c084fc' } },
  { id: 'lava',     price: 80,  nameKey: 'snake.skin.lava',     colors: { head: '#f87171', body: '#dc2626', bodyAlt: '#b91c1c', food: '#fef08a', glow: '#f87171' } },
  { id: 'rainbow',  price: 120, nameKey: 'snake.skin.rainbow',  colors: { head: '#f472b6', body: '#a78bfa', bodyAlt: '#60a5fa', food: '#fbbf24', glow: '#f472b6' } },
  { id: 'cosmic',   price: 200, nameKey: 'snake.skin.cosmic',   colors: { head: '#e0e7ff', body: '#6366f1', bodyAlt: '#4f46e5', food: '#fbbf24', glow: '#818cf8' }, requireAll: true },
];

// ── Skin preview renderer (for SkinShopOverlay canvas) ──────────────────────

function renderSnakePreview(ctx: CanvasRenderingContext2D, skin: SkinDef, size: number) {
  const c = skin.colors;
  const s = size;
  const r = s * 0.12; // corner radius
  const isCosmic = skin.id === 'cosmic';

  // Cosmic: draw aura/glow behind entire snake
  if (isCosmic) {
    ctx.save();
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = s * 0.18;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    roundRect(ctx, s * 0.04, s * 0.46, s * 0.88, s * 0.42, r);
    ctx.restore();

    // Sparkle dots
    const sparkles = [
      { x: 0.14, y: 0.38, r: 0.025, a: 0.9 },
      { x: 0.45, y: 0.42, r: 0.02, a: 0.7 },
      { x: 0.72, y: 0.40, r: 0.03, a: 1.0 },
      { x: 0.90, y: 0.48, r: 0.02, a: 0.6 },
      { x: 0.30, y: 0.88, r: 0.02, a: 0.8 },
      { x: 0.60, y: 0.90, r: 0.015, a: 0.5 },
      { x: 0.85, y: 0.86, r: 0.025, a: 0.7 },
    ];
    for (const sp of sparkles) {
      ctx.fillStyle = `rgba(224, 231, 255, ${sp.a})`;
      ctx.beginPath();
      ctx.arc(s * sp.x, s * sp.y, s * sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cosmic body uses gradient colors
  const cosmicBodyColors = ['#a78bfa', '#6366f1', '#7c3aed'];

  // Body segment 3 (furthest back)
  ctx.fillStyle = isCosmic ? cosmicBodyColors[2] : c.bodyAlt;
  if (isCosmic) { ctx.save(); ctx.shadowColor = '#7c3aed'; ctx.shadowBlur = s * 0.08; }
  roundRect(ctx, s * 0.08, s * 0.55, s * 0.22, s * 0.22, r * 0.6);
  if (isCosmic) ctx.restore();

  // Body segment 2
  ctx.fillStyle = isCosmic ? cosmicBodyColors[1] : c.body;
  if (isCosmic) { ctx.save(); ctx.shadowColor = '#818cf8'; ctx.shadowBlur = s * 0.08; }
  roundRect(ctx, s * 0.24, s * 0.55, s * 0.22, s * 0.22, r * 0.6);
  if (isCosmic) ctx.restore();

  // Body segment 1
  ctx.fillStyle = isCosmic ? cosmicBodyColors[0] : c.bodyAlt;
  if (isCosmic) { ctx.save(); ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = s * 0.08; }
  roundRect(ctx, s * 0.40, s * 0.55, s * 0.22, s * 0.22, r * 0.6);
  if (isCosmic) ctx.restore();

  // Head
  if (isCosmic) { ctx.save(); ctx.shadowColor = '#e0e7ff'; ctx.shadowBlur = s * 0.15; }
  ctx.fillStyle = c.head;
  roundRect(ctx, s * 0.56, s * 0.50, s * 0.32, s * 0.32, r);
  if (isCosmic) ctx.restore();

  // Eyes on head
  ctx.fillStyle = '#18181b';
  const eyeR = s * 0.05;
  ctx.beginPath();
  ctx.arc(s * 0.78, s * 0.58, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.78, s * 0.74, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Food
  if (isCosmic) { ctx.save(); ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = s * 0.15; }
  ctx.fillStyle = c.food;
  ctx.beginPath();
  ctx.arc(s * 0.25, s * 0.28, s * 0.10, 0, Math.PI * 2);
  ctx.fill();
  if (isCosmic) ctx.restore();

  // Food highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(s * 0.22, s * 0.25, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  ctx.fill();
}

// ── Best-score persistence ─────────────────────────────────────────────────────

const BEST_KEY = 'webgames.snake.bestScore';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(score: number) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
}

// ── Phase ──────────────────────────────────────────────────────────────────────

type Phase = 'config' | 'countdown' | 'running' | 'paused' | 'over';

// ── Last run ───────────────────────────────────────────────────────────────────

type LastRun = { score: number; moves: number; durationSec: number };

// ── Cell data ──────────────────────────────────────────────────────────────────

type CellData =
  | { kind: 'head' }
  | { kind: 'body'; idx: number }
  | { kind: 'food' }
  | { kind: 'empty' };

// ── Visual helpers ─────────────────────────────────────────────────────────────

function cellStyle(data: CellData, colors: Record<string, string>, isCosmic: boolean): { className: string; style?: React.CSSProperties } {
  if (isCosmic) {
    switch (data.kind) {
      case 'head': return {
        className: 'rounded-md',
        style: {
          backgroundColor: colors.head,
          animation: 'cosmic-head-pulse 1.8s ease-in-out infinite',
        },
      };
      case 'body': {
        // Cycle through multiple cosmic colors for a nebula effect
        const cosmicPalette = ['#6366f1', '#7c3aed', '#818cf8', '#a78bfa', '#4f46e5', '#c4b5fd'];
        const colorIdx = data.idx % cosmicPalette.length;
        return {
          className: 'rounded-sm',
          style: {
            background: COSMIC_BODY_GRADIENT,
            backgroundSize: '200% 100%',
            animation: `cosmic-body-shimmer ${2 + (data.idx % 3) * 0.5}s linear infinite`,
            // Offset the animation start per segment for a wave effect
            animationDelay: `${-data.idx * 0.15}s`,
            // Fallback color
            backgroundColor: cosmicPalette[colorIdx],
            boxShadow: `0 0 4px ${cosmicPalette[colorIdx]}66`,
          },
        };
      }
      default: return { className: 'bg-zinc-900/70 rounded-sm' };
    }
  }

  switch (data.kind) {
    case 'head': return { className: 'rounded-md', style: { backgroundColor: colors.head, boxShadow: `0 0 6px ${colors.glow}44` } };
    case 'body': return { className: 'rounded-sm', style: { backgroundColor: data.idx % 2 === 0 ? colors.body : colors.bodyAlt } };
    default:     return { className: 'bg-zinc-900/70 rounded-sm' };
  }
}

/**
 * Eye position classes per movement direction.
 * All values are literal Tailwind arbitrary-value strings so JIT generates them.
 */
const EYE_POS: Record<Direction, [string, string]> = {
  right: ['top-[22%] right-[18%]', 'bottom-[22%] right-[18%]'],
  left:  ['top-[22%] left-[18%]',  'bottom-[22%] left-[18%]'],
  up:    ['top-[18%] left-[22%]',  'top-[18%] right-[22%]'],
  down:  ['bottom-[18%] left-[22%]', 'bottom-[18%] right-[22%]'],
};

function HeadEyes({ dir }: { dir: Direction }) {
  const [p1, p2] = EYE_POS[dir];
  return (
    <>
      <div className={`absolute w-[26%] h-[26%] rounded-full bg-zinc-900 ${p1}`} />
      <div className={`absolute w-[26%] h-[26%] rounded-full bg-zinc-900 ${p2}`} />
    </>
  );
}

/**
 * Glossy food circle.
 * The `snake-food` CSS class (defined in globals.css) plays a bounce-in
 * animation once, then pulses indefinitely.
 * Remounting the cell when food moves to a new position re-triggers the animation.
 */
function FoodVisual({ color, isCosmic }: { color: string; isCosmic: boolean }) {
  return (
    <div
      className="absolute inset-[10%] rounded-full snake-food"
      style={{
        backgroundColor: color,
        ...(isCosmic ? { animation: 'cosmic-food-glow 1.5s ease-in-out infinite' } : {}),
      }}
    >
      {/* glossy highlight */}
      <div className="absolute top-[10%] left-[10%] w-[32%] h-[32%] rounded-full bg-white/40" />
      {/* cosmic inner ring */}
      {isCosmic && (
        <div className="absolute inset-[15%] rounded-full border border-white/30" />
      )}
    </div>
  );
}

// ── Mode descriptions ─────────────────────────────────────────────────────────

const MODE_OPTIONS: SnakeMode[] = ['classic', 'no_walls', 'speed'];
const GRID_OPTIONS: GridSize[] = ['small', 'medium', 'large'];

// ── Component ──────────────────────────────────────────────────────────────────

export function SnakeGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('snake');
  const pb = usePersonalScores('snake', user ? { userId: user.id, nickname } : undefined);
  const shop = useSkinShop('snake', SNAKE_SKINS);
  const skinColors = shop.activeSkinDef.colors;
  const isCosmicSkin = shop.activeSkin === 'cosmic';
  const coinsRef = useRef(0);

  // Config state
  const [selectedMode, setSelectedMode] = useState<SnakeMode>('classic');
  const [selectedGrid, setSelectedGrid] = useState<GridSize>('medium');

  const [state, setState]           = useState<GameState>(() => createInitialState(0));
  const [phase, setPhase]           = useState<Phase>('config');
  const [cdNum, setCdNum]           = useState(3); // 3 → 2 → 1 → 0 (displayed as "GO")

  // Stable ref so the keyboard handler (registered once) always reads current phase
  const phaseRef     = useRef<Phase>('config');
  const startTimeRef = useRef<number>(0);
  const savedRef     = useRef<boolean>(false);
  const prevScoreRef = useRef<number>(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const togglePause = useCallback(() => {
    setPhase(p => {
      if (p === 'running') { phaseRef.current = 'paused'; return 'paused'; }
      if (p === 'paused') { phaseRef.current = 'running'; return 'running'; }
      return p;
    });
  }, []);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'running', togglePause);

  // Gentle speed scaling
  const speedLevel = Math.floor(state.score / 10);

  // ── Load persisted data on mount ─────────────────────────────────────────────
  useEffect(() => {
    const saved = loadBest();
    if (saved > 0) setState(prev => ({ ...prev, best: Math.max(prev.best, saved) }));
  }, []);

  // ── Persist best ─────────────────────────────────────────────────────────────
  useEffect(() => { saveBest(state.best); }, [state.best]);

  // ── Start game from config ──────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    const gridSize = GRID_SIZES[selectedGrid];
    setState(prev => createInitialState(prev.best, gridSize, selectedMode));
    setCdNum(3);
    savedRef.current = false;
    coinsRef.current = 0;
    setPhase('countdown');
  }, [selectedMode, selectedGrid]);

  // ── Countdown: 3 → 2 → 1 → GO → running ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    setCdNum(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n >= 0) {
        setCdNum(n);
      } else {
        clearInterval(id);
        startTimeRef.current = Date.now(); // start timing when game actually begins
        setPhase('running');
      }
    }, 950);
    return () => clearInterval(id);
  }, [phase]);

  // ── Game loop (restarts only when speed level steps up) ───────────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    let tickMs: number;
    if (state.mode === 'speed') {
      tickMs = Math.max(60, 100 - speedLevel * 8);
    } else {
      tickMs = Math.max(100, TICK_MS - speedLevel * 5);
    }
    const id = setInterval(() => setState(prev => step(prev)), tickMs);
    return () => clearInterval(id);
  }, [phase, speedLevel, state.mode]);

  // ── Sound: eat / bonus ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') { prevScoreRef.current = state.score; return; }
    if (state.score > prevScoreRef.current) {
      coinsRef.current += (state.score - prevScoreRef.current);
      // Speed mode milestone every 10 points
      if (state.mode === 'speed' && state.score % 10 === 0) {
        sfx.bonusSound();
      } else {
        sfx.eatSound();
      }
    }
    prevScoreRef.current = state.score;
  }, [state.score, phase, state.mode]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'running') ach.trackPlay();
    if (phase === 'countdown') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Achievement flag tracking ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    if (state.score >= 25) ach.trackEvent({ type: 'flag', key: 'snake_score_25' });
    if (state.score >= 50) ach.trackEvent({ type: 'flag', key: 'snake_score_50' });
  }, [state.score, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transition to over ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'over') {
      setPhase(p => {
        if (p === 'running') { sfx.gameOverSound(); return 'over'; }
        return p;
      });
    }
  }, [state.status]);

  // ── Save score when game ends ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'over' || savedRef.current) return;
    savedRef.current = true;
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    pb.submit(state.score, { moves: state.moves, durationSec });
    if (coinsRef.current > 0) shop.addCoins(coinsRef.current);
  }, [phase, state.score, state.moves]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard (registered once; reads phaseRef to avoid stale closures) ────────
  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: 'up',   ArrowDown:  'down',
      ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up',  s: 'down',  a: 'left',  d: 'right',
      W: 'up',  S: 'down',  A: 'left',  D: 'right',
    };
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
        return;
      }
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      if (phaseRef.current === 'over' || phaseRef.current === 'paused' || phaseRef.current === 'config') return;
      setState(prev => {
        const next = changeDirection(prev, dir);
        if (next.direction !== prev.direction) sfx.turnSound();
        return next;
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePause]);

  // ── Swipe (mobile) ─────────────────────────────────────────────────────────
  const swipeHandlers = useSwipe({
    onSwipe: useCallback((dir: Direction) => {
      if (phaseRef.current === 'over' || phaseRef.current === 'config') return;
      setState(prev => {
        const next = changeDirection(prev, dir);
        if (next.direction !== prev.direction) sfx.turnSound();
        return next;
      });
    }, []),
  });

  // ── Restart ───────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setPhase('config');
  }, []);

  // ── Mode i18n keys ──────────────────────────────────────────────────────────
  const modeKeys: Record<SnakeMode, string> = {
    classic:  'snake.mode.classic',
    no_walls: 'snake.mode.noWalls',
    speed:    'snake.mode.speed',
  };
  const gridKeys: Record<GridSize, string> = {
    small:  'snake.gridSize.small',
    medium: 'snake.gridSize.medium',
    large:  'snake.gridSize.large',
  };

  // ── Build cell map ─────────────────────────────────────────────────────────────
  const gridSize = state.gridSize;
  const cellMap = new Map<string, CellData>();
  state.snake.forEach((seg, i) => {
    cellMap.set(
      `${seg.x},${seg.y}`,
      i === 0 ? { kind: 'head' } : { kind: 'body', idx: i },
    );
  });
  cellMap.set(`${state.food.x},${state.food.y}`, { kind: 'food' });

  // Config screen
  if (phase === 'config') {
    return (
      <div className="relative w-full flex-1 min-h-0">
        <div className="flex flex-col items-center gap-3 py-2 px-4 flex-1 min-w-0">
          {/* Header */}
          <div className="w-full max-w-[420px] flex items-center gap-3">
            <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">{t('game.name.snake')}</span>
            <button
              onClick={() => shop.setShowShop(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-800/30 text-amber-400 font-bold text-sm hover:bg-amber-950/60 transition-colors"
            >
              <span className="text-base">●</span> {shop.wallet}
            </button>
            <ScoreBox label={t('game.best')} value={state.best} />
          </div>

          {/* Skin shop overlay */}
          {shop.showShop && (
            <div className="w-full max-w-[420px] relative" style={{ minHeight: 420 }}>
              <SkinShopOverlay
                skins={SNAKE_SKINS}
                wallet={shop.wallet}
                owned={shop.owned}
                activeSkin={shop.activeSkin}
                onBuy={shop.buy}
                onEquip={shop.equip}
                onClose={() => shop.setShowShop(false)}
                renderPreview={renderSnakePreview}
              />
            </div>
          )}

          {/* Config card */}
          <div className="w-full max-w-[420px] rounded-xl bg-zinc-800 border border-zinc-700/60 shadow-lg shadow-black/30 p-6 flex flex-col gap-6">

            {/* Mode selector */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{t('snake.mode')}</span>
              <div className="grid grid-cols-3 gap-2">
                {MODE_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMode(m)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      selectedMode === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {t(modeKeys[m])}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 min-h-[2rem]">
                {selectedMode === 'classic' && t('snake.mode.classic.desc')}
                {selectedMode === 'no_walls' && t('snake.mode.noWalls.desc')}
                {selectedMode === 'speed' && t('snake.mode.speed.desc')}
              </p>
            </div>

            {/* Grid size selector */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{t('snake.gridSize')}</span>
              <div className="grid grid-cols-3 gap-2">
                {GRID_OPTIONS.map(g => (
                  <button
                    key={g}
                    onClick={() => setSelectedGrid(g)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      selectedGrid === g
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {t(gridKeys[g])}
                  </button>
                ))}
              </div>
            </div>

            {/* Start + Shop buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleStart}
                className="flex-1 py-3 rounded-lg text-white text-lg font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: skinColors.body }}
              >
                {t('snake.start')}
              </button>
              <button
                onClick={() => shop.setShowShop(true)}
                className="px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-lg transition-colors"
              >
                {t('skinShop.title')}
              </button>
            </div>
          </div>

          {/* Personal best list (mobile only) */}
          <div className="lg:hidden">
            <ScoreboardPanel
              gameId="snake"
              scores={pb.scores}
              lastInsertId={pb.lastInsertId}
              isNewBest={pb.isNewBest}
              onClear={pb.clear}
            />
          </div>
        </div>

        {/* ── Sidebar scoreboard (desktop only) ──────────────────────── */}
        <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
          <div className="flex flex-col gap-3">
            <ScoreboardPanel
              gameId="snake"
              scores={pb.scores}
              lastInsertId={pb.lastInsertId}
              isNewBest={pb.isNewBest}
              onClear={pb.clear}
            />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="relative w-full flex-1 min-h-0">
      <div className="flex flex-col items-center gap-3 py-2 px-4 flex-1 min-w-0">
        {/* Cosmic skin CSS animations */}
        {isCosmicSkin && <style dangerouslySetInnerHTML={{ __html: COSMIC_STYLES }} />}

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="w-full max-w-[420px] flex items-center gap-3">
          <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">{t('game.name.snake')}</span>
          <ScoreBox label={t('game.score')} value={state.score} />
          <ScoreBox label={t('game.best')}  value={state.best} />
          <button
            onClick={handleRestart}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
          >
            {t('game.new')}
          </button>
        </div>

        {/* ── Board ────────────────────────────────────────────────────── */}
        <div className="relative w-full max-w-[420px] touch-none" {...swipeHandlers}>
          <div
            className="p-2 rounded-xl bg-zinc-800 border border-zinc-700/60 shadow-lg shadow-black/30"
            style={{
              display:             'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gap:                 gridSize > 20 ? '0.5px' : '1px',
            }}
          >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const x      = i % gridSize;
              const y      = Math.floor(i / gridSize);
              const posKey = `${x},${y}`;
              const data   = cellMap.get(posKey) ?? { kind: 'empty' as const };

              const cs = cellStyle(data, skinColors, isCosmicSkin);
              return (
                <div
                  key={`${posKey}-${data.kind}`}
                  className={`aspect-square relative ${cs.className}`}
                  style={cs.style}
                >
                  {data.kind === 'head' && <HeadEyes dir={state.direction} />}
                  {data.kind === 'food' && <FoodVisual color={skinColors.food} isCosmic={isCosmicSkin} />}
                </div>
              );
            })}
          </div>

          {/* Countdown overlay */}
          {phase === 'countdown' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/75 flex items-center justify-center z-20 cd-overlay backdrop-blur-[1px]">
              <span
                key={cdNum}
                className={`cd-number font-black select-none ${
                  cdNum === 0 ? 'text-5xl text-emerald-400' : 'text-7xl text-zinc-100'
                }`}
              >
                {cdNum === 0 ? t('game.go') : cdNum}
              </span>
            </div>
          )}

          {/* Pause overlay */}
          {phase === 'paused' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/80 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
              <p className="text-2xl font-black text-zinc-100">{t('game.paused')}</p>
              <p className="text-sm text-zinc-500">{t('tetris.pressP')}</p>
              <button
                onClick={togglePause}
                className="mt-1 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Game-over overlay */}
          {phase === 'over' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/85 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
              <p className="text-2xl font-black text-zinc-100">{t('game.over')}</p>
              <p className="text-sm text-zinc-400">{t('game.score')}: {state.score}</p>
              {state.score > 0 && (
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                  <span className="text-base">●</span> +{state.score}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleRestart}
                  className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                >
                  {t('game.playAgain')}
                </button>
                <button
                  onClick={() => { handleRestart(); setTimeout(() => shop.setShowShop(true), 0); }}
                  className="px-4 py-2 rounded-lg bg-amber-950/60 border border-amber-800/30 text-amber-400 text-sm font-semibold hover:bg-amber-950/80 transition-colors"
                >
                  {t('skinShop.title')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Mode badge ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">{t(modeKeys[state.mode])}</span>
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">{gridSize}&times;{gridSize}</span>
        </div>

        {/* ── Mobile touch controls ────────────────────────────────────── */}
        <TouchControls
          layout="dpad"
          disabled={phase !== 'running' && phase !== 'countdown'}
          extraButtons={[{ label: phase === 'paused' ? t('game.resume') : t('game.paused'), onPress: togglePause }]}
        />

        {/* ── Hint ─────────────────────────────────────────────────────── */}
        <p className="text-xs text-zinc-600 text-center max-w-[320px] max-sm:hidden">
          {t('snake.controls')}
        </p>

        {/* ── Personal best list (mobile only) ───────────────────────── */}
        <div className="lg:hidden">
          <ScoreboardPanel
            gameId="snake"
            scores={pb.scores}
            lastInsertId={pb.lastInsertId}
            isNewBest={pb.isNewBest}
            onClear={pb.clear}
          />
        </div>

      </div>

      {/* ── Sidebar scoreboard (desktop only) ──────────────────────── */}
      <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
        <div className="flex flex-col gap-3">
          <ScoreboardPanel
            gameId="snake"
            scores={pb.scores}
            lastInsertId={pb.lastInsertId}
            isNewBest={pb.isNewBest}
            onClear={pb.clear}
          />
        </div>
      </aside>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center min-w-[64px] px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
      <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase leading-none mb-0.5">
        {label}
      </span>
      <span className="text-lg font-black text-zinc-100 tabular-nums leading-tight">
        {value.toLocaleString()}
      </span>
    </div>
  );
}
