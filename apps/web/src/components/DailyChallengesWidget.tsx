'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/providers/LanguageProvider';
import { getDailyChallenges, getTodayStr, loadProgress } from '@/lib/dailyChallenges';
import type { DailyChallenge, DailyChallengeProgress } from '@/lib/dailyChallenges';
import { getActiveStreak } from '@/lib/playStreak';

const STORAGE_KEY = 'wg_daily_expanded';

/** Map gameId → route path. Multiplayer games go through /games/[id], singleplayer have their own routes. */
function getGameRoute(gameId: string | null): string {
  if (!gameId) return '/'; // generic "play any" → homepage
  // All singleplayer + multiplayer games follow /games/<id>
  return `/games/${gameId}`;
}

function loadExpandedPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveExpandedPref(expanded: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
  } catch { /* quota */ }
}

export function DailyChallengesWidget() {
  const { t } = useI18n();
  const router = useRouter();
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [progress, setProgress] = useState<DailyChallengeProgress | null>(null);
  const [streak, setStreak] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = getTodayStr();
    setChallenges(getDailyChallenges(today));
    setProgress(loadProgress(today));
    setStreak(getActiveStreak().currentStreak);
    setExpanded(loadExpandedPref());
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      saveExpandedPref(next);
      return next;
    });
  }, []);

  if (challenges.length === 0) return null;

  const completedCount = progress?.completed.length ?? 0;
  const allDone = completedCount >= challenges.length;
  const pct = (completedCount / challenges.length) * 100;

  return (
    <section className="max-w-5xl mx-auto px-6 pb-10">
      <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] overflow-hidden">
        {/* Header — always visible, clickable to toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 p-5 pb-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <span className="text-lg">🎯</span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex-1">
            {t('daily.title')}
          </h2>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <span className="text-xs text-amber-400 font-medium tabular-nums">
                🔥 {streak} {t('daily.streak')}
              </span>
            )}
            <span className={`text-xs tabular-nums font-medium ${allDone ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {completedCount}/{challenges.length}
            </span>
            {/* Chevron */}
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Progress bar — always visible */}
        <div className="px-5 pb-4">
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Expandable challenge list */}
        <div
          ref={contentRef}
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
          style={{
            gridTemplateRows: expanded ? '1fr' : '0fr',
            opacity: expanded ? 1 : 0,
          }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-5 space-y-2">
              {challenges.map((ch) => {
                const current = Math.min(progress?.progress[ch.templateId] ?? 0, ch.target);
                const done = progress?.completed.includes(ch.templateId) ?? false;
                const route = getGameRoute(ch.gameId);

                return (
                  <button
                    key={ch.templateId}
                    onClick={() => router.push(route)}
                    className={`group w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left cursor-pointer ${
                      done
                        ? 'border-emerald-800/50 bg-emerald-950/30 hover:bg-emerald-950/40'
                        : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/60 hover:border-zinc-700'
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
                      <span className="text-[10px] tabular-nums text-amber-500/70 font-medium">+10 XP</span>
                      <span className="text-xs tabular-nums text-zinc-400">
                        {current}/{ch.target}
                      </span>
                      {done ? (
                        <span className="text-emerald-400 text-sm">✓</span>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}

              {allDone ? (
                <div className="pt-2 text-center space-y-0.5">
                  <p className="text-xs text-emerald-400 font-medium">
                    {t('daily.allDone')}
                  </p>
                  <p className="text-[10px] text-amber-400 font-semibold">+50 XP {t('daily.bonus')}</p>
                </div>
              ) : (
                <p className="pt-1 text-center text-[10px] text-zinc-600">
                  {t('daily.bonusHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
