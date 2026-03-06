'use client';

import { useRef, useCallback } from 'react';
import { trackAchievementEvent } from '@/lib/achievements';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { useCloudSync } from '@/hooks/useCloudSync';
import { loadStats, loadUnlocked, loadUnlockedCosmetics } from '@/lib/achievements/store';

/**
 * Hook that provides guarded achievement tracking for a single game session.
 * Each call to trackPlay/trackWin/trackInvite fires at most once per mount.
 */
export function useAchievements(gameId: string) {
  const toasts = useAchievementToasts();
  const cloudSync = useCloudSync();
  const playedRef = useRef(false);
  const wonRef = useRef(false);
  const inviteRef = useRef(false);

  const fire = useCallback(
    (ids: string[]) => {
      if (ids.length > 0) toasts.push(ids);
      // Sync stats + achievements + unlocked cosmetics to cloud (debounced)
      if (cloudSync.isActive) {
        cloudSync.syncStats(loadStats());
        cloudSync.syncAchievements([...loadUnlocked()]);
        cloudSync.syncUnlockedCosmetics(loadUnlockedCosmetics());
      }
    },
    [toasts, cloudSync],
  );

  const trackPlay = useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    fire(trackAchievementEvent({ type: 'game_played', gameId }));
  }, [gameId, fire]);

  const trackWin = useCallback(() => {
    if (wonRef.current) return;
    wonRef.current = true;
    fire(trackAchievementEvent({ type: 'game_won', gameId }));
  }, [gameId, fire]);

  const trackInvite = useCallback(() => {
    if (inviteRef.current) return;
    inviteRef.current = true;
    fire(trackAchievementEvent({ type: 'invite_link_copied' }));
  }, [fire]);

  /** Reset guards (e.g. on rematch) so the next match can be tracked. */
  const reset = useCallback(() => {
    playedRef.current = false;
    wonRef.current = false;
  }, []);

  return { trackPlay, trackWin, trackInvite, reset };
}
