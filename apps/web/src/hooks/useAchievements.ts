'use client';

import { useRef, useCallback } from 'react';
import { trackAchievementEvent, consumeLastLevelUps } from '@/lib/achievements';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { useLevelUpToasts } from '@/components/ui/LevelUpToasts';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { loadStats, loadUnlocked, loadUnlockedCosmetics } from '@/lib/achievements/store';

/**
 * Hook that provides guarded achievement tracking for a single game session.
 * Each call to trackPlay/trackWin/trackInvite fires at most once per mount.
 */
export function useAchievements(gameId: string) {
  const toasts = useAchievementToasts();
  const levelUpToasts = useLevelUpToasts();
  const cloudSync = useCloudSync();
  const { setProgression } = useProgression();
  const playedRef = useRef(false);
  const wonRef = useRef(false);
  const inviteRef = useRef(false);

  const fire = useCallback(
    (ids: string[]) => {
      if (ids.length > 0) toasts.push(ids);
      // Show level-up toasts (from in-memory side channel — does NOT consume
      // the localStorage queue, which is reserved for LevelUpCelebration on homepage)
      const levelUps = consumeLastLevelUps();
      if (levelUps.length > 0) levelUpToasts.push(levelUps);
      // Sync stats + achievements + unlocked cosmetics to cloud (debounced)
      // Progression cloud sync is handled by ProgressionProvider
      if (cloudSync.isActive) {
        cloudSync.syncStats(loadStats());
        cloudSync.syncAchievements([...loadUnlocked()]);
        cloudSync.syncUnlockedCosmetics(loadUnlockedCosmetics());
      }
    },
    [toasts, levelUpToasts, cloudSync],
  );

  const trackPlay = useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    fire(trackAchievementEvent({ type: 'game_played', gameId }, setProgression));
  }, [gameId, fire, setProgression]);

  const trackWin = useCallback(() => {
    if (wonRef.current) return;
    wonRef.current = true;
    fire(trackAchievementEvent({ type: 'game_won', gameId }, setProgression));
  }, [gameId, fire, setProgression]);

  const trackInvite = useCallback(() => {
    if (inviteRef.current) return;
    inviteRef.current = true;
    fire(trackAchievementEvent({ type: 'invite_link_copied' }, setProgression));
  }, [fire, setProgression]);

  /** Reset guards (e.g. on rematch) so the next match can be tracked. */
  const reset = useCallback(() => {
    playedRef.current = false;
    wonRef.current = false;
  }, []);

  return { trackPlay, trackWin, trackInvite, reset };
}
