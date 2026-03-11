'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, OnlineUser, InvitePayload, GameId } from 'shared';
import { loadProgression } from '@/lib/progression';
import { loadShowcaseConfig, buildShowcase } from '@/lib/showcase';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY  = 'wg_nickname';

export interface AcceptedInvite {
  id: string;
  gameId: GameId;
  roomCode: string;
  byName: string;
  expiresAt: number;
}

export function useOnlineUsers(wsUrl: string, userId?: string) {
  const socketRef = useRef<GameSocket | null>(null);
  const [users, setUsers]                         = useState<OnlineUser[]>([]);
  const [connected, setConnected]                 = useState(false);
  const [incomingInvites, setIncomingInvites]     = useState<InvitePayload[]>([]);
  const [sentInvite, setSentInvite]               = useState<{ id: string; roomCode: string; gameId: GameId } | null>(null);
  const [inviteError, setInviteError]             = useState<string | null>(null);
  const [acceptedInvite, setAcceptedInvite]       = useState<AcceptedInvite | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem(TOKEN_KEY) ?? 'anonymous';
    const nick   = localStorage.getItem(NICK_KEY)  ?? 'Guest';

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
      const prog = loadProgression();
      const showcase = buildShowcase(loadShowcaseConfig());
      socket.emit('identify', { playerToken: token, nickname: nick, userId, level: prog.level, showcase });
      socket.emit('presence_update', { activity: { kind: 'home' } });
      socket.emit('get_online_users');
    });
    socket.on('disconnect',    () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('online_users', ({ users: list }) => {
      setUsers(list);
    });

    socket.on('invite_received', (invite) => {
      setIncomingInvites((prev) => [...prev, invite]);
    });

    socket.on('invite_sent', (payload) => {
      setSentInvite(payload);
    });

    socket.on('invite_error', ({ message }) => {
      setInviteError(message);
      setTimeout(() => setInviteError(null), 4_000);
    });

    socket.on('invite_accepted', ({ id, gameId, roomCode, byName }) => {
      setAcceptedInvite({ id, gameId, roomCode, byName, expiresAt: Date.now() + 3_000 });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsUrl, userId]); // eslint-disable-line

  const sendInvite = useCallback((toToken: string, gameId: GameId) => {
    socketRef.current?.emit('invite_create', { toToken, gameId });
  }, []);

  const acceptInvite = useCallback((invite: InvitePayload) => {
    socketRef.current?.emit('invite_accept', {
      id: invite.id,
      fromToken: invite.fromToken,
      gameId: invite.gameId,
      roomCode: invite.roomCode,
    });
  }, []);

  const dismissInvite = useCallback((id: string) => {
    setIncomingInvites((prev) => prev.filter((inv) => inv.id !== id));
  }, []);

  const dismissSentInvite = useCallback(() => {
    setSentInvite(null);
  }, []);

  const dismissAcceptedInvite = useCallback(() => {
    setAcceptedInvite(null);
  }, []);

  return {
    users,
    connected,
    incomingInvites,
    sentInvite,
    inviteError,
    acceptedInvite,
    sendInvite,
    acceptInvite,
    dismissInvite,
    dismissSentInvite,
    dismissAcceptedInvite,
  };
}
