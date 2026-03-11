'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  maxTile,
  move,
  keepPlaying as engineKeepPlaying,
} from './engine';
import type { Direction, GameState, Tile } from './types';
import { useAchievements } from '@/hooks/useAchievements';
import { useI18n } from '@/components/providers/LanguageProvider';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useSwipe } from '@/hooks/useSwipe';

// ── Best-score persistence ────────────────────────────────────────────────────

const BEST_KEY = 'webgames:2048:best';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(score: number) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
}

// ── Tile visual helpers ───────────────────────────────────────────────────────

const TILE_COLORS: Record<number, string> = {
  2:    'bg-zinc-600 text-zinc-50',
  4:    'bg-zinc-500 text-zinc-50',
  8:    'bg-amber-600 text-white',
  16:   'bg-amber-500 text-white',
  32:   'bg-orange-500 text-white',
  64:   'bg-orange-600 text-white',
  128:  'bg-yellow-500 text-zinc-900',
  256:  'bg-yellow-400 text-zinc-900',
  512:  'bg-emerald-600 text-white',
  1024: 'bg-emerald-500 text-white',
  2048: 'bg-indigo-500 text-white',
};

function tileClasses(value: number): string {
  const color = TILE_COLORS[value] ?? 'bg-rose-600 text-white';
  const fsize = value >= 1024 ? 'text-base' : value >= 128 ? 'text-xl' : 'text-2xl';
  return `${color} ${fsize} font-black`;
}

// ── Animated tile ─────────────────────────────────────────────────────────────

/**
 * Layout constants must match the board's Tailwind classes exactly:
 *   p-3   → 12 px padding on each side
 *   gap-2 → 8 px gap between cells
 *   4 columns → 3 internal gaps
 *
 * Cell size = (containerWidth − 2×PAD − 3×GAP) / 4
 * Cell left = PAD + col × (cellSize + GAP)       (same formula for top; container is square)
 */
const PAD   = 12;
const GAP   = 8;
const INNER = `100% - ${2 * PAD + 3 * GAP}px`; // 100% - 48px

function cellOffset(n: number): string {
  return `calc(${PAD}px + ${n} * ((${INNER}) / 4 + ${GAP}px))`;
}

function TileView({ tile }: { tile: Tile }) {
  const anim =
    tile.isNew    ? 'tile-pop  150ms ease-out both' :
    tile.isMerged ? 'tile-bump 120ms ease-out both' :
    undefined;

  return (
    <div
      className={`absolute rounded-lg flex items-center justify-center select-none tabular-nums ${tileClasses(tile.value)}`}
      style={{
        left:        cellOffset(tile.col),
        top:         cellOffset(tile.row),
        width:       `calc((${INNER}) / 4)`,
        aspectRatio: '1',
        transition:  'left 100ms ease, top 100ms ease',
        animation:   anim,
      }}
    >
      {tile.value}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Game2048() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('2048');
  const pb = usePersonalScores('2048', user ? { userId: user.id, nickname } : undefined);

  // Initialise with best=0 to avoid SSR/hydration mismatch;
  // the real persisted value is loaded after first mount.
  const [state, setState] = useState<GameState>(() => createInitialState(0));

  // Timing / dedup refs
  const startTimeRef = useRef<number>(Date.now());
  const savedRef     = useRef<boolean>(false);

  // ── Load persisted data on mount ────────────────────────────────────────────
  useEffect(() => {
    const savedBest = loadBest();
    if (savedBest > 0) {
      setState((prev) => ({ ...prev, best: Math.max(prev.best, savedBest) }));
    }
  }, []);

  // ── Persist best whenever it improves ───────────────────────────────────────
  useEffect(() => {
    saveBest(state.best);
  }, [state.best]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.moves === 1) ach.trackPlay();
    if (state.status === 'won') ach.trackWin();
  }, [state.moves, state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save score when the game ends ───────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'over' && !savedRef.current) {
      savedRef.current = true;
      pb.submit(state.score, { maxTile: maxTile(state.grid), moves: state.moves });
    }
  }, [state.status, state.score, state.moves, state.grid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleMove = useCallback((dir: Direction) => {
    setState((prev) => move(prev, dir));
  }, []);

  const handleNewGame = useCallback(() => {
    startTimeRef.current = Date.now();
    savedRef.current     = false;
    setState((prev) => createInitialState(prev.best));
    ach.reset();
  }, [ach]);

  // ── Keyboard controls ────────────────────────────────────────────────────────
  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      W: 'up', S: 'down', A: 'left', D: 'right',
    };
    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      handleMove(dir);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMove]);

  // ── Swipe (mobile) ──────────────────────────────────────────────────────────
  const swipeHandlers = useSwipe({ onSwipe: handleMove });

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4">

      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] flex items-center gap-3">
        <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">{t('game.name.2048')}</span>

        <ScoreBox label={t('game.score')} value={state.score} />
        <ScoreBox label={t('game.best')}  value={state.best} />

        <button
          onClick={handleNewGame}
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
        >
          {t('game.new')}
        </button>
      </div>

      {/* ── Board ────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[420px] touch-none" {...swipeHandlers}>

        {/* Background: static empty cell grid */}
        <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/60">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-zinc-800/80" />
          ))}
        </div>

        {/* Animated tile layer */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          {state.tiles.map(tile => (
            <TileView key={tile.id} tile={tile} />
          ))}
        </div>

        {/* Game over overlay */}
        {state.status === 'over' && (
          <Overlay>
            <p className="text-2xl font-black text-zinc-100">{t('game.over')}</p>
            <p className="text-sm text-zinc-400">{t('game.score')}: {state.score.toLocaleString()}</p>
            <button
              onClick={handleNewGame}
              className="mt-1 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              {t('game.newGame')}
            </button>
          </Overlay>
        )}

        {/* Win overlay */}
        {state.status === 'won' && (
          <Overlay tint="indigo">
            <p className="text-2xl font-black text-indigo-200">{t('game.reached2048')}</p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setState(engineKeepPlaying)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                {t('game.keepPlaying')}
              </button>
              <button
                onClick={handleNewGame}
                className="px-4 py-2 rounded-lg border border-indigo-700 text-indigo-300 hover:text-indigo-100 text-sm font-semibold transition-colors"
              >
                {t('game.newGame')}
              </button>
            </div>
          </Overlay>
        )}
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600 text-center max-w-[320px]">
        {t('2048.controls')}
      </p>

      {/* ── Personal best list ───────────────────────────────────────── */}
      <ScoreboardPanel
        gameId="2048"
        scores={pb.scores}
        lastInsertId={pb.lastInsertId}
        isNewBest={pb.isNewBest}
        onClear={pb.clear}
      />

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function Overlay({
  children,
  tint = 'zinc',
}: {
  children: React.ReactNode;
  tint?: 'zinc' | 'indigo';
}) {
  const bg = tint === 'indigo' ? 'bg-indigo-950/85' : 'bg-zinc-950/85';
  return (
    <div
      className={`absolute inset-0 rounded-xl ${bg} flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10`}
    >
      {children}
    </div>
  );
}

