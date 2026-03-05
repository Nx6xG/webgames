/**
 * ProfileData — unified model for viewing any user's profile.
 *
 * Right now we only have local stats for ourselves and presence-based
 * cosmetics for others. When accounts are added, the resolver can be
 * swapped to fetch from the server.
 */

import type { CosmeticsSelection } from 'shared';
import { loadLocalProfile, GAME_EMOJI } from '@/lib/localStats';
import type { LocalProfile } from '@/lib/localStats';
import { loadCosmetics } from '@/lib/cosmetics';

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
): ProfileData {
  return {
    id: playerToken,
    nickname,
    cosmetics: cosmetics ?? { slots: {} },
    stats: null,
    isMe: false,
  };
}

export { GAME_EMOJI };
