'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, ChatMessage, ChatScope } from 'shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY = 'wg_nickname';

export function useGlobalChat(wsUrl: string) {
  const socketRef = useRef<GameSocket | null>(null);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem(TOKEN_KEY) ?? 'anonymous';
    const nickname = localStorage.getItem(NICK_KEY) ?? 'Guest';

    const socket: GameSocket = io(wsUrl, {
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
      socket.emit('identify', { playerToken: token, nickname });
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
