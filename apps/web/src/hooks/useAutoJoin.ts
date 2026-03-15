'use client';
import { useEffect, useRef } from 'react';

interface AutoJoinMultiplayer {
  phase: string;
  joinRoom: (code: string) => void;
  quickPlay: (gameId?: string) => void;
}

export function useAutoJoin(
  mp: AutoJoinMultiplayer,
  initialRoomCode: string | null | undefined,
  isQuickPlay: boolean | undefined,
  gameId: string,
) {
  const autoJoined = useRef(false);

  useEffect(() => {
    if (autoJoined.current) return;
    if (mp.phase !== 'lobby') return;
    if (initialRoomCode) {
      autoJoined.current = true;
      mp.joinRoom(initialRoomCode);
    }
  }, [mp.phase, initialRoomCode, mp.joinRoom]);

  useEffect(() => {
    if (autoJoined.current) return;
    if (mp.phase !== 'lobby') return;
    if (isQuickPlay) {
      autoJoined.current = true;
      mp.quickPlay(gameId);
    }
  }, [mp.phase, isQuickPlay, gameId, mp.quickPlay]);
}
