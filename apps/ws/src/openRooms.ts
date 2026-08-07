import type { GameId, OpenRoomInfo, PublicRoomListItem } from 'shared';
import type { GameServer } from './serverTypes.js';
import { roomManager } from './rooms.js';
import { buildCosmetics } from './cosmetics.js';

/** Per-gameId matchmaking queue: gameId → waiting room info */
export const quickPlayQueue = new Map<GameId, OpenRoomInfo>();

/** Remove a room from the quick-play queue (e.g. when it empties). */
export function dropFromQuickPlayQueue(roomCode: string) {
  for (const [gid, entry] of quickPlayQueue) {
    if (entry.roomCode === roomCode) { quickPlayQueue.delete(gid); break; }
  }
}

// ── Public room rate limiter (per IP, in-memory) ──────────────────────────────

export const PUBLIC_ROOM_RATE_LIMIT = 3;
export const PUBLIC_ROOM_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const publicRoomCreations = new Map<string, { count: number; firstAt: number }>();

/** Evict stale rate-limiter entries (call periodically). */
export function cleanPublicRoomRateLimiter() {
  const cutoff = Date.now() - PUBLIC_ROOM_RATE_WINDOW_MS;
  for (const [ip, entry] of publicRoomCreations) {
    if (entry.firstAt < cutoff) publicRoomCreations.delete(ip);
  }
}

export function getClientIp(handshake: { headers: Record<string, string | string[] | undefined>; address: string }): string {
  const fwd = handshake.headers['x-forwarded-for'];
  if (fwd) {
    const raw = Array.isArray(fwd) ? fwd[0] : fwd;
    return raw.split(',')[0].trim();
  }
  return handshake.address;
}

export function canCreatePublicRoom(ip: string): boolean {
  const now = Date.now();
  const entry = publicRoomCreations.get(ip);
  if (!entry || now - entry.firstAt > PUBLIC_ROOM_RATE_WINDOW_MS) {
    publicRoomCreations.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= PUBLIC_ROOM_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Public room list ─────────────────────────────────────────────────────────

export function getPublicRoomList(): PublicRoomListItem[] {
  const items = roomManager.getPublicRooms().map((room) => ({
    code: room.code,
    gameId: room.gameId,
    roomName: room.roomName,
    hostNickname: room.players[0]?.nickname ?? 'Unknown',
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    hostAvatarId: room.players[0]?.avatarId,
    hostNameColor: room.players[0]?.nameColor,
    hostAvatarFrame: room.players[0]?.avatarFrame,
    hostCosmetics: room.players[0] ? buildCosmetics(room.players[0]) : undefined,
  }));
  // Sort: joinable (has space, not empty) → empty → full; newest-first within each group
  items.sort((a, b) => {
    const pri = (item: typeof a) => {
      if (item.playerCount > 0 && item.playerCount < item.maxPlayers) return 0; // joinable
      if (item.playerCount === 0) return 1; // empty
      return 2; // full
    };
    const diff = pri(a) - pri(b);
    return diff !== 0 ? diff : b.createdAt - a.createdAt;
  });
  return items;
}

export function broadcastOpenRooms(io: GameServer) {
  io.emit('open_rooms', { rooms: getPublicRoomList() });
}
