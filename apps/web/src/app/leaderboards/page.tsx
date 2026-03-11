'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { GAME_EMOJI, MULTIPLAYER_GAME_IDS } from '@/lib/localStats';
import {
  getLeaderboardSummary,
  getLeaderboardByGame,
  getSingleplayerLeaderboard,
} from '@/lib/cloudQueries';
import type { LeaderboardRow, LeaderboardSummary } from '@/lib/cloudQueries';
import type { PublicScoreEntry } from '@/lib/personal-scores/types';
import { getScoreConfig } from '@/lib/personal-scores/config';
import { loadScores } from '@/lib/personal-scores/storage';
import type { PersonalScoreEntry } from '@/lib/personal-scores/types';
import { LeaderboardList } from '@/components/leaderboards/LeaderboardList';
import { LeaderboardTabs } from '@/components/leaderboards/LeaderboardTabs';
import { LeaderboardEmptyState } from '@/components/leaderboards/LeaderboardEmptyState';
import { LeaderboardSkeleton } from '@/components/leaderboards/LeaderboardSkeleton';

// ── Constants ──────────────────────────────────────────────────────────────────

type TopTab = 'multiplayer' | 'singleplayer';

const MP_GAME_IDS = [...MULTIPLAYER_GAME_IDS] as string[];

// Singleplayer games with score tracking (keys from SCORE_CONFIGS)
const SP_GAME_IDS = ['flappy', 'snake', 'tetris', '2048', 'breakout'] as const;

// Games with difficulty variants
const SP_DIFFICULTY_GAMES: Record<string, { variants: { id: string; labelKey: string }[] }> = {
  minesweeper: {
    variants: [
      { id: 'minesweeper-easy', labelKey: 'lb.diff.easy' },
      { id: 'minesweeper-medium', labelKey: 'lb.diff.medium' },
      { id: 'minesweeper-hard', labelKey: 'lb.diff.hard' },
    ],
  },
};

// All SP game tabs (regular + difficulty-grouped)
const SP_TABS = [
  ...SP_GAME_IDS.map((id) => ({ id, hasDifficulty: false })),
  ...Object.keys(SP_DIFFICULTY_GAMES).map((id) => ({ id, hasDifficulty: true })),
];

const SP_EMOJI: Record<string, string> = {
  flappy: '🐦',
  snake: '🐍',
  tetris: '🧱',
  '2048': '🔢',
  breakout: '🧱',
  minesweeper: '💣',
};

// ── Page ────────────────────────────────────────────────────────────────────────

export default function LeaderboardsPage() {
  const { t } = useI18n();
  const { user, isSupabaseConfigured } = useAuth();

  const [topTab, setTopTab] = useState<TopTab>('multiplayer');

  // ── Multiplayer state ──────────────────────────────────────────────────────
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [selectedMpGame, setSelectedMpGame] = useState(MP_GAME_IDS[0]);
  const [mpGameRows, setMpGameRows] = useState<LeaderboardRow[]>([]);
  const [loadingMpGame, setLoadingMpGame] = useState(false);

  // ── Singleplayer state ─────────────────────────────────────────────────────
  const [selectedSpGame, setSelectedSpGame] = useState(SP_TABS[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [spMode, setSpMode] = useState<'public' | 'personal'>('public');
  const [spPublicScores, setSpPublicScores] = useState<PublicScoreEntry[]>([]);
  const [spPersonalScores, setSpPersonalScores] = useState<PersonalScoreEntry[]>([]);
  const [loadingSp, setLoadingSp] = useState(false);

  // ── Load multiplayer summary on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingSummary(true);
    getLeaderboardSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setSummary({ topMostWins: [], topMostPlayed: [], topBestWinrate: [] }); })
      .finally(() => { if (!cancelled) setLoadingSummary(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Load multiplayer per-game ──────────────────────────────────────────────
  const loadMpGame = useCallback((gameId: string) => {
    setLoadingMpGame(true);
    getLeaderboardByGame(gameId)
      .then(setMpGameRows)
      .catch(() => setMpGameRows([]))
      .finally(() => setLoadingMpGame(false));
  }, []);

  useEffect(() => {
    if (topTab === 'multiplayer') loadMpGame(selectedMpGame);
  }, [selectedMpGame, loadMpGame, topTab]);

  // ── Resolve actual game ID for SP (handles difficulty variants) ────────────
  const resolvedSpGameId = (() => {
    const diffConfig = SP_DIFFICULTY_GAMES[selectedSpGame];
    if (diffConfig) {
      const diff = selectedDifficulty ?? diffConfig.variants[0].id;
      return diff;
    }
    return selectedSpGame;
  })();

  // ── Load singleplayer scores ───────────────────────────────────────────────
  useEffect(() => {
    if (topTab !== 'singleplayer') return;

    const gameId = resolvedSpGameId;

    // Personal
    setSpPersonalScores(loadScores(gameId));

    // Public
    setLoadingSp(true);
    getSingleplayerLeaderboard(gameId, 25)
      .then(setSpPublicScores)
      .catch(() => setSpPublicScores([]))
      .finally(() => setLoadingSp(false));
  }, [topTab, resolvedSpGameId]);

  // ── When selecting a difficulty game, set default difficulty ────────────────
  useEffect(() => {
    const diffConfig = SP_DIFFICULTY_GAMES[selectedSpGame];
    if (diffConfig) {
      setSelectedDifficulty(diffConfig.variants[0].id);
    } else {
      setSelectedDifficulty(null);
    }
  }, [selectedSpGame]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const mpGameTabs = MP_GAME_IDS.map((id) => ({
    id,
    label: t(`game.name.${id}`),
    emoji: GAME_EMOJI[id],
  }));

  const spGameTabs = SP_TABS.map((g) => ({
    id: g.id,
    label: t(`game.name.${g.id}`),
    emoji: SP_EMOJI[g.id],
  }));

  const hasAnySummaryData =
    summary &&
    (summary.topMostWins.length > 0 ||
      summary.topMostPlayed.length > 0 ||
      summary.topBestWinrate.length > 0);

  const spConfig = getScoreConfig(resolvedSpGameId);
  const formatScore = spConfig?.scoreFormat ?? ((n: number) => n.toLocaleString());

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

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── Top-level tabs: Multiplayer / Singleplayer ───────────────── */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 w-fit">
          {(['multiplayer', 'singleplayer'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTopTab(tab)}
              className={`px-5 py-2 text-sm font-semibold rounded-md transition-colors ${
                topTab === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t(`lb.${tab}`)}
            </button>
          ))}
        </div>

        {/* ════════════════════ MULTIPLAYER TAB ════════════════════════════ */}
        {topTab === 'multiplayer' && (
          <>
            {!isSupabaseConfigured && (
              <LeaderboardEmptyState message={t('lb.guestHint')} />
            )}

            {isSupabaseConfigured && loadingSummary && (
              <div className="space-y-6">
                <LeaderboardSkeleton />
                <LeaderboardSkeleton />
              </div>
            )}

            {isSupabaseConfigured && !loadingSummary && !hasAnySummaryData && (
              <LeaderboardEmptyState message={user ? t('lb.noData') : t('lb.guestHint')} />
            )}

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

                <section>
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    {t('lb.perGame')}
                  </h2>
                  <LeaderboardTabs
                    tabs={mpGameTabs}
                    activeId={selectedMpGame}
                    onChange={setSelectedMpGame}
                  />
                  <div className="mt-4">
                    {loadingMpGame ? (
                      <LeaderboardSkeleton />
                    ) : mpGameRows.length > 0 ? (
                      <LeaderboardList
                        title={t(`game.name.${selectedMpGame}`)}
                        icon={GAME_EMOJI[selectedMpGame]}
                        rows={mpGameRows}
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
          </>
        )}

        {/* ════════════════════ SINGLEPLAYER TAB ══════════════════════════ */}
        {topTab === 'singleplayer' && (
          <>
            {/* Game selector */}
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                {t('lb.perGame')}
              </h2>
              <LeaderboardTabs
                tabs={spGameTabs}
                activeId={selectedSpGame}
                onChange={setSelectedSpGame}
              />
            </div>

            {/* Difficulty selector (if applicable) */}
            {SP_DIFFICULTY_GAMES[selectedSpGame] && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {t('lb.difficulty')}
                </span>
                <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  {SP_DIFFICULTY_GAMES[selectedSpGame].variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedDifficulty(v.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        (selectedDifficulty ?? SP_DIFFICULTY_GAMES[selectedSpGame].variants[0].id) === v.id
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t(v.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Personal / Public mode toggle */}
            <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 w-fit">
              {(['public', 'personal'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSpMode(mode)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    spMode === mode
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t(`pb.${mode}`)}
                </button>
              ))}
            </div>

            {/* Singleplayer scores table */}
            {spMode === 'public' && (
              <>
                {loadingSp ? (
                  <LeaderboardSkeleton />
                ) : spPublicScores.length > 0 && spConfig ? (
                  <SpPublicTable
                    entries={spPublicScores}
                    config={spConfig}
                    formatScore={formatScore}
                    userId={user?.id ?? null}
                    t={t}
                  />
                ) : (
                  <LeaderboardEmptyState message={t('lb.noGameData')} />
                )}
              </>
            )}

            {spMode === 'personal' && (
              <>
                {spPersonalScores.length > 0 && spConfig ? (
                  <SpPersonalTable
                    entries={spPersonalScores}
                    config={spConfig}
                    formatScore={formatScore}
                    t={t}
                  />
                ) : (
                  <LeaderboardEmptyState message={t('pb.empty')} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function formatDate(ts: number | string): string {
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '—';
  }
}

function SpPublicTable({
  entries,
  config,
  formatScore,
  userId,
  t,
}: {
  entries: PublicScoreEntry[];
  config: NonNullable<ReturnType<typeof getScoreConfig>>;
  formatScore: (n: number) => string;
  userId: string | null;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-700/30 flex items-center gap-2">
        <h3 className="text-sm font-bold text-zinc-100">{t('pb.public')}</h3>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {entries.length} {t('pb.player')}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900/50 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-700/30">
            <th className="py-2 px-4 text-left font-semibold w-12">#</th>
            <th className="py-2 px-4 text-left font-semibold">{t('pb.player')}</th>
            <th className="py-2 px-4 text-right font-semibold">{t(config.scoreLabelKey)}</th>
            {config.columns.map((col) => (
              <th key={col.key} className="py-2 px-4 text-right font-semibold hidden sm:table-cell">
                {t(col.labelKey)}
              </th>
            ))}
            <th className="py-2 px-4 text-right font-semibold hidden sm:table-cell">{t('pb.date')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const isOwn = userId !== null && entry.userId === userId;
            return (
              <tr
                key={entry.id}
                className={`border-t border-zinc-800/50 ${
                  isOwn
                    ? 'bg-indigo-950/30'
                    : i === 0
                      ? 'bg-amber-950/20'
                      : 'hover:bg-zinc-800/30'
                }`}
              >
                <td className="py-2.5 px-4">
                  <span className={`font-bold tabular-nums ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-zinc-200 truncate max-w-[140px]">
                  {entry.nickname || 'Anon'}
                  {isOwn && (
                    <span className="ml-1.5 text-indigo-400 text-xs font-semibold">{t('pb.you')}</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right font-black tabular-nums text-zinc-100">
                  {formatScore(entry.score)}
                </td>
                {config.columns.map((col) => {
                  const val = entry.meta?.[col.key];
                  const display = val != null ? (col.format ? col.format(val as number | string | boolean) : String(val)) : '—';
                  return (
                    <td key={col.key} className="py-2.5 px-4 text-right tabular-nums text-zinc-400 hidden sm:table-cell">
                      {display}
                    </td>
                  );
                })}
                <td className="py-2.5 px-4 text-right text-zinc-500 text-xs whitespace-nowrap hidden sm:table-cell">
                  {formatDate(entry.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpPersonalTable({
  entries,
  config,
  formatScore,
  t,
}: {
  entries: PersonalScoreEntry[];
  config: NonNullable<ReturnType<typeof getScoreConfig>>;
  formatScore: (n: number) => string;
  t: (key: string) => string;
}) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-700/30 flex items-center gap-2">
        <h3 className="text-sm font-bold text-zinc-100">{t('pb.personal')}</h3>
        <span className="text-[10px] text-zinc-600 ml-auto">
          {entries.length} Runs
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900/50 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-700/30">
            <th className="py-2 px-4 text-left font-semibold w-12">#</th>
            <th className="py-2 px-4 text-right font-semibold">{t(config.scoreLabelKey)}</th>
            {config.columns.map((col) => (
              <th key={col.key} className="py-2 px-4 text-right font-semibold hidden sm:table-cell">
                {t(col.labelKey)}
              </th>
            ))}
            <th className="py-2 px-4 text-right font-semibold hidden sm:table-cell">{t('pb.date')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr
              key={entry.id}
              className={`border-t border-zinc-800/50 ${
                i === 0 ? 'bg-amber-950/20' : 'hover:bg-zinc-800/30'
              }`}
            >
              <td className="py-2.5 px-4">
                <span className={`font-bold tabular-nums ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'
                }`}>
                  {i + 1}
                </span>
              </td>
              <td className="py-2.5 px-4 text-right font-black tabular-nums text-zinc-100">
                {formatScore(entry.score)}
              </td>
              {config.columns.map((col) => {
                const val = entry.meta?.[col.key];
                const display = val != null ? (col.format ? col.format(val as number | string | boolean) : String(val)) : '—';
                return (
                  <td key={col.key} className="py-2.5 px-4 text-right tabular-nums text-zinc-400 hidden sm:table-cell">
                    {display}
                  </td>
                );
              })}
              <td className="py-2.5 px-4 text-right text-zinc-500 text-xs whitespace-nowrap hidden sm:table-cell">
                {formatDate(entry.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
