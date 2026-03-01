'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AnyGameState,
  AnyGameAction,
  GameId,
  GameStats,
  RoomPlayerInfo,
  RoomVisibility,
  Match,
  ChatMessage,
  ChatScope,
} from 'shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type RoomPhase = 'lobby' | 'waiting' | 'playing' | 'ended';

export interface MultiplayerState<TState extends AnyGameState = AnyGameState> {
  connection: ConnectionStatus;
  phase: RoomPhase;
  roomCode: string | null;
  playerIndex: 0 | 1 | null;
  isSpectator: boolean;
  playerCount: number;
  spectatorCount: number;
  gameState: TState | null;
  error: string | null;
  /** How many players have voted for a rematch (0 or 1; never reaches 2 — game restarts). */
  rematchVotes: number;
  /** Whether this player has already cast a rematch vote. */
  myVotedRematch: boolean;
  /** Non-null when the server rejected a rematch request. Auto-clears after 4 s. */
  rematchError: string | null;
  /** Platform-wide stats for this game (fetched on connect, updated after each game). */
  stats: GameStats | null;
  /** Both players in the current room, sorted by index. Empty outside a room. */
  players: RoomPlayerInfo[];
  /** Personal match history for this player (last 10, most recent first). */
  history: Match[];
  /** This player's nickname (from localStorage, set once on connect). */
  myNickname: string;
  /** Current countdown label ('3'|'2'|'1'|'Go!'|null). Non-null while pre-game countdown is running. */
  matchCountdown: string | null;
  /** Chat messages for the current room (cleared on leave). */
  roomMessages: ChatMessage[];
  /** Platform-wide global chat messages. */
  globalMessages: ChatMessage[];
  /** Non-null when the server rejected a chat action. Auto-clears after 4 s. */
  chatError: string | null;
}

export interface MultiplayerActions {
  createRoom: (options?: { visibility?: RoomVisibility; roomName?: string }) => void;
  joinRoom: (code: string) => void;
  /** Join the per-gameId matchmaking queue. Server assigns a room automatically. */
  quickPlay: () => void;
  leaveRoom: () => void;
  sendAction: (action: AnyGameAction) => void;
  requestRematch: () => void;
  clearError: () => void;
  /** Send a chat message to 'room' or 'global' scope. */
  sendChat: (scope: ChatScope, message: string) => void;
  /** Update this player's global nickname. Validated and confirmed by server. */
  setNickname: (nickname: string) => void;
}

function makeLobbyState<TState extends AnyGameState>(): MultiplayerState<TState> {
  return {
    connection: 'idle',
    phase: 'lobby',
    roomCode: null,
    playerIndex: null,
    isSpectator: false,
    playerCount: 0,
    spectatorCount: 0,
    gameState: null,
    error: null,
    rematchVotes: 0,
    myVotedRematch: false,
    rematchError: null,
    stats: null,
    players: [],
    history: [],
    myNickname: '',
    matchCountdown: null,
    roomMessages: [],
    globalMessages: [],
    chatError: null,
  };
}

const TOKEN_KEY = 'wg_player_token';
const NICK_KEY = 'wg_nickname';

const NICK_ADJ = ['Blue', 'Red', 'Wild', 'Dark', 'Swift', 'Brave', 'Calm', 'Bold', 'Keen', 'Vast'];
const NICK_NOUN = ['Tiger', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Lynx', 'Otter', 'Panda', 'Raven'];

function getOrCreateNickname(): string {
  if (typeof window === 'undefined') return 'Player';
  let nick = localStorage.getItem(NICK_KEY);
  if (!nick) {
    const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
    const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    nick = `${adj}${noun}${num}`;
    localStorage.setItem(NICK_KEY, nick);
  }
  return nick;
}

function getOrCreateToken(): string {
  if (typeof window === 'undefined') return '';
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    // Simple UUID-v4-ish token
    token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function useMultiplayer<TState extends AnyGameState = AnyGameState>(
  wsUrl: string,
  gameId: GameId,
): MultiplayerState<TState> & MultiplayerActions {
  const socketRef = useRef<GameSocket | null>(null);
  const tokenRef = useRef<string>('');
  const nicknameRef = useRef<string>('');
  const gameIdRef = useRef<GameId>(gameId);
  const cdTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [s, set] = useState<MultiplayerState<TState>>(() => makeLobbyState<TState>());

  // Keep refs for callbacks that need current values without re-subscribing
  const roomCodeRef = useRef<string | null>(null);
  useEffect(() => { roomCodeRef.current = s.roomCode; }, [s.roomCode]);

  useEffect(() => {
    tokenRef.current = getOrCreateToken();
    nicknameRef.current = getOrCreateNickname();

    const socket: GameSocket = io(wsUrl, {
      autoConnect: false,
      // Socket.IO built-in reconnection — fires 'connect' again after recovery
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    set((prev) => ({ ...prev, connection: 'connecting' }));
    socket.connect();

    // ── Connection lifecycle ───────────────────────────────────────────────
    socket.on('connect', () => {
      set((prev) => ({ ...prev, connection: 'connected', error: null, myNickname: nicknameRef.current }));
      socket.emit('identify', { playerToken: tokenRef.current, nickname: nicknameRef.current });
      socket.emit('get_stats', { gameId: gameIdRef.current });
      socket.emit('get_history');
    });

    socket.on('disconnect', (reason) => {
      // 'io server disconnect' means the server kicked us — do not auto-reconnect
      if (reason === 'io server disconnect') {
        set((prev) => ({ ...prev, connection: 'error' }));
      } else {
        set((prev) => ({ ...prev, connection: 'connecting' }));
      }
    });

    socket.on('connect_error', () =>
      set((prev) => ({ ...prev, connection: 'error', error: 'Cannot reach game server.' })),
    );

    // ── Room events ────────────────────────────────────────────────────────
    socket.on('room_created', ({ roomCode, playerIndex, players }) =>
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator: false,
        phase: 'waiting',
        playerCount: 1,
        spectatorCount: 0,
        players,
        error: null,
      })),
    );

    socket.on('room_joined', ({ roomCode, playerIndex, isSpectator, playerCount, spectatorCount, state, players }) =>
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator,
        playerCount,
        spectatorCount,
        gameState: state as TState | null,
        players,
        phase: isSpectator
          ? (state?.status !== 'ongoing' ? 'ended' : 'playing')
          : (state ? 'playing' : 'waiting'),
        error: null,
      })),
    );

    // Reconnect: server restored our seat
    socket.on('room_rejoined', ({ roomCode, playerIndex, playerCount, spectatorCount, state, players }) =>
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator: false,
        playerCount,
        spectatorCount,
        gameState: state as TState | null,
        players,
        phase: !state
          ? 'waiting'
          : state.status !== 'ongoing'
          ? 'ended'
          : 'playing',
        error: null,
      })),
    );

    socket.on('player_joined', ({ playerCount, spectatorCount, state, players }) =>
      set((prev) => ({
        ...prev,
        phase: 'playing',
        playerCount,
        spectatorCount,
        gameState: state as TState,
        players,
        error: null,
      })),
    );

    socket.on('player_rejoined', ({ playerCount, players }) =>
      set((prev) => ({ ...prev, playerCount, players, error: null })),
    );

    socket.on('player_left', ({ playerIndex, playerCount }) =>
      set((prev) => {
        const nick = prev.players.find((p) => p.index === playerIndex)?.nickname ?? `Player ${playerIndex + 1}`;
        return {
          ...prev,
          phase: 'ended',
          playerCount,
          rematchVotes: 0,
          myVotedRematch: false,
          error: `${nick} disconnected.`,
        };
      }),
    );

    socket.on('game_state', ({ state, spectatorCount }) =>
      set((prev) => ({
        ...prev,
        gameState: state as TState,
        spectatorCount,
        phase: state.status !== 'ongoing' ? 'ended' : 'playing',
      })),
    );

    socket.on('spectator_count_changed', ({ spectatorCount }) =>
      set((prev) => ({ ...prev, spectatorCount })),
    );

    socket.on('room_error', ({ message }) =>
      set((prev) => ({ ...prev, error: message })),
    );
    socket.on('action_error', ({ message }) =>
      set((prev) => ({ ...prev, error: message })),
    );

    socket.on('rematch_requested', ({ votes }) =>
      set((prev) => ({ ...prev, rematchVotes: votes })),
    );

    socket.on('rematch_started', ({ state }) =>
      set((prev) => ({
        ...prev,
        gameState: state as TState,
        phase: 'playing',
        rematchVotes: 0,
        myVotedRematch: false,
        rematchError: null,
        error: null,
      })),
    );

    socket.on('stats_updated', ({ gameId: updatedId, stats }) => {
      if (updatedId === gameIdRef.current) {
        set((prev) => ({ ...prev, stats }));
      }
    });

    socket.on('history', ({ items }) =>
      set((prev) => ({ ...prev, history: items })),
    );

    socket.on('match_starting', ({ startsInMs }) => {
      cdTimersRef.current.forEach(clearTimeout);
      cdTimersRef.current = [];
      const step = startsInMs / 3;
      set((prev) => ({ ...prev, matchCountdown: '3' }));
      cdTimersRef.current.push(
        setTimeout(() => set((prev) => ({ ...prev, matchCountdown: '2' })), step),
        setTimeout(() => set((prev) => ({ ...prev, matchCountdown: '1' })), step * 2),
        setTimeout(() => set((prev) => ({ ...prev, matchCountdown: 'Go!' })), startsInMs),
        setTimeout(() => set((prev) => ({ ...prev, matchCountdown: null })), startsInMs + 650),
      );
    });

    socket.on('rematch_error', ({ message }) => {
      set((prev) => ({ ...prev, myVotedRematch: false, rematchError: message }));
      setTimeout(() => set((prev) => ({ ...prev, rematchError: null })), 4000);
    });

    socket.on('chat_history', ({ scope, messages }) => {
      if (scope === 'global') {
        set((prev) => ({ ...prev, globalMessages: messages }));
      } else {
        set((prev) => ({ ...prev, roomMessages: messages }));
      }
    });

    socket.on('chat_message', ({ message }) => {
      set((prev) => {
        if (message.scope === 'global') {
          return { ...prev, globalMessages: [...prev.globalMessages, message].slice(-100) };
        }
        return { ...prev, roomMessages: [...prev.roomMessages, message].slice(-50) };
      });
    });

    socket.on('nickname_set', ({ nickname }) => {
      nicknameRef.current = nickname;
      if (typeof window !== 'undefined') localStorage.setItem(NICK_KEY, nickname);
      set((prev) => ({ ...prev, myNickname: nickname }));
    });

    socket.on('chat_error', ({ message }) => {
      set((prev) => ({ ...prev, chatError: message }));
      setTimeout(() => set((prev) => ({ ...prev, chatError: null })), 4000);
    });

    return () => {
      cdTimersRef.current.forEach(clearTimeout);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsUrl]);

  const createRoom = useCallback((options?: { visibility?: RoomVisibility; roomName?: string }) => {
    set((prev) => ({ ...prev, error: null }));
    socketRef.current?.emit('create_room', {
      playerToken: tokenRef.current,
      gameId: gameIdRef.current,
      nickname: nicknameRef.current,
      visibility: options?.visibility ?? 'private',
      roomName: options?.roomName,
    });
  }, []);

  const joinRoom = useCallback((code: string) => {
    set((prev) => ({ ...prev, error: null }));
    socketRef.current?.emit('join_room', {
      roomCode: code.toUpperCase().trim(),
      playerToken: tokenRef.current,
      nickname: nicknameRef.current,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    const code = roomCodeRef.current;
    if (socketRef.current && code) {
      socketRef.current.emit('leave_room', { roomCode: code });
    }
    set((prev) => ({ ...makeLobbyState<TState>(), connection: prev.connection, stats: prev.stats, history: prev.history, myNickname: prev.myNickname, globalMessages: prev.globalMessages }));
  }, []);

  const sendAction = useCallback((action: AnyGameAction) => {
    const code = roomCodeRef.current;
    if (code) socketRef.current?.emit('game_action', { roomCode: code, action });
  }, []);

  const requestRematch = useCallback(() => {
    const code = roomCodeRef.current;
    if (!code) return;
    set((prev) => ({ ...prev, myVotedRematch: true }));
    socketRef.current?.emit('request_rematch', { roomCode: code });
  }, []);

  const quickPlay = useCallback(() => {
    set((prev) => ({ ...prev, error: null }));
    socketRef.current?.emit('quick_play', {
      gameId: gameIdRef.current,
      playerToken: tokenRef.current,
      nickname: nicknameRef.current,
    });
  }, []);

  const clearError = useCallback(() => set((prev) => ({ ...prev, error: null })), []);

  const sendChat = useCallback((scope: ChatScope, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    socketRef.current?.emit('chat_send', {
      scope,
      roomCode: roomCodeRef.current ?? undefined,
      message: trimmed,
    });
  }, []);

  const setNickname = useCallback((nickname: string) => {
    const trimmed = nickname.trim().slice(0, 16);
    if (trimmed.length < 2) return;
    nicknameRef.current = trimmed;
    if (typeof window !== 'undefined') localStorage.setItem(NICK_KEY, trimmed);
    set((prev) => ({ ...prev, myNickname: trimmed }));
    socketRef.current?.emit('set_nickname', { nickname: trimmed });
  }, []);

  return { ...s, createRoom, joinRoom, quickPlay, leaveRoom, sendAction, requestRematch, clearError, sendChat, setNickname };
}
