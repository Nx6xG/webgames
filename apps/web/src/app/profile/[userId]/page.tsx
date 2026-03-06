'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { getPublicProfileByUserId } from '@/lib/cloudQueries';
import type { PublicProfile } from '@/lib/cloudQueries';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { ProfileView } from '@/components/profile/ProfileView';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';
import { ProfileEmptyState } from '@/components/profile/ProfileEmptyState';
import type { ProfileData, GameStatEntry } from '@/components/profile/types';

function toProfileData(pub: PublicProfile, isOwnProfile: boolean): ProfileData {
  const perGame: GameStatEntry[] = pub.statsByGame.map((g) => ({
    gameId: g.gameId,
    played: g.played,
    wins: g.wins,
    winrate: g.winrate,
  }));

  return {
    userId: pub.userId,
    nickname: pub.nickname,
    createdAt: pub.createdAt,
    cosmetics: pub.cosmetics ?? { slots: {} },
    achievementsUnlocked: pub.achievementsUnlockedCount,
    achievementsTotal: ACHIEVEMENTS.length,
    totalPlayed: pub.totalPlayed,
    totalWins: pub.totalWins,
    totalWinrate: pub.totalWinrate,
    favoriteGame: pub.favoriteGame,
    perGame,
    badges: pub.badges,
    isOwnProfile,
    isLocalOnly: false,
  };
}

export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const { t } = useI18n();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!params.userId) return;
    let cancelled = false;
    setLoading(true);
    getPublicProfileByUserId(params.userId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.userId]);

  if (loading) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <ProfileEmptyState
        title={t('pub.notFound')}
        message={t('pub.notFoundDesc')}
      />
    );
  }

  const isOwn = !!user && user.id === profile.userId;
  const data = toProfileData(profile, isOwn);

  return <ProfileView profile={data} />;
}
