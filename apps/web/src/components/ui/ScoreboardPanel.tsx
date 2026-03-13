'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePublicScores } from '@/hooks/usePublicScores';
import { getScoreConfig } from '@/lib/personal-scores/config';
import type { PersonalScoreEntry, PublicScoreEntry, LeaderboardMode } from '@/lib/personal-scores/types';

interface Props {
  gameId: string;
  scores: PersonalScoreEntry[];
  lastInsertId?: string | null;
  isNewBest?: boolean;
  onClear?: () => void;
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatIsoDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function ScoreboardPanel({ gameId, scores, lastInsertId, isNewBest, onClear }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const pub = usePublicScores(gameId);
  const config = getScoreConfig(gameId);

  const [mode, setMode] = useState<LeaderboardMode>('personal');
  const [expanded, setExpanded] = useState(false);
  const prevInsertRef = useRef(lastInsertId);

  // Auto-refresh public leaderboard when a new score is submitted
  useEffect(() => {
    if (lastInsertId && lastInsertId !== prevInsertRef.current && pub.available) {
      // Small delay to let the cloud insert settle
      const timer = setTimeout(() => pub.refresh(), 1500);
      prevInsertRef.current = lastInsertId;
      return () => clearTimeout(timer);
    }
    prevInsertRef.current = lastInsertId;
  }, [lastInsertId, pub.available, pub.refresh]);

  if (!config) return null;

  const formatScore = config.scoreFormat ?? ((n: number) => n.toLocaleString());
  const best = scores[0] ?? null;

  return (
    <div className="w-full max-w-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {mode === 'personal' ? t('pb.title') : t('pb.public')}
          </span>
          {mode === 'personal' && best && (
            <span className="text-sm font-black text-zinc-100 tabular-nums">
              {t(config.scoreLabelKey)}: {formatScore(best.score)}
            </span>
          )}
        </div>
        {mode === 'personal' && scores.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            {t('pb.clear')}
          </button>
        )}
        {mode === 'public' && pub.available && (
          <button
            onClick={pub.refresh}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ↻
          </button>
        )}
      </div>

      {/* Tab switcher */}
      {pub.available && (
        <div className="flex gap-1 mb-3 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
          {(['personal', 'public'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === m
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t(`pb.${m}`)}
            </button>
          ))}
        </div>
      )}

      {/* New best indicator */}
      {mode === 'personal' && isNewBest && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400 text-xs font-semibold text-center">
          {t('pb.newBest')}
        </div>
      )}

      {/* Personal tab */}
      {mode === 'personal' && (
        <>
          {scores.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
              {t('pb.empty')}
            </p>
          ) : (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                    <th className="py-2 px-3 text-left font-semibold w-8">#</th>
                    <th className="py-2 px-3 text-right font-semibold">{t(config.scoreLabelKey)}</th>
                    {config.columns.map((col) => (
                      <th key={col.key} className="py-2 px-3 text-right font-semibold">
                        {t(col.labelKey)}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-right font-semibold">{t('pb.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(expanded ? scores.slice(0, 10) : scores.slice(0, 3)).map((entry, i) => {
                    const isLast = entry.id === lastInsertId;
                    return (
                      <tr
                        key={entry.id}
                        className={`border-t border-zinc-800/50 ${
                          isLast
                            ? 'bg-indigo-950/30'
                            : i === 0
                              ? 'bg-amber-950/25'
                              : 'bg-zinc-900/30'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold tabular-nums ${
                              i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black tabular-nums text-zinc-100">
                          {formatScore(entry.score)}
                        </td>
                        {config.columns.map((col) => {
                          const val = entry.meta?.[col.key];
                          const display =
                            val != null
                              ? col.format
                                ? col.format(val as number | string | boolean)
                                : String(val)
                              : '—';
                          return (
                            <td
                              key={col.key}
                              className="py-2.5 px-3 text-right tabular-nums text-zinc-400"
                            >
                              {display}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right text-zinc-500 text-xs whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {scores.length > 3 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full py-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800/50 bg-zinc-900/30"
                >
                  {expanded ? t('pb.showLess') : t('pb.showMore')}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Public tab */}
      {mode === 'public' && (
        <PublicTable
          entries={pub.scores}
          loading={pub.loading}
          config={config}
          formatScore={formatScore}
          userId={user?.id ?? null}
          t={t}
        />
      )}
    </div>
  );
}

/* ── Public table sub-component ─────────────────────────────────────────────── */

function PublicTable({
  entries,
  loading,
  config,
  formatScore,
  userId,
  t,
}: {
  entries: PublicScoreEntry[];
  loading: boolean;
  config: NonNullable<ReturnType<typeof getScoreConfig>>;
  formatScore: (n: number) => string;
  userId: string | null;
  t: (key: string) => string;
}) {
  if (loading) {
    return (
      <p className="text-sm text-zinc-600 text-center py-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
        {t('pb.publicLoading')}
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-600 text-center py-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
        {t('pb.publicEmpty')}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
            <th className="py-2 px-3 text-left font-semibold w-8">#</th>
            <th className="py-2 px-3 text-left font-semibold">{t('pb.player')}</th>
            <th className="py-2 px-3 text-right font-semibold">{t(config.scoreLabelKey)}</th>
            {config.columns.map((col) => (
              <th key={col.key} className="py-2 px-3 text-right font-semibold">
                {t(col.labelKey)}
              </th>
            ))}
            <th className="py-2 px-3 text-right font-semibold">{t('pb.date')}</th>
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
                      ? 'bg-amber-950/25'
                      : 'bg-zinc-900/30'
                }`}
              >
                <td className="py-2.5 px-3">
                  <span
                    className={`font-bold tabular-nums ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-left text-zinc-200 truncate max-w-[120px]">
                  {entry.nickname || 'Anon'}
                  {isOwn && (
                    <span className="ml-1.5 text-indigo-400 text-xs font-semibold">
                      {t('pb.you')}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-black tabular-nums text-zinc-100">
                  {formatScore(entry.score)}
                </td>
                {config.columns.map((col) => {
                  const val = entry.meta?.[col.key];
                  const display =
                    val != null
                      ? col.format
                        ? col.format(val as number | string | boolean)
                        : String(val)
                      : '—';
                  return (
                    <td
                      key={col.key}
                      className="py-2.5 px-3 text-right tabular-nums text-zinc-400"
                    >
                      {display}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right text-zinc-500 text-xs whitespace-nowrap">
                  {formatIsoDate(entry.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
