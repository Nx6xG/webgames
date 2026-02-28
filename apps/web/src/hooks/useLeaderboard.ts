'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, GameId, GameStats } from 'shared';

type LBSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type AllStats = Record<GameId, GameStats>;

export function useLeaderboard(wsUrl: string) {
  const [stats, setStats] = useState<AllStats | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: LBSocket = io(wsUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });

    socket.connect();
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get_all_stats');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('all_stats', ({ statsByGameId }) => setStats(statsByGameId as AllStats));

    return () => { socket.disconnect(); };
  }, [wsUrl]);

  return { stats, connected };
}
