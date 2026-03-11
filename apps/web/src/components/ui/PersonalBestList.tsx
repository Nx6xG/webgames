'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import { getScoreConfig } from '@/lib/personal-scores/config';
import type { PersonalScoreEntry } from '@/lib/personal-scores/types';

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

export function PersonalBestList({ gameId, scores, lastInsertId, isNewBest, onClear }: Props) {
  const { t } = useI18n();
  const config = getScoreConfig(gameId);
  if (!config) return null;

  const formatScore = config.scoreFormat ?? ((n: number) => n.toLocaleString());
  const best = scores[0] ?? null;

  return (
    <div className="w-full max-w-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {t('pb.title')}
          </span>
          {best && (
            <span className="text-sm font-black text-zinc-100 tabular-nums">
              {t(config.scoreLabelKey)}: {formatScore(best.score)}
            </span>
          )}
        </div>
        {scores.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            {t('pb.clear')}
          </button>
        )}
      </div>

      {/* New best indicator */}
      {isNewBest && (
        <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400 text-xs font-semibold text-center">
          {t('pb.newBest')}
        </div>
      )}

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
              {scores.map((entry, i) => {
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
        </div>
      )}
    </div>
  );
}
