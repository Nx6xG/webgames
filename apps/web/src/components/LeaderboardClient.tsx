'use client';

import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { LBTab } from '@/hooks/useLeaderboard';
import { useI18n } from '@/components/providers/LanguageProvider';

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fmt(winrate: number) {
  return winrate % 1 === 0 ? `${winrate}%` : `${winrate.toFixed(1)}%`;
}

export function LeaderboardClient({ wsUrl }: { wsUrl: string }) {
  const { entries, connected, tab, changeTab } = useLeaderboard(wsUrl);
  const { t } = useI18n();

  const TABS: { key: LBTab; label: string }[] = [
    { key: 'overall',   label: t('leaderboard.overall') },
    { key: 'tictactoe', label: 'Tic-Tac-Toe' },
    { key: 'connect4',  label: 'Connect Four' },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* Page header */}
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">Platform</p>
            <h1 className="text-4xl font-black tracking-tight">{t('leaderboard.title')}</h1>
            <p className="text-zinc-400 mt-2 text-sm">Top players ranked by total wins.</p>
          </div>
          <div className="flex items-center gap-2 text-xs shrink-0">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-zinc-500">{connected ? 'Live' : t('status.connecting')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl mb-6 w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[var(--cardBorder)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--card)]">
                <th className="py-3 px-4 text-left   text-xs uppercase tracking-wider text-zinc-500 font-semibold w-16">Rank</th>
                <th className="py-3 px-4 text-left   text-xs uppercase tracking-wider text-zinc-500 font-semibold">Player</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t('leaderboard.wins')}</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t('leaderboard.games')}</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t('leaderboard.winrate')}</th>
                <th className="py-3 px-4 text-center text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t('leaderboard.streak')}</th>
              </tr>
            </thead>
            <tbody className="bg-[var(--bg)]">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-600 text-sm">
                    {connected ? 'No games played yet — be the first!' : t('status.connecting')}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isYou = entry.isYou === true;
                  return (
                    <tr
                      key={`${entry.rank}-${entry.nickname}`}
                      className={[
                        'border-t transition-colors',
                        isYou
                          ? 'border-indigo-700/50 bg-indigo-950/30 hover:bg-indigo-950/50'
                          : 'border-zinc-800/60 hover:bg-zinc-800/30',
                      ].join(' ')}
                    >
                      <td className="py-3 px-4 tabular-nums text-zinc-400 font-medium">
                        {RANK_MEDAL[entry.rank] ?? `#${entry.rank}`}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span className={isYou ? 'text-indigo-300' : undefined}>{entry.nickname}</span>
                        {isYou && (
                          <span className="ml-1.5 text-xs text-zinc-500 font-normal">(you)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-indigo-300 font-semibold">
                        {entry.wins}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-zinc-400">
                        {entry.games}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-emerald-400 font-medium">
                        {fmt(entry.winrate)}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-amber-400">
                        {entry.streak > 0 ? `🔥 ${entry.streak}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
