'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  maxTile,
  move,
  keepPlaying as engineKeepPlaying,
} from './engine';
import type { Direction, GameState, HighscoreEntry, Tile } from './types';

// ── Best-score persistence ────────────────────────────────────────────────────

const BEST_KEY = 'webgames:2048:best';

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(score: number) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch {}
}

// ── Highscore persistence ─────────────────────────────────────────────────────

const HS_KEY = 'webgames.2048.highscores';

function loadHighscores(): HighscoreEntry[] {
  try {
    const raw = localStorage.getItem(HS_KEY);
    return raw ? (JSON.parse(raw) as HighscoreEntry[]) : [];
  } catch { return []; }
}

/** Inserts an entry, re-sorts by score descending, trims to top 10, saves. */
function addHighscore(entry: HighscoreEntry): HighscoreEntry[] {
  const next = [...loadHighscores(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  try { localStorage.setItem(HS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

function deleteHighscores() {
  try { localStorage.removeItem(HS_KEY); } catch {}
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
  // Initialise with best=0 to avoid SSR/hydration mismatch;
  // the real persisted value is loaded after first mount.
  const [state, setState]           = useState<GameState>(() => createInitialState(0));
  const [highscores, setHighscores] = useState<HighscoreEntry[]>([]);

  // Timing / dedup refs
  const startTimeRef = useRef<number>(Date.now());
  const savedRef     = useRef<boolean>(false);

  // ── Load persisted data on mount ────────────────────────────────────────────
  useEffect(() => {
    const savedBest = loadBest();
    if (savedBest > 0) {
      setState((prev) => ({ ...prev, best: Math.max(prev.best, savedBest) }));
    }
    setHighscores(loadHighscores());
  }, []);

  // ── Persist best whenever it improves ───────────────────────────────────────
  useEffect(() => {
    saveBest(state.best);
  }, [state.best]);

  // ── Save highscore when the game ends ───────────────────────────────────────
  useEffect(() => {
    if (state.status === 'over' && !savedRef.current) {
      savedRef.current = true;
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      const entry: HighscoreEntry = {
        id:       Date.now().toString(),
        date:     new Date().toISOString().split('T')[0],
        score:    state.score,
        maxTile:  maxTile(state.grid),
        moves:    state.moves,
        duration,
      };
      setHighscores(addHighscore(entry));
    }
  }, [state.status, state.score, state.moves, state.grid]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleMove = useCallback((dir: Direction) => {
    setState((prev) => move(prev, dir));
  }, []);

  const handleNewGame = useCallback(() => {
    startTimeRef.current = Date.now();
    savedRef.current     = false;
    setState((prev) => createInitialState(prev.best));
  }, []);

  const handleClearHighscores = useCallback(() => {
    deleteHighscores();
    setHighscores([]);
  }, []);

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

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4">

      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] flex items-center gap-3">
        <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">2048</span>

        <ScoreBox label="SCORE" value={state.score} />
        <ScoreBox label="BEST"  value={state.best} />

        <button
          onClick={handleNewGame}
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
        >
          New
        </button>
      </div>

      {/* ── Board ────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[420px]">

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
            <p className="text-2xl font-black text-zinc-100">Game Over</p>
            <p className="text-sm text-zinc-400">Score: {state.score.toLocaleString()}</p>
            <button
              onClick={handleNewGame}
              className="mt-1 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              New Game
            </button>
          </Overlay>
        )}

        {/* Win overlay */}
        {state.status === 'won' && (
          <Overlay tint="indigo">
            <p className="text-2xl font-black text-indigo-200">You reached 2048!</p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setState(engineKeepPlaying)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                Keep playing
              </button>
              <button
                onClick={handleNewGame}
                className="px-4 py-2 rounded-lg border border-indigo-700 text-indigo-300 hover:text-indigo-100 text-sm font-semibold transition-colors"
              >
                New Game
              </button>
            </div>
          </Overlay>
        )}
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-zinc-600 text-center max-w-[320px]">
        Arrow keys or WASD to move · Merge matching tiles to reach&nbsp;2048
      </p>

      {/* ── Highscores ───────────────────────────────────────────────── */}
      <HighscoreTable
        entries={highscores}
        onClear={handleClearHighscores}
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

function HighscoreTable({
  entries,
  onClear,
}: {
  entries: HighscoreEntry[];
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
              {entries.map((entry, i) => (
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

function formatDate(dateStr: string): string {
  try {
    // Append time to avoid UTC midnight shifting the day in some locales
    return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day:   'numeric',
      year:  'numeric',
    });
  } catch {
    return dateStr;
  }
}
