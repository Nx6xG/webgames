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
import { getStats, recordRun } from './stats';
import type { TetrisStats } from './stats';
import { saveGame, loadGame, clearSave } from '@/lib/gameSave';

const SAVE_TETRIS = 'tetris';
import type { TetrisState, TetrisAction, TetrominoKind, Piece } from './types';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import * as sfx from './sound';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { useSkinShop } from '@/hooks/useSkinShop';
import { SkinShopOverlay } from '@/components/ui/SkinShopOverlay';
import type { SkinDef } from '@/lib/skinShop';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Gravity interval (ms) per level — speeds up until level 20. */
function gravityMs(level: number): number {
  const base = 800;
  const floor = 50;
  return Math.max(floor, base - level * 50);
}

// ── Skin definitions ─────────────────────────────────────────────────────────

// Each skin defines 7 piece colors (I, O, T, S, Z, J, L) + a board bg
const TETRIS_SKINS: SkinDef[] = [
  { id: 'classic', price: 0, nameKey: 'tetris.skin.classic', colors: {
    I: '#22d3ee', O: '#facc15', T: '#c084fc', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c',
    bg: '#09090b', border: '#27272a',
  }},
  { id: 'ocean', price: 15, nameKey: 'tetris.skin.ocean', colors: {
    I: '#67e8f9', O: '#7dd3fc', T: '#38bdf8', S: '#22d3ee', Z: '#0ea5e9', J: '#0284c7', L: '#a5f3fc',
    bg: '#0c1929', border: '#1e3a5f',
  }},
  { id: 'sunset', price: 15, nameKey: 'tetris.skin.sunset', colors: {
    I: '#fbbf24', O: '#f97316', T: '#ef4444', S: '#fb923c', Z: '#dc2626', J: '#f59e0b', L: '#fcd34d',
    bg: '#1a0c08', border: '#4a2010',
  }},
  { id: 'forest', price: 25, nameKey: 'tetris.skin.forest', colors: {
    I: '#4ade80', O: '#a3e635', T: '#34d399', S: '#86efac', Z: '#22c55e', J: '#16a34a', L: '#bbf7d0',
    bg: '#071a0e', border: '#14532d',
  }},
  { id: 'candy', price: 30, nameKey: 'tetris.skin.candy', colors: {
    I: '#f9a8d4', O: '#fdba74', T: '#c4b5fd', S: '#a5f3fc', Z: '#fda4af', J: '#93c5fd', L: '#fde68a',
    bg: '#1a0a1a', border: '#4a1942',
  }},
  { id: 'mono', price: 40, nameKey: 'tetris.skin.mono', colors: {
    I: '#e4e4e7', O: '#d4d4d8', T: '#a1a1aa', S: '#fafafa', Z: '#71717a', J: '#f4f4f5', L: '#c4c4cc',
    bg: '#0a0a0a', border: '#2a2a2a',
  }},
  { id: 'neon', price: 60, nameKey: 'tetris.skin.neon', colors: {
    I: '#00ffff', O: '#ffff00', T: '#ff00ff', S: '#00ff88', Z: '#ff0066', J: '#4466ff', L: '#ff8800',
    bg: '#050510', border: '#1a1a3a',
  }},
  { id: 'ice', price: 80, nameKey: 'tetris.skin.ice', colors: {
    I: '#bae6fd', O: '#e0f2fe', T: '#7dd3fc', S: '#cffafe', Z: '#a5f3fc', J: '#38bdf8', L: '#f0f9ff',
    bg: '#0c1525', border: '#1e3a5f',
  }},
  { id: 'lava', price: 120, nameKey: 'tetris.skin.lava', colors: {
    I: '#ff4500', O: '#ff6b35', T: '#dc2626', S: '#f97316', Z: '#b91c1c', J: '#ff8c42', L: '#fbbf24',
    bg: '#1a0800', border: '#5c1a00',
  }},
  { id: 'aurora', price: 200, nameKey: 'tetris.skin.aurora', colors: {
    I: '#67e8f9', O: '#c084fc', T: '#f0abfc', S: '#34d399', Z: '#fb7185', J: '#818cf8', L: '#fbbf24',
    bg: '#08060e', border: '#2a1a4a',
  }, requireAll: true },
];

const PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;

function getPieceColor(colors: Record<string, string>, idx: number): string {
  return colors[PIECE_KEYS[idx - 1]] ?? '#888';
}

function getGhostColor(colors: Record<string, string>, idx: number): string {
  const c = getPieceColor(colors, idx);
  return c + '33'; // 20% opacity hex
}

// ── Mini piece preview (4×4 grid) ─────────────────────────────────────────────

function MiniPiece({ kind, skinColors }: { kind: TetrominoKind; skinColors: Record<string, string> }) {
  const piece = spawnKind(kind);
  const cells = getCellsForPiece(piece);
  const idx = KIND_INDEX[kind];
  const colour = getPieceColor(skinColors, idx);

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
            className="w-[13px] h-[13px] rounded-sm"
            style={{ backgroundColor: grid[r][c] ? colour : 'transparent' }}
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
    setFlashRows(new Set(state.lastClear.clearedRows));
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
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('tetris');
  const pb = usePersonalScores('tetris', user ? { userId: user.id, nickname } : undefined);
  const shop = useSkinShop('tetris', TETRIS_SKINS);
  const sc = shop.activeSkinDef.colors;
  const [state, setState] = useState<TetrisState>(createInitialState);
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<TetrisStats | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stats + restore saved game on mount
  useEffect(() => {
    setStats(getStats());
    const saved = loadGame<TetrisState>(SAVE_TETRIS);
    if (saved && (saved.status === 'running' || saved.status === 'paused')) {
      saved.status = 'paused';
      saved.lastClear = undefined;
      setState(saved);
      clearSave(SAVE_TETRIS);
    }
  }, []);

  // Auto-save when leaving
  const tetrisSaveRef = useRef<() => void>(() => {});
  tetrisSaveRef.current = () => {
    if (state.status !== 'running' && state.status !== 'paused') return;
    if (state.score === 0 && state.lines === 0) return;
    saveGame(SAVE_TETRIS, state);
  };

  useEffect(() => {
    const onVis = () => { if (document.hidden) tetrisSaveRef.current(); };
    const onUnload = () => tetrisSaveRef.current();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  // Save on unmount (Next.js client navigation)
  useEffect(() => () => { tetrisSaveRef.current(); }, []);

  // Dispatch helper with sound effects
  const dispatch = useCallback((action: TetrisAction) => {
    setState(prev => {
      const next = reducer(prev, action);
      // Play sounds based on action type
      switch (action.type) {
        case 'moveLeft':
        case 'moveRight':
          if (next.active.x !== prev.active.x) sfx.moveSound();
          break;
        case 'rotateCW':
        case 'rotateCCW':
          if (next.active.rot !== prev.active.rot) sfx.rotateSound();
          break;
        case 'softDrop':
          if (next.active.y !== prev.active.y) sfx.softDropSound();
          break;
        case 'hardDrop':
          sfx.hardDropSound();
          break;
        case 'hold':
          if (next.holdKind !== prev.holdKind) sfx.holdSound();
          break;
      }
      // Line clear sound
      if (next.lastClear && next.lastClear !== prev.lastClear) {
        if (next.lastClear.linesCleared >= 4) sfx.tetrisSound();
        else sfx.clearSound();
      }
      // Lock sound on natural gravity lock (piece changed but not via hardDrop)
      if (action.type === 'tick' && next.active.kind !== prev.active.kind) {
        sfx.lockSound();
      }
      // Game over
      if (next.status === 'gameover' && prev.status !== 'gameover') {
        sfx.gameOverSound();
      }
      return next;
    });
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
      clearSave(SAVE_TETRIS);
      const updated = recordRun({
        score: state.score,
        lines: state.lines,
        level: state.level,
        date: Date.now(),
      });
      setStats(updated);
      pb.submit(state.score, { lines: state.lines, level: state.level });
      // Award coins: 1 per line cleared
      if (state.lines > 0) shop.addCoins(state.lines);
    }
    if (state.status === 'countdown') {
      savedRef.current = false;
    }
  }, [state.status, state.score, state.lines, state.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-pause on tab switch ────────────────────────────────────────────────
  useVisibilityPause(state.status === 'running', useCallback(() => dispatch({ type: 'togglePause' }), [dispatch]));

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
        case 'z': case 'Z': case 'q': case 'Q': dispatch({ type: 'rotateCCW' }); break;
        case 'x': case 'X': case 'e': case 'E': case 'ArrowUp': dispatch({ type: 'rotateCW' }); break;
        case 'c': case 'C': dispatch({ type: 'hold' }); break;
        case 'p': case 'P': dispatch({ type: 'togglePause' }); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch]);

  // ── Mouse wheel rotation ───────────────────────────────────────────────────

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY < 0) dispatch({ type: 'rotateCW' });
      else if (e.deltaY > 0) dispatch({ type: 'rotateCCW' });
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [dispatch]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    clearSave(SAVE_TETRIS);
    dispatch({ type: 'restart' });
  }, [dispatch]);

  // ── Derived rendering data ──────────────────────────────────────────────────

  const flashRows = useLineClearFlash(state);
  const ghost = getGhostPiece(state.board, state.active);
  const ghostCells = getCellsForPiece(ghost);
  const activeCells = getCellsForPiece(state.active);
  const activeIdx = KIND_INDEX[state.active.kind];

  const ghostMap = new Set(ghostCells.map(c => `${c.row},${c.col}`));
  const activeMap = new Set(activeCells.map(c => `${c.row},${c.col}`));

  const best = stats?.bestScore ?? 0;

  const renderSkinPreview = useCallback((ctx: CanvasRenderingContext2D, skin: SkinDef, size: number) => {
    const c = skin.colors;
    const cellSize = Math.floor(size / 6);
    const pad = (size - cellSize * 5) / 2;

    // Background
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, size, size);

    // Draw a mini T-piece shape
    const tShape = [[1,0],[0,1],[1,1],[2,1]];
    for (const [cx, cy] of tShape) {
      const x = pad + cx * cellSize;
      const y = pad + cy * cellSize;
      ctx.fillStyle = c.T;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }

    // Draw an L-piece below-right
    const lShape = [[3,1],[3,2],[3,3],[4,3]];
    for (const [cx, cy] of lShape) {
      const x = pad + cx * cellSize;
      const y = pad + cy * cellSize;
      ctx.fillStyle = c.L;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }

    // Draw an S-piece bottom-left
    const sShape = [[1,3],[2,3],[0,4],[1,4]];
    for (const [cx, cy] of sShape) {
      const x = pad + cx * cellSize;
      const y = pad + cy * cellSize;
      ctx.fillStyle = c.S;
      ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    }

    // Grid border lines
    ctx.strokeStyle = c.border + '60';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(pad, pad, cellSize * 5, cellSize * 5);
  }, []);

  return (
    <div className="relative w-full flex-1 min-h-0 flex flex-col">
      <div className="flex flex-col items-center gap-3 flex-1 min-h-0">
      {/* ── Game area — viewport-fitted ─────────────────────────────── */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full flex-1 min-h-0">
        {/* Board row: sidebars + board — fills available height */}
        <div className="flex-1 min-h-0 flex gap-3 sm:gap-4 items-stretch justify-center w-full relative">
          {/* Left sidebar — Hold + Stats */}
          <div className="hidden sm:flex flex-col gap-2 w-[90px] shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{t('tetris.hold')}</div>
              <div className="flex items-center justify-center h-[50px]">
                {state.holdKind ? (
                  <MiniPiece kind={state.holdKind} skinColors={sc} />
                ) : (
                  <span className="text-zinc-700 text-xs">—</span>
                )}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-1.5">
              <StatRow label={t('game.score')} value={state.score} />
              <StatRow label={t('tetris.lines')} value={state.lines} />
              <StatRow label={t('tetris.level')} value={state.level} />
              <StatRow label={t('tetris.best')} value={best} />
            </div>
            <button
              onClick={() => shop.setShowShop(true)}
              className="w-full px-2.5 py-2 rounded-lg border border-amber-700/50 hover:border-amber-500/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-400 text-xs font-bold transition-colors"
            >
              {t('tetris.shop')} · ● {shop.wallet}
            </button>
          </div>

          {/* Board — height-driven, width derived from aspect ratio */}
          <div ref={boardRef} className="relative h-full" style={{ aspectRatio: `${BOARD_COLS} / ${BOARD_ROWS}`, maxWidth: '100%' }}>
            <div
              className="grid h-full w-full border-2 rounded"
              style={{ gridTemplateColumns: `repeat(${BOARD_COLS}, 1fr)`, backgroundColor: sc.bg, borderColor: sc.border }}
            >
              {Array.from({ length: BOARD_ROWS }, (_, row) =>
                Array.from({ length: BOARD_COLS }, (_, col) => {
                  const key = `${row},${col}`;
                  const boardVal = state.board[row][col];
                  const isActive = activeMap.has(key);
                  const isGhost = !isActive && ghostMap.has(key);
                  const isFlash = flashRows.has(row);

                  let bgColor = sc.bg;
                  if (isFlash) {
                    bgColor = '#ffffff';
                  } else if (isActive) {
                    bgColor = getPieceColor(sc, activeIdx);
                  } else if (isGhost) {
                    bgColor = getGhostColor(sc, activeIdx);
                  } else if (boardVal > 0) {
                    bgColor = getPieceColor(sc, boardVal);
                  }

                  return (
                    <div
                      key={key}
                      className={`aspect-square ${isFlash ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: bgColor, border: `1px solid ${sc.border}50` }}
                    />
                  );
                })
              )}
            </div>

            {/* Menu overlay */}
            {state.status === 'menu' && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-black tracking-tight text-white">Tetris</h2>
                  <p className="text-zinc-500 text-xs max-sm:hidden">← → · ↓ · Space · Z/X · C · P</p>
                  {stats && stats.gamesPlayed > 0 && (
                    <p className="text-zinc-500 text-xs">
                      {t('tetris.best')}: {stats.bestScore.toLocaleString()} · {t('tetris.games')}: {stats.gamesPlayed}
                    </p>
                  )}
                  <div className="flex items-center gap-3 justify-center">
                    <button
                      onClick={() => dispatch({ type: 'startGame' })}
                      className="px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg transition-colors"
                    >
                      {t('tetris.start')}
                    </button>
                    <button
                      onClick={() => shop.setShowShop(true)}
                      className="px-4 py-3 rounded-lg border border-amber-700/50 hover:border-amber-500/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-400 font-bold transition-colors"
                    >
                      {t('tetris.shop')}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold justify-center">
                    <span>●</span> {shop.wallet}
                  </div>
                </div>
              </div>
            )}

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
                  <span className="text-3xl font-bold text-white">{t('game.paused')}</span>
                  <p className="text-zinc-400 text-sm mt-2">{t('tetris.pressP')}</p>
                </div>
              </div>
            )}

            {/* Game over overlay */}
            {state.status === 'gameover' && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded">
                <div className="text-center space-y-3">
                  <p className="text-3xl font-bold text-white">{t('game.over')}</p>
                  <p className="text-zinc-300">
                    {t('game.score')}: <span className="font-bold text-white">{state.score}</span>
                  </p>
                  {state.lines > 0 && (
                    <p className="text-amber-400 text-sm font-bold">+{state.lines} ●</p>
                  )}
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleRestart}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('game.restart')}
                    </button>
                    <button
                      onClick={() => shop.setShowShop(true)}
                      className="px-4 py-2 border border-amber-700/50 hover:border-amber-500/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('tetris.shop')}
                    </button>
                    <a
                      href="/"
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {t('tetris.back')}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Skin Shop Overlay */}
          {shop.showShop && (
            <div className="absolute inset-0 z-30">
              <SkinShopOverlay
                skins={TETRIS_SKINS}
                wallet={shop.wallet}
                owned={shop.owned}
                activeSkin={shop.activeSkin}
                onBuy={shop.buy}
                onEquip={shop.equip}
                onClose={() => shop.setShowShop(false)}
                renderPreview={renderSkinPreview}
                lockedLabel={t('tetris.auroraLocked')}
              />
            </div>
          )}

          {/* Right sidebar — Next queue */}
          <div className="hidden sm:flex flex-col gap-2 w-[90px] shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{t('tetris.next')}</div>
              <div className="flex flex-col items-center gap-2">
                {state.nextQueue.slice(0, 5).map((kind, i) => (
                  <div key={i} className="flex items-center justify-center h-[38px]">
                    <MiniPiece kind={kind} skinColors={sc} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile stats bar (visible below sm) */}
        <div className="shrink-0 flex sm:hidden gap-2 w-full justify-between">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">{t('game.score')}</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.score}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">{t('tetris.lines')}</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.lines}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">{t('tetris.level')}</div>
            <div className="text-sm font-bold text-white tabular-nums">{state.level}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 flex-1 text-center">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">{t('tetris.hold')}</div>
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
            <MobileBtn label={t('tetris.hold')} onPress={() => dispatch({ type: 'hold' })} />
            <MobileBtn label={t('tetris.rotate')} onPress={() => dispatch({ type: 'rotateCW' })} />
            <MobileBtn
              label={state.status === 'paused' ? t('game.resume') : t('game.paused')}
              onPress={() => dispatch({ type: 'togglePause' })}
            />
          </div>
          <div className="flex gap-1.5 justify-center">
            <MobileBtn label="←" onPress={() => dispatch({ type: 'moveLeft' })} wide />
            <MobileBtn label="↓" onPress={() => dispatch({ type: 'softDrop' })} wide />
            <MobileBtn label="→" onPress={() => dispatch({ type: 'moveRight' })} wide />
          </div>
          <div className="flex gap-1.5 justify-center">
            <MobileBtn label={t('tetris.hardDrop')} onPress={() => dispatch({ type: 'hardDrop' })} full />
          </div>
        </div>

        {/* Controls hint (desktop only) */}
        <div className="shrink-0 hidden sm:block text-center text-[11px] text-zinc-600 space-x-3">
          <span>{t('tetris.controls.move')}</span>
          <span>{t('tetris.controls.soft')}</span>
          <span>{t('tetris.controls.hard')}</span>
          <span>{t('tetris.controls.rotate')}</span>
          <span>{t('tetris.controls.hold')}</span>
          <span>{t('tetris.controls.pause')}</span>
        </div>
      </div>

      {/* ── Personal best list — below the viewport-fitted game area (mobile only) ── */}
      <div className="w-full flex justify-center lg:hidden">
        <ScoreboardPanel
          gameId="tetris"
          scores={pb.scores}
          lastInsertId={pb.lastInsertId}
          isNewBest={pb.isNewBest}
          onClear={pb.clear}
        />
      </div>
      </div>

      {/* ── Sidebar — scoreboard (desktop only) ── */}
      <aside className="hidden lg:block absolute right-0 top-0 w-[240px]">
        <div className="flex flex-col gap-3">
          <ScoreboardPanel
            gameId="tetris"
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
