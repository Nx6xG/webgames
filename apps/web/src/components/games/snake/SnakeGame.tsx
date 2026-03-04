'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, changeDirection, step, GRID_SIZE, TICK_MS } from './engine';
import type { Direction, GameState, SnakeHighscoreEntry } from './types';

// ── Best-score persistence ─────────────────────────────────────────────────────

const BEST_KEY = 'webgames.snake.bestScore';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(score: number) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
}

// ── Highscore persistence ──────────────────────────────────────────────────────

const HS_KEY = 'webgames.snake.highscores';

function loadHighscores(): SnakeHighscoreEntry[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    return raw ? (JSON.parse(raw) as SnakeHighscoreEntry[]) : [];
  } catch { return []; }
}

/** Inserts an entry, re-sorts by score descending, trims to top 50, saves. */
function addHighscore(entry: SnakeHighscoreEntry): SnakeHighscoreEntry[] {
  const next = [...loadHighscores(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  try { localStorage.setItem(HS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function deleteHighscores() {
  try { localStorage.removeItem(HS_KEY); } catch {}
}

// ── Phase ──────────────────────────────────────────────────────────────────────

type Phase = 'countdown' | 'running' | 'over';

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

// ── Component ──────────────────────────────────────────────────────────────────

export function SnakeGame() {
  const [state, setState]           = useState<GameState>(() => createInitialState(0));
  const [phase, setPhase]           = useState<Phase>('countdown');
  const [cdNum, setCdNum]           = useState(3); // 3 → 2 → 1 → 0 (displayed as "GO")
  const [highscores, setHighscores] = useState<SnakeHighscoreEntry[]>([]);
  const [lastRun, setLastRun]       = useState<LastRun | null>(null);

  // Stable ref so the keyboard handler (registered once) always reads current phase
  const phaseRef    = useRef<Phase>('countdown');
  const startTimeRef = useRef<number>(0);
  const savedRef     = useRef<boolean>(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Gentle speed scaling: base 160 ms, −5 ms per 10 food eaten, floor 100 ms
  const speedLevel = Math.floor(state.score / 10);

  // ── Load persisted data on mount ─────────────────────────────────────────────
  useEffect(() => {
    const saved = loadBest();
    if (saved > 0) setState(prev => ({ ...prev, best: Math.max(prev.best, saved) }));
    setHighscores(loadHighscores());
  }, []);

  // ── Persist best ─────────────────────────────────────────────────────────────
  useEffect(() => { saveBest(state.best); }, [state.best]);

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
    const tickMs = Math.max(100, TICK_MS - speedLevel * 5);
    const id = setInterval(() => setState(prev => step(prev)), tickMs);
    return () => clearInterval(id);
  }, [phase, speedLevel]);

  // ── Transition to over ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'over') {
      setPhase(p => p === 'running' ? 'over' : p);
    }
  }, [state.status]);

  // ── Save highscore when game ends ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'over' || savedRef.current) return;
    savedRef.current = true;
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    const entry: SnakeHighscoreEntry = {
      id:          Date.now().toString(),
      score:       state.score,
      date:        Date.now(),
      moves:       state.moves,
      durationSec,
      grid:        `${GRID_SIZE}x${GRID_SIZE}`,
    };
    setLastRun({ score: state.score, moves: state.moves, durationSec });
    setHighscores(addHighscore(entry));
  }, [phase, state.score, state.moves]);

  // ── Keyboard (registered once; reads phaseRef to avoid stale closures) ────────
  useEffect(() => {
    const KEY_DIR: Record<string, Direction> = {
      ArrowUp: 'up',   ArrowDown:  'down',
      ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up',  s: 'down',  a: 'left',  d: 'right',
      W: 'up',  S: 'down',  A: 'left',  D: 'right',
    };
    function onKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      if (phaseRef.current === 'over') return;
      setState(prev => changeDirection(prev, dir));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Restart ───────────────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    setState(prev => createInitialState(prev.best));
    setCdNum(3);
    setPhase('countdown');
    savedRef.current = false;
  }, []);

  // ── Clear highscores ──────────────────────────────────────────────────────────
  const handleClearHighscores = useCallback(() => {
    if (!confirm('Clear all highscores?')) return;
    deleteHighscores();
    setHighscores([]);
    setLastRun(null);
  }, []);

  // ── Build cell map ─────────────────────────────────────────────────────────────
  const cellMap = new Map<string, CellData>();
  state.snake.forEach((seg, i) => {
    cellMap.set(
      `${seg.x},${seg.y}`,
      i === 0 ? { kind: 'head' } : { kind: 'body', idx: i },
    );
  });
  cellMap.set(`${state.food.x},${state.food.y}`, { kind: 'food' });

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] flex items-center gap-3">
        <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">Snake</span>
        <ScoreBox label="SCORE" value={state.score} />
        <ScoreBox label="BEST"  value={state.best} />
        <button
          onClick={handleRestart}
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
        >
          New
        </button>
      </div>

      {/* ── Board ────────────────────────────────────────────────────── */}
      {/*
        Board is naturally square: each cell has aspect-square and gap is
        uniform in both axes, so total height == total width at any container width.
        The 1px gap shows as bg-zinc-800 lines against bg-zinc-900/70 cells.
      */}
      <div className="relative w-full max-w-[420px]">
        <div
          className="p-2 rounded-xl bg-zinc-800 border border-zinc-700/60 shadow-lg shadow-black/30"
          style={{
            display:             'grid',
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gap:                 '1px',
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
            const x      = i % GRID_SIZE;
            const y      = Math.floor(i / GRID_SIZE);
            const posKey = `${x},${y}`;
            const data   = cellMap.get(posKey) ?? { kind: 'empty' as const };

            return (
              <div
                // Include kind in key so React remounts when cell type changes,
                // which re-triggers entrance animations (food appear, etc.)
                key={`${posKey}-${data.kind}`}
                className={`aspect-square relative ${cellClass(data)}`}
              >
                {data.kind === 'head' && <HeadEyes dir={state.direction} />}
                {data.kind === 'food' && <FoodVisual />}
              </div>
            );
          })}
        </div>

        {/* Countdown overlay — uses existing cd-pop / cd-overlay keyframes */}
        {phase === 'countdown' && (
          <div className="absolute inset-0 rounded-xl bg-zinc-950/75 flex items-center justify-center z-20 cd-overlay backdrop-blur-[1px]">
            {/* key={cdNum} remounts the span each step, replaying cd-pop */}
            <span
              key={cdNum}
              className={`cd-number font-black select-none ${
                cdNum === 0 ? 'text-5xl text-emerald-400' : 'text-7xl text-zinc-100'
              }`}
            >
              {cdNum === 0 ? 'GO' : cdNum}
            </span>
          </div>
        )}

        {/* Game-over overlay */}
        {phase === 'over' && (
          <div className="absolute inset-0 rounded-xl bg-zinc-950/85 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
            <p className="text-2xl font-black text-zinc-100">Game Over</p>
            <p className="text-sm text-zinc-400">Score: {state.score}</p>
            <button
              onClick={handleRestart}
              className="mt-1 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600 text-center max-w-[320px]">
        Arrow keys or WASD to move · Eat food to grow · Avoid walls and yourself
      </p>

      {/* ── Highscores ───────────────────────────────────────────────── */}
      <HighscoreTable
        entries={highscores}
        lastRun={lastRun}
        onClear={handleClearHighscores}
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

function HighscoreTable({
  entries,
  lastRun,
  onClear,
}: {
  entries: SnakeHighscoreEntry[];
  lastRun: LastRun | null;
  onClear: () => void;
}) {
  const best = entries[0]?.score ?? 0;

  return (
    <div className="w-full max-w-[420px]">

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            High Scores
          </span>
          {best > 0 && (
            <span className="text-sm font-black text-zinc-100 tabular-nums">
              Best:&nbsp;{best.toLocaleString()}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            Clear Highscores
          </button>
        )}
      </div>

      {/* Last run summary */}
      {lastRun && (
        <p className="text-xs text-zinc-500 mb-3">
          Last run: Score&nbsp;{lastRun.score}&nbsp;·&nbsp;
          Moves&nbsp;{lastRun.moves.toLocaleString()}&nbsp;·&nbsp;
          Duration&nbsp;{lastRun.durationSec}s
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
          No scores yet — finish a game to appear here.
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                <th className="py-2 px-3 text-left font-semibold w-8">#</th>
                <th className="py-2 px-3 text-right font-semibold">Score</th>
                <th className="py-2 px-3 text-right font-semibold">Moves</th>
                <th className="py-2 px-3 text-right font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 10).map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-t border-zinc-800/50 ${
                    i === 0 ? 'bg-amber-950/25' : 'bg-zinc-900/30'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span className={`font-bold tabular-nums ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-black tabular-nums text-zinc-100">
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-zinc-400">
                    {entry.moves.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-500 text-xs whitespace-nowrap">
                    {formatDate(entry.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
    });
  } catch {
    return '—';
  }
}
