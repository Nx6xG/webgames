'use client';

import { useEffect, useRef } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { getXpRequiredForLevel, getPlayerRank } from '@/lib/progression';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { TokenIcon } from '@/components/ui/TokenIcon';

/** Rank thresholds — levels where a new rank is unlocked. */
const RANK_MILESTONES: Record<number, string> = {
  1: 'rookie',
  5: 'player',
  10: 'challenger',
  20: 'master',
  35: 'legend',
};

/** How many levels to show in the track. */
const TRACK_LEVELS = 40;

export function ProgressionTrack() {
  const { t } = useI18n();
  const { levelProgress: prog, isHydrated } = useProgression();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // Scroll to current level on mount
  useEffect(() => {
    if (prog && currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
  }, [prog]);

  if (!isHydrated) return null;

  const levels = Array.from({ length: TRACK_LEVELS }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          {t('progression.track.title')}
        </h3>
        <span className="text-[10px] text-zinc-600">
          Lv. {prog.level} / {TRACK_LEVELS}
        </span>
      </div>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-3 scrollbar-thin"
        style={{ scrollbarColor: 'rgb(63 63 70) transparent' }}
      >
        <div className="flex gap-2 w-max pt-4 pb-1">
          {levels.map((level) => {
            const isCurrent = level === prog.level;
            const isCompleted = level < prog.level;
            const isLocked = level > prog.level;
            const xpNeeded = getXpRequiredForLevel(level);
            const milestone = RANK_MILESTONES[level];
            const rank = getPlayerRank(level);

            return (
              <div
                key={level}
                ref={isCurrent ? currentRef : undefined}
                className={`relative flex flex-col items-center w-[88px] shrink-0 rounded-xl border p-3 transition-all ${
                  isCurrent
                    ? 'border-indigo-500/50 bg-indigo-950/40 shadow-[0_0_16px_rgba(99,102,241,0.15)] scale-105'
                    : isCompleted
                      ? 'border-zinc-700/40 bg-zinc-800/20'
                      : 'border-zinc-800/40 bg-zinc-900/30 opacity-50'
                }`}
              >
                {/* Current indicator */}
                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[8px] font-bold text-white whitespace-nowrap">
                    {t('progression.track.current')}
                  </div>
                )}

                {/* Level number */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black mb-2 ${
                  isCurrent
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/30'
                }`}>
                  {level}
                </div>

                {/* XP requirement */}
                <p className={`text-[9px] tabular-nums mb-1.5 ${
                  isCurrent ? 'text-indigo-400' : isCompleted ? 'text-zinc-600' : 'text-zinc-700'
                }`}>
                  {xpNeeded.toLocaleString()} XP
                </p>

                {/* Reward */}
                <div className={`flex items-center gap-0.5 text-[9px] ${
                  isCompleted ? 'text-zinc-600' : isCurrent ? 'text-amber-400' : 'text-zinc-600'
                }`}>
                  <TokenIcon size="xs" />
                  <span>+1</span>
                </div>

                {/* Rank milestone */}
                {milestone && (
                  <div className={`mt-1.5 px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                    isCurrent || isCompleted
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                      : 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/30'
                  }`}>
                    {t(`progression.rank.${milestone}`)}
                  </div>
                )}

                {/* Completed checkmark */}
                {isCompleted && (
                  <div className="absolute top-1.5 right-1.5">
                    <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Lock icon */}
                {isLocked && (
                  <div className="absolute top-1.5 right-1.5">
                    <svg className="w-3 h-3 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current progress summary */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {t('progression.track.completed')}: {prog.level - 1}
        </span>
        <span className="text-zinc-700">|</span>
        <span>{t('progression.xp')}: {prog.currentXp}/{prog.requiredXp}</span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1"><TokenIcon size="xs" /> {prog.totalTokens} {t('progression.tokens')}</span>
      </div>
    </div>
  );
}
