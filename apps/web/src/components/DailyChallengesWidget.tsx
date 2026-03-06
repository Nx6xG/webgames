'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { getDailyChallenges, getTodayStr, loadProgress } from '@/lib/dailyChallenges';
import type { DailyChallenge, DailyChallengeProgress } from '@/lib/dailyChallenges';
import { getActiveStreak } from '@/lib/playStreak';

export function DailyChallengesWidget() {
  const { t } = useI18n();
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [progress, setProgress] = useState<DailyChallengeProgress | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const today = getTodayStr();
    setChallenges(getDailyChallenges(today));
    setProgress(loadProgress(today));
    setStreak(getActiveStreak().currentStreak);
  }, []);

  if (challenges.length === 0) return null;

  const completedCount = progress?.completed.length ?? 0;
  const allDone = completedCount >= challenges.length;

  return (
    <section className="max-w-5xl mx-auto px-6 pb-10">
      <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              {t('daily.title')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <span className="text-xs text-amber-400 font-medium tabular-nums">
                🔥 {streak} {t('daily.streak')}
              </span>
            )}
            <span className="text-xs text-zinc-500 tabular-nums">
              {completedCount}/{challenges.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-zinc-800 mb-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(completedCount / challenges.length) * 100}%` }}
          />
        </div>

        {/* Challenge rows */}
        <div className="space-y-3">
          {challenges.map((ch) => {
            const current = Math.min(progress?.progress[ch.templateId] ?? 0, ch.target);
            const done = progress?.completed.includes(ch.templateId) ?? false;

            return (
              <div
                key={ch.templateId}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  done
                    ? 'border-emerald-800/50 bg-emerald-950/30'
                    : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                <span className="text-lg shrink-0">{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-emerald-300' : 'text-zinc-200'}`}>
                    {t(ch.nameKey)}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{t(ch.descKey)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs tabular-nums text-zinc-400">
                    {current}/{ch.target}
                  </span>
                  {done && (
                    <span className="text-emerald-400 text-sm">✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {allDone && (
          <p className="mt-4 text-center text-xs text-emerald-400 font-medium">
            {t('daily.allDone')}
          </p>
        )}
      </div>
    </section>
  );
}
