'use client';

import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { GameStats } from 'shared';

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect Four',
};

interface Row {
  key: string;
  label: string;
  played: number;
  p0: number;
  p1: number;
  draws: number;
}

function pct(wins: number, played: number) {
  if (played === 0) return '—';
  return `${Math.round((wins / played) * 100)}%`;
}

function StatsRow({ row, isTotal }: { row: Row; isTotal?: boolean }) {
  const base = isTotal
    ? 'border-t border-zinc-700 font-semibold text-zinc-100'
    : 'border-t border-zinc-800/60 text-zinc-300 hover:bg-zinc-800/30 transition-colors';
  return (
    <tr className={base}>
      <td className="py-3 px-4 text-left">
        {isTotal ? (
          <span className="text-indigo-300">{row.label}</span>
        ) : (
          row.label
        )}
      </td>
      <td className="py-3 px-4 text-center tabular-nums">{row.played}</td>
      <td className="py-3 px-4 text-center tabular-nums text-amber-300">{row.p0}</td>
      <td className="py-3 px-4 text-center tabular-nums text-rose-300">{row.p1}</td>
      <td className="py-3 px-4 text-center tabular-nums text-zinc-400">{row.draws}</td>
      <td className="py-3 px-4 text-center tabular-nums text-amber-400">{pct(row.p0, row.played)}</td>
      <td className="py-3 px-4 text-center tabular-nums text-rose-400">{pct(row.p1, row.played)}</td>
    </tr>
  );
}

export function LeaderboardClient({ wsUrl }: { wsUrl: string }) {
  const { stats, connected } = useLeaderboard(wsUrl);

  const gameIds = stats ? (Object.keys(stats) as string[]) : [];

  const rows: Row[] = gameIds.map((id) => {
    const s: GameStats = stats![id as keyof typeof stats];
    return {
      key: id,
      label: GAME_LABELS[id] ?? id,
      played: s.gamesPlayed,
      p0: s.winsByPlayerIndex[0],
      p1: s.winsByPlayerIndex[1],
      draws: s.draws,
    };
  });

  const total: Row = rows.reduce(
    (acc, r) => ({
      key: 'total',
      label: 'All Games',
      played: acc.played + r.played,
      p0: acc.p0 + r.p0,
      p1: acc.p1 + r.p1,
      draws: acc.draws + r.draws,
    }),
    { key: 'total', label: 'All Games', played: 0, p0: 0, p1: 0, draws: 0 },
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Page header */}
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Platform</p>
            <h1 className="text-4xl font-black tracking-tight">Leaderboard</h1>
            <p className="text-zinc-400 mt-2 text-sm">Aggregate stats across all games — no accounts needed.</p>
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-zinc-500">
              {connected ? 'Updates live while games are played' : 'Connecting…'}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900">
                <th className="py-3 px-4 text-left text-xs uppercase tracking-wider text-zinc-500 font-semibold">Game</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">Played</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-amber-600 font-semibold">P1 Wins</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-rose-600 font-semibold">P2 Wins</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">Draws</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-amber-600 font-semibold">P1 Win %</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-rose-600 font-semibold">P2 Win %</th>
              </tr>
            </thead>
            <tbody className="bg-zinc-950">
              {!stats ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-600 text-sm">
                    {connected ? 'Loading stats…' : 'Connecting to server…'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-600 text-sm">No games played yet. Be the first!</td>
                </tr>
              ) : (
                <>
                  {rows.map((row) => <StatsRow key={row.key} row={row} />)}
                  <StatsRow row={total} isTotal />
                </>
              )}
            </tbody>
          </table>
        </div>

        {total.played > 0 && (
          <p className="mt-4 text-center text-xs text-zinc-600">
            {total.played} game{total.played !== 1 ? 's' : ''} played on the platform
          </p>
        )}
      </div>
    </main>
  );
}
