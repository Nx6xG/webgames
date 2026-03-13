'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage, ChatScope } from 'shared';
import { loadCosmetics } from '@/lib/cosmetics';
import { trackAchievementEvent } from '@/lib/achievements';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { useLevelUpToasts } from '@/components/ui/LevelUpToasts';
import { consumeLastLevelUps } from '@/lib/achievements';
import { useCloudSync } from '@/hooks/useCloudSync';
import { loadStats, loadUnlocked, loadUnlockedCosmetics } from '@/lib/achievements/store';
import { useProgression } from '@/components/providers/ProgressionProvider';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY = 'wg_nickname';

export function useGlobalChat(wsUrl: string, nickname: string) {
  const socketRef = useRef<GameSocket | null>(null);
  const nicknameRef = useRef(nickname);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const toasts = useAchievementToasts();
  const levelUpToasts = useLevelUpToasts();
  const cloudSync = useCloudSync();
  const { setProgression } = useProgression();

  // Sync ref and notify server when nickname changes while connected.
  useEffect(() => {
    nicknameRef.current = nickname;
    if (nickname && socketRef.current?.connected) {
      const c = loadCosmetics();
      socketRef.current.emit('set_nickname', { nickname, avatarId: c.avatarId || undefined, nameColor: c.nameColor || undefined, avatarFrame: c.slots?.frame || undefined, cosmetics: c });
    }
  }, [nickname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem(TOKEN_KEY) ?? 'anonymous';

    const socket: GameSocket = io(wsUrl || getWsUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;
    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      const nick = nicknameRef.current || localStorage.getItem(NICK_KEY) || 'Guest';
      const c = loadCosmetics();
      socket.emit('identify', { playerToken: token, nickname: nick, avatarId: c.avatarId || undefined, nameColor: c.nameColor || undefined, avatarFrame: c.slots?.frame || undefined, cosmetics: c });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('chat_history', ({ scope, messages }) => {
      if (scope === 'global') setGlobalMessages(messages);
    });

    socket.on('chat_message', ({ message }) => {
      if (message.scope === 'global') {
        setGlobalMessages((prev) => [...prev, message].slice(-100));
      }
    });

    socket.on('chat_error', ({ message }) => {
      setChatError(message);
      setTimeout(() => setChatError(null), 4_000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsUrl]);

  const sendGlobalChat = useCallback((scope: ChatScope, message: string) => {
    if (!message.trim()) return;
    socketRef.current?.emit('chat_send', { scope, message: message.trim() });
    // Fire achievement for first message
    const ids = trackAchievementEvent({ type: 'message_sent' }, setProgression);
    if (ids.length > 0) toasts.push(ids);
    const levelUps = consumeLastLevelUps();
    if (levelUps.length > 0) levelUpToasts.push(levelUps);
    if (cloudSync.isActive) {
      cloudSync.syncStats(loadStats());
      cloudSync.syncAchievements([...loadUnlocked()]);
      cloudSync.syncUnlockedCosmetics(loadUnlockedCosmetics());
    }
  }, [setProgression, toasts, levelUpToasts, cloudSync]);

  return { globalMessages, chatError, sendGlobalChat, connected };
}
