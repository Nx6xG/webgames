'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { UserSettingsPanel } from '@/components/settings/UserSettingsPanel';
import { loadLocalProfile, ALL_GAME_IDS } from '@/lib/localStats';
import type { LocalProfile } from '@/lib/localStats';
import { getPublicProfileByUserId } from '@/lib/cloudQueries';
import type { PublicProfile } from '@/lib/cloudQueries';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { ProfileView } from '@/components/profile/ProfileView';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';
import type { ProfileData, GameStatEntry } from '@/components/profile/types';

function localToProfileData(
  local: LocalProfile,
  nickname: string,
  cosmetics: import('shared').CosmeticsSelection,
): ProfileData {
  const perGame: GameStatEntry[] = local.perGame.map((g) => ({
    gameId: g.gameId,
    played: g.plays,
    wins: g.wins,
    winrate: g.winRate,
    bestScore: g.bestScore,
    bestTime: g.bestTime,
    bestTile: g.bestTile,
    bestLines: g.bestLines,
  }));

  return {
    userId: null,
    nickname,
    createdAt: null,
    cosmetics,
    achievementsUnlocked: local.achievementsUnlocked,
    achievementsTotal: local.achievementsTotal,
    totalPlayed: local.playsTotal,
    totalWins: local.winsTotal,
    totalWinrate: local.winRate,
    favoriteGame: local.favoriteGameId,
    perGame,
    badges: cosmetics.badges?.slice(0, 3) ?? [],
    isOwnProfile: true,
    isLocalOnly: true,
  };
}

function cloudToProfileData(pub: PublicProfile): ProfileData {
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
    isOwnProfile: true,
    isLocalOnly: false,
  };
}

/** Merge local best scores into cloud per-game data (cloud doesn't track singleplayer bests). */
function enrichWithLocalBests(cloud: ProfileData, local: LocalProfile): ProfileData {
  const localMap = new Map(local.perGame.map((g) => [g.gameId, g]));
  const enriched = cloud.perGame.map((g) => {
    const loc = localMap.get(g.gameId);
    if (!loc) return g;
    return {
      ...g,
      bestScore: g.bestScore ?? loc.bestScore,
      bestTime: g.bestTime ?? loc.bestTime,
      bestTile: g.bestTile ?? loc.bestTile,
      bestLines: g.bestLines ?? loc.bestLines,
    };
  });

  // Add local-only games not in cloud data
  const cloudIds = new Set(cloud.perGame.map((g) => g.gameId));
  for (const gid of ALL_GAME_IDS) {
    if (cloudIds.has(gid)) continue;
    const loc = localMap.get(gid);
    if (loc && (loc.plays > 0 || loc.bestScore !== null || loc.bestTime !== null)) {
      enriched.push({
        gameId: gid,
        played: loc.plays,
        wins: loc.wins,
        winrate: loc.winRate,
        bestScore: loc.bestScore,
        bestTime: loc.bestTime,
        bestTile: loc.bestTile,
        bestLines: loc.bestLines,
      });
    }
  }

  return { ...cloud, perGame: enriched };
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { nickname, cosmetics } = useNickname();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const local = loadLocalProfile();

      // Try cloud for logged-in users
      if (user) {
        try {
          const cloud = await getPublicProfileByUserId(user.id);
          if (cloud && !cancelled) {
            const cloudData = cloudToProfileData(cloud);
            // Use current local cosmetics/nickname (most up-to-date)
            const merged = enrichWithLocalBests(
              { ...cloudData, nickname, cosmetics },
              local,
            );
            setProfileData(merged);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to local
        }
      }

      // Local fallback
      if (!cancelled) {
        setProfileData(localToProfileData(local, nickname, cosmetics));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, nickname, cosmetics]);

  if (loading || !profileData) return <ProfileSkeleton />;

  const settingsSidebar = (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        {t('profile.settings')}
      </h2>
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-5">
        <UserSettingsPanel />
      </div>
    </section>
  );

  return <ProfileView profile={profileData} sidebar={settingsSidebar} />;
}
