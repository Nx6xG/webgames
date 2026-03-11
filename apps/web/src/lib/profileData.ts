/**
 * ProfileData — unified model for viewing any user's profile.
 *
 * Right now we only have local stats for ourselves and presence-based
 * cosmetics for others. When accounts are added, the resolver can be
 * swapped to fetch from the server.
 */

import type { CosmeticsSelection, ProfileShowcase } from 'shared';
import { loadLocalProfile, GAME_EMOJI } from '@/lib/localStats';
import type { LocalProfile } from '@/lib/localStats';
import { loadCosmetics } from '@/lib/cosmetics';
import { getPublicProfileByUserId } from '@/lib/cloudQueries';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { loadShowcaseConfig, buildShowcase } from '@/lib/showcase';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProfileStats {
  playsTotal: number;
  winsTotal: number;
  winRate: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteGameId: string | null;
}

export interface ProfileData {
  /** Unique identifier — playerToken for local, future account id for remote */
  id: string;
  nickname: string;
  cosmetics: CosmeticsSelection;
  /** null = stats not available (other player without accounts) */
  stats: ProfileStats | null;
  /** User-curated showcase (favorite game, stats, achievements). */
  showcase?: ProfileShowcase;
  /** true when this profile belongs to the current user */
  isMe: boolean;
}

// ── Resolvers ────────────────────────────────────────────────────────────────

/**
 * Build a ProfileData for the local user (self).
 */
export function resolveMyProfile(nickname: string, playerToken: string): ProfileData {
  const cosmetics = loadCosmetics();
  const local: LocalProfile = loadLocalProfile();
  return {
    id: playerToken,
    nickname,
    cosmetics,
    stats: {
      playsTotal: local.playsTotal,
      winsTotal: local.winsTotal,
      winRate: local.winRate,
      achievementsUnlocked: local.achievementsUnlocked,
      achievementsTotal: local.achievementsTotal,
      favoriteGameId: local.favoriteGameId,
    },
    showcase: buildShowcase(loadShowcaseConfig()),
    isMe: true,
  };
}

/**
 * Build a ProfileData for another user from presence info.
 * Stats are null until accounts exist.
 */
export function resolveOtherProfile(
  playerToken: string,
  nickname: string,
  cosmetics: CosmeticsSelection | undefined,
  showcase?: ProfileShowcase,
): ProfileData {
  return {
    id: playerToken,
    nickname,
    cosmetics: cosmetics ?? { slots: {} },
    stats: null,
    showcase,
    isMe: false,
  };
}

/**
 * Build a ProfileData for another user using their Supabase cloud profile.
 * Falls back to resolveOtherProfile() if the cloud fetch fails.
 */
export async function resolveCloudProfile(
  userId: string,
  nickname: string,
  cosmetics: CosmeticsSelection | undefined,
): Promise<ProfileData> {
  try {
    const cloud = await getPublicProfileByUserId(userId);
    if (!cloud) return resolveOtherProfile(userId, nickname, cosmetics);
    return {
      id: userId,
      nickname: cloud.nickname,
      cosmetics: cloud.cosmetics ?? cosmetics ?? { slots: {} },
      stats: {
        playsTotal: cloud.totalPlayed,
        winsTotal: cloud.totalWins,
        winRate: cloud.totalWinrate,
        achievementsUnlocked: cloud.achievementsUnlockedCount,
        achievementsTotal: ACHIEVEMENTS.length,
        favoriteGameId: cloud.favoriteGame,
      },
      isMe: false,
    };
  } catch {
    return resolveOtherProfile(userId, nickname, cosmetics);
  }
}

export { GAME_EMOJI };
