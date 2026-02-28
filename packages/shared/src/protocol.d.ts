import type { TicTacToeState, TicTacToeAction } from './games/tictactoe.js';
import type { Connect4State, Connect4Action } from './games/connect4.js';
import type { GameId } from './registry.js';
/** Union of all possible game states across every registered game. */
export type AnyGameState = TicTacToeState | Connect4State;
/** Union of all possible game actions across every registered game. */
export type AnyGameAction = TicTacToeAction | Connect4Action;
/** Lightweight player descriptor sent in room events */
export interface RoomPlayerInfo {
    index: 0 | 1;
    nickname: string;
}
/** A completed match stored in personal history */
export interface Match {
    ts: number;
    gameId: GameId;
    roomCode: string;
    /** Nickname of index-0 player */
    p1: string;
    /** Nickname of index-1 player */
    p2: string;
    result: 'p1' | 'p2' | 'draw';
}
/** A quick-play room waiting for a second player */
export interface OpenRoomInfo {
    roomCode: string;
    gameId: GameId;
    hostNickname: string;
    createdAt: number;
}
export interface GameStats {
    gamesPlayed: number;
    winsByPlayerIndex: {
        0: number;
        1: number;
    };
    draws: number;
}
export type RoomErrorCode = 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_IN_ROOM';
export type ActionErrorCode = 'ROOM_NOT_FOUND' | 'NOT_IN_ROOM' | 'SPECTATOR_CANNOT_ACT' | 'GAME_NOT_STARTED' | 'MATCH_COUNTDOWN' | 'NOT_YOUR_TURN' | 'CELL_TAKEN' | 'COLUMN_FULL' | 'INVALID_POSITION' | 'INVALID_ACTION' | 'GAME_OVER' | 'RATE_LIMITED';
export type RematchErrorCode = 'GAME_NOT_OVER' | 'OPPONENT_DISCONNECTED' | 'ALREADY_VOTED';
export interface ServerToClientEvents {
    /** Emitted to the room creator (player 0) */
    room_created: (data: {
        roomCode: string;
        playerIndex: 0;
        gameId: GameId;
        players: RoomPlayerInfo[];
    }) => void;
    /**
     * Emitted to the socket that called join_room.
     * isSpectator=true when the room already had 2 players.
     */
    room_joined: (data: {
        roomCode: string;
        gameId: GameId;
        /** null when isSpectator=true */
        playerIndex: 1 | null;
        isSpectator: boolean;
        playerCount: number;
        spectatorCount: number;
        /** Current game state; null if game hasn't started yet */
        state: AnyGameState | null;
        players: RoomPlayerInfo[];
    }) => void;
    /**
     * Emitted to a reconnecting socket whose token matched an existing seat.
     * Also emitted when they leave and rejoin via identify after a refresh.
     */
    room_rejoined: (data: {
        roomCode: string;
        gameId: GameId;
        playerIndex: 0 | 1;
        playerCount: number;
        spectatorCount: number;
        state: AnyGameState | null;
        players: RoomPlayerInfo[];
    }) => void;
    /** Broadcast to the room when a second player first joins (game starts) */
    player_joined: (data: {
        playerId: string;
        playerIndex: 1;
        playerCount: number;
        spectatorCount: number;
        state: AnyGameState;
        players: RoomPlayerInfo[];
    }) => void;
    /** Broadcast to the room when a previously disconnected player reconnects */
    player_rejoined: (data: {
        playerId: string;
        playerIndex: 0 | 1;
        playerCount: number;
        players: RoomPlayerInfo[];
    }) => void;
    /** Broadcast when a player's reconnect window expires or they explicitly leave */
    player_left: (data: {
        playerId: string;
        playerIndex: number;
        playerCount: number;
    }) => void;
    /** Broadcast to all room members after a valid game action */
    game_state: (data: {
        roomCode: string;
        gameId: GameId;
        state: AnyGameState;
        spectatorCount: number;
    }) => void;
    /** Broadcast to all room members when spectator count changes */
    spectator_count_changed: (data: {
        spectatorCount: number;
    }) => void;
    room_error: (data: {
        code: RoomErrorCode;
        message: string;
    }) => void;
    action_error: (data: {
        code: ActionErrorCode;
        message: string;
    }) => void;
    rematch_error: (data: {
        code: RematchErrorCode;
        message: string;
    }) => void;
    /** Broadcast when one player votes for rematch (votes = 1) */
    rematch_requested: (data: {
        votes: number;
    }) => void;
    /** Broadcast to the room when both players accepted — game resets */
    rematch_started: (data: {
        state: AnyGameState;
    }) => void;
    /** Emitted to requester (get_stats) or broadcast to room after a game ends */
    stats_updated: (data: {
        gameId: GameId;
        stats: GameStats;
    }) => void;
    /** Broadcast to all sockets after any game ends, or sent to requester of get_all_stats */
    all_stats: (data: {
        statsByGameId: Record<GameId, GameStats>;
    }) => void;
    /** Emitted to the socket that called quick_play, once they are placed in a room */
    quick_play_joined: (data: {
        roomCode: string;
    }) => void;
    /** Sent in response to get_open_rooms, and broadcast whenever the waiting list changes */
    open_rooms: (data: {
        rooms: OpenRoomInfo[];
    }) => void;
    /** Personal match history for the requesting player */
    history: (data: {
        items: Match[];
    }) => void;
    /** Sent when both players are in the room, before moves are allowed */
    match_starting: (data: {
        startsInMs: number;
    }) => void;
}
export interface ClientToServerEvents {
    /**
     * Sent immediately after connecting. If the server has a live session for
     * this token the socket will receive room_rejoined; otherwise nothing happens.
     */
    identify: (data: {
        playerToken: string;
        nickname: string;
    }) => void;
    /** playerToken is stored server-side so the seat can survive a refresh */
    create_room: (data: {
        playerToken: string;
        gameId?: GameId;
        nickname: string;
    }) => void;
    /** If the room is full the socket joins as spectator instead */
    join_room: (data: {
        roomCode: string;
        playerToken: string;
        nickname: string;
    }) => void;
    game_action: (data: {
        roomCode: string;
        action: AnyGameAction;
    }) => void;
    leave_room: (data: {
        roomCode: string;
    }) => void;
    request_rematch: (data: {
        roomCode: string;
    }) => void;
    /** Fetch current platform stats for a game (server replies with stats_updated) */
    get_stats: (data: {
        gameId: GameId;
    }) => void;
    /** Fetch stats for every game at once (server replies with all_stats) */
    get_all_stats: () => void;
    /** Request the current list of open quick-play rooms (server replies with open_rooms) */
    get_open_rooms: () => void;
    /** Request personal match history (server replies with history event) */
    get_history: () => void;
    /**
     * Join the per-gameId matchmaking queue.
     * Server either creates a new waiting room or joins an existing one.
     * Always replies with quick_play_joined { roomCode }.
     */
    quick_play: (data: {
        gameId: GameId;
        playerToken: string;
        nickname: string;
    }) => void;
}
//# sourceMappingURL=protocol.d.ts.map