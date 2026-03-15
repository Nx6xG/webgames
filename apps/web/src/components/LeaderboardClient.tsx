'use client';

import Link from 'next/link';
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
    { key: 'overall',    label: t('leaderboard.overall') },
    // Game names reuse their lobby title keys so translations stay consistent.
    { key: 'tictactoe',  label: t('lobby.games.tictactoe.title') },
    { key: 'connect4',   label: t('lobby.games.connect4.title') },
    { key: 'rps',        label: t('lobby.games.rps.title') },
    { key: 'chess',      label: t('lobby.games.chess.title') },
    { key: 'battleship', label: t('lobby.games.battleship.title') },
    { key: 'liarsbar',   label: t('lobby.games.liarsbar.title') },
    { key: 'curvefever', label: t('lobby.games.curvefever.title') },
    { key: 'uno',        label: t('lobby.games.uno.title') },
  ];

  return (
    <>
      {/* Breadcrumb header */}
      <header className="border-b border-[var(--cardBorder)] bg-[var(--bg)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('nav.games')}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-bold text-zinc-100">{t('leaderboard.title')}</span>
        </div>
      </header>

      <main className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <div className="max-w-4xl mx-auto px-6 py-16">

          {/* Page header */}
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('leaderboard.platform')}</p>
              <h1 className="text-4xl font-black tracking-tight">{t('leaderboard.title')}</h1>
              <p className="text-zinc-400 mt-2 text-sm">{t('leaderboard.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-zinc-500">{connected ? t('common.live') : t('status.connecting')}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl mb-6 max-w-full overflow-x-auto">
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
                  <th className="py-3 px-4 text-left   text-xs uppercase tracking-wider text-zinc-500 font-semibold w-16">{t('leaderboard.rank')}</th>
                  <th className="py-3 px-4 text-left   text-xs uppercase tracking-wider text-zinc-500 font-semibold">{t('leaderboard.player')}</th>
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
                      {connected ? t('leaderboard.empty') : t('status.connecting')}
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
    </>
  );
}
