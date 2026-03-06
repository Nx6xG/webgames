'use client';

import { useCallback, useRef } from 'react';
import type { CosmeticsSelection } from 'shared';
import type { AchievementStats } from '@/lib/achievements/definitions';
import type { UnlockedCosmeticsMap } from '@/lib/cloudSync';
import { useAuth } from '@/components/providers/AuthProvider';
import { getSupabase } from '@/lib/supabaseClient';
import {
  saveCloudCosmetics,
  saveCloudAchievements,
  saveCloudStats,
  saveCloudUnlockedCosmetics,
  saveCloudNickname,
} from '@/lib/cloudSync';

const DEBOUNCE_MS = 1000;

/**
 * Hook that exposes debounced cloud-sync functions.
 * Returns `isActive: false` when user is not logged in — callers should
 * check before calling sync functions.
 */
export function useCloudSync() {
  const { user } = useAuth();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isActive = !!user;

  const debounce = useCallback(
    (key: string, fn: () => Promise<void>) => {
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        fn().catch((err) => console.error('[cloudSync]', key, err));
      }, DEBOUNCE_MS);
    },
    [],
  );

  const syncCosmetics = useCallback(
    (cosmetics: CosmeticsSelection) => {
      const sb = getSupabase();
      if (!sb || !user) return;
      debounce('cosmetics', () => saveCloudCosmetics(sb, user.id, cosmetics));
    },
    [user, debounce],
  );

  const syncAchievements = useCallback(
    (unlocked: string[]) => {
      const sb = getSupabase();
      if (!sb || !user) return;
      debounce('achievements', () => saveCloudAchievements(sb, user.id, unlocked));
    },
    [user, debounce],
  );

  const syncStats = useCallback(
    (stats: AchievementStats) => {
      const sb = getSupabase();
      if (!sb || !user) return;
      debounce('stats', () => saveCloudStats(sb, user.id, stats));
    },
    [user, debounce],
  );

  const syncUnlockedCosmetics = useCallback(
    (map: UnlockedCosmeticsMap) => {
      const sb = getSupabase();
      if (!sb || !user) return;
      debounce('unlockedCosmetics', () =>
        saveCloudUnlockedCosmetics(sb, user.id, map),
      );
    },
    [user, debounce],
  );

  const syncNickname = useCallback(
    (nick: string) => {
      const sb = getSupabase();
      if (!sb || !user) return;
      debounce('nickname', () => saveCloudNickname(sb, user.id, nick));
    },
    [user, debounce],
  );

  return { isActive, syncCosmetics, syncAchievements, syncStats, syncUnlockedCosmetics, syncNickname };
}
