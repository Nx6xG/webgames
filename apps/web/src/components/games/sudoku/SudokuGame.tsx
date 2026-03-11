'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSudoku } from './generator';
import { emptyStats, loadStats, saveStats, totalGames, updateStats } from './stats';
import type { Board, Difficulty, GamePhase } from './types';
import type { SudokuStats } from './stats';
import { useAchievements } from '@/hooks/useAchievements';
import { useI18n } from '@/components/providers/LanguageProvider';
import { createSeededRng } from '@/lib/seededRandom';
import { useVisibilityPause } from '@/hooks/useVisibilityPause';
import { getTodayStr } from '@/lib/dailyChallenges/definitions';

const MAX_LIVES = 3;

// ── Module-level helpers ───────────────────────────────────────────────────────

/** Returns the set of cell keys ("r,c") that are in conflict. */
function computeConflicts(board: Board): Set<string> {
  const out = new Set<string>();

  const mark = (keys: string[]) => keys.forEach(k => out.add(k));

  // Rows
  for (let r = 0; r < 9; r++) {
    const seen = new Map<number, string[]>();
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      const list = seen.get(v) ?? [];
      list.push(`${r},${c}`);
      seen.set(v, list);
    }
    for (const list of seen.values()) if (list.length > 1) mark(list);
  }

  // Columns
  for (let c = 0; c < 9; c++) {
    const seen = new Map<number, string[]>();
    for (let r = 0; r < 9; r++) {
      const v = board[r][c];
      if (v === 0) continue;
      const list = seen.get(v) ?? [];
      list.push(`${r},${c}`);
      seen.set(v, list);
    }
    for (const list of seen.values()) if (list.length > 1) mark(list);
  }

  // Boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Map<number, string[]>();
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          const v = board[r][c];
          if (v === 0) continue;
          const list = seen.get(v) ?? [];
          list.push(`${r},${c}`);
          seen.set(v, list);
        }
      }
      for (const list of seen.values()) if (list.length > 1) mark(list);
    }
  }

  return out;
}

function isBoardSolved(board: Board): boolean {
  for (const row of board) for (const v of row) if (v === 0) return false;
  return computeConflicts(board).size === 0;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatBestTime(sec: number | null): string {
  if (sec === null) return '—';
  return formatTime(sec);
}

// ── Notes helpers ─────────────────────────────────────────────────────────────

/** 9×9 grid of Sets — each Set contains the candidate digits (1–9) for that cell. */
export type Notes = Set<number>[][];

export function emptyNotes(): Notes {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set<number>()));
}

function copyNotes(notes: Notes): Notes {
  return notes.map(row => row.map(s => new Set(s)));
}

/**
 * After placing digit `n` at (r, c):
 *  - clear all notes on that cell
 *  - remove `n` from notes in the same row, column, and 3×3 box
 */
function autoCleanNotes(notes: Notes, r: number, c: number, n: number): Notes {
  const nb = copyNotes(notes);
  nb[r][c] = new Set<number>();
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 9; i++) {
    nb[r][i].delete(n);
    nb[i][c].delete(n);
  }
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      nb[i][j].delete(n);
    }
  }
  return nb;
}

// ── Static data ────────────────────────────────────────────────────────────────

const DIFFICULTIES: { value: Difficulty; label: string; sub: string }[] = [
  { value: 'easy',   label: 'Easy',   sub: '~40 prefilled' },
  { value: 'medium', label: 'Medium', sub: '~32 prefilled' },
  { value: 'hard',   label: 'Hard',   sub: '~26 prefilled' },
  { value: 'expert', label: 'Expert', sub: '~22 prefilled' },
];

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function SudokuGame() {
  const { t } = useI18n();
  const ach = useAchievements('sudoku');

  // ── Config form state ─────────────────────────────────────────────────────────
  const [formDiff, setFormDiff] = useState<Difficulty>('medium');

  // ── Game state ────────────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState<GamePhase>('config');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [puzzle,     setPuzzle]     = useState<Board>(() => Array.from({ length: 9 }, () => Array(9).fill(0)));
  const [solution,   setSolution]   = useState<Board>(() => Array.from({ length: 9 }, () => Array(9).fill(0)));
  const [prefilled,  setPrefilled]  = useState<boolean[][]>(() => Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [origPuzzle, setOrigPuzzle] = useState<Board>(() => Array.from({ length: 9 }, () => Array(9).fill(0)));
  const [selected,   setSelected]   = useState<[number, number] | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // ── Notes state ───────────────────────────────────────────────────────────────
  const [notesMode, setNotesMode] = useState<boolean>(false);
  const [notes,     setNotes]     = useState<Notes>(emptyNotes);

  // ── Lives state ─────────────────────────────────────────────────────────────
  const [lives, setLives] = useState(MAX_LIVES);
  const [shakeCell, setShakeCell] = useState<string | null>(null);   // "r,c" key
  const [lifeLostToast, setLifeLostToast] = useState(false);
  const [wrongCells, setWrongCells] = useState<Set<string>>(() => new Set());

  // ── Stats state ───────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<SudokuStats>(emptyStats);
  const savedRef = useRef<boolean>(false);

  // ── Load stats on mount ───────────────────────────────────────────────────────
  useEffect(() => { setStats(loadStats()); }, []);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing') ach.trackPlay();
    if (phase === 'won') {
      ach.trackWin();
      ach.trackEvent({ type: 'flag', key: `sudoku_${difficulty}` });
    }
    if (phase === 'config') ach.reset();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Auto-pause on tab switch ──────────────────────────────────────────
  useVisibilityPause(phase === 'playing', useCallback(() => setPhase('paused'), []));

  // ── Save stats on win ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'won' || savedRef.current) return;
    savedRef.current = true;
    const newStats = updateStats(stats, difficulty, elapsedSec);
    setStats(newStats);
    saveStats(newStats);
  }, [phase, difficulty, elapsedSec, stats]);

  // ── Lives helpers ────────────────────────────────────────────────────────────
  /** Check if placing `n` at (r,c) is wrong. If so, deduct a life and animate. */
  const penalizeWrong = useCallback((r: number, c: number, n: number): boolean => {
    if (n === solution[r][c]) return false;           // correct — no penalty
    if (n === puzzle[r][c]) return false;              // same wrong value already there — no double-penalty
    const key = `${r},${c}`;
    setShakeCell(key);
    setLifeLostToast(true);
    setTimeout(() => setShakeCell(null), 500);
    setTimeout(() => setLifeLostToast(false), 1800);
    setLives(prev => {
      const next = prev - 1;
      if (next <= 0) setTimeout(() => setPhase('gameOver'), 60);
      return next;
    });
    return true;
  }, [solution, puzzle]);

  /** Update wrongCells after placing value `n` at (r,c). Call AFTER penalizeWrong. */
  const updateWrongMark = useCallback((r: number, c: number, n: number) => {
    const key = `${r},${c}`;
    if (n === solution[r][c]) {
      // Correct → remove from wrong set
      setWrongCells(prev => { const next = new Set(prev); next.delete(key); return next; });
    } else {
      // Wrong → add to wrong set
      setWrongCells(prev => new Set(prev).add(key));
    }
  }, [solution]);

  /** Remove cell from wrongCells when cleared. */
  const clearWrongMark = useCallback((r: number, c: number) => {
    const key = `${r},${c}`;
    setWrongCells(prev => { const next = new Set(prev); next.delete(key); return next; });
  }, []);

  // ── Keyboard input ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'n' || e.key === 'N') {
        setNotesMode(m => !m);
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        if (!selected) return;
        const [r, c] = selected;
        if (prefilled[r][c]) return;
        const n = parseInt(e.key, 10);
        if (notesMode) {
          const nb = copyNotes(notes);
          if (nb[r][c].has(n)) nb[r][c].delete(n);
          else nb[r][c].add(n);
          setNotes(nb);
        } else {
          penalizeWrong(r, c, n);
          updateWrongMark(r, c, n);
          const nb = puzzle.map(row => [...row]);
          nb[r][c] = n;
          setPuzzle(nb);
          setNotes(autoCleanNotes(notes, r, c, n));
          if (isBoardSolved(nb)) setPhase('won');
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (!selected) return;
        const [r, c] = selected;
        if (prefilled[r][c]) return;
        clearWrongMark(r, c);
        const nb = puzzle.map(row => [...row]);
        nb[r][c] = 0;
        setPuzzle(nb);
      } else if (selected) {
        const [r, c] = selected;
        if (e.key === 'ArrowUp')    { e.preventDefault(); setSelected([Math.max(0, r - 1), c]); }
        if (e.key === 'ArrowDown')  { e.preventDefault(); setSelected([Math.min(8, r + 1), c]); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); setSelected([r, Math.max(0, c - 1)]); }
        if (e.key === 'ArrowRight') { e.preventDefault(); setSelected([r, Math.min(8, c + 1)]); }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, selected, puzzle, prefilled, notesMode, notes, penalizeWrong, updateWrongMark, clearWrongMark]);

  // ── Game actions ──────────────────────────────────────────────────────────────

  const [isDaily, setIsDaily] = useState(false);

  function startGame(diff: Difficulty, seed?: string) {
    setPhase('generating');
    setIsDaily(!!seed);
    // Defer heavy generation to let the 'generating' render happen first
    setTimeout(() => {
      const rng = seed ? createSeededRng(seed) : undefined;
      const { puzzle: p, solution: s } = generateSudoku(diff, rng);
      const pre = p.map(row => row.map(v => v !== 0));
      setDifficulty(diff);
      setOrigPuzzle(p.map(row => [...row]));
      setPuzzle(p.map(row => [...row]));
      setSolution(s);
      setPrefilled(pre);
      setSelected(null);
      setElapsedSec(0);
      setNotesMode(false);
      setNotes(emptyNotes());
      setLives(MAX_LIVES);
      setWrongCells(new Set());
      savedRef.current = false;
      setPhase('playing');
    }, 50);
  }

  function handleStart() { startGame(formDiff); }

  function handleDailyPuzzle() {
    startGame('medium', `sudoku_daily_${getTodayStr()}`);
  }

  function handleRestart() {
    savedRef.current = false;
    setPuzzle(origPuzzle.map(row => [...row]));
    setNotes(emptyNotes());
    setSelected(null);
    setElapsedSec(0);
    setLives(MAX_LIVES);
    setWrongCells(new Set());
    setPhase('playing');
  }

  function handleNewPuzzle() { startGame(difficulty); }

  function handleBack() { setPhase('config'); }

  function handleResetStats() {
    if (!confirm('Really reset all stats?')) return;
    const fresh = emptyStats();
    setStats(fresh);
    saveStats(fresh);
  }

  // ── Cell interactions ─────────────────────────────────────────────────────────

  function handleCellClick(r: number, c: number) {
    if (phase !== 'playing') return;
    setSelected([r, c]);
  }

  function handleNumberInput(n: number) {
    if (phase !== 'playing' || !selected) return;
    const [r, c] = selected;
    if (prefilled[r][c]) return;
    if (notesMode) {
      const nb = copyNotes(notes);
      if (nb[r][c].has(n)) nb[r][c].delete(n);
      else nb[r][c].add(n);
      setNotes(nb);
    } else {
      penalizeWrong(r, c, n);
      updateWrongMark(r, c, n);
      const nb = puzzle.map(row => [...row]);
      nb[r][c] = n;
      setPuzzle(nb);
      setNotes(autoCleanNotes(notes, r, c, n));
      if (isBoardSolved(nb)) setPhase('won');
    }
  }

  function handleClearCell() {
    if (phase !== 'playing' || !selected) return;
    const [r, c] = selected;
    if (prefilled[r][c]) return;
    clearWrongMark(r, c);
    const nb = puzzle.map(row => [...row]);
    nb[r][c] = 0;
    setPuzzle(nb);
  }

  function handleHint() {
    if (phase !== 'playing' || !selected) return;
    const [r, c] = selected;
    if (prefilled[r][c]) return;
    clearWrongMark(r, c);
    const hintVal = solution[r][c];
    const nb = puzzle.map(row => [...row]);
    nb[r][c] = hintVal;
    setPuzzle(nb);
    setNotes(autoCleanNotes(notes, r, c, hintVal));
    if (isBoardSolved(nb)) setPhase('won');
  }

  // ── Config screen ─────────────────────────────────────────────────────────────

  if (phase === 'config') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 px-4 w-full">
        <div className="w-full max-w-[420px] flex flex-col gap-4">
          <h1 className="text-4xl font-black text-zinc-100 tracking-tight">Sudoku</h1>

          {/* Difficulty selector */}
          <div className="flex flex-col gap-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Difficulty
            </p>
            <div className="grid grid-cols-2 gap-3">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  onClick={() => setFormDiff(d.value)}
                  className={[
                    'flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left',
                    formDiff === d.value
                      ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200'
                      : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
                  ].join(' ')}
                >
                  <span className="text-sm font-bold">{d.label}</span>
                  <span className="text-xs opacity-70">{d.sub}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleStart}
              className="mt-1 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>

          {/* Daily puzzle */}
          <button
            onClick={handleDailyPuzzle}
            className="w-full py-3 rounded-xl border border-amber-800/50 bg-amber-950/30 hover:bg-amber-950/50 text-amber-300 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>📅</span> {t('daily.puzzle')} <span className="text-xs text-amber-500/70">({t('daily.puzzleHint')})</span>
          </button>

          {/* Stats panel */}
          <StatsPanel stats={stats} onReset={handleResetStats} />
        </div>
      </div>
    );
  }

  // ── Generating screen ─────────────────────────────────────────────────────────

  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-4">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Generating puzzle…</p>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────────

  const conflicts = computeConflicts(puzzle);

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 w-full">
      <div className="w-full max-w-[400px] flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-3xl font-black text-zinc-100 tracking-tight mr-auto">Sudoku</span>
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400">
            {DIFF_LABEL[difficulty]}
          </span>
          {/* Lives */}
          <span className="flex items-center gap-0.5 text-sm" aria-label={`${lives} ${t('sudoku.lives')}`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <span key={i} className={`transition-all duration-300 ${i < lives ? 'text-rose-500 scale-100' : 'text-zinc-700 scale-75'}`}>
                ♥
              </span>
            ))}
          </span>
          <span className="text-sm font-mono tabular-nums text-zinc-300 min-w-[3.5rem] text-right">
            {formatTime(elapsedSec)}
          </span>
          <button
            onClick={handleBack}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Board */}
        <div className="relative w-full">
          <SudokuBoard
            puzzle={puzzle}
            prefilled={prefilled}
            selected={selected}
            conflicts={conflicts}
            notes={notes}
            shakeCell={shakeCell}
            wrongCells={wrongCells}
            onCellClick={handleCellClick}
          />

          {/* Paused overlay */}
          {phase === 'paused' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-10">
              <p className="text-2xl font-black text-zinc-100">{t('game.paused')}</p>
              <button
                onClick={() => setPhase('playing')}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                {t('game.resume')}
              </button>
            </div>
          )}

          {/* Win overlay */}
          {phase === 'won' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-10">
              <p className="text-3xl font-black text-emerald-400">Sudoku solved!</p>
              <p className="text-sm text-zinc-400">
                Time: <span className="font-mono font-semibold text-zinc-200">{formatTime(elapsedSec)}</span>
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleNewPuzzle}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={handleBack}
                  className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm font-semibold transition-colors"
                >
                  New Difficulty
                </button>
              </div>
            </div>
          )}

          {/* Game Over overlay */}
          {phase === 'gameOver' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/90 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-10">
              <p className="text-3xl font-black text-rose-400">{t('sudoku.game_over')}</p>
              <p className="text-sm text-zinc-400">{t('sudoku.no_lives')}</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleRestart}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  {t('sudoku.try_again')}
                </button>
                <button
                  onClick={handleNewPuzzle}
                  className="px-5 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm font-semibold transition-colors"
                >
                  {t('sudoku.new_puzzle')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Life lost toast */}
        {lifeLostToast && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400 text-xs font-semibold animate-pulse">
            <span>♥</span> {t('sudoku.life_lost')}
          </div>
        )}

        {/* Number pad */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-9 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button
                key={n}
                onClick={() => handleNumberInput(n)}
                className="aspect-square flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-200 font-bold text-sm transition-colors select-none"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={handleClearCell}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setNotesMode(m => !m)}
              className={[
                'py-2 rounded-lg border text-xs font-semibold transition-colors',
                notesMode
                  ? 'bg-amber-900/40 border-amber-700/60 text-amber-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700/60 text-zinc-400 hover:text-zinc-200',
              ].join(' ')}
            >
              Notes
            </button>
            <button
              onClick={handleHint}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-amber-500 hover:text-amber-400 text-xs font-semibold transition-colors"
            >
              Hint
            </button>
            <button
              onClick={handleRestart}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-colors"
            >
              Restart
            </button>
            <button
              onClick={handleNewPuzzle}
              className="py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-colors"
            >
              New
            </button>
          </div>
          {notesMode && (
            <p className="text-[10px] text-amber-500/70 text-center -mt-1">
              Notes on — numbers toggle candidates · N to switch
            </p>
          )}
        </div>

        {/* Compact stats bar */}
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 capitalize">
              {DIFF_LABEL[difficulty]}
            </span>
            <div className="flex items-center gap-4 text-xs">
              <span>
                <span className="font-bold tabular-nums text-emerald-400">{stats[difficulty].wins}</span>
                <span className="text-zinc-600 ml-0.5">W</span>
              </span>
              <span>
                <span className="font-bold tabular-nums text-zinc-400">{stats[difficulty].games}</span>
                <span className="text-zinc-600 ml-0.5">G</span>
              </span>
              {stats[difficulty].bestTime !== null && (
                <span>
                  <span className="font-mono font-bold tabular-nums text-indigo-400">
                    {formatBestTime(stats[difficulty].bestTime)}
                  </span>
                  <span className="text-zinc-600 ml-0.5">best</span>
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── SudokuBoard sub-component ─────────────────────────────────────────────────

interface BoardProps {
  puzzle:    Board;
  prefilled: boolean[][];
  selected:  [number, number] | null;
  conflicts: Set<string>;
  notes:     Notes;
  shakeCell: string | null;
  wrongCells: Set<string>;
  onCellClick: (r: number, c: number) => void;
}

function SudokuBoard({ puzzle, prefilled, selected, conflicts, notes, shakeCell, wrongCells, onCellClick }: BoardProps) {
  return (
    // Outer container: 2px border + thick box gap (3px) via bg + rounded
    <div className="grid grid-cols-3 gap-[3px] bg-zinc-500 border-2 border-zinc-500 rounded overflow-hidden select-none">
      {Array.from({ length: 9 }, (_, boxIdx) => {
        const boxRow = Math.floor(boxIdx / 3);
        const boxCol = boxIdx % 3;
        return (
          // Each 3×3 box: 1px cell gap via bg-zinc-700
          <div key={boxIdx} className="grid grid-cols-3 gap-px bg-zinc-700">
            {Array.from({ length: 9 }, (_, cellIdx) => {
              const r = boxRow * 3 + Math.floor(cellIdx / 3);
              const c = boxCol * 3 + (cellIdx % 3);
              const v = puzzle[r][c];
              const key = `${r},${c}`;

              const isSelected  = selected !== null && selected[0] === r && selected[1] === c;
              const isConflict  = conflicts.has(key);
              const isWrong     = wrongCells.has(key);
              const isPre       = prefilled[r][c];

              let inRegion  = false;
              let sameValue = false;
              if (selected !== null) {
                const [sr, sc] = selected;
                inRegion =
                  r === sr ||
                  c === sc ||
                  (Math.floor(r / 3) === Math.floor(sr / 3) &&
                   Math.floor(c / 3) === Math.floor(sc / 3));
                const sv = puzzle[sr][sc];
                sameValue = v !== 0 && sv !== 0 && v === sv && !isSelected;
              }

              // Background priority: selected+wrong > selected > wrong > conflict > sameValue > inRegion > prefilled > normal
              const bg =
                isSelected && isWrong    ? 'bg-rose-900/70'    :
                isSelected && isConflict ? 'bg-rose-900/70'    :
                isSelected               ? 'bg-indigo-800/60'  :
                isWrong                  ? 'bg-rose-950/60'    :
                isConflict               ? 'bg-rose-950/80'    :
                sameValue                ? 'bg-indigo-950/80'  :
                inRegion && isPre        ? 'bg-zinc-800'       :
                inRegion                 ? 'bg-zinc-800/70'    :
                isPre                    ? 'bg-zinc-850'       : 'bg-zinc-900';

              // Text style — wrong cells always red
              const txt =
                isWrong    ? 'text-rose-400 font-bold'    :
                isConflict ? 'text-rose-400 font-bold'    :
                isPre      ? 'text-zinc-100 font-black'   :
                v !== 0    ? 'text-indigo-300 font-semibold' : '';

              const isShaking = shakeCell === key;

              return (
                <button
                  key={key}
                  onClick={() => onCellClick(r, c)}
                  aria-label={`Row ${r + 1} column ${c + 1}${v ? `, value ${v}` : ''}`}
                  className={`aspect-square relative overflow-hidden transition-colors cursor-pointer ${bg}${isShaking ? ' animate-[shake_0.4s_ease-in-out]' : ''}`}
                >
                  {v !== 0 ? (
                    <span className={`absolute inset-0 flex items-center justify-center text-sm ${txt}`}>
                      {v}
                    </span>
                  ) : (
                    <div className="absolute inset-0 grid grid-cols-3 p-[1px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <span
                          key={n}
                          className="flex items-center justify-center leading-none text-zinc-500 font-medium"
                          style={{ fontSize: '0.44rem' }}
                        >
                          {notes[r][c].has(n) ? n : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── StatsPanel sub-component ──────────────────────────────────────────────────

function StatsPanel({ stats, onReset }: { stats: SudokuStats; onReset: () => void }) {
  const total = totalGames(stats);

  return (
    <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Stats</span>
        {total > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-0.5">
          <span />
          <span className="text-right">Games</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Best</span>
        </div>
        {((['easy', 'medium', 'hard', 'expert'] as const)).map(diff => {
          const s = stats[diff];
          return (
            <div key={diff} className="grid grid-cols-4 gap-2 items-center text-xs">
              <span className="text-zinc-500 capitalize">{diff}</span>
              <span className="text-right font-semibold tabular-nums text-zinc-400">{s.games}</span>
              <span className="text-right font-semibold tabular-nums text-emerald-400">{s.wins}</span>
              <span className="text-right font-mono font-semibold tabular-nums text-indigo-400">
                {formatBestTime(s.bestTime)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
