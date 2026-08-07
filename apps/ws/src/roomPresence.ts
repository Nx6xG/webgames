import type { Room } from './rooms.js';
import type { GameServer } from './serverTypes.js';

export const COUNTDOWN_MS = 3000;

/**
 * Tracks which players have an active GAME-PAGE socket in each room.
 * Only sockets from create_room / join_room / quick_play / identify→claimSession
 * are tracked. The invite_create online socket is intentionally excluded so that
 * the countdown cannot start until the inviting player actually navigates to the
 * game page.
 */
/** roomCode → playerIndex → set of active socket IDs for that seat */
export const roomGamePresence = new Map<string, Map<number, Set<string>>>();

function getRoomPresence(roomCode: string): Map<number, Set<string>> {
  let rp = roomGamePresence.get(roomCode);
  if (!rp) { rp = new Map(); roomGamePresence.set(roomCode, rp); }
  return rp;
}

/** Add a socket to the game-page presence for a given seat. */
export function addPresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = getRoomPresence(roomCode);
  let sockets = rp.get(playerIndex);
  if (!sockets) { sockets = new Set(); rp.set(playerIndex, sockets); }
  sockets.add(socketId);
}

/** Remove a socket from game-page presence for a given seat. */
export function removePresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = roomGamePresence.get(roomCode);
  if (!rp) return;
  const sockets = rp.get(playerIndex);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) rp.delete(playerIndex);
  }
}

/** Replace all sockets for a seat with a single new one (reconnect). */
export function replacePresence(roomCode: string, playerIndex: number, socketId: string) {
  const rp = getRoomPresence(roomCode);
  rp.set(playerIndex, new Set([socketId]));
}

export function emitRoomReady(io: GameServer, room: Room) {
  const rp = roomGamePresence.get(room.code);
  const p0 = (rp?.get(0)?.size ?? 0) > 0;
  const p1 = (rp?.get(1)?.size ?? 0) > 0;
  io.to(room.code).emit('room_ready', { roomCode: room.code, ready: p0 && p1, players: { p0, p1 } });
}

export function allSeatedPlayersPresent(room: Room): boolean {
  const rp = roomGamePresence.get(room.code);
  if (!rp) return false;
  for (const p of room.players) {
    const sockets = rp.get(p.index);
    if (!sockets || sockets.size === 0) return false;
  }
  return true;
}

export function startCountdown(io: GameServer, room: Room) {
  room.matchStartsAt = Date.now() + COUNTDOWN_MS;
  io.to(room.code).emit('match_starting', { startsInMs: COUNTDOWN_MS });
}

export function tryStartCountdown(io: GameServer, room: Room) {
  if (room.gameId === 'liarsbar' || room.gameId === 'uno' || room.gameId === 'curvefever') return; // lobby games use host-start instead of countdown
  if (room.players.length < room.minPlayers) return; // not enough players yet
  if (!allSeatedPlayersPresent(room)) return; // all must be on the game page
  if (room.matchStartsAt) return; // already issued
  startCountdown(io, room);
}
