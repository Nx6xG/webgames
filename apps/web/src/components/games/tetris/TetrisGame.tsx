'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOARD_COLS,
  BOARD_ROWS,
  KIND_INDEX,
  createInitialState,
  getCellsForPiece,
  hardDropDistance,
  reducer,
  spawnKind,
} from './engine';
import { getStats, recordRun, clearStats } from './stats';
import type { TetrisStats } from './stats';
import type { TetrisState, TetrisAction, TetrominoKind, Piece } from './types';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gravity interval (ms) per level — speeds up until level 20. */
function gravityMs(level: number): number {
  const base = 800;
  const floor = 50;
  return Math.max(floor, base - level * 50);
}

/** Piece colour classes by kind-index (1-7). */
const PIECE_COLOURS: Record<number, string> = {
  1: 'bg-cyan-400',    // I
  2: 'bg-yellow-400',  // O
  3: 'bg-purple-400',  // T
  4: 'bg-green-400',   // S
  5: 'bg-red-400',     // Z
  6: 'bg-blue-400',    // J
  7: 'bg-orange-400',  // L
};

const GHOST_COLOURS: Record<number, string> = {
  1: 'bg-cyan-400/20',
  2: 'bg-yellow-400/20',
  3: 'bg-purple-400/20',
  4: 'bg-green-400/20',
  5: 'bg-red-400/20',
  6: 'bg-blue-400/20',
  7: 'bg-orange-400/20',
};

// ── Mini piece preview (4×4 grid) ─────────────────────────────────────────────

function MiniPiece({ kind }: { kind: TetrominoKind }) {
  const piece = spawnKind(kind);
  const cells = getCellsForPiece(piece);
  const idx = KIND_INDEX[kind];
  const colour = PIECE_COLOURS[idx];

  const grid: boolean[][] = Array.from({ length: 4 }, () => Array(4).fill(false));
  for (const { col, row } of cells) {
    const c = col - piece.x;
    const r = row - piece.y;
    if (r >= 0 && r < 4 && c >= 0 && c < 4) grid[r][c] = true;
  }

  const maxCol = Math.max(...cells.map(c => c.col - piece.x)) + 1;
  const maxRow = Math.max(...cells.map(c => c.row - piece.y)) + 1;

  return (
    <div
      className="grid gap-px"
      style={{
        gridTemplateColumns: `repeat(${maxCol}, 1fr)`,
        width: maxCol * 14,
        height: maxRow * 14,
      }}
    >
      {Array.from({ length: maxRow }, (_, r) =>
        Array.from({ length: maxCol }, (_, c) => (
          <div
            key={`${r}-${c}`}
            className={`w-[13px] h-[13px] rounded-sm ${grid[r][c] ? colour : 'bg-transparent'}`}
          />
        ))
      )}
    </div>
  );
}

// ── Line-clear flash rows ─────────────────────────────────────────────────────

function useLineClearFlash(state: TetrisState) {
  const [flashRows, setFlashRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!state.lastClear) return;
    const cleared = new Set<number>();
    const n = state.lastClear.linesCleared;
    for (let i = 0; i < n; i++) cleared.add(i);
    setFlashRows(cleared);
    const timer = setTimeout(() => setFlashRows(new Set()), 200);
    return () => clearTimeout(timer);
  }, [state.lastClear]);

  return flashRows;
}

// ── Ghost piece helper ────────────────────────────────────────────────────────

function getGhostPiece(board: TetrisState['board'], active: Piece): Piece {
  const dist = hardDropDistance(board, active);
  return { ...active, y: active.y + dist };
}

// ── Main component ────────────────────────────────────────────────────────────

export function TetrisGame() {
  const { t } = useI18n();
  const ach = useAchievements('tetris');
  const [state, setState] = useState<TetrisState>(createInitialState);
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<TetrisStats | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stats on mount
  useEffect(() => { setStats(getStats()); }, []);

  // Dispatch helper
  const dispatch = useCallback((action: TetrisAction) => {
    setState(prev => reducer(prev, action));
  }, []);

  // ── Countdown ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.status !== 'countdown') return;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          dispatch({ type: 'togglePause' });
          return 0;
        }
        return prev - 1;
      });
    }, 700);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [state.status, dispatch]);

  // ── Gravity loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.status === 'running') {
      tickRef.current = setInterval(() => {
        dispatch({ type: 'tick' });
      }, gravityMs(state.level));
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, [state.status, state.level, dispatch]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === 'running') ach.trackPlay();
    if (state.status === 'countdown') ach.reset();
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Record stats on gameover ────────────────────────────────────────────────

  const savedRef = useRef(false);
  useEffect(() => {
    if (state.status === 'gameover' && !savedRef.current) {
      savedRef.current = true;
      const updated = recordRun({
        score: state.score,
        lines: state.lines,
        level: state.level,
        date: Date.now(),
      });
      setStats(updated);
    }
    if (state.status === 'countdown') {
      savedRef.current = false;
    }
  }, [state.status, state.score, state.lines, state.level]);

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowLeft':  dispatch({ type: 'moveLeft' }); break;
        case 'ArrowRight': dispatch({ type: 'moveRight' }); break;
        case 'ArrowDown':  dispatch({ type: 'softDrop' }); break;
        case ' ':          dispatch({ type: 'hardDrop' }); break;
        case 'z': case 'Z': dispatch({ type: 'rotateCCW' }); break;
        case 'x': case 'X': case 'ArrowUp': dispatch({ type: 'rotateCW' }); break;
        case 'c': case 'C': dispatch({ type: 'hold' }); break;
        case 'p': case 'P': dispatch({ type: 'togglePause' }); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    dispatch({ type: 'restart' });
  }, [dispatch]);

  const handleClearStats = useCallback(() => {
    setStats(clearStats());
    setConfirmClear(false);
  }, []);

  // ── Derived rendering data ──────────────────────────────────────────────────

  const flashRows = useLineClearFlash(state);
  const ghost = getGhostPiece(state.board, state.active);
  const ghostCells = getCellsForPiece(ghost);
  const activeCells = getCellsForPiece(state.active);
  const activeIdx = KIND_INDEX[state.active.kind];

  const ghostMap = new Set(ghostCells.map(c => `${c.row},${c.col}`));
  const activeMap = new Set(activeCells.map(c => `${c.row},${c.col}`));

  const best = stats?.bestScore ?? 0;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* ── Game area — viewport-fitted ─────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full h-[calc(100dvh-7.5rem)]">
        {/* Board row: sidebars + board — fills available height */}
        <div className="flex-1 min-h-0 flex gap-3 sm:gap-4 items-stretch justify-center w-full">
          {/* Left sidebar — Hold + Stats */}
          <div className="hidden sm:flex flex-col gap-2 w-[90px] shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Hold</div>
              <div className="flex items-center justify-center h-[50px]">
                {state.holdKind ? (
                  <MiniPiece kind={state.holdKind} />
                ) : (
                  <span className="text-zinc-700 text-xs">—</span>
                )}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-1.5">
              <StatRow label="Score" value={state.score} />
              <StatRow label="Lines" value={state.lines} />
              <StatRow label="Level" value={state.level} />
              <StatRow label={t('tetris.best')} value={best} />
            </div>
          </div>

          {/* Board — height-driven, width derived from aspect ratio */}
          <div className="relative h-full" style={{ aspectRatio: `${BOARD_COLS} / ${BOARD_ROWS}`, maxWidth: '100%' }}>
            <div
              className="grid h-full w-full border-2 border-zinc-700 bg-zinc-950 rounded"
              style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)` }}
            >
              {Array.from({ length: BOARD_ROWS }, (_, row) =>
                Array.from({ length: BOARD_COLS }, (_, col) => {
                  const key = `${row},${col}`;
                  const boardVal = state.board[row][col];
                  const isActive = activeMap.has(key);
                  const isGhost = !isActive && ghostMap.has(key);
                  const isFlash = flashRows.has(row);

                  let bg = 'bg-zinc-950';
                  if (isFlash) {
                    bg = 'bg-white';
                  } else if (isActive) {
                    bg = PIECE_COLOURS[activeIdx];
                  } else if (isGhost) {
                    bg = GHOST_COLOURS[activeIdx];
                  } else if (boardVal > 0) {
                    bg = PIECE_COLOURS[boardVal];
                  }

                  return (
                    <div
                      key={key}
                      className={`aspect-square border border-zinc-900/50 ${bg} ${isFlash ? 'animate-pulse' : ''}`}
                    />
                  );
                })
              )}
            </div>

            {/* Countdown overlay */}
            {state.status === 'countdown' && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded">
                <span className="text-7xl font-black text-white tabular-nums animate-bounce">
                  {countdown}
                </span>
              </div>
            )}

            {/* Pause overlay */}
            {state.status === 'paused' && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded">
                <div className="text-center">
                  <span className="text-3xl font-bold text-white">Paused</span>
                  <p className="text-zinc-400 text-sm mt-2">Press P to resume</p>
                </div>
              </div>
            )}

            {/* Game over overlay */}
            {state.status === 'gameover' && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded">
                <div className="text-center space-y-4">
                  <p className="text-3xl font-bold text-white">Game Over</p>
                  <p className="text-zinc-300">
                    Score: <span className="font-bold text-white">{state.score}</span>
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleRestart}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Restart
                    </button>
                    <a
                      href="/"
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Back
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar — Next queue */}
          <div className="hidden sm:flex flex-col gap-2 w-[90px] shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Next</div>
              <div className="flex flex-col items-center gap-2">
                {state.nextQueue.slice(0, 5).map((kind, i) => (
                  <div key={i} className="flex items-center justify-center h-[38px]">
                    <MiniPiece kind={kind} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile stats bar (visible below sm) */}
        <div className="shrink-0 flex sm:hidden gap-2 w-full justify-between">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Score</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.score}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Lines</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.lines}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Level</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.level}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Hold</div>
            <div className="flex items-center justify-center h-[20px]">
              {state.holdKind ? (
                <span className="text-xs font-bold text-zinc-200">{state.holdKind}</span>
              ) : (
                <span className="text-zinc-700 text-xs">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="shrink-0 flex sm:hidden flex-col gap-1.5 w-full">
          <div className="flex gap-1.5 justify-center">
            <MobileBtn label="Hold" onPress={() => dispatch({ type: 'hold' })} />
            <MobileBtn label="Rotate" onPress={() => dispatch({ type: 'rotateCW' })} />
            <MobileBtn
              label={state.status === 'paused' ? 'Resume' : 'Pause'}
              onPress={() => dispatch({ type: 'togglePause' })}
            />
          </div>
          <div className="flex gap-1.5 justify-center">
            <MobileBtn label="←" onPress={() => dispatch({ type: 'moveLeft' })} wide />
            <MobileBtn label="↓" onPress={() => dispatch({ type: 'softDrop' })} wide />
            <MobileBtn label="→" onPress={() => dispatch({ type: 'moveRight' })} wide />
          </div>
          <div className="flex gap-1.5 justify-center">
            <MobileBtn label="Hard Drop" onPress={() => dispatch({ type: 'hardDrop' })} full />
          </div>
        </div>

        {/* Controls hint (desktop only) */}
        <div className="shrink-0 hidden sm:block text-center text-[11px] text-zinc-600 space-x-3">
          <span>← → Move</span>
          <span>↓ Soft Drop</span>
          <span>Space Hard Drop</span>
          <span>Z / X Rotate</span>
          <span>C Hold</span>
          <span>P Pause</span>
        </div>
      </div>

      {/* ── Highscores — below the viewport-fitted game area ────── */}
      {stats && (
        <div className="w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
          {/* Summary row */}
          <div className="flex gap-4 text-center">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{t('tetris.best')}</div>
              <div className="text-sm font-bold text-white tabular-nums">{stats.bestScore.toLocaleString()}</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{t('tetris.bestLines')}</div>
              <div className="text-sm font-bold text-white tabular-nums">{stats.bestLines}</div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{t('tetris.games')}</div>
              <div className="text-sm font-bold text-white tabular-nums">{stats.gamesPlayed}</div>
            </div>
          </div>

          {/* Top 10 table */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{t('tetris.highscores')}</div>
            {stats.top10.length === 0 ? (
              <p className="text-xs text-zinc-600">{t('tetris.emptyHighscores')}</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="pr-2 font-medium">#</th>
                    <th className="pr-2 font-medium">Score</th>
                    <th className="pr-2 font-medium">Lines</th>
                    <th className="font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top10.map((run, i) => (
                    <tr key={i} className="text-zinc-300">
                      <td className="pr-2 tabular-nums text-zinc-500">{i + 1}</td>
                      <td className="pr-2 tabular-nums font-semibold">{run.score.toLocaleString()}</td>
                      <td className="pr-2 tabular-nums">{run.lines}</td>
                      <td className="tabular-nums">{run.level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Clear stats */}
          <div className="flex justify-end">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">{t('tetris.clearStatsConfirm')}</span>
                <button
                  onClick={handleClearStats}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  {t('tetris.clearStats')}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                {t('tetris.clearStats')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small subcomponents ───────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-white tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}

function MobileBtn({
  label,
  onPress,
  wide,
  full,
}: {
  label: string;
  onPress: () => void;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`
        select-none touch-manipulation
        bg-zinc-800 active:bg-zinc-700 border border-zinc-700
        text-zinc-200 text-sm font-medium rounded-lg
        py-2.5
        ${full ? 'flex-1' : wide ? 'flex-1' : 'px-4'}
        transition-colors
      `}
    >
      {label}
    </button>
  );
}
