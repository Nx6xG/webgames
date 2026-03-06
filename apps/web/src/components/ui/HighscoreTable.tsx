'use client';

import { useI18n } from '@/components/providers/LanguageProvider';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HighscoreRow {
  id: string;
  score: number;
  moves: number;
  date: number | string; // timestamp (ms) or ISO string
}

export interface LastRunSummary {
  score: number;
  moves: number;
  durationSec: number;
}

interface Props {
  entries: HighscoreRow[];
  lastRun?: LastRunSummary | null;
  onClear: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: number | string): string {
  try {
    const date = typeof d === 'string' ? new Date(d + 'T12:00:00') : new Date(d);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function HighscoreTable({ entries, lastRun, onClear }: Props) {
  const { t } = useI18n();
  const best = entries[0]?.score ?? 0;
  const visible = entries.slice(0, 10);

  return (
    <div className="w-full max-w-[420px]">

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            {t('game.highscores')}
          </span>
          {best > 0 && (
            <span className="text-sm font-black text-zinc-100 tabular-nums">
              {t('game.best')}:&nbsp;{best.toLocaleString()}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
          >
            {t('game.clearHighscores')}
          </button>
        )}
      </div>

      {/* Last run summary */}
      {lastRun && (
        <p className="text-xs text-zinc-500 mb-3">
          {t('game.lastRun')}: {t('game.score')}&nbsp;{lastRun.score}&nbsp;·&nbsp;
          {t('game.moves')}&nbsp;{lastRun.moves.toLocaleString()}&nbsp;·&nbsp;
          {t('game.duration')}&nbsp;{lastRun.durationSec}s
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-6 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
          {t('game.noScores')}
        </p>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                <th className="py-2 px-3 text-left font-semibold w-8">#</th>
                <th className="py-2 px-3 text-right font-semibold">{t('game.score')}</th>
                <th className="py-2 px-3 text-right font-semibold">{t('game.moves')}</th>
                <th className="py-2 px-3 text-right font-semibold">{t('game.date')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={`border-t border-zinc-800/50 ${
                    i === 0 ? 'bg-amber-950/25' : 'bg-zinc-900/30'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span className={`font-bold tabular-nums ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-black tabular-nums text-zinc-100">
                    {entry.score.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-zinc-400">
                    {entry.moves.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-500 text-xs whitespace-nowrap">
                    {formatDate(entry.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
