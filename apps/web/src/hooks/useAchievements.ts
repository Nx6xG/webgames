'use client';

import { useRef, useCallback, useEffect } from 'react';
import { trackAchievementEvent, consumeLastLevelUps } from '@/lib/achievements';
import type { AchievementEvent } from '@/lib/achievements';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { useLevelUpToasts } from '@/components/ui/LevelUpToasts';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useProgression } from '@/components/providers/ProgressionProvider';
import { loadStats, loadUnlocked, loadUnlockedCosmetics } from '@/lib/achievements/store';

// ── Session-scoped dedup ────────────────────────────────────────────────────
// Persists across page reloads within the same tab so that reconnecting to
// an ongoing game does not re-award play/win/loss XP.
const SS_KEY = 'wg_ach_session';

interface SessionGuard { played?: boolean; won?: boolean; lost?: boolean; invite?: boolean }

function loadSessionGuard(roomCode: string): SessionGuard {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data?.roomCode === roomCode ? (data.guard ?? {}) : {};
  } catch { return {}; }
}

function saveSessionGuard(roomCode: string, guard: SessionGuard) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify({ roomCode, guard })); } catch {}
}

/**
 * Hook that provides guarded achievement tracking for a single game session.
 * Each call to trackPlay/trackWin/trackLoss/trackInvite fires at most once per mount
 * AND per browser session (survives page reload via sessionStorage).
 *
 * @param roomCode Pass `mp.roomCode` for multiplayer games. When it transitions
 *   from null→string the hook loads any persisted guard for that room,
 *   preventing duplicate XP on reconnect/reload.
 */
export function useAchievements(gameId: string, roomCode?: string | null) {
  const toasts = useAchievementToasts();
  const levelUpToasts = useLevelUpToasts();
  const cloudSync = useCloudSync();
  const { setProgression } = useProgression();

  const playedRef = useRef(false);
  const wonRef = useRef(false);
  const lostRef = useRef(false);
  const inviteRef = useRef(false);
  const roomRef = useRef('');

  // When roomCode becomes available (null→string), load persisted guards
  useEffect(() => {
    const room = roomCode ?? '';
    if (!room || room === roomRef.current) return;
    roomRef.current = room;
    if (typeof window === 'undefined') return;
    const saved = loadSessionGuard(room);
    if (saved.played) playedRef.current = true;
    if (saved.won) wonRef.current = true;
    if (saved.lost) lostRef.current = true;
    if (saved.invite) inviteRef.current = true;
  }, [roomCode]);

  const fire = useCallback(
    (ids: string[]) => {
      if (ids.length > 0) toasts.push(ids);
      const levelUps = consumeLastLevelUps();
      if (levelUps.length > 0) levelUpToasts.push(levelUps);
      if (cloudSync.isActive) {
        cloudSync.syncStats(loadStats());
        cloudSync.syncAchievements([...loadUnlocked()]);
        cloudSync.syncUnlockedCosmetics(loadUnlockedCosmetics());
      }
    },
    [toasts, levelUpToasts, cloudSync],
  );

  const persist = useCallback(() => {
    if (!roomRef.current) return;
    saveSessionGuard(roomRef.current, {
      played: playedRef.current,
      won: wonRef.current,
      lost: lostRef.current,
      invite: inviteRef.current,
    });
  }, []);

  const trackPlay = useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    persist();
    fire(trackAchievementEvent({ type: 'game_played', gameId }, setProgression));
  }, [gameId, fire, setProgression, persist]);

  const trackWin = useCallback((meta?: Record<string, unknown>) => {
    if (wonRef.current) return;
    wonRef.current = true;
    persist();
    fire(trackAchievementEvent({ type: 'game_won', gameId, meta }, setProgression));
  }, [gameId, fire, setProgression, persist]);

  const trackLoss = useCallback(() => {
    if (lostRef.current) return;
    lostRef.current = true;
    persist();
    fire(trackAchievementEvent({ type: 'game_lost', gameId }, setProgression));
  }, [gameId, fire, setProgression, persist]);

  const trackInvite = useCallback(() => {
    if (inviteRef.current) return;
    inviteRef.current = true;
    persist();
    fire(trackAchievementEvent({ type: 'invite_link_copied' }, setProgression));
  }, [fire, setProgression, persist]);

  /** Fire a generic achievement event (e.g. flag). Not guarded — caller is responsible for dedup. */
  const trackEvent = useCallback((ev: AchievementEvent) => {
    fire(trackAchievementEvent(ev, setProgression));
  }, [fire, setProgression]);

  /** Reset guards (e.g. on rematch) so the next match can be tracked. */
  const reset = useCallback(() => {
    playedRef.current = false;
    wonRef.current = false;
    lostRef.current = false;
    persist();
  }, [persist]);

  return { trackPlay, trackWin, trackLoss, trackInvite, trackEvent, reset };
}
