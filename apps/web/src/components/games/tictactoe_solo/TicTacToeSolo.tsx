'use client';

import { useEffect, useRef, useState } from 'react';
import { getAIMove, checkWinner } from './ai';
import {
  emptyStats, loadStats, saveStats, updateStats, totalGames,
} from './stats';
import type { Board, Difficulty, GameConfig, GameMode, GameStatus, Mark } from './types';
import type { TttStats } from './stats';
import { useAchievements } from '@/hooks/useAchievements';

// ── Module-level helpers ───────────────────────────────────────────────────────

function opposite(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}

function randomMark(): Mark {
  return Math.random() < 0.5 ? 'X' : 'O';
}

function computeStatus(board: Board, lastMark: Mark): GameStatus {
  const line = checkWinner(board, lastMark);
  if (line) return { kind: 'won', winner: lastMark, line };
  if (board.every(c => c !== null)) return { kind: 'draw' };
  return { kind: 'playing', turn: opposite(lastMark) };
}

const EMPTY_BOARD: Board = Array(9).fill(null) as Board;

// ── Component ──────────────────────────────────────────────────────────────────

export function TicTacToeSolo() {
  const ach = useAchievements('tictactoe-solo');

  // ── Config-screen form state ─────────────────────────────────────────────────
  const [formMode, setFormMode] = useState<GameMode>('pvp');
  const [formDiff, setFormDiff] = useState<Difficulty>('normal');
  const [formMark, setFormMark] = useState<Mark>('X');

  // ── Game state (null config = config screen) ─────────────────────────────────
  const [config, setConfig]             = useState<GameConfig | null>(null);
  const [board, setBoard]               = useState<Board>(EMPTY_BOARD);
  const [currentTurn, setCurrentTurn]   = useState<Mark>('X');
  const [status, setStatus]             = useState<GameStatus>({ kind: 'playing', turn: 'X' });
  const [isAIThinking, setIsAIThinking] = useState(false);

  // ── Stats state ───────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<TttStats>(emptyStats);
  // savedRef prevents double-saving the same game result
  const savedRef = useRef<boolean>(false);

  // ── Load stats from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    setStats(loadStats());
  }, []);

  // ── Save stats when a game ends (fires once per game via savedRef) ────────────
  useEffect(() => {
    if (!config) return;
    if (status.kind === 'playing') return;
    if (savedRef.current) return;
    savedRef.current = true;
    // status is narrowed to 'won' | 'draw' here — compatible with EndedStatus
    const newStats = updateStats(stats, config, status);
    setStats(newStats);
    saveStats(newStats);
  }, [status.kind, config, stats]);

  // ── Achievement tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (config) {
      ach.trackPlay();
      if (config.mode === 'pvp') ach.trackEvent({ type: 'flag', key: 'ttt_offline_local' });
      if (config.mode === 'ai') ach.trackEvent({ type: 'flag', key: 'ttt_offline_ai' });
    }
    if (!config) ach.reset();
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status.kind === 'won' && config?.mode === 'ai' && status.winner === config.humanMark) {
      ach.trackWin();
      ach.trackEvent({ type: 'flag', key: `ttt_offline_ai_${config.difficulty}_win` });
    }
    if (status.kind === 'won' && config?.mode === 'pvp') {
      ach.trackWin();
    }
  }, [status.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function launchGame(cfg: GameConfig) {
    savedRef.current = false;
    const first = randomMark();
    setConfig(cfg);
    setBoard(EMPTY_BOARD);
    setCurrentTurn(first);
    setStatus({ kind: 'playing', turn: first });
    setIsAIThinking(false);
  }

  function handleStart() {
    launchGame({ mode: formMode, difficulty: formDiff, humanMark: formMark });
  }

  function playAgain() {
    if (!config) return;
    launchGame(config);
  }

  function goBack() {
    setConfig(null);
  }

  function handleResetStats() {
    if (!confirm('Really reset all stats?')) return;
    const fresh = emptyStats();
    setStats(fresh);
    saveStats(fresh);
  }

  // ── Human move ────────────────────────────────────────────────────────────────

  function handleCellClick(idx: number) {
    if (!config) return;
    if (status.kind !== 'playing') return;
    if (board[idx] !== null) return;
    if (isAIThinking) return;
    if (config.mode === 'ai' && currentTurn !== config.humanMark) return;

    const newBoard  = [...board] as Board;
    newBoard[idx]   = currentTurn;
    const newStatus = computeStatus(newBoard, currentTurn);
    setBoard(newBoard);
    setStatus(newStatus);
    if (newStatus.kind === 'playing') setCurrentTurn(newStatus.turn);
  }

  // ── AI turn ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!config || config.mode !== 'ai') return;
    if (status.kind !== 'playing') return;

    const aiMark = opposite(config.humanMark);
    if (currentTurn !== aiMark) return;

    setIsAIThinking(true);
    const delayMs = 250 + Math.random() * 150;

    const id = setTimeout(() => {
      const idx       = getAIMove(board, aiMark, config.humanMark, config.difficulty);
      const newBoard  = [...board] as Board;
      newBoard[idx]   = aiMark;
      const newStatus = computeStatus(newBoard, aiMark);
      setBoard(newBoard);
      setStatus(newStatus);
      if (newStatus.kind === 'playing') setCurrentTurn(newStatus.turn);
      setIsAIThinking(false);
    }, delayMs);

    return () => clearTimeout(id);
  }, [config, status.kind, currentTurn, board]);

  // ── Config screen ─────────────────────────────────────────────────────────────

  if (!config) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 px-4 w-full">
        <div className="w-full max-w-[420px] flex flex-col gap-4">
          <h1 className="text-4xl font-black text-zinc-100 tracking-tight">TicTacToe</h1>

          {/* Mode card */}
          <div className="flex flex-col gap-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 p-6">

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Mode</p>
              <div className="flex gap-3">
                <ModeButton
                  active={formMode === 'pvp'}
                  onClick={() => setFormMode('pvp')}
                  label="Local PvP"
                  sub="Two players, same device"
                />
                <ModeButton
                  active={formMode === 'ai'}
                  onClick={() => setFormMode('ai')}
                  label="vs AI"
                  sub="Play against the computer"
                />
              </div>
            </div>

            {formMode === 'ai' && (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Difficulty
                  </p>
                  <SegmentedControl
                    options={DIFF_OPTIONS}
                    value={formDiff}
                    onChange={setFormDiff}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Play as
                  </p>
                  <SegmentedControl
                    options={MARK_OPTIONS}
                    value={formMark}
                    onChange={setFormMark}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleStart}
              className="mt-1 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Start Game
            </button>
          </div>

          {/* Stats panel */}
          <ConfigStatsPanel stats={stats} onReset={handleResetStats} />

          <p className="text-xs text-zinc-600 text-center">
            Starting player is chosen randomly each game
          </p>
        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────────

  const aiMark: Mark | null = config.mode === 'ai' ? opposite(config.humanMark) : null;

  const statusText =
    status.kind === 'won'   ? `${status.winner} wins!` :
    status.kind === 'draw'  ? 'Draw!' :
    isAIThinking            ? 'AI is thinking…' :
    config.mode === 'ai'    ? (currentTurn === config.humanMark ? 'Your turn' : "AI's turn") :
    `${currentTurn}'s turn`;

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 w-full">
      <div className="w-full max-w-[420px] flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black text-zinc-100 tracking-tight mr-auto">TicTacToe</span>
          {config.mode === 'ai' && (
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 capitalize">
              {config.difficulty}
            </span>
          )}
          <button
            onClick={goBack}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm font-semibold transition-colors shrink-0"
          >
            ← Back
          </button>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-2 min-h-[1.5rem]">
          <span className={`text-sm font-semibold ${
            status.kind === 'won'  ? 'text-emerald-400' :
            status.kind === 'draw' ? 'text-zinc-400'    : 'text-zinc-300'
          }`}>
            {statusText}
          </span>
          {isAIThinking && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
          )}
        </div>

        {/* Board */}
        <div className="relative">
          <div className="grid grid-cols-3 gap-2">
            {board.map((cell, i) => {
              const isWinCell = status.kind === 'won' && status.line.includes(i);
              const canClick  =
                cell === null &&
                status.kind === 'playing' &&
                !isAIThinking &&
                (config.mode !== 'ai' || currentTurn === config.humanMark);

              return (
                <button
                  key={i}
                  onClick={() => handleCellClick(i)}
                  disabled={!canClick}
                  aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ''}`}
                  className={[
                    'aspect-square flex items-center justify-center rounded-xl border',
                    'text-5xl font-black transition-all duration-150 select-none',
                    isWinCell
                      ? 'bg-emerald-900/40 border-emerald-700/60'
                      : cell !== null
                      ? 'bg-zinc-800/60 border-zinc-700/40'
                      : canClick
                      ? 'bg-zinc-800/80 border-zinc-700/40 hover:bg-zinc-700/60 hover:border-zinc-600/60 cursor-pointer'
                      : 'bg-zinc-800/40 border-zinc-700/30 cursor-default',
                    isAIThinking && cell === null && status.kind === 'playing'
                      ? 'cursor-wait'
                      : '',
                  ].join(' ')}
                >
                  {cell && (
                    <span className={cell === 'X' ? 'text-indigo-400' : 'text-rose-400'}>
                      {cell}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* End-of-game overlay */}
          {status.kind !== 'playing' && (
            <div className="absolute inset-0 rounded-xl bg-zinc-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 z-10">
              <p className="text-2xl font-black text-zinc-100">
                {status.kind === 'won' ? `${status.winner} wins!` : 'Draw!'}
              </p>
              {status.kind === 'won' && config.mode === 'ai' && (
                <p className="text-sm text-zinc-400">
                  {status.winner === config.humanMark ? 'You win!' : `${aiMark} wins!`}
                </p>
              )}
              <div className="flex gap-3 mt-1">
                <button
                  onClick={playAgain}
                  className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={goBack}
                  className="px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm font-semibold transition-colors"
                >
                  Change Mode
                </button>
              </div>
            </div>
          )}
        </div>

        {/* In-game stats bar */}
        <GameStatsBar stats={stats} config={config} />

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModeButton({
  active,
  onClick,
  label,
  sub,
}: {
  active:  boolean;
  onClick: () => void;
  label:   string;
  sub:     string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left',
        active
          ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200'
          : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
      ].join(' ')}
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="text-xs opacity-70">{sub}</span>
    </button>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options:  { value: T; label: string }[];
  value:    T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 py-1.5 text-xs rounded-md font-medium transition-colors',
            value === opt.value
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Full stats panel shown on the config screen. */
function ConfigStatsPanel({
  stats,
  onReset,
}: {
  stats:   TttStats;
  onReset: () => void;
}) {
  const total = totalGames(stats);

  return (
    <div className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800 p-4">

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Stats
        </span>
        {total > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">

        {/* Local PvP */}
        <div className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-zinc-500">Local</span>
          <span className="font-semibold tabular-nums text-indigo-400">{stats.local.xWins}</span>
          <span className="text-zinc-600 text-[10px]">X</span>
          <span className="text-zinc-700 mx-0.5">·</span>
          <span className="font-semibold tabular-nums text-rose-400">{stats.local.oWins}</span>
          <span className="text-zinc-600 text-[10px]">O</span>
          <span className="text-zinc-700 mx-0.5">·</span>
          <span className="font-semibold tabular-nums text-zinc-500">{stats.local.draws}</span>
          <span className="text-zinc-600 text-[10px]">D</span>
          {stats.local.games > 0 && (
            <span className="ml-auto text-zinc-700 tabular-nums">{stats.local.games}G</span>
          )}
        </div>

        {/* AI difficulty rows */}
        {((['easy', 'normal', 'hard'] as const)).map(diff => {
          const s = stats.ai[diff];
          return (
            <div key={diff} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 text-zinc-500 capitalize">{diff}</span>
              <span className="font-semibold tabular-nums text-emerald-400">{s.wins}</span>
              <span className="text-zinc-600 text-[10px]">W</span>
              <span className="text-zinc-700 mx-0.5">·</span>
              <span className="font-semibold tabular-nums text-rose-400">{s.losses}</span>
              <span className="text-zinc-600 text-[10px]">L</span>
              <span className="text-zinc-700 mx-0.5">·</span>
              <span className="font-semibold tabular-nums text-zinc-500">{s.draws}</span>
              <span className="text-zinc-600 text-[10px]">D</span>
              {s.games > 0 && (
                <span className="ml-auto text-zinc-700 tabular-nums">{s.games}G</span>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}

/** Compact stats bar shown below the board during a game. */
function GameStatsBar({
  stats,
  config,
}: {
  stats:  TttStats;
  config: GameConfig;
}) {
  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 px-4 py-2.5">
      {config.mode === 'pvp' ? (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Local PvP
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span>
              <span className="font-bold tabular-nums text-indigo-400">{stats.local.xWins}</span>
              <span className="text-zinc-600 ml-0.5">X</span>
            </span>
            <span>
              <span className="font-bold tabular-nums text-rose-400">{stats.local.oWins}</span>
              <span className="text-zinc-600 ml-0.5">O</span>
            </span>
            <span>
              <span className="font-bold tabular-nums text-zinc-500">{stats.local.draws}</span>
              <span className="text-zinc-600 ml-0.5">D</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 capitalize">
            vs AI · {config.difficulty}
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span>
              <span className="font-bold tabular-nums text-emerald-400">
                {stats.ai[config.difficulty].wins}
              </span>
              <span className="text-zinc-600 ml-0.5">W</span>
            </span>
            <span>
              <span className="font-bold tabular-nums text-rose-400">
                {stats.ai[config.difficulty].losses}
              </span>
              <span className="text-zinc-600 ml-0.5">L</span>
            </span>
            <span>
              <span className="font-bold tabular-nums text-zinc-500">
                {stats.ai[config.difficulty].draws}
              </span>
              <span className="text-zinc-600 ml-0.5">D</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Option arrays (module-level to avoid recreating on every render) ───────────

const DIFF_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy',   label: 'Easy'   },
  { value: 'normal', label: 'Normal' },
  { value: 'hard',   label: 'Hard'   },
];

const MARK_OPTIONS: { value: Mark; label: string }[] = [
  { value: 'X', label: 'X' },
  { value: 'O', label: 'O' },
];
