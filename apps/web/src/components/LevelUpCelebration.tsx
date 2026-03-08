'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { consumeLevelUps } from '@/lib/progression/store';
import { getPlayerRank } from '@/lib/progression/rank';
import type { LevelUpResult } from '@/lib/progression/types';
import { TokenIcon } from '@/components/ui/TokenIcon';

/**
 * Full-screen level-up celebration overlay for the homepage.
 * Consumes queued level-up events on mount and shows a premium animation.
 */
export function LevelUpCelebration() {
  const { t } = useI18n();
  const [event, setEvent] = useState<LevelUpResult | null>(null);
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const [queue, setQueue] = useState<LevelUpResult[]>([]);

  useEffect(() => {
    const ups = consumeLevelUps();
    if (ups.length > 0) {
      setEvent(ups[0]);
      setQueue(ups.slice(1));
      requestAnimationFrame(() => setPhase('visible'));
    }
  }, []);

  const dismiss = useCallback(() => {
    setPhase('exit');
    setTimeout(() => {
      if (queue.length > 0) {
        setEvent(queue[0]);
        setQueue((prev) => prev.slice(1));
        setPhase('enter');
        requestAnimationFrame(() => setPhase('visible'));
      } else {
        setEvent(null);
        setPhase('enter');
      }
    }, 400);
  }, [queue]);

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (phase !== 'visible') return;
    const timer = setTimeout(dismiss, 6000);
    return () => clearTimeout(timer);
  }, [phase, dismiss]);

  if (!event) return null;

  const oldRank = getPlayerRank(event.fromLevel);
  const newRank = getPlayerRank(event.toLevel);
  const rankChanged = oldRank !== newRank;

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center transition-all duration-500 ${
        phase === 'visible' ? 'bg-black/70 backdrop-blur-md' : 'bg-black/0 backdrop-blur-none pointer-events-none'
      }`}
      onClick={dismiss}
    >
      <div
        className={`relative max-w-sm w-full mx-4 transition-all duration-600 ease-out ${
          phase === 'visible'
            ? 'scale-100 opacity-100 translate-y-0'
            : phase === 'exit'
              ? 'scale-90 opacity-0 translate-y-8'
              : 'scale-75 opacity-0 -translate-y-8'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer glow rings */}
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-indigo-500/40 via-purple-500/30 to-indigo-500/40 blur-md" style={{ animation: 'lvlup-pulse 2s ease-in-out infinite' }} />
        <div className="absolute -inset-6 rounded-3xl bg-indigo-500/8 blur-3xl" style={{ animation: 'lvlup-pulse 2s ease-in-out infinite 0.5s' }} />

        {/* Card */}
        <div className="relative rounded-2xl border border-indigo-500/30 bg-zinc-900/95 backdrop-blur-xl overflow-hidden">
          {/* Top shimmer */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent" />
          {/* Bottom shimmer */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

          <div className="px-8 pt-10 pb-7 text-center">
            {/* Level number — big hero */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600/25 to-purple-600/25 border border-indigo-500/40 flex items-center justify-center mb-5" style={{ animation: 'lvlup-glow 2s ease-in-out infinite' }}>
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-indigo-200 to-indigo-400" style={{ animation: 'lvlup-number 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' }}>
                {event.toLevel}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-black uppercase tracking-[0.3em] text-indigo-300 mb-1" style={{ animation: 'lvlup-fadein 0.5s ease-out 0.1s both' }}>
              {t('progression.levelUp')}
            </p>

            {/* Level transition */}
            <div className="flex items-center justify-center gap-2 mb-5" style={{ animation: 'lvlup-fadein 0.5s ease-out 0.25s both' }}>
              <span className="text-lg font-bold text-zinc-600">Lv. {event.fromLevel}</span>
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-lg font-bold text-indigo-300">Lv. {event.toLevel}</span>
            </div>

            {/* Rank badge — prominent when changed */}
            {rankChanged ? (
              <div className="mb-5" style={{ animation: 'lvlup-rankpop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.4s both' }}>
                <div className="inline-flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 border border-purple-500/30">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400/80">{t('progression.rankUp')}</span>
                  <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-fuchsia-300">
                    {t(`progression.rank.${newRank.toLowerCase()}`)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-indigo-500/60 mb-5 font-medium" style={{ animation: 'lvlup-fadein 0.5s ease-out 0.35s both' }}>
                {t(`progression.rank.${newRank.toLowerCase()}`)}
              </p>
            )}

            {/* Token reward */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-7" style={{ animation: 'lvlup-fadein 0.5s ease-out 0.5s both' }}>
              <span style={{ animation: 'lvlup-coin 0.5s ease-out 0.6s both' }}><TokenIcon size="lg" /></span>
              <span className="text-base font-bold text-amber-400">
                +{event.tokensGranted} {event.tokensGranted === 1 ? t('progression.tokenEarned') : t('progression.tokensEarned')}
              </span>
            </div>

            {/* Dismiss button */}
            <div style={{ animation: 'lvlup-fadein 0.5s ease-out 0.65s both' }}>
              <button
                onClick={dismiss}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                {t('progression.continue')}
              </button>
              {queue.length > 0 && (
                <p className="text-[10px] text-zinc-600 mt-2.5 tabular-nums">
                  +{queue.length} more
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes lvlup-glow {
          0%, 100% { box-shadow: 0 0 24px rgba(99,102,241,0.15), inset 0 0 24px rgba(99,102,241,0.05); }
          50%      { box-shadow: 0 0 48px rgba(99,102,241,0.3), inset 0 0 32px rgba(99,102,241,0.1); }
        }
        @keyframes lvlup-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes lvlup-number {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes lvlup-rankpop {
          0%   { transform: scale(0.5); opacity: 0; }
          50%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lvlup-coin {
          0%   { transform: scale(0) rotateY(180deg); }
          60%  { transform: scale(1.3) rotateY(0deg); }
          100% { transform: scale(1) rotateY(0deg); }
        }
        @keyframes lvlup-fadein {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
