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
import * as sfx from './sound';

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

function cellClass(data: CellData): string {
  switch (data.kind) {
    case 'head': return 'bg-emerald-400 rounded-md';
    case 'body': return `${data.idx % 2 === 0 ? 'bg-emerald-600' : 'bg-emerald-700'} rounded-sm`;
    default:     return 'bg-zinc-900/70 rounded-sm'; // food + empty share background
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
function FoodVisual() {
  return (
    <div className="absolute inset-[10%] rounded-full bg-rose-500 snake-food">
      {/* glossy highlight */}
      <div className="absolute top-[10%] left-[10%] w-[32%] h-[32%] rounded-full bg-rose-200/60" />
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
      <div className="flex flex-col items-center gap-5 py-6 px-4">
        {/* Header */}
        <div className="w-full max-w-[420px] flex items-center gap-3">
          <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">{t('game.name.snake')}</span>
          <ScoreBox label={t('game.best')} value={state.best} />
        </div>

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

          {/* Start button */}
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold transition-colors"
          >
            {t('snake.start')}
          </button>
        </div>

        {/* Personal best list */}
        <ScoreboardPanel
          gameId="snake"
          scores={pb.scores}
          lastInsertId={pb.lastInsertId}
          isNewBest={pb.isNewBest}
          onClear={pb.clear}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4">

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

            return (
              <div
                key={`${posKey}-${data.kind}`}
                className={`aspect-square relative ${cellClass(data)}`}
              >
                {data.kind === 'head' && <HeadEyes dir={state.direction} />}
                {data.kind === 'food' && <FoodVisual />}
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
            <button
              onClick={handleRestart}
              className="mt-1 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              {t('game.playAgain')}
            </button>
          </div>
        )}
      </div>

      {/* ── Mode badge ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">{t(modeKeys[state.mode])}</span>
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">{gridSize}&times;{gridSize}</span>
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600 text-center max-w-[320px]">
        {t('snake.controls')}
      </p>

      {/* ── Personal best list ───────────────────────────────────────── */}
      <ScoreboardPanel
        gameId="snake"
        scores={pb.scores}
        lastInsertId={pb.lastInsertId}
        isNewBest={pb.isNewBest}
        onClear={pb.clear}
      />

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
