'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAchievements } from '@/hooks/useAchievements';
import { usePersonalScores } from '@/hooks/usePersonalScores';
import { ScoreboardPanel } from '@/components/ui/ScoreboardPanel';
import { useAuth } from '@/components/providers/AuthProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { loadStats, saveStats, updateStats } from './stats';
import type { MinesweeperStats } from './stats';
import * as sfx from './sound';
import { createSeededRng } from '@/lib/seededRandom';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { getTodayStr } from '@/lib/dailyChallenges/definitions';

// ── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';
type Phase = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

interface DiffConfig {
  rows: number;
  cols: number;
  mines: number;
}

const DIFF_CONFIG: Record<Difficulty, DiffConfig> = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 24, cols: 24, mines: 99 },
};

type CellState = 'hidden' | 'revealed' | 'flagged';

interface Cell {
  mine: boolean;
  state: CellState;
  adjacent: number;
  /** BFS order index for staggered reveal animation (0 = click origin). */
  revealOrder: number;
}

// ── Number colors (classic Minesweeper) ─────────────────────────────────────

const NUM_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-orange-400',
  6: 'text-teal-400',
  7: 'text-zinc-300',
  8: 'text-zinc-500',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      state: 'hidden' as CellState,
      adjacent: 0,
      revealOrder: -1,
    })),
  );
}

type RngFn = () => number;

function placeMines(
  grid: Cell[][],
  rows: number,
  cols: number,
  mineCount: number,
  safeR: number,
  safeC: number,
  rng: RngFn = Math.random,
): void {
  // Collect all safe positions (first click + neighbors)
  const safe = new Set<string>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr;
      const nc = safeC + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safe.add(`${nr},${nc}`);
      }
    }
  }

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(rng() * rows);
    const c = Math.floor(rng() * cols);
    if (grid[r][c].mine || safe.has(`${r},${c}`)) continue;
    grid[r][c].mine = true;
    placed++;
  }

  // Calculate adjacent counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].mine) {
            count++;
          }
        }
      }
      grid[r][c].adjacent = count;
    }
  }
}

/** BFS flood reveal — assigns revealOrder for staggered animation. */
function floodReveal(grid: Cell[][], rows: number, cols: number, r: number, c: number): void {
  const queue: [number, number][] = [[r, c]];
  let head = 0;
  let order = 0;
  while (head < queue.length) {
    const [cr, cc] = queue[head++];
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    const cell = grid[cr][cc];
    if (cell.state === 'revealed' || cell.state === 'flagged') continue;
    if (cell.mine) continue;
    cell.state = 'revealed';
    cell.revealOrder = order++;
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          queue.push([cr + dr, cc + dc]);
        }
      }
    }
  }
}

function checkWin(grid: Cell[][], rows: number, cols: number): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (!cell.mine && cell.state !== 'revealed') return false;
    }
  }
  return true;
}

function countFlags(grid: Cell[][], rows: number, cols: number): number {
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].state === 'flagged') count++;
    }
  }
  return count;
}

function allMinesFlagged(grid: Cell[][], rows: number, cols: number): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.mine && cell.state !== 'flagged') return false;
      if (!cell.mine && cell.state === 'flagged') return false;
    }
  }
  return true;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Cell size based on difficulty ────────────────────────────────────────────

function getCellSize(diff: Difficulty): number {
  if (diff === 'easy') return 40;
  if (diff === 'medium') return 32;
  return 24;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MinesweeperGame() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { nickname } = useNickname();
  const ach = useAchievements('minesweeper');
  const cloudCtx = user ? { userId: user.id, nickname } : undefined;
  const pbEasy = usePersonalScores('minesweeper-easy', cloudCtx);
  const pbMedium = usePersonalScores('minesweeper-medium', cloudCtx);
  const pbHard = usePersonalScores('minesweeper-hard', cloudCtx);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [firstClick, setFirstClick] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [stats, setStats] = useState<MinesweeperStats | null>(null);
  const [clickedMine, setClickedMine] = useState<[number, number] | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedRef = useRef(false);
  const startTimeRef = useRef(0);
  const dailyRngRef = useRef<RngFn | null>(null);
  const [isDaily, setIsDaily] = useState(false);
  const [flagMode, setFlagMode] = useState(false);

  const config = DIFF_CONFIG[difficulty];

  // Load stats on mount
  useEffect(() => {
    setStats(loadStats());
  }, []);

  // Timer
  useEffect(() => {
    if (phase === 'playing' && !firstClick) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, firstClick]);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing' && !firstClick, useCallback(() => setPhase('paused'), []));

  const pbMap = { easy: pbEasy, medium: pbMedium, hard: pbHard };

  const saveResult = useCallback((won: boolean, diff: Difficulty, timeSec: number) => {
    if (savedRef.current) return;
    savedRef.current = true;
    setStats((prev) => {
      const base = prev ?? { games: 0, wins: 0, losses: 0, winsEasy: 0, winsMedium: 0, winsHard: 0, bestTimeEasy: null, bestTimeMedium: null, bestTimeHard: null };
      const next = updateStats(base, won, diff, timeSec);
      saveStats(next);
      return next;
    });
    if (won) {
      ach.trackWin();
      ach.trackEvent({ type: 'flag', key: `minesweeper_${diff}` });
      pbMap[diff].submit(timeSec, { won: true });
    }
  }, [ach, pbMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const startGame = useCallback((diff: Difficulty, seed?: string) => {
    const cfg = DIFF_CONFIG[diff];
    setDifficulty(diff);
    setGrid(createEmptyGrid(cfg.rows, cfg.cols));
    setFirstClick(true);
    setElapsed(0);
    setClickedMine(null);
    savedRef.current = false;
    dailyRngRef.current = seed ? createSeededRng(seed) : null;
    setIsDaily(!!seed);
    setFlagMode(false);
    ach.reset();
    ach.trackPlay();
    setPhase('playing');
  }, [ach]);

  /** Shared: apply post-reveal logic (win check, auto-flag, sounds). */
  function finalizeGrid(newGrid: Cell[][], soundType: 'reveal' | 'flood' | 'chord') {
    if (soundType === 'reveal') sfx.revealSound();
    else if (soundType === 'flood') sfx.floodSound();
    else sfx.floodSound(); // chord uses flood sound

    setGrid(newGrid);

    if (checkWin(newGrid, config.rows, config.cols)) {
      for (let rr = 0; rr < config.rows; rr++) {
        for (let cc = 0; cc < config.cols; cc++) {
          if (newGrid[rr][cc].mine && newGrid[rr][cc].state !== 'flagged') {
            newGrid[rr][cc].state = 'flagged';
          }
        }
      }
      setGrid([...newGrid]);
      setPhase('won');
      sfx.winSound();
      const timeSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveResult(true, difficulty, timeSec);
    }
  }

  /** Shared: reveal all mines and trigger loss. */
  function triggerLoss(newGrid: Cell[][], mineR: number, mineC: number) {
    for (let rr = 0; rr < config.rows; rr++) {
      for (let cc = 0; cc < config.cols; cc++) {
        if (newGrid[rr][cc].mine) newGrid[rr][cc].state = 'revealed';
      }
    }
    setGrid(newGrid);
    setClickedMine([mineR, mineC]);
    setPhase('lost');
    sfx.explosionSound();
    const timeSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
    saveResult(false, difficulty, timeSec);
  }

  function handleCellClick(r: number, c: number) {
    if (phase !== 'playing') return;
    // Flag mode: treat tap as right-click (toggle flag)
    if (flagMode) {
      const cell = grid[r][c];
      if (cell.state === 'revealed') return;
      const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
      const wasFlagged = cell.state === 'flagged';
      newGrid[r][c].state = wasFlagged ? 'hidden' : 'flagged';
      if (wasFlagged) sfx.unflagSound(); else sfx.flagSound();
      setGrid(newGrid);
      return;
    }
    const cell = grid[r][c];

    // Chord-click: click a revealed number with matching flag count → auto-reveal neighbors
    if (cell.state === 'revealed' && cell.adjacent > 0) {
      let adjFlags = 0;
      const hiddenNeighbors: [number, number][] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= config.rows || nc < 0 || nc >= config.cols) continue;
          if (grid[nr][nc].state === 'flagged') adjFlags++;
          else if (grid[nr][nc].state === 'hidden') hiddenNeighbors.push([nr, nc]);
        }
      }
      if (adjFlags !== cell.adjacent || hiddenNeighbors.length === 0) return;

      const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
      // Check if any hidden neighbor is a mine (misplaced flag → loss)
      for (const [nr, nc] of hiddenNeighbors) {
        if (newGrid[nr][nc].mine) {
          triggerLoss(newGrid, nr, nc);
          return;
        }
      }
      // Reveal all hidden neighbors
      for (const [nr, nc] of hiddenNeighbors) {
        floodReveal(newGrid, config.rows, config.cols, nr, nc);
      }
      finalizeGrid(newGrid, 'chord');
      return;
    }

    if (cell.state === 'flagged' || cell.state === 'revealed') return;

    const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));

    if (firstClick) {
      placeMines(newGrid, config.rows, config.cols, config.mines, r, c, dailyRngRef.current ?? undefined);
      setFirstClick(false);
      startTimeRef.current = Date.now();
    }

    const clicked = newGrid[r][c];

    if (clicked.mine) {
      triggerLoss(newGrid, r, c);
      return;
    }

    floodReveal(newGrid, config.rows, config.cols, r, c);
    finalizeGrid(newGrid, clicked.adjacent > 0 ? 'reveal' : 'flood');
  }

  function handleCellRightClick(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (phase !== 'playing') return;
    const cell = grid[r][c];
    if (cell.state === 'revealed') return;

    const newGrid = grid.map((row) => row.map((cl) => ({ ...cl })));
    const wasFlagged = cell.state === 'flagged';
    newGrid[r][c].state = wasFlagged ? 'hidden' : 'flagged';
    if (wasFlagged) sfx.unflagSound(); else sfx.flagSound();
    setGrid(newGrid);
  }

  const flagCount = grid.length > 0 ? countFlags(grid, config.rows, config.cols) : 0;
  const minesRemaining = config.mines - flagCount;
  const cellSize = getCellSize(difficulty);
  const perfectFlags = phase === 'won' && grid.length > 0 && allMinesFlagged(grid, config.rows, config.cols);

  const bestTimeKey = difficulty === 'easy' ? 'bestTimeEasy'
    : difficulty === 'medium' ? 'bestTimeMedium'
    : 'bestTimeHard';
  const bestTime = stats?.[bestTimeKey] ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Stats bar */}
      {stats && stats.games > 0 && (
        <div className="flex gap-6 text-xs text-zinc-500 tabular-nums">
          <span>{t('minesweeper.stats.games')}: <b className="text-zinc-300">{stats.games}</b></span>
          <span>{t('minesweeper.stats.wins')}: <b className="text-emerald-400">{stats.wins}</b></span>
          <span>{t('minesweeper.stats.losses')}: <b className="text-rose-400">{stats.losses}</b></span>
          {bestTime !== null && (
            <span>{t('minesweeper.stats.bestTime')}: <b className="text-amber-400">{formatTime(bestTime)}</b></span>
          )}
        </div>
      )}

      {/* Menu */}
      {phase === 'menu' && (
        <div className="flex flex-col items-center gap-6 py-8">
          <h2 className="text-4xl font-black text-white">Minesweeper</h2>
          <p className="text-zinc-400 text-sm">{t('minesweeper.subtitle')}</p>

          <div className="flex flex-col gap-3 w-64">
            {(['easy', 'medium', 'hard'] as const).map((d) => {
              const cfg = DIFF_CONFIG[d];
              const easyWins = stats?.winsEasy ?? 0;
              const mediumWins = stats?.winsMedium ?? 0;
              const locked =
                (d === 'medium' && easyWins < 2) ||
                (d === 'hard' && mediumWins < 5);
              const unlockLabel =
                d === 'medium' ? `🔒 ${easyWins}/2 Easy` :
                d === 'hard' ? `🔒 ${mediumWins}/5 Medium` : null;
              return (
                <button
                  key={d}
                  onClick={() => !locked && startGame(d)}
                  disabled={locked}
                  className={`flex items-center justify-between px-5 py-3 rounded-lg border transition-colors ${
                    locked
                      ? 'bg-zinc-900/40 border-zinc-800/40 cursor-not-allowed opacity-60'
                      : 'bg-zinc-800/80 hover:bg-zinc-700/80 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <span className={`font-semibold ${locked ? 'text-zinc-500' : 'text-zinc-100'}`}>
                    {t(`minesweeper.diff.${d}`)}
                  </span>
                  {locked && unlockLabel
                    ? <span className="text-[10px] text-zinc-500">{unlockLabel}</span>
                    : <span className="text-xs text-zinc-500 tabular-nums">
                        {cfg.rows}×{cfg.cols} · {cfg.mines} {t('minesweeper.mines')}
                      </span>}
                </button>
              );
            })}

            <button
              onClick={() => startGame('medium', `minesweeper_daily_${getTodayStr()}`)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-amber-800/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-300 text-sm font-semibold transition-colors"
            >
              <span>📅</span> {t('daily.puzzle')} <span className="text-xs text-amber-500/70">({t('daily.puzzleHint')})</span>
            </button>
          </div>
        </div>
      )}

      {/* Game area */}
      {phase !== 'menu' && (
        <div className="flex flex-col items-center gap-3">
          {/* HUD */}
          <div className="flex items-center gap-6 text-sm tabular-nums">
            <div className="flex items-center gap-1.5 text-rose-400">
              <span>💣</span>
              <span className="font-bold">{minesRemaining}</span>
            </div>
            <div className="px-3 py-1 rounded bg-zinc-800 text-zinc-200 font-mono text-lg font-bold min-w-[72px] text-center">
              {formatTime(elapsed)}
            </div>
            <button
              onClick={() => setFlagMode(!flagMode)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors border ${
                flagMode
                  ? 'bg-amber-900/40 border-amber-700/60 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
              }`}
              title={t('minesweeper.flagMode')}
            >
              🚩
            </button>
            <button
              onClick={() => startGame(difficulty)}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700"
            >
              {t('minesweeper.restart')}
            </button>
          </div>

          {/* Grid */}
          <div
            className="inline-grid border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900"
            style={{
              gridTemplateColumns: `repeat(${config.cols}, ${cellSize}px)`,
              gap: '1px',
              backgroundColor: 'var(--color-zinc-800)',
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isClickedMine = clickedMine && clickedMine[0] === r && clickedMine[1] === c;

                let bgClass = 'bg-zinc-800 hover:bg-zinc-700 cursor-pointer';
                let content: React.ReactNode = null;

                if (cell.state === 'revealed') {
                  if (cell.mine) {
                    bgClass = isClickedMine
                      ? 'bg-red-900/80'
                      : 'bg-zinc-900/80';
                    content = <span className="text-base">💣</span>;
                  } else {
                    bgClass = 'bg-zinc-900/60 cursor-default';
                    if (cell.adjacent > 0) {
                      content = (
                        <span className={`font-bold text-sm ${NUM_COLORS[cell.adjacent] ?? 'text-zinc-400'}`}>
                          {cell.adjacent}
                        </span>
                      );
                    }
                  }
                } else if (cell.state === 'flagged') {
                  bgClass = 'bg-zinc-800 cursor-pointer';
                  content = <span className="text-sm">🚩</span>;
                }

                const gameOver = phase === 'won' || phase === 'lost' || phase === 'paused';

                // Staggered pop animation for flood-revealed cells (max 300ms total delay)
                const revealAnim = cell.state === 'revealed' && !cell.mine && cell.revealOrder >= 0
                  ? { animation: `ms-pop 120ms ease-out ${Math.min(cell.revealOrder * 8, 300)}ms both` }
                  : undefined;

                return (
                  <button
                    key={`${r}-${c}`}
                    className={`flex items-center justify-center transition-colors select-none ${bgClass} ${gameOver ? 'pointer-events-none' : ''}`}
                    style={{ width: cellSize, height: cellSize, fontSize: cellSize * 0.4, ...revealAnim }}
                    onClick={() => handleCellClick(r, c)}
                    onContextMenu={(e) => handleCellRightClick(e, r, c)}
                    disabled={gameOver}
                  >
                    {content}
                  </button>
                );
              }),
            )}
          </div>

          {/* Paused overlay */}
          {phase === 'paused' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <h3 className="text-2xl font-black text-zinc-100">{t('game.paused')}</h3>
              <button
                onClick={() => setPhase('playing')}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Win overlay */}
          {phase === 'won' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <h3 className="text-2xl font-black text-emerald-400">{t('minesweeper.win')}</h3>
              <div className="flex flex-col items-center gap-1 text-zinc-300">
                <span>{t('minesweeper.time')}: <b>{formatTime(elapsed)}</b></span>
                <span className="text-sm text-zinc-500">
                  {t(`minesweeper.diff.${difficulty}`)}
                  {perfectFlags && <span className="text-amber-400 ml-2">{t('minesweeper.perfectFlags')}</span>}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => startGame(difficulty)}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                >
                  {t('minesweeper.playAgain')}
                </button>
                <button
                  onClick={() => setPhase('menu')}
                  className="px-4 py-2.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
                >
                  {t('minesweeper.backToMenu')}
                </button>
              </div>
            </div>
          )}

          {/* Loss overlay */}
          {phase === 'lost' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <h3 className="text-2xl font-black text-rose-400">{t('minesweeper.lose')}</h3>
              <span className="text-sm text-zinc-500">{t(`minesweeper.diff.${difficulty}`)}</span>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => startGame(difficulty)}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                >
                  {t('minesweeper.playAgain')}
                </button>
                <button
                  onClick={() => setPhase('menu')}
                  className="px-4 py-2.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
                >
                  {t('minesweeper.backToMenu')}
                </button>
              </div>
            </div>
          )}

          {/* Controls hint */}
          <div className="text-xs text-zinc-600">
            {t('minesweeper.controlsHint')}
          </div>

          {/* Personal best list for current difficulty */}
          <ScoreboardPanel
            gameId={`minesweeper-${difficulty}`}
            scores={pbMap[difficulty].scores}
            lastInsertId={pbMap[difficulty].lastInsertId}
            isNewBest={pbMap[difficulty].isNewBest}
            onClear={pbMap[difficulty].clear}
          />
        </div>
      )}
    </div>
  );
}
