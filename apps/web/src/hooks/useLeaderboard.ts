'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, LeaderboardEntry, LeaderboardMode, GameId } from 'shared';

type LBSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type LBTab = 'overall' | 'tictactoe' | 'connect4' | 'rps' | 'chess' | 'battleship' | 'liarsbar' | 'curvefever' | 'uno';

const PLAYER_TOKEN_KEY = 'wg_player_token';
const NICKNAME_KEY     = 'wg_nickname';

function tabToPayload(tab: LBTab): { mode: LeaderboardMode; gameId?: GameId } {
  if (tab === 'overall') return { mode: 'overall' };
  return { mode: 'game', gameId: tab as GameId };
}

export function useLeaderboard(wsUrl: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<LBTab>('overall');
  const socketRef = useRef<LBSocket | null>(null);
  const tabRef = useRef<LBTab>(tab);
  tabRef.current = tab;

  useEffect(() => {
    const socket: LBSocket = io(wsUrl || getWsUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Identify so server can mark our own row with isYou=true
      const token    = localStorage.getItem(PLAYER_TOKEN_KEY) ?? '';
      const nickname = localStorage.getItem(NICKNAME_KEY) ?? '';
      if (token) socket.emit('identify', { playerToken: token, nickname });
      socket.emit('leaderboard_get', tabToPayload(tabRef.current));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('leaderboard_data', ({ entries: e }) => setEntries(e));
    // Re-fetch automatically whenever any game ends (all_stats is broadcast to all sockets)
    socket.on('all_stats', () => {
      socket.emit('leaderboard_get', tabToPayload(tabRef.current));
    });

    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsUrl]);

  const changeTab = useCallback((newTab: LBTab) => {
    setTab(newTab);
    const s = socketRef.current;
    if (s?.connected) s.emit('leaderboard_get', tabToPayload(newTab));
  }, []);

  return { entries, connected, tab, changeTab };
}
