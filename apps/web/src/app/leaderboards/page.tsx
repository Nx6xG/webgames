'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { GAME_EMOJI, MULTIPLAYER_GAME_IDS } from '@/lib/localStats';
import {
  getLeaderboardSummary,
  getLeaderboardByGame,
} from '@/lib/cloudQueries';
import type { LeaderboardRow, LeaderboardSummary } from '@/lib/cloudQueries';
import { LeaderboardList } from '@/components/leaderboards/LeaderboardList';
import { LeaderboardTabs } from '@/components/leaderboards/LeaderboardTabs';
import { LeaderboardEmptyState } from '@/components/leaderboards/LeaderboardEmptyState';
import { LeaderboardSkeleton } from '@/components/leaderboards/LeaderboardSkeleton';

// Game IDs that appear in per-game leaderboard tabs
const GAME_IDS = [...MULTIPLAYER_GAME_IDS] as string[];

export default function LeaderboardsPage() {
  const { t } = useI18n();
  const { user, isSupabaseConfigured } = useAuth();

  // Global summary
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Per-game
  const [selectedGame, setSelectedGame] = useState(GAME_IDS[0]);
  const [gameRows, setGameRows] = useState<LeaderboardRow[]>([]);
  const [loadingGame, setLoadingGame] = useState(false);

  // Load global summary on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    getLeaderboardSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary({ topMostWins: [], topMostPlayed: [], topBestWinrate: [] }); })
      .finally(() => { if (!cancelled) setLoadingSummary(false); });
    return () => { cancelled = true; };
  }, []);

  // Load per-game when selection changes
  const loadGame = useCallback((gameId: string) => {
    setLoadingGame(true);
    getLeaderboardByGame(gameId)
      .then(setGameRows)
      .catch(() => setGameRows([]))
      .finally(() => setLoadingGame(false));
  }, []);

  useEffect(() => { loadGame(selectedGame); }, [selectedGame, loadGame]);

  const gameTabs = GAME_IDS.map((id) => ({
    id,
    label: t(`game.name.${id}`),
    emoji: GAME_EMOJI[id],
  }));

  const hasAnySummaryData =
    summary &&
    (summary.topMostWins.length > 0 ||
      summary.topMostPlayed.length > 0 ||
      summary.topBestWinrate.length > 0);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-[var(--card)]">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{t('leaderboards.title')}</h1>
              <p className="text-sm text-zinc-500">{t('lb.cloudSubtitle')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* ── Not configured or guest ─────────────────────── */}
        {!isSupabaseConfigured && (
          <LeaderboardEmptyState message={t('lb.guestHint')} />
        )}

        {/* ── Loading ─────────────────────────────────────── */}
        {isSupabaseConfigured && loadingSummary && (
          <div className="space-y-6">
            <LeaderboardSkeleton />
            <LeaderboardSkeleton />
          </div>
        )}

        {/* ── Loaded but empty ────────────────────────────── */}
        {isSupabaseConfigured && !loadingSummary && !hasAnySummaryData && (
          <LeaderboardEmptyState message={user ? t('lb.noData') : t('lb.guestHint')} />
        )}

        {/* ── Global sections ─────────────────────────────── */}
        {isSupabaseConfigured && !loadingSummary && hasAnySummaryData && (
          <>
            <section>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {t('lb.global')}
              </h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <LeaderboardList
                  title={t('lb.mostWins')}
                  icon="🏆"
                  rows={summary!.topMostWins}
                  currentUserId={user?.id}
                  emphasis="wins"
                />
                <LeaderboardList
                  title={t('lb.mostPlayed')}
                  icon="🎮"
                  rows={summary!.topMostPlayed}
                  currentUserId={user?.id}
                  emphasis="played"
                />
                <LeaderboardList
                  title={t('lb.bestWinrate')}
                  icon="📈"
                  rows={summary!.topBestWinrate}
                  currentUserId={user?.id}
                  emphasis="winrate"
                />
              </div>
            </section>

            {/* ── Per-game section ─────────────────────────── */}
            <section>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {t('lb.perGame')}
              </h2>
              <LeaderboardTabs
                tabs={gameTabs}
                activeId={selectedGame}
                onChange={setSelectedGame}
              />
              <div className="mt-4">
                {loadingGame ? (
                  <LeaderboardSkeleton />
                ) : gameRows.length > 0 ? (
                  <LeaderboardList
                    title={t(`game.name.${selectedGame}`)}
                    icon={GAME_EMOJI[selectedGame]}
                    rows={gameRows}
                    currentUserId={user?.id}
                    emphasis="wins"
                  />
                ) : (
                  <LeaderboardEmptyState message={t('lb.noGameData')} />
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
