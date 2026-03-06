'use client';

import { useI18n } from '@/components/providers/LanguageProvider';
import { GAME_EMOJI } from '@/lib/localStats';
import type { ProfileData } from './types';

interface Props {
  profile: ProfileData;
}

export function ProfileOverviewCards({ profile }: Props) {
  const { t } = useI18n();

  return (
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
