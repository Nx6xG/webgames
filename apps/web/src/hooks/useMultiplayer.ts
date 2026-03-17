'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '@/lib/getWsUrl';
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
  CosmeticsSelection,
  OnlineUser,
} from 'shared';
import { trackAchievementEvent } from '@/lib/achievements/engine';
import { useAchievementToasts } from '@/components/ui/AchievementToasts';
import { loadCosmetics, saveCosmetics, mergeCosmetics } from '@/lib/cosmetics';
import { loadProgression } from '@/lib/progression';
import { loadShowcaseConfig, buildShowcase } from '@/lib/showcase';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type RoomPhase = 'lobby' | 'waiting' | 'playing' | 'ended';

export interface MultiplayerState<TState extends AnyGameState = AnyGameState> {
  connection: ConnectionStatus;
  phase: RoomPhase;
  roomCode: string | null;
  playerIndex: number | null;
  isSpectator: boolean;
  playerCount: number;
  /** Room capacity (from server). Defaults to 2 until a room event provides it. */
  roomMaxPlayers: number;
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
  /** This player's avatar ID (from localStorage). */
  myAvatarId: string;
  /** Current countdown label ('3'|'2'|'1'|'Go!'|null). Non-null while pre-game countdown is running. */
  matchCountdown: string | null;
  /**
   * True when both players have an active game-page socket in the room.
   * Countdown and gameplay are only enabled when this is true.
   */
  roomReady: boolean;
  /** Chat messages for the current room (cleared on leave). */
  roomMessages: ChatMessage[];
  /** Platform-wide global chat messages. */
  globalMessages: ChatMessage[];
  /** Non-null when the server rejected a chat action. Auto-clears after 4 s. */
  chatError: string | null;
  /** Online users from presence system. */
  onlineUsers: OnlineUser[];
  /** Accumulated game state snapshots for replay (one per game_state event). */
  stateHistory: TState[];
  /** Non-null when an opponent has disconnected and the grace period is running. */
  opponentDisconnectedAt: number | null;
  /** Duration (ms) of the reconnect grace period for the disconnected opponent. */
  opponentGracePeriodMs: number;
  /** Player index of the disconnected opponent (for display). */
  disconnectedPlayerIndex: number | null;
}

export interface MultiplayerActions {
  createRoom: (options?: { visibility?: RoomVisibility; roomName?: string; rpsConfig?: { mode: string; bestOf?: number }; ldConfig?: { mode: string }; battleshipConfig?: { fleetPreset: string; boardSize?: number; salvoMode?: boolean; shotTimerSec?: number }; cfConfig?: { bestOf?: number; speed?: string; powerUpDensity?: string; thickness?: string; noGaps?: boolean; shrinkingArena?: boolean; suddenDeath?: boolean; disabledPowerUps?: string[]; obstacles?: boolean; teamMode?: boolean; arenaShape?: string; mapSize?: string; bots?: Array<{ token: string; difficulty: string; nickname: string }> }; unoConfig?: { targetScore?: number; stackDraw2?: boolean; stackDraw4?: boolean; allowDraw2OnDraw4?: boolean; allowDraw4OnDraw2?: boolean; playDrawnCardImmediately?: boolean; drawUntilPlayable?: boolean; forcedPlay?: boolean; stackSameCards?: boolean }; chessConfig?: { timeSeconds: number; incrementSeconds: number }; ncConfig?: { botDifficulty?: string }; maxPlayers?: number }) => void;
  joinRoom: (code: string) => void;
  /** Join the per-gameId matchmaking queue. Server assigns a room automatically. */
  quickPlay: () => void;
  leaveRoom: () => void;
  sendAction: (action: AnyGameAction) => void;
  requestRematch: () => void;
  returnToLobby: () => void;
  clearError: () => void;
  /** Send a chat message to 'room' or 'global' scope. */
  sendChat: (scope: ChatScope, message: string) => void;
  /** Update this player's global nickname. Validated and confirmed by server. */
  setNickname: (nickname: string) => void;
  /** Update this player's avatar. Stored locally and synced to server. */
  setAvatarId: (id: string) => void;
  /** Update this player's name color. Stored locally and synced to server. */
  setNameColor: (color: string | undefined) => void;
  /** Update this player's avatar frame. Stored locally and synced to server. */
  setAvatarFrame: (frame: string | undefined) => void;
  /** Invite an online player into the current room (host only). */
  sendRoomInvite: (toToken: string) => void;
  /** Refresh the online users list from the server. */
  fetchOnlineUsers: () => void;
}

function makeLobbyState<TState extends AnyGameState>(): MultiplayerState<TState> {
  return {
    connection: 'idle',
    phase: 'lobby',
    roomCode: null,
    playerIndex: null,
    isSpectator: false,
    playerCount: 0,
    roomMaxPlayers: 2,
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
    myAvatarId: '',
    matchCountdown: null,
    roomReady: false,
    roomMessages: [],
    globalMessages: [],
    chatError: null,
    onlineUsers: [],
    stateHistory: [],
    opponentDisconnectedAt: null,
    opponentGracePeriodMs: 0,
    disconnectedPlayerIndex: null,
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
  const cosmeticsRef = useRef<CosmeticsSelection>({ slots: {} });
  const gameIdRef = useRef<GameId>(gameId);
  const cdTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const achToasts = useAchievementToasts();
  const fireAch = useCallback((ev: Parameters<typeof trackAchievementEvent>[0]) => {
    const ids = trackAchievementEvent(ev);
    if (ids.length > 0) achToasts.push(ids);
  }, [achToasts]);

  const [s, set] = useState<MultiplayerState<TState>>(() => makeLobbyState<TState>());

  // Keep refs for callbacks that need current values without re-subscribing
  const roomCodeRef = useRef<string | null>(null);
  useEffect(() => { roomCodeRef.current = s.roomCode; }, [s.roomCode]);

  useEffect(() => {
    tokenRef.current = getOrCreateToken();
    nicknameRef.current = getOrCreateNickname();
    cosmeticsRef.current = loadCosmetics();

    const socket: GameSocket = io(wsUrl || getWsUrl(), {
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
      const c = cosmeticsRef.current;
      set((prev) => ({ ...prev, connection: 'connected', error: null, myNickname: nicknameRef.current, myAvatarId: c.avatarId || '' }));
      const prog = loadProgression();
      const showcase = buildShowcase(loadShowcaseConfig());
      socket.emit('identify', { playerToken: tokenRef.current, nickname: nicknameRef.current, avatarId: c.avatarId || undefined, nameColor: c.nameColor || undefined, avatarFrame: c.slots?.frame || undefined, cosmetics: c, level: prog.level, showcase });
      socket.emit('presence_update', { activity: { kind: 'game', gameId: gameIdRef.current } });
      socket.emit('get_stats', { gameId: gameIdRef.current });
      socket.emit('get_history');
      socket.emit('get_online_users');
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
    socket.on('room_created', ({ roomCode, playerIndex, players, maxPlayers }) => {
      fireAch({ type: 'lobby_hosted' });
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator: false,
        phase: 'waiting',
        playerCount: 1,
        roomMaxPlayers: maxPlayers,
        spectatorCount: 0,
        players,
        roomReady: false,
        error: null,
      }));
    });

    socket.on('room_joined', ({ roomCode, playerIndex, isSpectator, isPublic, playerCount, maxPlayers, spectatorCount, state, players }) => {
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator,
        playerCount,
        roomMaxPlayers: maxPlayers,
        spectatorCount,
        gameState: state as TState | null,
        players,
        phase: isSpectator
          ? (state?.status !== 'ongoing' ? 'ended' : 'playing')
          : (state ? 'playing' : 'waiting'),
        error: null,
        stateHistory: state ? [state as TState] : [],
      }));
      if (isPublic && !isSpectator) fireAch({ type: 'public_game_joined' });
    });

    // Reconnect: server restored our seat
    socket.on('room_rejoined', ({ roomCode, playerIndex, playerCount, maxPlayers, spectatorCount, state, players }) =>
      set((prev) => ({
        ...prev,
        roomCode,
        playerIndex,
        isSpectator: false,
        playerCount,
        roomMaxPlayers: maxPlayers,
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
      set((prev) => ({ ...prev, playerCount, players, error: null, opponentDisconnectedAt: null, disconnectedPlayerIndex: null })),
    );

    // Transient network disconnect — opponent may reconnect within grace period
    socket.on('player_disconnected', ({ playerIndex, playerCount, gracePeriodMs }) =>
      set((prev) => ({
        ...prev,
        playerCount,
        opponentDisconnectedAt: Date.now(),
        opponentGracePeriodMs: gracePeriodMs,
        disconnectedPlayerIndex: playerIndex,
      })),
    );

    // Permanent leave (explicit leave_room or eviction after grace period expired)
    socket.on('player_left', ({ playerIndex, playerCount }) =>
      set((prev) => {
        const nick = prev.players.find((p) => p.index === playerIndex)?.nickname ?? `Player ${playerIndex + 1}`;
        // If room wasn't ready yet (e.g. invite sender's online socket briefly disconnected
        // before their game socket could claim the session), stay in waiting phase so the
        // reconnect flow can restore the room without showing a spurious "game ended" screen.
        if (!prev.roomReady) {
          return { ...prev, playerCount, roomReady: false, opponentDisconnectedAt: null, disconnectedPlayerIndex: null };
        }
        return {
          ...prev,
          phase: 'ended',
          playerCount,
          roomReady: false,
          rematchVotes: 0,
          myVotedRematch: false,
          opponentDisconnectedAt: null,
          disconnectedPlayerIndex: null,
          error: `${nick} disconnected.`,
        };
      }),
    );

    socket.on('room_ready', ({ ready }) =>
      set((prev) => ({ ...prev, roomReady: ready })),
    );

    socket.on('game_state', ({ state, spectatorCount }) =>
      set((prev) => ({
        ...prev,
        gameState: state as TState,
        spectatorCount,
        phase: state.status !== 'ongoing' ? 'ended' : 'playing',
        stateHistory: [...prev.stateHistory, state as TState],
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
        stateHistory: [state as TState],
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

    socket.on('returned_to_lobby', () =>
      set((prev) => ({
        ...prev,
        phase: 'waiting',
        // Don't clear gameState — server re-creates initial state and sends game_state event
        rematchVotes: 0,
        myVotedRematch: false,
        rematchError: null,
        error: null,
        stateHistory: [],
      })),
    );

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

    socket.on('nickname_set', ({ nickname, avatarId, nameColor, avatarFrame, cosmetics }) => {
      nicknameRef.current = nickname;
      if (typeof window !== 'undefined') localStorage.setItem(NICK_KEY, nickname);
      // Sync cosmetics from server response
      if (cosmetics) {
        cosmeticsRef.current = cosmetics;
        saveCosmetics(cosmetics);
      } else {
        // Fallback: build from legacy fields
        const patch: Partial<CosmeticsSelection> = {};
        if (avatarId !== undefined) patch.avatarId = avatarId;
        if (nameColor !== undefined) patch.nameColor = nameColor || undefined;
        if (avatarFrame !== undefined) patch.slots = { frame: avatarFrame || undefined };
        cosmeticsRef.current = mergeCosmetics(cosmeticsRef.current, patch);
        saveCosmetics(cosmeticsRef.current);
      }
      set((prev) => ({ ...prev, myNickname: nickname, ...(avatarId !== undefined ? { myAvatarId: avatarId } : {}) }));
    });

    socket.on('chat_error', ({ message }) => {
      set((prev) => ({ ...prev, chatError: message }));
      setTimeout(() => set((prev) => ({ ...prev, chatError: null })), 4000);
    });

    socket.on('online_users', ({ users }) => {
      set((prev) => ({ ...prev, onlineUsers: users }));
    });

    // Live cosmetics / nickname updates from other players in the room.
    // RoomPlayerInfo doesn't carry playerToken, so we match by finding the
    // player whose old nickname/avatarId most closely matches. This is best-effort;
    // full player list is re-synced on rejoin.
    socket.on('room_profile', ({ nickname, avatarId: aid, nameColor: nc, avatarFrame: af, cosmetics: cos }) => {
      set((prev) => {
        // Try to find which player changed. If cosmetics has avatarId, match on that;
        // otherwise try matching by nickname (old value still in players list).
        const updated = [...prev.players];
        let matched = false;
        for (let i = 0; i < updated.length; i++) {
          const old = updated[i];
          // Skip self (our own changes are handled by nickname_set)
          if (old.nickname === prev.myNickname) continue;
          // Match: same old nickname, or (old avatarId matches before the change)
          if (old.nickname === nickname || (aid && old.avatarId === aid)) {
            updated[i] = {
              ...old,
              nickname,
              avatarId: cos?.avatarId ?? aid ?? old.avatarId,
              nameColor: cos?.nameColor ?? nc ?? old.nameColor,
              avatarFrame: cos?.slots?.frame ?? af ?? old.avatarFrame,
              cosmetics: cos ?? old.cosmetics,
            };
            matched = true;
            break;
          }
        }
        return matched ? { ...prev, players: updated } : prev;
      });
    });

    return () => {
      cdTimersRef.current.forEach(clearTimeout);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsUrl]);

  const createRoom = useCallback((options?: { visibility?: RoomVisibility; roomName?: string; rpsConfig?: { mode: string; bestOf?: number }; ldConfig?: { mode: string }; battleshipConfig?: { fleetPreset: string; boardSize?: number; salvoMode?: boolean; shotTimerSec?: number }; cfConfig?: { bestOf?: number; speed?: string; powerUpDensity?: string; thickness?: string; noGaps?: boolean; shrinkingArena?: boolean; suddenDeath?: boolean; disabledPowerUps?: string[]; obstacles?: boolean; teamMode?: boolean; arenaShape?: string; mapSize?: string; bots?: Array<{ token: string; difficulty: string; nickname: string }> }; unoConfig?: { targetScore?: number; stackDraw2?: boolean; stackDraw4?: boolean; allowDraw2OnDraw4?: boolean; allowDraw4OnDraw2?: boolean; playDrawnCardImmediately?: boolean; drawUntilPlayable?: boolean; forcedPlay?: boolean; stackSameCards?: boolean }; chessConfig?: { timeSeconds: number; incrementSeconds: number }; ncConfig?: { botDifficulty?: string }; maxPlayers?: number }) => {
    set((prev) => ({ ...prev, error: null }));
    socketRef.current?.emit('create_room', {
      playerToken: tokenRef.current,
      gameId: gameIdRef.current,
      nickname: nicknameRef.current,
      visibility: options?.visibility ?? 'private',
      roomName: options?.roomName,
      rpsConfig: options?.rpsConfig,
      ldConfig: options?.ldConfig,
      battleshipConfig: options?.battleshipConfig,
      cfConfig: options?.cfConfig,
      unoConfig: options?.unoConfig,
      chessConfig: options?.chessConfig,
      ncConfig: options?.ncConfig,
      maxPlayers: options?.maxPlayers,
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
    set((prev) => ({ ...makeLobbyState<TState>(), connection: prev.connection, stats: prev.stats, history: prev.history, myNickname: prev.myNickname, myAvatarId: prev.myAvatarId, globalMessages: prev.globalMessages }));
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

  const returnToLobby = useCallback(() => {
    const code = roomCodeRef.current;
    if (!code) return;
    socketRef.current?.emit('return_to_lobby', { roomCode: code });
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
    fireAch({ type: 'message_sent' });
  }, []);

  const emitCosmetics = useCallback(() => {
    const c = cosmeticsRef.current;
    socketRef.current?.emit('set_nickname', {
      nickname: nicknameRef.current,
      avatarId: c.avatarId || undefined,
      nameColor: c.nameColor || undefined,
      avatarFrame: c.slots?.frame || undefined,
      cosmetics: c,
    });
  }, []);

  const setNickname = useCallback((nickname: string) => {
    const trimmed = nickname.trim().slice(0, 16);
    if (trimmed.length < 2) return;
    nicknameRef.current = trimmed;
    if (typeof window !== 'undefined') localStorage.setItem(NICK_KEY, trimmed);
    set((prev) => ({ ...prev, myNickname: trimmed }));
    emitCosmetics();
  }, [emitCosmetics]);

  const setAvatarId = useCallback((id: string) => {
    cosmeticsRef.current = mergeCosmetics(cosmeticsRef.current, { avatarId: id });
    saveCosmetics(cosmeticsRef.current);
    set((prev) => ({ ...prev, myAvatarId: id }));
    emitCosmetics();
  }, [emitCosmetics]);

  const setNameColor = useCallback((color: string | undefined) => {
    cosmeticsRef.current = mergeCosmetics(cosmeticsRef.current, { nameColor: color });
    saveCosmetics(cosmeticsRef.current);
    emitCosmetics();
  }, [emitCosmetics]);

  const setAvatarFrame = useCallback((frame: string | undefined) => {
    cosmeticsRef.current = mergeCosmetics(cosmeticsRef.current, { slots: { frame: frame || undefined } });
    saveCosmetics(cosmeticsRef.current);
    emitCosmetics();
  }, [emitCosmetics]);

  const sendRoomInvite = useCallback((toToken: string) => {
    const code = roomCodeRef.current;
    if (code) socketRef.current?.emit('room_invite', { toToken, roomCode: code });
  }, []);

  const fetchOnlineUsers = useCallback(() => {
    socketRef.current?.emit('get_online_users');
  }, []);

  return { ...s, createRoom, joinRoom, quickPlay, leaveRoom, sendAction, requestRematch, returnToLobby, clearError, sendChat, setNickname, setAvatarId, setNameColor, setAvatarFrame, sendRoomInvite, fetchOnlineUsers };
}
