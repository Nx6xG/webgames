'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { GAME_EMOJI } from '@/lib/localStats';
import { getActiveStreak } from '@/lib/playStreak';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
}

export function ProfileOverviewCards({ profile }: Props) {
  const { t } = useI18n();
  const [streak, setStreak] = useState({ currentStreak: 0, bestStreak: 0 });

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

      {/* Streak + most played row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Streak */}
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-4 flex items-center gap-4">
          <span className="text-2xl">🔥</span>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">{t('profilePage.streak')}</p>
            <p className="text-2xl font-bold">
              {streak.currentStreak}
              <span className="text-sm font-normal text-zinc-500 ml-1">{t('profilePage.days')}</span>
            </p>
          </div>
          {streak.bestStreak > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-zinc-500">{t('profilePage.best')}</p>
              <p className="text-sm font-semibold text-amber-400">{streak.bestStreak}</p>
            </div>
          )}
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
