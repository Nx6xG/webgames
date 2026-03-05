'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import {
  loadLeaderboardData,
  MULTIPLAYER_GAME_IDS,
  SINGLEPLAYER_GAME_IDS,
  GAME_EMOJI,
} from '@/lib/localStats';
import type { GameLeaderboardData } from '@/lib/localStats';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  if (!ts || ts < 1e10) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

type Tab = 'all' | 'multiplayer' | 'singleplayer';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<GameLeaderboardData[] | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => { setData(loadLeaderboardData()); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((g) => {
      if (tab === 'multiplayer') return (MULTIPLAYER_GAME_IDS as readonly string[]).includes(g.gameId);
      if (tab === 'singleplayer') return (SINGLEPLAYER_GAME_IDS as readonly string[]).includes(g.gameId);
      return true;
    });
  }, [data, tab]);

  // Separate into games with data vs without
  const withData = filtered.filter((g) => g.plays > 0 || g.bestScore !== null || g.bestTime !== null);
  const noData = filtered.filter((g) => g.plays === 0 && g.bestScore === null && g.bestTime === null);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[var(--card)]">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{t('leaderboards.title')}</h1>
              <p className="text-sm text-zinc-500">{t('leaderboards.subtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg w-fit mb-6">
          {(['all', 'multiplayer', 'singleplayer'] as Tab[]).map((v) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                tab === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'all'
                ? t('achievements.filter.all')
                : v === 'multiplayer'
                  ? t('leaderboards.multiplayer')
                  : t('leaderboards.singleplayer')}
            </button>
          ))}
        </div>

        {/* Game cards with data */}
        {withData.length > 0 && (
          <div className="space-y-6">
            {withData.map((g) => (
              <GameLeaderboardCard key={g.gameId} data={g} t={t} />
            ))}
          </div>
        )}

        {/* Games without data */}
        {noData.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              {t('leaderboards.noStats')}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {noData.map((g) => (
                <div
                  key={g.gameId}
                  className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 flex items-center gap-2 opacity-50"
                >
                  <span className="text-lg">{GAME_EMOJI[g.gameId] ?? '🎮'}</span>
                  <span className="text-sm text-zinc-500 truncate">{t(`game.name.${g.gameId}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completely empty */}
        {withData.length === 0 && noData.length === 0 && (
          <p className="text-center text-zinc-500 py-12">{t('leaderboards.noStats')}</p>
        )}
      </div>
    </div>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────────

function GameLeaderboardCard({ data, t }: { data: GameLeaderboardData; t: (k: string) => string }) {
  const emoji = GAME_EMOJI[data.gameId] ?? '🎮';
  const name = t(`game.name.${data.gameId}`);
  const hasRuns = data.topRuns.length > 0;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3 border-b border-zinc-700/30">
        <span className="text-2xl">{emoji}</span>
        <h3 className="font-bold text-lg">{name}</h3>
      </div>

      {/* Stats row */}
      <div className="px-5 py-4 flex flex-wrap gap-x-6 gap-y-2">
        <MiniStat label={t('leaderboards.gamesPlayed')} value={data.plays} />
        <MiniStat label={t('leaderboards.wins')} value={data.wins} />
        <MiniStat label={t('leaderboards.winRate')} value={`${data.winRate}%`} />
        {data.bestScore !== null && (
          <MiniStat label={t('leaderboards.bestScore')} value={data.bestScore.toLocaleString()} highlight />
        )}
        {data.bestTile !== null && (
          <MiniStat label={t('leaderboards.bestTile')} value={data.bestTile} highlight />
        )}
        {data.bestLines !== null && (
          <MiniStat label={t('leaderboards.bestLines')} value={data.bestLines} highlight />
        )}
        {data.bestTime !== null && (
          <MiniStat label={t('leaderboards.bestTime')} value={formatTime(data.bestTime)} highlight />
        )}
      </div>

      {/* Top runs table */}
      {hasRuns && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            {t('leaderboards.topRuns')}
          </p>
          <div className="rounded-lg border border-zinc-700/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-800/60 text-zinc-500 text-xs">
                  <th className="text-left px-3 py-1.5 font-medium w-10">#</th>
                  <th className="text-left px-3 py-1.5 font-medium">{t('leaderboards.score')}</th>
                  <th className="text-left px-3 py-1.5 font-medium hidden sm:table-cell">{t('leaderboards.date')}</th>
                  {data.topRuns.some((r) => r.extra) && (
                    <th className="text-left px-3 py-1.5 font-medium hidden md:table-cell">Info</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.topRuns.map((run, i) => (
                  <tr
                    key={i}
                    className={`border-t border-zinc-700/20 ${i === 0 ? 'text-yellow-400' : 'text-zinc-300'}`}
                  >
                    <td className="px-3 py-1.5 font-bold text-zinc-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-semibold tabular-nums">{run.score.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-zinc-500 hidden sm:table-cell">{formatDate(run.date)}</td>
                    {data.topRuns.some((r) => r.extra) && (
                      <td className="px-3 py-1.5 text-zinc-500 text-xs hidden md:table-cell">{run.extra ?? ''}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-indigo-400' : ''}`}>{value}</p>
    </div>
  );
}
