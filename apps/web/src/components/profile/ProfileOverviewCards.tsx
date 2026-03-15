'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { GAME_EMOJI } from '@/lib/localStats';
import { getActiveStreak } from '@/lib/playStreak';
import { getPlayStreakBonus } from '@/lib/progression';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { TokenIcon } from '@/components/ui/TokenIcon';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
}

export function ProfileOverviewCards({ profile }: Props) {
  const { t } = useI18n();
  const [streak, setStreak] = useState({ currentStreak: 0, bestStreak: 0 });
  const { levelProgress, isHydrated } = useProgression();
  const prog = profile.isOwnProfile && isHydrated ? levelProgress : null;

  useEffect(() => {
    setStreak(getActiveStreak());
  }, []);

  // Top 3 most played games
  const topGames = [...profile.perGame]
    .filter((g) => g.played > 0)
    .sort((a, b) => b.played - a.played)
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('profilePage.gamesPlayed')} value={profile.totalPlayed} />
        <StatCard label={t('profilePage.wins')} value={profile.totalWins} />
        <StatCard label={t('profilePage.winRate')} value={`${profile.totalWinrate}%`} />
        <StatCard
          label={t('profilePage.favoriteGame')}
          value={
            profile.favoriteGame
              ? `${GAME_EMOJI[profile.favoriteGame] ?? ''} ${t(`game.name.${profile.favoriteGame}`)}`
              : t('profilePage.noFavorite')
          }
          small={!profile.favoriteGame}
        />
      </div>

      {/* Progression card (own profile only) */}
      {prog && profile.isOwnProfile && (
        <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 to-zinc-800/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <span className="text-lg font-black text-indigo-300">{prog.level}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-100">{t('progression.level')} {prog.level}</p>
                <p className="text-[11px] text-indigo-400 font-medium">{t(`progression.rank.${prog.rank.toLowerCase()}`)}</p>
              </div>
            </div>
            {prog.totalTokens > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                <TokenIcon size="sm" />
                <span className="text-xs font-semibold text-amber-400">{prog.totalTokens}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">{t('progression.nextLevel')}</span>
              <span className="text-zinc-400 tabular-nums">{prog.currentXp} / {prog.requiredXp} {t('progression.xp')}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700"
                style={{ width: `${Math.max(2, prog.progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Streak + most played row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Streak */}
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 flex items-center gap-4 group/streak relative">
          <span className="text-2xl">🔥</span>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">{t('profilePage.streak')}</p>
            <p className="text-2xl font-bold">
              {streak.currentStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">{t('profilePage.days')}</span>
            </p>
          </div>
          <div className="text-right">
            {getPlayStreakBonus(streak.currentStreak) > 0 && (
              <p className="text-[10px] text-emerald-400 font-medium mb-0.5">+{getPlayStreakBonus(streak.currentStreak)} XP {t('daily.bonus')}</p>
            )}
            {streak.bestStreak > 0 && (
              <>
                <p className="text-[10px] text-zinc-500">{t('profilePage.best')}</p>
                <p className="text-sm font-semibold text-amber-400">{streak.bestStreak}</p>
              </>
            )}
          </div>
          {/* Streak bonus tooltip */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl text-[11px] text-zinc-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/streak:opacity-100 transition-opacity z-50">
            <p className="font-bold text-zinc-100 mb-1">{t('daily.streakBonus')}</p>
            <p className={streak.currentStreak >= 3 ? 'text-emerald-400' : 'text-zinc-500'}>3+ {t('profilePage.days')}: +10 XP</p>
            <p className={streak.currentStreak >= 7 ? 'text-emerald-400' : 'text-zinc-500'}>7+ {t('profilePage.days')}: +20 XP</p>
            <p className={streak.currentStreak >= 14 ? 'text-emerald-400' : 'text-zinc-500'}>14+ {t('profilePage.days')}: +30 XP</p>
            <p className={streak.currentStreak >= 30 ? 'text-emerald-400' : 'text-zinc-500'}>30+ {t('profilePage.days')}: +50 XP</p>
          </div>
        </div>

        {/* Most played */}
        {topGames.length > 0 && (
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
            <p className="text-xs text-zinc-500 mb-2">{t('profilePage.mostPlayed')}</p>
            <div className="space-y-1.5">
              {topGames.map((g, i) => {
                const maxPlays = topGames[0].played;
                const pct = maxPlays > 0 ? (g.played / maxPlays) * 100 : 0;
                return (
                  <div key={g.gameId} className="flex items-center gap-2">
                    <span className="text-sm shrink-0">{GAME_EMOJI[g.gameId] ?? '🎮'}</span>
                    <div className="flex-1 h-3 rounded-full bg-zinc-700/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-indigo-600/70' : 'bg-indigo-700/50'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 tabular-nums w-8 text-right shrink-0">{g.played}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`font-bold ${small ? 'text-sm text-zinc-400' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}
