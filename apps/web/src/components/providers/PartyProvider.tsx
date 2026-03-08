'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  PartyState,
  PartyInvitePayload,
  PartyErrorCode,
  GameId,
} from 'shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY = 'wg_nickname';

interface PartyCtx {
  party: PartyState | null;
  incomingPartyInvite: PartyInvitePayload | null;
  partyError: { code: PartyErrorCode; message: string } | null;
  gameStarting: { gameId: GameId; roomCode: string } | null;
  isHost: boolean;
  createParty: () => void;
  inviteToParty: (toToken: string) => void;
  joinParty: (partyId: string) => void;
  leaveParty: () => void;
  kickFromParty: (token: string) => void;
  launchGame: (gameId: GameId) => void;
  dismissPartyInvite: () => void;
  dismissGameStarting: () => void;
}

const PartyContext = createContext<PartyCtx>({
  party: null,
  incomingPartyInvite: null,
  partyError: null,
  gameStarting: null,
  isHost: false,
  createParty: () => {},
  inviteToParty: () => {},
  joinParty: () => {},
  leaveParty: () => {},
  kickFromParty: () => {},
  launchGame: () => {},
  dismissPartyInvite: () => {},
  dismissGameStarting: () => {},
});

export function usePartyCtx() {
  return useContext(PartyContext);
}

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  const [party, setParty] = useState<PartyState | null>(null);
  const [myToken, setMyToken] = useState('');
  const [incomingPartyInvite, setIncomingPartyInvite] = useState<PartyInvitePayload | null>(null);
  const [partyError, setPartyError] = useState<{ code: PartyErrorCode; message: string } | null>(null);
  const [gameStarting, setGameStarting] = useState<{ gameId: GameId; roomCode: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem(TOKEN_KEY) ?? 'anonymous';
    const nick = localStorage.getItem(NICK_KEY) ?? 'Guest';
    setMyToken(token);

    const socket: GameSocket = io(getWsUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 5_000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;
    socket.connect();

    socket.on('connect', () => {
      socket.emit('identify', { playerToken: token, nickname: nick });
    });

    socket.on('party_updated', ({ party: p }) => {
      setParty(p);
      setGameStarting(null);
    });

    socket.on('party_disbanded', () => {
      setParty(null);
      setGameStarting(null);
    });

    socket.on('party_invite_received', (payload) => {
      setIncomingPartyInvite(payload);
    });

    socket.on('party_game_starting', (data) => {
      setGameStarting(data);
    });

    socket.on('party_error', (data) => {
      setPartyError(data);
      setTimeout(() => setPartyError(null), 4_000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const createParty = useCallback(() => {
    socketRef.current?.emit('party_create');
  }, []);

  const inviteToParty = useCallback((toToken: string) => {
    socketRef.current?.emit('party_invite', { toToken });
  }, []);

  const joinParty = useCallback((partyId: string) => {
    socketRef.current?.emit('party_join', { partyId });
  }, []);

  const leaveParty = useCallback(() => {
    socketRef.current?.emit('party_leave');
    setParty(null);
  }, []);

  const kickFromParty = useCallback((token: string) => {
    socketRef.current?.emit('party_kick', { token });
  }, []);

  const launchGame = useCallback((gameId: GameId) => {
    socketRef.current?.emit('party_launch', { gameId });
  }, []);

  const dismissPartyInvite = useCallback(() => {
    setIncomingPartyInvite(null);
  }, []);

  const dismissGameStarting = useCallback(() => {
    setGameStarting(null);
  }, []);

  const isHost = !!party && party.hostToken === myToken;

  return (
    <PartyContext.Provider
      value={{
        party,
        incomingPartyInvite,
        partyError,
        gameStarting,
        isHost,
        createParty,
        inviteToParty,
        joinParty,
        leaveParty,
        kickFromParty,
        launchGame,
        dismissPartyInvite,
        dismissGameStarting,
      }}
    >
      {children}
    </PartyContext.Provider>
  );
}
