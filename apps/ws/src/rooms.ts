import type { AnyGameState, GameId, RoomVisibility } from 'shared';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** How long a disconnected player's seat is held before they are evicted (ms) */
export const PLAYER_RECONNECT_MS = 30_000;
/** How long an empty room is kept alive after the last player's eviction timer starts (ms) */
export const ROOM_IDLE_CLEANUP_MS = 60_000;

// ─── Data structures ──────────────────────────────────────────────────────────

export interface RoomPlayer {
  socketId: string;
  index: 0 | 1;
  playerToken: string;
  nickname: string;
}

export interface Room {
  code: string;
  gameId: GameId;
  visibility: RoomVisibility;
  roomName?: string;
  /** Only currently-connected players. Max 2. */
  players: RoomPlayer[];
  /** Socket IDs of spectators (no seat, read-only). */
  spectators: Set<string>;
  state: AnyGameState | null;
  createdAt: number;
  /** Player indices (0|1) who have voted for a rematch. */
  rematchVotes: Set<0 | 1>;
  /** Unix ms when the match may begin; null when not in countdown. */
  matchStartsAt: number | null;
}

interface TokenSession {
  roomCode: string;
  playerIndex: 0 | 1;
  /** Non-null while the player is disconnected and the eviction timer is running */
  evictTimer: ReturnType<typeof setTimeout> | null;
}

export type EvictCallback = (room: Room, playerIndex: 0 | 1) => void;
export type CleanupCallback = (room: Room) => void;

// ─── RoomManager ──────────────────────────────────────────────────────────────

class RoomManager {
  private readonly rooms = new Map<string, Room>();

  /** socketId → roomCode (all roles: player + spectator) */
  private readonly socketRoom = new Map<string, string>();
  /** Spectator socket IDs (subset of socketRoom) */
  private readonly spectatorSockets = new Set<string>();

  /** playerToken → session (only for players, not spectators) */
  private readonly tokenSessions = new Map<string, TokenSession>();
  /** socketId → playerToken (only for connected players) */
  private readonly socketTokens = new Map<string, string>();

  private readonly roomCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private evictCb: EvictCallback | null = null;
  private cleanupCb: CleanupCallback | null = null;

  onPlayerEvicted(cb: EvictCallback) { this.evictCb = cb; }
  onRoomCleaned(cb: CleanupCallback) { this.cleanupCb = cb; }

  // ── Public API ──────────────────────────────────────────────────────────────

  createRoom(
    socketId: string,
    playerToken: string,
    gameId: GameId = 'tictactoe',
    nickname = 'Player 1',
    visibility: RoomVisibility = 'private',
    roomName?: string,
  ): Room {
    const code = this.generateCode();
    const room: Room = {
      code,
      gameId,
      visibility,
      roomName,
      players: [{ socketId, index: 0, playerToken, nickname }],
      spectators: new Set(),
      state: null,
      createdAt: Date.now(),
      rematchVotes: new Set(),
      matchStartsAt: null,
    };
    this.rooms.set(code, room);
    this.socketRoom.set(socketId, code);
    this.socketTokens.set(socketId, playerToken);
    this.tokenSessions.set(playerToken, { roomCode: code, playerIndex: 0, evictTimer: null });
    return room;
  }

  /**
   * Try to reclaim a seat with a stored token (reconnect after refresh).
   * Returns the room + player on success, null if token is unknown or room is gone.
   */
  claimSession(playerToken: string, newSocketId: string, nickname?: string): { room: Room; player: RoomPlayer } | null {
    const session = this.tokenSessions.get(playerToken);
    if (!session) return null;

    const room = this.rooms.get(session.roomCode);
    if (!room) {
      this.tokenSessions.delete(playerToken);
      return null;
    }

    // Cancel eviction timer
    if (session.evictTimer !== null) {
      clearTimeout(session.evictTimer);
      session.evictTimer = null;
    }
    this.cancelRoomCleanup(room.code);

    // Re-attach socket ID (player may have been removed from room.players while offline)
    let player = room.players.find((p) => p.playerToken === playerToken);
    if (player) {
      this.socketRoom.delete(player.socketId);
      this.socketTokens.delete(player.socketId);
      player.socketId = newSocketId;
    } else {
      player = { socketId: newSocketId, index: session.playerIndex, playerToken, nickname: '' };
      room.players.push(player);
    }

    this.socketRoom.set(newSocketId, room.code);
    this.socketTokens.set(newSocketId, playerToken);
    if (nickname) player.nickname = nickname;
    return { room, player };
  }

  /**
   * Join room as player 1. Returns Room on success or an error string.
   * Call joinAsSpectator() instead if the room is full.
   */
  joinAsPlayer(
    code: string,
    socketId: string,
    playerToken: string,
    nickname = 'Player 2',
  ): Room | 'ROOM_NOT_FOUND' | 'ALREADY_IN_ROOM' {
    const room = this.rooms.get(code);
    if (!room) return 'ROOM_NOT_FOUND';
    if (room.players.some((p) => p.playerToken === playerToken || p.socketId === socketId)) {
      return 'ALREADY_IN_ROOM';
    }

    room.players.push({ socketId, index: 1, playerToken, nickname });
    this.socketRoom.set(socketId, code);
    this.socketTokens.set(socketId, playerToken);
    this.tokenSessions.set(playerToken, { roomCode: code, playerIndex: 1, evictTimer: null });
    this.cancelRoomCleanup(code); // room is active again
    return room;
  }

  joinAsSpectator(code: string, socketId: string): Room | 'ROOM_NOT_FOUND' {
    const room = this.rooms.get(code);
    if (!room) return 'ROOM_NOT_FOUND';
    room.spectators.add(socketId);
    this.socketRoom.set(socketId, code);
    this.spectatorSockets.add(socketId);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomBySocket(socketId: string): Room | undefined {
    const code = this.socketRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  getPlayer(room: Room, socketId: string): RoomPlayer | undefined {
    return room.players.find((p) => p.socketId === socketId);
  }

  /** Returns the stable playerToken bound to this socket, or undefined if unrecognised. */
  getTokenForSocket(socketId: string): string | undefined {
    return this.socketTokens.get(socketId);
  }

  isSpectator(socketId: string): boolean {
    return this.spectatorSockets.has(socketId);
  }

  /** All public rooms that have exactly one player and are open for a second. */
  getPublicWaitingRooms(): Room[] {
    return [...this.rooms.values()].filter(
      (r) => r.visibility === 'public' && r.players.length === 1,
    );
  }

  /**
   * Record a rematch vote from the player identified by socketId.
   * Returns { votes, ready } on success, null if socket is not a player in any room.
   */
  voteRematch(socketId: string): { votes: number; ready: boolean } | null {
    const code = this.socketRoom.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    room.rematchVotes.add(player.index);
    return { votes: room.rematchVotes.size, ready: room.rematchVotes.size >= 2 };
  }

  /**
   * Remove a socket from its room.
   * - Spectators are removed immediately.
   * - Players are removed from room.players and an eviction timer is started.
   *   If they reconnect before the timer fires, claimSession() restores their seat.
   */
  removeSocket(
    socketId: string,
  ): { type: 'player'; room: Room; player: RoomPlayer } | { type: 'spectator'; room: Room } | null {
    const code = this.socketRoom.get(socketId);
    if (!code) return null;
    this.socketRoom.delete(socketId);

    const room = this.rooms.get(code);
    if (!room) {
      this.spectatorSockets.delete(socketId);
      this.socketTokens.delete(socketId);
      return null;
    }

    // ── Spectator ────────────────────────────────────────────────────────────
    if (this.spectatorSockets.has(socketId)) {
      this.spectatorSockets.delete(socketId);
      room.spectators.delete(socketId);
      return { type: 'spectator', room };
    }

    // ── Player ───────────────────────────────────────────────────────────────
    const idx = room.players.findIndex((p) => p.socketId === socketId);
    if (idx === -1) {
      this.socketTokens.delete(socketId);
      return null;
    }

    const [player] = room.players.splice(idx, 1);
    // A rematch requires both players — cancel any pending votes when one leaves
    room.rematchVotes.clear();
    const token = this.socketTokens.get(socketId);
    this.socketTokens.delete(socketId);

    if (token) {
      const session = this.tokenSessions.get(token);
      if (session) {
        session.evictTimer = setTimeout(() => this.evictPlayer(token, room), PLAYER_RECONNECT_MS);
      }
    }

    if (room.players.length === 0) {
      this.scheduleRoomCleanup(room);
    }

    return { type: 'player', room, player };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private evictPlayer(token: string, room: Room) {
    const session = this.tokenSessions.get(token);
    if (!session) return;
    const { playerIndex } = session;
    this.tokenSessions.delete(token);

    // If no remaining sessions for this room and no active players → mark for fast cleanup
    const roomHasSession = [...this.tokenSessions.values()].some((s) => s.roomCode === room.code);
    if (!roomHasSession && room.players.length === 0 && room.spectators.size === 0) {
      this.rooms.delete(room.code);
      this.cancelRoomCleanup(room.code);
    }

    this.evictCb?.(room, playerIndex);
  }

  private scheduleRoomCleanup(room: Room) {
    this.cancelRoomCleanup(room.code);
    const timer = setTimeout(() => {
      this.roomCleanupTimers.delete(room.code);
      if (room.players.length > 0) return; // someone reconnected

      console.log(`[room] idle cleanup ${room.code}`);
      this.rooms.delete(room.code);

      // Kick spectators from tracking maps
      for (const sid of room.spectators) {
        this.socketRoom.delete(sid);
        this.spectatorSockets.delete(sid);
      }
      room.spectators.clear();

      // Clear any remaining token sessions for this room
      for (const [tok, sess] of this.tokenSessions) {
        if (sess.roomCode === room.code) {
          if (sess.evictTimer !== null) clearTimeout(sess.evictTimer);
          this.tokenSessions.delete(tok);
        }
      }

      this.cleanupCb?.(room);
    }, ROOM_IDLE_CLEANUP_MS);
    this.roomCleanupTimers.set(room.code, timer);
  }

  private cancelRoomCleanup(code: string) {
    const timer = this.roomCleanupTimers.get(code);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.roomCleanupTimers.delete(code);
    }
  }

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}

export const roomManager = new RoomManager();
