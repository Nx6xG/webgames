'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage, ChatScope } from 'shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY = 'wg_nickname';

export function useGlobalChat(wsUrl: string, nickname: string) {
  const socketRef = useRef<GameSocket | null>(null);
  const nicknameRef = useRef(nickname);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Sync ref and notify server when nickname changes while connected.
  useEffect(() => {
    nicknameRef.current = nickname;
    if (nickname && socketRef.current?.connected) {
      socketRef.current.emit('set_nickname', { nickname });
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
      socket.emit('identify', { playerToken: token, nickname: nick });
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
  }, []);

  return { globalMessages, chatError, sendGlobalChat, connected };
}
